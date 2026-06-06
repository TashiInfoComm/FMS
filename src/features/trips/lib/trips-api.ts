import { apiClient, apiGet } from '@/services/apiClient'
import { applyPagination } from '@/shared/utils/pagination'

import {
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
  origin: string
  destination: string
  status: string
}

export type TripRequisitionsPageResult = {
  rows: TripRequisitionListRow[]
  totalCount: number
  totalPages: number
  effectivePageSize: number
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
  const tripTypeCode = pickScalar(record, ['trip_type', 'tripType', 'trip_type_code', 'tripTypeCode'])
  const purposeCode = pickScalar(record, [
    'purpose_of_journey',
    'purposeOfJourney',
    'journey_purpose',
    'journeyPurpose',
    'purpose_code',
  ])
  const tripType =
    pickScalar(record, ['trip_type_name', 'tripTypeName', 'trip_type_label']) ||
    (lookups?.tripTypes ? labelForMasterOption(lookups.tripTypes, tripTypeCode) : tripTypeCode)
  const purpose =
    pickScalar(record, ['purpose_name', 'purposeOfJourneyName', 'journey_purpose_name']) ||
    (lookups?.purposes ? labelForMasterOption(lookups.purposes, purposeCode) : purposeCode)
  const journeyDateRaw = pickScalar(record, [
    'date_of_journey',
    'journey_date',
    'journeyDate',
    'travel_date',
  ])
  const origin = pickScalar(record, ['origin', 'origin_location', 'from_location']) || '—'
  const destination =
    pickScalar(record, ['destination', 'final_destination', 'to_location']) || '—'
  const status = pickScalar(record, ['status', 'approval_status', 'trip_status']) || '—'

  return {
    id: id || String(serialNo),
    serialNo,
    tripType: tripType || '—',
    purpose: purpose || '—',
    journeyDate: formatTripDisplayDate(journeyDateRaw),
    origin: origin || '—',
    destination: destination || '—',
    status: status || '—',
  }
}

function listPath(search: string, page: number, pageSize: number) {
  const q = encodeURIComponent(search.trim())
  return `/trips/requisitions?page=${page}&page_size=${pageSize}&search=${q}`
}

export async function fetchTripRequisitionsPage(
  search: string,
  page: number,
  pageSize: number,
  lookups?: { tripTypes?: TripMasterOption[]; purposes?: TripMasterOption[] },
): Promise<TripRequisitionsPageResult> {
  const payload = await apiGet<unknown>(listPath(search, page, pageSize))
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
  }
}

export type AccompanyingOfficialInput = {
  employeeCid: string
  fullName: string
}

export type CreateTripRequisitionInput = {
  employeeId: string
  applicantName: string
  designation: string
  agency: string
  department: string
  contactNumber: string
  email: string
  tripType: string
  purposeOfJourney: string
  preferredVehicleType: string
  origin: string
  finalDestination: string
  dateOfJourney: string
  timeOfJourney?: string
  dateOfReturn?: string
  tripDurationDays?: number
  pickupRequired?: boolean
  remarks?: string
  tripDetailsJustification?: string
  accompanyingOfficials: AccompanyingOfficialInput[]
  movementOrderFile?: File | null
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
    pickScalar(record, ['trip_id', 'tripId', 'id', 'requisition_id', 'reference']) ||
    fallback.tripId ||
    '—'
  const status = pickScalar(record, ['status', 'approval_status']) || fallback.status || '—'
  const tripTypeLabel =
    pickScalar(record, ['trip_type_name', 'tripTypeName', 'trip_type_label']) ||
    fallback.tripTypeLabel ||
    '—'
  const dateOfJourney = formatTripDisplayDate(
    pickScalar(record, ['date_of_journey', 'journey_date', 'journeyDate']) ||
      fallback.dateOfJourney ||
      '',
  )
  const timeOfJourney = formatTripDisplayTime(
    pickScalar(record, ['time_of_journey', 'journey_time', 'journeyTime']) ||
      fallback.timeOfJourney ||
      '',
  )
  const origin = pickScalar(record, ['origin', 'origin_location']) || fallback.origin || '—'
  const destination =
    pickScalar(record, ['destination', 'final_destination']) ||
    fallback.destination ||
    '—'
  const purposeOfJourney =
    pickScalar(record, ['purpose_name', 'purpose_of_journey_name']) ||
    fallback.purposeOfJourney ||
    '—'
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

function buildTripRequisitionFormData(input: CreateTripRequisitionInput): FormData {
  const form = new FormData()
  const set = (key: string, value: string | boolean | number | undefined | null) => {
    if (value === undefined || value === null) return
    if (typeof value === 'boolean') {
      form.append(key, value ? 'true' : 'false')
      return
    }
    const text = String(value).trim()
    if (!text && typeof value !== 'number') return
    form.append(key, String(value))
  }

  set('employee_id', input.employeeId)
  set('applicant_name', input.applicantName)
  set('designation', input.designation)
  set('agency', input.agency)
  set('department', input.department)
  set('contact_number', input.contactNumber)
  set('email', input.email)
  set('trip_type', input.tripType)
  set('purpose_of_journey', input.purposeOfJourney)
  set('preferred_vehicle_type', input.preferredVehicleType)
  set('origin', input.origin)
  set('final_destination', input.finalDestination)
  set('date_of_journey', input.dateOfJourney)
  set('time_of_journey', input.timeOfJourney)
  set('date_of_return', input.dateOfReturn)
  if (input.tripDurationDays != null && input.tripDurationDays > 0) {
    form.append('trip_duration_days', String(input.tripDurationDays))
  }
  if (input.pickupRequired !== undefined) {
    form.append('pickup_required', input.pickupRequired ? 'true' : 'false')
  }
  set('remarks', input.remarks)
  set('trip_details_justification', input.tripDetailsJustification)

  if (input.accompanyingOfficials.length > 0) {
    form.append('accompanying_officials', JSON.stringify(input.accompanyingOfficials))
  }

  if (input.movementOrderFile) {
    form.append('movement_order', input.movementOrderFile)
    form.append('movement_order_file', input.movementOrderFile)
  }

  return form
}

export async function createTripRequisition(
  input: CreateTripRequisitionInput,
): Promise<CreateTripRequisitionResult> {
  const form = buildTripRequisitionFormData(input)
  const payload = await apiClient<unknown>('/trips/requisitions', {
    method: 'POST',
    body: form,
  })
  return mapCreateTripRequisitionResult(payload, {
    tripId: '',
    status: input.pickupRequired !== undefined ? 'Approved' : 'Submitted',
    tripTypeLabel: input.tripType,
    dateOfJourney: input.dateOfJourney,
    timeOfJourney: input.timeOfJourney ?? '',
    origin: input.origin,
    destination: input.finalDestination,
    purposeOfJourney: input.purposeOfJourney,
    autoApproved: input.pickupRequired !== undefined,
  })
}
