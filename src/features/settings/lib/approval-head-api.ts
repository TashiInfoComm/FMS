import { apiDelete, apiGet, apiPost, apiPut } from '@/services/apiClient'
import { applyPagination } from '@/shared/utils/pagination'

type ApiRecord = Record<string, unknown>

export type ApprovalHeadPayload = {
  name: string
  description: string
  is_active: boolean
}

export type ApprovalHeadRecord = {
  id: string
  name: string
  description: string
  isActive: boolean
}

export type ApprovalHeadTableRow = ApprovalHeadRecord & { serialNo: number }



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

export function mapApprovalHeadRecord(record: ApiRecord): ApprovalHeadRecord {
  return {
    id: toText(record.id) || toText(record.uuid),
    name: toText(record.name),
    description: toText(record.description),
    isActive: toBool(record.is_active ?? record.isActive, true),
  }
}

export function listApprovalHeadsPath(search: string, page: number, pageSize: number) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('page_size', String(pageSize))
  const q = search.trim()
  if (q) params.set('search', q)
  return `/workflows/approval-heads?${params.toString()}`
}

export async function fetchApprovalHeadsPage(
  search: string,
  page: number,
  pageSize: number,
) {
  const payload = await apiGet<unknown>(listApprovalHeadsPath(search, page, pageSize))
  const records = toArray(payload).map(mapApprovalHeadRecord).filter((row) => row.id)
  const paged = applyPagination(payload, records, page, pageSize, {
    page,
    pageSize,
    pageLength: records.length,
  })
  const rows: ApprovalHeadTableRow[] = paged.rows.map((row, index) => ({
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

export function createApprovalHead(body: ApprovalHeadPayload) {
  return apiPost<unknown, ApprovalHeadPayload>('/workflows/approval-heads', body)
}

export function updateApprovalHead(id: string, body: ApprovalHeadPayload) {
  return apiPut<unknown, ApprovalHeadPayload>(
    `/workflows/approval-heads/${encodeURIComponent(id)}`,
    body,
  )
}

export function deleteApprovalHead(id: string) {
  return apiDelete<unknown>(`/workflows/approval-heads/${encodeURIComponent(id)}`)
}

export function toApprovalHeadPayload(raw: {
  name: string
  description: string
  isActive: boolean
}): ApprovalHeadPayload {
  return {
    name: raw.name.trim(),
    description: raw.description.trim(),
    is_active: raw.isActive,
  }
}

export type ApprovalHeadOption = {
  value: string
  label: string
}

/** Loads approval heads for select lists (e.g. approval condition form). */
export async function fetchApprovalHeadOptions(): Promise<ApprovalHeadOption[]> {
  const { rows } = await fetchApprovalHeadsPage('', 1, 100)
  return rows.map((row) => ({ value: row.id, label: row.name }))
}

/** Id → name map for resolving approval head labels in related lists. */
export async function fetchApprovalHeadNameById(): Promise<Record<string, string>> {
  const { rows } = await fetchApprovalHeadsPage('', 1, 100)
  return Object.fromEntries(rows.map((row) => [row.id, row.name]))
}
