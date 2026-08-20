import { apiGet, apiPatch, apiPost } from '@/services/apiClient'
import { extractMasterList } from '@/shared/lib/organogram-master-lookup'
import { applyPagination } from '@/shared/utils/pagination'
import type {
  CreateEmergencyIncidentPayload,
  EmergencyAgencyAssignmentPayload,
  EmergencyAvailableVehicle,
  EmergencyBroadcastRow,
  EmergencyBroadcastStatus,
  EmergencyIncidentAssignment,
  EmergencyIncidentAssignmentAgency,
  EmergencyIncidentBroadcastItem,
  EmergencyIncidentDeploymentItem,
  EmergencyIncidentDetail,
  EmergencyIncidentFormValues,
  EmergencyIncidentRow,
  EmergencyIncidentVehicleType,
} from '@/features/emergency-vehicle/lib/emergency-broadcast-types'

export type EmergencyMasterOption = {
  value: string
  label: string
  searchText?: string
}

type ApiRecord = Record<string, unknown>

const PAGE_SIZE = 200

function isActiveRecord(record: ApiRecord): boolean {
  if (record.active === undefined) return true
  return record.active === true || record.active === 1 || record.active === '1'
}

function recordsToIdNameOptions(records: ApiRecord[]): EmergencyMasterOption[] {
  return records
    .filter(isActiveRecord)
    .map((r): EmergencyMasterOption | null => {
      const id = r.id != null && String(r.id).trim() !== '' ? String(r.id).trim() : ''
      const name = typeof r.name === 'string' ? r.name.trim() : ''
      const code = typeof r.code === 'string' ? r.code.trim() : ''
      if (!id) return null
      const label = name || code || id
      return {
        value: id,
        label,
        searchText: [name, code, id].filter(Boolean).join(' '),
      }
    })
    .filter((o): o is EmergencyMasterOption => o !== null)
}

function recordsToVehicleTypeOptions(records: ApiRecord[]): EmergencyMasterOption[] {
  return records
    .filter(isActiveRecord)
    .map((r): EmergencyMasterOption | null => {
      const id = r.id != null && String(r.id).trim() !== '' ? String(r.id).trim() : ''
      const name = typeof r.name === 'string' ? r.name.trim() : ''
      const code = typeof r.code === 'string' ? r.code.trim() : ''
      const value = id || code
      if (!value) return null
      const label = name || code || value
      return {
        value,
        label,
        searchText: [name, code, value].filter(Boolean).join(' '),
      }
    })
    .filter((o): o is EmergencyMasterOption => o !== null)
}

/** Active agencies for single-select (`GET /master/agencies`). */
export async function fetchEmergencyAgencyOptions(): Promise<EmergencyMasterOption[]> {
  const payload = await apiGet<unknown>(
    `/master/agencies?active=true&page=1&page_size=${PAGE_SIZE}&search=`,
  )
  return recordsToIdNameOptions(extractMasterList(payload))
}

/** Active vehicle types for multi-select (`GET /master/vehicle-types`). */
export async function fetchEmergencyVehicleTypeOptions(): Promise<EmergencyMasterOption[]> {
  const payload = await apiGet<unknown>(
    `/master/vehicle-types?active=true&page=1&page_size=${PAGE_SIZE}&code=&search=`,
  )
  return recordsToVehicleTypeOptions(extractMasterList(payload))
}

/** Converts `datetime-local` value to ISO-8601 UTC for the incidents API. */
export function localDatetimeToIso(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function buildAgencyAssignmentFromIncident(
  incident: EmergencyIncidentRow,
): EmergencyAgencyAssignmentPayload {
  const startDate = localDatetimeToIso(incident.startDatetime)
  if (!startDate) {
    throw new Error('Start date and time is required for each incident.')
  }
  if (incident.latitude == null || incident.longitude == null) {
    throw new Error('Latitude and longitude are required for each incident.')
  }
  const agencyIds = incident.agencyIds.map((id) => id.trim()).filter(Boolean)
  if (agencyIds.length === 0) {
    throw new Error('Select at least one agency for each incident.')
  }
  if (incident.vehicleTypeIds.length === 0) {
    throw new Error('Select at least one vehicle type for each incident.')
  }
  if (!incident.location.trim()) {
    throw new Error('Location is required for each incident.')
  }
  if (!incident.description.trim()) {
    throw new Error('Incident description is required for each incident.')
  }

  const endDate = localDatetimeToIso(incident.endDatetime)
  const entry: EmergencyAgencyAssignmentPayload = {
    incident_location: incident.location.trim(),
    latitude: incident.latitude,
    longitude: incident.longitude,
    start_date: startDate,
    notes: incident.description.trim(),
    vehicle_type_ids: [...incident.vehicleTypeIds],
    agencies: agencyIds.map((agency_id) => ({ agency_id })),
  }
  if (endDate) {
    entry.end_date = endDate
  }
  return entry
}

export function buildCreateEmergencyIncidentPayload(
  form: EmergencyIncidentFormValues,
): CreateEmergencyIncidentPayload {
  if (form.incidents.length === 0) {
    throw new Error('Add at least one incident.')
  }

  const agency_assignments = form.incidents.map((incident) =>
    buildAgencyAssignmentFromIncident(incident),
  )
  const description =
    form.incidents.map((incident) => incident.description.trim()).find(Boolean) ?? ''
  if (!description) {
    throw new Error('Incident description is required.')
  }

  return {
    description,
    broadcast_immediately: form.broadcastImmediately,
    agency_assignments,
  }
}

export async function createEmergencyIncident(
  payload: CreateEmergencyIncidentPayload,
): Promise<unknown> {
  return apiPost<unknown, CreateEmergencyIncidentPayload>('/emergency/incidents', payload)
}

export type EmergencyIncidentsPageResult = {
  rows: EmergencyBroadcastRow[]
  totalCount: number
  totalPages: number
  effectivePageSize: number
}

function pickText(record: ApiRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return ''
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function nestedRecord(value: unknown): ApiRecord | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as ApiRecord
  }
  return null
}

function mapIncidentStatus(value: unknown): EmergencyBroadcastStatus {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_')
  if (normalized.includes('CANCEL')) return 'cancelled'
  if (normalized.includes('CLOSE') || normalized === 'CLOSED' || normalized === 'COMPLETED') {
    return 'closed'
  }
  if (normalized.includes('DEPLOY') || normalized === 'DEPLOYED') {
    return 'deployed'
  }
  if (normalized === 'ACTIVE' || normalized.startsWith('ACTIVE_')) {
    return 'active'
  }
  return 'broadcasted'
}

function formatTimeoutLabel(minutes: number | null): string {
  if (minutes == null || minutes < 0) return '—'
  if (minutes < 60) return `${minutes} min`
  const hours = minutes / 60
  if (Number.isInteger(hours)) return `${hours} hr${hours === 1 ? '' : 's'}`
  return `${hours.toFixed(1)} hrs`
}

function collectVehicleTypeLabels(record: ApiRecord): string {
  const direct = pickText(record, [
    'vehicle_category',
    'vehicleCategory',
    'vehicle_type_name',
    'vehicleTypeName',
  ])
  if (direct) return direct

  const namedLists = [
    record.vehicle_types,
    record.vehicleTypes,
    record.vehicle_type_required_names,
    record.vehicle_type_names,
  ]
  for (const list of namedLists) {
    if (!Array.isArray(list) || list.length === 0) continue
    const labels = list
      .map((item) => {
        if (typeof item === 'string' && item.trim()) return item.trim()
        const nested = nestedRecord(item)
        if (!nested) return ''
        return pickText(nested, ['name', 'label', 'code', 'id'])
      })
      .filter(Boolean)
    if (labels.length > 0) return labels.join(', ')
  }

  const broadcasts = record.broadcasts
  if (Array.isArray(broadcasts)) {
    const labels = broadcasts
      .map((item) => {
        const nested = nestedRecord(item)
        if (!nested) return ''
        return pickText(nested, [
          'vehicle_type_name',
          'vehicleTypeName',
          'vehicle_category',
          'vehicleCategory',
          'name',
        ])
      })
      .filter(Boolean)
    if (labels.length > 0) return [...new Set(labels)].join(', ')
  }

  const required = record.vehicle_type_required ?? record.vehicleTypeRequired
  if (Array.isArray(required) && required.length > 0) {
    const labels = required
      .map((item) => {
        if (typeof item === 'string' && item.trim()) return item.trim()
        const nested = nestedRecord(item)
        if (!nested) return ''
        return pickText(nested, ['name', 'label', 'code', 'id'])
      })
      .filter(Boolean)
    if (labels.length > 0) return labels.join(', ')
  }

  return '—'
}

function mapAgencyLabel(record: ApiRecord): string {
  const agencyCount = toFiniteNumber(record.agency_count ?? record.agencyCount)
  if (agencyCount != null) return String(agencyCount)

  const name = pickText(record, ['agency_name', 'agencyName', 'agency'])
  if (name) return name

  const broadcasts = record.broadcasts
  if (Array.isArray(broadcasts) && broadcasts.length > 0) {
    const names = broadcasts
      .map((item) => {
        const nested = nestedRecord(item)
        if (!nested) return ''
        return pickText(nested, ['agency_name', 'agencyName', 'name'])
      })
      .filter(Boolean)
    const unique = [...new Set(names)]
    if (unique.length === 1) return unique[0]
    if (unique.length > 1) return `${unique.length} Agencies`
    return `${broadcasts.length} ${broadcasts.length === 1 ? 'Agency' : 'Agencies'}`
  }

  return '—'
}

export function mapEmergencyIncidentToBroadcastRow(
  record: ApiRecord,
): EmergencyBroadcastRow | null {
  const id = pickText(record, ['id', 'incident_id', 'incidentId'])
  if (!id) return null

  const requestId =
    pickText(record, ['reference_no', 'referenceNo', 'request_id', 'requestId']) || id
  const location =
    pickText(record, ['incident_location', 'incidentLocation', 'location']) || '—'
  const latitude = toFiniteNumber(record.latitude)
  const longitude = toFiniteNumber(record.longitude)
  const statusRaw = pickText(record, [
    'incident_status',
    'incidentStatus',
    'status',
  ])
  const statusLabel = pickText(record, ['status_label', 'statusLabel'])
  const startDate = pickText(record, ['start_date', 'startDate'])
  const endDate = pickText(record, ['end_date', 'endDate'])

  return {
    id,
    requestId,
    vehicleCategory: collectVehicleTypeLabels(record),
    startDateLabel: startDate ? formatIsoDisplay(startDate) : '—',
    endDateLabel: endDate ? formatIsoDisplay(endDate) : '—',
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    location,
    agencyLabel: mapAgencyLabel(record),
    status: mapIncidentStatus(statusRaw || statusLabel),
    statusLabel: statusLabel || undefined,
    description: pickText(record, ['description', 'incident_description', 'incidentDescription']) || undefined,
    latitude: latitude ?? undefined,
    longitude: longitude ?? undefined,
  }
}

function emergencyIncidentsListPath(search: string, page: number, pageSize: number): string {
  const params = new URLSearchParams()
  params.set('page', String(Math.max(1, page)))
  params.set('page_size', String(Math.max(1, pageSize)))
  const q = search.trim()
  if (q) params.set('search', q)
  return `/emergency/incidents?${params.toString()}`
}

function emergencyDispatchRequestsListPath(
  search: string,
  page: number,
  pageSize: number,
): string {
  const params = new URLSearchParams()
  params.set('page', String(Math.max(1, page)))
  params.set('page_size', String(Math.max(1, pageSize)))
  const q = search.trim()
  if (q) params.set('search', q)
  return `/emergency/dispatch-requests?${params.toString()}`
}

/** Paginated emergency incidents for the broadcast / dispatch table. */
export async function fetchEmergencyIncidentsPage(
  search: string,
  page: number,
  pageSize: number,
): Promise<EmergencyIncidentsPageResult> {
  const payload = await apiGet<unknown>(
    emergencyIncidentsListPath(search, page, pageSize),
  )
  const rows = extractMasterList(payload)
    .map((record) => mapEmergencyIncidentToBroadcastRow(record))
    .filter((row): row is EmergencyBroadcastRow => row !== null)

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

/** Paginated dispatched emergency requests (`GET /emergency/dispatch-requests`). */
export async function fetchEmergencyDispatchRequestsPage(
  search: string,
  page: number,
  pageSize: number,
): Promise<EmergencyIncidentsPageResult> {
  const payload = await apiGet<unknown>(
    emergencyDispatchRequestsListPath(search, page, pageSize),
  )
  const rows = extractMasterList(payload)
    .map((record) => mapEmergencyIncidentToBroadcastRow(record))
    .filter((row): row is EmergencyBroadcastRow => row !== null)

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

function extractIncidentDetailRecord(payload: unknown): ApiRecord | null {
  if (!payload || typeof payload !== 'object') return null
  if (Array.isArray(payload)) {
    const first = payload[0]
    return first && typeof first === 'object' ? (first as ApiRecord) : null
  }
  const root = payload as ApiRecord
  const data = root.data
  if (Array.isArray(data)) {
    const first = data[0]
    return first && typeof first === 'object' ? (first as ApiRecord) : null
  }
  if (data && typeof data === 'object') return data as ApiRecord
  if (pickText(root, ['id', 'reference_no', 'referenceNo'])) return root
  return null
}

function formatIsoDisplay(value: string): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function countRespondedBroadcasts(broadcasts: EmergencyIncidentBroadcastItem[]): number {
  return broadcasts.filter((item) => {
    if (item.declinedVehicleTypesCount > 0) return true
    const status = `${item.response} ${item.statusLabel}`.toUpperCase()
    return (
      status.includes('DECLIN') ||
      status.includes('DEPLOY') ||
      status.includes('OFFER')
    )
  }).length
}

/** Agencies that deployed vehicles or declined at least one vehicle type. */
function countRespondedAgencies(
  assignments: EmergencyIncidentAssignment[],
  deployments: EmergencyIncidentDeploymentItem[],
  broadcasts: EmergencyIncidentBroadcastItem[],
): number {
  const responded = new Set<string>()

  for (const assignment of assignments) {
    for (const agency of assignment.agencies) {
      const hasDeployments = agency.deployments.length > 0
      const hasDeclines = agency.broadcasts.some(
        (broadcast) => broadcast.declinedVehicleTypesCount > 0,
      )
      if (hasDeployments || hasDeclines) {
        responded.add(agency.agencyId || agency.id)
      }
    }
  }

  if (responded.size > 0) return responded.size

  for (const deployment of deployments) {
    const key = deployment.agencyName.trim().toLowerCase()
    if (key && key !== '—') responded.add(`deployment:${key}`)
  }
  for (const broadcast of broadcasts) {
    if (broadcast.declinedVehicleTypesCount <= 0) continue
    const key = broadcast.agencyName.trim().toLowerCase()
    if (key && key !== '—') responded.add(`broadcast:${key}`)
  }

  return responded.size > 0 ? responded.size : countRespondedBroadcasts(broadcasts)
}

function mapBroadcastList(
  list: unknown,
  fallbackAgencyName = '',
  fallbackAgencyCode = '',
): EmergencyIncidentBroadcastItem[] {
  if (!Array.isArray(list) || list.length === 0) return []
  return list
    .map((item, index): EmergencyIncidentBroadcastItem | null => {
      const nested = nestedRecord(item)
      if (!nested) return null
      const id =
        pickText(nested, ['id', 'broadcast_id', 'broadcastId']) || `broadcast-${index + 1}`
      const vehiclesOffered =
        toFiniteNumber(
          nested.vehicles_offered ??
            nested.vehiclesOffered ??
            nested.vehicle_count ??
            nested.vehicleCount,
        ) ?? null
      const vehicleType =
        pickText(nested, [
          'vehicle_type_name',
          'vehicleTypeName',
          'vehicle_category',
          'vehicleCategory',
        ]) || ''
      const declinedList =
        nested.declined_vehicle_types ?? nested.declinedVehicleTypes
      const declinedTypeNames = Array.isArray(declinedList)
        ? declinedList
            .map((entry) => {
              if (typeof entry === 'string' && entry.trim()) return entry.trim()
              const typeRecord = nestedRecord(entry)
              if (!typeRecord) return ''
              return pickText(typeRecord, ['name', 'label', 'code', 'id'])
            })
            .filter(Boolean)
        : []
      const declinedTypes = declinedTypeNames.join(', ')
      const response =
        pickText(nested, ['response', 'response_status', 'responseStatus']) ||
        pickText(nested, ['status_label', 'statusLabel', 'status']) ||
        '—'
      return {
        id,
        agencyName:
          pickText(nested, ['agency_name', 'agencyName', 'name']) ||
          fallbackAgencyName ||
          '—',
        agencyCode:
          pickText(nested, ['agency_code', 'agencyCode', 'code']) ||
          fallbackAgencyCode,
        response,
        declinedVehicleTypesLabel: declinedTypes || '—',
        declinedVehicleTypesCount: declinedTypeNames.length,
        statusLabel: response,
        vehiclesOfferedLabel:
          vehiclesOffered != null
            ? `${vehiclesOffered}${vehicleType ? ` ${vehicleType}` : ''}`
            : vehicleType || '—',
        respondedAt:
          pickText(nested, [
            'responded_at',
            'respondedAt',
            'acknowledged_at',
            'acknowledgedAt',
          ]) || undefined,
      }
    })
    .filter((item): item is EmergencyIncidentBroadcastItem => item !== null)
}

function collectIncidentBroadcasts(record: ApiRecord): EmergencyIncidentBroadcastItem[] {
  const fromTopLevel = mapBroadcastList(record.broadcasts)
  const assignmentList = record.agency_assignments ?? record.agencyAssignments
  const fromAssignments = Array.isArray(assignmentList)
    ? assignmentList.flatMap((item) => {
        const nested = nestedRecord(item)
        if (!nested) return []
        const agencyName =
          pickText(nested, ['agency_name', 'agencyName', 'name']) || ''
        const agencyCode = pickText(nested, ['agency_code', 'agencyCode', 'code'])
        const fromAssignment = mapBroadcastList(
          nested.broadcasts,
          agencyName,
          agencyCode,
        )
        const nestedAgencies = nested.agencies
        const fromAgencies = Array.isArray(nestedAgencies)
          ? nestedAgencies.flatMap((agencyItem) => {
              const agency = nestedRecord(agencyItem)
              if (!agency) return []
              return mapBroadcastList(
                agency.broadcasts,
                pickText(agency, ['agency_name', 'agencyName', 'name']) || agencyName,
                pickText(agency, ['agency_code', 'agencyCode', 'code']) || agencyCode,
              )
            })
          : []
        return [...fromAssignment, ...fromAgencies]
      })
    : []

  const byId = new Map<string, EmergencyIncidentBroadcastItem>()
  for (const broadcast of [...fromTopLevel, ...fromAssignments]) {
    if (!byId.has(broadcast.id)) byId.set(broadcast.id, broadcast)
  }
  return [...byId.values()]
}

function mapVehicleTypesFromList(list: unknown): EmergencyIncidentVehicleType[] {
  if (!Array.isArray(list)) return []
  return list
    .map((item): EmergencyIncidentVehicleType | null => {
      if (typeof item === 'string' && item.trim()) {
        return { id: item.trim(), code: '', name: item.trim() }
      }
      const nested = nestedRecord(item)
      if (!nested) return null
      const id = pickText(nested, ['id', 'vehicle_type_id', 'vehicleTypeId'])
      if (!id) return null
      return {
        id,
        code: pickText(nested, ['code']),
        name: pickText(nested, ['name', 'label']) || pickText(nested, ['code']) || id,
      }
    })
    .filter((item): item is EmergencyIncidentVehicleType => item !== null)
}

function mapDeploymentList(
  list: unknown,
  fallbackAgencyName = '',
  fallbackAgencyCode = '',
  fallbackAgencyId = '',
): EmergencyIncidentDeploymentItem[] {
  if (!Array.isArray(list) || list.length === 0) return []
  return list
    .map((item, index): EmergencyIncidentDeploymentItem | null => {
      const nested = nestedRecord(item)
      if (!nested) return null
      const id =
        pickText(nested, ['id', 'deployment_id', 'deploymentId']) ||
        `deployment-${index + 1}`
      const vehicle =
        pickText(nested, [
          'vehicle_registration',
          'vehicleRegistration',
          'registration_number',
          'registrationNumber',
          'vehicle_label',
          'vehicleLabel',
          'vehicle_name',
          'vehicleName',
        ]) || '—'
      const vehicleType =
        pickText(nested, [
          'vehicle_type_name',
          'vehicleTypeName',
          'vehicle_category',
          'vehicleCategory',
        ]) || ''
      const vehicleTypeId = pickText(nested, [
        'vehicle_type_id',
        'vehicleTypeId',
      ])
      const vehiclesOffered =
        toFiniteNumber(
          nested.vehicles_offered ??
            nested.vehiclesOffered ??
            nested.vehicle_count ??
            nested.vehicleCount,
        ) ?? null
      const deployedAt =
        pickText(nested, [
          'deployed_at',
          'deployedAt',
          'start_date',
          'startDate',
          'created_at',
          'createdAt',
        ]) || undefined
      return {
        id,
        agencyId:
          pickText(nested, ['agency_id', 'agencyId']) || fallbackAgencyId || undefined,
        agencyName:
          pickText(nested, ['agency_name', 'agencyName', 'name']) ||
          fallbackAgencyName ||
          '—',
        agencyCode:
          pickText(nested, ['agency_code', 'agencyCode', 'code']) ||
          fallbackAgencyCode,
        vehiclesOfferedLabel:
          vehiclesOffered != null
            ? `${vehiclesOffered}${vehicleType ? ` ${vehicleType}` : ''}`
            : vehicle !== '—'
              ? vehicle
              : vehicleType || '—',
        vehicleTypeId: vehicleTypeId || undefined,
        vehicleTypeName: vehicleType || '—',
        deploymentDateTimeLabel: deployedAt ? formatIsoDisplay(deployedAt) : '—',
        statusLabel:
          pickText(nested, ['status_label', 'statusLabel', 'status']) || '—',
        deployedAt,
        deployedByName:
          pickText(nested, [
            'deployed_by_name',
            'deployedByName',
            'deployed_by',
            'deployedBy',
          ]) || undefined,
      }
    })
    .filter((item): item is EmergencyIncidentDeploymentItem => item !== null)
}

function mapAssignmentAgencies(list: unknown): EmergencyIncidentAssignmentAgency[] {
  if (!Array.isArray(list)) return []
  return list
    .map((item, index): EmergencyIncidentAssignmentAgency | null => {
      const nested = nestedRecord(item)
      if (!nested) return null
      const agencyId = pickText(nested, ['agency_id', 'agencyId', 'id'])
      if (!agencyId) return null
      const agencyName =
        pickText(nested, ['agency_name', 'agencyName', 'name']) || '—'
      const agencyCode = pickText(nested, ['agency_code', 'agencyCode', 'code'])
      return {
        id: pickText(nested, ['id']) || `agency-${agencyId}-${index + 1}`,
        agencyId,
        agencyName,
        agencyCode,
        broadcasts: mapBroadcastList(
          nested.broadcasts,
          agencyName,
          agencyCode,
        ),
        deployments: mapDeploymentList(
          nested.deployments,
          agencyName,
          agencyCode,
          agencyId,
        ),
      }
    })
    .filter((item): item is EmergencyIncidentAssignmentAgency => item !== null)
}

function mapAgencyAssignments(record: ApiRecord): EmergencyIncidentAssignment[] {
  const list = record.agency_assignments ?? record.agencyAssignments
  if (!Array.isArray(list)) return []
  return list
    .map((item, index): EmergencyIncidentAssignment | null => {
      const nested = nestedRecord(item)
      if (!nested) return null
      const id =
        pickText(nested, ['id', 'assignment_id', 'assignmentId']) ||
        `assignment-${index + 1}`
      const vehicleTypes = mapVehicleTypesFromList(
        nested.vehicle_types ?? nested.vehicleTypes,
      )
      const vehicleTypeIds = Array.isArray(nested.vehicle_type_ids)
        ? nested.vehicle_type_ids
        : Array.isArray(nested.vehicleTypeIds)
          ? nested.vehicleTypeIds
          : []
      const resolvedVehicleTypes =
        vehicleTypes.length > 0
          ? vehicleTypes
          : vehicleTypeIds
              .map((value) => {
                const idValue =
                  typeof value === 'string' ? value.trim() : String(value ?? '').trim()
                if (!idValue) return null
                return { id: idValue, code: '', name: idValue }
              })
              .filter((entry): entry is EmergencyIncidentVehicleType => entry !== null)

      const nestedAgencies = mapAssignmentAgencies(nested.agencies)
      const selfAgencyId = pickText(nested, ['agency_id', 'agencyId'])
      const selfAgencyName =
        pickText(nested, ['agency_name', 'agencyName']) || '—'
      const selfAgencyCode = pickText(nested, [
        'agency_code',
        'agencyCode',
        'code',
      ])
      const selfBroadcasts = mapBroadcastList(
        nested.broadcasts,
        selfAgencyName,
        selfAgencyCode,
      )
      const selfDeployments = mapDeploymentList(
        nested.deployments,
        selfAgencyName,
        selfAgencyCode,
        selfAgencyId,
      )
      const agencies =
        nestedAgencies.length > 0
          ? nestedAgencies
          : selfAgencyId
            ? [
                {
                  id: pickText(nested, ['id']) || selfAgencyId,
                  agencyId: selfAgencyId,
                  agencyName: selfAgencyName,
                  agencyCode: selfAgencyCode,
                  broadcasts: selfBroadcasts,
                  deployments: selfDeployments,
                },
              ]
            : []

      const location = pickText(nested, [
        'incident_location',
        'incidentLocation',
        'location',
      ])
      if (!location && agencies.length === 0) return null

      return {
        id,
        location: location || '—',
        latitude: toFiniteNumber(nested.latitude) ?? null,
        longitude: toFiniteNumber(nested.longitude) ?? null,
        startDate: pickText(nested, ['start_date', 'startDate']),
        endDate: pickText(nested, ['end_date', 'endDate']),
        notes: pickText(nested, ['notes', 'description', 'incident_description']),
        vehicleTypes: resolvedVehicleTypes,
        agencies,
      }
    })
    .filter((item): item is EmergencyIncidentAssignment => item !== null)
}

function collectIncidentDeployments(
  record: ApiRecord,
  assignments: EmergencyIncidentAssignment[],
): EmergencyIncidentDeploymentItem[] {
  const fromTopLevel = mapDeploymentList(record.deployments)
  const fromAssignments = assignments.flatMap((assignment) =>
    assignment.agencies.flatMap((agency) => agency.deployments),
  )
  const byId = new Map<string, EmergencyIncidentDeploymentItem>()
  for (const deployment of [...fromTopLevel, ...fromAssignments]) {
    if (!byId.has(deployment.id)) byId.set(deployment.id, deployment)
  }
  return [...byId.values()]
}

export function mapEmergencyIncidentDetail(
  record: ApiRecord,
): EmergencyIncidentDetail | null {
  const row = mapEmergencyIncidentToBroadcastRow(record)
  if (!row) return null

  const timeoutMinutes = toFiniteNumber(
    record.timeout_minutes ?? record.timeoutMinutes,
  )
  const broadcasts = collectIncidentBroadcasts(record)
  const assignments = mapAgencyAssignments(record)
  const deployments = collectIncidentDeployments(record, assignments)
  const assignmentAgencyCount = new Set(
    assignments.flatMap((assignment) =>
      assignment.agencies.map((agency) => agency.agencyId),
    ),
  ).size
  const agenciesNotified =
    toFiniteNumber(
      record.agency_count ??
        record.agencyCount ??
        record.agencies_notified ??
        record.agenciesNotified ??
        record.total_agencies_notified,
    ) ?? (assignmentAgencyCount > 0 ? assignmentAgencyCount : broadcasts.length)
  // Derive from assignment data: only count agencies that deployed or declined.
  // Do not trust API `agencies_responded` — it can count notified/acked agencies.
  const agenciesResponded = countRespondedAgencies(
    assignments,
    deployments,
    broadcasts,
  )

  const vehiclesOfferedFromApi = toFiniteNumber(
    record.vehicles_offered ?? record.vehiclesOffered,
  )
  const vehiclesOfferedFromBroadcasts = broadcasts.reduce((sum, item) => {
    const match = /^(\d+)/.exec(item.vehiclesOfferedLabel)
    return sum + (match ? Number(match[1]) : 0)
  }, 0)
  const vehiclesOffered =
    vehiclesOfferedFromApi ??
    (deployments.length > 0 ? deployments.length : vehiclesOfferedFromBroadcasts)

  const vehicleTypes = mapVehicleTypesFromList(
    record.vehicle_types ?? record.vehicleTypes,
  )
  const vehicleTypeIdsRaw = Array.isArray(record.vehicle_type_ids)
    ? record.vehicle_type_ids
    : Array.isArray(record.vehicleTypeIds)
      ? record.vehicleTypeIds
      : []
  const vehicleTypeIds = vehicleTypeIdsRaw
    .map((value) => (typeof value === 'string' ? value.trim() : String(value ?? '').trim()))
    .filter(Boolean)

  const assignmentVehicleTypes = assignments.flatMap(
    (assignment) => assignment.vehicleTypes,
  )
  const resolvedVehicleTypes =
    vehicleTypes.length > 0
      ? vehicleTypes
      : assignmentVehicleTypes.length > 0
        ? [...new Map(assignmentVehicleTypes.map((type) => [type.id, type])).values()]
        : vehicleTypeIds.map((id) => ({ id, code: '', name: id }))
  const resolvedVehicleTypeIds = resolvedVehicleTypes.map((type) => type.id)

  const vehiclesRequired =
    toFiniteNumber(
      record.vehicles_required ??
        record.vehiclesRequired ??
        record.no_of_vehicles_required,
    ) ?? (resolvedVehicleTypeIds.length > 0 ? resolvedVehicleTypeIds.length : null)

  const primaryAssignment = assignments[0]
  const startDate =
    pickText(record, ['start_date', 'startDate']) ||
    primaryAssignment?.startDate ||
    ''
  const endDate =
    pickText(record, ['end_date', 'endDate']) || primaryAssignment?.endDate || ''
  const location =
    row.location !== '—'
      ? row.location
      : primaryAssignment?.location || '—'
  const latitude = row.latitude ?? primaryAssignment?.latitude ?? null
  const longitude = row.longitude ?? primaryAssignment?.longitude ?? null
  const vehicleCategory =
    row.vehicleCategory !== '—'
      ? row.vehicleCategory
      : resolvedVehicleTypes.map((type) => type.name).filter(Boolean).join(', ') ||
        '—'

  return {
    id: row.id,
    requestId: row.requestId,
    vehicleCategory,
    timeLabel: formatTimeoutLabel(timeoutMinutes),
    location,
    agencyLabel: row.agencyLabel,
    status: row.status,
    statusLabel: row.statusLabel || '—',
    description:
      pickText(record, ['description', 'incident_description', 'incidentDescription']) ||
      row.description ||
      '',
    latitude,
    longitude,
    startDate,
    endDate,
    initiatedByName: pickText(record, [
      'initiated_by_name',
      'initiatedByName',
      'created_by_name',
      'createdByName',
    ]),
    initiatedAt: pickText(record, ['initiated_at', 'initiatedAt']),
    broadcastAt: pickText(record, ['broadcast_at', 'broadcastAt']),
    closedAt: pickText(record, ['closed_at', 'closedAt']),
    createdAt: pickText(record, ['created_at', 'createdAt']),
    updatedAt: pickText(record, ['updated_at', 'updatedAt']),
    timeoutMinutes,
    searchRadiusKm: toFiniteNumber(
      record.search_radius_km ?? record.searchRadiusKm ?? record.radius_km,
    ),
    vehiclesRequired,
    agenciesNotified,
    agenciesResponded,
    vehiclesOffered,
    vehicleTypeIds: resolvedVehicleTypeIds,
    vehicleTypes: resolvedVehicleTypes,
    assignments,
    broadcasts,
    deployments,
  }
}

/** Incident detail for the emergency broadcast detail page. */
export async function fetchEmergencyIncidentById(
  incidentId: string,
): Promise<EmergencyIncidentDetail> {
  const trimmed = incidentId.trim()
  if (!trimmed) throw new Error('Missing emergency incident id')

  const payload = await apiGet<unknown>(
    `/emergency/incidents/${encodeURIComponent(trimmed)}`,
  )
  const record = extractIncidentDetailRecord(payload)
  if (!record) throw new Error('Invalid emergency incident response')
  const detail = mapEmergencyIncidentDetail(record)
  if (!detail) throw new Error('Invalid emergency incident response')
  return detail
}

export function formatEmergencyIncidentDateTime(value: string): string {
  return formatIsoDisplay(value)
}

/** Remaining mm:ss until initiated_at + timeout_minutes; otherwise timeout label. */
export function formatEmergencyResponseDeadline(
  initiatedAt: string,
  timeoutMinutes: number | null,
): { value: string; sublabel: string } {
  if (timeoutMinutes == null) {
    return { value: '—', sublabel: 'No deadline set' }
  }
  if (!initiatedAt) {
    return {
      value: formatTimeoutLabel(timeoutMinutes),
      sublabel: 'Response window',
    }
  }
  const started = new Date(initiatedAt).getTime()
  if (Number.isNaN(started)) {
    return {
      value: formatTimeoutLabel(timeoutMinutes),
      sublabel: 'Response window',
    }
  }
  const remainingMs = started + timeoutMinutes * 60_000 - Date.now()
  if (remainingMs <= 0) {
    return { value: '00:00', sublabel: 'Deadline passed' }
  }
  const totalSeconds = Math.floor(remainingMs / 1000)
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return {
    value: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
    sublabel: 'mins remaining',
  }
}

export type CancelEmergencyIncidentPayload = {
  remarks: string
}

export type CloseEmergencyIncidentPayload = {
  closure_notes: string
  end_date: string
}

export async function cancelEmergencyIncident(
  incidentId: string,
  remarks: string,
): Promise<unknown> {
  const trimmed = incidentId.trim()
  const trimmedRemarks = remarks.trim()
  if (!trimmed) throw new Error('Missing emergency incident id')
  if (!trimmedRemarks) throw new Error('Remarks are required')
  return apiPost<unknown, CancelEmergencyIncidentPayload>(
    `/emergency/incidents/${encodeURIComponent(trimmed)}/cancel`,
    { remarks: trimmedRemarks },
  )
}

export async function closeEmergencyIncident(
  incidentId: string,
  closureNotes: string,
  endDateIso: string,
): Promise<unknown> {
  const trimmed = incidentId.trim()
  const notes = closureNotes.trim()
  const endDate = endDateIso.trim()
  if (!trimmed) throw new Error('Missing emergency incident id')
  if (!notes) throw new Error('Closure notes are required')
  if (!endDate) throw new Error('End date is required')
  return apiPost<unknown, CloseEmergencyIncidentPayload>(
    `/emergency/incidents/${encodeURIComponent(trimmed)}/close`,
    {
      closure_notes: notes,
      end_date: endDate,
    },
  )
}

/** Whether cancel/close actions are still available for this incident. */
export function canCancelOrCloseEmergencyIncident(status: EmergencyBroadcastStatus): boolean {
  return status !== 'cancelled' && status !== 'closed'
}

/**
 * Hide Deploy Vehicle when requested vehicle types are fully covered by deployments
 * (or deployments + declined types) for the given agency.
 */
export function isEmergencyDeployFullyCovered(
  detail: EmergencyIncidentDetail,
  agency?: { id?: string; name?: string },
): boolean {
  const requestedCount =
    detail.vehicleTypes.length > 0
      ? detail.vehicleTypes.length
      : detail.vehicleTypeIds.length
  if (requestedCount <= 0) return false

  const agencyId = agency?.id?.trim() ?? ''
  const agencyName = agency?.name?.trim().toLowerCase() ?? ''
  const hasAgencyFilter = Boolean(agencyId || agencyName)

  const assignmentAgencies = detail.assignments.flatMap(
    (assignment) => assignment.agencies,
  )
  const matchedAgencies = hasAgencyFilter
    ? assignmentAgencies.filter(
        (entry) =>
          (agencyId && entry.agencyId === agencyId) ||
          (agencyName &&
            entry.agencyName.trim().toLowerCase() === agencyName),
      )
    : assignmentAgencies

  let deploymentCount = 0
  let declinedCount = 0

  if (matchedAgencies.length > 0) {
    deploymentCount = matchedAgencies.reduce(
      (sum, entry) => sum + entry.deployments.length,
      0,
    )
    declinedCount = matchedAgencies.reduce(
      (sum, entry) =>
        sum +
        entry.broadcasts.reduce(
          (broadcastSum, broadcast) =>
            broadcastSum + broadcast.declinedVehicleTypesCount,
          0,
        ),
      0,
    )
  } else if (hasAgencyFilter) {
    const deployments = detail.deployments.filter(
      (deployment) =>
        (agencyId && deployment.agencyId === agencyId) ||
        (agencyName &&
          deployment.agencyName.trim().toLowerCase() === agencyName),
    )
    const broadcasts = detail.broadcasts.filter(
      (broadcast) =>
        agencyName &&
        broadcast.agencyName.trim().toLowerCase() === agencyName,
    )
    deploymentCount = deployments.length
    declinedCount = broadcasts.reduce(
      (sum, broadcast) => sum + broadcast.declinedVehicleTypesCount,
      0,
    )
  } else {
    // Without agency context, only hide when the whole incident is fully covered.
    deploymentCount = detail.deployments.length
    declinedCount = detail.broadcasts.reduce(
      (sum, broadcast) => sum + broadcast.declinedVehicleTypesCount,
      0,
    )
  }

  return (
    requestedCount === deploymentCount ||
    requestedCount === deploymentCount + declinedCount
  )
}

export type UpdateEmergencyIncidentEndDatePayload = {
  end_date: string
  remarks: string
}

export async function updateEmergencyIncidentEndDate(
  incidentId: string,
  endDateIso: string,
  remarks: string,
): Promise<unknown> {
  const trimmed = incidentId.trim()
  const endDate = endDateIso.trim()
  const trimmedRemarks = remarks.trim()
  if (!trimmed) throw new Error('Missing emergency incident id')
  if (!endDate) throw new Error('End date is required')
  if (!trimmedRemarks) throw new Error('Remarks are required')
  return apiPatch<unknown, UpdateEmergencyIncidentEndDatePayload>(
    `/emergency/incidents/${encodeURIComponent(trimmed)}/end-date`,
    {
      end_date: endDate,
      remarks: trimmedRemarks,
    },
  )
}

export type DeclineEmergencyIncidentPayload = {
  response_notes: string
}

export type DeployEmergencyIncidentPayload = {
  vehicle_ids: string[]
  vehicle_type_id: string
  notes: string
}

export async function declineEmergencyIncident(
  incidentId: string,
  responseNotes: string,
): Promise<unknown> {
  const trimmed = incidentId.trim()
  const notes = responseNotes.trim()
  if (!trimmed) throw new Error('Missing emergency incident id')
  if (!notes) throw new Error('Response notes are required')
  return apiPost<unknown, DeclineEmergencyIncidentPayload>(
    `/emergency/incidents/${encodeURIComponent(trimmed)}/decline`,
    { response_notes: notes },
  )
}

type DeclineEmergencyVehicleTypePayload = {
  vehicle_type_id: string
  response_notes: string
}

export async function declineEmergencyVehicleType(
  incidentId: string,
  vehicleTypeId: string,
  responseNotes: string,
): Promise<unknown> {
  const trimmed = incidentId.trim()
  const typeId = vehicleTypeId.trim()
  const notes = responseNotes.trim()
  if (!trimmed) throw new Error('Missing emergency incident id')
  if (!typeId) throw new Error('Vehicle type is required')
  if (!notes) throw new Error('Response notes are required')
  return apiPost<unknown, DeclineEmergencyVehicleTypePayload>(
    `/emergency/incidents/${encodeURIComponent(trimmed)}/decline-vehicle-type`,
    {
      vehicle_type_id: typeId,
      response_notes: notes,
    },
  )
}

export async function deployEmergencyIncident(
  incidentId: string,
  payload: DeployEmergencyIncidentPayload,
): Promise<unknown> {
  const trimmed = incidentId.trim()
  if (!trimmed) throw new Error('Missing emergency incident id')
  if (payload.vehicle_ids.length === 0) {
    throw new Error('Select at least one vehicle to deploy.')
  }
  if (!payload.vehicle_type_id.trim()) {
    throw new Error('Vehicle type is required.')
  }
  return apiPost<unknown, DeployEmergencyIncidentPayload>(
    `/emergency/incidents/${encodeURIComponent(trimmed)}/deploy`,
    {
      vehicle_ids: [...payload.vehicle_ids],
      vehicle_type_id: payload.vehicle_type_id.trim(),
      notes: payload.notes.trim(),
    },
  )
}

function mapAvailableVehicle(record: ApiRecord): EmergencyAvailableVehicle | null {
  const id = pickText(record, ['id', 'vehicle_id', 'vehicleId'])
  if (!id) return null

  const nestedType =
    nestedRecord(record.vehicle_type) ??
    nestedRecord(record.vehicleType) ??
    nestedRecord(record.category)
  const nestedCategory =
    nestedRecord(record.vehicle_category) ?? nestedRecord(record.vehicleCategory)
  const nestedStatus =
    nestedRecord(record.vehicle_status) ?? nestedRecord(record.vehicleStatus)
  const nestedMovement =
    nestedRecord(record.movement_status) ?? nestedRecord(record.movementStatus)

  const make = pickText(record, ['make', 'vehicle_make'])
  const model = pickText(record, ['model', 'vehicle_model'])
  const makeModel =
    pickText(record, ['make_model', 'makeModel', 'vehicle_name', 'name']) ||
    [make, model].filter(Boolean).join(' ') ||
    '—'

  return {
    id,
    registrationNumber:
      pickText(record, [
        'registration_number',
        'registrationNumber',
        'vehicle_number',
        'vehicleNumber',
      ]) || '—',
    makeModel,
    category:
      (nestedCategory ? pickText(nestedCategory, ['name', 'label']) : '') ||
      pickText(record, [
        'vehicle_category_name',
        'vehicleCategoryName',
        'category',
      ]) ||
      '—',
    vehicleTypeName:
      (nestedType ? pickText(nestedType, ['name', 'label']) : '') ||
      pickText(record, [
        'vehicle_type_name',
        'vehicleTypeName',
        'type_name',
        'typeName',
      ]) ||
      '—',
    status:
      (nestedStatus ? pickText(nestedStatus, ['name', 'label']) : '') ||
      pickText(record, [
        'vehicle_status_name',
        'vehicleStatusName',
        'status_name',
        'status',
      ]) ||
      '—',
    movementStatus:
      (nestedMovement ? pickText(nestedMovement, ['name', 'label']) : '') ||
      pickText(record, [
        'movement_status_name',
        'movementStatusName',
        'movement_status',
        'movementStatus',
        'movement',
      ]) ||
      '—',
    vehicleTypeId:
      pickText(record, ['vehicle_type_id', 'vehicleTypeId']) ||
      (nestedType ? pickText(nestedType, ['id']) : ''),
  }
}

/** Vehicles for emergency deployment (`GET /vehicles?vehicle_type_id=`). */
export async function fetchEmergencyAvailableVehicles(
  vehicleTypeId: string,
): Promise<EmergencyAvailableVehicle[]> {
  const typeId = vehicleTypeId.trim()
  if (!typeId) return []

  const pageSize = 100
  const baseParams = new URLSearchParams()
  baseParams.set('page_size', String(pageSize))
  baseParams.set('search', '')
  baseParams.set('vehicle_type_id', typeId)

  const firstPayload = await apiGet<unknown>(
    `/vehicles?page=1&${baseParams.toString()}`,
  )
  const firstRows = extractMasterList(firstPayload)
    .map((record) => mapAvailableVehicle(record))
    .filter((row): row is EmergencyAvailableVehicle => row !== null)

  const paged = applyPagination(firstPayload, firstRows, 1, pageSize, {
    page: 1,
    pageSize,
    pageLength: firstRows.length,
  })

  const rows = [...paged.rows]
  for (let page = 2; page <= paged.totalPages; page += 1) {
    const payload = await apiGet<unknown>(
      `/vehicles?page=${page}&${baseParams.toString()}`,
    )
    const nextRows = extractMasterList(payload)
      .map((record) => mapAvailableVehicle(record))
      .filter((row): row is EmergencyAvailableVehicle => row !== null)
    rows.push(...nextRows)
  }

  return rows
}
