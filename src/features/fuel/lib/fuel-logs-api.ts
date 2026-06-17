import type { ApiRecord } from '@/features/user/lib/roles-api'
import { fetchUserById, mapUserDetailFields, toText } from '@/features/user/lib/users-api'
import { fetchVehicleById, mapVehicleRecordToListRow } from '@/features/vehicles/lib/vehicles-api'
import { apiClient, apiGet, apiGetBlob, apiPatch } from '@/services/apiClient'
import { extractMasterList, isUuidLike } from '@/shared/lib/organogram-master-lookup'
import { formatFileSizeLabel } from '@/features/trips/lib/trip-form-utils'
import { applyPagination } from '@/shared/utils/pagination'

import type { FuelLogStatus } from '@/features/fuel/lib/fuel-log-mock-data'

export type FuelLogListRow = {
  id: string
  vehicleId: string
  driverId: string
  driver: string
  vehicle: string
  quotaUsed: number
  quotaTotal: number
  date: string
  liters: number
  totalCost: number
  location: string
  odometerKm: number
  receiptFileName: string
  receiptObjectKey: string
  receiptFileSizeLabel?: string
  status: FuelLogStatus
}

export type FuelLogsPageResult = {
  rows: FuelLogListRow[]
  totalCount: number
  totalPages: number
  effectivePageSize: number
  serialBase: number
}

export type CreateFuelLogApiInput = {
  vehicleId: string
  logDate: string
  fuelRefillLiters: number
  totalCost: number
  odometerReading: number
  location: string
  receiptFile: File
}

export type ResubmitFuelLogApiInput = {
  logDate: string
  fuelRefillLiters: number
  totalCost: number
  odometerReading: number
  location: string
  receiptFile?: File | null
}

export type DriverVehicleOption = {
  value: string
  label: string
  description?: string
  searchText?: string
}

export type FuelLogVehicleDetail = {
  id: string
  registrationNumber: string
  makeModel: string
  displayLabel: string
}

export function mapVehicleRecordToFuelLogDetail(
  record: ApiRecord,
  fallbackId?: string,
): FuelLogVehicleDetail {
  const row = mapVehicleRecordToListRow(record)
  const id = row.id || fallbackId?.trim() || ''
  const registrationFromApi = pickVehicleRegistration(record)
  const registrationFromRow =
    row.registration_number !== '—' && !isUuidLike(row.registration_number)
      ? row.registration_number
      : ''
  const registrationNumber = registrationFromApi || registrationFromRow
  const makeModel = row.makeModel !== '—' ? row.makeModel : pickVehicleMakeModel(record)
  const displayLabel =
    registrationNumber && makeModel
      ? `${registrationNumber} (${makeModel})`
      : registrationNumber || makeModel || id || '—'

  return {
    id,
    registrationNumber: registrationNumber || '—',
    makeModel: makeModel || '—',
    displayLabel,
  }
}

export async function fetchFuelLogVehicleDetail(
  vehicleId: string,
): Promise<FuelLogVehicleDetail> {
  const trimmed = vehicleId.trim()
  if (!trimmed) throw new Error('Missing vehicle id')
  const record = await fetchVehicleById(trimmed)
  return mapVehicleRecordToFuelLogDetail(record, trimmed)
}

function vehicleDetailToOption(detail: FuelLogVehicleDetail): DriverVehicleOption {
  return {
    value: detail.id,
    label: detail.displayLabel,
    description: detail.makeModel !== '—' ? detail.makeModel : undefined,
    searchText: [detail.registrationNumber, detail.makeModel, detail.displayLabel, detail.id]
      .filter((part) => part && part !== '—')
      .join(' '),
  }
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
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function basenameFromPath(value: string): string {
  const trimmed = value.trim().split('?')[0]?.trim() ?? ''
  if (!trimmed) return ''
  const parts = trimmed.split(/[/\\]/).filter(Boolean)
  return parts[parts.length - 1] ?? trimmed
}

function normalizeFuelLogStatus(value: unknown): FuelLogStatus {
  const status = toText(value).trim().toUpperCase()
  return status || '—'
}

export function isFuelLogMtoReviewable(status: string): boolean {
  const normalized = status.trim().toUpperCase()
  return normalized === 'PENDING_MTO' || normalized === 'PENDING'
}

export type FuelLogMtoReviewAction = 'approve' | 'reject'

export async function reviewFuelLogMto(
  fuelLogId: string,
  action: FuelLogMtoReviewAction,
  remarks: string,
): Promise<void> {
  const trimmed = fuelLogId.trim()
  const trimmedRemarks = remarks.trim()
  if (!trimmed) throw new Error('Fuel log id is required')
  if (!trimmedRemarks) throw new Error('Remarks are required')

  await apiPatch<unknown, { action: FuelLogMtoReviewAction; remarks: string }>(
    `/fuel/fuel-logs/${encodeURIComponent(trimmed)}/mto-review`,
    { action, remarks: trimmedRemarks },
  )
}

function pickVehicleMakeModel(record: ApiRecord): string {
  const combined = pickScalar(record, [
    'make_model',
    'makeModel',
    'model_name',
    'vehicle_model_name',
    'vehicle_make_model',
  ])
  if (combined) return combined

  const make = pickScalar(record, ['make', 'vehicle_make', 'manufacturer'])
  const model = pickScalar(record, ['model', 'vehicle_model'])
  return [make, model].filter(Boolean).join(' ').trim()
}

function formatVehicleDisplayLabel(record: ApiRecord): {
  label: string
  description?: string
} {
  const registration = pickVehicleRegistration(record)
  const makeModel = pickVehicleMakeModel(record)

  if (registration && makeModel) {
    return {
      label: `${registration} (${makeModel})`,
      description: makeModel,
    }
  }
  if (registration) return { label: registration }
  if (makeModel) return { label: makeModel }
  const fallback = pickScalar(record, ['id', 'vehicle_id', 'vehicleId']) || '—'
  return { label: fallback }
}

function pickVehicleRegistration(record: ApiRecord): string {
  return (
    pickScalar(record, [
      'registration_number',
      'registrationNumber',
      'vehicle_number',
      'vehicleNumber',
      'plate_number',
      'plateNumber',
      'registration_no',
      'registrationNo',
    ]) || ''
  )
}

function pickDriverId(record: ApiRecord): string {
  const driverBlock =
    record.driver && typeof record.driver === 'object' && !Array.isArray(record.driver)
      ? (record.driver as ApiRecord)
      : null
  return (
    pickScalar(record, ['driver_id', 'driverId']) ||
    (driverBlock
      ? pickScalar(driverBlock, ['id', 'driver_id', 'driverId', 'user_id', 'userId'])
      : '') ||
    ''
  )
}

function pickDriverName(record: ApiRecord): string {
  const driver =
    record.driver && typeof record.driver === 'object' && !Array.isArray(record.driver)
      ? (record.driver as ApiRecord)
      : null
  const user =
    record.user && typeof record.user === 'object' && !Array.isArray(record.user)
      ? (record.user as ApiRecord)
      : null
  const merged = { ...record, ...(driver ?? {}), ...(user ?? {}) }
  const firstName = pickScalar(merged, ['first_name', 'firstName'])
  const middleName = pickScalar(merged, ['middle_name', 'middleName'])
  const lastName = pickScalar(merged, ['last_name', 'lastName'])
  return (
    pickScalar(merged, ['driver_name', 'driverName', 'name', 'full_name', 'fullName']) ||
    [firstName, middleName, lastName].filter(Boolean).join(' ').trim() ||
    '—'
  )
}

function extractFuelLogList(payload: unknown): ApiRecord[] {
  const records = extractMasterList(payload)
  if (records.length > 0) return records
  if (!payload || typeof payload !== 'object') return []

  const root = payload as ApiRecord
  const data = root.data
  const dataObj =
    data && typeof data === 'object' && !Array.isArray(data) ? (data as ApiRecord) : null
  const candidates = [
    root.fuel_logs,
    root.fuelLogs,
    dataObj?.fuel_logs,
    dataObj?.fuelLogs,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is ApiRecord => !!item && typeof item === 'object')
    }
  }

  return []
}

function unwrapFuelLogRecord(payload: unknown): ApiRecord | null {
  if (!payload || typeof payload !== 'object') return null
  if (Array.isArray(payload)) {
    const first = payload[0]
    return first && typeof first === 'object' ? (first as ApiRecord) : null
  }
  const root = payload as ApiRecord
  const data = root.data
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as ApiRecord
  }
  return root
}

export function mapFuelLogListRow(record: ApiRecord): FuelLogListRow | null {
  const id = pickScalar(record, ['id', 'fuel_log_id', 'fuelLogId', 'uuid'])
  if (!id) return null

  const vehicleId = pickScalar(record, ['vehicle_id', 'vehicleId'])
  const driverId = pickDriverId(record)
  const receiptObjectKey = pickScalar(record, ['receipt_object_key', 'receiptObjectKey'])
  const receiptPath =
    receiptObjectKey ||
    pickScalar(record, [
      'receipt_path',
      'receiptPath',
      'receipt_file_name',
      'receiptFileName',
      'receipt',
    ])
  const receiptSizeRaw = toNumber(
    record.receipt_file_size ?? record.receiptFileSize ?? record.file_size ?? record.fileSize,
    -1,
  )

  return {
    id,
    vehicleId,
    driverId,
    driver: pickDriverName(record),
    vehicle:
      pickScalar(record, [
        'vehicle_number',
        'vehicleNumber',
        'registration_number',
        'registrationNumber',
        'vehicle_name',
        'vehicleName',
      ]) || vehicleId || '—',
    quotaUsed: toNumber(record.quota_used ?? record.quotaUsed ?? record.used_quota),
    quotaTotal: toNumber(record.quota_total ?? record.quotaTotal ?? record.total_quota, 0),
    date:
      pickScalar(record, ['log_date', 'logDate', 'date', 'fuel_log_date']) ||
      pickScalar(record, ['created_at', 'createdAt']).slice(0, 10),
    liters: toNumber(record.fuel_refill_liters ?? record.fuelRefillLiters ?? record.liters),
    totalCost: toNumber(record.total_cost ?? record.totalCost),
    location: pickScalar(record, ['location']) || '—',
    odometerKm: toNumber(record.odometer_reading ?? record.odometerReading ?? record.odometer),
    receiptFileName: receiptPath ? basenameFromPath(receiptPath) : '',
    receiptObjectKey,
    receiptFileSizeLabel:
      receiptSizeRaw > 0 ? formatFileSizeLabel(receiptSizeRaw) : undefined,
    status: normalizeFuelLogStatus(record.status ?? record.verification_status),
  }
}

async function resolveVehicleLabels(vehicleIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(vehicleIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()

  const entries = await Promise.all(
    uniqueIds.map(async (vehicleId) => {
      try {
        const detail = await fetchFuelLogVehicleDetail(vehicleId)
        return [vehicleId, detail.displayLabel] as const
      } catch {
        return [vehicleId, vehicleId] as const
      }
    }),
  )

  return new Map(entries)
}

async function resolveDriverNames(driverIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(driverIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()

  const entries = await Promise.all(
    uniqueIds.map(async (driverId) => {
      try {
        const record = await fetchUserById(driverId)
        const { name } = mapUserDetailFields(record)
        return [driverId, name && name !== '-' ? name : driverId] as const
      } catch {
        return [driverId, driverId] as const
      }
    }),
  )

  return new Map(entries)
}

async function enrichFuelLogRows(rows: FuelLogListRow[]): Promise<FuelLogListRow[]> {
  const vehicleIds = rows.map((row) => row.vehicleId)
  const driverIds = rows.map((row) => row.driverId)
  const [vehicleLabels, driverLabels] = await Promise.all([
    resolveVehicleLabels(vehicleIds),
    resolveDriverNames(driverIds),
  ])
  return rows.map((row) => ({
    ...row,
    driver:
      row.driver && row.driver !== '—'
        ? row.driver
        : row.driverId
          ? (driverLabels.get(row.driverId) ?? row.driver)
          : row.driver,
    vehicle:
      row.vehicle && row.vehicle !== '—' && row.vehicle !== row.vehicleId
        ? row.vehicle
        : row.vehicleId
          ? (vehicleLabels.get(row.vehicleId) ?? row.vehicle)
          : row.vehicle,
  }))
}

export function fuelLogsListPath(search: string, page: number, pageSize: number): string {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('page_size', String(pageSize))
  const q = search.trim()
  if (q) params.set('search', q)
  return `/fuel/fuel-logs?${params.toString()}`
}

export async function fetchFuelLogsPage(
  search: string,
  page: number,
  pageSize: number,
): Promise<FuelLogsPageResult> {
  const payload = await apiGet<unknown>(fuelLogsListPath(search, page, pageSize))
  const records = extractFuelLogList(payload)
  const mapped = records
    .map((record) => mapFuelLogListRow(record))
    .filter((row): row is FuelLogListRow => row !== null)
  const enrichedRows = await enrichFuelLogRows(mapped)
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

export async function fetchFuelLogById(id: string): Promise<FuelLogListRow | null> {
  const trimmed = id.trim()
  if (!trimmed) return null
  const payload = await apiGet<unknown>(`/fuel/fuel-logs/${encodeURIComponent(trimmed)}`)
  const record = unwrapFuelLogRecord(payload)
  if (!record) return null
  const mapped = mapFuelLogListRow(record)
  if (!mapped) return null
  const [enriched] = await enrichFuelLogRows([mapped])
  return enriched ?? mapped
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

/** GET `/fuel/fuel-logs/{id}/receipt` and open the receipt in the current tab. */
export async function openFuelLogReceipt(
  fuelLogId: string,
  fileName = '',
): Promise<void> {
  const trimmed = fuelLogId.trim()
  if (!trimmed) throw new Error('Fuel log id is required')

  const openInCurrentTab = (url: string) => {
    window.location.assign(url)
  }

  const { blob, contentType } = await apiGetBlob(
    `/fuel/fuel-logs/${encodeURIComponent(trimmed)}/receipt`,
  )

  if (contentType.includes('application/json')) {
    const payload = JSON.parse(await blob.text()) as unknown
    const url = pickReceiptUrlFromPayload(payload)
    if (!url) throw new Error('Receipt URL not found')
    openInCurrentTab(url)
    return
  }

  const mimeType =
    contentType && contentType !== 'application/octet-stream'
      ? contentType
      : guessReceiptMimeType(fileName)
  const fileBlob = mimeType === blob.type ? blob : blob.slice(0, blob.size, mimeType)
  const objectUrl = URL.createObjectURL(fileBlob)
  openInCurrentTab(objectUrl)
}

function buildFuelLogFormData(input: CreateFuelLogApiInput): FormData {
  const form = new FormData()
  form.append('vehicle_id', input.vehicleId)
  form.append('log_date', input.logDate)
  form.append('fuel_refill_liters', String(input.fuelRefillLiters))
  form.append('total_cost', String(input.totalCost))
  form.append('odometer_reading', String(input.odometerReading))
  form.append('location', input.location)
  form.append('receipt', input.receiptFile, input.receiptFile.name)
  return form
}

function buildFuelLogResubmitFormData(input: ResubmitFuelLogApiInput): FormData {
  const form = new FormData()
  form.append('log_date', input.logDate)
  form.append('fuel_refill_liters', String(input.fuelRefillLiters))
  form.append('total_cost', String(input.totalCost))
  form.append('odometer_reading', String(input.odometerReading))
  form.append('location', input.location)
  if (input.receiptFile) {
    form.append('receipt', input.receiptFile, input.receiptFile.name)
  }
  return form
}

export async function createFuelLog(input: CreateFuelLogApiInput): Promise<unknown> {
  return apiClient<unknown>('/fuel/fuel-logs', {
    method: 'POST',
    body: buildFuelLogFormData(input),
  })
}

export async function resubmitFuelLog(
  fuelLogId: string,
  input: ResubmitFuelLogApiInput,
): Promise<unknown> {
  return apiClient<unknown>(`/fuel/fuel-logs/${encodeURIComponent(fuelLogId.trim())}/resubmit`, {
    method: 'PATCH',
    body: buildFuelLogResubmitFormData(input),
  })
}

function pickAssignedVehicleId(record: ApiRecord): string {
  const direct = pickScalar(record, ['vehicle_id', 'vehicleId'])
  if (direct) return direct

  const vehicleBlock =
    record.vehicle && typeof record.vehicle === 'object' && !Array.isArray(record.vehicle)
      ? (record.vehicle as ApiRecord)
      : null
  if (vehicleBlock) {
    const nested = pickScalar(vehicleBlock, ['vehicle_id', 'vehicleId', 'id', 'uuid'])
    if (nested) return nested
  }

  return pickScalar(record, ['id', 'uuid']) || ''
}

function extractDriverVehicleIds(payload: unknown): string[] {
  const idsFromArray = (items: unknown[]): string[] =>
    items
      .map((item) => {
        if (typeof item === 'string') return item.trim()
        if (item && typeof item === 'object') {
          return pickAssignedVehicleId(item as ApiRecord)
        }
        return ''
      })
      .filter(Boolean)

  if (Array.isArray(payload)) {
    return idsFromArray(payload)
  }

  const fromRecords = extractDriverVehicles(payload)
    .map((record) => mapDriverVehicleOption(record))
    .filter((option): option is DriverVehicleOption => option !== null)
    .map((option) => option.value)
  if (fromRecords.length > 0) return fromRecords

  if (!payload || typeof payload !== 'object') return []

  const root = payload as ApiRecord
  const data = root.data
  const dataObj =
    data && typeof data === 'object' && !Array.isArray(data) ? (data as ApiRecord) : null
  const candidates = [
    root.vehicles,
    root.vehicle_ids,
    root.vehicleIds,
    dataObj?.vehicles,
    dataObj?.vehicle_ids,
    dataObj?.vehicleIds,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const ids = idsFromArray(candidate)
      if (ids.length > 0) return ids
    }
  }

  return []
}

function extractDriverVehicles(payload: unknown): ApiRecord[] {
  const records = extractMasterList(payload)
  if (records.length > 0) return records
  if (!payload || typeof payload !== 'object') return []

  const root = payload as ApiRecord
  const data = root.data
  const dataObj =
    data && typeof data === 'object' && !Array.isArray(data) ? (data as ApiRecord) : null
  const candidates = [root.vehicles, dataObj?.vehicles]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is ApiRecord => !!item && typeof item === 'object')
    }
  }

  return []
}

function mapDriverVehicleOption(record: ApiRecord): DriverVehicleOption | null {
  const vehicleBlock =
    record.vehicle && typeof record.vehicle === 'object' && !Array.isArray(record.vehicle)
      ? (record.vehicle as ApiRecord)
      : null
  const vehicle = vehicleBlock ? { ...record, ...vehicleBlock } : record

  const id = pickAssignedVehicleId(record)
  if (!id) return null

  const { label, description } = formatVehicleDisplayLabel(vehicle)
  const makeModel = pickVehicleMakeModel(vehicle)
  const registration = pickVehicleRegistration(vehicle)

  return {
    value: id,
    label,
    description,
    searchText: [registration, makeModel, label, id].filter(Boolean).join(' '),
  }
}

export async function fetchDriverVehicles(driverId: string): Promise<DriverVehicleOption[]> {
  const trimmed = driverId.trim()
  if (!trimmed) return []

  const payload = await apiGet<unknown>(`/drivers/${encodeURIComponent(trimmed)}/vehicles`)
  const vehicleIds = extractDriverVehicleIds(payload)
  if (vehicleIds.length === 0) return []

  const details = await Promise.all(
    vehicleIds.map(async (vehicleId) => {
      try {
        return await fetchFuelLogVehicleDetail(vehicleId)
      } catch {
        return null
      }
    }),
  )

  return details
    .filter((detail): detail is FuelLogVehicleDetail => detail !== null)
    .map(vehicleDetailToOption)
}
