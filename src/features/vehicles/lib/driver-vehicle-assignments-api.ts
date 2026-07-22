import { apiDelete, apiGet, apiPost, apiPut } from '@/services/apiClient'
import { applyPagination } from '@/shared/utils/pagination'

type ApiRecord = Record<string, unknown>

function toText(value: unknown): string {
  return typeof value === 'string'
    ? value.trim()
    : typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : ''
}

function toArray(payload: unknown): ApiRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is ApiRecord => Boolean(item) && typeof item === 'object')
  }
  if (!payload || typeof payload !== 'object') return []
  const root = payload as ApiRecord
  const data = root.data
  const candidates = [
    root.items,
    root.results,
    root.rows,
    root.list,
    root.assignments,
    root.vehicle_assignments,
    Array.isArray(data) ? data : undefined,
    data && typeof data === 'object' && !Array.isArray(data) ? (data as ApiRecord).items : undefined,
    data && typeof data === 'object' && !Array.isArray(data) ? (data as ApiRecord).results : undefined,
    data && typeof data === 'object' && !Array.isArray(data) ? (data as ApiRecord).rows : undefined,
    data && typeof data === 'object' && !Array.isArray(data) ? (data as ApiRecord).assignments : undefined,
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as ApiRecord).vehicle_assignments
      : undefined,
  ]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is ApiRecord => Boolean(item) && typeof item === 'object')
    }
  }
  return []
}

function toDriverAssignmentStatus(record: ApiRecord): string {
  const status = toText(record.status) || toText(record.assignment_status) || toText(record.state)
  if (status) return status
  const activeRaw = record.active ?? record.is_active ?? record.isActive
  if (activeRaw === true || activeRaw === 1 || activeRaw === '1') return 'Active'
  if (activeRaw === false || activeRaw === 0 || activeRaw === '0') return 'Inactive'
  return '—'
}

function getNestedRecord(record: ApiRecord, key: string): ApiRecord | null {
  const value = record[key]
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as ApiRecord
  }
  return null
}

function pickFirstText(record: ApiRecord, keys: string[]): string {
  for (const key of keys) {
    const value = toText(record[key])
    if (value) return value
  }
  return ''
}

function pickVehicleLabel(record: ApiRecord): string {
  const nestedVehicle = getNestedRecord(record, 'vehicle')
  return (
    toText(record.assigned_vehicle) ||
    toText(record.assigned_vehicle_name) ||
    toText(record.vehicle_registration_number) ||
    toText(record.registration_number) ||
    toText(record.vehicle_number) ||
    toText(nestedVehicle?.registration_number) ||
    toText(nestedVehicle?.vehicle_number) ||
    toText(nestedVehicle?.name) ||
    '—'
  )
}

function pickRating(record: ApiRecord): string {
  const value = toText(record.rating) || toText(record.driver_rating)
  return value || '—'
}

function pickAvailabilityStatus(record: ApiRecord): string {
  return (
    toText(record.availability_status) ||
    toText(record.available_status) ||
    toText(record.availability) ||
    toText(record.driver_availability_status) ||
    toText(record.driver_status) ||
    '—'
  )
}

function pickCid(record: ApiRecord): string {
  return (
    toText(record.cid) ||
    toText(record.citizen_id) ||
    toText(record.citizenId) ||
    toText(record.cid_no) ||
    toText(record.cidNumber) ||
    toText(record.cid_number) ||
    ''
  )
}

export type DriverVehicleAssignmentRow = {
  id: string;
  driverId: string;
  vehicleId: string;
  priority: string;
  name: string;
  cid: string;
  contactNo: string;
  employeeId: string;
  license: string;
  expiry: string;
  status: string;
  assignedVehicle: string;
  rating: string;
  availability_status: string;
};

function pickContactNo(record: ApiRecord): string {
  return (
    toText(record.contact_no) ||
    toText(record.contactNo) ||
    toText(record.contact) ||
    toText(record.contact_number) ||
    toText(record.phone) ||
    toText(record.phone_number) ||
    ''
  )
}

function pickPersonName(record: ApiRecord): string {
  const firstName = toText(record.first_name) || toText(record.firstName)
  const middleName = toText(record.middle_name) || toText(record.middleName)
  const lastName = toText(record.last_name) || toText(record.lastName)
  const composed = [firstName, middleName, lastName].filter(Boolean).join(' ').trim()
  return (
    toText(record.full_name) ||
    toText(record.driver_name) ||
    toText(record.name) ||
    composed
  )
}

function pickDriverName(
  record: ApiRecord,
  nestedDriverInfo: ApiRecord | null,
  nestedDriver: ApiRecord | null,
  nestedDriverUser: ApiRecord | null,
  nestedUser: ApiRecord | null,
): string {
  for (const candidate of [nestedDriverInfo, record, nestedDriver, nestedDriverUser, nestedUser]) {
    if (!candidate) continue
    const name = pickPersonName(candidate)
    if (name) return name
  }
  return '—'
}

function pickEmployeeId(record: ApiRecord): string {
  return (
    toText(record.emp_id) ||
    toText(record.employee_id) ||
    toText(record.employeeId) ||
    toText(record.username) ||
    ''
  )
}

function pickDriverEmployeeId(
  record: ApiRecord,
  nestedDriverInfo: ApiRecord | null,
  nestedDriver: ApiRecord | null,
  nestedDriverUser: ApiRecord | null,
  nestedUser: ApiRecord | null,
): string {
  for (const candidate of [nestedDriverInfo, record, nestedDriver, nestedDriverUser, nestedUser]) {
    if (!candidate) continue
    const employeeId = pickEmployeeId(candidate)
    if (employeeId) return employeeId
  }
  return '—'
}

function pickDriverContactNo(
  record: ApiRecord,
  nestedDriverInfo: ApiRecord | null,
  nestedDriver: ApiRecord | null,
  nestedDriverUser: ApiRecord | null,
  nestedUser: ApiRecord | null,
): string {
  for (const candidate of [nestedDriverInfo, record, nestedDriver, nestedDriverUser, nestedUser]) {
    if (!candidate) continue
    const contact = pickContactNo(candidate)
    if (contact) return contact
  }
  return '—'
}

function mapDriverVehicleAssignment(record: ApiRecord): DriverVehicleAssignmentRow | null {
  const nestedDriverInfo = getNestedRecord(record, 'driver_info')
  const nestedDriver = getNestedRecord(record, 'driver')
  const nestedDriverUser = nestedDriver ? getNestedRecord(nestedDriver, 'user') : null
  const nestedUser = getNestedRecord(record, 'user')
  const nestedVehicle = getNestedRecord(record, 'vehicle')
  const nestedLicense = getNestedRecord(record, 'license')
  const id =
    toText(record.id) ||
    toText(record.assignment_id) ||
    toText(record.uuid) ||
    pickFirstText(record, ['driver_id', 'driverId']) ||
    pickFirstText(nestedDriver ?? {}, ['id', 'user_id', 'uuid']) ||
    ''
  if (!id) return null
  const driverId =
    pickFirstText(record, ['driver_id', 'driverId']) ||
    pickFirstText(nestedDriver ?? {}, ['id', 'user_id', 'uuid']) ||
    pickFirstText(nestedLicense ?? {}, ['driver_id', 'driverId']) ||
    '—'
  const vehicleId =
    pickFirstText(record, ['vehicle_id', 'vehicleId']) ||
    pickFirstText(nestedVehicle ?? {}, ['id', 'vehicle_id', 'uuid']) ||
    '—'
  const priority = pickFirstText(record, ['priority']) || '—'
  return {
    id,
    driverId,
    vehicleId,
    priority,
    name: pickDriverName(record, nestedDriverInfo, nestedDriver, nestedDriverUser, nestedUser),
    cid:
      pickCid(record) ||
      pickCid(nestedDriverInfo ?? {}) ||
      pickCid(nestedDriver ?? {}) ||
      pickCid(nestedDriverUser ?? {}) ||
      '—',
    contactNo: pickDriverContactNo(
      record,
      nestedDriverInfo,
      nestedDriver,
      nestedDriverUser,
      nestedUser,
    ),
    employeeId: pickDriverEmployeeId(
      record,
      nestedDriverInfo,
      nestedDriver,
      nestedDriverUser,
      nestedUser,
    ),
    license:
      toText(record.license_number) ||
      toText(record.license_no) ||
      pickFirstText(nestedLicense ?? {}, ['license_number', 'license_no']) ||
      '—',
    expiry:
      (
        toText(record.license_expiry_date) ||
        toText(record.license_expiry) ||
        pickFirstText(nestedLicense ?? {}, ['license_expiry_date', 'license_expiry']) ||
        '—'
      ).slice(0, 10) || '—',
    status: toDriverAssignmentStatus(record),
    assignedVehicle: pickVehicleLabel(record),
    rating: pickRating(record),
    availability_status: pickAvailabilityStatus(record),
  }
}

export type DriverVehicleAssignmentsPageResult = {
  rows: DriverVehicleAssignmentRow[]
  totalCount: number
  totalPages: number
  effectivePageSize: number
}

function driverAssignmentsPath(vehicleId: string, search: string, page: number, pageSize: number) {
  let path = `/drivers/vehicle_assignments/by-vehicle/${encodeURIComponent(vehicleId)}?page=${page}&page_size=${pageSize}`
  const q = search.trim()
  if (q) path += `&search=${encodeURIComponent(q)}`
  return path
}

export async function fetchDriverVehicleAssignmentsPage(
  vehicleId: string,
  search: string,
  page: number,
  pageSize: number,
): Promise<DriverVehicleAssignmentsPageResult> {
  const trimmedVehicleId = vehicleId.trim()
  if (!trimmedVehicleId) {
    return { rows: [], totalCount: 0, totalPages: 1, effectivePageSize: pageSize }
  }
  const payload = await apiGet<unknown>(driverAssignmentsPath(trimmedVehicleId, search, page, pageSize))
  const rows = toArray(payload).map(mapDriverVehicleAssignment).filter((row): row is DriverVehicleAssignmentRow => row !== null)
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
  }
}

export async function fetchDriverVehicleAssignments(
  vehicleId: string,
  search = '',
): Promise<DriverVehicleAssignmentRow[]> {
  const { rows } = await fetchDriverVehicleAssignmentsPage(vehicleId, search, 1, 100)
  return rows
}

export type CreateDriverVehicleAssignmentBody = {
  vehicle_id: string
  driver_id: string
  priority: string
  license: {
    license_number: string
  }
}

export async function createDriverVehicleAssignment(body: CreateDriverVehicleAssignmentBody): Promise<unknown> {
  return apiPost<unknown, CreateDriverVehicleAssignmentBody>('/drivers/vehicle_assignments', body)
}

export type UpdateDriverVehicleAssignmentBody = CreateDriverVehicleAssignmentBody

function unwrapSingleRecord(payload: unknown): ApiRecord | null {
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

export async function fetchDriverVehicleAssignmentById(id: string): Promise<DriverVehicleAssignmentRow | null> {
  const trimmedId = id.trim()
  if (!trimmedId) return null
  try {
    const payload = await apiGet<unknown>(`/drivers/vehicle_assignments/${encodeURIComponent(trimmedId)}`)
    const record = unwrapSingleRecord(payload)
    if (!record) return null
    return mapDriverVehicleAssignment(record)
  } catch {
    return null
  }
}

function pickPrimaryAssignment(rows: DriverVehicleAssignmentRow[]): DriverVehicleAssignmentRow | null {
  if (rows.length === 0) return null
  const primary = rows.find((row) => {
    const numeric = Number.parseInt(String(row.priority), 10)
    return numeric === 1 || row.priority.toUpperCase() === 'PRIMARY'
  })
  return primary ?? rows[0]
}

function mapAssignmentsFromByVehiclePayload(payload: unknown): DriverVehicleAssignmentRow[] {
  const records = toArray(payload)
  if (records.length > 0) {
    return records
      .map(mapDriverVehicleAssignment)
      .filter((row): row is DriverVehicleAssignmentRow => row !== null)
  }
  const record = unwrapSingleRecord(payload)
  if (!record) return []
  const mapped = mapDriverVehicleAssignment(record)
  return mapped ? [mapped] : []
}

/** All driver assignments for a vehicle (`GET .../by-vehicle/:id`, no pagination). */
export async function fetchAllDriverVehicleAssignmentsByVehicleId(
  vehicleId: string,
): Promise<DriverVehicleAssignmentRow[]> {
  const trimmedId = vehicleId.trim()
  if (!trimmedId) return []
  try {
    const payload = await apiGet<unknown>(
      `/drivers/vehicle_assignments/by-vehicle/${encodeURIComponent(trimmedId)}`,
    )
    return mapAssignmentsFromByVehiclePayload(payload)
  } catch {
    return []
  }
}

export async function fetchDriverVehicleAssignmentByVehicleId(
  vehicleId: string,
): Promise<DriverVehicleAssignmentRow | null> {
  const rows = await fetchAllDriverVehicleAssignmentsByVehicleId(vehicleId)
  return pickPrimaryAssignment(rows)
}

export async function updateDriverVehicleAssignment(
  id: string,
  body: UpdateDriverVehicleAssignmentBody,
): Promise<unknown> {
  return apiPut<unknown, UpdateDriverVehicleAssignmentBody>(
    `/drivers/vehicle_assignments/${encodeURIComponent(id)}`,
    body,
  )
}

export async function deleteDriverVehicleAssignment(id: string): Promise<unknown> {
  return apiDelete<unknown>(`/drivers/vehicle_assignments/${encodeURIComponent(id)}`)
}

export const ASSIGNMENT_PRIORITY_OPTIONS = [
  { label: 'PRIMARY', value: 1 },
  { label: 'SECONDARY', value: 2 },
] as const

export function priorityLabelFromValue(value: string | number): string {
  const text = String(value).trim().toUpperCase()
  const byLabel = ASSIGNMENT_PRIORITY_OPTIONS.find((option) => option.label === text)
  if (byLabel) return byLabel.label
  const numeric = typeof value === 'number' ? value : Number.parseInt(text, 10)
  const match = ASSIGNMENT_PRIORITY_OPTIONS.find((option) => option.value === numeric)
  return match?.label ?? (value ? String(value) : '—')
}
