/**
 * Resolves vehicle original/current organogram labels from `original_assignment` /
 * `current_assignment` via `GET /master/{entity_type}/id/{entity_id}`.
 * Status labels resolve via `GET /master/vehicle-statuses/{status_id}` and
 * `GET /master/vehicle-movement-statuses/{movement_status_id}`.
 */
import { fetchUserById, mapUserDetailFields } from '@/features/user/lib/users-api'
import {
  fetchMasterEntityNameById,
  fetchMasterRecordNameById,
  isUuidLike,
} from '@/shared/lib/organogram-master-lookup'

type ApiRecord = Record<string, unknown>

function toText(value: unknown): string {
  return typeof value === 'string'
    ? value
    : typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : ''
}

function toId(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim()
  return ''
}

/** Merge nested `data` / `vehicle` envelopes from GET `/vehicles/{id}`. */
export function flattenVehicleDetailRecord(record: ApiRecord): ApiRecord {
  const out: ApiRecord = { ...record }

  const merge = (obj: unknown) => {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      Object.assign(out, obj as ApiRecord)
    }
  }

  merge(record.data)
  merge(record.vehicle)
  merge(record.vehicle_detail)
  merge(record.vehicleDetail)
  if (record.data && typeof record.data === 'object' && !Array.isArray(record.data)) {
    merge((record.data as ApiRecord).vehicle)
  }

  return out
}

export type VehicleAssignmentRef = {
  entityId: string
  entityType: string
  embeddedName?: string
}

function pickAssignmentObject(record: ApiRecord, kind: 'original' | 'current'): ApiRecord | null {
  const flat = flattenVehicleDetailRecord(record)
  const keys =
    kind === 'original'
      ? (['original_assignment', 'originalAssignment'] as const)
      : (['current_assignment', 'currentAssignment'] as const)

  for (const key of keys) {
    const value = flat[key]
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as ApiRecord
    }
  }
  return null
}

export function parseVehicleAssignmentRef(
  record: ApiRecord,
  kind: 'original' | 'current',
): VehicleAssignmentRef | null {
  const assignment = pickAssignmentObject(record, kind)
  if (!assignment) return null

  const entityId = toId(assignment.entity_id ?? assignment.entityId)
  const entityType = toText(assignment.entity_type ?? assignment.entityType).trim()
  const embeddedName =
    toText(assignment.name).trim() ||
    toText(assignment.entity_name).trim() ||
    toText(assignment.entityName).trim() ||
    toText(assignment.label).trim()

  if (!entityId || !entityType) return null
  return {
    entityId,
    entityType,
    ...(embeddedName && !isUuidLike(embeddedName) ? { embeddedName } : {}),
  }
}

export type VehicleAssignmentNames = {
  original: string | null
  current: string | null
}

async function resolveAssignmentName(
  record: ApiRecord,
  kind: 'original' | 'current',
): Promise<string | null> {
  const ref = parseVehicleAssignmentRef(record, kind)
  if (!ref) return null
  if (ref.embeddedName) return ref.embeddedName
  return fetchMasterEntityNameById(ref.entityType, ref.entityId)
}

/** Fetches display names for original/current assignment tiers on a vehicle detail record. */
export async function fetchVehicleAssignmentNames(
  record: ApiRecord,
): Promise<VehicleAssignmentNames> {
  const [original, current] = await Promise.all([
    resolveAssignmentName(record, 'original'),
    resolveAssignmentName(record, 'current'),
  ])
  return { original, current }
}

export function isVehicleAgencyKindField(field: { keys: readonly string[] }): 'original' | 'current' | null {
  if (field.keys.some((k) => k === 'original_agency_id' || k === 'originalAgencyId')) return 'original'
  if (field.keys.some((k) => k === 'current_agency_id' || k === 'currentAgencyId')) return 'current'
  return null
}

export function resolveVehicleAgencyDisplayName(
  kind: 'original' | 'current',
  names: VehicleAssignmentNames | undefined,
): string {
  if (!names) return '—'
  const name = kind === 'original' ? names.original : names.current
  return name?.trim() || '—'
}

function pickScalarId(record: ApiRecord, keys: readonly string[]): string {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) continue
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nestedId = toId((value as ApiRecord).id)
      if (nestedId) return nestedId
    }
  }
  return ''
}

function pickEmbeddedName(record: ApiRecord, keys: readonly string[]): string | null {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) continue
    const value = record[key]
    if (typeof value === 'string') {
      const name = value.trim()
      if (name && !isUuidLike(name)) return name
      continue
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const name =
        toText((value as ApiRecord).name).trim() ||
        toText((value as ApiRecord).label).trim()
      if (name && !isUuidLike(name)) return name
    }
  }
  return null
}

export type VehicleStatusNames = {
  vehicleStatus: string | null
  movementStatus: string | null
}

const VEHICLE_STATUS_ID_KEYS = [
  'status_id',
  'statusId',
  'vehicle_status_id',
  'vehicleStatusId',
] as const

const VEHICLE_STATUS_NAME_KEYS = [
  'vehicle_status_name',
  'vehicleStatusName',
  'status_name',
  'statusName',
] as const

const MOVEMENT_STATUS_ID_KEYS = [
  'movement_status_id',
  'movementStatusId',
  'vehicle_movement_status_id',
  'vehicleMovementStatusId',
] as const

const MOVEMENT_STATUS_NAME_KEYS = [
  'vehicle_movement_status_name',
  'vehicleMovementStatusName',
  'movement_status_name',
  'movementStatusName',
] as const

async function resolveStatusName(
  record: ApiRecord,
  idKeys: readonly string[],
  nameKeys: readonly string[],
  resourcePath: string,
): Promise<string | null> {
  const flat = flattenVehicleDetailRecord(record)
  const embedded = pickEmbeddedName(flat, nameKeys)
  if (embedded) return embedded

  for (const key of idKeys) {
    if (!Object.prototype.hasOwnProperty.call(flat, key)) continue
    const value = flat[key]
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const name =
        toText((value as ApiRecord).name).trim() ||
        toText((value as ApiRecord).label).trim()
      if (name && !isUuidLike(name)) return name
    }
  }

  const id = pickScalarId(flat, idKeys)
  if (!id) return null
  return fetchMasterRecordNameById(resourcePath, id)
}

/** Fetches vehicle and movement status display names for a detail record. */
export async function fetchVehicleStatusNames(record: ApiRecord): Promise<VehicleStatusNames> {
  const [vehicleStatus, movementStatus] = await Promise.all([
    resolveStatusName(
      record,
      VEHICLE_STATUS_ID_KEYS,
      VEHICLE_STATUS_NAME_KEYS,
      '/master/vehicle-statuses/id',
    ),
    resolveStatusName(
      record,
      MOVEMENT_STATUS_ID_KEYS,
      MOVEMENT_STATUS_NAME_KEYS,
      '/master/vehicle-movement-statuses/id',
    ),
  ])
  return { vehicleStatus, movementStatus }
}

export type VehicleDetailResolvedNames = {
  assignments: VehicleAssignmentNames
  statuses: VehicleStatusNames
  createdBy: string | null
}

async function fetchCreatedByDisplayName(record: ApiRecord): Promise<string | null> {
  const flat = flattenVehicleDetailRecord(record)
  const id = pickScalarId(flat, ['created_by', 'createdBy'])
  if (!id) return null
  try {
    const user = await fetchUserById(id)
    const { name } = mapUserDetailFields(user)
    const trimmed = name.trim()
    return trimmed && trimmed !== '-' ? trimmed : null
  } catch {
    return null
  }
}

/** Resolves agency and status display names for the vehicle detail page. */
export async function fetchVehicleDetailResolvedNames(
  record: ApiRecord,
): Promise<VehicleDetailResolvedNames> {
  const [assignments, statuses, createdBy] = await Promise.all([
    fetchVehicleAssignmentNames(record),
    fetchVehicleStatusNames(record),
    fetchCreatedByDisplayName(record),
  ])
  return { assignments, statuses, createdBy }
}

export function isVehicleStatusKindField(field: {
  lookup?: string
}): 'vehicleStatus' | 'vehicleMovementStatus' | null {
  if (field.lookup === 'vehicleStatus') return 'vehicleStatus'
  if (field.lookup === 'vehicleMovementStatus') return 'vehicleMovementStatus'
  return null
}

export function resolveVehicleStatusDisplayName(
  kind: 'vehicleStatus' | 'vehicleMovementStatus',
  names: VehicleDetailResolvedNames | undefined,
): string {
  if (!names) return '—'
  const name =
    kind === 'vehicleStatus' ? names.statuses.vehicleStatus : names.statuses.movementStatus
  return name?.trim() || '—'
}
