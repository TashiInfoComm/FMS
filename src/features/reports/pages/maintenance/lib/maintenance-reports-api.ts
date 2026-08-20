import { apiGet } from '@/services/apiClient'
import { fetchMaintenanceTypes } from '@/features/maintenance/lib/maintenance-masters-api'
import {
  appendReportCommonFilterParams,
  type ReportCommonFilterParams,
} from '@/features/reports/lib/report-common-filters'
import { extractMasterList } from '@/shared/lib/organogram-master-lookup'
import { applyPagination } from '@/shared/utils/pagination'

type ApiRecord = Record<string, unknown>

export type MaintenanceReportSlice = {
  key: string
  label: string
  value: number
}

export type MaintenanceReportSummary = {
  total: number | null
  openCount: number | null
  byPriority: MaintenanceReportSlice[]
  byStatus: MaintenanceReportSlice[]
  byTriggerType: MaintenanceReportSlice[]
}

export type MaintenanceReportRow = {
  id: string
  workOrderNumber: string
  vehicle: string
  model: string
  type: string
  priority: string
  triggerType: string
  status: string
  date: string
  estimatedCost: number | null
  actualCost: number | null
  driver: string
  isMajorRepair: boolean
}

export type MaintenanceReportsPageResult = {
  rows: MaintenanceReportRow[]
  totalCount: number
  totalPages: number
  effectivePageSize: number
  serialBase: number
}

export type MaintenanceReportListQuery = {
  page: number
  pageSize: number
  search?: string
  type?: string
  status?: string
  common: ReportCommonFilterParams
}

const LABEL_ACRONYMS = new Set(['id', 'mto', 'wo'])

function nestedRecord(value: unknown): ApiRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as ApiRecord
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/,/g, ''))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function pickScalar(record: ApiRecord, keys: string[]): string {
  for (const key of keys) {
    const text = toText(record[key])
    if (text) return text
  }
  return ''
}

function pickNumber(record: ApiRecord, keys: string[]): number | null {
  for (const key of keys) {
    if (record[key] === null || record[key] === undefined || record[key] === '') continue
    const parsed = toNumber(record[key])
    if (parsed !== null) return parsed
  }
  return null
}

export function toMaintenanceDisplayLabel(raw: string): string {
  const spaced = raw.replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim()
  if (!spaced) return raw || '—'
  return spaced
    .split(/\s+/)
    .map((word) =>
      LABEL_ACRONYMS.has(word.toLowerCase())
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join(' ')
}

function toDateLabel(value: string): string {
  const iso = value.match(/^(\d{4}-\d{2}-\d{2})/)
  if (iso) return iso[1]
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return value || '—'
  const date = new Date(parsed)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function recordToSlices(source: unknown): MaintenanceReportSlice[] {
  const record = nestedRecord(source)
  if (!record) return []

  return Object.entries(record)
    .map(([key, raw]) => {
      const value = toNumber(raw)
      if (value === null) return null
      return { key, label: toMaintenanceDisplayLabel(key), value }
    })
    .filter((slice): slice is MaintenanceReportSlice => slice !== null)
}

function extractSummaryRecord(payload: unknown): ApiRecord | null {
  if (!payload || typeof payload !== 'object') return null
  const root = payload as ApiRecord
  const data = nestedRecord(root.data)
  return nestedRecord(root.summary) ?? nestedRecord(data?.summary) ?? data ?? nestedRecord(payload)
}

function extractWorkOrderList(payload: unknown): ApiRecord[] {
  const records = extractMasterList(payload)
  if (records.length > 0) return records

  if (!payload || typeof payload !== 'object') return []
  const root = payload as ApiRecord
  const data = nestedRecord(root.data)
  const candidates = [root.work_orders, root.workOrders, data?.work_orders, data?.workOrders]

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue
    return candidate.filter(
      (item): item is ApiRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item),
    )
  }

  return []
}

function pickVehicleBlock(record: ApiRecord): ApiRecord {
  return nestedRecord(record.vehicle) ?? nestedRecord(record.assigned_vehicle) ?? record
}

function pickVehiclePlate(record: ApiRecord): string {
  const vehicle = pickVehicleBlock(record)
  return (
    pickScalar(record, [
      'vehicle_registration',
      'vehicleRegistration',
      'registration_number',
      'vehicle_number',
    ]) ||
    pickScalar(vehicle, [
      'registration_number',
      'registrationNumber',
      'plate_number',
      'plateNumber',
      'vehicle_number',
    ])
  )
}

function pickVehicleModel(record: ApiRecord): string {
  const vehicle = pickVehicleBlock(record)
  const make = pickScalar(vehicle, ['make', 'manufacturer', 'brand']) || pickScalar(record, ['make'])
  const model =
    pickScalar(vehicle, ['model', 'vehicle_model', 'name']) ||
    pickScalar(record, ['vehicle_model', 'vehicleModel', 'model'])
  if (make && model && !model.toLowerCase().includes(make.toLowerCase())) return `${make} ${model}`
  return model || make
}

function pickDriverName(record: ApiRecord): string {
  const driver =
    nestedRecord(record.driver_detail) ??
    nestedRecord(record.driverDetail) ??
    nestedRecord(record.driver)
  return (
    (driver
      ? pickScalar(driver, ['name', 'full_name', 'fullName', 'driver_name', 'driverName'])
      : '') ||
    pickScalar(record, ['driver_name', 'driverName'])
  )
}

function mapWorkOrderReportRow(
  record: ApiRecord,
  typeLookup: Map<string, string>,
): MaintenanceReportRow | null {
  const id = pickScalar(record, ['id', 'work_order_id', 'workOrderId'])
  if (!id) return null

  const typeId = pickScalar(record, ['maintenance_type_id', 'maintenanceTypeId'])
  const typeFromRecord =
    pickScalar(record, [
      'maintenance_type_name',
      'maintenanceTypeName',
      'maintenance_type',
      'maintenanceType',
    ]) || typeLookup.get(typeId)

  const createdAt = pickScalar(record, ['created_at', 'createdAt', 'service_date', 'serviceDate'])

  return {
    id,
    workOrderNumber:
      pickScalar(record, ['work_order_number', 'workOrderNumber', 'work_order_no', 'reference_no']) ||
      id,
    vehicle: pickVehiclePlate(record) || '—',
    model: pickVehicleModel(record) || '—',
    type: typeFromRecord || (record.is_major_repair === true ? 'Major' : '—'),
    priority: pickScalar(record, ['priority']) || '—',
    triggerType: pickScalar(record, ['trigger_type', 'triggerType']) || '—',
    status: pickScalar(record, ['status', 'work_order_status', 'workOrderStatus']) || '—',
    date: createdAt ? toDateLabel(createdAt) : '—',
    estimatedCost: pickNumber(record, ['estimated_cost', 'estimatedCost']),
    actualCost: pickNumber(record, ['actual_cost', 'actualCost']),
    driver: pickDriverName(record) || '—',
    isMajorRepair: record.is_major_repair === true || record.isMajorRepair === true,
  }
}

function buildFilterParams(
  searchParams: URLSearchParams,
  query: Pick<MaintenanceReportListQuery, 'search' | 'type' | 'status' | 'common'>,
) {
  const search = query.search?.trim()
  if (search) searchParams.set('search', search)

  const type = query.type?.trim()
  if (type) searchParams.set('maintenance_type_id', type)

  const status = query.status?.trim()
  if (status) searchParams.set('status', status)

  appendReportCommonFilterParams(searchParams, query.common)
}

/** `GET /maintenance/reports` — summary counts by priority, status and trigger type. */
export async function fetchMaintenanceReportSummary(
  common: ReportCommonFilterParams,
): Promise<MaintenanceReportSummary> {
  const params = new URLSearchParams()
  appendReportCommonFilterParams(params, common)
  const query = params.toString()
  const payload = await apiGet<unknown>(
    query ? `/maintenance/reports?${query}` : '/maintenance/reports',
  )
  const summary = extractSummaryRecord(payload)

  return {
    total: summary ? pickNumber(summary, ['total', 'total_count', 'totalCount']) : null,
    openCount: summary ? pickNumber(summary, ['open_count', 'openCount']) : null,
    byPriority: recordToSlices(summary?.by_priority ?? summary?.byPriority),
    byStatus: recordToSlices(summary?.by_status ?? summary?.byStatus),
    byTriggerType: recordToSlices(summary?.by_trigger_type ?? summary?.byTriggerType),
  }
}

/** `GET /maintenance/work-orders` — report list rows. */
export async function fetchMaintenanceWorkOrdersPage(
  query: MaintenanceReportListQuery,
): Promise<MaintenanceReportsPageResult> {
  const params = new URLSearchParams()
  params.set('page', String(query.page))
  params.set('page_size', String(query.pageSize))
  buildFilterParams(params, query)

  const payload = await apiGet<unknown>(`/maintenance/work-orders?${params.toString()}`)
  const records = extractWorkOrderList(payload)

  let typeLookup = new Map<string, string>()
  try {
    const types = await fetchMaintenanceTypes()
    typeLookup = new Map(types.map((option) => [option.value, option.label]))
  } catch {
    typeLookup = new Map()
  }

  const rows = records
    .map((record) => mapWorkOrderReportRow(record, typeLookup))
    .filter((row): row is MaintenanceReportRow => row !== null)

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

export function formatMaintenanceReportAmount(amount: number | null): string {
  if (amount === null) return '—'
  return `Nu ${amount.toLocaleString('en-BT', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}
