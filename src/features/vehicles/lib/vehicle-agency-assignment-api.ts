// Master lists for agency → department → division → sub-division (`/master/*`), GET `/vehicles/agency-assignments/{vehicle_id}`,
// POST `/vehicles/agency-assignment` (create), PUT `/vehicles/agency-assignment/{id}` (update).
import { extractMasterList } from '@/features/vehicles/lib/vehicle-create-master-data'
import { apiGet, apiPost, apiPut } from '@/services/apiClient'

type ApiRecord = Record<string, unknown>

function toText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function toId(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return ''
}

function toObject(value: unknown): ApiRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as ApiRecord) : undefined
}

function readId(source: unknown): string {
  const obj = toObject(source)
  if (!obj) return ''
  return toId(obj.id).trim()
}

function isActiveRecord(record: ApiRecord): boolean {
  if (record.active === undefined) return true
  return record.active === true || record.active === 1 || record.active === '1'
}

export type AssignmentEntityType = 'AGENCY' | 'DEPARTMENT' | 'DIVISION' | 'SUBDIVISION'

export type VehicleAgencyAssignmentBody = {
  vehicle_id: string
  entity_type: AssignmentEntityType
  entity_id: string
}

const PAGE_SIZE = 200;

export type AgencyAssignmentRow = { id: string; name: string }

export type DepartmentAssignmentRow = { id: string; name: string; agencyId: string }

export type DivisionAssignmentRow = { id: string; name: string; departmentId: string }

export type SubDivisionAssignmentRow = { id: string; name: string; divisionId: string }

function mapAgencyRows(records: ApiRecord[]): AgencyAssignmentRow[] {
  return records
    .filter(isActiveRecord)
    .map((item) => {
      const id = toId(item.id).trim()
      const name = toText(item.name).trim()
      if (!id || !name) return null
      return { id, name }
    })
    .filter((r): r is AgencyAssignmentRow => r !== null)
}

function mapDepartmentRows(records: ApiRecord[]): DepartmentAssignmentRow[] {
  return records
    .filter(isActiveRecord)
    .map((item) => {
      const id = toId(item.id).trim()
      const name = toText(item.name).trim()
      const agencyObj = toObject(item.agency) ?? toObject(item.parent_agency)
      const agencyId = (toId(item.agency_id) || readId(agencyObj)).trim()
      if (!id || !name || !agencyId) return null
      return { id, name, agencyId }
    })
    .filter((r): r is DepartmentAssignmentRow => r !== null)
}

function mapDivisionRows(records: ApiRecord[]): DivisionAssignmentRow[] {
  return records
    .filter(isActiveRecord)
    .map((item) => {
      const id = toId(item.id).trim()
      const name = toText(item.name).trim()
      const departmentObj = toObject(item.department) ?? toObject(item.parent_department)
      const departmentId = (toId(item.department_id) || readId(departmentObj)).trim()
      if (!id || !name || !departmentId) return null
      return { id, name, departmentId }
    })
    .filter((r): r is DivisionAssignmentRow => r !== null)
}

function mapSubDivisionRows(records: ApiRecord[]): SubDivisionAssignmentRow[] {
  return records
    .filter(isActiveRecord)
    .map((item) => {
      const id = toId(item.id).trim()
      const name = toText(item.name).trim()
      const divisionObj = toObject(item.division) ?? toObject(item.parent_division)
      const divisionId = (toId(item.division_id) || readId(divisionObj)).trim()
      if (!id || !name || !divisionId) return null
      return { id, name, divisionId }
    })
    .filter((r): r is SubDivisionAssignmentRow => r !== null)
}

export type VehicleAgencyAssignmentMasterData = {
  agencies: AgencyAssignmentRow[]
  departments: DepartmentAssignmentRow[]
  divisions: DivisionAssignmentRow[]
  subDivisions: SubDivisionAssignmentRow[]
}

/** Search all master organogram lists for an entity id (vehicle assignments use master ids). */
export function resolveMasterEntityDisplayName(
  master: VehicleAgencyAssignmentMasterData | undefined,
  entityId: string,
): string | null {
  const id = entityId.trim()
  if (!master || !id) return null

  const agency = master.agencies.find((a) => a.id === id)
  if (agency) return agency.name

  const department = master.departments.find((d) => d.id === id)
  if (department) return department.name

  const division = master.divisions.find((d) => d.id === id)
  if (division) return division.name

  const subDivision = master.subDivisions.find((s) => s.id === id)
  if (subDivision) return subDivision.name

  return null
}

export function masterDataToIdNameRecord(
  master: VehicleAgencyAssignmentMasterData | undefined,
): Record<string, string> {
  const out: Record<string, string> = {}
  if (!master) return out
  for (const row of master.agencies) out[row.id.toLowerCase()] = row.name
  for (const row of master.departments) out[row.id.toLowerCase()] = row.name
  for (const row of master.divisions) out[row.id.toLowerCase()] = row.name
  for (const row of master.subDivisions) out[row.id.toLowerCase()] = row.name
  return out
}

export async function fetchVehicleAgencyAssignmentMasterData(): Promise<VehicleAgencyAssignmentMasterData> {
  const [agenciesPayload, departmentsPayload, divisionsPayload, subDivisionsPayload] = await Promise.all([
    apiGet<unknown>(`/master/agencies?active=true&page_size=${PAGE_SIZE}&page=1&search=`),
    apiGet<unknown>(`/master/departments?active=true&page_size=${PAGE_SIZE}&page=1&code=&search=`),
    apiGet<unknown>(`/master/divisions?active=true&page_size=${PAGE_SIZE}&page=1&search=`),
    apiGet<unknown>(`/master/sub-divisions?active=true&page_size=${PAGE_SIZE}&page=1&search=`),
  ])

  return {
    agencies: mapAgencyRows(extractMasterList(agenciesPayload)),
    departments: mapDepartmentRows(extractMasterList(departmentsPayload)),
    divisions: mapDivisionRows(extractMasterList(divisionsPayload)),
    subDivisions: mapSubDivisionRows(extractMasterList(subDivisionsPayload)),
  }
}

export type AgencyAssignmentTierSelection = {
  agencyId: string
  departmentId: string
  divisionId: string
  subDivisionId: string
}

export function postVehicleAgencyAssignment(body: VehicleAgencyAssignmentBody) {
  return apiPost<unknown, VehicleAgencyAssignmentBody>('/vehicles/agency-assignment', body)
}

export function resolveAssignmentPayload(
  selection: AgencyAssignmentTierSelection,
  vehicleId: string,
): VehicleAgencyAssignmentBody | null {
  const vid = vehicleId.trim()
  if (!vid) return null

  const sub = selection.subDivisionId.trim()
  const div = selection.divisionId.trim()
  const dep = selection.departmentId.trim()
  const ag = selection.agencyId.trim()

  if (sub) return { vehicle_id: vid, entity_type: 'SUBDIVISION', entity_id: sub }
  if (div) return { vehicle_id: vid, entity_type: 'DIVISION', entity_id: div }
  if (dep) return { vehicle_id: vid, entity_type: 'DEPARTMENT', entity_id: dep }
  if (ag) return { vehicle_id: vid, entity_type: 'AGENCY', entity_id: ag }
  return null
}

function normalizeEntityType(value: unknown): AssignmentEntityType | null {
  const raw = typeof value === 'string' ? value.trim().toUpperCase().replace(/-/g, '_') : ''
  if (raw === 'AGENCY') return 'AGENCY'
  if (raw === 'DEPARTMENT') return 'DEPARTMENT'
  if (raw === 'DIVISION') return 'DIVISION'
  if (raw === 'SUBDIVISION' || raw === 'SUB_DIVISION') return 'SUBDIVISION'
  return null
}

export type VehicleAgencyAssignmentListItem = {
  id: string
  entityType: AssignmentEntityType
  entityId: string
  active: boolean
  is_original_agency: boolean
  /** Optional display name when the API provides it. */
  label?: string
}

function toTruthyFlag(value: unknown): boolean {
  if (value === true || value === 1 || value === '1') return true
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase()
    if (s === 'true' || s === 'yes' || s === 'active') return true
  }
  return false
}

function mapAssignmentListRecord(record: ApiRecord): VehicleAgencyAssignmentListItem | null {
  const id = toId(record.id ?? record.assignment_id).trim()
  const entityType = normalizeEntityType(record.entity_type ?? record.entityType)
  const entityId = toId(record.entity_id ?? record.entityId ?? readId(record.entity)).trim()
  if (!id || !entityType || !entityId) return null
  const labelRaw = toText(record.entity_name ?? record.entityName ?? record.name ?? record.label).trim()
  const active = toTruthyFlag(record.active ?? record.status ?? record.is_active)
  const is_original_agency = toTruthyFlag(record.is_original_agency ?? record.isOriginalAgency)
  return { id, entityType, entityId, active, is_original_agency, label: labelRaw || undefined }
}

export async function fetchVehicleAgencyAssignments(
  vehicleId: string,
): Promise<VehicleAgencyAssignmentListItem[]> {
  const vid = vehicleId.trim()
  if (!vid) return []
  const payload = await apiGet<unknown>(
    `/vehicles/agency-assignments/${encodeURIComponent(vid)}`,
  )
  return extractMasterList(payload)
    .map(mapAssignmentListRecord)
    .filter((r): r is VehicleAgencyAssignmentListItem => r !== null)
}

/**
 * Maps a saved assignment back to cascaded select values (for edit prefill).
 */
export function tiersFromAssignment(
  data: VehicleAgencyAssignmentMasterData,
  entityType: AssignmentEntityType,
  entityId: string,
): AgencyAssignmentTierSelection | null {
  const eid = entityId.trim()
  if (!eid) return null

  if (entityType === 'AGENCY') {
    const ag = data.agencies.find((a) => a.id === eid)
    if (!ag) return null
    return { agencyId: eid, departmentId: '', divisionId: '', subDivisionId: '' }
  }

  if (entityType === 'DEPARTMENT') {
    const dep = data.departments.find((d) => d.id === eid)
    if (!dep) return null
    return { agencyId: dep.agencyId, departmentId: eid, divisionId: '', subDivisionId: '' }
  }

  if (entityType === 'DIVISION') {
    const div = data.divisions.find((d) => d.id === eid)
    if (!div) return null
    const dep = data.departments.find((d) => d.id === div.departmentId)
    if (!dep) return null
    return { agencyId: dep.agencyId, departmentId: dep.id, divisionId: eid, subDivisionId: '' }
  }

  if (entityType === 'SUBDIVISION') {
    const sub = data.subDivisions.find((s) => s.id === eid)
    if (!sub) return null
    const div = data.divisions.find((d) => d.id === sub.divisionId)
    if (!div) return null
    const dep = data.departments.find((d) => d.id === div.departmentId)
    if (!dep) return null
    return { agencyId: dep.agencyId, departmentId: dep.id, divisionId: div.id, subDivisionId: eid }
  }

  return null
}

export function putVehicleAgencyAssignment(assignmentId: string, body: VehicleAgencyAssignmentBody) {
  const id = assignmentId.trim()
  if (!id) throw new Error('Missing assignment id')
  return apiPut<unknown, VehicleAgencyAssignmentBody>(
    `/vehicles/agency-assignments/${encodeURIComponent(id)}`,
    body,
  )
}
