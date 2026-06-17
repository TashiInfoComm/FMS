import type { ApiRecord } from '@/features/user/lib/roles-api'
import { toText } from '@/features/user/lib/users-api'
import { fetchDriverVehicleAssignmentByVehicleId } from '@/features/vehicles/lib/driver-vehicle-assignments-api'
import { fetchVehicleById } from '@/features/vehicles/lib/vehicles-api'
import { apiClient, apiDelete, apiGet, apiPatch } from '@/services/apiClient'
import { extractMasterList } from '@/shared/lib/organogram-master-lookup'
import { applyPagination } from '@/shared/utils/pagination'

import type { QuotaRequestStatus } from '@/features/fuel/lib/quota-request-mock-data'

export type QuotaRequestListRow = {
  id: string
  vehicleId: string
  vehicle: string
  driverName: string
  contactNumber: string
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

function pickVehicleRegistration(record: ApiRecord): string {
  const make = pickScalar(record, ['make', 'vehicle_make'])
  const model = pickScalar(record, ['model', 'vehicle_model'])
  const registration = pickScalar(record, [
    'registration_number',
    'registrationNumber',
    'vehicle_number',
    'vehicleNumber',
  ])
  if (registration) return registration
  const makeModel = [make, model].filter(Boolean).join(' ').trim()
  return makeModel || pickScalar(record, ['vehicle_name', 'vehicleName', 'name']) || ''
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

export function mapQuotaRequestListRow(record: ApiRecord): QuotaRequestListRow | null {
  const id = pickScalar(record, ['id', 'quota_request_id', 'quotaRequestId', 'request_id', 'uuid'])
  if (!id) return null

  const vehicleId = pickScalar(record, ['vehicle_id', 'vehicleId'])
  const remarks =
    pickScalar(record, ['mto_remarks', 'mtoRemarks']) ||
    pickScalar(record, ['finance_remarks', 'financeRemarks']) ||
    pickScalar(record, ['remarks', 'remark'])

  return {
    id,
    vehicleId,
    vehicle: vehicleId || '—',
    driverName: '—',
    contactNumber: '—',
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

async function resolveVehicleLabels(vehicleIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(vehicleIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()

  const entries = await Promise.all(
    uniqueIds.map(async (vehicleId) => {
      try {
        const vehicle = await fetchVehicleById(vehicleId)
        const label = pickVehicleRegistration(vehicle)
        return [vehicleId, label || vehicleId] as const
      } catch {
        return [vehicleId, vehicleId] as const
      }
    }),
  )

  return new Map(entries)
}

function unwrapUserRecord(payload: unknown): ApiRecord {
  if (!payload || typeof payload !== 'object') return {}
  const root = payload as ApiRecord
  const data = root.data
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as ApiRecord
  }
  return root
}

function pickDriverName(record: ApiRecord): string {
  const user =
    record.user && typeof record.user === 'object' && !Array.isArray(record.user)
      ? (record.user as ApiRecord)
      : {}
  const merged = { ...record, ...user }
  const firstName = pickScalar(merged, ['first_name', 'firstName'])
  const middleName = pickScalar(merged, ['middle_name', 'middleName'])
  const lastName = pickScalar(merged, ['last_name', 'lastName'])
  const fullName =
    pickScalar(merged, ['name', 'full_name', 'fullName']) ||
    [firstName, middleName, lastName].filter(Boolean).join(' ').trim()
  return fullName || '—'
}

function pickContactNumber(record: ApiRecord): string {
  const user =
    record.user && typeof record.user === 'object' && !Array.isArray(record.user)
      ? (record.user as ApiRecord)
      : {}
  const merged = { ...record, ...user }
  return (
    pickScalar(merged, [
      'contact_no',
      'contact_number',
      'contactNumber',
      'contact',
      'phone',
      'mobile',
    ]) || '—'
  )
}

async function fetchDriverDisplayById(
  driverId: string,
): Promise<{ name: string; contactNumber: string } | null> {
  const trimmed = driverId.trim()
  if (!trimmed || trimmed === '—') return null
  try {
    const payload = await apiGet<unknown>(`/admin/users/${encodeURIComponent(trimmed)}`)
    const record = unwrapUserRecord(payload)
    return {
      name: pickDriverName(record),
      contactNumber: pickContactNumber(record),
    }
  } catch {
    return null
  }
}

async function resolveDriverDetailsByVehicleIds(
  vehicleIds: string[],
): Promise<Map<string, { name: string; contactNumber: string }>> {
  const uniqueVehicleIds = [...new Set(vehicleIds.filter(Boolean))]
  if (uniqueVehicleIds.length === 0) return new Map()

  const assignmentEntries = await Promise.all(
    uniqueVehicleIds.map(async (vehicleId) => {
      const assignment = await fetchDriverVehicleAssignmentByVehicleId(vehicleId)
      return [vehicleId, assignment?.driverId ?? ''] as const
    }),
  )

  const vehicleToDriverId = new Map(
    assignmentEntries.filter(([, driverId]) => driverId && driverId !== '—'),
  )
  const uniqueDriverIds = [...new Set([...vehicleToDriverId.values()])]
  if (uniqueDriverIds.length === 0) return new Map()

  const driverEntries = await Promise.all(
    uniqueDriverIds.map(async (driverId) => {
      const details = await fetchDriverDisplayById(driverId)
      return [driverId, details] as const
    }),
  )
  const driverDetailsById = new Map(
    driverEntries.filter((entry): entry is [string, { name: string; contactNumber: string }] =>
      Boolean(entry[1]),
    ),
  )

  const result = new Map<string, { name: string; contactNumber: string }>()
  for (const [vehicleId, driverId] of vehicleToDriverId) {
    const details = driverDetailsById.get(driverId)
    if (details) result.set(vehicleId, details)
  }
  return result
}

async function enrichQuotaRequestRowsWithVehicleNames(
  rows: QuotaRequestListRow[],
): Promise<QuotaRequestListRow[]> {
  const vehicleIds = rows.map((row) => row.vehicleId)
  const [vehicleLabels, driverDetailsByVehicleId] = await Promise.all([
    resolveVehicleLabels(vehicleIds),
    resolveDriverDetailsByVehicleIds(vehicleIds),
  ])
  return rows.map((row) => {
    const driverDetails = row.vehicleId ? driverDetailsByVehicleId.get(row.vehicleId) : undefined
    return {
      ...row,
      vehicle: row.vehicleId ? (vehicleLabels.get(row.vehicleId) ?? row.vehicleId) : '—',
      driverName: driverDetails?.name ?? '—',
      contactNumber: driverDetails?.contactNumber ?? '—',
    }
  })
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
  const mapped = records
    .map((record) => mapQuotaRequestListRow(record))
    .filter((row): row is QuotaRequestListRow => row !== null)
  const enrichedRows = await enrichQuotaRequestRowsWithVehicleNames(mapped)
  const paged = applyPagination(payload, enrichedRows, page, pageSize, {
    page,
    pageSize,
    pageLength: enrichedRows.length,
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
  const [enriched] = await enrichQuotaRequestRowsWithVehicleNames([mapped])
  return enriched
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
