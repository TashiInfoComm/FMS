// Persists the signed-in user's active role before the access token is refreshed.
import { apiPost } from "@/services/apiClient";

/**
 * `VITE_API_URL` already includes `/api/v1`, so this is
 * `POST /api/v1/admin/users/me/active-role` with `{ role }`.
 */
export function setMyActiveRole(role: string) {
  return apiPost<unknown, { role: string }>("/admin/users/me/active-role", {
    role,
  });
}
