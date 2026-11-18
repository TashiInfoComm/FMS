import { apiClient, apiGet, apiGetBlob, apiPost } from '@/services/apiClient'
import { closeBrowserTab, navigateBrowserTab } from '@/shared/lib/open-in-new-tab'
import { applyPagination } from '@/shared/utils/pagination'
import {
  formatExtensionStatusLabel,
  formatTripDisplayDate,
  formatTripDisplayTime,
} from '@/features/trips/lib/trip-form-utils'

type ApiRecord = Record<string, unknown>

export type SecretariatOfficial = {
  cid: string
  fullName: string
}

export type SecretariatExtension = {
  id: string
  status: string
  statusLabel: string
  origin: string
  destination: string
  journeyStart: string
  journeyEnd: string
  durationLabel: string
  previousDestination: string
  previousJourneyEnd: string
  previousDurationLabel: string
  purpose: string
  purposeId: string
  justification: string
  decisionRemarks: string
  noteSheetName: string
  officials: SecretariatOfficial[]
}

export type SecretariatRequisitionListRow = {
  id: string
  serialNo: number
  referenceNo: string
  tripLabel: string
  journeyDate: string
  route: string
  status: string
  statusCode: string
  extensionStatus: string
  extensionStatusLabel: string
}

export type SecretariatRequisitionsPage = {
  rows: SecretariatRequisitionListRow[]
  totalCount: number
  totalPages: number
  effectivePageSize: number
}

export type SecretariatNoteSheet = {
  name: string
  url?: string
}

export type SecretariatAssignedDriver = {
  name: string
  cid: string
  employeeId: string
  email: string
  contact: string
  licenseNumber: string
}

export type SecretariatDispatchChecklistEntry = {
  itemId: string
  name: string
  status: string
  remarks: string
}

export type SecretariatAssignedVehicle = {
  registrationNumber: string
  make: string
  model: string
  year: string
  color: string
  vin: string
  fuelType: string
  category: string
  seatingCapacity: string
}

export type SecretariatRequisitionDetail = {
  id: string
  referenceNo: string
  status: string
  statusCode: string
  statusLabel: string
  employeeId: string
  applicantName: string
  designation: string
  agency: string
  department: string
  division: string
  subDivision: string
  contactNumber: string
  email: string
  tripType: string
  purpose: string
  vehicleCategory: string
  origin: string
  destination: string
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  durationLabel: string
  justification: string
  officials: SecretariatOfficial[]
  extensionStatus: string
  extensionStatusLabel: string
  extensions: SecretariatExtension[]
  driver?: SecretariatAssignedDriver
  vehicle?: SecretariatAssignedVehicle
  noteSheet?: SecretariatNoteSheet
  generatedMovementOrder?: SecretariatNoteSheet
  agencyId: string
  requestedByName: string
  dispatchedAt: string
  dispatchChecklist: SecretariatDispatchChecklistEntry[]
  handoverChecklist: SecretariatDispatchChecklistEntry[]
  purposeId: string
  vehicleCategoryId: string
  startDatetimeIso: string
  endDatetimeIso: string
  version: string
  remarks: string
}

export type UpdateSecretariatRequisitionInput = Omit<
  CreateSecretariatRequisitionInput,
  'noteSheetFile'
> & {
  noteSheetFile?: File | null
  version?: string
}

export type CreateSecretariatRequisitionInput = {
  employeeId: string
  applicantName: string
  designation: string
  agency: string
  department: string
  division: string
  subDivision: string
  contactNumber: string
  email: string
  purposeId: string
  vehicleCategoryId: string
  origin: string
  finalDestination: string
  startDatetime: string
  endDatetime: string
  tripDurationDays: number
  tripDetailsJustification: string
  accompanyingOfficials: SecretariatOfficial[]
  noteSheetFile: File
}

function pickScalar(record: ApiRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return ''
}

function unwrapDataRecord(payload: unknown): ApiRecord | null {
  if (!payload || typeof payload !== 'object') return null
  const root = payload as ApiRecord
  const data = root.data
  if (data && typeof data === 'object' && !Array.isArray(data)) return data as ApiRecord
  return root
}

function toArray(payload: unknown): ApiRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is ApiRecord => !!item && typeof item === 'object')
  }
  if (!payload || typeof payload !== 'object') return []
  const root = payload as ApiRecord
  const data = root.data
  const nested =
    data && typeof data === 'object' && !Array.isArray(data) ? (data as ApiRecord) : null
  const candidates = [
    root.items,
    root.results,
    root.data,
    nested?.items,
    nested?.results,
    root.requisitions,
    root.secretariat_requisitions,
  ]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is ApiRecord => !!item && typeof item === 'object')
    }
  }
  return []
}

function nestedRecord(record: ApiRecord, keys: string[]): ApiRecord | null {
  for (const key of keys) {
    const value = record[key]
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as ApiRecord
  }
  return null
}

function pickNestedName(record: ApiRecord, keys: string[]): string {
  const block = nestedRecord(record, keys)
  if (!block) return ''
  return pickScalar(block, ['name', 'label', 'title', 'code'])
}

function pickRelationId(record: ApiRecord, relationKeys: string[], scalarKeys: string[]): string {
  const direct = pickScalar(record, scalarKeys)
  if (direct) return direct
  const block = nestedRecord(record, relationKeys)
  if (!block) return ''
  return pickScalar(block, ['id', 'uuid', ...scalarKeys])
}

function basenameFromPath(value: string): string {
  const trimmed = value.trim().split('?')[0]?.trim() ?? ''
  if (!trimmed) return ''
  const parts = trimmed.split(/[/\\]/).filter(Boolean)
  return parts[parts.length - 1] ?? trimmed
}

function readDestination(record: ApiRecord): string {
  const direct = pickScalar(record, ['final_destination', 'destination_details', 'destination'])
  if (direct) return direct
  const route = pickScalar(record, ['route', 'trip_route', 'route_label'])
  const parts = route
    .split(/\s*(?:→|->|—)\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
  return parts.length >= 2 ? (parts[parts.length - 1] ?? '') : ''
}

function readRoute(record: ApiRecord): string {
  const route = pickScalar(record, ['route', 'trip_route', 'route_label'])
  if (route) return route
  const origin = pickScalar(record, ['origin', 'origin_location'])
  const destination = pickScalar(record, [
    'final_destination',
    'destination_details',
    'destination',
  ])
  if (origin && destination) return `${origin} → ${destination}`
  return origin || destination || '—'
}

function readOfficials(record: ApiRecord): SecretariatOfficial[] {
  const raw = record.accompanying_officials ?? record.accompanyingOfficials ?? record.officials
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is ApiRecord => !!item && typeof item === 'object' && !Array.isArray(item))
    .map((item) => ({
      cid: pickScalar(item, ['cid', 'employee_cid', 'employeeCid', 'employee_id']) || '—',
      fullName: pickScalar(item, ['full_name', 'fullName', 'name', 'employee_name']) || '—',
    }))
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  )
}

function readNestedBlock(record: ApiRecord, key: string): ApiRecord | null {
  if (!(key in record)) return null
  const value = record[key]
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as ApiRecord
}

function hasDisplayValue(values: string[]): boolean {
  return values.some((value) => value.trim() !== '')
}

function readPersonName(record: ApiRecord): string {
  const direct = pickScalar(record, ['name', 'full_name', 'fullName', 'display_name', 'displayName'])
  if (direct) return direct
  return [
    pickScalar(record, ['first_name', 'firstName']),
    pickScalar(record, ['middle_name', 'middleName']),
    pickScalar(record, ['last_name', 'lastName']),
  ]
    .filter(Boolean)
    .join(' ')
}

function labelOrBlank(record: ApiRecord, scalarKeys: string[], nestedKeys: string[]): string {
  const direct = pickScalar(record, scalarKeys)
  if (direct && !isUuid(direct)) return direct
  for (const key of nestedKeys) {
    const block = nestedRecord(record, [key])
    if (!block) continue
    const name = pickScalar(block, ['name', 'label', 'title', 'code'])
    if (name && !isUuid(name)) return name
  }
  return ''
}

function readAssignedDriver(record: ApiRecord): SecretariatAssignedDriver | undefined {
  const driver =
    readNestedBlock(record, 'driver') ??
    readNestedBlock(record, 'assigned_driver') ??
    readNestedBlock(record, 'assignedDriver')
  if (!driver) return undefined
  const mapped: SecretariatAssignedDriver = {
    name: readPersonName(driver),
    cid: pickScalar(driver, ['cid', 'employee_cid', 'employeeCid']),
    employeeId: pickScalar(driver, ['emp_id', 'employee_id', 'employeeId']),
    email: pickScalar(driver, ['email', 'email_address']),
    contact: pickScalar(driver, ['contact_number', 'contactNumber', 'phone', 'mobile', 'contact']),
    licenseNumber: pickScalar(driver, [
      'license_number',
      'license_no',
      'licenseNumber',
      'driving_license_number',
    ]),
  }
  return hasDisplayValue(Object.values(mapped)) ? mapped : undefined
}

function readAssignedVehicle(record: ApiRecord): SecretariatAssignedVehicle | undefined {
  const vehicle =
    readNestedBlock(record, 'vehicle') ??
    readNestedBlock(record, 'assigned_vehicle') ??
    readNestedBlock(record, 'assignedVehicle')
  if (!vehicle) return undefined
  const mapped: SecretariatAssignedVehicle = {
    registrationNumber: pickScalar(vehicle, [
      'registration_number',
      'registrationNumber',
      'vehicle_number',
      'vehicleNumber',
      'plate_number',
      'plateNumber',
    ]),
    make: pickScalar(vehicle, ['make', 'vehicle_make']),
    model: pickScalar(vehicle, ['model', 'vehicle_model']),
    year: pickScalar(vehicle, ['manufacturing_year', 'manufacturingYear', 'year', 'model_year']),
    color: pickScalar(vehicle, ['color']),
    vin: pickScalar(vehicle, ['vin', 'chassis_number', 'chassisNumber']),
    fuelType: labelOrBlank(vehicle, ['fuel_type_name', 'fuelTypeName'], ['fuel_type', 'fuelType']),
    category: labelOrBlank(
      vehicle,
      ['vehicle_category_name', 'vehicleCategoryName'],
      ['vehicle_category', 'vehicleCategory'],
    ),
    seatingCapacity: pickScalar(vehicle, ['seating_capacity', 'seatingCapacity']),
  }
  return hasDisplayValue(Object.values(mapped)) ? mapped : undefined
}

function readNoteSheet(record: ApiRecord): SecretariatNoteSheet | undefined {
  const path = pickScalar(record, ['note_sheet_path', 'noteSheetPath', 'note_sheet', 'noteSheet'])
  const name =
    pickScalar(record, ['note_sheet_file_name', 'noteSheetFileName']) ||
    (path && !path.startsWith('{') ? basenameFromPath(path) : '')
  if (!name) return undefined
  const url = /^https?:\/\//i.test(path) ? path : ''
  return { name, url: url || undefined }
}

function readGeneratedMovementOrder(record: ApiRecord): SecretariatNoteSheet | undefined {
  const path = pickScalar(record, [
    'generated_movement_order_path',
    'generatedMovementOrderPath',
    'movement_order_path',
    'movementOrderPath',
  ])
  const name =
    pickScalar(record, [
      'generated_movement_order_file_name',
      'generatedMovementOrderFileName',
      'movement_order_file_name',
      'movementOrderFileName',
    ]) || (path && !path.startsWith('{') ? basenameFromPath(path) : '')
  if (!name) return undefined
  const url = /^https?:\/\//i.test(path) ? path : ''
  return { name, url: url || undefined }
}

function readExtensionStatus(record: ApiRecord): { status: string; label: string } {
  const status = pickScalar(record, ['extension_status', 'extensionStatus'])
  const label =
    pickScalar(record, ['extension_status_label', 'extensionStatusLabel']) ||
    (status ? formatExtensionStatusLabel(status) : '')
  return { status, label }
}

function readExtensionPurpose(record: ApiRecord): string {
  const named = labelOrBlank(
    record,
    ['purpose_name', 'purposeName', 'purpose_of_journey_name', 'purposeOfJourneyName'],
    ['purpose', 'journey_purpose', 'journeyPurpose'],
  )
  if (named) return named
  const direct = pickScalar(record, ['purpose_of_journey', 'purposeOfJourney'])
  return direct && !isUuid(direct) ? direct : ''
}

function readJourneyWhen(value: string): string {
  if (!value) return ''
  const date = formatTripDisplayDate(value)
  const time = formatTripDisplayTime(value)
  return [date, time].filter((part) => part && part !== '—').join(' ')
}

function mapSecretariatExtension(record: ApiRecord): SecretariatExtension | null {
  const id = pickScalar(record, ['id', 'extension_id', 'extensionId', 'uuid'])
  if (!id) return null
  const statusValue = pickScalar(record, ['status', 'extension_status', 'extensionStatus'])
  const statusLabel =
    pickScalar(record, ['status_label', 'statusLabel', 'extension_status_label', 'extensionStatusLabel']) ||
    (statusValue ? formatExtensionStatusLabel(statusValue) : '')
  const startRaw = pickScalar(record, [
    'new_journey_start_datetime',
    'newJourneyStartDatetime',
    'journey_start_datetime',
    'journeyStartDatetime',
  ])
  const endRaw = pickScalar(record, [
    'new_journey_end_datetime',
    'newJourneyEndDatetime',
    'journey_end_datetime',
    'journeyEndDatetime',
  ])
  const previousEndRaw = pickScalar(record, [
    'previous_journey_end_datetime',
    'previousJourneyEndDatetime',
  ])
  const durationDays = pickScalar(record, [
    'new_trip_duration_days',
    'newTripDurationDays',
    'trip_duration_days',
    'tripDurationDays',
  ])
  const previousDurationDays = pickScalar(record, [
    'previous_trip_duration_days',
    'previousTripDurationDays',
  ])
  const purposeId = pickScalar(record, ['purpose_id', 'purposeId', 'purpose_of_journey', 'purposeOfJourney'])
  const noteSheetPath = pickScalar(record, ['note_sheet_path', 'noteSheetPath', 'note_sheet', 'noteSheet'])
  return {
    id,
    status: statusValue,
    statusLabel,
    origin: pickScalar(record, ['new_origin', 'newOrigin', 'origin']) || '—',
    destination:
      pickScalar(record, ['new_destination', 'newDestination', 'final_destination', 'destination']) ||
      '—',
    journeyStart: readJourneyWhen(startRaw) || '—',
    journeyEnd: readJourneyWhen(endRaw) || '—',
    durationLabel: durationDays ? `${durationDays} day${durationDays === '1' ? '' : 's'}` : '',
    previousDestination:
      pickScalar(record, ['previous_destination', 'previousDestination']) || '',
    previousJourneyEnd: readJourneyWhen(previousEndRaw),
    previousDurationLabel: previousDurationDays
      ? `${previousDurationDays} day${previousDurationDays === '1' ? '' : 's'}`
      : '',
    purpose: readExtensionPurpose(record),
    purposeId: isUuid(purposeId) ? purposeId : '',
    justification: pickScalar(record, ['justification', 'trip_details_justification', 'tripDetailsJustification']) || '—',
    decisionRemarks: pickScalar(record, ['decision_remarks', 'decisionRemarks']),
    noteSheetName:
      pickScalar(record, ['note_sheet_file_name', 'noteSheetFileName']) ||
      (noteSheetPath && !noteSheetPath.startsWith('{') ? basenameFromPath(noteSheetPath) : ''),
    officials: readOfficials(record),
  }
}

function readChecklistEntries(raw: unknown): SecretariatDispatchChecklistEntry[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const row = item as ApiRecord
    const itemId = pickScalar(row, ['item_id', 'itemId', 'id'])
    if (!itemId) return []
    return [
      {
        itemId,
        name: pickScalar(row, ['name', 'item_name', 'itemName']) || 'Checklist item',
        status: pickScalar(row, ['status']) || '—',
        remarks: pickScalar(row, ['remarks']),
      },
    ]
  })
}

function readDispatchChecklist(record: ApiRecord): SecretariatDispatchChecklistEntry[] {
  return readChecklistEntries(record.dispatch_checklist ?? record.dispatchChecklist)
}

function readHandoverChecklist(record: ApiRecord): SecretariatDispatchChecklistEntry[] {
  return readChecklistEntries(record.handover_checklist ?? record.handoverChecklist)
}

function readSecretariatExtensions(record: ApiRecord): SecretariatExtension[] {
  const raw = record.extensions
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is ApiRecord => !!item && typeof item === 'object' && !Array.isArray(item))
    .map(mapSecretariatExtension)
    .filter((item): item is SecretariatExtension => item !== null)
}

function mapListRow(record: ApiRecord, serialNo: number): SecretariatRequisitionListRow {
  const id = pickScalar(record, ['id', 'requisition_id', 'requisitionId', 'uuid'])
  const referenceNo =
    pickScalar(record, [
      'reference_no',
      'referenceNo',
      'request_id',
      'requestId',
      'requisition_no',
      'trip_code',
    ]) || id
  const tripLabel =
    pickScalar(record, ['trip_type_name', 'tripTypeName', 'trip_type', 'tripType']) ||
    pickNestedName(record, ['trip_type', 'tripType']) ||
    pickScalar(record, ['purpose_name', 'purposeName']) ||
    pickNestedName(record, ['purpose', 'journey_purpose', 'journeyPurpose']) ||
    'Long Trip'
  const startRaw = pickScalar(record, [
    'start_datetime',
    'startDatetime',
    'journey_start_datetime',
    'journeyStartDatetime',
  ])
  const statusCode = pickScalar(record, ['status', 'approval_status', 'requisition_status']) || '—'
  const extension = readExtensionStatus(record)

  return {
    id: id || referenceNo || String(serialNo),
    serialNo,
    referenceNo: referenceNo || '—',
    tripLabel,
    journeyDate: formatTripDisplayDate(startRaw),
    route: readRoute(record),
    status: statusCode,
    statusCode,
    extensionStatus: extension.status,
    extensionStatusLabel: extension.label,
  }
}

export async function fetchSecretariatRequisitionsPage(
  search: string,
  page: number,
  pageSize: number,
): Promise<SecretariatRequisitionsPage> {
  const q = encodeURIComponent(search.trim())
  const payload = await apiGet<unknown>(
    `/secretariat-requisitions?page=${page}&page_size=${pageSize}&search=${q}`,
  )
  const records = toArray(payload)
  const paged = applyPagination(payload, records, page, pageSize, {
    page,
    pageSize,
    pageLength: records.length,
  })
  return {
    rows: paged.rows.map((record, index) => mapListRow(record, paged.serialBase + index + 1)),
    totalCount: paged.totalCount,
    totalPages: paged.totalPages,
    effectivePageSize: paged.effectivePageSize,
  }
}

export async function fetchSecretariatRequisitionDetail(
  requisitionId: string,
): Promise<SecretariatRequisitionDetail> {
  const trimmed = requisitionId.trim()
  if (!trimmed) throw new Error('Requisition ID is required')
  const payload = await apiGet<unknown>(`/secretariat-requisitions/${encodeURIComponent(trimmed)}`)
  const record = unwrapDataRecord(payload)
  if (!record) throw new Error('Secretariat requisition not found')

  const id = pickScalar(record, ['id', 'requisition_id', 'requisitionId', 'uuid']) || trimmed
  const referenceNo =
    pickScalar(record, ['reference_no', 'referenceNo', 'request_id', 'requestId', 'requisition_no']) ||
    id
  const startRaw = pickScalar(record, [
    'start_datetime',
    'startDatetime',
    'journey_start_datetime',
    'journeyStartDatetime',
  ])
  const endRaw = pickScalar(record, [
    'end_datetime',
    'endDatetime',
    'journey_end_datetime',
    'journeyEndDatetime',
  ])
  const durationDays = pickScalar(record, ['trip_duration_days', 'tripDurationDays', 'duration_days'])
  const statusCode = pickScalar(record, ['status', 'approval_status', 'requisition_status']) || '—'
  const statusLabel =
    pickScalar(record, ['status_label', 'statusLabel']) || statusCode
  const extension = readExtensionStatus(record)

  return {
    id,
    referenceNo,
    status: statusCode,
    statusCode,
    statusLabel,
    employeeId: pickScalar(record, ['employee_id', 'employeeId']) || '—',
    applicantName:
      pickScalar(record, [
        'applicant_name',
        'applicantName',
        'employee_name',
        'requested_by_name',
        'requestedByName',
      ]) || '—',
    designation: pickScalar(record, ['designation', 'designation_name']) || '—',
    agency: pickScalar(record, ['agency', 'agency_name']) || '—',
    department: pickScalar(record, ['department', 'department_name']) || '—',
    division: pickScalar(record, ['division', 'division_name']) || '—',
    subDivision: pickScalar(record, ['sub_division', 'subDivision', 'sub_division_name']) || '—',
    contactNumber: pickScalar(record, ['contact_number', 'contactNumber', 'phone', 'mobile']) || '—',
    email: pickScalar(record, ['email', 'email_address']) || '—',
    tripType:
      pickScalar(record, ['trip_type_name', 'tripTypeName', 'trip_type', 'tripType']) ||
      pickNestedName(record, ['trip_type', 'tripType']) ||
      'Long Trip',
    purpose:
      pickScalar(record, [
        'purpose_name',
        'purposeName',
        'purpose_of_journey',
        'purposeOfJourney',
      ]) ||
      pickNestedName(record, ['purpose', 'journey_purpose', 'journeyPurpose']) ||
      '—',
    vehicleCategory:
      pickScalar(record, ['vehicle_category_name', 'vehicleCategoryName']) ||
      pickNestedName(record, ['vehicle_category', 'vehicleCategory']) ||
      '—',
    origin: pickScalar(record, ['origin', 'origin_location']) || '—',
    destination: readDestination(record) || '—',
    startDate: formatTripDisplayDate(startRaw),
    startTime: formatTripDisplayTime(startRaw),
    endDate: endRaw ? formatTripDisplayDate(endRaw) : '—',
    endTime: endRaw ? formatTripDisplayTime(endRaw) : '—',
    durationLabel: durationDays ? `${durationDays} day${durationDays === '1' ? '' : 's'}` : '—',
    justification:
      pickScalar(record, ['trip_details_justification', 'tripDetailsJustification', 'justification']) ||
      '—',
    officials: readOfficials(record),
    extensionStatus: extension.status,
    extensionStatusLabel: extension.label,
    extensions: readSecretariatExtensions(record),
    driver: readAssignedDriver(record),
    vehicle: readAssignedVehicle(record),
    noteSheet: readNoteSheet(record),
    generatedMovementOrder: readGeneratedMovementOrder(record),
    agencyId: pickRelationId(record, ['agency'], ['agency_id', 'agencyId']),
    requestedByName: pickScalar(record, ['requested_by_name', 'requestedByName']),
    dispatchedAt: pickScalar(record, ['dispatched_at', 'dispatchedAt']),
    dispatchChecklist: readDispatchChecklist(record),
    handoverChecklist: readHandoverChecklist(record),
    purposeId: pickRelationId(
      record,
      ['purpose', 'journey_purpose', 'journeyPurpose', 'purpose_of_journey'],
      ['purpose_id', 'purposeId'],
    ),
    vehicleCategoryId: pickRelationId(
      record,
      [
        'vehicle_category',
        'vehicleCategory',
        'preferred_vehicle_category',
        'preferredVehicleCategory',
      ],
      ['vehicle_category_id', 'vehicleCategoryId', 'preferred_vehicle_category_id'],
    ),
    startDatetimeIso: startRaw,
    endDatetimeIso: endRaw,
    version: pickScalar(record, ['version', 'row_version', 'etag', 'revision']),
    remarks: pickScalar(record, [
      'verification_remarks',
      'verificationRemarks',
      'remarks',
      'rejection_remarks',
      'verifier_remarks',
      'mto_remarks',
      'remark',
    ]),
  }
}

function appendText(form: FormData, key: string, value: string) {
  const text = value.trim()
  if (!text || text === '-' || text === '—') return
  form.append(key, text)
}

function buildSecretariatRequisitionForm(
  input: Omit<CreateSecretariatRequisitionInput, 'noteSheetFile'> & {
    noteSheetFile?: File | null
  },
): FormData {
  const form = new FormData()
  appendText(form, 'employee_id', input.employeeId)
  appendText(form, 'applicant_name', input.applicantName)
  appendText(form, 'designation', input.designation)
  appendText(form, 'agency', input.agency)
  appendText(form, 'department', input.department)
  appendText(form, 'division', input.division)
  appendText(form, 'sub_division', input.subDivision)
  appendText(form, 'contact_number', input.contactNumber)
  appendText(form, 'email', input.email)
  appendText(form, 'purpose_id', input.purposeId)
  appendText(form, 'vehicle_category_id', input.vehicleCategoryId)
  appendText(form, 'origin', input.origin)
  appendText(form, 'final_destination', input.finalDestination)
  appendText(form, 'start_datetime', input.startDatetime)
  appendText(form, 'end_datetime', input.endDatetime)
  if (input.tripDurationDays > 0) {
    form.append('trip_duration_days', String(input.tripDurationDays))
  }
  appendText(form, 'trip_details_justification', input.tripDetailsJustification)
  form.append(
    'accompanying_officials',
    JSON.stringify(
      input.accompanyingOfficials
        .filter((official) => official.cid.trim() && official.fullName.trim())
        .map((official) => ({
          cid: official.cid.trim(),
          full_name: official.fullName.trim(),
        })),
    ),
  )
  if (input.noteSheetFile) {
    form.append('note_sheet_path', input.noteSheetFile, input.noteSheetFile.name)
  }
  return form
}

export async function createSecretariatRequisition(
  input: CreateSecretariatRequisitionInput,
): Promise<void> {
  await apiClient<unknown>('/secretariat-requisitions', {
    method: 'POST',
    body: buildSecretariatRequisitionForm(input),
  })
}

export type SecretariatAvailableVehicle = {
  id: string
  label: string
}

function readVehicleRecords(payload: unknown): ApiRecord[] {
  const direct = toArray(payload)
  if (direct.length > 0) return direct
  if (!payload || typeof payload !== 'object') return []
  const root = payload as ApiRecord
  const data = root.data
  const containers: unknown[] = [
    root,
    data && typeof data === 'object' && !Array.isArray(data) ? data : null,
  ]
  const keys = ['vehicles', 'available_vehicles', 'availableVehicles', 'items', 'results']
  for (const container of containers) {
    if (!container || typeof container !== 'object' || Array.isArray(container)) continue
    const record = container as ApiRecord
    for (const key of keys) {
      const value = record[key]
      if (!Array.isArray(value)) continue
      return value.filter((item): item is ApiRecord => !!item && typeof item === 'object')
    }
  }
  return []
}

function mapAvailableVehicle(record: ApiRecord): SecretariatAvailableVehicle | null {
  const vehicle = nestedRecord(record, ['vehicle', 'assigned_vehicle', 'assignedVehicle']) ?? record
  const id =
    pickScalar(record, ['vehicle_id', 'vehicleId']) ||
    pickScalar(vehicle, ['id', 'vehicle_id', 'vehicleId', 'uuid']) ||
    pickScalar(record, ['id', 'uuid'])
  if (!id) return null
  const plate = pickScalar(vehicle, [
    'registration_number',
    'registrationNumber',
    'vehicle_registration_number',
    'vehicle_number',
    'plate_number',
    'registration_no',
  ])
  const name = pickScalar(vehicle, ['name', 'vehicle_name', 'vehicleName', 'label'])
  const makeModel = [
    pickScalar(vehicle, ['make', 'vehicle_make']),
    pickScalar(vehicle, ['model', 'vehicle_model']),
  ]
    .filter(Boolean)
    .join(' ')
  const label = [plate, name && name !== plate ? name : '', makeModel].filter(Boolean).join(' · ') || id
  return { id, label }
}

/** Vehicles free to assign to an approved secretariat requisition. */
export async function fetchSecretariatAvailableVehicles(
  requisitionId: string,
): Promise<SecretariatAvailableVehicle[]> {
  const trimmed = requisitionId.trim()
  if (!trimmed) throw new Error('Requisition ID is required')
  const payload = await apiGet<unknown>(
    `/secretariat-requisitions/${encodeURIComponent(trimmed)}/available-vehicles`,
  )
  return readVehicleRecords(payload)
    .map(mapAvailableVehicle)
    .filter((vehicle): vehicle is SecretariatAvailableVehicle => vehicle !== null)
}

/** Assign a vehicle to an approved secretariat requisition. */
export async function confirmSecretariatVehicle(
  requisitionId: string,
  vehicleId: string,
): Promise<void> {
  const trimmed = requisitionId.trim()
  const trimmedVehicleId = vehicleId.trim()
  if (!trimmed) throw new Error('Requisition ID is required')
  if (!trimmedVehicleId) throw new Error('Select a vehicle')
  await apiPost<unknown, { vehicle_id: string }>(
    `/secretariat-requisitions/${encodeURIComponent(trimmed)}/confirm-vehicle`,
    { vehicle_id: trimmedVehicleId },
  )
}

/** DPP MTO approve or reject. Reject requires remarks. */
export async function verifySecretariatRequisition(
  requisitionId: string,
  input: { approve: boolean; remarks?: string },
): Promise<void> {
  const trimmed = requisitionId.trim()
  if (!trimmed) throw new Error('Requisition ID is required')
  const remarks = input.remarks?.trim() ?? ''
  if (!input.approve && !remarks) throw new Error('Rejection remarks are required')

  const body: { approve: boolean; remarks?: string } = { approve: input.approve }
  if (remarks) body.remarks = remarks

  await apiPost<unknown, { approve: boolean; remarks?: string }>(
    `/secretariat-requisitions/${encodeURIComponent(trimmed)}/verify`,
    body,
  )
}

/** Edit and resubmit a rejected secretariat requisition. Note sheet is optional.
 * If-Match is not sent: the API allows PUT, but its CORS allow-list does not include If-Match, so the browser blocks the call.
 */
export async function updateSecretariatRequisition(
  requisitionId: string,
  input: UpdateSecretariatRequisitionInput,
): Promise<void> {
  const trimmed = requisitionId.trim()
  if (!trimmed) throw new Error('Requisition ID is required')

  await apiClient<unknown>(`/secretariat-requisitions/${encodeURIComponent(trimmed)}`, {
    method: 'PUT',
    body: buildSecretariatRequisitionForm(input),
  })
}

export type SecretariatChecklistItem = {
  id: string
  name: string
}

export type SecretariatDispatchChecklistItem = {
  item_id: string
  status: string
  remarks?: string
}

export type SecretariatDispatchInput = {
  checklist: SecretariatDispatchChecklistItem[]
  agency_id: string
  mto_name: string
}

function isActiveMasterItem(record: ApiRecord): boolean {
  const active = record.active
  return (
    active === undefined ||
    active === true ||
    active === 1 ||
    active === '1' ||
    active === 'true'
  )
}

/** Checklist items from `/master/item-names` (page size 100). */
export async function fetchSecretariatChecklistItems(): Promise<SecretariatChecklistItem[]> {
  const payload = await apiGet<unknown>('/master/item-names?page=1&page_size=100&code=&search=')
  return toArray(payload)
    .filter(isActiveMasterItem)
    .map((record) => {
      const code = pickScalar(record, ['code'])
      const id = pickScalar(record, ['id', 'uuid', 'item_id', 'itemId']) || code
      const name = pickScalar(record, ['name', 'label', 'title']) || code
      if (!id || !name) return null
      return { id, name }
    })
    .filter((item): item is SecretariatChecklistItem => item !== null)
}

export type SecretariatAcknowledgeInput =
  | { acknowledge: true; driver_id: string }
  | { acknowledge: false; remarks: string }

export type CreateSecretariatExtensionInput = {
  origin: string
  finalDestination: string
  journeyStartDatetime: string
  journeyEndDatetime: string
  tripDurationDays?: number
  purposeOfJourney?: string
  tripDetailsJustification: string
  accompanyingOfficials: { cid: string; fullName: string }[]
  noteSheetFile?: File | null
}

/** Submit a trip extension for an in-progress secretariat requisition. */
export async function createSecretariatRequisitionExtension(
  requisitionId: string,
  input: CreateSecretariatExtensionInput,
): Promise<void> {
  const trimmed = requisitionId.trim()
  if (!trimmed) throw new Error('Requisition ID is required')
  if (!input.origin.trim()) throw new Error('Origin is required')
  if (!input.finalDestination.trim()) throw new Error('Final destination is required')
  if (!input.journeyStartDatetime.trim()) throw new Error('Journey start date and time is required')
  if (!input.journeyEndDatetime.trim()) throw new Error('Journey end date and time is required')
  if (!input.tripDetailsJustification.trim()) throw new Error('Trip details justification is required')

  const form = new FormData()
  form.append('origin', input.origin.trim())
  form.append('final_destination', input.finalDestination.trim())
  form.append('journey_start_datetime', input.journeyStartDatetime.trim())
  form.append('journey_end_datetime', input.journeyEndDatetime.trim())
  if (input.tripDurationDays != null && input.tripDurationDays > 0) {
    form.append('trip_duration_days', String(input.tripDurationDays))
  }
  const purpose = input.purposeOfJourney?.trim() ?? ''
  if (purpose) form.append('purpose_of_journey', purpose)
  form.append('trip_details_justification', input.tripDetailsJustification.trim())
  const officials = input.accompanyingOfficials
    .filter((official) => official.cid.trim() && official.fullName.trim())
    .map((official) => ({
      cid: official.cid.trim(),
      full_name: official.fullName.trim(),
    }))
  if (officials.length > 0) {
    form.append('accompanying_officials', JSON.stringify(officials))
  }
  if (input.noteSheetFile) {
    form.append('note_sheet_path', input.noteSheetFile, input.noteSheetFile.name)
  }

  await apiClient<unknown>(`/secretariat-requisitions/${encodeURIComponent(trimmed)}/extensions`, {
    method: 'POST',
    body: form,
  })
}

/** Approve or reject a pending secretariat trip extension. Remarks are required. */
export async function decideSecretariatExtension(
  requisitionId: string,
  extensionId: string,
  action: 'approve' | 'reject',
  remarks: string,
): Promise<void> {
  const requisition = requisitionId.trim()
  const extension = extensionId.trim()
  const note = remarks.trim()
  if (!requisition) throw new Error('Requisition ID is required')
  if (!extension) throw new Error('Extension ID is required')
  if (!note) throw new Error('Remarks are required')
  await apiPost<unknown, { remarks: string }>(
    `/secretariat-requisitions/${encodeURIComponent(requisition)}/extensions/${encodeURIComponent(extension)}/${action}`,
    { remarks: note },
  )
}

/** Agency MTO cancels a secretariat requisition that has not been dispatched. */
export async function cancelSecretariatRequisition(
  requisitionId: string,
  reason: string,
): Promise<void> {
  const trimmed = requisitionId.trim()
  if (!trimmed) throw new Error('Requisition ID is required')
  const note = reason.trim()
  if (!note) throw new Error('Reason is required')
  await apiPost<unknown, { reason: string }>(
    `/secretariat-requisitions/${encodeURIComponent(trimmed)}/cancel`,
    { reason: note },
  )
}

/** Agency MTO acknowledges a dispatched secretariat requisition and assigns a driver, or declines with remarks. */
export async function acknowledgeSecretariatRequisition(
  requisitionId: string,
  input: SecretariatAcknowledgeInput,
): Promise<void> {
  const trimmed = requisitionId.trim()
  if (!trimmed) throw new Error('Requisition ID is required')

  if (input.acknowledge) {
    const driverId = input.driver_id.trim()
    if (!driverId) throw new Error('Select a driver')
    await apiPost<unknown, { acknowledge: true; driver_id: string }>(
      `/secretariat-requisitions/${encodeURIComponent(trimmed)}/acknowledge`,
      { acknowledge: true, driver_id: driverId },
    )
    return
  }

  const remarks = input.remarks.trim()
  if (!remarks) throw new Error('Remarks are required')
  await apiPost<unknown, { acknowledge: false; remarks: string }>(
    `/secretariat-requisitions/${encodeURIComponent(trimmed)}/acknowledge`,
    { acknowledge: false, remarks },
  )
}

function requireOdometer(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Enter a valid ${label} odometer reading`)
  }
  return value
}

/** Start an assigned secretariat trip. */
export async function startSecretariatTrip(
  requisitionId: string,
  startOdometer: number,
): Promise<void> {
  const trimmed = requisitionId.trim()
  if (!trimmed) throw new Error('Requisition ID is required')
  await apiPost<unknown, { start_odometer: number }>(
    `/secretariat-requisitions/${encodeURIComponent(trimmed)}/start`,
    { start_odometer: requireOdometer(startOdometer, 'start') },
  )
}

/** Complete a secretariat trip that is in progress. */
export async function completeSecretariatTrip(
  requisitionId: string,
  endOdometer: number,
): Promise<void> {
  const trimmed = requisitionId.trim()
  if (!trimmed) throw new Error('Requisition ID is required')
  await apiPost<unknown, { end_odometer: number }>(
    `/secretariat-requisitions/${encodeURIComponent(trimmed)}/complete`,
    { end_odometer: requireOdometer(endOdometer, 'end') },
  )
}

/** Designated MTO accepts or rejects a submitted vehicle handover. */
export async function decideSecretariatHandover(
  requisitionId: string,
  input: { acknowledge: true } | { acknowledge: false; remarks: string },
): Promise<void> {
  const trimmed = requisitionId.trim()
  if (!trimmed) throw new Error('Requisition ID is required')

  if (input.acknowledge) {
    await apiPost<unknown, { acknowledge: true }>(
      `/secretariat-requisitions/${encodeURIComponent(trimmed)}/handover/decision`,
      { acknowledge: true },
    )
    return
  }

  const remarks = input.remarks.trim()
  if (!remarks) throw new Error('Remarks are required')
  await apiPost<unknown, { acknowledge: false; remarks: string }>(
    `/secretariat-requisitions/${encodeURIComponent(trimmed)}/handover/decision`,
    { acknowledge: false, remarks },
  )
}

/** Record the return checklist and hand the vehicle back for a completed secretariat trip. */
export async function handoverSecretariatRequisition(
  requisitionId: string,
  checklist: SecretariatDispatchChecklistItem[],
): Promise<void> {
  const trimmed = requisitionId.trim()
  if (!trimmed) throw new Error('Requisition ID is required')
  if (checklist.length === 0) throw new Error('Checklist items are required')

  const rows = checklist.map((item) => {
    const itemId = item.item_id.trim()
    const status = item.status.trim()
    if (!itemId) throw new Error('Checklist item is required')
    if (!status) throw new Error('Checklist status is required')
    const row: SecretariatDispatchChecklistItem = { item_id: itemId, status }
    const remarks = item.remarks?.trim()
    if (remarks) row.remarks = remarks
    return row
  })

  await apiPost<unknown, { checklist: SecretariatDispatchChecklistItem[] }>(
    `/secretariat-requisitions/${encodeURIComponent(trimmed)}/handover`,
    { checklist: rows },
  )
}

/** Record handover checklist and dispatch a planned secretariat requisition. */
export async function dispatchSecretariatRequisition(
  requisitionId: string,
  input: SecretariatDispatchInput,
): Promise<void> {
  const trimmed = requisitionId.trim()
  if (!trimmed) throw new Error('Requisition ID is required')
  const agencyId = input.agency_id.trim()
  const mtoName = input.mto_name.trim()
  if (!agencyId) throw new Error('Agency is required to dispatch')
  if (!mtoName) throw new Error('MTO name is required to dispatch')
  if (input.checklist.length === 0) throw new Error('Checklist items are required')

  const checklist = input.checklist.map((item) => {
    const itemId = item.item_id.trim()
    const status = item.status.trim()
    if (!itemId) throw new Error('Checklist item is required')
    if (!status) throw new Error('Checklist status is required')
    const row: SecretariatDispatchChecklistItem = { item_id: itemId, status }
    const remarks = item.remarks?.trim()
    if (remarks) row.remarks = remarks
    return row
  })

  await apiPost<unknown, SecretariatDispatchInput>(
    `/secretariat-requisitions/${encodeURIComponent(trimmed)}/dispatch`,
    {
      checklist,
      agency_id: agencyId,
      mto_name: mtoName,
    },
  )
}

function guessNoteSheetMimeType(fileName: string): string {
  const lower = fileName.trim().toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  return 'application/octet-stream'
}

/** Opens the uploaded approval note sheet for a secretariat requisition. */
export async function openSecretariatNoteSheet(
  requisitionId: string,
  fileName = '',
  directUrl = '',
  targetWindow?: Window | null,
): Promise<void> {
  if (directUrl.trim()) {
    navigateBrowserTab(targetWindow, directUrl.trim())
    return
  }

  const trimmed = requisitionId.trim()
  if (!trimmed) throw new Error('Requisition ID is required')

  try {
    const { blob, contentType } = await apiGetBlob(
      `/secretariat-requisitions/${encodeURIComponent(trimmed)}/note-sheet`,
    )
    if (contentType.includes('application/json')) {
      const payload = JSON.parse(await blob.text()) as unknown
      const record = unwrapDataRecord(payload)
      const url = record
        ? pickScalar(record, ['url', 'download_url', 'downloadUrl', 'note_sheet_url'])
        : ''
      if (!url) throw new Error('Note sheet URL not found')
      navigateBrowserTab(targetWindow, url)
      return
    }
    const mimeType =
      contentType && contentType !== 'application/octet-stream'
        ? contentType
        : guessNoteSheetMimeType(fileName)
    const fileBlob = mimeType === blob.type ? blob : blob.slice(0, blob.size, mimeType)
    const objectUrl = URL.createObjectURL(fileBlob)
    navigateBrowserTab(targetWindow, objectUrl)
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
  } catch (error) {
    closeBrowserTab(targetWindow)
    throw error
  }
}

/** GET `/secretariat-requisitions/{id}/movement-order` and open the file in a new tab. */
export async function openSecretariatMovementOrder(
  requisitionId: string,
  fileName = '',
  directUrl = '',
  targetWindow?: Window | null,
): Promise<void> {
  if (directUrl.trim()) {
    navigateBrowserTab(targetWindow, directUrl.trim())
    return
  }

  const trimmed = requisitionId.trim()
  if (!trimmed) throw new Error('Requisition ID is required')

  try {
    const { blob, contentType } = await apiGetBlob(
      `/secretariat-requisitions/${encodeURIComponent(trimmed)}/movement-order`,
    )
    if (contentType.includes('application/json')) {
      const payload = JSON.parse(await blob.text()) as unknown
      const record = unwrapDataRecord(payload)
      const url = record
        ? pickScalar(record, [
            'url',
            'download_url',
            'downloadUrl',
            'movement_order_url',
            'generated_movement_order_url',
          ])
        : ''
      if (!url) throw new Error('Generated movement order URL not found')
      navigateBrowserTab(targetWindow, url)
      return
    }
    const mimeType =
      contentType && contentType !== 'application/octet-stream'
        ? contentType
        : guessNoteSheetMimeType(fileName)
    const fileBlob = mimeType === blob.type ? blob : blob.slice(0, blob.size, mimeType)
    const objectUrl = URL.createObjectURL(fileBlob)
    navigateBrowserTab(targetWindow, objectUrl)
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
  } catch (error) {
    closeBrowserTab(targetWindow)
    throw error
  }
}
