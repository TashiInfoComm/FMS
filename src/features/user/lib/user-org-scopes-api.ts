/**
 * User organization scopes: `GET|PUT /admin/users/:id/org-scopes`.
 * PUT body: `{ scopes: [...] }` with `scope_type` + `scope_id` per entry.
 */
import { apiGet, apiPut } from '@/services/apiClient'
import { mergeNestedUserEnvelope, toText } from '@/features/user/lib/users-api'
import type { ApiRecord } from '@/features/user/lib/roles-api'
import type {
  AgencyAssignmentTierSelection,
  VehicleAgencyAssignmentMasterData,
} from '@/features/vehicles/lib/vehicle-agency-assignment-api'
import { resolveMasterEntityDisplayName } from '@/features/vehicles/lib/vehicle-agency-assignment-api'

export type UserOrgScopeType = 'agency' | 'department' | 'division' | 'sub_division'

export type UserOrgScopeListItem = {
  scopeType: UserOrgScopeType
  scopeId: string
  name?: string
}

export type UserOrgScopeApiEntry = {
  scope_type: UserOrgScopeType
  scope_id: string
}

export type PutUserOrgScopesBody = {
  scopes: UserOrgScopeApiEntry[]
}

function toId(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return ''
}

function normalizeScopeType(value: unknown): UserOrgScopeType | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase().replace(/-/g, '_') : ''
  if (raw === 'agency') return 'agency'
  if (raw === 'department') return 'department'
  if (raw === 'division') return 'division'
  if (raw === 'sub_division' || raw === 'subdivision') return 'sub_division'
  return null
}

function mapScopeRecord(record: ApiRecord): UserOrgScopeListItem | null {
  const scopeType = normalizeScopeType(record.scope_type ?? record.scopeType)
  const scopeId = toId(record.scope_id ?? record.scopeId ?? record.id).trim()
  if (!scopeType || !scopeId) return null

  const attachments =
    record.attachments && typeof record.attachments === 'object' && !Array.isArray(record.attachments)
      ? (record.attachments as ApiRecord)
      : undefined
  const name =
    toText(record.name ?? record.scope_name ?? record.scopeName ?? attachments?.name).trim() ||
    undefined

  return { scopeType, scopeId, name }
}

function extractScopeRecordsFromPayload(payload: unknown): ApiRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter(
      (item): item is ApiRecord => !!item && typeof item === 'object' && !Array.isArray(item),
    )
  }
  if (!payload || typeof payload !== 'object') return []
  const root = payload as ApiRecord

  const arrayKeys = ['scopes', 'org_scopes', 'orgScopes', 'items', 'results', 'data'] as const
  for (const key of arrayKeys) {
    const raw = root[key]
    if (Array.isArray(raw)) {
      return raw.filter(
        (item): item is ApiRecord => !!item && typeof item === 'object' && !Array.isArray(item),
      )
    }
  }

  const nested = root.data
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return extractScopeRecordsFromPayload(nested)
  }

  return []
}

/** Normalizes `GET /admin/users/:id/org-scopes` (and similar list envelopes). */
export function parseOrgScopesApiPayload(payload: unknown): UserOrgScopeListItem[] {
  return extractScopeRecordsFromPayload(payload)
    .map((record) => mapScopeRecord(record))
    .filter((r): r is UserOrgScopeListItem => r !== null)
}

/** `GET /admin/users/:id/org-scopes` → scope rows for the detail table. */
export async function fetchUserOrgScopes(userId: string): Promise<UserOrgScopeListItem[]> {
  const id = userId.trim()
  if (!id) throw new Error('User id is required')
  const payload = await apiGet<unknown>(`/admin/users/${encodeURIComponent(id)}/org-scopes`)
  return parseOrgScopesApiPayload(payload)
}

/** Reads `org_scopes` / `scopes` from a user detail record. */
export function parseUserOrgScopes(record: ApiRecord): UserOrgScopeListItem[] {
  const merged = mergeNestedUserEnvelope(record)
  for (const key of ['org_scopes', 'orgScopes', 'scopes', 'organization_scopes', 'organizationScopes'] as const) {
    const raw = merged[key]
    if (!Array.isArray(raw)) continue
    const items = raw
      .map((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? mapScopeRecord(item as ApiRecord)
          : null,
      )
      .filter((r): r is UserOrgScopeListItem => r !== null)
    if (items.length > 0) return items
  }
  return []
}

export function formatUserOrgScopeTypeLabel(type: UserOrgScopeType): string {
  switch (type) {
    case 'agency':
      return 'Agency'
    case 'department':
      return 'Department'
    case 'division':
      return 'Division'
    case 'sub_division':
      return 'Sub division'
  }
}

export function resolveOrgScopeDisplayName(
  master: VehicleAgencyAssignmentMasterData | undefined,
  scope: UserOrgScopeListItem,
): string {
  if (scope.name?.trim()) return scope.name.trim()
  if (master) {
    const fromMaster = resolveMasterEntityDisplayName(master, scope.scopeId)
    if (fromMaster) return fromMaster
  }
  return scope.scopeId
}

/** Most specific selected tier → scope type, id, and display name. */
export function resolveOrgScopeFromTiers(
  selection: AgencyAssignmentTierSelection,
  master: VehicleAgencyAssignmentMasterData,
): { scopeType: UserOrgScopeType; scopeId: string; name: string } | null {
  const sub = selection.subDivisionId.trim()
  const div = selection.divisionId.trim()
  const dep = selection.departmentId.trim()
  const ag = selection.agencyId.trim()

  if (sub) {
    const row = master.subDivisions.find((s) => s.id === sub)
    return row ? { scopeType: 'sub_division', scopeId: sub, name: row.name } : null
  }
  if (div) {
    const row = master.divisions.find((d) => d.id === div)
    return row ? { scopeType: 'division', scopeId: div, name: row.name } : null
  }
  if (dep) {
    const row = master.departments.find((d) => d.id === dep)
    return row ? { scopeType: 'department', scopeId: dep, name: row.name } : null
  }
  if (ag) {
    const row = master.agencies.find((a) => a.id === ag)
    return row ? { scopeType: 'agency', scopeId: ag, name: row.name } : null
  }
  return null
}

export function scopeListToApiPayload(scopes: UserOrgScopeListItem[]): UserOrgScopeApiEntry[] {
  return scopes.map((scope) => ({
    scope_type: scope.scopeType,
    scope_id: scope.scopeId,
  }))
}

export function isDuplicateOrgScope(
  scopes: UserOrgScopeListItem[],
  candidate: { scopeType: UserOrgScopeType; scopeId: string },
): boolean {
  return scopes.some(
    (s) => s.scopeType === candidate.scopeType && s.scopeId === candidate.scopeId,
  )
}

export function mergeOrgScope(
  existing: UserOrgScopeListItem[],
  added: UserOrgScopeListItem,
): UserOrgScopeListItem[] {
  if (isDuplicateOrgScope(existing, added)) return existing
  return [...existing, added]
}

export function mergeOrgScopes(
  base: UserOrgScopeListItem[],
  additions: UserOrgScopeListItem[],
): UserOrgScopeListItem[] {
  let result = [...base]
  for (const added of additions) {
    result = mergeOrgScope(result, added)
  }
  return result
}

export function putUserOrgScopes(userId: string, body: PutUserOrgScopesBody): Promise<unknown> {
  const id = userId.trim()
  if (!id) throw new Error('User id is required')
  return apiPut<unknown, PutUserOrgScopesBody>(
    `/admin/users/${encodeURIComponent(id)}/org-scopes`,
    body,
  )
}
