/**
 * Resolves vehicle original/current agency labels from `original_assignment` /
 * `current_assignment` embedded on the vehicle detail response.
 * Vehicle and movement status labels come from nested objects on the same response.
 */
import { isUuidLike } from '@/shared/lib/organogram-master-lookup'
import { mapUserDetailFields } from '@/features/user/lib/users-api'

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

function pickAssignmentEntityName(assignment: ApiRecord): string | null {
  const entity = assignment.entity
  if (entity && typeof entity === 'object' && !Array.isArray(entity)) {
    const entityRecord = entity as ApiRecord
    const fromEntity =
      toText(entityRecord.name).trim() ||
      toText(entityRecord.label).trim() ||
      toText(entityRecord.title).trim()
    if (fromEntity && !isUuidLike(fromEntity)) return fromEntity
  }

  const fromAssignment =
    toText(assignment.name).trim() ||
    toText(assignment.entity_name).trim() ||
    toText(assignment.entityName).trim() ||
    toText(assignment.label).trim()
  return fromAssignment && !isUuidLike(fromAssignment) ? fromAssignment : null
}

export function parseVehicleAssignmentRef(
  record: ApiRecord,
  kind: 'original' | 'current',
): VehicleAssignmentRef | null {
  const assignment = pickAssignmentObject(record, kind)
  if (!assignment) return null

  const entityId = toId(assignment.entity_id ?? assignment.entityId)
  const entityType = toText(assignment.entity_type ?? assignment.entityType).trim()
  const embeddedName = pickAssignmentEntityName(assignment) ?? undefined

  if (!entityId || !entityType) return null
  return {
    entityId,
    entityType,
    ...(embeddedName ? { embeddedName } : {}),
  }
}

export type VehicleAssignmentNames = {
  original: string | null
  current: string | null
}

/** Reads original/current agency display names from the vehicle detail response. */
export function pickVehicleAssignmentNames(record: ApiRecord): VehicleAssignmentNames {
  const flat = flattenVehicleDetailRecord(record)
  const originalAssignment = pickAssignmentObject(record, 'original')
  const currentAssignment = pickAssignmentObject(record, 'current')

  const pickFlatAgencyName = (kind: 'original' | 'current'): string | null => {
    const keys =
      kind === 'original'
        ? (['original_agency_name', 'original_agency', 'originalAgency'] as const)
        : (['current_agency_name', 'current_agency', 'currentAgency'] as const)
    return pickEmbeddedName(flat, keys)
  }

  return {
    original:
      (originalAssignment ? pickAssignmentEntityName(originalAssignment) : null) ||
      pickFlatAgencyName('original'),
    current:
      (currentAssignment ? pickAssignmentEntityName(currentAssignment) : null) ||
      pickFlatAgencyName('current'),
  }
}

/** @deprecated Use `pickVehicleAssignmentNames` — kept for callers expecting async shape. */
export async function fetchVehicleAssignmentNames(
  record: ApiRecord,
): Promise<VehicleAssignmentNames> {
  return pickVehicleAssignmentNames(record)
}

export function isVehicleAgencyKindField(field: { keys: readonly string[] }): 'original' | 'current' | null {
  if (
    field.keys.some(
      (k) =>
        k === 'original_agency_id' ||
        k === 'originalAgencyId' ||
        k === 'original_assignment' ||
        k === 'originalAssignment',
    )
  ) {
    return 'original'
  }
  if (
    field.keys.some(
      (k) =>
        k === 'current_agency_id' ||
        k === 'currentAgencyId' ||
        k === 'current_assignment' ||
        k === 'currentAssignment',
    )
  ) {
    return 'current'
  }
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

const VEHICLE_STATUS_NAME_KEYS = [
  'vehicle_status_name',
  'vehicleStatusName',
  'status_name',
  'statusName',
] as const

const MOVEMENT_STATUS_NAME_KEYS = [
  'vehicle_movement_status_name',
  'vehicleMovementStatusName',
  'movement_status_name',
  'movementStatusName',
] as const

const VEHICLE_STATUS_OBJECT_KEYS = [
  'vehicle_status',
  'vehicleStatus',
  'status',
  ...VEHICLE_STATUS_NAME_KEYS,
] as const

const MOVEMENT_STATUS_OBJECT_KEYS = [
  'movement_status',
  'movementStatus',
  'movement',
  ...MOVEMENT_STATUS_NAME_KEYS,
] as const

/** Reads vehicle and movement status display names from the vehicle detail response. */
export function pickVehicleStatusNames(record: ApiRecord): VehicleStatusNames {
  const flat = flattenVehicleDetailRecord(record)
  return {
    vehicleStatus: pickEmbeddedName(flat, VEHICLE_STATUS_OBJECT_KEYS),
    movementStatus: pickEmbeddedName(flat, MOVEMENT_STATUS_OBJECT_KEYS),
  }
}

/** @deprecated Use `pickVehicleStatusNames` — kept for callers expecting async shape. */
export async function fetchVehicleStatusNames(record: ApiRecord): Promise<VehicleStatusNames> {
  return pickVehicleStatusNames(record)
}

export type VehicleDetailResolvedNames = {
  assignments: VehicleAssignmentNames
  statuses: VehicleStatusNames
  createdBy: string | null
}

function pickCreatedByDisplayName(record: ApiRecord): string | null {
  const flat = flattenVehicleDetailRecord(record)
  for (const key of ['created_by', 'createdBy'] as const) {
    const value = flat[key]
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const { name } = mapUserDetailFields(value as ApiRecord)
      const trimmed = name.trim()
      if (trimmed && trimmed !== '-') return trimmed
    }
  }
  return null
}

/** Reads display names embedded on the vehicle detail response. */
export function pickVehicleDetailResolvedNames(record: ApiRecord): VehicleDetailResolvedNames {
  return {
    assignments: pickVehicleAssignmentNames(record),
    statuses: pickVehicleStatusNames(record),
    createdBy: pickCreatedByDisplayName(record),
  }
}

/** @deprecated Use `pickVehicleDetailResolvedNames` — kept for callers expecting async shape. */
export async function fetchVehicleDetailResolvedNames(
  record: ApiRecord,
): Promise<VehicleDetailResolvedNames> {
  return pickVehicleDetailResolvedNames(record)
}
