export type EmergencyBroadcastStatus =
  | 'broadcasted'
  | 'active'
  | 'deployed'
  | 'closed'
  | 'cancelled'

export type EmergencyBroadcastRow = {
  id: string
  requestId: string
  /** Display label for required vehicle type(s); may be API names or a fallback. */
  vehicleCategory: string
  /** Formatted `start_date` for the list column. */
  startDateLabel: string
  /** Formatted `end_date` for the list column. */
  endDateLabel: string
  /** Raw ISO `start_date` when available. */
  startDate?: string
  /** Raw ISO `end_date` when available. */
  endDate?: string
  location: string
  agencyLabel: string
  status: EmergencyBroadcastStatus
  /** Prefer API `status_label` when present. */
  statusLabel?: string
  description?: string
  latitude?: number
  longitude?: number
}

export type EmergencyIncidentBroadcastItem = {
  id: string
  agencyName: string
  agencyCode: string
  response: string
  declinedVehicleTypesLabel: string
  declinedVehicleTypesCount: number
  statusLabel: string
  vehiclesOfferedLabel: string
  respondedAt?: string
}

export type EmergencyIncidentDeploymentItem = {
  id: string
  agencyId?: string
  agencyName: string
  agencyCode: string
  vehiclesOfferedLabel: string
  vehicleTypeId?: string
  vehicleTypeName: string
  deploymentDateTimeLabel: string
  statusLabel: string
  deployedAt?: string
  deployedByName?: string
}

/** One agency under an `agency_assignments` entry. */
export type EmergencyIncidentAssignmentAgency = {
  id: string
  agencyId: string
  agencyName: string
  agencyCode: string
  broadcasts: EmergencyIncidentBroadcastItem[]
  deployments: EmergencyIncidentDeploymentItem[]
}

/** One location/incident block from `agency_assignments`. */
export type EmergencyIncidentAssignment = {
  id: string
  location: string
  latitude: number | null
  longitude: number | null
  startDate: string
  endDate: string
  notes: string
  vehicleTypes: EmergencyIncidentVehicleType[]
  agencies: EmergencyIncidentAssignmentAgency[]
}

/** Full incident detail from `GET /emergency/incidents/:id`. */
export type EmergencyIncidentDetail = {
  id: string
  requestId: string
  vehicleCategory: string
  timeLabel: string
  location: string
  agencyLabel: string
  status: EmergencyBroadcastStatus
  statusLabel: string
  description: string
  latitude: number | null
  longitude: number | null
  startDate: string
  endDate: string
  initiatedByName: string
  initiatedAt: string
  broadcastAt: string
  closedAt: string
  createdAt: string
  updatedAt: string
  timeoutMinutes: number | null
  searchRadiusKm: number | null
  vehiclesRequired: number | null
  agenciesNotified: number
  agenciesResponded: number
  vehiclesOffered: number
  /** Required vehicle type ids from the incident payload. */
  vehicleTypeIds: string[]
  /** Required vehicle types with labels from `vehicle_types`. */
  vehicleTypes: EmergencyIncidentVehicleType[]
  /** Per-location assignments with nested agencies. */
  assignments: EmergencyIncidentAssignment[]
  broadcasts: EmergencyIncidentBroadcastItem[]
  deployments: EmergencyIncidentDeploymentItem[]
}

export type EmergencyIncidentVehicleType = {
  id: string
  code: string
  name: string
}

export type EmergencyAvailableVehicle = {
  id: string
  registrationNumber: string
  makeModel: string
  category: string
  vehicleTypeName: string
  status: string
  movementStatus: string
  vehicleTypeId: string
}

export type EmergencyAgencyAssignmentAgency = {
  agency_id: string
}

/** One location/assignment block in `POST /emergency/incidents`. */
export type EmergencyAgencyAssignmentPayload = {
  incident_location: string
  latitude: number
  longitude: number
  start_date: string
  end_date?: string
  notes: string
  vehicle_type_ids: string[]
  agencies: EmergencyAgencyAssignmentAgency[]
}

export type CreateEmergencyIncidentPayload = {
  description: string
  broadcast_immediately: boolean
  agency_assignments: EmergencyAgencyAssignmentPayload[]
}

/** One incident block in the create form field array. */
export type EmergencyIncidentRow = {
  key: string
  agencyIds: string[]
  vehicleTypeIds: string[]
  location: string
  latitude: number | null
  longitude: number | null
  startDatetime: string
  endDatetime: string
  description: string
}

export type EmergencyIncidentFormValues = {
  incidents: EmergencyIncidentRow[]
  broadcastImmediately: boolean
}

export function createEmptyEmergencyIncidentRow(): EmergencyIncidentRow {
  return {
    key: crypto.randomUUID(),
    agencyIds: [],
    vehicleTypeIds: [],
    location: '',
    latitude: null,
    longitude: null,
    startDatetime: '',
    endDatetime: '',
    description: '',
  }
}

export function createEmptyEmergencyIncidentForm(): EmergencyIncidentFormValues {
  return {
    incidents: [createEmptyEmergencyIncidentRow()],
    broadcastImmediately: true,
  }
}

/** Formats lat/lng for a single combined display field. */
export function formatLatLongDisplay(
  latitude: number | null,
  longitude: number | null,
): string {
  if (latitude == null || longitude == null) return ''
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
}

/** Parses `"lat, lng"` / `"lat lng"` into separate coordinates. */
export function parseLatLongDisplay(
  value: string,
): { latitude: number; longitude: number } | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const match = /^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/.exec(trimmed)
  if (!match) return null
  const latitude = Number.parseFloat(match[1])
  const longitude = Number.parseFloat(match[2])
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
  return { latitude, longitude }
}
