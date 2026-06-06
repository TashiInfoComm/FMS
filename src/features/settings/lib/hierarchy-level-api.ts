import { apiDelete, apiGet, apiPost, apiPut } from '@/services/apiClient'
import { fetchApprovingAuthoritiesPage } from '@/features/settings/lib/approving-authority-api'
import { applyPagination } from '@/shared/utils/pagination'

type ApiRecord = Record<string, unknown>

export type HierarchyLevelPayload = {
  approving_authority_id: string
  level: string
  sequence: number
  start_date: string
  user_id: string
  end_date: string
  is_active: boolean
}

export type HierarchyLevelRecord = {
  id: string
  hierarchyId: string
  approvingAuthorityId: string
  approvingAuthorityName: string
  level: string
  sequence: number
  startDate: string
  endDate: string
  userId: string
  employeeDisplay: string
  isActive: boolean
}

export type HierarchyLevelTableRow = HierarchyLevelRecord & { serialNo: number }

function toText(value: unknown) {
  return typeof value === 'string'
    ? value.trim()
    : typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : ''
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number.parseInt(toText(value), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toBool(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value
  if (value === 1 || value === '1') return true
  if (value === 0 || value === '0') return false
  return fallback
}

function toArray(payload: unknown): ApiRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is ApiRecord => !!item && typeof item === 'object')
  }
  if (!payload || typeof payload !== 'object') return []
  const root = payload as Record<string, unknown>
  const dataObj = root.data as Record<string, unknown> | undefined
  const candidates = [
    root.data,
    root.items,
    root.results,
    dataObj?.items,
    dataObj?.results,
  ]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is ApiRecord => !!item && typeof item === 'object')
    }
  }
  return []
}

function unwrapRecord(payload: unknown): ApiRecord | null {
  if (!payload || typeof payload !== 'object') return null
  const root = payload as ApiRecord
  const data = root.data
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as ApiRecord
  }
  return root
}

function readNestedName(record: ApiRecord, keys: string[]) {
  for (const key of keys) {
    const nested = record[key]
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const obj = nested as ApiRecord
      const name = toText(obj.name) || toText(obj.label) || toText(obj.title)
      if (name) return name
    }
  }
  return ''
}

function readUserDisplay(record: ApiRecord) {
  const nested = record.user ?? record.employee
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const user = nested as ApiRecord
    const empId =
      toText(user.employee_id) ||
      toText(user.employeeId) ||
      toText(user.emp_id) ||
      toText(user.username)
    const name =
      toText(user.name) ||
      [toText(user.first_name), toText(user.last_name)].filter(Boolean).join(' ').trim() ||
      toText(user.full_name)
    if (empId && name) return `${empId} - ${name}`
    if (name) return name
    if (empId) return empId
  }
  const empId = toText(record.employee_id) || toText(record.employeeId)
  const name = toText(record.employee_name) || toText(record.user_name) || toText(record.userName)
  if (empId && name) return `${empId} - ${name}`
  return name || empId
}

export function mapHierarchyLevelRecord(
  record: ApiRecord,
  hierarchyId = '',
): HierarchyLevelRecord {
  const approvingAuthorityId =
    toText(record.approving_authority_id) ||
    toText(record.approvingAuthorityId) ||
    (() => {
      const nested = record.approving_authority ?? record.approvingAuthority
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        return toText((nested as ApiRecord).id) || toText((nested as ApiRecord).uuid)
      }
      return ''
    })()

  const userId =
    toText(record.user_id) ||
    toText(record.userId) ||
    (() => {
      const nested = record.user
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        return (
          toText((nested as ApiRecord).id) ||
          toText((nested as ApiRecord).user_id) ||
          toText((nested as ApiRecord).uuid)
        )
      }
      return ''
    })()

  return {
    id: toText(record.id) || toText(record.uuid),
    hierarchyId:
      toText(record.workflow_hierarchy_id) ||
      toText(record.hierarchy_id) ||
      toText(record.hierarchyId) ||
      hierarchyId,
    approvingAuthorityId,
    approvingAuthorityName:
      readNestedName(record, ['approving_authority', 'approvingAuthority']) ||
      toText(record.approving_authority_name) ||
      toText(record.approvingAuthorityName),
    level: toText(record.level) || toText(record.level_name) || toText(record.levelName),
    sequence: toNumber(record.sequence, 0),
    startDate: toText(record.start_date) || toText(record.startDate),
    endDate: toText(record.end_date) || toText(record.endDate),
    userId,
    employeeDisplay: readUserDisplay(record),
    isActive: toBool(record.is_active ?? record.isActive, true),
  }
}

function hierarchyLevelsBasePath(hierarchyId: string) {
  const id = hierarchyId.trim()
  if (!id) throw new Error('Hierarchy id is required')
  return `/workflows/hierarchies/${encodeURIComponent(id)}/levels`
}

export function listHierarchyLevelsPath(
  hierarchyId: string,
  search: string,
  page: number,
  pageSize: number,
) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('page_size', String(pageSize))
  const q = search.trim()
  if (q) params.set('search', q)
  return `${hierarchyLevelsBasePath(hierarchyId)}?${params.toString()}`
}

export async function fetchHierarchyLevelsPage(
  hierarchyId: string,
  search: string,
  page: number,
  pageSize: number,
) {
  const payload = await apiGet<unknown>(
    listHierarchyLevelsPath(hierarchyId, search, page, pageSize),
  )
  const authorityRows = await fetchApprovingAuthoritiesPage('', 1, 100)
  const authorityNameById = new Map(
    authorityRows.rows.map((row) => [row.id, row.name] as const),
  )
  const records = toArray(payload)
    .map((row) => mapHierarchyLevelRecord(row, hierarchyId))
    .map((row) => ({
      ...row,
      approvingAuthorityName:
        row.approvingAuthorityName || authorityNameById.get(row.approvingAuthorityId) || '',
    }))
    .filter((row) => row.id)
  const paged = applyPagination(payload, records, page, pageSize, {
    page,
    pageSize,
    pageLength: records.length,
  })
  const rows: HierarchyLevelTableRow[] = paged.rows.map((row, index) => ({
    ...row,
    serialNo: paged.serialBase + index + 1,
  }))
  return {
    rows,
    totalCount: paged.totalCount,
    totalPages: paged.totalPages,
    effectivePageSize: paged.effectivePageSize,
  }
}

export async function fetchHierarchyLevelById(
  hierarchyId: string,
  levelId: string,
): Promise<HierarchyLevelRecord> {
  const payload = await apiGet<unknown>(
    `${hierarchyLevelsBasePath(hierarchyId)}/${encodeURIComponent(levelId)}`,
  )
  const record = unwrapRecord(payload)
  if (!record) throw new Error('Hierarchy level not found')
  const mapped = mapHierarchyLevelRecord(record, hierarchyId)
  if (!mapped.id) throw new Error('Hierarchy level not found')
  return mapped
}

export function createHierarchyLevel(hierarchyId: string, body: HierarchyLevelPayload) {
  return apiPost<unknown, HierarchyLevelPayload>(
    hierarchyLevelsBasePath(hierarchyId),
    body,
  )
}

export function updateHierarchyLevel(
  hierarchyId: string,
  levelId: string,
  body: HierarchyLevelPayload,
) {
  return apiPut<unknown, HierarchyLevelPayload>(
    `${hierarchyLevelsBasePath(hierarchyId)}/${encodeURIComponent(levelId)}`,
    body,
  )
}

export function deleteHierarchyLevel(hierarchyId: string, levelId: string) {
  return apiDelete<unknown>(
    `${hierarchyLevelsBasePath(hierarchyId)}/${encodeURIComponent(levelId)}`,
  )
}

export function toHierarchyLevelPayload(raw: {
  approvingAuthorityId: string
  level: string
  sequence: number
  startDate: string
  userId: string
  endDate: string
  isActive: boolean
}): HierarchyLevelPayload {
  return {
    approving_authority_id: raw.approvingAuthorityId.trim(),
    level: raw.level.trim(),
    sequence: raw.sequence,
    start_date: raw.startDate.trim(),
    user_id: raw.userId.trim(),
    end_date: raw.endDate.trim(),
    is_active: raw.isActive,
  }
}

export type SelectOption = {
  value: string
  label: string
  searchText?: string
}

/** Loads users for employee pickers on hierarchy level forms. */
export async function fetchUserSelectOptions(search = ''): Promise<SelectOption[]> {
  const params = new URLSearchParams()
  params.set('page', '1')
  params.set('page_size', '100')
  const q = search.trim()
  if (q) params.set('search', q)
  const payload = await apiGet<unknown>(`/admin/users?${params.toString()}`)
  const records = toArray(payload)

  const options: SelectOption[] = []
  for (const record of records) {
    const merged = { ...record }
    const nested = record.user
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      Object.assign(merged, nested as ApiRecord)
    }
    const id =
      toText(merged.id) ||
      toText(merged.user_id) ||
      toText(merged.uuid) ||
      toText(merged.keycloak_id)
    if (!id) continue

    const empId = toText(merged.employee_id) || toText(merged.employeeId) || toText(merged.username)
    const name =
      toText(merged.name) ||
      [toText(merged.first_name), toText(merged.last_name)].filter(Boolean).join(' ').trim() ||
      toText(merged.full_name) ||
      toText(merged.username)

    const label = empId && name ? `${empId} - ${name}` : name || empId || id
    options.push({
      value: id,
      label,
      searchText: [empId, name, id].filter(Boolean).join(' '),
    })
  }
  return options
}
