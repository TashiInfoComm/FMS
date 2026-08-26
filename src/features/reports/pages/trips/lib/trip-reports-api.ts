import {
  appendReportCommonFilterParams,
  type ReportCommonFilterParams,
} from '@/features/reports/lib/report-common-filters'
import { deriveTripTypeCategory } from '@/features/trips/lib/trip-form-utils'
import { apiGet, apiGetBlob } from '@/services/apiClient'
import { extractMasterList } from '@/shared/lib/organogram-master-lookup'
import { applyPagination } from '@/shared/utils/pagination'

type ApiRecord = Record<string, unknown>

export type TripReportSlice = {
  key: string
  label: string
  value: number
}

export type TripSummaryReportRow = {
  id: string
  tripId: string
  applicant: string
  department: string
  driver: string
  vehicle: string
  type: string
  purpose: string
  distanceKm: number | null
  durationLabel: string
  status: string
}

export type TripDriverAssignmentRow = {
  id: string
  driverName: string
  driverInitial: string
  agency: string
  completedCount: number
  cancelledCount: number
  kmDriven: number
  rating: number | null
}

export type TripApprovalItemRow = {
  id: string
  tripId: string
  applicant: string
  type: string
  vehicle: string
  status: string
}

export type TripApprovalsKpis = {
  pendingCount: number
  approvedCount: number
  rejectedCount: number
  avgApprovalTimeHours: number | null
  avgApprovalTimeLabel: string
}

export type TripAnalysisReport = {
  totalTrips: number
  byMonth: TripReportSlice[]
  byTripType: TripReportSlice[]
  byAgency: TripReportSlice[]
  byPurpose: TripReportSlice[]
}

export type TripReportsPageResult<T> = {
  rows: T[]
  totalCount: number
  totalPages: number
  effectivePageSize: number
  serialBase: number
}

export type TripReportListQuery = {
  page: number
  pageSize: number
  search?: string
  tripTypeId?: string
  status?: string
  purposeId?: string
  common: ReportCommonFilterParams
}

export type TripApprovalItemsQuery = TripReportListQuery & {
  approvalStatus?: string
}

export type TripReportExportFormat = 'xlsx' | 'pdf'

export type TripReportExportTab = 'summary' | 'analysis' | 'driver-assignment' | 'approvals'

export type TripReportExportQuery = {
  tab: TripReportExportTab
  format: TripReportExportFormat
  search?: string
  tripTypeId?: string
  status?: string
  purposeId?: string
  approvalStatus?: string
  common: ReportCommonFilterParams
}

const MONTH_SHORT_LABELS = [
  'Ja',
  'Fe',
  'Ma',
  'Ap',
  'Ma',
  'Ju',
  'Jl',
  'Au',
  'Se',
  'Oc',
  'No',
  'De',
] as const

const MONTH_NAME_INDEX: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
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
    const parsed = Number(value.replace(/,/g, ''))
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

function pickPersonName(record: ApiRecord, nestedKeys: string[], flatKeys: string[]): string {
  for (const nestedKey of nestedKeys) {
    const nested = nestedRecord(record[nestedKey])
    if (!nested) continue
    const name = pickScalar(nested, ['name', 'full_name', 'fullName', 'display_name', 'displayName'])
    if (name) return name
  }
  return pickScalar(record, flatKeys)
}

function pickOrgLabel(
  record: ApiRecord,
  nestedKeys: string[],
  nameKeys: string[],
  codeKeys: string[] = [],
): string {
  for (const nestedKey of nestedKeys) {
    const nested = nestedRecord(record[nestedKey])
    if (!nested) continue
    const name = pickScalar(nested, ['name', 'display_name', 'displayName', 'short_name', 'shortName'])
    if (name) return name
    const code = pickScalar(nested, ['code', 'abbreviation', 'short_name', 'shortName'])
    if (code) return code
  }
  return pickScalar(record, nameKeys) || pickScalar(record, codeKeys)
}

function pickVehicleLabel(record: ApiRecord): string {
  const vehicle =
    nestedRecord(record.vehicle) ??
    nestedRecord(record.assigned_vehicle) ??
    nestedRecord(record.assignedVehicle)
  return (
    pickScalar(record, [
      'vehicle',
      'vehicle_number',
      'vehicleNumber',
      'registration_number',
      'registrationNumber',
      'plate_number',
      'plateNumber',
      'vehicle_registration',
    ]) ||
    (vehicle
      ? pickScalar(vehicle, [
          'registration_number',
          'registrationNumber',
          'plate_number',
          'plateNumber',
          'vehicle_number',
          'vehicleNumber',
        ])
      : '')
  )
}

function pickTripTypeLabel(record: ApiRecord): string {
  const nested =
    nestedRecord(record.trip_type) ??
    nestedRecord(record.tripType) ??
    nestedRecord(record.type)
  return (
    pickScalar(record, [
      'trip_type',
      'tripType',
      'trip_type_name',
      'tripTypeName',
      'type',
      'type_name',
      'typeName',
    ]) ||
    (nested ? pickScalar(nested, ['name', 'label', 'code']) : '')
  )
}

function pickPurposeLabel(record: ApiRecord): string {
  const nested =
    nestedRecord(record.purpose) ??
    nestedRecord(record.journey_purpose) ??
    nestedRecord(record.journeyPurpose)
  return (
    pickScalar(record, [
      'purpose',
      'purpose_name',
      'purposeName',
      'purpose_of_journey',
      'purposeOfJourney',
      'journey_purpose',
      'journeyPurpose',
    ]) ||
    (nested ? pickScalar(nested, ['name', 'label', 'code']) : '')
  )
}

function formatDurationLabel(record: ApiRecord): string {
  const direct = pickScalar(record, [
    'duration',
    'duration_label',
    'durationLabel',
    'formatted_duration',
    'formattedDuration',
  ])
  if (direct) return direct

  const days = pickNullableNumber(record, ['duration_days', 'durationDays', 'days'])
  if (days != null && days >= 1) return `${Math.round(days)}d`

  const hours = pickNullableNumber(record, [
    'duration_hours',
    'durationHours',
    'hours',
    'total_hours',
    'totalHours',
  ])
  const minutes = pickNullableNumber(record, [
    'duration_minutes',
    'durationMinutes',
    'minutes',
    'total_minutes',
    'totalMinutes',
  ])
  const seconds = pickNullableNumber(record, [
    'duration_seconds',
    'durationSeconds',
    'seconds',
    'total_seconds',
    'totalSeconds',
  ])

  const totalMinutes =
    minutes ??
    (hours != null ? hours * 60 : null) ??
    (seconds != null ? seconds / 60 : null)

  if (totalMinutes == null) return '—'
  if (totalMinutes >= 24 * 60) return `${Math.round(totalMinutes / (24 * 60))}d`
  if (totalMinutes >= 60) return `${Math.round(totalMinutes / 60)}h`
  return `${Math.max(1, Math.round(totalMinutes))}m`
}

function driverInitial(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const source = parts[0] ?? name
  return source.charAt(0).toUpperCase() || '?'
}

function extractNamedList(payload: unknown, keys: string[]): ApiRecord[] {
  const fromMaster = extractMasterList(payload)
  if (fromMaster.length > 0 && keys.length === 0) return fromMaster

  if (!payload || typeof payload !== 'object') return fromMaster
  const root = payload as ApiRecord
  const data = nestedRecord(root.data)

  const candidates: unknown[] = keys.flatMap((key) => [root[key], data?.[key]])
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue
    return candidate.filter(
      (item): item is ApiRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item),
    )
  }

  return fromMaster
}

function extractPayloadData(payload: unknown): ApiRecord {
  if (!payload || typeof payload !== 'object') return {}
  const root = payload as ApiRecord
  return nestedRecord(root.data) ?? nestedRecord(root.summary) ?? root
}

function recordToSlices(source: unknown): TripReportSlice[] {
  if (Array.isArray(source)) {
    return source
      .map((item, index) => {
        const record = nestedRecord(item)
        if (!record) return null
        const label =
          pickScalar(record, [
            'label',
            'name',
            'month',
            'month_label',
            'monthLabel',
            'agency',
            'agency_name',
            'agencyName',
            'agency_code',
            'agencyCode',
            'purpose',
            'purpose_name',
            'purposeName',
            'trip_type',
            'tripType',
            'type',
            'type_name',
            'typeName',
          ]) || `Item ${index + 1}`
        const value = pickNumber(record, ['value', 'count', 'total', 'trips', 'trip_count', 'tripCount'])
        return {
          key: pickScalar(record, ['key', 'id', 'code', 'month_key', 'monthKey']) || `${label}-${index}`,
          label,
          value,
        }
      })
      .filter((slice): slice is TripReportSlice => slice !== null)
  }

  const record = nestedRecord(source)
  if (!record) return []

  return Object.entries(record)
    .map(([key, raw]) => {
      const nested = nestedRecord(raw)
      const value = nested
        ? pickNumber(nested, ['value', 'count', 'total', 'trips'])
        : toNumber(raw, Number.NaN)
      if (!Number.isFinite(value)) return null
      return { key, label: toDisplayLabel(key), value }
    })
    .filter((slice): slice is TripReportSlice => slice !== null)
}

function toDisplayLabel(raw: string): string {
  const spaced = raw.replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim()
  if (!spaced) return raw || '—'
  return spaced
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function monthIndexFromSlice(slice: TripReportSlice): number | null {
  const key = `${slice.key} ${slice.label}`.trim()
  const iso = key.match(/(\d{4})-(\d{2})/)
  if (iso) {
    const month = Number(iso[2])
    return month >= 1 && month <= 12 ? month : null
  }
  const numeric = Number(key)
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 12) return numeric
  const name = key.toLowerCase().replace(/[^a-z]/g, '')
  return MONTH_NAME_INDEX[name] ?? MONTH_NAME_INDEX[name.slice(0, 3)] ?? null
}

/** Always 12 calendar months so the bar chart matches the design axis. */
export function toCalendarMonthSlices(slices: TripReportSlice[]): TripReportSlice[] {
  const byMonth = new Map<number, number>()
  for (const slice of slices) {
    const month = monthIndexFromSlice(slice)
    if (month == null) continue
    byMonth.set(month, (byMonth.get(month) ?? 0) + slice.value)
  }

  if (byMonth.size === 0) return slices

  return MONTH_SHORT_LABELS.map((label, index) => {
    const month = index + 1
    return {
      key: String(month).padStart(2, '0'),
      label,
      value: byMonth.get(month) ?? 0,
    }
  })
}

function parseIsoMonth(value: string): number | null {
  const match = value.trim().match(/^\d{4}-(\d{2})/)
  if (!match) return null
  const month = Number(match[1])
  return month >= 1 && month <= 12 ? month : null
}

function parseIsoYear(value: string): number | null {
  const match = value.trim().match(/^(\d{4})-/)
  if (!match) return null
  const year = Number(match[1])
  return Number.isInteger(year) ? year : null
}

/** When From/To fall in the same year, hide months outside that range. */
export function clipMonthSlicesToDateRange(
  slices: TripReportSlice[],
  dateFrom?: string,
  dateTo?: string,
): TripReportSlice[] {
  const from = dateFrom?.trim() ?? ''
  const to = dateTo?.trim() ?? ''
  if (!from && !to) return slices

  const fromYear = parseIsoYear(from)
  const toYear = parseIsoYear(to)
  if (fromYear != null && toYear != null && fromYear !== toYear) return slices

  const start = parseIsoMonth(from) ?? 1
  const end = parseIsoMonth(to) ?? 12
  return slices.filter((slice) => {
    const month = monthIndexFromSlice(slice)
    if (month == null) return true
    return month >= start && month <= end
  })
}

function buildListPath(basePath: string, query: TripReportListQuery, extra?: Record<string, string>): string {
  const params = new URLSearchParams()
  params.set('page', String(query.page))
  params.set('page_size', String(query.pageSize))
  appendReportCommonFilterParams(params, query.common)
  const search = query.search?.trim()
  if (search) params.set('search', search)
  const tripTypeId = query.tripTypeId?.trim()
  if (tripTypeId) params.set('trip_type_id', tripTypeId)
  const status = query.status?.trim()
  if (status) params.set('status', status)
  const purposeId = query.purposeId?.trim()
  if (purposeId) params.set('purpose_id', purposeId)
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value.trim()) params.set(key, value.trim())
    }
  }
  return `${basePath}?${params.toString()}`
}

function mapSummaryRow(record: ApiRecord, index: number): TripSummaryReportRow | null {
  const id =
    pickScalar(record, ['id', 'trip_id', 'tripId', 'requisition_id', 'uuid']) || `summary-${index}`
  const tripId =
    pickScalar(record, [
      'trip_code',
      'tripCode',
      'reference_no',
      'referenceNo',
      'trip_number',
      'tripNumber',
      'trip_id',
      'tripId',
    ]) || id

  return {
    id,
    tripId,
    applicant:
      pickPersonName(
        record,
        ['applicant', 'requested_by', 'requestedBy', 'user'],
        ['applicant_name', 'applicantName', 'applicant', 'employee_name', 'employeeName'],
      ) || '—',
    department:
      pickOrgLabel(
        record,
        ['department', 'dept', 'applicant_department'],
        ['department', 'department_name', 'departmentName', 'dept', 'dept_name', 'deptName'],
        ['department_code', 'departmentCode'],
      ) || '—',
    driver:
      pickPersonName(
        record,
        ['driver', 'assigned_driver', 'assignedDriver'],
        ['driver_name', 'driverName', 'driver'],
      ) || '—',
    vehicle: pickVehicleLabel(record) || '—',
    type: pickTripTypeLabel(record) || '—',
    purpose: pickPurposeLabel(record) || '—',
    distanceKm: pickNullableNumber(record, [
      'distance',
      'distance_km',
      'distanceKm',
      'total_distance',
      'totalDistance',
      'km',
    ]),
    durationLabel: formatDurationLabel(record),
    status:
      pickScalar(record, ['status', 'trip_status', 'tripStatus', 'status_name', 'statusName']) || '—',
  }
}

function mapDriverAssignmentRow(record: ApiRecord, index: number): TripDriverAssignmentRow | null {
  const driverName =
    pickPersonName(
      record,
      ['driver', 'user'],
      ['driver_name', 'driverName', 'name', 'full_name', 'fullName'],
    ) || '—'
  const id =
    pickScalar(record, ['id', 'driver_id', 'driverId', 'user_id', 'userId']) ||
    `${driverName}-${index}`

  return {
    id,
    driverName,
    driverInitial: driverInitial(driverName === '—' ? '' : driverName),
    agency:
      pickOrgLabel(
        record,
        ['agency'],
        ['agency', 'agency_name', 'agencyName'],
        ['agency_code', 'agencyCode'],
      ) || '—',
    completedCount: pickNumber(record, [
      'completed',
      'completed_count',
      'completedCount',
      'completed_trips',
      'completedTrips',
    ]),
    cancelledCount: pickNumber(record, [
      'cancelled',
      'canceled',
      'cancelled_count',
      'cancelledCount',
      'canceled_count',
      'canceledCount',
      'cancelled_trips',
      'cancelledTrips',
    ]),
    kmDriven: pickNumber(record, [
      'km_driven',
      'kmDriven',
      'distance',
      'distance_km',
      'distanceKm',
      'total_km',
      'totalKm',
    ]),
    rating: pickNullableNumber(record, [
      'rating',
      'average_rating',
      'averageRating',
      'avg_rating',
      'avgRating',
    ]),
  }
}

function mapApprovalItemRow(record: ApiRecord, index: number): TripApprovalItemRow | null {
  const id =
    pickScalar(record, ['id', 'trip_id', 'tripId', 'approval_id', 'approvalId']) || `approval-${index}`
  const tripId =
    pickScalar(record, [
      'trip_code',
      'tripCode',
      'reference_no',
      'referenceNo',
      'trip_number',
      'tripNumber',
      'trip_id',
      'tripId',
    ]) || id

  return {
    id,
    tripId,
    applicant:
      pickPersonName(
        record,
        ['applicant', 'requested_by', 'requestedBy'],
        ['applicant_name', 'applicantName', 'applicant'],
      ) || '—',
    type: pickTripTypeLabel(record) || '—',
    vehicle: pickVehicleLabel(record) || '—',
    status:
      pickScalar(record, [
        'approval_status',
        'approvalStatus',
        'status',
        'status_name',
        'statusName',
      ]) || '—',
  }
}

function mapApprovalsKpis(payload: unknown): TripApprovalsKpis {
  const data = extractPayloadData(payload)
  const pendingCount = pickNumber(data, [
    'pending',
    'pending_count',
    'pendingCount',
    'total_pending',
    'totalPending',
  ])
  const approvedCount = pickNumber(data, [
    'approved',
    'approved_count',
    'approvedCount',
    'total_approved',
    'totalApproved',
  ])
  const rejectedCount = pickNumber(data, [
    'rejected',
    'rejected_count',
    'rejectedCount',
    'total_rejected',
    'totalRejected',
  ])

  const label = pickScalar(data, [
    'avg_approval_time_label',
    'avgApprovalTimeLabel',
    'average_approval_time_label',
    'averageApprovalTimeLabel',
  ])
  const hours = pickNullableNumber(data, [
    'avg_approval_time_hours',
    'avgApprovalTimeHours',
    'average_approval_time_hours',
    'averageApprovalTimeHours',
    'avg_approval_time',
    'avgApprovalTime',
    'average_approval_time',
    'averageApprovalTime',
  ])
  const minutes = pickNullableNumber(data, [
    'avg_approval_time_minutes',
    'avgApprovalTimeMinutes',
    'average_approval_time_minutes',
  ])

  const avgApprovalTimeHours = hours ?? (minutes != null ? minutes / 60 : null)

  return {
    pendingCount,
    approvedCount,
    rejectedCount,
    avgApprovalTimeHours,
    avgApprovalTimeLabel: label || formatAvgApprovalHours(avgApprovalTimeHours),
  }
}

function paginateMapped<T>(
  payload: unknown,
  rows: T[],
  query: TripReportListQuery,
): TripReportsPageResult<T> {
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

/** `GET /trips/reports/summary` — trip summary table rows. */
export async function fetchTripSummaryReportPage(
  query: TripReportListQuery,
): Promise<TripReportsPageResult<TripSummaryReportRow>> {
  const payload = await apiGet<unknown>(
    buildListPath('/trips/reports/summary', query),
  )
  const rows = extractNamedList(payload, ['trips', 'summary', 'items', 'rows'])
    .map((record, index) => mapSummaryRow(record, index))
    .filter((row): row is TripSummaryReportRow => row !== null)
  return paginateMapped(payload, rows, query)
}

/** `GET /trips/reports/analysis` — chart series by month, type, agency, and purpose. */
export async function fetchTripAnalysisReport(
  common: ReportCommonFilterParams,
): Promise<TripAnalysisReport> {
  const params = new URLSearchParams()
  appendReportCommonFilterParams(params, common)
  const query = params.toString()
  const payload = await apiGet<unknown>(
    query ? `/trips/reports/analysis?${query}` : '/trips/reports/analysis',
  )
  const data = extractPayloadData(payload)

  const byMonth = recordToSlices(
    data.by_month ?? data.byMonth ?? data.trips_by_month ?? data.tripsByMonth ?? data.monthly,
  )
  const byTripType = recordToSlices(
    data.by_trip_type ?? data.byTripType ?? data.by_type ?? data.byType ?? data.trip_types,
  )
  const byAgency = recordToSlices(data.by_agency ?? data.byAgency ?? data.agencies)
  const byPurpose = recordToSlices(data.by_purpose ?? data.byPurpose ?? data.purposes)

  const totalFromApi = pickNullableNumber(data, [
    'total',
    'total_trips',
    'totalTrips',
    'trip_count',
    'tripCount',
    'count',
  ])
  const totalTrips =
    totalFromApi ??
    (byTripType.length > 0
      ? byTripType.reduce((sum, slice) => sum + slice.value, 0)
      : byMonth.reduce((sum, slice) => sum + slice.value, 0))

  return {
    totalTrips,
    byMonth: clipMonthSlicesToDateRange(
      toCalendarMonthSlices(byMonth),
      common.date_from,
      common.date_to,
    ),
    byTripType,
    byAgency,
    byPurpose,
  }
}

/** `GET /trips/reports/driver-assignment` — completed / cancelled / km / rating per driver. */
export async function fetchTripDriverAssignmentPage(
  query: TripReportListQuery,
): Promise<TripReportsPageResult<TripDriverAssignmentRow>> {
  const payload = await apiGet<unknown>(
    buildListPath('/trips/reports/driver-assignment', query),
  )
  const rows = extractNamedList(payload, ['drivers', 'assignments', 'items', 'rows'])
    .map((record, index) => mapDriverAssignmentRow(record, index))
    .filter((row): row is TripDriverAssignmentRow => row !== null)
  return paginateMapped(payload, rows, query)
}

/** `GET /trips/reports/approvals` — pending / approved / rejected counts + avg approval time. */
export async function fetchTripApprovalsKpis(
  common: ReportCommonFilterParams,
): Promise<TripApprovalsKpis> {
  const params = new URLSearchParams()
  appendReportCommonFilterParams(params, common)
  const query = params.toString()
  const payload = await apiGet<unknown>(
    query ? `/trips/reports/approvals?${query}` : '/trips/reports/approvals',
  )
  return mapApprovalsKpis(payload)
}

/** `GET /trips/reports/approvals/items` — approval table rows, filterable by `approval_status`. */
export async function fetchTripApprovalItemsPage(
  query: TripApprovalItemsQuery,
): Promise<TripReportsPageResult<TripApprovalItemRow>> {
  const extra = query.approvalStatus?.trim()
    ? { approval_status: query.approvalStatus.trim() }
    : undefined
  const payload = await apiGet<unknown>(
    buildListPath('/trips/reports/approvals/items', query, extra),
  )
  const rows = extractNamedList(payload, ['items', 'approvals', 'trips', 'rows'])
    .map((record, index) => mapApprovalItemRow(record, index))
    .filter((row): row is TripApprovalItemRow => row !== null)
  return paginateMapped(payload, rows, query)
}

function buildExportPath(query: TripReportExportQuery): string {
  const basePath = {
    summary: '/trips/reports/summary/export',
    analysis: '/trips/reports/analysis/export',
    'driver-assignment': '/trips/reports/driver-assignment/export',
    approvals: '/trips/reports/approvals/export',
  }[query.tab]

  const params = new URLSearchParams()
  params.set('format', query.format)
  appendReportCommonFilterParams(params, query.common)

  if (query.tab !== 'analysis') {
    const search = query.search?.trim()
    if (search) params.set('search', search)
  }

  if (query.tab === 'summary') {
    const tripTypeId = query.tripTypeId?.trim()
    if (tripTypeId) params.set('trip_type_id', tripTypeId)
    const status = query.status?.trim()
    if (status) params.set('status', status)
    const purposeId = query.purposeId?.trim()
    if (purposeId) params.set('purpose_id', purposeId)
  }

  if (query.tab === 'approvals') {
    const approvalStatus = query.approvalStatus?.trim()
    if (approvalStatus) params.set('approval_status', approvalStatus)
  }

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
 * `GET /trips/reports/{tab}/export?format=xlsx|pdf`
 * Downloads the active tab using the same list filters.
 */
export async function exportTripReport(query: TripReportExportQuery): Promise<void> {
  const path = buildExportPath(query)
  const { blob, contentType, contentDisposition } = await apiGetBlob(path)
  const extension = query.format === 'pdf' ? 'pdf' : 'xlsx'
  const fallbackName = `trip-${query.tab}-report.${extension}`

  if (contentType.includes('application/json')) {
    let payload: unknown
    try {
      payload = JSON.parse(await blob.text()) as unknown
    } catch {
      throw new Error('Could not export trip report.')
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

export function formatDistanceKm(value: number | null): string {
  if (value == null) return '—'
  return `${value.toLocaleString('en-BT')} km`
}

export function formatKmDriven(value: number): string {
  return value.toLocaleString('en-BT')
}

export function formatDriverRating(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toLocaleString('en-BT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatAvgApprovalHours(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value.toLocaleString('en-BT', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  })} hrs`
}

export function tripTypeBadgeClass(type: string): string {
  const category = deriveTripTypeCategory(type)
  if (category === 'LOCAL') return 'rounded-full bg-[#f1f5f9] px-2 py-1 text-xs text-[#475569]'
  if (category === 'PICK_DROP') return 'rounded-full bg-[#ede9fe] px-2 py-1 text-xs text-[#6d28d9]'
  return 'rounded-full bg-[#dbeafe] px-2 py-1 text-xs text-[#1d4ed8]'
}

export function approvalStatusBadgeClass(status: string): string {
  const text = status.toLowerCase()
  if (text.includes('pending')) {
    return 'inline-flex items-center gap-1.5 rounded-full bg-[#fef3c7] px-2 py-1 text-xs text-[#b45309]'
  }
  if (text.includes('reject') || text.includes('cancel')) {
    return 'inline-flex items-center gap-1.5 rounded-full bg-[#fee2e2] px-2 py-1 text-xs text-[#b91c1c]'
  }
  if (text.includes('on trip') || text.includes('in progress') || text.includes('started')) {
    return 'inline-flex items-center gap-1.5 rounded-full bg-[#dbeafe] px-2 py-1 text-xs text-[#1d4ed8]'
  }
  if (text.includes('available') || text.includes('complete')) {
    return 'inline-flex items-center gap-1.5 rounded-full bg-[#dcfce7] px-2 py-1 text-xs text-[#15803d]'
  }
  if (text.includes('approv')) {
    return 'inline-flex items-center gap-1.5 rounded-full bg-[#f1f5f9] px-2 py-1 text-xs text-[#475569]'
  }
  return 'inline-flex items-center gap-1.5 rounded-full bg-[#edf2f7] px-2 py-1 text-xs text-[#4a5568]'
}

export function approvalStatusDotClass(status: string): string {
  const text = status.toLowerCase()
  if (text.includes('pending')) return 'bg-[#f59e0b]'
  if (text.includes('reject') || text.includes('cancel')) return 'bg-[#ef4444]'
  if (text.includes('on trip') || text.includes('in progress') || text.includes('started')) {
    return 'bg-[#3b82f6]'
  }
  if (text.includes('available') || text.includes('complete')) return 'bg-[#22c55e]'
  if (text.includes('approv')) return 'bg-[#94a3b8]'
  return 'bg-[#94a3b8]'
}

export function formatApprovalStatusLabel(status: string): string {
  const trimmed = status.trim()
  if (!trimmed || trimmed === '—') return '—'
  return trimmed
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}
