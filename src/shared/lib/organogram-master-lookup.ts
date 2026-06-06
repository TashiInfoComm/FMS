// Resolves organogram tier UUIDs to display names via GET `/admin/groups` and selected `/master/*` lists.
import {
  findGroupNameInPayload,
  groupsPayloadToIdNameLookup,
  mergeGroupsPayloadIntoLookup,
  parseGroupsApiPayloadToNodes,
  type AdminGroupNode,
} from '@/features/user/lib/groups-api'
import { apiGet } from '@/services/apiClient'

type ApiRecord = Record<string, unknown>

const MASTER_PAGE_SIZE = 200

function toText(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

function toId(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim()
  return ''
}

/** Extract list rows from common API envelopes (aligned with master Agency page). */
export function extractMasterList(payload: unknown): ApiRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is ApiRecord => !!item && typeof item === 'object')
  }
  if (!payload || typeof payload !== 'object') return []

  const root = payload as Record<string, unknown>
  if (Array.isArray(root.data)) {
    return root.data.filter((item): item is ApiRecord => !!item && typeof item === 'object')
  }

  const dataObj =
    root.data && typeof root.data === 'object' && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : null

  const candidates: unknown[] = [
    root.items,
    root.results,
    root.records,
    root.content,
    root.data,
    dataObj?.items,
    dataObj?.results,
    dataObj?.records,
    dataObj?.content,
    dataObj?.agencies,
    dataObj?.departments,
    dataObj?.divisions,
    dataObj?.sub_divisions,
    dataObj?.subDivisions,
    dataObj?.['sub-divisions'],
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is ApiRecord => !!item && typeof item === 'object')
    }
  }

  return []
}

function readMasterRecordName(record: ApiRecord): string {
  return (
    toText(record.name).trim() ||
    toText(record.agency_name).trim() ||
    toText(record.department_name).trim() ||
    toText(record.division_name).trim() ||
    toText(record.sub_division_name).trim() ||
    toText(record.subDivisionName).trim() ||
    toText(record.label).trim()
  )
}

function extractMasterRecord(payload: unknown): ApiRecord | null {
  if (!payload || typeof payload !== 'object') return null
  const root = payload as ApiRecord
  const data = root.data
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as ApiRecord
  }
  return root
}

/** Maps vehicle assignment `entity_type` to the plural `/master/*` resource segment. */
export function entityTypeToMasterResourcePath(entityType: string): string | null {
  const raw = entityType.trim().toLowerCase().replace(/_/g, '-')
  if (raw === 'agency' || raw === 'agencies') return 'agencies'
  if (raw === 'department' || raw === 'departments') return 'departments'
  if (raw === 'division' || raw === 'divisions') return 'divisions'
  if (
    raw === 'sub-division' ||
    raw === 'subdivision' ||
    raw === 'sub-divisions' ||
    raw === 'subdivisions'
  ) {
    return 'sub-divisions'
  }
  return null
}

/** Resolves one organogram tier via `GET /master/{entity_type}/id/{entity_id}`. */
export async function fetchMasterEntityNameById(
  entityType: string,
  entityId: string,
): Promise<string | null> {
  const resource = entityTypeToMasterResourcePath(entityType)
  const id = entityId.trim()
  if (!resource || !id) return null

  try {
    const payload = await apiGet<unknown>(
      `/master/${resource}/id/${encodeURIComponent(id)}`,
    )
    const record = extractMasterRecord(payload)
    if (!record) return null
    const name = readMasterRecordName(record)
    return name || null
  } catch {
    return null
  }
}

/** Resolves one master record via `GET {resourcePath}/{id}` (e.g. vehicle statuses). */
export async function fetchMasterRecordNameById(
  resourcePath: string,
  id: string,
): Promise<string | null> {
  const base = resourcePath.startsWith('/') ? resourcePath : `/${resourcePath}`
  const recordId = id.trim()
  if (!recordId) return null

  try {
    const payload = await apiGet<unknown>(`${base}/${encodeURIComponent(recordId)}`)
    const record = extractMasterRecord(payload)
    if (!record) return null
    const name = readMasterRecordName(record)
    return name || null
  } catch {
    return null
  }
}

/** id → name from `/admin/groups` nodes (user/vehicle org tiers are group ids). */
export function groupNodesToLookupMap(nodes: readonly AdminGroupNode[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const node of nodes) {
    const id = node.id.trim()
    const name = node.name.trim()
    if (!id || !name) continue
    map.set(id.toLowerCase(), name)
  }
  return map
}

export function mergeLookupMaps(...maps: readonly (Map<string, string> | undefined)[]): Map<string, string> {
  const merged = new Map<string, string>()
  for (const map of maps) {
    if (!map) continue
    for (const [key, value] of map) {
      if (value) merged.set(key, value)
    }
  }
  return merged
}

/** id → name from `GET /admin/groups` — every nested tier in `children` (through sub-division). */
export async function fetchAdminGroupsNameLookup(): Promise<Map<string, string>> {
  const payload = await apiGet<unknown>('/admin/groups')
  return groupsPayloadToIdNameLookup(payload)
}

/** Build id → name map from master list rows (includes inactive rows for historical references). */
export function recordsToLookupMap(records: readonly ApiRecord[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const record of records) {
    const name = readMasterRecordName(record)
    if (!name) continue
    const ids = [
      toId(record.id),
      toId(record.uuid),
      toId(record.code),
    ].filter(Boolean)
    for (const id of ids) {
      map.set(id.toLowerCase(), name)
    }
  }
  return map
}

async function fetchMasterRecordsPaginated(resourcePath: string): Promise<ApiRecord[]> {
  const all: ApiRecord[] = []
  let page = 1
  const base = resourcePath.startsWith('/') ? resourcePath : `/${resourcePath}`

  while (page <= 50) {
    const payload = await apiGet<unknown>(
      `${base}?page=${page}&page_size=${MASTER_PAGE_SIZE}&search=`,
    )
    const batch = extractMasterList(payload)
    if (batch.length === 0) break
    all.push(...batch)
    if (batch.length < MASTER_PAGE_SIZE) break
    page += 1
  }

  return all
}

export type OrganogramMasterLookups = {
  agencies: Map<string, string>
  departments: Map<string, string>
  divisions: Map<string, string>
  subDivisions: Map<string, string>
}

/** Group id → name for detail/profile pages (`GET /admin/groups` only). */
export type OrganogramDisplayLookups = {
  /** Serializable; every agency/department/division/sub-division id in the tree. */
  groupsById: Record<string, string>
  /** Raw `/admin/groups` JSON for tree walks (React Query–safe). */
  tree: unknown
  /** Raw `/public/groups` JSON (user org assignment uses public group ids). */
  publicTree?: unknown
}

export function organogramGroupsByIdToMap(
  groupsById: Record<string, string> | undefined,
): Map<string, string> {
  if (!groupsById) return new Map()
  return new Map(Object.entries(groupsById))
}

export type VehicleListStatusLookups = {
  vehicleStatuses: Map<string, string>
  vehicleMovementStatuses: Map<string, string>
}

export type VehicleDetailStatusLookups = VehicleListStatusLookups & {
  insuranceProviders: Map<string, string>
}

export type VehicleDetailMasterLookups = OrganogramDisplayLookups &
  VehicleDetailStatusLookups

export async function fetchOrganogramMasterLookups(): Promise<OrganogramMasterLookups> {
  const [agencies, departments, divisions, subDivisions] = await Promise.all([
    fetchMasterRecordsPaginated('/master/agencies'),
    fetchMasterRecordsPaginated('/master/departments'),
    fetchMasterRecordsPaginated('/master/divisions'),
    fetchMasterRecordsPaginated('/master/sub-divisions'),
  ])

  return {
    agencies: recordsToLookupMap(agencies),
    departments: recordsToLookupMap(departments),
    divisions: recordsToLookupMap(divisions),
    subDivisions: recordsToLookupMap(subDivisions),
  }
}

function buildGroupsByIdFromPayloads(
  adminPayload: unknown,
  publicPayload: unknown | null,
): Record<string, string> {
  const lookup = new Map<string, string>()
  mergeGroupsPayloadIntoLookup(lookup, adminPayload)
  if (publicPayload != null) mergeGroupsPayloadIntoLookup(lookup, publicPayload)
  for (const node of parseGroupsApiPayloadToNodes(adminPayload)) {
    lookup.set(node.id.toLowerCase(), node.name)
  }
  if (publicPayload != null) {
    for (const node of parseGroupsApiPayloadToNodes(publicPayload)) {
      lookup.set(node.id.toLowerCase(), node.name)
    }
  }
  return Object.fromEntries(lookup)
}

export async function fetchOrganogramDisplayLookups(): Promise<OrganogramDisplayLookups> {
  const [adminPayload, publicPayload] = await Promise.all([
    apiGet<unknown>('/admin/groups'),
    apiGet<unknown>('/public/groups').catch(() => null),
  ])
  return {
    groupsById: buildGroupsByIdFromPayloads(adminPayload, publicPayload),
    tree: adminPayload,
    ...(publicPayload != null ? { publicTree: publicPayload } : {}),
  }
}

/** Resolves a tier id to a name using merged `/admin/groups` + `/public/groups` lookups. */
export function resolveAdminGroupIdToName(
  tierId: string,
  lookups: OrganogramDisplayLookups,
): string | null {
  const id = tierId.trim()
  if (!id) return null
  const key = id.toLowerCase()

  const fromMap = lookups.groupsById[key]
  if (fromMap) return fromMap

  if (lookups.tree) {
    const fromTree = findGroupNameInPayload(lookups.tree, id)
    if (fromTree) return fromTree
  }

  if (lookups.publicTree) {
    const fromPublic = findGroupNameInPayload(lookups.publicTree, id)
    if (fromPublic) return fromPublic
  }

  return null
}

/** Status/movement labels for vehicle list only (no `/admin/groups`). */
export async function fetchVehicleListStatusLookups(): Promise<VehicleListStatusLookups> {
  const [vehicleStatuses, vehicleMovementStatuses] = await Promise.all([
    fetchMasterRecordsPaginated('/master/vehicle-statuses'),
    fetchMasterRecordsPaginated('/master/vehicle-movement-statuses'),
  ])

  return {
    vehicleStatuses: recordsToLookupMap(vehicleStatuses),
    vehicleMovementStatuses: recordsToLookupMap(vehicleMovementStatuses),
  }
}

/** Insurance + vehicle status labels for detail (no organogram tiers). */
export async function fetchVehicleDetailStatusLookups(): Promise<VehicleDetailStatusLookups> {
  const [vehicleStatuses, vehicleMovementStatuses, insuranceProviders] =
    await Promise.all([
      fetchMasterRecordsPaginated('/master/vehicle-statuses'),
      fetchMasterRecordsPaginated('/master/vehicle-movement-statuses'),
      fetchMasterRecordsPaginated('/master/insurance-providers'),
    ])

  return {
    vehicleStatuses: recordsToLookupMap(vehicleStatuses),
    vehicleMovementStatuses: recordsToLookupMap(vehicleMovementStatuses),
    insuranceProviders: recordsToLookupMap(insuranceProviders),
  }
}

/** @deprecated Prefer `fetchOrganogramDisplayLookups` + `fetchVehicleDetailStatusLookups` on detail. */
export async function fetchVehicleDetailMasterLookups(): Promise<VehicleDetailMasterLookups> {
  const [organogram, status] = await Promise.all([
    fetchOrganogramDisplayLookups(),
    fetchVehicleDetailStatusLookups(),
  ])

  return { ...organogram, ...status }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuidLike(value: string): boolean {
  return UUID_RE.test(value.trim())
}

/** Resolve tier id and/or embedded label through a master lookup map. */
export function resolveOrganogramTierDisplay(
  tierId: string,
  embeddedLabel: string,
  lookup: Map<string, string>,
): string {
  const id = tierId.trim()
  const label = embeddedLabel.trim()

  if (id) {
    const byId = lookup.get(id.toLowerCase())
    if (byId) return byId
  }

  if (label) {
    const byLabel = lookup.get(label.toLowerCase())
    if (byLabel) return byLabel
    if (!isUuidLike(label)) return label
  }

  return label || id
}

/** Prefer group names (user tiers), then master tier lists (vehicles / legacy ids). */
export function resolveTierDisplayName(
  tierId: string,
  embeddedLabel: string,
  options: { groups?: Map<string, string>; master?: Map<string, string> },
): string {
  const { groups, master } = options
  if (groups) {
    const fromGroups = resolveOrganogramTierDisplay(tierId, embeddedLabel, groups)
    if (fromGroups && !isUuidLike(fromGroups)) return fromGroups
  }
  if (master) {
    const fromMaster = resolveOrganogramTierDisplay(tierId, embeddedLabel, master)
    if (fromMaster && !isUuidLike(fromMaster)) return fromMaster
  }
  const label = embeddedLabel.trim()
  const id = tierId.trim()
  if (label && !isUuidLike(label)) return label
  return id || '—'
}

function lookupMasterIdInMap(value: unknown, lookup: Map<string, string>): string | null {
  if (value === null || value === undefined) return null

  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as ApiRecord
    const nestedName = toText(obj.name).trim() || toText(obj.label).trim()
    if (nestedName && !isUuidLike(nestedName)) return nestedName
    const nestedId = toId(
      obj.id ??
        obj.group_id ??
        obj.groupId ??
        obj.agency_id ??
        obj.agencyId ??
        obj.department_id ??
        obj.departmentId ??
        obj.division_id ??
        obj.divisionId ??
        obj.sub_division_id ??
        obj.subDivisionId ??
        obj.entity_id ??
        obj.entityId,
    )
    if (nestedId) {
      const fromNestedId = lookup.get(nestedId.toLowerCase())
      if (fromNestedId) return fromNestedId
    }
    return null
  }

  const scalar = toText(value).trim()
  if (!scalar) return null
  return lookup.get(scalar.toLowerCase()) ?? null
}

function asLookupMap(lookup: Map<string, string> | Record<string, string>): Map<string, string> {
  return lookup instanceof Map ? lookup : organogramGroupsByIdToMap(lookup)
}

export function lookupMasterId(
  value: unknown,
  ...lookups: (Map<string, string> | Record<string, string>)[]
): string | null {
  for (const lookup of lookups) {
    const hit = lookupMasterIdInMap(value, asLookupMap(lookup))
    if (hit) return hit
  }
  return null
}
