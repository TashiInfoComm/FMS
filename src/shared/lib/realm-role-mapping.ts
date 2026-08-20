// Maps Keycloak/API realm role strings to FMS realm slugs and picks the active realm role for permission APIs.
import {
  DEFAULT_ROLE,
  FMS_REALM_ROLES,
  REALM_ROLE_PRIORITY,
  type FmsRealmRole,
  type Role,
} from '@/shared/constants/access-control'

const FMS_SLUG_SET = new Set<string>(FMS_REALM_ROLES.map((r) => r.toLowerCase()))

function rolePriority(slug: string): number {
  return REALM_ROLE_PRIORITY[slug] ?? REALM_ROLE_PRIORITY[slug.toLowerCase()] ?? 0
}

export function pickPrimaryRealmRole(mappedRoles: Role[]): Role {
  if (mappedRoles.length === 0) return DEFAULT_ROLE
  return [...mappedRoles].sort((a, b) => rolePriority(String(b)) - rolePriority(String(a)))[0]!
}

/** @deprecated Use pickPrimaryRealmRole */
export const pickPrimaryCoarseRole = pickPrimaryRealmRole

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

function normalizeSlug(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, '-')
}

/** Realm roles that are never shown in the in-app role switcher (Keycloak internals). */
function isTechnicalRealmRole(slug: string): boolean {
  const t = slug.trim().toLowerCase()
  return (
    t === 'offline_access' ||
    t === 'uma_authorization' ||
    t.startsWith('default-roles') ||
    t === 'default-roles-fms'
  )
}

/**
 * Maps JWT / profile realm strings to an FMS slug when possible.
 * Unknown `fms-*` slugs pass through for forward compatibility.
 */
export function mapSlugOrLabel(textRaw: string): Role | null {
  const raw = textRaw.trim()
  if (!raw) return null
  const t = normalizeSlug(raw)

  const legacy: Record<string, FmsRealmRole> = {
    'super-admin': 'fms-super-admin',
    'highest-admin': 'fms-highest-admin',
    'agency-admin': 'fms-agency-admin',
    'finance-officer': 'fms-finance-officer',
    mto: 'fms-mto',
    driver: 'fms-driver',
    applicant: 'fms-applicant',
    viewer: 'fms-viewer',
    'fms-super-admin': 'fms-super-admin',
    'fms-highest-admin': 'fms-highest-admin',
    'fms-agency-admin': 'fms-agency-admin',
    'fms-finance-officer': 'fms-finance-officer',
    'fms-mto': 'fms-mto',
    'fms-driver': 'fms-driver',
    'fms-applicant': 'fms-applicant',
    'fms-viewer': 'fms-viewer',
  }
  const mapped = legacy[t]
  if (mapped) return mapped

  if (raw === 'Super Admin') return 'fms-super-admin'
  if (raw === 'Highest Admin' || raw === 'Highest admin') return 'fms-highest-admin'
  if (raw === 'Agency Admin') return 'fms-agency-admin'

  if (t === 'frms-super-admin' || t.includes('super-admin')) return 'fms-super-admin'
  if (t.includes('highest-admin')) return 'fms-highest-admin'

  if (t.includes('agency-admin')) return 'fms-agency-admin'

  if (t.startsWith('fms-') && !isTechnicalRealmRole(t)) return t

  if (FMS_SLUG_SET.has(t)) return t as FmsRealmRole

  return null
}

export function mapApiRoleValue(value: unknown): Role | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return mapSlugOrLabel(value)
  const text = roleDisplayFromEntry(value)
  return text ? mapSlugOrLabel(text) : null
}

export type RealmCoarsePair = { realm: string; coarse: Role }

/** Ordered realm strings from the profile with their normalized slug (for pinning + API). */
export function realmCoarsePairsFromUser(user: Record<string, unknown> | null): RealmCoarsePair[] {
  if (!user) return []

  const seenRealm = new Set<string>()
  const out: RealmCoarsePair[] = []

  const pushRaw = (raw: string | null | undefined) => {
    const t = typeof raw === 'string' ? raw.trim() : ''
    if (!t || seenRealm.has(t) || isTechnicalRealmRole(t)) return
    const coarse = mapSlugOrLabel(t)
    if (!coarse) return
    if (!String(coarse).startsWith('fms-')) return
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
  const seen = new Set<string>()
  const out: Role[] = []
  for (const { coarse } of realmCoarsePairsFromUser(user)) {
    const key = String(coarse)
    if (seen.has(key)) continue
    seen.add(key)
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
 * (`fms-role`) and primary realm role selection.
 */
export function resolveActiveRealmRoleString(
  user: Record<string, unknown> | null,
  pinnedCoarse?: Role | null,
): string | null {
  const pairs = realmCoarsePairsFromUser(user)
  if (pairs.length === 0) return null

  const pin = pinnedCoarse !== undefined ? pinnedCoarse : readPinnedCoarseRoleFromStorage()
  if (pin) {
    const pinStr = String(pin)
    const exact = pairs.find((p) => p.realm === pinStr || p.coarse === pinStr)
    if (exact) return exact.realm
    const fold = pairs.find((p) => normalizeSlug(p.realm) === normalizeSlug(pinStr))
    if (fold) return fold.realm
  }

  const uniqueCoarse = [...new Set(pairs.map((p) => p.coarse as Role))]
  const primary = pickPrimaryRealmRole(uniqueCoarse)
  return pairs.find((p) => p.coarse === primary)?.realm ?? pairs[0]!.realm
}

export const FMS_ROLE_PREFERENCE_CHANGED = 'fms-role-preference-changed'

export function notifyRolePreferenceChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(FMS_ROLE_PREFERENCE_CHANGED))
}
