import { apiDelete, apiGet, apiPost, apiPut } from '@/services/apiClient'
import { applyPagination } from '@/shared/utils/pagination'

type ApiRecord = Record<string, unknown>

export type ApprovingAuthorityPayload = {
  name: string
  role: string
  description: string
  has_employee_field: boolean
  is_active: boolean
}

export type ApprovingAuthorityRecord = {
  id: string
  name: string
  role: string
  description: string
  hasEmployeeField: boolean
  isActive: boolean
}

export type ApprovingAuthorityTableRow = ApprovingAuthorityRecord & { serialNo: number }

function toText(value: unknown) {
  return typeof value === 'string'
    ? value.trim()
    : typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : ''
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

export function mapApprovingAuthorityRecord(record: ApiRecord): ApprovingAuthorityRecord {
  return {
    id: toText(record.id) || toText(record.uuid),
    name: toText(record.name),
    role: toText(record.role) || toText(record.role_name) || toText(record.roleName),
    description: toText(record.description),
    hasEmployeeField: toBool(record.has_employee_field ?? record.hasEmployeeField, false),
    isActive: toBool(record.is_active ?? record.isActive, true),
  }
}

export function listApprovingAuthoritiesPath(search: string, page: number, pageSize: number) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('page_size', String(pageSize))
  const q = search.trim()
  if (q) params.set('search', q)
  return `/workflows/approving-authorities?${params.toString()}`
}

export async function fetchApprovingAuthoritiesPage(
  search: string,
  page: number,
  pageSize: number,
) {
  const payload = await apiGet<unknown>(listApprovingAuthoritiesPath(search, page, pageSize))
  const records = toArray(payload).map(mapApprovingAuthorityRecord).filter((row) => row.id)
  const paged = applyPagination(payload, records, page, pageSize, {
    page,
    pageSize,
    pageLength: records.length,
  })
  const rows: ApprovingAuthorityTableRow[] = paged.rows.map((row, index) => ({
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

export function createApprovingAuthority(body: ApprovingAuthorityPayload) {
  return apiPost<unknown, ApprovingAuthorityPayload>('/workflows/approving-authorities', body)
}

export function updateApprovingAuthority(id: string, body: ApprovingAuthorityPayload) {
  return apiPut<unknown, ApprovingAuthorityPayload>(
    `/workflows/approving-authorities/${encodeURIComponent(id)}`,
    body,
  )
}

export function deleteApprovingAuthority(id: string) {
  return apiDelete<unknown>(`/workflows/approving-authorities/${encodeURIComponent(id)}`)
}

export function toApprovingAuthorityPayload(raw: {
  name: string
  role: string
  description: string
  hasEmployeeField: boolean
  isActive: boolean
}): ApprovingAuthorityPayload {
  return {
    name: raw.name.trim(),
    role: raw.role.trim(),
    description: raw.description.trim(),
    has_employee_field: raw.hasEmployeeField,
    is_active: raw.isActive,
  }
}
