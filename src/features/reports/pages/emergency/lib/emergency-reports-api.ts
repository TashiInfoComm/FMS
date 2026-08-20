import { apiGet } from '@/services/apiClient'
import {
  appendReportCommonFilterParams,
  type ReportCommonFilterParams,
} from '@/features/reports/lib/report-common-filters'
import { extractMasterList } from '@/shared/lib/organogram-master-lookup'
import { getPageRows } from '@/shared/utils/pagination'

type ApiRecord = Record<string, unknown>

export type EmergencyMtoActivityReportRow = {
  id: string
  mtoUserId: string
  mtoName: string
  agencyId: string
  agencyName: string
  deployedCount: number
  declinedCount: number
  escalationCount: number
  /** Average response time in minutes when numeric from API. */
  avgResponseTimeMinutes: number | null
  /** Raw display string when API sends a preformatted duration. */
  avgResponseTimeLabel: string
}

export type EmergencyDeploymentByVehicleTypeRow = {
  id: string
  vehicleTypeId: string
  vehicleTypeName: string
  deploymentCount: number
}

export type EmergencyDeploymentsSummary = {
  avgDeploymentDurationMinutes: number | null
  totalDeployments: number
  currentlyActive: number
  released: number
}

export type EmergencyReportsPageResult<T> = {
  rows: T[]
  totalCount: number
  totalPages: number
  effectivePageSize: number
  serialBase: number
}

export type EmergencyDeploymentsReportResult =
  EmergencyReportsPageResult<EmergencyDeploymentByVehicleTypeRow> & {
    summary: EmergencyDeploymentsSummary
  }

export type EmergencyReportListQuery = {
  page: number
  pageSize: number
  search?: string
  common: ReportCommonFilterParams
}

const EMPTY_DEPLOYMENTS_SUMMARY: EmergencyDeploymentsSummary = {
  avgDeploymentDurationMinutes: null,
  totalDeployments: 0,
  currentlyActive: 0,
  released: 0,
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

function pickNullableNumber(record: ApiRecord, keys: string[]): number | null {
  for (const key of keys) {
    if (record[key] === null || record[key] === undefined || record[key] === '') continue
    const parsed = toNumber(record[key], Number.NaN)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function pickAvgResponseTime(record: ApiRecord): {
  minutes: number | null
  label: string
} {
  const nested =
    nestedRecord(record.avg_response_time) ??
    nestedRecord(record.average_response_time) ??
    nestedRecord(record.avgResponseTime) ??
    nestedRecord(record.averageResponseTime)

  const label = pickScalar(record, [
    'avg_response_time_label',
    'average_response_time_label',
    'avgResponseTimeLabel',
    'averageResponseTimeLabel',
    'avg_response_time_display',
    'response_time_display',
  ])

  const minutesDirect = pickNullableNumber(record, [
    'avg_response_minutes',
    'average_response_minutes',
    'avgResponseMinutes',
    'averageResponseMinutes',
  ])
  if (minutesDirect != null) {
    return { minutes: minutesDirect, label }
  }

  if (nested) {
    const nestedMinutes = pickNullableNumber(nested, [
      'minutes',
      'avg_minutes',
      'average_minutes',
      'avgMinutes',
    ])
    if (nestedMinutes != null) {
      const nestedLabel = pickScalar(nested, ['label', 'display', 'formatted', 'text'])
      return { minutes: nestedMinutes, label: nestedLabel || label }
    }

    const nestedSeconds = pickNullableNumber(nested, ['seconds', 'value', 'avg', 'average'])
    if (nestedSeconds != null) {
      const nestedLabel = pickScalar(nested, ['label', 'display', 'formatted', 'text'])
      return { minutes: nestedSeconds / 60, label: nestedLabel || label }
    }
  }

  const seconds = pickNullableNumber(record, [
    'avg_response_time_seconds',
    'average_response_time_seconds',
    'avgResponseTimeSeconds',
    'averageResponseTimeSeconds',
  ])
  if (seconds != null) {
    return { minutes: seconds / 60, label }
  }

  const raw =
    record.avg_response_time ??
    record.average_response_time ??
    record.avgResponseTime ??
    record.averageResponseTime
  if (typeof raw === 'string' && raw.trim() && !Number.isFinite(Number(raw))) {
    return { minutes: null, label: raw.trim() }
  }

  const minutes = pickNullableNumber(record, [
    'avg_response_time',
    'average_response_time',
    'avgResponseTime',
    'averageResponseTime',
    'response_time_avg',
    'responseTimeAvg',
  ])

  return { minutes, label }
}

function mapMtoActivityRow(record: ApiRecord): EmergencyMtoActivityReportRow | null {
  const nestedUser =
    nestedRecord(record.mto) ??
    nestedRecord(record.mto_user) ??
    nestedRecord(record.mtoUser) ??
    nestedRecord(record.user)
  const nestedAgency = nestedRecord(record.agency)

  const mtoUserId =
    pickScalar(record, ['mto_user_id', 'mtoUserId', 'user_id', 'userId', 'id']) ||
    (nestedUser ? pickScalar(nestedUser, ['id', 'user_id', 'userId']) : '')
  if (!mtoUserId) return null

  const mtoName =
    pickScalar(record, [
      'mto_name',
      'mtoName',
      'mto_user_name',
      'mtoUserName',
      'user_name',
      'userName',
      'full_name',
      'fullName',
      'name',
    ]) ||
    (nestedUser
      ? pickScalar(nestedUser, [
          'full_name',
          'fullName',
          'name',
          'display_name',
          'displayName',
          'username',
        ])
      : '') ||
    mtoUserId

  const agencyId =
    pickScalar(record, ['agency_id', 'agencyId']) ||
    (nestedAgency ? pickScalar(nestedAgency, ['id', 'agency_id', 'agencyId']) : '')

  const agencyName =
    pickScalar(record, ['agency_name', 'agencyName', 'agency']) ||
    (nestedAgency ? pickScalar(nestedAgency, ['name', 'code', 'label']) : '') ||
    '—'

  const avg = pickAvgResponseTime(record)

  return {
    id: mtoUserId,
    mtoUserId,
    mtoName,
    agencyId,
    agencyName,
    deployedCount: pickNumber(record, [
      'deployed_count',
      'deployedCount',
      'deploy_count',
      'deployCount',
      'deployments',
    ]),
    declinedCount: pickNumber(record, [
      'declined_count',
      'declinedCount',
      'decline_count',
      'declineCount',
      'declines',
    ]),
    escalationCount: pickNumber(record, [
      'escalation_count',
      'escalationCount',
      'escalations',
      'escalated_count',
      'escalatedCount',
    ]),
    avgResponseTimeMinutes: avg.minutes,
    avgResponseTimeLabel: avg.label,
  }
}

function mapVehicleTypeDeploymentRow(
  record: ApiRecord,
  index: number,
): EmergencyDeploymentByVehicleTypeRow | null {
  const vehicleTypeId =
    pickScalar(record, ['vehicle_type_id', 'vehicleTypeId', 'id']) || `vehicle-type-${index + 1}`
  const vehicleTypeName =
    pickScalar(record, [
      'vehicle_type_name',
      'vehicleTypeName',
      'name',
      'label',
      'type_name',
      'typeName',
    ]) || '—'
  const deploymentCount = pickNumber(record, [
    'deployment_count',
    'deploymentCount',
    'deployments',
    'count',
  ])

  if (!pickScalar(record, ['vehicle_type_id', 'vehicleTypeId', 'id']) && vehicleTypeName === '—') {
    return null
  }

  return {
    id: vehicleTypeId,
    vehicleTypeId,
    vehicleTypeName,
    deploymentCount,
  }
}

function matchesMtoSearch(row: EmergencyMtoActivityReportRow, search: string): boolean {
  const q = search.trim().toLowerCase()
  if (!q) return true
  return [row.mtoName, row.agencyName, row.mtoUserId].some((value) =>
    value.toLowerCase().includes(q),
  )
}

function matchesVehicleTypeSearch(
  row: EmergencyDeploymentByVehicleTypeRow,
  search: string,
): boolean {
  const q = search.trim().toLowerCase()
  if (!q) return true
  return [row.vehicleTypeName, row.vehicleTypeId, String(row.deploymentCount)].some((value) =>
    value.toLowerCase().includes(q),
  )
}

function buildReportPath(basePath: string, common: ReportCommonFilterParams): string {
  const params = new URLSearchParams()
  appendReportCommonFilterParams(params, common)
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

function paginateRows<T>(
  rows: T[],
  page: number,
  pageSize: number,
): EmergencyReportsPageResult<T> {
  const size = Math.max(1, pageSize)
  const totalCount = rows.length
  const totalPages = Math.max(1, Math.ceil(totalCount / size))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * size
  return {
    rows: getPageRows(rows, safePage, size),
    totalCount,
    totalPages,
    effectivePageSize: size,
    serialBase: start,
  }
}

function extractDeploymentsPayloadData(payload: unknown): ApiRecord {
  if (!payload || typeof payload !== 'object') return {}
  const root = payload as ApiRecord
  return nestedRecord(root.data) ?? root
}

function extractByVehicleTypeList(data: ApiRecord): ApiRecord[] {
  const list = data.by_vehicle_type ?? data.byVehicleType
  if (!Array.isArray(list)) return []
  return list.filter((item): item is ApiRecord => !!item && typeof item === 'object')
}

function mapDeploymentsSummary(data: ApiRecord): EmergencyDeploymentsSummary {
  return {
    avgDeploymentDurationMinutes: pickNullableNumber(data, [
      'avg_deployment_duration_minutes',
      'avgDeploymentDurationMinutes',
      'average_deployment_duration_minutes',
      'averageDeploymentDurationMinutes',
    ]),
    totalDeployments: pickNumber(data, [
      'total_deployments',
      'totalDeployments',
      'deployments_total',
      'deploymentsTotal',
    ]),
    currentlyActive: pickNumber(data, [
      'currently_active',
      'currentlyActive',
      'active_deployments',
      'activeDeployments',
      'active',
    ]),
    released: pickNumber(data, ['released', 'released_count', 'releasedCount']),
  }
}

/** Formats average response time for table display (minutes; hours when > 60 min). */
export function formatAvgResponseTime(row: EmergencyMtoActivityReportRow): string {
  if (row.avgResponseTimeLabel) return row.avgResponseTimeLabel
  return formatAvgDeploymentDurationMinutes(row.avgResponseTimeMinutes)
}

/** Formats avg deployment duration (minutes) for summary cards. */
export function formatAvgDeploymentDurationMinutes(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const totalMinutes = Math.max(0, value)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = Math.round(totalMinutes % 60)
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }
  return `${totalMinutes.toLocaleString('en-BT', {
    maximumFractionDigits: 1,
  })} min`
}

/**
 * `GET /emergency/reports/mto-activity`
 * Per-MTO breakdown: deployed / declined / escalation counts + average response time.
 * Filters: `date_from`, `date_to`, `agency_id` (HA). Search/paging are client-side.
 */
export async function fetchEmergencyMtoActivityReportPage(
  query: EmergencyReportListQuery,
): Promise<EmergencyReportsPageResult<EmergencyMtoActivityReportRow>> {
  const payload = await apiGet<unknown>(
    buildReportPath('/emergency/reports/mto-activity', query.common),
  )
  const mapped = extractMasterList(payload)
    .map((record) => mapMtoActivityRow(record))
    .filter((row): row is EmergencyMtoActivityReportRow => row !== null)

  const filtered = mapped.filter((row) => matchesMtoSearch(row, query.search ?? ''))
  return paginateRows(filtered, query.page, query.pageSize)
}

/**
 * `GET /emergency/reports/deployments`
 * Summary metrics + deployment counts by vehicle type (`data.by_vehicle_type`).
 * Filters: `date_from`, `date_to`, `agency_id` (HA). Search/paging are client-side.
 */
export async function fetchEmergencyDeploymentsReportPage(
  query: EmergencyReportListQuery,
): Promise<EmergencyDeploymentsReportResult> {
  const payload = await apiGet<unknown>(
    buildReportPath('/emergency/reports/deployments', query.common),
  )
  const data = extractDeploymentsPayloadData(payload)
  const summary = mapDeploymentsSummary(data)

  const mapped = extractByVehicleTypeList(data)
    .map((record, index) => mapVehicleTypeDeploymentRow(record, index))
    .filter((row): row is EmergencyDeploymentByVehicleTypeRow => row !== null)

  const filtered = mapped.filter((row) => matchesVehicleTypeSearch(row, query.search ?? ''))
  return {
    ...paginateRows(filtered, query.page, query.pageSize),
    summary: {
      ...EMPTY_DEPLOYMENTS_SUMMARY,
      ...summary,
    },
  }
}
