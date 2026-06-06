// Fetches the string payload rendered into the Bhutan NDI scan QR (`/auth/ndi/proof_request`).
import {
  fetchedPersonFromDirectoryLikeRecord,
  recordHasDirectoryIdentity,
  type FetchedPerson,
} from "@/features/user/lib/users-api";
import type { ApiRecord } from "@/features/user/lib/roles-api";
import { apiPost } from "@/services/apiClient";

export type NdiProofIntent = "login" | "registration";

const PROOF_REQUEST_PATH = "/ndi/proof_request";
const CHECK_CALLBACK_PATH = "/ndi/check_callback_response";
const CHECK_LOGIN_PATH = "/ndi/login_callback_response";

export type NdiProofRequestResult = {
  qrValue: string;
  /** From `data.thread_id` (or `threadId`) when present; falls back to session id fields if needed. */
  threadId: string | null;
};

/** Field names we've seen wrapped as `{ data: … }` or at the root. */
const STRING_KEYS_ROOT_FIRST = [
  "proof_request",
  "proofRequest",
  "proof_request_url",
  "proofRequestUrl",
  "presentation_request",
  "presentationRequest",
  "qr_payload",
  "qrPayload",
  "qr",
  "invitation_url",
  "invitationUrl",
  "deep_link",
  "deepLink",
  "url",
  "payload",
];

function extractStringFromRecord(record: Record<string, unknown>): string | null {
  for (const key of STRING_KEYS_ROOT_FIRST) {
    const v = record[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }

  const invitation = record.invitation;
  if (typeof invitation === "string" && invitation.trim()) return invitation.trim();
  if (invitation && typeof invitation === "object") {
    return JSON.stringify(invitation);
  }

  return null;
}

/** Pulls the QR-encoded value from common API envelopes. */
export function extractQrValueFromProofResponse(payload: unknown): string | null {
  if (typeof payload === "string" && payload.trim()) return payload.trim();
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;

  const root = payload as Record<string, unknown>;
  const fromRoot = extractStringFromRecord(root);
  if (fromRoot) return fromRoot;

  const inner = root.data ?? root.result;
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    return extractStringFromRecord(inner as Record<string, unknown>);
  }

  return null;
}

/** Reads `thread_id` / `session_id` from `{ data: { … } }` (or `result`). */
export function extractThreadIdFromProofResponse(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const root = payload as Record<string, unknown>;
  const inner = root.data ?? root.result;
  if (!inner || typeof inner !== "object" || Array.isArray(inner)) return null;
  const record = inner as Record<string, unknown>;
  for (const key of ["thread_id", "threadId", "session_id", "sessionId"] as const) {
    const v = record[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/**
 * Notifies the backend to check the NDI callback for this proof session (`thread_id`
 * in the JSON body per API contract).
 */
export async function postNdiCheckCallbackResponse(
  threadId: string,
  intent: NdiProofIntent,
  init?: RequestInit,
): Promise<unknown> {
  return apiPost<unknown, { thread_id: string, intent: NdiProofIntent }>(
    intent === "login" ? CHECK_LOGIN_PATH : CHECK_CALLBACK_PATH,
    { thread_id: threadId, intent: intent },
    init, 
  );
}

function readRootMessage(root: ApiRecord): string | null {
  const candidates = [root.message, root.detail, root.error]
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim()
  }
  return null
}

function getNdiCallbackDataRecord(raw: unknown): ApiRecord | null {
  if (!raw || typeof raw !== "object") return null
  const root = raw as ApiRecord
  const nested = root.data ?? root.result
  if (nested && typeof nested === "object" && !Array.isArray(nested)) return nested as ApiRecord
  return null
}

/** Present on `complete` when the backend completes an NDI login session (JWT / refresh). */
export type NdiCallbackAuthTokens = {
  accessToken: string
  refreshToken: string | null
}

export type ParsedNdiCallback =
  | { kind: "complete"; person: FetchedPerson; auth: NdiCallbackAuthTokens | null }
  | { kind: "pending" }
  | { kind: "error"; message: string }

function pickCbString(obj: ApiRecord, keys: readonly string[]): string | null {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return null
}

/**
 * Pulls Bearer tokens from the callback envelope (`data`, entity, root) — login flows often nest them beside identity.
 */
export function extractNdiCallbackAuth(raw: unknown, entity: ApiRecord | null): NdiCallbackAuthTokens | null {
  if (!raw || typeof raw !== "object") return null
  const root = raw as ApiRecord
  const nested = root.data ?? root.result
  const sources: ApiRecord[] = []
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    sources.push(nested as ApiRecord)
  }
  if (entity) sources.push(entity)
  sources.push(root)

  const seen = new Set<unknown>()
  for (const obj of sources) {
    if (!obj || seen.has(obj)) continue
    seen.add(obj)
    const accessToken =
      pickCbString(obj, ["accessToken", "access_token", "token"]) ??
      null
    if (!accessToken) continue
    const refreshToken =
      pickCbString(obj, ["refreshToken", "refresh_token"]) ?? null
    return { accessToken, refreshToken }
  }

  return null
}

/**
 * Interprets POST `/admin/ndi/check_callback_response` JSON: complete when `data` (or `result`) contains
 * CID and/or employee id; pending when proof is not ready yet; error when `success === false` or invalid.
 */
export function parseNdiCheckCallbackResponse(raw: unknown): ParsedNdiCallback {
  if (!raw || typeof raw !== "object") {
    return { kind: "error", message: "Invalid response from NDI verification." }
  }
  const root = raw as ApiRecord
  const success = root.success
  const msg = readRootMessage(root)

  if (success === false) {
    return { kind: "error", message: msg ?? "NDI verification failed." }
  }

  const entity = getNdiCallbackDataRecord(raw)
  const auth = extractNdiCallbackAuth(raw, entity)

  if (entity && recordHasDirectoryIdentity(entity)) {
    return {
      kind: "complete",
      person: fetchedPersonFromDirectoryLikeRecord(entity),
      auth,
    }
  }

  // Login callback often returns only JWTs under `data` (no CID / employee id). Still a completed session.
  if (auth?.accessToken) {
    return {
      kind: "complete",
      person: fetchedPersonFromDirectoryLikeRecord(entity ?? {}),
      auth,
    }
  }

  if (success === true) {
    return { kind: "pending" }
  }

  return {
    kind: "error",
    message: msg ?? "NDI verification could not be completed.",
  }
}

/** React Router `location.state` for `/signup/manual` after NDI verification. */
export type NdiManualSignupPrefillState = {
  ndiPrefill?: FetchedPerson
}

/**
 * Requests a fresh proof-request payload from the backend. Intent distinguishes
 * NDI login vs self-registration flows when the API supports it.
 */
export async function fetchNdiProofRequest(
  intent: NdiProofIntent,
): Promise<NdiProofRequestResult> {
  type Body = { intent: NdiProofIntent };
  const raw = await apiPost<unknown, Body>(PROOF_REQUEST_PATH, { intent });
  const qrValue = extractQrValueFromProofResponse(raw);
  if (!qrValue) {
    throw new Error("NDI proof request response did not include a QR payload.");
  }
  const threadId = extractThreadIdFromProofResponse(raw);
  return { qrValue, threadId };
}
