// Shows the signed-in user profile from persisted session (local storage via user store).
import { useMemo } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useUserStore } from '@/services/user-store'
import { PageHeader } from '@/shared/components/PageHeader'

function asRecord(user: unknown): Record<string, unknown> | null {
  if (user && typeof user === 'object' && !Array.isArray(user)) {
    return user as Record<string, unknown>
  }
  return null
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

/** Role list / single-field shapes from `/auth/me` and similar payloads. */
const ROLE_ROOT_KEYS = new Set([
  'roles',
  'availableRoles',
  'realmRoles',
  'realm_roles',
  'role',
  'userRole',
  'Role',
])

/** Omit raw identifiers from the profile extras list. */
const USER_ID_KEYS = new Set([
  'id',
  'userId',
  'user_id',
  'userID',
  'uid',
  'sub',
])

function roleDisplayFromEntry(entry: unknown): string | null {
  if (typeof entry === 'string') {
    const t = entry.trim()
    return t || null
  }
  if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
    const r = entry as Record<string, unknown>
    return pickString(r, ['role_name', 'roleName', 'name', 'keycloak_role', 'authority'])
  }
  return null
}

function rolesFromProfile(record: Record<string, unknown>): string[] {
  const names: string[] = []
  for (const key of ['roles', 'availableRoles', 'realmRoles', 'realm_roles'] as const) {
    const list = record[key]
    if (!Array.isArray(list)) continue
    for (const item of list) {
      const label = roleDisplayFromEntry(item)
      if (label) names.push(label)
    }
  }
  const single = pickString(record, ['role', 'userRole', 'Role', 'role'])
  if (single) names.push(single)

  const seen = new Set<string>()
  const out: string[] = []
  for (const n of names) {
    const k = n.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(n)
  }
  return out
}

const PRIMARY_FIELDS: { label: string; keys: string[] }[] = [
  { label: 'Name', keys: ['name', 'fullName', 'full_name', 'displayName'] },
  { label: 'Email', keys: ['email', 'emailAddress', 'email_address'] },
  { label: 'Username', keys: ['username', 'userName', 'login'] },
  { label: 'Phone', keys: ['phone', 'phoneNumber', 'mobile', 'contact'] },
  { label: 'Agency', keys: ['agencyName', 'agency', 'agency_name', 'department'] },
]

const PRIMARY_KEY_SET = new Set(PRIMARY_FIELDS.flatMap((f) => f.keys))

export function ProfilePage() {
  const user = useUserStore((state) => state.user)
  const record = asRecord(user)

  const rows = useMemo(() => {
    if (!record) return []
    const primary = PRIMARY_FIELDS.map(({ label, keys }) => {
      const value = pickString(record, keys)
      return value ? { label, value } : null
    }).filter(Boolean) as { label: string; value: string }[]

    const extras: { label: string; value: string }[] = []
    for (const [key, raw] of Object.entries(record)) {
      if (PRIMARY_KEY_SET.has(key)) continue
      if (ROLE_ROOT_KEYS.has(key)) continue
      if (USER_ID_KEYS.has(key)) continue
      if (raw === null || raw === undefined) continue
      if (typeof raw === 'object') continue
      extras.push({ label: key, value: String(raw) })
    }

    const roleLabels = rolesFromProfile(record)
    const roleBlock =
      roleLabels.length > 0 ? [{ label: 'Roles', value: roleLabels.join(', ') }] : []

    return [...primary, ...roleBlock, ...extras.sort((a, b) => a.label.localeCompare(b.label))]
  }, [record])

  return (
    <section className="space-y-5">
      <PageHeader title="Profile" subtitle="Basic Information" />

      {!record ? (
        <Card>
          <CardContent className="pt-6 text-sm text-[var(--fms-text-subheading)]">
            No profile is stored for this session. Sign in again to load your account details.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-[var(--fms-text-header)]">Account</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_1fr] sm:gap-x-6 sm:gap-y-3">
              {rows.map(({ label, value }) => (
                <div key={label} className="contents">
                  <dt className="text-sm font-medium text-[var(--fms-text-subheading)]">{label}</dt>
                  <dd className="text-sm text-[var(--fms-text-header)] sm:border-b sm:border-[var(--fms-strokes)] sm:pb-3 last:sm:border-b-0 last:sm:pb-0">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}
    </section>
  )
}
