import { apiDelete, apiGet, apiPost, apiPut } from '@/services/apiClient'
import { applyPagination } from '@/shared/utils/pagination'

type ApiRecord = Record<string, unknown>

export type HierarchyPayload = {
  name: string
  description: string
  is_active: boolean
}

export type HierarchyRecord = {
  id: string
  name: string
  description: string
  isActive: boolean
}

export type HierarchyTableRow = HierarchyRecord & { serialNo: number }

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

export function mapHierarchyRecord(record: ApiRecord): HierarchyRecord {
  return {
    id: toText(record.id) || toText(record.uuid),
    name: toText(record.name),
    description: toText(record.description),
    isActive: toBool(record.is_active ?? record.isActive, true),
  }
}

export function listHierarchiesPath(search: string, page: number, pageSize: number) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('page_size', String(pageSize))
  const q = search.trim()
  if (q) params.set('search', q)
  return `/workflows/hierarchies?${params.toString()}`
}

export async function fetchHierarchiesPage(
  search: string,
  page: number,
  pageSize: number,
) {
  const payload = await apiGet<unknown>(listHierarchiesPath(search, page, pageSize))
  const records = toArray(payload).map(mapHierarchyRecord).filter((row) => row.id)
  const paged = applyPagination(payload, records, page, pageSize, {
    page,
    pageSize,
    pageLength: records.length,
  })
  const rows: HierarchyTableRow[] = paged.rows.map((row, index) => ({
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

export function createHierarchy(body: HierarchyPayload) {
  return apiPost<unknown, HierarchyPayload>('/workflows/hierarchies', body)
}

export function updateHierarchy(id: string, body: HierarchyPayload) {
  return apiPut<unknown, HierarchyPayload>(
    `/workflows/hierarchies/${encodeURIComponent(id)}`,
    body,
  )
}

export function deleteHierarchy(id: string) {
  return apiDelete<unknown>(`/workflows/hierarchies/${encodeURIComponent(id)}`)
}

export async function fetchHierarchyById(id: string): Promise<HierarchyRecord | null> {
  const trimmed = id.trim()
  if (!trimmed) return null
  try {
    const payload = await apiGet<unknown>(
      `/workflows/hierarchies/${encodeURIComponent(trimmed)}`,
    )
    if (!payload || typeof payload !== 'object') return null
    const root = payload as ApiRecord
    const data = root.data
    const record =
      data && typeof data === 'object' && !Array.isArray(data)
        ? (data as ApiRecord)
        : root
    const mapped = mapHierarchyRecord(record)
    return mapped.id ? mapped : null
  } catch {
    const { rows } = await fetchHierarchiesPage('', 1, 100)
    return rows.find((row) => row.id === trimmed) ?? null
  }
}

export function toHierarchyPayload(raw: {
  name: string
  description: string
  isActive: boolean
}): HierarchyPayload {
  return {
    name: raw.name.trim(),
    description: raw.description.trim(),
    is_active: raw.isActive,
  }
}
