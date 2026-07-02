import type { ApiRecord } from '@/features/user/lib/roles-api'
import { toText } from '@/features/user/lib/users-api'
import { apiClient, apiDelete, apiGet, apiPatch } from '@/services/apiClient'
import { extractMasterList } from '@/shared/lib/organogram-master-lookup'
import { applyPagination } from '@/shared/utils/pagination'

import type { QuotaRequestStatus } from '@/features/fuel/lib/quota-request-mock-data'

export type QuotaRequestListRow = {
  id: string
  vehicleId: string
  registrationNumber: string
  make: string
  model: string
  year: string
  /** Registration number; kept for pages that still bind `vehicle`. */
  vehicle: string
  requestSource: string
  balanceAtRequest: number
  recommendedAmount: number
  financeApprovedAmount: number | null
  mtoApprovedAmount: number | null
  remarks: string
  status: QuotaRequestStatus
  fuelQuotaId: string
}

export type QuotaRequestsPageResult = {
  rows: QuotaRequestListRow[]
  totalCount: number
  totalPages: number
  effectivePageSize: number
  serialBase: number
}

export type QuotaRequestMtoReviewAction = 'forward' | 'reject'
export type QuotaRequestFinanceReviewAction = 'approve' | 'reject'

function pickScalar(record: ApiRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return ''
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeQuotaRequestStatus(value: unknown): QuotaRequestStatus {
  const status = toText(value).trim().toUpperCase()
  if (status === 'FORWARDED') return 'FORWARDED'
  if (status === 'APPROVED') return 'APPROVED'
  if (status === 'COMPLETED') return 'COMPLETED'
  if (status === 'TOPPED_UP') return 'TOPPED_UP'
  if (status === 'MTO_REJECTED') return 'MTO_REJECTED'
  if (status === 'FINANCE_REJECTED') return 'FINANCE_REJECTED'
  if (status === 'REJECTED' || status === 'DECLINED') return 'REJECTED'
  return 'PENDING'
}

function nestedRecord(value: unknown): ApiRecord | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as ApiRecord
  }
  return null
}

function pickVehicleDetails(record: ApiRecord): {
  vehicleId: string
  registrationNumber: string
  make: string
  model: string
  year: string
} {
  const nestedVehicle = nestedRecord(record.vehicle)
  const source = nestedVehicle ?? record
  const vehicleId =
    pickScalar(record, ['vehicle_id', 'vehicleId']) ||
    (nestedVehicle ? pickScalar(nestedVehicle, ['id']) : '')

  return {
    vehicleId,
    registrationNumber:
      pickScalar(source, [
        'registration_number',
        'registrationNumber',
        'vehicle_number',
        'vehicleNumber',
      ]) || '—',
    make: pickScalar(source, ['make', 'vehicle_make']) || '—',
    model: pickScalar(source, ['model', 'vehicle_model']) || '—',
    year: pickScalar(source, ['year', 'vehicle_year']) || '—',
  }
}

export function mapQuotaRequestListRow(record: ApiRecord): QuotaRequestListRow | null {
  const id = pickScalar(record, ['id', 'quota_request_id', 'quotaRequestId', 'request_id', 'uuid'])
  if (!id) return null

  const vehicle = pickVehicleDetails(record)
  const remarks =
    pickScalar(record, ['mto_remarks', 'mtoRemarks']) ||
    pickScalar(record, ['finance_remarks', 'financeRemarks']) ||
    pickScalar(record, ['remarks', 'remark'])

  return {
    id,
    vehicleId: vehicle.vehicleId,
    registrationNumber: vehicle.registrationNumber,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    vehicle: vehicle.registrationNumber,
    requestSource: pickScalar(record, ['request_source', 'requestSource']),
    balanceAtRequest: toNumber(record.balance_at_request ?? record.balanceAtRequest),
    recommendedAmount: toNumber(
      record.system_recommended_amount ??
        record.systemRecommendedAmount ??
        record.recommended_amount ??
        record.recommendedAmount,
    ),
    financeApprovedAmount: toNullableNumber(
      record.finance_approved_amount ?? record.financeApprovedAmount,
    ),
    mtoApprovedAmount: toNullableNumber(record.mto_approved_amount ?? record.mtoApprovedAmount),
    remarks,
    status: normalizeQuotaRequestStatus(record.status ?? record.request_status ?? record.requestStatus),
    fuelQuotaId: pickScalar(record, ['fuel_quota_id', 'fuelQuotaId']),
  }
}

export function formatQuotaRequestSource(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return '—'
  return trimmed
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function unwrapQuotaRequestDetail(payload: unknown): ApiRecord | null {
  if (!payload || typeof payload !== 'object') return null
  const root = payload as ApiRecord
  const data = root.data
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const dataObj = data as ApiRecord
    const nested = dataObj.quota_request ?? dataObj.quotaRequest
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return nested as ApiRecord
    }
    return dataObj
  }
  const nested = root.quota_request ?? root.quotaRequest
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as ApiRecord
  }
  return root
}

function extractQuotaRequestList(payload: unknown): ApiRecord[] {
  const records = extractMasterList(payload)
  if (records.length > 0) return records
  if (!payload || typeof payload !== 'object') return []

  const root = payload as ApiRecord
  const data = root.data
  const dataObj =
    data && typeof data === 'object' && !Array.isArray(data) ? (data as ApiRecord) : null
  const candidates = [
    root.quota_requests,
    root.quotaRequests,
    dataObj?.quota_requests,
    dataObj?.quotaRequests,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is ApiRecord => !!item && typeof item === 'object')
    }
  }

  return []
}

export function quotaRequestsListPath(
  search: string,
  statusFilter: string,
  page: number,
  pageSize: number,
) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('page_size', String(pageSize))
  const q = search.trim()
  if (q) params.set('search', q)
  const status = statusFilter.trim()
  if (status && status !== 'all') params.set('status', status)
  return `/fuel/quota-requests?${params.toString()}`
}

export async function fetchQuotaRequestsPage(
  search: string,
  statusFilter: string,
  page: number,
  pageSize: number,
): Promise<QuotaRequestsPageResult> {
  const payload = await apiGet<unknown>(
    quotaRequestsListPath(search, statusFilter, page, pageSize),
  )
  const records = extractQuotaRequestList(payload)
  const rows = records
    .map((record) => mapQuotaRequestListRow(record))
    .filter((row): row is QuotaRequestListRow => row !== null)
  const paged = applyPagination(payload, rows, page, pageSize, {
    page,
    pageSize,
    pageLength: rows.length,
  })
  return {
    rows: paged.rows,
    totalCount: paged.totalCount,
    totalPages: paged.totalPages,
    effectivePageSize: paged.effectivePageSize,
    serialBase: paged.serialBase,
  }
}

export async function deleteQuotaRequest(id: string): Promise<unknown> {
  const trimmed = id.trim()
  if (!trimmed) throw new Error('Missing quota request id')
  return apiDelete<unknown>(`/fuel/quota-requests/${encodeURIComponent(trimmed)}`)
}

export async function fetchQuotaRequestById(requestId: string): Promise<QuotaRequestListRow> {
  const trimmed = requestId.trim()
  if (!trimmed) throw new Error('Missing quota request id')
  const payload = await apiGet<unknown>(`/fuel/quota-requests/${encodeURIComponent(trimmed)}`)
  const record = unwrapQuotaRequestDetail(payload)
  if (!record) throw new Error('Invalid quota request response')
  const mapped = mapQuotaRequestListRow(record)
  if (!mapped) throw new Error('Invalid quota request response')
  return mapped
}

export async function reviewQuotaRequestMto(
  requestId: string,
  action: QuotaRequestMtoReviewAction,
  approvedAmount: number,
  remarks: string,
): Promise<void> {
  const trimmedId = requestId.trim()
  const trimmedRemarks = remarks.trim()
  if (!trimmedId) throw new Error('Quota request id is required')
  if (!Number.isFinite(approvedAmount) || approvedAmount <= 0) {
    throw new Error('Approved amount must be greater than 0')
  }
  if (!trimmedRemarks) throw new Error('Remarks are required')
  await apiPatch<
    unknown,
    { action: QuotaRequestMtoReviewAction; approved_amount: number; remarks: string }
  >(`/fuel/quota-requests/${encodeURIComponent(trimmedId)}/mto-review`, {
    action,
    approved_amount: approvedAmount,
    remarks: trimmedRemarks,
  })
}

export async function reviewQuotaRequestFinance(
  requestId: string,
  action: QuotaRequestFinanceReviewAction,
  approvedAmount: number,
  remarks: string,
): Promise<void> {
  const trimmedId = requestId.trim()
  const trimmedRemarks = remarks.trim()
  if (!trimmedId) throw new Error('Quota request id is required')
  if (!Number.isFinite(approvedAmount) || approvedAmount <= 0) {
    throw new Error('Approved amount must be greater than 0')
  }
  if (!trimmedRemarks) throw new Error('Remarks are required')
  await apiPatch<
    unknown,
    { action: QuotaRequestFinanceReviewAction; approved_amount: number; remarks: string }
  >(`/fuel/quota-requests/${encodeURIComponent(trimmedId)}/finance-review`, {
    action,
    approved_amount: approvedAmount,
    remarks: trimmedRemarks,
  })
}

export async function resubmitQuotaRequestMto(
  requestId: string,
  approvedAmount: number,
  remarks: string,
): Promise<void> {
  const trimmedId = requestId.trim()
  const trimmedRemarks = remarks.trim()
  if (!trimmedId) throw new Error('Quota request id is required')
  if (!Number.isFinite(approvedAmount) || approvedAmount <= 0) {
    throw new Error('Approved amount must be greater than 0')
  }
  if (!trimmedRemarks) throw new Error('Remarks are required')
  await apiPatch<
    unknown,
    { approved_amount: number; remarks: string }
  >(`/fuel/quota-requests/${encodeURIComponent(trimmedId)}/resubmit`, {
    approved_amount: approvedAmount,
    remarks: trimmedRemarks,
  })
}

export async function topUpQuotaRequest(requestId: string): Promise<unknown> {
  const trimmedId = requestId.trim()
  if (!trimmedId) throw new Error('Quota request id is required')
  return apiClient<unknown>(
    `/fuel/quota-requests/${encodeURIComponent(trimmedId)}/topup`,
    { method: 'PATCH' },
  )
}
