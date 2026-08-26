import { apiGet, apiGetBlob } from '@/services/apiClient'
import {
  appendReportCommonFilterParams,
  type ReportCommonFilterParams,
} from '@/features/reports/lib/report-common-filters'
import { extractMasterList } from '@/shared/lib/organogram-master-lookup'
import { applyPagination } from '@/shared/utils/pagination'

type ApiRecord = Record<string, unknown>

export type FuelConsumptionReportRow = {
  id: string
  model: string
  make: string
  /** `registration_number (make, model)` for table display. */
  vehicleLabel: string
  fuelUsedL: number
  fuelCostNu: number
  avgKmPerL: number
  costPerKmNu: number
  registrationNumber: string
}

export type FuelQuotaReportRow = {
  id: string
  model: string
  make: string
  /** `registration_number (make, model)` for table display. */
  vehicleLabel: string
  allocatedL: number
  usedL: number
  remainingL: number
  utilizationPct: number
  registrationNumber: string
}

export type FuelReportsPageResult<T> = {
  rows: T[]
  totalCount: number
  totalPages: number
  effectivePageSize: number
  serialBase: number
}

export type FuelReportListQuery = {
  page: number
  pageSize: number
  search?: string
  common: ReportCommonFilterParams
}

export type FuelReportExportFormat = 'xlsx' | 'pdf'

export type FuelReportExportTab = 'consumption' | 'quota'

export type FuelReportExportQuery = {
  tab: FuelReportExportTab
  format: FuelReportExportFormat
  search?: string
  common: ReportCommonFilterParams
}

function nestedRecord(value: unknown): ApiRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as ApiRecord
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function pickScalar(record: ApiRecord, keys: string[]): string {
  for (const key of keys) {
    const text = toText(record[key])
    if (text) return text
  }
  return ''
}

function pickNumber(record: ApiRecord, keys: string[], fallback = 0): number {
  for (const key of keys) {
    if (record[key] === null || record[key] === undefined || record[key] === '') continue
    const parsed = toNumber(record[key], Number.NaN)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function pickMake(record: ApiRecord): string {
  const vehicle = nestedRecord(record.vehicle)
  return (
    pickScalar(record, ['make', 'vehicle_make', 'vehicleMake']) ||
    (vehicle ? pickScalar(vehicle, ['make', 'vehicle_make', 'vehicleMake']) : '')
  )
}

function pickModelOnly(record: ApiRecord): string {
  const vehicle = nestedRecord(record.vehicle)
  return (
    pickScalar(record, ['model', 'vehicle_model', 'vehicleModel']) ||
    (vehicle ? pickScalar(vehicle, ['model', 'vehicle_model', 'vehicleModel']) : '')
  )
}

function pickModel(record: ApiRecord): string {
  const make = pickMake(record)
  const model = pickModelOnly(record)
  if (make && model) return `${make} ${model}`
  if (model) return model
  const vehicle = nestedRecord(record.vehicle)
  if (vehicle) {
    const nestedModel = pickScalar(vehicle, ['make_model', 'makeModel', 'name'])
    if (nestedModel) return nestedModel
  }
  return (
    pickScalar(record, ['make_model', 'makeModel', 'vehicle_name', 'vehicleName']) ||
    make ||
    '—'
  )
}

/** `BG-1-A2584 (Mahindra, Bolero)` — falls back gracefully when parts are missing. */
export function formatFuelVehicleLabel(
  registrationNumber: string,
  make: string,
  model: string,
): string {
  const registration = registrationNumber.trim()
  const parts = [make.trim(), model.trim()].filter(Boolean)
  if (registration && parts.length > 0) return `${registration} (${parts.join(', ')})`
  if (registration) return registration
  if (parts.length > 0) return parts.join(', ')
  return '—'
}

function pickRegistration(record: ApiRecord): string {
  const vehicle = nestedRecord(record.vehicle)
  return (
    pickScalar(record, [
      'registration_number',
      'registrationNumber',
      'vehicle_registration_number',
      'plate_number',
      'plateNumber',
    ]) ||
    (vehicle
      ? pickScalar(vehicle, ['registration_number', 'registrationNumber', 'plate_number'])
      : '')
  )
}

function pickId(record: ApiRecord): string {
  const vehicle = nestedRecord(record.vehicle)
  return (
    pickScalar(record, ['id', 'vehicle_id', 'vehicleId', 'report_id', 'reportId']) ||
    (vehicle ? pickScalar(vehicle, ['id', 'vehicle_id', 'vehicleId']) : '')
  )
}

function mapConsumptionRow(record: ApiRecord): FuelConsumptionReportRow | null {
  const id = pickId(record)
  if (!id) return null
  const fuelUsedL = pickNumber(record, [
    'total_fuel_used_liters',
    'totalFuelUsedLiters',
    'fuel_used',
    'fuelUsed',
    'fuel_used_liters',
    'fuelUsedLiters',
    'liters_used',
    'litersUsed',
    'total_liters',
    'totalLiters',
    'liters',
  ])
  const fuelCostNu = pickNumber(record, [
    'total_fuel_cost',
    'totalFuelCost',
    'fuel_cost',
    'fuelCost',
    'total_cost',
    'totalCost',
    'cost',
  ])
  const avgKmPerL = pickNumber(record, [
    'avg_km_per_liter',
    'avgKmPerLiter',
    'avg_km_per_l',
    'avgKmPerL',
    'average_km_per_l',
    'averageKmPerL',
    'km_per_liter',
    'kmPerLiter',
    'efficiency',
  ])
  const costPerKmFromApi = pickNumber(
    record,
    ['cost_per_km', 'costPerKm', 'avg_cost_per_km', 'avgCostPerKm'],
    Number.NaN,
  )
  const distanceKm = fuelUsedL * avgKmPerL
  const costPerKmNu = Number.isFinite(costPerKmFromApi)
    ? costPerKmFromApi
    : distanceKm > 0
      ? fuelCostNu / distanceKm
      : 0

  return {
    id,
    make: pickMake(record),
    model: pickModelOnly(record) || pickModel(record),
    registrationNumber: pickRegistration(record),
    vehicleLabel: formatFuelVehicleLabel(
      pickRegistration(record),
      pickMake(record),
      pickModelOnly(record),
    ),
    fuelUsedL,
    fuelCostNu,
    avgKmPerL,
    costPerKmNu,
  }
}

function mapQuotaRow(record: ApiRecord): FuelQuotaReportRow | null {
  const id = pickId(record)
  if (!id) return null
  const allocatedL = pickNumber(record, [
    'allocated',
    'allocated_liters',
    'allocatedLiters',
    'quota_allocated',
    'quotaAllocated',
    'ceiling_amount',
    'ceilingAmount',
    'total_quota',
    'totalQuota',
    'quota_total',
    'quotaTotal',
  ])
  const usedFromApi = pickNumber(
    record,
    [
      'used',
      'used_liters',
      'usedLiters',
      'quota_used',
      'quotaUsed',
      'fuel_used',
      'fuelUsed',
    ],
    Number.NaN,
  )
  const remainingFromApi = pickNumber(
    record,
    ['remaining', 'remaining_liters', 'remainingLiters', 'quota_remaining', 'quotaRemaining'],
    Number.NaN,
  )
  const remainingL = Number.isFinite(remainingFromApi)
    ? remainingFromApi
    : Number.isFinite(usedFromApi)
      ? Math.max(0, allocatedL - usedFromApi)
      : allocatedL
  const usedL = Number.isFinite(usedFromApi)
    ? usedFromApi
    : Math.max(0, allocatedL - remainingL)
  const utilizationFromApi = pickNumber(
    record,
    ['utilization', 'utilization_pct', 'utilizationPct', 'usage_percent', 'usagePercent'],
    Number.NaN,
  )
  const utilizationPct = Number.isFinite(utilizationFromApi)
    ? utilizationFromApi
    : allocatedL > 0
      ? (usedL / allocatedL) * 100
      : 0

  return {
    id,
    make: pickMake(record),
    model: pickModelOnly(record) || pickModel(record),
    registrationNumber: pickRegistration(record),
    vehicleLabel: formatFuelVehicleLabel(
      pickRegistration(record),
      pickMake(record),
      pickModelOnly(record),
    ),
    allocatedL,
    usedL,
    remainingL,
    utilizationPct,
  }
}

function buildFuelReportPath(basePath: string, query: FuelReportListQuery): string {
  const params = new URLSearchParams()
  params.set('page', String(query.page))
  params.set('page_size', String(query.pageSize))
  appendReportCommonFilterParams(params, query.common)
  const search = query.search?.trim()
  if (search) params.set('search', search)
  return `${basePath}?${params.toString()}`
}

/** `GET /fuel/reports/vehicles` — consumption report per vehicle. */
export async function fetchFuelConsumptionReportPage(
  query: FuelReportListQuery,
): Promise<FuelReportsPageResult<FuelConsumptionReportRow>> {
  const payload = await apiGet<unknown>(buildFuelReportPath('/fuel/reports/vehicles', query))
  const rows = extractMasterList(payload)
    .map((record) => mapConsumptionRow(record))
    .filter((row): row is FuelConsumptionReportRow => row !== null)
  const paged = applyPagination(payload, rows, query.page, query.pageSize, {
    page: query.page,
    pageSize: query.pageSize,
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

/** `GET /fuel/reports/vehicles/quota` — quota report per vehicle. */
export async function fetchFuelQuotaReportPage(
  query: FuelReportListQuery,
): Promise<FuelReportsPageResult<FuelQuotaReportRow>> {
  const payload = await apiGet<unknown>(buildFuelReportPath('/fuel/reports/vehicles/quota', query))
  const rows = extractMasterList(payload)
    .map((record) => mapQuotaRow(record))
    .filter((row): row is FuelQuotaReportRow => row !== null)
  const paged = applyPagination(payload, rows, query.page, query.pageSize, {
    page: query.page,
    pageSize: query.pageSize,
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

function buildFuelExportPath(query: FuelReportExportQuery): string {
  const basePath =
    query.tab === 'quota' ? '/fuel/reports/vehicles/quota' : '/fuel/reports/vehicles'
  const params = new URLSearchParams()
  params.set('format', query.format)
  appendReportCommonFilterParams(params, query.common)
  const search = query.search?.trim()
  if (search) params.set('search', search)
  return `${basePath}?${params.toString()}`
}

function fileNameFromContentDisposition(header: string, fallback: string): string {
  if (!header) return fallback

  const utf8 = header.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim().replace(/^["']|["']$/g, ''))
    } catch {
      // Keep looking at the plain filename= form.
    }
  }

  const quoted = header.match(/filename="([^"]+)"/i)
  if (quoted?.[1]) return quoted[1]

  const plain = header.match(/filename=([^;]+)/i)
  if (plain?.[1]) return plain[1].trim().replace(/^["']|["']$/g, '')

  return fallback
}

function pickExportFileUrl(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const root = payload as ApiRecord
  const data = nestedRecord(root.data)
  const source = data ?? root
  return pickScalar(source, [
    'url',
    'download_url',
    'downloadUrl',
    'file_url',
    'fileUrl',
    'signed_url',
    'signedUrl',
  ])
}

function triggerBrowserDownload(href: string, fileName: string) {
  const link = document.createElement('a')
  link.href = href
  link.download = fileName
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

/**
 * Same list endpoints as the active Fuel Reports tab:
 * `GET /fuel/reports/vehicles?format=xlsx|pdf`
 * `GET /fuel/reports/vehicles/quota?format=xlsx|pdf`
 */
export async function exportFuelReport(query: FuelReportExportQuery): Promise<void> {
  const { blob, contentType, contentDisposition } = await apiGetBlob(buildFuelExportPath(query))
  const extension = query.format === 'pdf' ? 'pdf' : 'xlsx'
  const fallbackName = `fuel-${query.tab}-report.${extension}`

  if (contentType.includes('application/json')) {
    let payload: unknown
    try {
      payload = JSON.parse(await blob.text()) as unknown
    } catch {
      throw new Error('Could not export fuel report.')
    }
    const fileUrl = pickExportFileUrl(payload)
    if (!fileUrl) throw new Error('Export file URL was not returned.')
    triggerBrowserDownload(fileUrl, fallbackName)
    return
  }

  const fileName = fileNameFromContentDisposition(contentDisposition, fallbackName)
  const objectUrl = URL.createObjectURL(blob)
  triggerBrowserDownload(objectUrl, fileName)
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
}

export function formatFuelLiters(value: number): string {
  return `${value.toLocaleString('en-BT')} L`
}

export function formatFuelNu(value: number): string {
  return `Nu ${value.toLocaleString('en-BT')}`
}

export function formatAvgKmPerL(value: number): string {
  return value.toLocaleString('en-BT', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}
