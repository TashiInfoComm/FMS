import type { ApiRecord } from '@/features/user/lib/roles-api'
import {
  type ParkingLogListRow,
  type ParkingLogStatus,
} from '@/features/parking/lib/parking-logs-mock-data'
import { apiClient, apiGet, apiGetBlob } from '@/services/apiClient'
import {
  closeBrowserTab,
  navigateBrowserTab,
} from '@/shared/lib/open-in-new-tab'
import { extractMasterList } from '@/shared/lib/organogram-master-lookup'
import { applyPagination } from '@/shared/utils/pagination'

export type ParkingLogsPageResult = {
  rows: ParkingLogListRow[]
  totalCount: number
  totalPages: number
  effectivePageSize: number
  serialBase: number
}

export type ParkingClaimStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PAID'
  | 'REJECTED'

export type ParkingClaimRow = {
  id: string
  referenceNo: string
  monthKey: string
  monthLabel: string
  amount: number
  status: ParkingClaimStatus
  currentLevelCode?: string
  currentLevelName?: string
  driverName?: string
  agencyName?: string
  departmentName?: string
  divisionName?: string
  subDivisionName?: string
  logs: ParkingLogListRow[]
}

export type CreateParkingLogInput = {
  expenseDate: string
  location: string
  amount: number
  receiptFile: File
  vehicleId: string
}

export type UpdateParkingLogInput = {
  expenseDate: string
  location: string
  amount: number
  receiptFile?: File | null
  vehicleId: string
}

export type DriverVehicleOption = {
  value: string
  label: string
  description?: string
}

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
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function basenameFromPath(value: string): string {
  const trimmed = value.trim().split('?')[0]?.trim() ?? ''
  if (!trimmed) return ''
  const parts = trimmed.split(/[/\\]/).filter(Boolean)
  return parts[parts.length - 1] ?? trimmed
}

function normalizeParkingLogStatus(value: unknown): ParkingLogStatus {
  const normalized = String(value ?? 'PENDING_CONSOLIDATION')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')

  if (
    normalized === 'PENDING_CONSOLIDATION' ||
    normalized === 'CONSOLIDATED' ||
    normalized === 'RETURNED' ||
    normalized === 'RESUBMITTED' ||
    normalized === 'LINE_APPROVED' ||
    normalized === 'WITHDRAWN'
  ) {
    return normalized
  }

  return 'PENDING_CONSOLIDATION'
}

function unwrapParkingLogRecord(payload: unknown): ApiRecord | null {
  if (!payload || typeof payload !== 'object') return null
  const root = payload as ApiRecord
  if (Array.isArray(root.data)) return null

  const data =
    root.data && typeof root.data === 'object' && !Array.isArray(root.data)
      ? (root.data as ApiRecord)
      : null

  const candidates = [
    root,
    data,
    data?.log,
    data?.parking_log,
    data?.parkingLog,
    root.log,
    root.parking_log,
    root.parkingLog,
  ]

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue
    const record = candidate as ApiRecord
    const id = pickScalar(record, ['id', 'log_id', 'logId', 'uuid'])
    if (id) return record
  }

  return data ?? root
}

function extractParkingLogList(payload: unknown): ApiRecord[] {
  const records = extractMasterList(payload)
  if (records.length > 0) return records

  if (!payload || typeof payload !== 'object') return []
  const root = payload as ApiRecord
  const data = root.data
  const dataObj =
    data && typeof data === 'object' && !Array.isArray(data) ? (data as ApiRecord) : null

  const candidates = [
    root.logs,
    root.parking_logs,
    root.parkingLogs,
    dataObj?.logs,
    dataObj?.parking_logs,
    dataObj?.parkingLogs,
    dataObj?.items,
    root.items,
  ]

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue
    return candidate.filter(
      (item): item is ApiRecord => !!item && typeof item === 'object',
    )
  }

  return []
}

function formatOrgLabel(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (!trimmed.includes('_')) return trimmed
  return trimmed
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function pickNestedOrgLabel(
  record: ApiRecord,
  blockKeys: string[],
  flatKeys: string[],
): string {
  for (const blockKey of blockKeys) {
    const block = record[blockKey]
    if (!block || typeof block !== 'object' || Array.isArray(block)) continue
    const nested = block as ApiRecord
    const name = pickScalar(nested, ['name', 'display_name', 'displayName'])
    if (name) return name
    const code = pickScalar(nested, ['code'])
    if (code) return formatOrgLabel(code)
  }
  const flat = pickScalar(record, flatKeys)
  return flat.includes('_') ? formatOrgLabel(flat) : flat
}

function mapParkingLogListRow(record: ApiRecord): ParkingLogListRow | null {
  const id = pickScalar(record, ['id', 'log_id', 'logId', 'uuid'])
  if (!id) return null

  const receiptUrl = pickScalar(record, ['receipt_url', 'receiptUrl'])
  const receiptPath = pickScalar(record, [
    'receipt_image_path',
    'receiptImagePath',
    'receipt_path',
    'receiptPath',
    'receipt_file_name',
    'receiptFileName',
  ])
  const fileNameSource = receiptPath || receiptUrl
  const vehicleInfo = pickVehicleInfoBlock(record)
  const vehicleId =
    pickScalar(record, ['vehicle_id', 'vehicleId', 'assign_vehicle_id']) ||
    pickScalar(vehicleInfo ?? {}, ['id', 'vehicle_id', 'vehicleId'])
  const vehicleRegistrationNumber = pickScalar(vehicleInfo ?? {}, [
    'registration_number',
    'registrationNumber',
    'vehicle_number',
    'vehicleNumber',
  ])
  const returnedRemarks = pickScalar(record, [
    'returned_remarks',
    'returnedRemarks',
    'return_remarks',
    'returnRemarks',
    'remarks',
    'remark',
  ])

  return {
    id,
    vehicleId: vehicleId || undefined,
    vehicleRegistrationNumber: vehicleRegistrationNumber || undefined,
    date:
      pickScalar(record, ['expense_date', 'expenseDate', 'date', 'log_date', 'logDate']) ||
      pickScalar(record, ['created_at', 'createdAt']).slice(0, 10),
    location: pickScalar(record, ['location']) || '—',
    amount: toNumber(record.amount ?? record.fee_amount ?? record.feeAmount),
    receiptUrl: receiptUrl || undefined,
    receiptFileName: fileNameSource ? basenameFromPath(fileNameSource) : '',
    receiptImagePath: receiptPath || undefined,
    status: normalizeParkingLogStatus(record.status),
    returnedRemarks: returnedRemarks || undefined,
  }
}

function extractParkingClaimsList(payload: unknown): ApiRecord[] {
  const records = extractMasterList(payload)
  if (records.length > 0) return records

  if (!payload || typeof payload !== 'object') return []
  const root = payload as ApiRecord
  const data = root.data
  const dataObj =
    data && typeof data === 'object' && !Array.isArray(data) ? (data as ApiRecord) : null

  const candidates = [
    root.claims,
    root.parking_claims,
    root.parkingClaims,
    root.items,
    dataObj?.claims,
    dataObj?.parking_claims,
    dataObj?.parkingClaims,
    dataObj?.items,
  ]

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue
    return candidate.filter(
      (item): item is ApiRecord => !!item && typeof item === 'object' && !Array.isArray(item),
    )
  }

  return []
}

function toMonthKeyFromRecord(record: ApiRecord): string {
  const directMonth = pickScalar(record, ['month_key', 'monthKey'])
  if (/^\d{4}-\d{2}$/.test(directMonth)) return directMonth

  const year = pickScalar(record, ['claim_year', 'claimYear', 'year'])
  const month = pickScalar(record, ['claim_month', 'claimMonth', 'month_number', 'monthNumber'])
  if (/^\d{4}$/.test(year) && /^\d{1,2}$/.test(month)) {
    return `${year}-${month.padStart(2, '0')}`
  }

  const dateLike = pickScalar(record, ['created_at', 'createdAt'])
  if (dateLike.length >= 7) {
    const maybe = dateLike.slice(0, 7)
    if (/^\d{4}-\d{2}$/.test(maybe)) return maybe
  }

  return ''
}

function pickDriverName(record: ApiRecord): string {
  const driver = record.driver
  if (driver && typeof driver === 'object' && !Array.isArray(driver)) {
    return pickScalar(driver as ApiRecord, ['name', 'full_name', 'fullName', 'driver_name'])
  }
  return pickScalar(record, ['driver_name', 'driverName'])
}

function pickCurrentLevelName(record: ApiRecord): string {
  const currentLevel = record.current_level ?? record.currentLevel
  if (currentLevel && typeof currentLevel === 'object' && !Array.isArray(currentLevel)) {
    return pickScalar(currentLevel as ApiRecord, ['name', 'label', 'title', 'code'])
  }
  return pickScalar(record, ['current_level_name', 'currentLevelName'])
}

function pickCurrentLevelCode(record: ApiRecord): string {
  const currentLevel = record.current_level ?? record.currentLevel
  if (currentLevel && typeof currentLevel === 'object' && !Array.isArray(currentLevel)) {
    return pickScalar(currentLevel as ApiRecord, ['code', 'level_code', 'levelCode'])
  }
  return pickScalar(record, ['current_level_code', 'currentLevelCode'])
}

function toMonthLabel(monthKey: string): string {
  const [yearText, monthText] = monthKey.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  if (!Number.isFinite(year) || !Number.isFinite(month)) return monthKey
  const date = new Date(year, month - 1, 1)
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date)
}

function normalizeParkingClaimStatus(value: unknown): ParkingClaimStatus {
  const normalized = String(value ?? 'PENDING_APPROVAL')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')

  if (
    normalized === 'PENDING_APPROVAL' ||
    normalized === 'APPROVED' ||
    normalized === 'PAID' ||
    normalized === 'REJECTED'
  ) {
    return normalized
  }

  if (normalized === 'REIMBURSED') return 'PAID'
  if (normalized.includes('PENDING')) return 'PENDING_APPROVAL'
  return 'PENDING_APPROVAL'
}

function mapParkingClaimRow(record: ApiRecord): ParkingClaimRow | null {
  const id = pickScalar(record, ['id', 'claim_id', 'claimId', 'monthly_claim_id', 'monthlyClaimId'])
  const monthKey = toMonthKeyFromRecord(record)
  if (!id && !monthKey) return null

  const nestedLogsCandidate =
    (Array.isArray(record.line_items) && record.line_items) ||
    (Array.isArray(record.lineItems) && record.lineItems) ||
    (Array.isArray(record.logs) && record.logs) ||
    (Array.isArray(record.parking_logs) && record.parking_logs) ||
    (Array.isArray(record.parkingLogs) && record.parkingLogs) ||
    []

  const logs = nestedLogsCandidate
    .filter((entry): entry is ApiRecord => !!entry && typeof entry === 'object' && !Array.isArray(entry))
    .map((entry) => mapParkingLogListRow(entry))
    .filter((entry): entry is ParkingLogListRow => entry !== null)

  const fallbackMonthKey =
    monthKey || (logs[0]?.date ? logs[0].date.slice(0, 7) : '')
  const resolvedMonthKey = /^\d{4}-\d{2}$/.test(fallbackMonthKey)
    ? fallbackMonthKey
    : '0000-00'

  const amount =
    toNumber(
      record.total_amount ??
        record.totalAmount ??
        record.amount ??
        record.claim_amount ??
        record.claimAmount,
    ) || logs.reduce((sum, item) => sum + item.amount, 0)

  return {
    id: id || resolvedMonthKey,
    referenceNo:
      pickScalar(record, [
        'reference_no',
        'referenceNo',
        'claim_reference',
        'claimReference',
        'reference',
      ]) || '—',
    monthKey: resolvedMonthKey,
    monthLabel: toMonthLabel(resolvedMonthKey),
    amount,
    status: normalizeParkingClaimStatus(record.status),
    currentLevelCode: pickCurrentLevelCode(record) || undefined,
    currentLevelName: pickCurrentLevelName(record) || undefined,
    driverName: pickDriverName(record) || undefined,
    agencyName:
      pickNestedOrgLabel(record, ['agency'], ['agency_name', 'agencyName']) || undefined,
    departmentName:
      pickNestedOrgLabel(record, ['department'], ['department_name', 'departmentName']) ||
      undefined,
    divisionName:
      pickNestedOrgLabel(record, ['division'], ['division_name', 'divisionName']) || undefined,
    subDivisionName:
      pickNestedOrgLabel(
        record,
        ['sub_division', 'subDivision'],
        ['sub_division_name', 'subDivisionName'],
      ) || undefined,
    logs: logs.sort((a, b) => b.date.localeCompare(a.date)),
  }
}

function pickVehicleInfoBlock(record: ApiRecord): ApiRecord | null {
  const candidates = [record.vehicle_info, record.vehicleInfo, record.vehicle]
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      return candidate as ApiRecord
    }
  }
  return null
}

function mapDriverVehicleOption(record: ApiRecord): DriverVehicleOption | null {
  const vehicleInfo = pickVehicleInfoBlock(record)
  const vehicleId =
    pickScalar(record, ['vehicle_id', 'vehicleId', 'assign_vehicle_id']) ||
    pickScalar(vehicleInfo ?? {}, ['id', 'vehicle_id', 'vehicleId'])
  if (!vehicleId) return null

  const details = vehicleInfo ?? record
  const make = pickScalar(details, ['make', 'vehicle_make', 'manufacturer'])
  const model = pickScalar(details, ['model', 'vehicle_model', 'make_model', 'makeModel'])
  const year = pickScalar(details, ['year', 'vehicle_year', 'vehicleYear'])
  const registration = pickScalar(details, [
    'registration_number',
    'registrationNumber',
    'plate_number',
    'plateNumber',
    'vehicle_number',
    'vehicleNumber',
  ])
  const nameLabel = [make, model, year].filter(Boolean).join(' ').trim()

  return {
    value: vehicleId,
    label: nameLabel || registration || vehicleId,
    description: registration && nameLabel ? registration : undefined,
  }
}

export async function fetchDriverParkingVehicles(driverId: string): Promise<DriverVehicleOption[]> {
  const trimmed = driverId.trim()
  if (!trimmed) return []
  const payload = await apiGet<unknown>(`/drivers/${encodeURIComponent(trimmed)}/vehicles`)
  const records = extractMasterList(payload)
  if (records.length === 0) return []

  return records
    .map((record) => mapDriverVehicleOption(record))
    .filter((option): option is DriverVehicleOption => option !== null)
}

function unwrapParkingClaimRecord(payload: unknown): ApiRecord | null {
  if (!payload || typeof payload !== 'object') return null
  const root = payload as ApiRecord
  if (Array.isArray(root.data)) return null

  const data =
    root.data && typeof root.data === 'object' && !Array.isArray(root.data)
      ? (root.data as ApiRecord)
      : null

  const candidates = [
    root,
    data,
    data?.claim,
    data?.parking_claim,
    data?.parkingClaim,
    root.claim,
    root.parking_claim,
    root.parkingClaim,
  ]

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue
    const record = candidate as ApiRecord
    const id = pickScalar(record, ['id', 'claim_id', 'claimId', 'monthly_claim_id', 'monthlyClaimId'])
    if (id || toMonthKeyFromRecord(record)) return record
  }

  return data ?? root
}

export async function fetchParkingClaimById(claimId: string): Promise<ParkingClaimRow | null> {
  const trimmed = claimId.trim()
  if (!trimmed) return null
  const payload = await apiGet<unknown>(`/parking/claims/${encodeURIComponent(trimmed)}`)
  const record = unwrapParkingClaimRecord(payload)
  if (!record) return null
  return mapParkingClaimRow(record)
}

export async function fetchParkingClaims(): Promise<ParkingClaimRow[]> {
  const payload = await apiGet<unknown>('/parking/claims')
  const records = extractParkingClaimsList(payload)
  return records
    .map((record) => mapParkingClaimRow(record))
    .filter((record): record is ParkingClaimRow => record !== null)
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
}

export function parkingLogsListPath(
  search: string,
  page: number,
  pageSize: number,
): string {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('page_size', String(pageSize))
  const q = search.trim()
  if (q) params.set('search', q)
  return `/parking/logs?${params.toString()}`
}

export async function fetchParkingLogsPage(
  search: string,
  page: number,
  pageSize: number,
): Promise<ParkingLogsPageResult> {
  const payload = await apiGet<unknown>(parkingLogsListPath(search, page, pageSize))
  const records = extractParkingLogList(payload)
  const rows = records
    .map((record) => mapParkingLogListRow(record))
    .filter((row): row is ParkingLogListRow => row !== null)

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

export async function fetchParkingLogById(id: string): Promise<ParkingLogListRow | null> {
  const trimmed = id.trim()
  if (!trimmed) return null
  const payload = await apiGet<unknown>(`/parking/logs/${encodeURIComponent(trimmed)}`)
  const record = unwrapParkingLogRecord(payload)
  if (!record) return null
  return mapParkingLogListRow(record)
}

function buildParkingLogFormData(
  input: CreateParkingLogInput | UpdateParkingLogInput,
  options?: { includeReceipt: boolean },
): FormData {
  const form = new FormData()
  form.append('amount', String(input.amount))
  form.append('expense_date', input.expenseDate)
  form.append('location', input.location.trim())
  form.append('vehicle_id', input.vehicleId.trim())

  const receiptFile =
    'receiptFile' in input ? input.receiptFile : undefined

  if (options?.includeReceipt !== false && receiptFile) {
    form.append('receipt_image_path', receiptFile, receiptFile.name)
  }

  return form
}

export async function createParkingLog(input: CreateParkingLogInput): Promise<unknown> {
  return apiClient<unknown>('/parking/logs', {
    method: 'POST',
    body: buildParkingLogFormData(input),
  })
}

export async function updateParkingLog(
  logId: string,
  input: UpdateParkingLogInput,
): Promise<unknown> {
  const trimmed = logId.trim()
  if (!trimmed) throw new Error('Parking log id is required')

  return apiClient<unknown>(`/parking/logs/${encodeURIComponent(trimmed)}`, {
    method: 'PUT',
    body: buildParkingLogFormData(input),
  })
}

export async function deleteParkingLog(logId: string): Promise<unknown> {
  const trimmed = logId.trim()
  if (!trimmed) throw new Error('Parking log id is required')

  return apiClient<unknown>(`/parking/logs/${encodeURIComponent(trimmed)}`, {
    method: 'DELETE',
  })
}

export async function withdrawParkingLog(logId: string): Promise<unknown> {
  const trimmed = logId.trim()
  if (!trimmed) throw new Error('Parking log id is required')

  return apiClient<unknown>(`/parking/logs/${encodeURIComponent(trimmed)}/withdraw`, {
    method: 'POST',
  })
}

function pickReceiptUrlFromPayload(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const root = payload as ApiRecord
  const data =
    root.data && typeof root.data === 'object' && !Array.isArray(root.data)
      ? (root.data as ApiRecord)
      : null

  return (
    pickScalar(data ?? root, [
      'url',
      'download_url',
      'downloadUrl',
      'receipt_url',
      'receiptUrl',
      'signed_url',
      'signedUrl',
    ]) || ''
  )
}

function guessReceiptMimeType(fileName: string): string {
  const lower = fileName.trim().toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  return 'application/octet-stream'
}

/** GET `/parking/logs/{log_id}/receipt` and open the presigned receipt URL. */
export async function openParkingLogReceipt(
  logId: string,
  fileName = '',
  targetWindow?: Window | null,
): Promise<void> {
  const trimmed = logId.trim()
  if (!trimmed) throw new Error('Parking log id is required')

  try {
    const { blob, contentType } = await apiGetBlob(
      `/parking/logs/${encodeURIComponent(trimmed)}/receipt`,
    )

    if (contentType.includes('application/json')) {
      const payload = JSON.parse(await blob.text()) as unknown
      const url = pickReceiptUrlFromPayload(payload)
      if (!url) throw new Error('Receipt URL not found')
      navigateBrowserTab(targetWindow, url)
      return
    }

    const mimeType =
      contentType && contentType !== 'application/octet-stream'
        ? contentType
        : guessReceiptMimeType(fileName)
    const fileBlob = mimeType === blob.type ? blob : blob.slice(0, blob.size, mimeType)
    const objectUrl = URL.createObjectURL(fileBlob)
    navigateBrowserTab(targetWindow, objectUrl)
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
  } catch (error) {
    closeBrowserTab(targetWindow)
    throw error
  }
}

export type ParkingClaimDecideAction = 'APPROVE' | 'REJECT'

export type ParkingClaimDecideInput = {
  action: ParkingClaimDecideAction
  remarks: string
}

export async function decideParkingClaim(
  claimId: string,
  input: ParkingClaimDecideInput,
): Promise<unknown> {
  const trimmed = claimId.trim()
  if (!trimmed) throw new Error('Claim id is required')

  return apiClient<unknown>(`/parking/claims/${encodeURIComponent(trimmed)}/decide`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function approveParkingClaimLineItem(
  claimId: string,
  lineItemId: string,
): Promise<unknown> {
  const trimmedClaimId = claimId.trim()
  const trimmedLineItemId = lineItemId.trim()
  if (!trimmedClaimId) throw new Error('Claim id is required')
  if (!trimmedLineItemId) throw new Error('Line item id is required')

  return apiClient<unknown>(
    `/parking/claims/${encodeURIComponent(trimmedClaimId)}/logs/${encodeURIComponent(trimmedLineItemId)}/approve-line`,
    { method: 'POST' },
  )
}

export async function returnParkingClaimLineItem(
  claimId: string,
  lineItemId: string,
  input: { remarks: string },
): Promise<unknown> {
  const trimmedClaimId = claimId.trim()
  const trimmedLineItemId = lineItemId.trim()
  if (!trimmedClaimId) throw new Error('Claim id is required')
  if (!trimmedLineItemId) throw new Error('Line item id is required')
  if (!input.remarks.trim()) throw new Error('Remarks are required')

  return apiClient<unknown>(
    `/parking/claims/${encodeURIComponent(trimmedClaimId)}/logs/${encodeURIComponent(trimmedLineItemId)}/return`,
    {
      method: 'POST',
      body: JSON.stringify({
        remarks: input.remarks.trim(),
      }),
    },
  )
}

export function canEditParkingLog(status: ParkingLogStatus): boolean {
  return status === 'PENDING_CONSOLIDATION' || status === 'RETURNED'
}

export function canDeleteParkingLog(status: ParkingLogStatus): boolean {
  return status === 'PENDING_CONSOLIDATION'
}

export function canWithdrawParkingLog(status: ParkingLogStatus): boolean {
  return status === 'RETURNED' 
}
