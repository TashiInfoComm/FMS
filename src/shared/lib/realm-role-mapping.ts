// Maps Keycloak/API realm role strings to coarse app roles and picks the active realm role for permission APIs.
import { DEFAULT_ROLE, type Role } from '@/shared/constants/access-control'

const ROLE_RANK: Record<Role, number> = {
  'Super Admin': 4,
  'Agency Admin': 3,
}

export function pickPrimaryCoarseRole(mappedRoles: Role[]): Role {
  if (mappedRoles.length === 0) return DEFAULT_ROLE
  return [...mappedRoles].sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a])[0]!
}

function roleDisplayFromEntry(entry: unknown): string | null {
  if (typeof entry === 'string') {
    const t = entry.trim()
    return t || null
  }
  if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
    const r = entry as Record<string, unknown>
    for (const key of ['role_name', 'roleName', 'name', 'keycloak_role', 'authority'] as const) {
      const value = r[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
  }
  return null
}

/** Maps `/auth/me` realm role slug or display label to a coarse navigation role. */
export function mapSlugOrLabel(textRaw: string): Role | null {
  const text = textRaw.trim()
  if (!text) return null
  const t = text.replace(/\s+/g, '-').toLowerCase()

  if (text === 'Super Admin') return 'Super Admin'
  if (text === 'Agency Admin') return 'Agency Admin'

  const directMatches: Partial<Record<string, Role>> = {
    'agency-admin': 'Agency Admin',
    'super-admin': 'Super Admin',
  }
  const direct = directMatches[t]
  if (direct) return direct

  if (t === 'fms-super-admin' || t === 'frms-super-admin' || t.includes('super-admin')) {
    return 'Super Admin'
  }

  if (t.includes('agency-admin') || t === 'fms-agency-admin') return 'Agency Admin'

  return null
}

export function mapApiRoleValue(value: unknown): Role | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return mapSlugOrLabel(value)
  const text = roleDisplayFromEntry(value)
  return text ? mapSlugOrLabel(text) : null
}

export type RealmCoarsePair = { realm: string; coarse: Role }

/** Ordered realm strings from the profile with their coarse role (unknown slugs skipped). */
export function realmCoarsePairsFromUser(user: Record<string, unknown> | null): RealmCoarsePair[] {
  if (!user) return []

  const seenRealm = new Set<string>()
  const out: RealmCoarsePair[] = []

  const pushRaw = (raw: string | null | undefined) => {
    const t = typeof raw === 'string' ? raw.trim() : ''
    if (!t || seenRealm.has(t)) return
    const coarse = mapSlugOrLabel(t)
    if (!coarse) return
    seenRealm.add(t)
    out.push({ realm: t, coarse })
  }

  for (const field of ['role', 'userRole', 'Role'] as const) {
    const v = user[field]
    if (typeof v === 'string') pushRaw(v)
    else pushRaw(roleDisplayFromEntry(v))
  }

  for (const key of ['roles', 'availableRoles', 'realmRoles', 'realm_roles'] as const) {
    const list = user[key]
    if (!Array.isArray(list)) continue
    for (const entry of list) {
      if (typeof entry === 'number' && Number.isFinite(entry)) pushRaw(String(entry))
      else if (typeof entry === 'string') pushRaw(entry)
      else pushRaw(roleDisplayFromEntry(entry))
    }
  }

  return out
}

export function getMappedRolesFromUserProfile(user: Record<string, unknown> | null): Role[] {
  const seen = new Set<Role>()
  const out: Role[] = []
  for (const { coarse } of realmCoarsePairsFromUser(user)) {
    if (seen.has(coarse)) continue
    seen.add(coarse)
    out.push(coarse)
  }
  return out
}

export function readPinnedCoarseRoleFromStorage(): Role | null {
  if (typeof window === 'undefined') return null
  const storedRole = localStorage.getItem('fms-role')
  if (!storedRole) return null
  return mapApiRoleValue(storedRole.trim())
}

/**
 * Realm role string for GET `/admin/roles/{role}/permissions`, honoring the header role switcher
 * (`fms-role`) and coarse role mapping (not raw array order).
 */
export function resolveActiveRealmRoleString(
  user: Record<string, unknown> | null,
  pinnedCoarse?: Role | null,
): string | null {
  const pairs = realmCoarsePairsFromUser(user)
  if (pairs.length === 0) return null

  const pin = pinnedCoarse !== undefined ? pinnedCoarse : readPinnedCoarseRoleFromStorage()
  if (pin) {
    const match = pairs.find((p) => p.coarse === pin)
    if (match) return match.realm
  }

  const uniqueCoarse = [...new Set(pairs.map((p) => p.coarse))]
  const primary = pickPrimaryCoarseRole(uniqueCoarse)
  return pairs.find((p) => p.coarse === primary)?.realm ?? pairs[0]!.realm
}

export const FMS_ROLE_PREFERENCE_CHANGED = 'fms-role-preference-changed'

export function notifyRolePreferenceChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(FMS_ROLE_PREFERENCE_CHANGED))
}
