// Centralizes authenticated HTTP requests to the backend API.
import { clearCurrentProfileQueryCache } from "@/lib/query-client";
import { useApiLoadingStore } from "@/services/api-loading-store";
import { useUserStore } from "@/services/user-store";
import { extractApiErrorMessageFromPayload } from "@/shared/lib/api-error";
import { notifyRolePreferenceChanged } from "@/shared/lib/realm-role-mapping";

const API_BASE_URL = (
  import.meta.env.VITE_API_URL as string | undefined
)?.replace(/\/$/, "");

function getAuthToken() {
  return localStorage.getItem("fms-access-token");
}

function getRefreshToken() {
  return (
    localStorage.getItem("fms-refresh-token") ??
    useUserStore.getState().refreshToken
  );
}

/** Avoid refresh loops and wrong-password login flows. */
function isRefreshSkippedPath(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalized === "/auth/login" || normalized === "/auth/refresh";
}

type TokenPayload = Record<string, unknown>;

function pickString(obj: unknown, keys: string[]): string | null {
  if (!obj || typeof obj !== "object") return null;
  const record = obj as TokenPayload;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/** Matches login/refresh response shapes used across environments. */
function extractTokensFromAuthPayload(payload: unknown): {
  accessToken: string | null;
  refreshToken: string | null;
} {
  const data =
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    payload.data &&
    typeof payload.data === "object"
      ? (payload as { data: TokenPayload }).data
      : null;

  const accessToken =
    pickString(payload, ["accessToken", "access_token", "token"]) ??
    pickString(data, ["accessToken", "access_token", "token"]);

  const refreshToken =
    pickString(payload, ["refreshToken", "refresh_token"]) ??
    pickString(data, ["refreshToken", "refresh_token"]);

  return { accessToken, refreshToken };
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * POST /auth/refresh (typically …/api/v1/auth/refresh via VITE_API_URL) with
 * `{ refresh_token }` in the JSON body per API contract; updates session on success.
 * Deduplicates concurrent refresh attempts.
 */
async function tryRefreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return false;

      const url = resolveUrl("/auth/refresh");
      useApiLoadingStore.getState().begin();
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        const contentType = response.headers.get("content-type") ?? "";
        const isJson = contentType.includes("application/json");
        const payload = isJson ? await response.json() : await response.text();

        if (!response.ok) return false;

        const { accessToken, refreshToken: nextRefresh } =
          extractTokensFromAuthPayload(payload);

        if (!accessToken) return false;

        const state = useUserStore.getState();
        state.setAuthSession({
          accessToken,
          refreshToken: nextRefresh ?? state.refreshToken,
          user: state.user,
        });
        return true;
      } finally {
        useApiLoadingStore.getState().end();
      }
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

function isPublicAuthPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup")
  );
}

/**
 * Clears session and sends the user to login when the API rejects the token (401).
 * If a refresh token exists, POST /auth/refresh once more before giving up (covers
 * races and failed first attempts); only redirect when refresh is unavailable or fails.
 */
async function handleUnauthorized() {
  if (getRefreshToken()) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) return;
  }

  try {
    useUserStore.getState().clearSession();
  } catch {
    /* zustand unavailable in rare test/ssr cases */
  }
  clearCurrentProfileQueryCache();
  localStorage.removeItem("fms-current-profile");
  localStorage.removeItem("fms-role");
  localStorage.removeItem("fms-permissions");
  notifyRolePreferenceChanged();

  if (typeof window === "undefined") return;
  if (isPublicAuthPath(window.location.pathname)) return;

  window.location.replace("/login");
}

function resolveUrl(path: string) {
  if (/^https?:\/\//.test(path)) return path;
  if (!API_BASE_URL) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

/** NDI QR / callback polling — no full-screen global loader (avoids flicker during long polls). */
const GLOBAL_API_LOADING_SKIP_SUFFIXES = [
  "/ndi/proof_request",
  "/ndi/login_callback_response",
  "/ndi/check_callback_response",
] as const;

function shouldSkipGlobalApiLoading(path: string): boolean {
  const pathname = /^https?:\/\//.test(path)
    ? (() => {
        try {
          return new URL(path).pathname;
        } catch {
          return path;
        }
      })()
    : path.startsWith("/")
      ? path
      : `/${path}`;
  return GLOBAL_API_LOADING_SKIP_SUFFIXES.some(
    (suffix) => pathname === suffix || pathname.endsWith(suffix),
  );
}

function getErrorMessage(payload: unknown, status: number) {
  return extractApiErrorMessageFromPayload(payload, status) ?? `API Error: ${status}`;
}

async function fetchWithAuthHandling<T>(
  path: string,
  init: RequestInit | undefined,
  alreadyRetriedAfterRefresh: boolean,
): Promise<T> {
  const headers = new Headers(init?.headers);
  const token = getAuthToken();
  const isFormData =
    typeof FormData !== "undefined" && init?.body instanceof FormData;
  const hasBody = init?.body !== undefined && init?.body !== null;

  // Default request format to JSON, but let FormData manage its own boundary header.
  if (hasBody && !isFormData) {
    headers.set("Content-Type", "application/json");
    headers.set("ngrok-skip-browser-warning", "true");
  } else if (!headers.has("Content-Type") && !isFormData) {
    headers.set("Content-Type", "application/json");
    headers.set("ngrok-skip-browser-warning", "true");
  }

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
    headers.set("ngrok-skip-browser-warning", "true");
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("ngrok-skip-browser-warning", "true");
  }

  const url = resolveUrl(path);
  if (import.meta.env.DEV) {
    console.debug("[apiClient] request", {
      url,
      method: init?.method ?? "GET",
      headers: Object.fromEntries(headers.entries()),
    });
  }

  const response = await fetch(url, { ...init, headers });
  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  // Gracefully handle gateway/proxy HTML/text responses instead of crashing on JSON parse.
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const canAttemptRefresh =
      response.status === 401 &&
      !alreadyRetriedAfterRefresh &&
      !isRefreshSkippedPath(path) &&
      Boolean(getRefreshToken());

    if (canAttemptRefresh) {
      const refreshed = await tryRefreshAccessToken();
      if (refreshed) {
        return fetchWithAuthHandling(path, init, true);
      }
    }

    if (response.status === 401) {
      await handleUnauthorized();
    }
    const message = getErrorMessage(payload, response.status);
    throw new Error(message);
  }

  return payload as T;
}

async function fetchBlobWithAuthHandling(
  path: string,
  init: RequestInit | undefined,
  alreadyRetriedAfterRefresh: boolean,
): Promise<{ blob: Blob; contentType: string }> {
  const headers = new Headers(init?.headers);
  const token = getAuthToken();

  if (!headers.has("Accept")) {
    headers.set("Accept", "*/*");
    headers.set("ngrok-skip-browser-warning", "true");
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("ngrok-skip-browser-warning", "true");
  }

  const url = resolveUrl(path);
  const response = await fetch(url, { ...init, headers });
  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    const isJson = contentType.includes("application/json");
    const payload = isJson ? await response.json() : await response.text();

    const canAttemptRefresh =
      response.status === 401 &&
      !alreadyRetriedAfterRefresh &&
      !isRefreshSkippedPath(path) &&
      Boolean(getRefreshToken());

    if (canAttemptRefresh) {
      const refreshed = await tryRefreshAccessToken();
      if (refreshed) {
        return fetchBlobWithAuthHandling(path, init, true);
      }
    }

    if (response.status === 401) {
      await handleUnauthorized();
    }
    const message = getErrorMessage(payload, response.status);
    throw new Error(message);
  }

  return { blob: await response.blob(), contentType };
}

export async function apiGetBlob(path: string, init?: RequestInit) {
  const skipLoader = shouldSkipGlobalApiLoading(path);
  if (!skipLoader) useApiLoadingStore.getState().begin();
  try {
    return await fetchBlobWithAuthHandling(path, init, false);
  } finally {
    if (!skipLoader) useApiLoadingStore.getState().end();
  }
}

export async function apiClient<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const skipLoader = shouldSkipGlobalApiLoading(path);
  if (!skipLoader) useApiLoadingStore.getState().begin();
  try {
    return await fetchWithAuthHandling<T>(path, init, false);
  } finally {
    if (!skipLoader) useApiLoadingStore.getState().end();
  }
}

export function apiGet<T>(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  headers.set("ngrok-skip-browser-warning", "true");

  return apiClient<T>(path, {
    ...init,
    headers,
    method: "GET",
  });
}

export function apiPost<TResponse, TBody extends object>(
  path: string,
  body: TBody,
  init?: RequestInit,
) {
  return apiClient<TResponse>(path, {
    ...init,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function apiPut<TResponse, TBody extends object>(
  path: string,
  body: TBody,
  init?: RequestInit,
) {
  return apiClient<TResponse>(path, {
    ...init,
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function apiPatch<TResponse, TBody extends object>(
  path: string,
  body: TBody,
  init?: RequestInit,
) {
  return apiClient<TResponse>(path, {
    ...init,
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function apiDelete<T>(path: string, init?: RequestInit) {
  return apiClient<T>(path, {
    ...init,
    method: "DELETE",
  });
}
