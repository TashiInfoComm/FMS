import { apiGet } from '@/services/apiClient'
import {
  appendReportCommonFilterParams,
  type ReportCommonFilterParams,
} from '@/features/reports/lib/report-common-filters'
import {
  extractVehicleList,
  mapVehicleRecordToReportRow,
  type VehicleReportRow,
} from '@/features/vehicles/lib/vehicles-api'
import { extractMasterList, isUuidLike } from '@/shared/lib/organogram-master-lookup'
import { applyPagination } from '@/shared/utils/pagination'

type ApiRecord = Record<string, unknown>

/** One make/model group in the performance comparison (charts + table share these rows). */
export type VehicleModelEfficiencyRow = {
  id: string
  make: string
  model: string
  /** `Mahindra Bolero` for the table. */
  makeModel: string
  /** `Bolero` for the chart axis, where space is tight. */
  shortLabel: string
  fleetCount: number
  fuelEfficiencyKmPerL: number
  costPerKmNu: number
  avgMaintenanceCostNu: number
}

export type VehicleReportsPageResult = {
  rows: VehicleReportRow[]
  totalCount: number
  totalPages: number
  effectivePageSize: number
  serialBase: number
}

export type VehicleReportListQuery = {
  page: number
  pageSize: number
  search?: string
  common: ReportCommonFilterParams
}

function buildVehicleReportPath(query: VehicleReportListQuery): string {
  const params = new URLSearchParams()
  params.set('page', String(query.page))
  params.set('page_size', String(query.pageSize))

  const search = query.search?.trim()
  if (search) params.set('search', search)

  appendReportCommonFilterParams(params, query.common)

  return `/vehicles?${params.toString()}`
}

/**
 * `GET /vehicles`
 * Vehicle inventory report — same list endpoint and mapping as vehicle management.
 */
export async function fetchVehicleReportPage(
  query: VehicleReportListQuery,
): Promise<VehicleReportsPageResult> {
  const payload = await apiGet<unknown>(buildVehicleReportPath(query))
  const rows = extractVehicleList(payload)
    .map((record) => mapVehicleRecordToReportRow(record))
    .filter((row) => Boolean(row.id.trim()) && isUuidLike(row.id))

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

function toText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
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
    const value = record[key]
    if (value === null || value === undefined || value === '') continue
    const parsed = typeof value === 'number' ? value : Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

/** Drops the make from `Mahindra Bolero` so the chart axis stays legible. */
function toShortModelLabel(make: string, model: string, makeModel: string): string {
  if (model) return model
  if (make && makeModel.toLowerCase().startsWith(make.toLowerCase())) {
    const stripped = makeModel.slice(make.length).trim()
    if (stripped) return stripped
  }
  return makeModel
}

function mapModelEfficiencyRow(
  record: ApiRecord,
  index: number,
): VehicleModelEfficiencyRow | null {
  const make = pickScalar(record, ['make', 'vehicle_make', 'vehicleMake', 'manufacturer', 'brand'])
  const model = pickScalar(record, ['model', 'vehicle_model', 'vehicleModel', 'model_name', 'modelName'])
  const combined =
    pickScalar(record, ['make_model', 'makeModel', 'label', 'name']) ||
    [make, model].filter(Boolean).join(' ')

  if (!combined) return null

  return {
    id: pickScalar(record, ['id', 'model_id', 'modelId']) || `${combined}-${index}`,
    make,
    model,
    makeModel: combined,
    shortLabel: toShortModelLabel(make, model, combined),
    fleetCount: pickNumber(record, [
      'fleet',
      'fleet_size',
      'fleetSize',
      'fleet_count',
      'fleetCount',
      'vehicle_count',
      'vehicleCount',
      'total_vehicles',
      'totalVehicles',
      'count',
    ]),
    fuelEfficiencyKmPerL: pickNumber(record, [
      'fuel_efficiency',
      'fuelEfficiency',
      'fuel_efficiency_km_per_l',
      'fuelEfficiencyKmPerL',
      'avg_km_per_l',
      'avgKmPerL',
      'avg_km_per_liter',
      'km_per_liter',
      'kmPerLiter',
      'km_per_litre',
      'kmpl',
      'efficiency',
      'avg_efficiency',
      'avgEfficiency',
    ]),
    costPerKmNu: pickNumber(record, [
      'cost_per_km',
      'costPerKm',
      'running_cost_per_km',
      'runningCostPerKm',
      'cost_per_kilometer',
      'fuel_cost_per_km',
      'fuelCostPerKm',
    ]),
    avgMaintenanceCostNu: pickNumber(record, [
      'avg_maintenance_cost',
      'avgMaintenanceCost',
      'average_maintenance_cost',
      'averageMaintenanceCost',
      'avg_maint_cost',
      'avgMaintCost',
      'maintenance_cost',
      'maintenanceCost',
    ]),
  }
}

/** `extractMasterList` misses payloads keyed by the report's own noun. */
function extractModelEfficiencyList(payload: unknown): ApiRecord[] {
  const rows = extractMasterList(payload)
  if (rows.length > 0) return rows

  if (!payload || typeof payload !== 'object') return []
  const root = payload as ApiRecord
  const data = (root.data && typeof root.data === 'object' ? root.data : null) as ApiRecord | null
  const candidates = [
    root.models,
    root.by_model,
    root.byModel,
    root.efficiency,
    data?.models,
    data?.by_model,
    data?.byModel,
    data?.efficiency,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is ApiRecord => Boolean(item) && typeof item === 'object')
    }
  }
  return []
}

/**
 * `GET /reports/vehicles/efficiency-by-model`
 * Fleet-wide efficiency, running cost and maintenance cost grouped by make/model.
 */
export async function fetchVehicleEfficiencyByModel(
  common: ReportCommonFilterParams,
): Promise<VehicleModelEfficiencyRow[]> {
  const params = new URLSearchParams()
  appendReportCommonFilterParams(params, common)
  const query = params.toString()
  const payload = await apiGet<unknown>(
    `/fuel/reports/vehicles/efficiency-by-model${query ? `?${query}` : ''}`,
  )

  return extractModelEfficiencyList(payload)
    .map((record, index) => mapModelEfficiencyRow(record, index))
    .filter((row): row is VehicleModelEfficiencyRow => row !== null)
}

export function formatKmPerL(value: number): string {
  return value.toLocaleString('en-BT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

export function formatReportNu(value: number): string {
  return `Nu ${value.toLocaleString('en-BT', { maximumFractionDigits: 0 })}`
}

/** Axis ticks only have room for `Nu 75.0K`, not the full figure. */
export function formatCompactNu(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `Nu ${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `Nu ${(value / 1_000).toFixed(1)}K`
  return `Nu ${value.toLocaleString('en-BT', { maximumFractionDigits: 0 })}`
}

export type { VehicleReportRow }
