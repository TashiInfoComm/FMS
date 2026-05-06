// Centralizes authenticated HTTP requests to the backend API.
import { useUserStore } from "@/services/user-store";
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
  localStorage.removeItem("fms-role");
  localStorage.removeItem("fms-permissions");
  notifyRolePreferenceChanged();

  if (typeof window === "undefined") return;
  if (isPublicAuthPath(window.location.pathname)) return;

  window.location.replace("/login/ndi");
}

function resolveUrl(path: string) {
  if (/^https?:\/\//.test(path)) return path;
  if (!API_BASE_URL) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

function getErrorMessage(payload: unknown, status: number) {
  if (typeof payload === "string") {
    const trimmed = payload.trim();
    return trimmed || `API Error: ${status}`;
  }

  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;

    const preferred = [obj.detail, obj.message, obj.error];
    for (const value of preferred) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }

    const listCandidates = [obj.errors, obj.non_field_errors, obj.detail];
    for (const value of listCandidates) {
      if (Array.isArray(value) && value.length > 0) {
        const first = value[0];
        if (typeof first === "string" && first.trim()) {
          return first.trim();
        }
      }
    }
  }

  return `API Error: ${status}`;
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

export async function apiClient<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  return fetchWithAuthHandling<T>(path, init, false);
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

export function apiDelete<T>(path: string, init?: RequestInit) {
  return apiClient<T>(path, {
    ...init,
    method: "DELETE",
  });
}
