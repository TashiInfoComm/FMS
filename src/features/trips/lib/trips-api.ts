import { fetchUserById } from '@/features/user/lib/users-api'
import { fetchVehicleById, mapVehicleRecordToListRow } from '@/features/vehicles/lib/vehicles-api'
import { apiClient, apiGet, apiGetBlob, apiPost } from '@/services/apiClient'
import { isUuidLike } from '@/shared/lib/organogram-master-lookup'
import {
  closeBrowserTab,
  navigateBrowserTab,
} from '@/shared/lib/open-in-new-tab'
import { applyPagination } from '@/shared/utils/pagination'

import {
  computeTripRequestSummary,
  formatSuggestedVehicleMakeModel,
  type TripAccompanyingOfficial,
  type TripRequestListItem,
  type TripRequestPriority,
  type TripRequestsSummary,
  type TripSuggestedDriver,
  type TripSuggestedVehicle,
} from '@/features/trips/lib/trip-request-mock-data'
import type { DriverAssignmentListItem } from '@/features/trips/lib/trip-assignment-mock-data'
import type {
  DriverFeedbackListItem,
  DriverFeedbackTrip,
  TripFeedbackRating,
} from '@/features/trips/lib/trip-driver-feedback-mock-data'
import {
  feedbackRatingToStars,
  initialsFromName,
  TRIP_FEEDBACK_RATINGS,
} from '@/features/trips/lib/trip-driver-feedback-mock-data'
import {
  formatFileSizeLabel,
  formatTripDisplayDate,
  formatTripDisplayTime,
} from '@/features/trips/lib/trip-form-utils'
import {
  labelForMasterOption,
  type TripMasterOption,
} from '@/features/trips/lib/trip-requisition-masters'

type ApiRecord = Record<string, unknown>

function pickScalar(record: ApiRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return ''
}

function toArray(payload: unknown): ApiRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is ApiRecord => !!item && typeof item === 'object')
  }
  if (!payload || typeof payload !== 'object') return []
  const root = payload as ApiRecord
  const candidates = [
    root.items,
    root.results,
    root.data,
    (root.data as ApiRecord | undefined)?.items,
    root.requisitions,
    root.trips,
  ]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is ApiRecord => !!item && typeof item === 'object')
    }
  }
  return []
}

function unwrapDataRecord(payload: unknown): ApiRecord | null {
  if (!payload || typeof payload !== 'object') return null
  const root = payload as ApiRecord
  const data = root.data
  if (data && typeof data === 'object' && !Array.isArray(data)) return data as ApiRecord
  return root
}

export type TripRequisitionListRow = {
  id: string
  serialNo: number
  tripType: string
  purpose: string
  journeyDate: string
  journeyEndDate: string
  route: string
  status: string
  statusCode: string
  hasFeedback: boolean
}

export type TripsPageResult<T> = {
  rows: T[]
  totalCount: number
  totalPages: number
  effectivePageSize: number
  serialBase: number
}

export type TripRequisitionsPageResult = TripsPageResult<TripRequisitionListRow>

export type TripRequestListRow = TripRequestListItem

export type { TripRequestsSummary }

export type TripRequestsPageResult = TripsPageResult<TripRequestListRow> & {
  summary: TripRequestsSummary
}

function resolveTripTypeLabel(
  record: ApiRecord,
  tripTypes?: TripMasterOption[],
): string {
  const source = withNestedTripFields(record)
  const directLabel = pickScalar(source, [
    'trip_type_name',
    'tripTypeName',
    'trip_type_label',
    'tripTypeLabel',
  ])
  if (directLabel) return directLabel

  const tripTypeBlock = pickNestedRecord(source, ['trip_type', 'tripType'])
  if (tripTypeBlock) {
    const nestedLabel = pickScalar(tripTypeBlock, [
      'name',
      'label',
      'trip_type_name',
      'tripTypeName',
      'trip_type_label',
      'tripTypeLabel',
    ])
    if (nestedLabel) return nestedLabel
    const nestedId = pickScalar(tripTypeBlock, ['id', 'trip_type_id', 'tripTypeId'])
    const nestedCode = pickScalar(tripTypeBlock, ['code', 'trip_type_code', 'tripTypeCode'])
    const nestedKey = nestedId || nestedCode
    if (nestedKey && tripTypes?.length) {
      return labelForMasterOption(tripTypes, nestedKey)
    }
    if (nestedKey) return nestedKey
  }

  const tripTypeId = pickScalar(source, ['trip_type_id', 'tripTypeId'])
  const tripTypeCode = pickScalar(source, ['trip_type_code', 'tripTypeCode'])
  const lookupKey = tripTypeId || tripTypeCode
  if (lookupKey && tripTypes?.length) {
    return labelForMasterOption(tripTypes, lookupKey)
  }
  return lookupKey
}

function resolvePurposeLabel(
  record: ApiRecord,
  purposes?: TripMasterOption[],
): string {
  const directLabel = pickScalar(record, [
    'purpose_name',
    'purposeOfJourneyName',
    'journey_purpose_name',
    'purpose_label',
    'purposeLabel',
  ])
  if (directLabel) return directLabel

  const purposeId = pickScalar(record, ['purpose_id', 'purposeId'])
  const purposeCode = pickScalar(record, [
    'purpose_of_journey',
    'purposeOfJourney',
    'journey_purpose',
    'journeyPurpose',
    'purpose_code',
    'purposeCode',
  ])
  const lookupKey = purposeId || purposeCode
  if (lookupKey && purposes?.length) {
    return labelForMasterOption(purposes, lookupKey)
  }
  return lookupKey
}

function pickPurposeDisplayLabel(
  record: ApiRecord,
  fallback?: string,
): string {
  const directLabel = pickScalar(record, [
    'purpose_name',
    'purpose_of_journey_name',
    'purposeOfJourneyName',
    'journey_purpose_name',
    'purpose_label',
    'purposeLabel',
  ])
  if (directLabel) return directLabel

  const nestedLabel = pickScalar(record, [
    'purpose_of_journey',
    'purposeOfJourney',
    'journey_purpose',
    'journeyPurpose',
  ])
  if (nestedLabel && !isUuidLike(nestedLabel)) return nestedLabel

  const fallbackLabel = (fallback ?? '').trim()
  if (fallbackLabel && !isUuidLike(fallbackLabel)) return fallbackLabel
  return '—'
}

function pickTripTypeDisplayLabel(
  record: ApiRecord,
  fallback?: string,
): string {
  const directLabel = pickScalar(record, [
    'trip_type_name',
    'tripTypeName',
    'trip_type_label',
    'tripTypeLabel',
  ])
  if (directLabel) return directLabel

  const fallbackLabel = (fallback ?? '').trim()
  if (fallbackLabel && fallbackLabel !== '—' && !isUuidLike(fallbackLabel)) {
    return fallbackLabel
  }
  return '—'
}

function readJourneyStartDatetime(record: ApiRecord): string {
  return pickScalar(record, [
    'journey_start_datetime',
    'journeyStartDatetime',
    'date_of_journey',
    'journey_date',
    'journeyDate',
    'travel_date',
  ])
}

function readJourneyEndDatetime(record: ApiRecord): string {
  return pickScalar(record, [
    'journey_end_datetime',
    'journeyEndDatetime',
    'date_of_return',
    'return_date',
    'journey_end_date',
    'journeyEndDate',
  ])
}

function withNestedTripFields(record: ApiRecord): ApiRecord {
  const nested = pickNestedRecord(record, [
    'trip',
    'trip_details',
    'tripDetails',
    'requisition',
    'trip_requisition',
  ])
  return nested ? { ...nested, ...record } : record
}

function readTripRoute(record: ApiRecord): string {
  const source = withNestedTripFields(record)
  const route = pickScalar(source, [
    'route',
    'trip_route',
    'tripRoute',
    'route_label',
    'routeLabel',
    'route_display',
    'routeDisplay',
  ])
  if (route) return route

  const origin = pickScalar(source, ['origin', 'origin_location', 'from_location'])
  const destination = readDestination(record)
  if (origin && destination !== '—') return `${origin} -> ${destination}`
  return origin || (destination !== '—' ? destination : '—') || '—'
}

function readDestination(record: ApiRecord): string {
  const source = withNestedTripFields(record)
  return (
    pickScalar(source, [
      'destination_details',
      'destinationDetails',
      'destination',
      'final_destination',
      'to_location',
    ]) || '—'
  )
}

function readApplicantBlock(record: ApiRecord): ApiRecord | null {
  const source = withNestedTripFields(record)
  return pickNestedRecord(source, ['applicant', 'employee', 'user', 'requester'])
}

function readApplicantEmployeeId(record: ApiRecord): string {
  const applicant = readApplicantBlock(record)
  const fromApplicant = pickScalar(applicant ?? {}, [
    'employee_id',
    'employeeId',
    'employee_number',
    'employeeNumber',
  ])
  if (fromApplicant) return fromApplicant

  const source = withNestedTripFields(record)
  return (
    pickScalar(source, [
      'employee_id',
      'employeeId',
      'employee_number',
      'employeeNumber',
    ]) || '—'
  )
}

function readTripStatusCode(record: ApiRecord): string {
  return pickScalar(record, ['status', 'approval_status', 'trip_status'])
}

function readTripDisplayStatus(record: ApiRecord): string {
  return readTripStatusCode(record) || '—'
}

export function mapTripRequisitionListRow(
  record: ApiRecord,
  serialNo: number,
  lookups?: {
    tripTypes?: TripMasterOption[]
    purposes?: TripMasterOption[]
  },
): TripRequisitionListRow {
  const id = pickScalar(record, ['id', 'trip_id', 'tripId', 'requisition_id', 'uuid'])
  const tripType = resolveTripTypeLabel(record, lookups?.tripTypes)
  const purpose = resolvePurposeLabel(record, lookups?.purposes)
  const journeyDateRaw = readJourneyStartDatetime(record)
  const journeyEndDateRaw = readJourneyEndDatetime(record)
  const route = readTripRoute(record)
  const statusCode = readTripStatusCode(record)
  const status = readTripDisplayStatus(record)

  return {
    id: id || String(serialNo),
    serialNo,
    tripType: tripType || '—',
    purpose: purpose || '—',
    journeyDate: formatTripDisplayDate(journeyDateRaw),
    journeyEndDate: formatTripDisplayDate(journeyEndDateRaw),
    route,
    status,
    statusCode,
    hasFeedback: readHasFeedback(record),
  }
}

function listPath(
  search: string,
  page: number,
  pageSize: number,
  options?: { status?: string; tripTypeId?: string },
) {
  const q = encodeURIComponent(search.trim())
  let path = `/trips?page=${page}&page_size=${pageSize}&search=${q}`
  if (options?.status?.trim()) {
    path += `&status=${encodeURIComponent(options.status.trim())}`
  }
  if (options?.tripTypeId?.trim()) {
    path += `&trip_type_id=${encodeURIComponent(options.tripTypeId.trim())}`
  }
  return path
}

function pickNestedRecord(record: ApiRecord, keys: string[]): ApiRecord | null {
  for (const key of keys) {
    const value = record[key]
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as ApiRecord
    }
  }
  return null
}

function normalizeTripRequestPriority(value: string): TripRequestPriority {
  const priority = value.trim().toLowerCase()
  if (priority.includes('high')) return 'High'
  if (priority.includes('low')) return 'Low'
  return 'Normal'
}

function readNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatFuelEfficiency(record: ApiRecord): string {
  const value = pickScalar(record, [
    'fuel_efficiency',
    'fuelEfficiency',
    'mileage',
    'fuel_efficiency_kmpl',
  ])
  if (!value) return '—'
  return /km\/l/i.test(value) ? value : `${value} km/l`
}

function readOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function readSummaryMetric(block: ApiRecord, keys: string[]): number | undefined {
  for (const key of keys) {
    const parsed = readOptionalNumber(block[key])
    if (parsed !== undefined) return parsed
  }
  return undefined
}

function readSummaryByStatus(block: ApiRecord): Record<string, number> {
  const raw = block.by_status ?? block.byStatus
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}

  const byStatus: Record<string, number> = {}
  for (const [key, value] of Object.entries(raw as ApiRecord)) {
    const count = readNumber(value)
    if (Number.isFinite(count) && count >= 0) {
      byStatus[key] = count
    }
  }
  return byStatus
}

export function mapTripRequestsSummary(payload: unknown): TripRequestsSummary | null {
  const root = payload && typeof payload === 'object' ? (payload as ApiRecord) : null
  const data =
    root?.data && typeof root.data === 'object' && !Array.isArray(root.data)
      ? (root.data as ApiRecord)
      : null

  const blocks = [
    pickNestedRecord(root ?? {}, ['summary', 'stats', 'metrics']),
    pickNestedRecord(data ?? {}, ['summary', 'stats', 'metrics']),
    data,
    root,
  ].filter((block): block is ApiRecord => block !== null)

  for (const block of blocks) {
    const pendingReview = readSummaryMetric(block, [
      'pending_review',
      'pendingReview',
      'pending_review_count',
      'pendingReviewCount',
      'pending',
    ])
    const autoApproved = readSummaryMetric(block, [
      'auto_approved',
      'autoApproved',
      'auto_approved_count',
      'autoApprovedCount',
    ])
    const completedToday = readSummaryMetric(block, [
      'completed_today',
      'completedToday',
      'completed_today_count',
      'completedTodayCount',
    ])
    const inProgress = readSummaryMetric(block, [
      'in_progress',
      'inProgress',
      'in_progress_count',
      'inProgressCount',
    ])
    const mtoRequired = readSummaryMetric(block, [
      'mto_required',
      'mtoRequired',
      'movement_order_required',
      'movementOrderRequired',
    ])
    const byStatus = readSummaryByStatus(block)

    if (
      pendingReview !== undefined ||
      autoApproved !== undefined ||
      completedToday !== undefined ||
      inProgress !== undefined ||
      mtoRequired !== undefined ||
      Object.keys(byStatus).length > 0
    ) {
      return {
        pendingReview: pendingReview ?? 0,
        autoApproved: autoApproved ?? 0,
        completedToday: completedToday ?? 0,
        inProgress: inProgress ?? 0,
        mtoRequired: mtoRequired ?? 0,
        byStatus,
      }
    }
  }

  return null
}

const EMPTY_TRIP_REQUESTS_SUMMARY: TripRequestsSummary = {
  pendingReview: 0,
  autoApproved: 0,
  completedToday: 0,
  inProgress: 0,
  mtoRequired: 0,
  byStatus: {},
}

function extractTripRequestSummaryFromPayload(
  payload: unknown,
  rows: TripRequestListRow[],
): TripRequestsSummary {
  return mapTripRequestsSummary(payload) ?? computeTripRequestSummary(rows)
}

export async function fetchTripRequestsSummary(): Promise<TripRequestsSummary> {
  const payload = await apiGet<unknown>('/trips/summary')
  return mapTripRequestsSummary(payload) ?? EMPTY_TRIP_REQUESTS_SUMMARY
}

export function mapTripRequestListRow(
  record: ApiRecord,
  lookups?: {
    tripTypes?: TripMasterOption[]
  },
): TripRequestListRow {
  const id = pickScalar(record, ['id', 'trip_id', 'tripId', 'requisition_id', 'uuid'])
  const requestId =
    pickScalar(record, [
      'reference_no',
      'referenceNo',
      'request_id',
      'requestId',
      'trip_reference',
      'reference',
      'trip_code',
    ]) || id
  const applicant = pickNestedRecord(record, ['applicant', 'employee', 'user', 'requester'])
  const applicantName =
    pickScalar(record, ['applicant_name', 'applicantName', 'employee_name', 'employeeName']) ||
    pickScalar(applicant ?? {}, ['name', 'full_name', 'fullName', 'employee_name'])
  const applicantDepartment =
    pickScalar(record, ['applicant_department', 'applicantDepartment', 'department_name']) ||
    pickScalar(applicant ?? {}, ['department', 'department_name', 'departmentName'])
  const tripType = resolveTripTypeLabel(record, lookups?.tripTypes)
  const journeyStartRaw = readJourneyStartDatetime(record)
  const journeyDateRaw = journeyStartRaw
  const journeyTimeRaw =
    pickScalar(record, [
      'time_of_journey',
      'journey_time',
      'journeyTime',
      'travel_time',
    ]) || journeyStartRaw
  const tripFields = withNestedTripFields(record)
  const origin =
    pickScalar(tripFields, ['origin', 'origin_location', 'from_location']) || '—'
  const destination = readDestination(record)
  const route = readTripRoute(record)
  const statusCode = readTripStatusCode(record)
  const status = readTripDisplayStatus(record)
  const priorityRaw = pickScalar(record, ['priority', 'trip_priority', 'tripPriority'])
  const assignment = mapAssignmentFromRecord(record)
  const suggestedVehicleBlock =
    pickNestedRecord(record, [
      'suggested_vehicle',
      'suggestedVehicle',
      'recommended_vehicle',
      'recommendedVehicle',
    ]) ??
  (assignment.vehicle
    ? {
        plate_number: assignment.vehicle.plateNumber,
        model: assignment.vehicle.model,
        color: assignment.vehicle.color,
      }
    : null)
  const suggestedDriverBlock =
    pickNestedRecord(record, [
      'suggested_driver',
      'suggestedDriver',
      'recommended_driver',
      'recommendedDriver',
    ]) ??
    (assignment.driver
      ? {
          name: assignment.driver.name,
          contact: assignment.driver.contact,
        }
      : null)

  return {
    id: id || requestId,
    requestId: requestId || id || '—',
    applicantName: applicantName || '—',
    applicantDepartment: applicantDepartment || '—',
    tripType: tripType || '—',
    origin,
    destination,
    route,
    dateOfJourney: formatTripDisplayDate(journeyDateRaw),
    timeOfJourney: formatTripDisplayTime(journeyTimeRaw),
    suggestedVehicle: mapSuggestedVehicleFromBlock(suggestedVehicleBlock),
    suggestedDriver: mapSuggestedDriverFromBlock(suggestedDriverBlock),
    priority: priorityRaw ? normalizeTripRequestPriority(priorityRaw) : 'Normal',
    status,
    statusCode,
    hasFeedback: readHasFeedback(record),
  }
}

export async function fetchTripsPage<T>(
  search: string,
  page: number,
  pageSize: number,
  mapRow: (record: ApiRecord, serialNo: number) => T,
  options?: { status?: string; tripTypeId?: string },
): Promise<TripsPageResult<T>> {
  const payload = await apiGet<unknown>(listPath(search, page, pageSize, options))
  const records = toArray(payload)
  const paged = applyPagination(payload, records, page, pageSize, {
    page,
    pageSize,
    pageLength: records.length,
  })
  const rows = paged.rows.map((record, index) =>
    mapRow(record, paged.serialBase + index + 1),
  )
  return {
    rows,
    totalCount: paged.totalCount,
    totalPages: paged.totalPages,
    effectivePageSize: paged.effectivePageSize,
    serialBase: paged.serialBase,
  }
}

export async function fetchTripRequisitionsPage(
  search: string,
  page: number,
  pageSize: number,
  lookups?: { tripTypes?: TripMasterOption[]; purposes?: TripMasterOption[] },
  queryOptions?: { tripTypeId?: string },
): Promise<TripRequisitionsPageResult> {
  const payload = await apiGet<unknown>(listPath(search, page, pageSize, queryOptions))
  const records = toArray(payload)
  const paged = applyPagination(payload, records, page, pageSize, {
    page,
    pageSize,
    pageLength: records.length,
  })
  const rows = paged.rows.map((record, index) =>
    mapTripRequisitionListRow(record, paged.serialBase + index + 1, lookups),
  )
  return {
    rows,
    totalCount: paged.totalCount,
    totalPages: paged.totalPages,
    effectivePageSize: paged.effectivePageSize,
    serialBase: paged.serialBase,
  }
}

export async function fetchTripRequestsPage(
  search: string,
  page: number,
  pageSize: number,
  lookups?: { tripTypes?: TripMasterOption[] },
  queryOptions?: { tripTypeId?: string },
): Promise<TripRequestsPageResult> {
  const payload = await apiGet<unknown>(listPath(search, page, pageSize, queryOptions))
  const records = toArray(payload)
  const paged = applyPagination(payload, records, page, pageSize, {
    page,
    pageSize,
    pageLength: records.length,
  })
  const rows = paged.rows.map((record) => mapTripRequestListRow(record, lookups))
  return {
    rows,
    totalCount: paged.totalCount,
    totalPages: paged.totalPages,
    effectivePageSize: paged.effectivePageSize,
    serialBase: paged.serialBase,
    summary: extractTripRequestSummaryFromPayload(payload, rows),
  }
}

export type TripMovementOrderFile = {
  name: string
  sizeLabel?: string
  url?: string
}

export type TripDetail = {
  id: string
  requestId: string
  applicantName: string
  applicantDepartment: string
  employeeId: string
  designation: string
  agency: string
  department: string
  division: string
  subDivision: string
  contactNumber: string
  email: string
  tripType: string
  purposeOfJourney: string
  preferredVehicleType: string
  origin: string
  destination: string
  dateOfJourney: string
  timeOfJourney: string
  dateOfReturn?: string
  timeOfReturn?: string
  journeyStartDatetime?: string
  journeyEndDatetime?: string
  startOdometer?: number
  endOdometer?: number
  tripDurationDays?: number
  pickupRequired?: boolean
  pickupRequestedAt?: string | null
  remarks: string
  tripDetailsJustification?: string
  accompanyingOfficials: TripAccompanyingOfficial[]
  movementOrderFile?: TripMovementOrderFile
  suggestedVehicle: TripSuggestedVehicle
  suggestedDriver: TripSuggestedDriver
  systemSuggestedDriverId?: string
  systemSuggestedVehicleId?: string
  priority: TripRequestPriority
  status: string
  statusCode: string
  feedbackRating?: TripFeedbackRating
  feedbackReason?: string
  hasFeedback: boolean
}

export type TripDetailLookups = {
  tripTypes?: TripMasterOption[]
  purposes?: TripMasterOption[]
  vehicleTypes?: TripMasterOption[]
}

function readBoolean(record: ApiRecord, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = record[key]
    if (value === true || value === 1 || value === '1' || value === 'true') return true
    if (value === false || value === 0 || value === '0' || value === 'false') return false
  }
  return undefined
}

function readOptionalInteger(record: ApiRecord, keys: string[]): number | undefined {
  for (const key of keys) {
    const parsed = readOptionalNumber(record[key])
    if (parsed !== undefined) return Math.trunc(parsed)
  }
  return undefined
}

function basenameFromPath(value: string): string {
  const trimmed = value.trim().split('?')[0]?.trim() ?? ''
  if (!trimmed) return ''
  const parts = trimmed.split(/[/\\]/).filter(Boolean)
  return parts[parts.length - 1] ?? trimmed
}

function readMovementOrderFile(record: ApiRecord): TripMovementOrderFile | undefined {
  const source = withNestedTripFields(record)
  const block =
    pickNestedRecord(source, ['movement_order', 'movementOrder']) ??
    (source.movement_order_file &&
    typeof source.movement_order_file === 'object' &&
    !Array.isArray(source.movement_order_file)
      ? (source.movement_order_file as ApiRecord)
      : null)

  if (block) {
    const name =
      pickScalar(block, ['name', 'file_name', 'fileName', 'filename']) ||
      basenameFromPath(pickScalar(block, ['path', 'url', 'movement_order_path']))
    if (!name) return undefined

    const sizeRaw = readOptionalInteger(block, [
      'size',
      'file_size',
      'fileSize',
      'bytes',
      'movement_order_file_size',
    ])
    const sizeLabel =
      pickScalar(block, ['size_label', 'sizeLabel']) ||
      (sizeRaw != null ? formatFileSizeLabel(sizeRaw) : '')

    const url =
      pickScalar(block, ['url', 'download_url', 'downloadUrl']) ||
      (() => {
        const path = pickScalar(block, ['path', 'movement_order_path', 'movementOrderPath'])
        return path && /^https?:\/\//i.test(path) ? path : ''
      })()

    return {
      name,
      sizeLabel: sizeLabel || undefined,
      url: url || undefined,
    }
  }

  const fileName =
    pickScalar(source, ['movement_order_file_name', 'movementOrderFileName']) ||
    basenameFromPath(pickScalar(source, ['movement_order_path', 'movementOrderPath'])) ||
    basenameFromPath(
      pickScalar(source, ['movement_order_object_key', 'movementOrderObjectKey']),
    )
  if (!fileName) return undefined

  const sizeRaw = readOptionalInteger(source, [
    'movement_order_file_size',
    'movementOrderFileSize',
    'movement_order_size',
    'movementOrderSize',
    'file_size',
    'fileSize',
  ])
  const sizeLabel =
    pickScalar(source, ['movement_order_file_size_label', 'movementOrderFileSizeLabel']) ||
    (sizeRaw != null ? formatFileSizeLabel(sizeRaw) : '')

  const path = pickScalar(source, ['movement_order_path', 'movementOrderPath'])
  const url =
    pickScalar(source, [
      'movement_order_url',
      'movementOrderUrl',
      'movement_order_download_url',
      'movementOrderDownloadUrl',
    ]) || (path && /^https?:\/\//i.test(path) ? path : '')

  return {
    name: fileName,
    sizeLabel: sizeLabel || undefined,
    url: url || undefined,
  }
}

function readAccompanyingOfficials(record: ApiRecord): TripAccompanyingOfficial[] {
  const raw = record.accompanying_officials ?? record.accompanyingOfficials
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is ApiRecord => !!item && typeof item === 'object')
    .map((item) => ({
      employeeCid:
        pickScalar(item, ['cid', 'employee_cid', 'employeeCid', 'employee_id']) || '—',
      fullName:
        pickScalar(item, ['full_name', 'fullName', 'name', 'employee_name']) || '—',
    }))
}

function readSystemSuggestedIds(record: ApiRecord) {
  const recommendation = pickNestedRecord(record, ['recommendation'])
  const systemSuggestedDriverId =
    pickScalar(record, ['system_suggested_driver_id', 'systemSuggestedDriverId']) ||
    pickScalar(recommendation ?? {}, [
      'system_suggested_driver_id',
      'systemSuggestedDriverId',
    ])
  const systemSuggestedVehicleId =
    pickScalar(record, ['system_suggested_vehicle_id', 'systemSuggestedVehicleId']) ||
    pickScalar(recommendation ?? {}, [
      'system_suggested_vehicle_id',
      'systemSuggestedVehicleId',
    ])

  return {
    systemSuggestedDriverId: systemSuggestedDriverId || undefined,
    systemSuggestedVehicleId: systemSuggestedVehicleId || undefined,
  }
}

function readSuggestedBlocks(record: ApiRecord) {
  const assignment = mapAssignmentFromRecord(record)
  const recommendation = pickNestedRecord(record, ['recommendation'])
  const suggestedVehicleBlock =
    pickNestedRecord(record, [
      'suggested_vehicle',
      'suggestedVehicle',
      'recommended_vehicle',
      'recommendedVehicle',
      'system_suggested_vehicle',
      'systemSuggestedVehicle',
    ]) ??
    pickNestedRecord(recommendation ?? {}, [
      'suggested_vehicle',
      'suggestedVehicle',
      'vehicle',
      'recommended_vehicle',
    ]) ??
    (assignment.vehicle
      ? {
          plate_number: assignment.vehicle.plateNumber,
          model: assignment.vehicle.model,
          color: assignment.vehicle.color,
        }
      : null)
  const suggestedDriverBlock =
    pickNestedRecord(record, [
      'suggested_driver',
      'suggestedDriver',
      'recommended_driver',
      'recommendedDriver',
      'system_suggested_driver',
      'systemSuggestedDriver',
    ]) ??
    pickNestedRecord(recommendation ?? {}, [
      'suggested_driver',
      'suggestedDriver',
      'driver',
      'recommended_driver',
    ]) ??
    (assignment.driver
      ? {
          name: assignment.driver.name,
          contact: assignment.driver.contact,
        }
      : null)

  return { suggestedVehicleBlock, suggestedDriverBlock }
}

function readDriverLicenseNumber(record: ApiRecord): string {
  const licenseBlock = pickNestedRecord(record, [
    'license',
    'driver_license',
    'driverLicense',
    'driving_license',
    'drivingLicense',
  ])
  return (
    pickScalar(record, [
      'license_number',
      'license_no',
      'licenseNumber',
      'driving_license_number',
      'driver_license_number',
      'driver_license_no',
    ]) ||
    pickScalar(licenseBlock ?? {}, [
      'license_number',
      'license_no',
      'licenseNumber',
      'number',
    ]) ||
    ''
  )
}

function mapUserRecordToSuggestedDriver(record: ApiRecord): TripSuggestedDriver {
  const firstName = pickScalar(record, ['first_name', 'firstName'])
  const middleName = pickScalar(record, ['middle_name', 'middleName'])
  const lastName = pickScalar(record, ['last_name', 'lastName'])
  const name =
    pickScalar(record, ['name', 'full_name', 'fullName', 'display_name']) ||
    [firstName, middleName, lastName].filter(Boolean).join(' ').trim() ||
    '—'
  const contact =
    pickScalar(record, [
      'contact',
      'contact_no',
      'contact_number',
      'phone',
      'mobile',
    ]) || '—'
  const licenseNumber = readDriverLicenseNumber(record)

  return {
    name,
    rating: readNumber(record.rating ?? record.driver_rating ?? record.driverRating),
    contact,
    licenseNumber: licenseNumber || undefined,
  }
}

function mapVehicleRecordToSuggestedVehicle(record: ApiRecord): TripSuggestedVehicle {
  const make = pickScalar(record, ['make', 'vehicle_make', 'manufacturerName', 'manufacturer'])
  const model =
    pickScalar(record, ['model', 'vehicle_model', 'assetName']) ||
    pickScalar(record, ['make_model', 'makeModel']) ||
    '—'

  return {
    plateNumber:
      pickScalar(record, [
        'registration_number',
        'registrationNumber',
        'vehicle_number',
        'plate_number',
      ]) || '—',
    make: make || '—',
    model,
    fuelEfficiency: formatFuelEfficiency(record),
    color: pickScalar(record, ['color', 'vehicle_color']) || '—',
  }
}

function mapSuggestedVehicleFromBlock(block: ApiRecord | null): TripSuggestedVehicle {
  if (!block) {
    return {
      plateNumber: '—',
      make: '—',
      model: '—',
      fuelEfficiency: '—',
      color: '—',
    }
  }
  return mapVehicleRecordToSuggestedVehicle(block)
}

function mapSuggestedDriverFromBlock(block: ApiRecord | null): TripSuggestedDriver {
  if (!block) {
    return { name: '—', rating: 0, contact: '—' }
  }
  return {
    name: pickScalar(block, ['name', 'full_name', 'driver_name']) || '—',
    rating: readNumber(block.rating ?? block.driver_rating ?? block.driverRating),
    contact:
      pickScalar(block, ['contact', 'contact_number', 'phone', 'mobile']) || '—',
    licenseNumber: readDriverLicenseNumber(block) || undefined,
  }
}

async function fetchSuggestedDriverById(driverId: string): Promise<TripSuggestedDriver> {
  const record = await fetchUserById(driverId)
  return mapUserRecordToSuggestedDriver(record)
}

async function fetchSuggestedVehicleById(vehicleId: string): Promise<TripSuggestedVehicle> {
  const record = await fetchVehicleById(vehicleId)
  return mapVehicleRecordToSuggestedVehicle(record)
}

export async function enrichTripDetailSuggestions(trip: TripDetail): Promise<TripDetail> {
  const [driver, vehicle] = await Promise.all([
    trip.systemSuggestedDriverId
      ? fetchSuggestedDriverById(trip.systemSuggestedDriverId).catch(() => null)
      : Promise.resolve(null),
    trip.systemSuggestedVehicleId
      ? fetchSuggestedVehicleById(trip.systemSuggestedVehicleId).catch(() => null)
      : Promise.resolve(null),
  ])

  return {
    ...trip,
    suggestedDriver: driver ?? trip.suggestedDriver,
    suggestedVehicle: vehicle ?? trip.suggestedVehicle,
  }
}

function isMissingSuggestedDriver(driver: TripSuggestedDriver): boolean {
  return !driver.name || driver.name === '—' || isUuidLike(driver.name)
}

function isMissingSuggestedVehicle(vehicle: TripSuggestedVehicle): boolean {
  const plate = vehicle.plateNumber?.trim() ?? ''
  const model = vehicle.model?.trim() ?? ''
  const hasPlate = Boolean(plate && plate !== '—' && !isUuidLike(plate))
  const hasModel = Boolean(model && model !== '—')
  return !hasPlate && !hasModel
}

async function enrichTripDetailAssignment(
  trip: TripDetail,
  record: ApiRecord,
): Promise<TripDetail> {
  const source = withNestedTripFields(record)
  const driverId = pickAssignedDriverId(source)
  const vehicleId = pickAssignedVehicleId(source)

  const [driver, vehicle] = await Promise.all([
    isMissingSuggestedDriver(trip.suggestedDriver) && driverId
      ? fetchSuggestedDriverById(driverId).catch(() => null)
      : Promise.resolve(null),
    isMissingSuggestedVehicle(trip.suggestedVehicle) && vehicleId
      ? fetchSuggestedVehicleById(vehicleId).catch(() => null)
      : Promise.resolve(null),
  ])

  return {
    ...trip,
    suggestedDriver: driver ?? trip.suggestedDriver,
    suggestedVehicle: vehicle ?? trip.suggestedVehicle,
    systemSuggestedDriverId: trip.systemSuggestedDriverId || driverId || undefined,
    systemSuggestedVehicleId: trip.systemSuggestedVehicleId || vehicleId || undefined,
  }
}

export function mapTripDetail(
  record: ApiRecord,
  lookups?: TripDetailLookups,
): TripDetail {
  const id = pickScalar(record, ['id', 'trip_id', 'tripId', 'uuid'])
  const requestId =
    pickScalar(record, [
      'reference_no',
      'referenceNo',
      'request_id',
      'requestId',
      'trip_reference',
      'reference',
      'trip_code',
    ]) || id
  const applicant = readApplicantBlock(record)
  const applicantName =
    pickScalar(record, ['applicant_name', 'applicantName', 'employee_name', 'employeeName']) ||
    pickScalar(applicant ?? {}, ['name', 'full_name', 'fullName', 'employee_name']) ||
    '—'
  const applicantDepartment =
    pickScalar(record, ['applicant_department', 'applicantDepartment', 'department_name']) ||
    pickScalar(applicant ?? {}, ['department', 'department_name', 'departmentName']) ||
    '—'
  const employeeId = readApplicantEmployeeId(record)
  const designation =
    pickScalar(record, ['designation', 'designation_name', 'designationName']) ||
    pickScalar(applicant ?? {}, ['designation', 'designation_name', 'title']) ||
    '—'
  const agency =
    pickScalar(record, ['agency', 'agency_name', 'agencyName']) ||
    pickScalar(applicant ?? {}, ['agency', 'agency_name']) ||
    '—'
  const department =
    pickScalar(record, ['department', 'department_name', 'departmentName']) ||
    applicantDepartment ||
    '—'
  const division =
    pickScalar(record, ['division', 'division_name', 'divisionName']) ||
    pickScalar(applicant ?? {}, ['division', 'division_name']) ||
    '—'
  const subDivision =
    pickScalar(record, ['sub_division', 'subDivision', 'sub_division_name', 'subDivisionName']) ||
    pickScalar(applicant ?? {}, ['sub_division', 'subDivision', 'sub_division_name']) ||
    '—'
  const contactNumber =
    pickScalar(record, ['contact_number', 'contactNumber', 'phone', 'mobile']) ||
    pickScalar(applicant ?? {}, ['contact', 'contact_number', 'phone', 'mobile']) ||
    '—'
  const email =
    pickScalar(record, ['email', 'email_address', 'emailAddress']) ||
    pickScalar(applicant ?? {}, ['email', 'email_address']) ||
    '—'
  const tripType = resolveTripTypeLabel(record, lookups?.tripTypes) || '—'
  const purposeOfJourney = resolvePurposeLabel(record, lookups?.purposes) || '—'
  const preferredVehicleTypeId = pickScalar(record, [
    'preferred_vehicle_type_id',
    'preferredVehicleTypeId',
  ])
  const preferredVehicleType =
    pickScalar(record, [
      'preferred_vehicle_type_name',
      'preferredVehicleTypeName',
      'preferred_vehicle_type_label',
    ]) ||
    (lookups?.vehicleTypes && preferredVehicleTypeId
      ? labelForMasterOption(lookups.vehicleTypes, preferredVehicleTypeId)
      : preferredVehicleTypeId) ||
    '—'
  const journeyStartRaw = readJourneyStartDatetime(record)
  const journeyEndRaw = pickScalar(record, [
    'journey_end_datetime',
    'journeyEndDatetime',
    'date_of_return',
    'return_date',
  ])
  const origin = pickScalar(record, ['origin', 'origin_location', 'from_location']) || '—'
  const destination = readDestination(record)
  const pickupRequired = readBoolean(record, ['pickup_required', 'pickupRequired'])
  const pickupRequestedAt =
    pickScalar(record, ['pickup_requested_at', 'pickupRequestedAt']) || null
  const tripDetailsJustification = pickScalar(record, [
    'trip_details_justification',
    'tripDetailsJustification',
  ])
  const remarks =
    pickScalar(record, ['remarks', 'notes', 'comment']) ||
    tripDetailsJustification ||
    '—'
  const movementOrderFile = readMovementOrderFile(record)
  const priorityRaw = pickScalar(record, ['priority', 'trip_priority', 'tripPriority'])
  const statusCode = readTripStatusCode(record)
  const status = readTripDisplayStatus(record)
  const { systemSuggestedDriverId, systemSuggestedVehicleId } = readSystemSuggestedIds(record)
  const { suggestedVehicleBlock, suggestedDriverBlock } = readSuggestedBlocks(record)
  const tripFeedback = readTripFeedback(record)

  return {
    id: id || requestId,
    requestId: requestId || id || '—',
    applicantName,
    applicantDepartment,
    employeeId,
    designation,
    agency,
    department,
    division,
    subDivision,
    contactNumber,
    email,
    tripType,
    purposeOfJourney,
    preferredVehicleType,
    origin,
    destination,
    dateOfJourney: formatTripDisplayDate(journeyStartRaw),
    timeOfJourney: formatTripDisplayTime(
      pickScalar(record, ['time_of_journey', 'journey_time', 'journeyTime']) ||
        journeyStartRaw,
    ),
    dateOfReturn: journeyEndRaw ? formatTripDisplayDate(journeyEndRaw) : undefined,
    timeOfReturn: journeyEndRaw ? formatTripDisplayTime(journeyEndRaw) : undefined,
    journeyStartDatetime: journeyStartRaw || undefined,
    journeyEndDatetime: journeyEndRaw || undefined,
    startOdometer: readOptionalInteger(record, ['start_odometer', 'startOdometer']),
    endOdometer: readOptionalInteger(record, ['end_odometer', 'endOdometer']),
    tripDurationDays: readOptionalInteger(record, [
      'trip_duration_days',
      'tripDurationDays',
      'duration_days',
    ]),
    pickupRequired,
    pickupRequestedAt,
    remarks,
    tripDetailsJustification: tripDetailsJustification || undefined,
    accompanyingOfficials: readAccompanyingOfficials(record),
    movementOrderFile,
    suggestedVehicle: mapSuggestedVehicleFromBlock(suggestedVehicleBlock),
    suggestedDriver: mapSuggestedDriverFromBlock(suggestedDriverBlock),
    systemSuggestedDriverId,
    systemSuggestedVehicleId,
    priority: priorityRaw ? normalizeTripRequestPriority(priorityRaw) : 'Normal',
    status,
    statusCode,
    feedbackRating: tripFeedback?.rating,
    feedbackReason: tripFeedback?.reason,
    hasFeedback: readHasFeedback(record),
  }
}

export async function fetchTripDetail(
  tripId: string,
  lookups?: TripDetailLookups,
): Promise<TripDetail> {
  const trimmed = tripId.trim()
  if (!trimmed) throw new Error('Trip ID is required')
  const payload = await apiGet<unknown>(`/trips/${encodeURIComponent(trimmed)}`)
  const record = unwrapDataRecord(payload)
  if (!record) throw new Error('Trip not found')
  const trip = mapTripDetail(record, lookups)
  const withSuggestions = await enrichTripDetailSuggestions(trip)
  return enrichTripDetailAssignment(withSuggestions, record)
}

function pickFileUrlFromPayload(payload: unknown): string {
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
      'movement_order_url',
      'movementOrderUrl',
      'signed_url',
      'signedUrl',
    ]) || ''
  )
}

function guessMovementOrderMimeType(fileName: string): string {
  const lower = fileName.trim().toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  return 'application/octet-stream'
}

/** GET `/trips/{id}/movement-order` and open the file in a new browser tab. */
export async function openTripMovementOrder(
  tripId: string,
  fileName = '',
  targetWindow?: Window | null,
): Promise<void> {
  const trimmed = tripId.trim()
  if (!trimmed) throw new Error('Trip ID is required')

  try {
    const { blob, contentType } = await apiGetBlob(
      `/trips/${encodeURIComponent(trimmed)}/movement-order`,
    )

    if (contentType.includes('application/json')) {
      const payload = JSON.parse(await blob.text()) as unknown
      const url = pickFileUrlFromPayload(payload)
      if (!url) throw new Error('Movement order URL not found')
      navigateBrowserTab(targetWindow, url)
      return
    }

    const mimeType =
      contentType && contentType !== 'application/octet-stream'
        ? contentType
        : guessMovementOrderMimeType(fileName)
    const fileBlob = mimeType === blob.type ? blob : blob.slice(0, blob.size, mimeType)
    const objectUrl = URL.createObjectURL(fileBlob)
    navigateBrowserTab(targetWindow, objectUrl)
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
  } catch (error) {
    closeBrowserTab(targetWindow)
    throw error
  }
}

function readAssignedVehiclePlate(record: ApiRecord): string {
  const assignment = mapAssignmentFromRecord(record)
  if (assignment.vehicle?.plateNumber && assignment.vehicle.plateNumber !== '—') {
    return assignment.vehicle.plateNumber
  }

  const vehicleBlock =
    pickNestedRecord(record, [
      'assigned_vehicle',
      'assignedVehicle',
      'suggested_vehicle',
      'suggestedVehicle',
      'vehicle',
    ]) ?? null
  if (!vehicleBlock) return '—'

  return (
    pickScalar(vehicleBlock, [
      'plate_number',
      'registration_number',
      'registrationNumber',
      'vehicle_number',
    ]) || '—'
  )
}

export function mapDriverAssignmentListRow(
  record: ApiRecord,
  lookups?: { tripTypes?: TripMasterOption[] },
): DriverAssignmentListItem {
  const source = withNestedTripFields(record)
  const id = pickScalar(source, ['id', 'trip_id', 'tripId', 'uuid'])
  const requestId =
    pickScalar(source, [
      'reference_no',
      'referenceNo',
      'request_id',
      'requestId',
      'trip_reference',
      'reference',
      'trip_code',
    ]) || id
  const applicant = pickNestedRecord(source, ['applicant', 'employee', 'user', 'requester'])
  const applicantName =
    pickScalar(source, ['applicant_name', 'applicantName', 'employee_name', 'employeeName']) ||
    pickScalar(applicant ?? {}, ['name', 'full_name', 'fullName', 'employee_name']) ||
    '—'
  const applicantDepartment =
    pickScalar(source, ['applicant_department', 'applicantDepartment', 'department_name']) ||
    pickScalar(applicant ?? {}, ['department', 'department_name', 'departmentName']) ||
    '—'
  const applicantAgency =
    pickScalar(source, ['agency', 'agency_name', 'agencyName', 'applicant_agency', 'applicantAgency']) ||
    pickScalar(applicant ?? {}, ['agency', 'agency_name']) ||
    '—'
  const tripType = resolveTripTypeLabel(source, lookups?.tripTypes) || '—'
  const origin = pickScalar(source, ['origin', 'origin_location', 'from_location']) || '—'
  const destination = readDestination(record)
  const journeyStartRaw = readJourneyStartDatetime(source)
  const statusCode = readTripStatusCode(source)
  const status = readTripDisplayStatus(source)

  return {
    id: id || requestId,
    requestId: requestId || id || '—',
    applicantName,
    applicantAgency,
    applicantDepartment,
    tripType,
    origin,
    destination,
    vehiclePlate: readAssignedVehiclePlate(source),
    journeyStartDate: formatTripDisplayDate(journeyStartRaw),
    journeyStartTime: formatTripDisplayTime(journeyStartRaw),
    status,
    statusCode,
    hasFeedback: readHasFeedback(source),
  }
}

export type DriverAssignmentsPageResult = TripsPageResult<DriverAssignmentListItem>

export async function fetchDriverAssignmentsPage(
  search: string,
  page: number,
  pageSize: number,
  lookups?: { tripTypes?: TripMasterOption[] },
  queryOptions?: { tripTypeId?: string },
): Promise<DriverAssignmentsPageResult> {
  return fetchTripsPage(search, page, pageSize, (record) =>
    mapDriverAssignmentListRow(record, lookups),
    queryOptions,
  )
}

export type StartTripBody = {
  start_odometer: number
}

export type CompleteTripBody = {
  end_odometer: number
}

export type CancelTripBody = {
  cancellation_reason: string
}

export async function cancelTrip(
  tripId: string,
  cancellationReason: string,
): Promise<void> {
  const trimmed = tripId.trim()
  const reason = cancellationReason.trim()
  if (!trimmed) throw new Error('Trip ID is required')
  if (!reason) throw new Error('Cancellation reason is required')
  await apiPost<unknown, CancelTripBody>(
    `/trips/${encodeURIComponent(trimmed)}/cancel`,
    { cancellation_reason: reason },
  )
}

export type CallTripPickupBody = {
  employee_id: string
  trip_id: string
}

export async function callTripPickup(
  tripId: string,
  employeeId: string,
): Promise<void> {
  const trip_id = tripId.trim()
  const employee_id = employeeId.trim()
  if (!trip_id) throw new Error('Trip ID is required')
  if (!employee_id) throw new Error('Applicant employee ID is required')
  await apiPost<unknown, CallTripPickupBody>('/trips/pickup', {
    employee_id,
    trip_id,
  })
}

export type RejectTripBody = {
  remarks: string
}

/** Approve a trip request and assign suggested vehicle/driver (no request body). */
export async function approveTripAssign(tripId: string): Promise<void> {
  const trimmed = tripId.trim()
  if (!trimmed) throw new Error('Trip ID is required')
  await apiClient<unknown>(`/trips/${encodeURIComponent(trimmed)}/assign`, {
    method: 'POST',
  })
}

export async function rejectTrip(tripId: string, remarks: string): Promise<void> {
  const trimmed = tripId.trim()
  const reason = remarks.trim()
  if (!trimmed) throw new Error('Trip ID is required')
  if (!reason) throw new Error('Rejection remarks are required')
  await apiPost<unknown, RejectTripBody>(
    `/trips/${encodeURIComponent(trimmed)}/reject`,
    { remarks: reason },
  )
}

export type OverrideTripBody = {
  assign_vehicle_id: string
  assign_driver_id: string
  remarks: string
}

export async function overrideTripAssignment(
  tripId: string,
  input: { vehicleId: string; driverId: string; remarks: string },
): Promise<void> {
  const trimmed = tripId.trim()
  const vehicleId = input.vehicleId.trim()
  const driverId = input.driverId.trim()
  if (!trimmed) throw new Error('Trip ID is required')
  if (!vehicleId) throw new Error('Vehicle is required')
  if (!driverId) throw new Error('Driver is required')
  await apiPost<unknown, OverrideTripBody>(
    `/trips/${encodeURIComponent(trimmed)}/override`,
    {
      assign_vehicle_id: vehicleId,
      assign_driver_id: driverId,
      remarks: input.remarks.trim(),
    },
  )
}

export async function startTrip(tripId: string, startOdometer: number): Promise<void> {
  const trimmed = tripId.trim()
  if (!trimmed) throw new Error('Trip ID is required')
  await apiPost<unknown, StartTripBody>(
    `/trips/${encodeURIComponent(trimmed)}/start`,
    { start_odometer: startOdometer },
  )
}

export async function completeTrip(tripId: string, endOdometer: number): Promise<void> {
  const trimmed = tripId.trim()
  if (!trimmed) throw new Error('Trip ID is required')
  await apiPost<unknown, CompleteTripBody>(
    `/trips/${encodeURIComponent(trimmed)}/complete`,
    { end_odometer: endOdometer },
  )
}

function normalizeFeedbackRating(value: string | number): TripFeedbackRating | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const stars = Math.min(5, Math.max(1, Math.round(value)))
    return TRIP_FEEDBACK_RATINGS[stars - 1]
  }
  const normalized = String(value).trim().toUpperCase().replace(/[\s-]+/g, '_')
  if (
    normalized === 'POOR' ||
    normalized === 'FAIR' ||
    normalized === 'GOOD' ||
    normalized === 'VERY_GOOD' ||
    normalized === 'EXCELLENT'
  ) {
    return normalized
  }
  const parsed = Number(value)
  if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 5) {
    return TRIP_FEEDBACK_RATINGS[Math.round(parsed) - 1]
  }
  return undefined
}

function readTripFeedback(record: ApiRecord): {
  rating?: TripFeedbackRating
  reason?: string
} | null {
  const feedbackBlock = pickNestedRecord(record, [
    'feedback',
    'driver_feedback',
    'driverFeedback',
    'trip_feedback',
    'tripFeedback',
  ])
  const ratingRaw =
    pickScalar(record, ['rating', 'feedback_rating', 'feedbackRating']) ||
    pickScalar(feedbackBlock ?? {}, ['rating', 'feedback_rating', 'feedbackRating'])
  const ratingFromNumber = readOptionalInteger(record, [
    'rating',
    'feedback_rating',
    'feedbackRating',
    'stars',
  ])
  const ratingFromNestedNumber = feedbackBlock
    ? readOptionalInteger(feedbackBlock, ['rating', 'feedback_rating', 'feedbackRating', 'stars'])
    : undefined
  const rating =
    (ratingRaw ? normalizeFeedbackRating(ratingRaw) : undefined) ??
    (ratingFromNumber != null ? normalizeFeedbackRating(ratingFromNumber) : undefined) ??
    (ratingFromNestedNumber != null ? normalizeFeedbackRating(ratingFromNestedNumber) : undefined)
  const reason =
    pickScalar(record, [
      'reason_for_rating',
      'reasonForRating',
      'feedback_reason',
      'feedbackReason',
      'comments',
    ]) ||
    pickScalar(feedbackBlock ?? {}, [
      'reason_for_rating',
      'reasonForRating',
      'feedback_reason',
      'comments',
    ]) ||
    undefined
  if (!rating && !reason) return null
  return { rating, reason }
}

function readHasFeedback(record: ApiRecord): boolean {
  const source = withNestedTripFields(record)
  const fromBoolean = readBoolean(source, ['has_feedback', 'hasFeedback'])
  if (fromBoolean !== undefined) return fromBoolean
  return Boolean(readTripFeedback(source)?.rating)
}

function readAssignedDriverName(record: ApiRecord): string {
  const assignment = mapAssignmentFromRecord(record)
  if (assignment.driver?.name && assignment.driver.name !== '—') {
    return assignment.driver.name
  }

  const driverBlock =
    pickNestedRecord(record, [
      'assigned_driver',
      'assignedDriver',
      'suggested_driver',
      'suggestedDriver',
      'driver',
    ]) ?? null
  if (!driverBlock) return '—'

  return (
    pickScalar(driverBlock, ['name', 'full_name', 'fullName', 'driver_name']) || '—'
  )
}

function pickAssignedDriverId(record: ApiRecord): string {
  const source = withNestedTripFields(record)
  const driverBlock =
    pickNestedRecord(source, [
      'assigned_driver',
      'assignedDriver',
      'suggested_driver',
      'suggestedDriver',
      'driver',
    ]) ?? null

  return (
    pickScalar(source, [
      'assign_driver_id',
      'assigned_driver_id',
      'assignedDriverId',
      'driver_id',
      'driverId',
    ]) ||
    pickScalar(driverBlock ?? {}, ['id', 'driver_id', 'driverId', 'user_id', 'userId']) ||
    pickScalar(source, ['system_suggested_driver_id', 'systemSuggestedDriverId']) ||
    ''
  )
}

function pickAssignedVehicleId(record: ApiRecord): string {
  const source = withNestedTripFields(record)
  const vehicleBlock =
    pickNestedRecord(source, [
      'assigned_vehicle',
      'assignedVehicle',
      'suggested_vehicle',
      'suggestedVehicle',
      'vehicle',
    ]) ?? null

  return (
    pickScalar(source, [
      'assign_vehicle_id',
      'assigned_vehicle_id',
      'assignedVehicleId',
      'vehicle_id',
      'vehicleId',
    ]) ||
    pickScalar(vehicleBlock ?? {}, ['id', 'vehicle_id', 'vehicleId', 'uuid']) ||
    pickScalar(source, ['system_suggested_vehicle_id', 'systemSuggestedVehicleId']) ||
    ''
  )
}

function isMissingTripDisplayName(value: string): boolean {
  const trimmed = value.trim()
  return !trimmed || trimmed === '—' || isUuidLike(trimmed)
}

async function resolveFeedbackDriverNames(driverIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(driverIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()

  const entries = await Promise.all(
    uniqueIds.map(async (driverId) => {
      try {
        const record = await fetchUserById(driverId)
        const driver = mapUserRecordToSuggestedDriver(record)
        return [driverId, driver.name !== '—' ? driver.name : driverId] as const
      } catch {
        return [driverId, driverId] as const
      }
    }),
  )

  return new Map(entries)
}

async function resolveFeedbackVehicleDetails(
  vehicleIds: string[],
): Promise<Map<string, { plate: string; model: string }>> {
  const uniqueIds = [...new Set(vehicleIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()

  const entries = await Promise.all(
    uniqueIds.map(async (vehicleId) => {
      try {
        const record = await fetchVehicleById(vehicleId)
        const row = mapVehicleRecordToListRow(record)
        return [
          vehicleId,
          {
            plate:
              row.registration_number !== '—' && !isUuidLike(row.registration_number)
                ? row.registration_number
                : vehicleId,
            model: row.makeModel !== '—' ? row.makeModel : '—',
          },
        ] as const
      } catch {
        return [vehicleId, { plate: vehicleId, model: '—' }] as const
      }
    }),
  )

  return new Map(entries)
}

async function enrichDriverFeedbackRows(
  rows: DriverFeedbackListItem[],
): Promise<DriverFeedbackListItem[]> {
  const driverIds = rows
    .filter((row) => isMissingTripDisplayName(row.driverName))
    .map((row) => row.driverId ?? '')
  const vehicleIds = rows
    .filter(
      (row) =>
        isMissingTripDisplayName(row.vehiclePlate) && isMissingTripDisplayName(row.vehicleModel),
    )
    .map((row) => row.vehicleId ?? '')

  const [driverNames, vehicleDetails] = await Promise.all([
    resolveFeedbackDriverNames(driverIds),
    resolveFeedbackVehicleDetails(vehicleIds),
  ])

  return rows.map((row) => {
    const vehicleDetail = row.vehicleId ? vehicleDetails.get(row.vehicleId) : undefined
    return {
      ...row,
      driverName: !isMissingTripDisplayName(row.driverName)
        ? row.driverName
        : row.driverId
          ? (driverNames.get(row.driverId) ?? row.driverName)
          : row.driverName,
      vehiclePlate:
        !isMissingTripDisplayName(row.vehiclePlate)
          ? row.vehiclePlate
          : vehicleDetail?.plate && !isMissingTripDisplayName(vehicleDetail.plate)
            ? vehicleDetail.plate
            : row.vehiclePlate,
      vehicleModel:
        !isMissingTripDisplayName(row.vehicleModel)
          ? row.vehicleModel
          : vehicleDetail?.model && !isMissingTripDisplayName(vehicleDetail.model)
            ? vehicleDetail.model
            : row.vehicleModel,
    }
  })
}

function readAssignedVehicleModel(record: ApiRecord): string {
  const assignment = mapAssignmentFromRecord(record)
  if (assignment.vehicle?.model && assignment.vehicle.model !== '—') {
    return assignment.vehicle.model
  }

  const vehicleBlock =
    pickNestedRecord(record, [
      'assigned_vehicle',
      'assignedVehicle',
      'suggested_vehicle',
      'suggestedVehicle',
      'vehicle',
    ]) ?? null
  if (!vehicleBlock) return '—'

  const make = pickScalar(vehicleBlock, ['make', 'vehicle_make', 'manufacturerName'])
  const model =
    pickScalar(vehicleBlock, ['model', 'vehicle_model', 'make_model', 'assetName']) || '—'
  const parts = [make, model].filter((part) => part && part !== '—')
  return parts.length > 0 ? parts.join(' ') : model
}

export function mapDriverFeedbackListRow(
  record: ApiRecord,
  lookups?: { tripTypes?: TripMasterOption[] },
): DriverFeedbackListItem {
  const source = withNestedTripFields(record)
  const id = pickScalar(source, ['id', 'trip_id', 'tripId', 'uuid'])
  const tripId =
    pickScalar(source, [
      'reference_no',
      'referenceNo',
      'request_id',
      'requestId',
      'trip_reference',
      'reference',
      'trip_code',
    ]) || id
  const journeyStartRaw = readJourneyStartDatetime(source)
  const status = readTripDisplayStatus(source)
  const tripType = resolveTripTypeLabel(source, lookups?.tripTypes) || '—'
  const driverId = pickAssignedDriverId(source)
  const vehicleId = pickAssignedVehicleId(source)
  const hasFeedback = readHasFeedback(source)

  return {
    id: id || tripId,
    tripId: tripId || id || '—',
    tripType,
    date: formatTripDisplayDate(journeyStartRaw),
    origin: pickScalar(source, ['origin', 'origin_location', 'from_location']) || '—',
    destination: readDestination(record),
    vehiclePlate: readAssignedVehiclePlate(source),
    vehicleModel: readAssignedVehicleModel(source),
    driverName: readAssignedDriverName(source),
    driverId: driverId || undefined,
    vehicleId: vehicleId || undefined,
    tripStatus: status,
    feedbackStatus: hasFeedback ? 'Completed' : 'Pending',
  }
}

export type DriverFeedbackTripsPageResult = TripsPageResult<DriverFeedbackListItem>

export async function fetchDriverFeedbackTripsPage(
  search: string,
  page: number,
  pageSize: number,
  lookups?: { tripTypes?: TripMasterOption[] },
  queryOptions?: { tripTypeId?: string },
): Promise<DriverFeedbackTripsPageResult> {
  const result = await fetchTripsPage(
    search,
    page,
    pageSize,
    (record) => mapDriverFeedbackListRow(record, lookups),
    { status: 'COMPLETED', tripTypeId: queryOptions?.tripTypeId },
  )
  const enrichedRows = await enrichDriverFeedbackRows(result.rows)
  return {
    ...result,
    rows: enrichedRows,
  }
}

export function mapTripDetailToDriverFeedbackTrip(trip: TripDetail): DriverFeedbackTrip {
  const driverName = trip.suggestedDriver.name !== '—' ? trip.suggestedDriver.name : '—'
  const driverContact =
    trip.suggestedDriver.contact !== '—' ? trip.suggestedDriver.contact : '—'
  const vehiclePlate =
    trip.suggestedVehicle.plateNumber !== '—' ? trip.suggestedVehicle.plateNumber : '—'
  const vehicleModelRaw = formatSuggestedVehicleMakeModel(trip.suggestedVehicle)
  const vehicleModel =
    vehicleModelRaw !== '—' ? vehicleModelRaw : trip.suggestedVehicle.model
  const hasFeedback = trip.hasFeedback
  const tripType =
    trip.tripType && trip.tripType !== '—' && !isUuidLike(trip.tripType)
      ? trip.tripType
      : '—'

  return {
    id: trip.id,
    tripId: trip.requestId,
    tripType,
    date: trip.dateOfJourney,
    origin: trip.origin,
    destination: trip.destination,
    vehiclePlate,
    vehicleModel,
    driverName,
    tripStatus: trip.status,
    feedbackStatus: hasFeedback ? 'Completed' : 'Pending',
    driverInitials: initialsFromName(driverName),
    driverRole: 'Driver',
    driverContact,
    driverOverallRating:
      trip.suggestedDriver.rating > 0 ? trip.suggestedDriver.rating : 0,
    driverCompletedTrips: 0,
    driverRecommendation: '—',
    submittedRating: trip.feedbackRating
      ? feedbackRatingToStars(trip.feedbackRating)
      : undefined,
    submittedComments: trip.feedbackReason,
    submittedRatingCode: trip.feedbackRating,
  }
}

export type SubmitTripFeedbackBody = {
  rating: TripFeedbackRating
  reason_for_rating: string
}

export type TripFeedback = {
  rating: TripFeedbackRating
  reasonForRating: string
}

function mapTripFeedbackRecord(record: ApiRecord): TripFeedback | null {
  const parsed = readTripFeedback(record)
  if (!parsed?.rating) return null
  return {
    rating: parsed.rating,
    reasonForRating: parsed.reason ?? '',
  }
}

export async function fetchTripFeedback(tripId: string): Promise<TripFeedback> {
  const trimmed = tripId.trim()
  if (!trimmed) throw new Error('Trip ID is required')
  const payload = await apiGet<unknown>(`/trips/${encodeURIComponent(trimmed)}/feedback`)
  let record = unwrapDataRecord(payload)
  if (!record && Array.isArray(payload) && payload[0] && typeof payload[0] === 'object') {
    record = payload[0] as ApiRecord
  }
  if (!record && payload && typeof payload === 'object') {
    const root = payload as ApiRecord
    const items = root.items ?? root.results
    if (Array.isArray(items) && items[0] && typeof items[0] === 'object') {
      record = items[0] as ApiRecord
    }
  }
  if (!record) throw new Error('Feedback not found')
  const feedback = mapTripFeedbackRecord(record)
  if (!feedback) throw new Error('Feedback not found')
  return feedback
}

export async function submitTripFeedback(
  tripId: string,
  rating: TripFeedbackRating,
  reasonForRating: string,
): Promise<void> {
  const trimmed = tripId.trim()
  if (!trimmed) throw new Error('Trip ID is required')
  await apiPost<unknown, SubmitTripFeedbackBody>(
    `/trips/${encodeURIComponent(trimmed)}/feedback`,
    {
      rating,
      reason_for_rating: reasonForRating,
    },
  )
}

export type AccompanyingOfficialInput = {
  cid: string
  fullName: string
}

export type TripOfficialLookup = {
  cid: string
  fullName: string
  name: string
}

export type CreateTripRequisitionInput = {
  employeeId: string
  tripTypeId: string
  purposeId: string
  preferredVehicleTypeId: string
  journeyStartDatetime: string
  journeyEndDatetime?: string
  tripDurationDays?: number
  origin: string
  destinationDetails: string
  pickupRequired?: boolean
  isMovementOrderRequired: boolean
  tripDetailsJustification?: string
  accompanyingOfficials: AccompanyingOfficialInput[]
  movementOrderFile?: File | null
}

export async function lookupTripOfficialByCid(cid: string): Promise<TripOfficialLookup> {
  const trimmed = cid.trim()
  if (!trimmed) throw new Error('CID is required')
  const payload = await apiGet<unknown>(
    `/trips/officials/lookup?cid=${encodeURIComponent(trimmed)}`,
  )
  const record = unwrapDataRecord(payload) ?? (payload as ApiRecord)
  const fullName =
    pickScalar(record, ['full_name', 'fullName', 'employee_name', 'employeeName']) ||
    pickScalar(record, ['name', 'display_name', 'displayName'])
  const name = pickScalar(record, ['name', 'first_name', 'firstName']) || fullName
  const cidResolved = pickScalar(record, ['cid', 'employee_cid', 'employeeCid']) || trimmed
  if (!fullName && !name) throw new Error('No official found for this CID')
  return {
    cid: cidResolved,
    fullName: fullName || name,
    name: name || fullName,
  }
}

export type TripAssignmentVehicle = {
  plateNumber: string
  model: string
  color: string
}

export type TripAssignmentDriver = {
  name: string
  contact: string
}

export type CreateTripRequisitionResult = {
  tripId: string
  status: string
  tripTypeLabel: string
  dateOfJourney: string
  timeOfJourney: string
  origin: string
  destination: string
  purposeOfJourney: string
  autoApproved: boolean
  vehicle?: TripAssignmentVehicle
  driver?: TripAssignmentDriver
}

function mapAssignmentFromRecord(record: ApiRecord): Pick<
  CreateTripRequisitionResult,
  'vehicle' | 'driver'
> {
  const vehicleBlock =
    (record.vehicle && typeof record.vehicle === 'object'
      ? (record.vehicle as ApiRecord)
      : null) ??
    (record.assigned_vehicle && typeof record.assigned_vehicle === 'object'
      ? (record.assigned_vehicle as ApiRecord)
      : null)
  const driverBlock =
    (record.driver && typeof record.driver === 'object'
      ? (record.driver as ApiRecord)
      : null) ??
    (record.assigned_driver && typeof record.assigned_driver === 'object'
      ? (record.assigned_driver as ApiRecord)
      : null)

  const vehicle = vehicleBlock
    ? {
        plateNumber:
          pickScalar(vehicleBlock, [
            'plate_number',
            'registration_number',
            'vehicle_number',
          ]) || '—',
        model: pickScalar(vehicleBlock, ['model', 'make_model', 'vehicle_model']) || '—',
        color: pickScalar(vehicleBlock, ['color', 'vehicle_color']) || '—',
      }
    : undefined

  const driver = driverBlock
    ? {
        name:
          pickScalar(driverBlock, ['name', 'full_name', 'driver_name']) || '—',
        contact:
          pickScalar(driverBlock, [
            'contact',
            'contact_number',
            'phone',
            'mobile',
          ]) || '—',
      }
    : undefined

  return { vehicle, driver }
}

export function mapCreateTripRequisitionResult(
  payload: unknown,
  fallback: Partial<CreateTripRequisitionResult>,
): CreateTripRequisitionResult {
  const record = unwrapDataRecord(payload) ?? (payload as ApiRecord)
  const assignment = mapAssignmentFromRecord(record)

  const tripId =
    pickScalar(record, [
      'reference_no',
      'referenceNo',
      'trip_id',
      'tripId',
      'id',
      'requisition_id',
      'reference',
    ]) ||
    fallback.tripId ||
    '—'
  const status =
    pickScalar(record, ['status', 'approval_status', 'trip_status']) ||
    fallback.status ||
    '—'
  const tripTypeLabel = pickTripTypeDisplayLabel(record, fallback.tripTypeLabel)
  const journeyStartRaw = readJourneyStartDatetime(record) || fallback.dateOfJourney || ''
  const dateOfJourney = formatTripDisplayDate(journeyStartRaw)
  const timeOfJourney = formatTripDisplayTime(
    pickScalar(record, ['time_of_journey', 'journey_time', 'journeyTime']) ||
      journeyStartRaw ||
      fallback.timeOfJourney ||
      '',
  )
  const origin = pickScalar(record, ['origin', 'origin_location']) || fallback.origin || '—'
  const destination =
    pickScalar(record, ['destination_details', 'destinationDetails', 'destination', 'final_destination']) ||
    fallback.destination ||
    '—'
  const purposeOfJourney = pickPurposeDisplayLabel(record, fallback.purposeOfJourney)
  const autoApproved =
    record.auto_approved === true ||
    record.autoApproved === true ||
    status.toLowerCase().includes('approv') ||
    Boolean(fallback.autoApproved)

  return {
    tripId,
    status,
    tripTypeLabel,
    dateOfJourney,
    timeOfJourney,
    origin,
    destination,
    purposeOfJourney,
    autoApproved,
    vehicle: assignment.vehicle ?? fallback.vehicle,
    driver: assignment.driver ?? fallback.driver,
  }
}

type CreateTripRequisitionBody = {
  trip_type_id: string
  purpose_id: string
  employee_id: string
  preferred_vehicle_type_id: string
  journey_start_datetime: string
  journey_end_datetime?: string
  trip_duration_days?: number
  origin: string
  destination_details: string
  pickup_required?: boolean
  is_movement_order_required: boolean
  trip_details_justification?: string
  accompanying_officials: { cid: string; full_name: string }[]
}

function buildTripRequisitionFormData(
  body: CreateTripRequisitionBody,
  movementOrderFile?: File | null,
): FormData {
  const form = new FormData()

  const appendScalar = (
    key: string,
    value: string | number | boolean | undefined | null,
  ) => {
    if (value === undefined || value === null) return
    if (typeof value === 'boolean') {
      form.append(key, value ? 'true' : 'false')
      return
    }
    const text = String(value).trim()
    if (!text && typeof value !== 'number') return
    form.append(key, String(value))
  }

  appendScalar('trip_type_id', body.trip_type_id)
  appendScalar('purpose_id', body.purpose_id)
  appendScalar('employee_id', body.employee_id)
  appendScalar('preferred_vehicle_type_id', body.preferred_vehicle_type_id)
  appendScalar('journey_start_datetime', body.journey_start_datetime)
  appendScalar('journey_end_datetime', body.journey_end_datetime)
  if (body.trip_duration_days != null && body.trip_duration_days > 0) {
    form.append('trip_duration_days', String(body.trip_duration_days))
  }
  appendScalar('origin', body.origin)
  appendScalar('destination_details', body.destination_details)
  appendScalar('is_movement_order_required', body.is_movement_order_required)
  if (body.pickup_required !== undefined) {
    form.append('pickup_required', body.pickup_required ? 'true' : 'false')
  }
  appendScalar('trip_details_justification', body.trip_details_justification)
  form.append('accompanying_officials', JSON.stringify(body.accompanying_officials))

  if (movementOrderFile) {
    form.append('movement_order_path', movementOrderFile, movementOrderFile.name)
  }

  return form
}

function buildCreateTripRequisitionBody(
  input: CreateTripRequisitionInput,
): CreateTripRequisitionBody {
  const body: CreateTripRequisitionBody = {
    trip_type_id: input.tripTypeId,
    purpose_id: input.purposeId,
    employee_id: input.employeeId,
    preferred_vehicle_type_id: input.preferredVehicleTypeId,
    journey_start_datetime: input.journeyStartDatetime,
    origin: input.origin,
    destination_details: input.destinationDetails,
    is_movement_order_required: input.isMovementOrderRequired,
    accompanying_officials: input.accompanyingOfficials.map((official) => ({
      cid: official.cid,
      full_name: official.fullName,
    })),
  }

  if (input.journeyEndDatetime) {
    body.journey_end_datetime = input.journeyEndDatetime
  }
  if (input.tripDurationDays != null && input.tripDurationDays > 0) {
    body.trip_duration_days = input.tripDurationDays
  }
  if (input.pickupRequired !== undefined) {
    body.pickup_required = input.pickupRequired
  }
  if (input.tripDetailsJustification?.trim()) {
    body.trip_details_justification = input.tripDetailsJustification.trim()
  }

  return body
}

export async function createTripRequisition(
  input: CreateTripRequisitionInput,
): Promise<CreateTripRequisitionResult> {
  const body = buildCreateTripRequisitionBody(input)

  if (input.isMovementOrderRequired && !input.movementOrderFile) {
    throw new Error('Movement order upload is required for long trips.')
  }

  const payload =
    input.isMovementOrderRequired || input.movementOrderFile
      ? await apiClient<unknown>('/trips', {
          method: 'POST',
          body: buildTripRequisitionFormData(body, input.movementOrderFile),
        })
      : await apiPost<unknown, CreateTripRequisitionBody>('/trips', body)

  const journeyStart = input.journeyStartDatetime
  return mapCreateTripRequisitionResult(payload, {
    tripId: '',
    status: input.pickupRequired !== undefined ? 'Approved' : 'Submitted',
    tripTypeLabel: '',
    dateOfJourney: formatTripDisplayDate(journeyStart),
    timeOfJourney: formatTripDisplayTime(journeyStart),
    origin: input.origin,
    destination: input.destinationDetails,
    purposeOfJourney: '',
    autoApproved: input.pickupRequired !== undefined,
  })
}
