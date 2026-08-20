// Vehicles currently assigned to the signed-in driver, for the driver dashboard.
import { mapVehicleRecordToListRow } from '@/features/vehicles/lib/vehicles-api'
import { apiGet } from '@/services/apiClient'
import { extractMasterList } from '@/shared/lib/organogram-master-lookup'

type ApiRecord = Record<string, unknown>

export type DriverAssignedVehicle = {
  /** Assignment id, falling back to the vehicle id when absent. */
  id: string
  vehicleId: string
  plateNumber: string
  makeModel: string
  /** Already unit-suffixed by the vehicle mapper, e.g. `140,907 km`. */
  odometer: string
  status: string
  movement: string
  /** `Primary` / `Secondary`. */
  priority: string
  /** `Available` / `Unavailable`. */
  availability: string
  isUnavailable: boolean
}

function isRecord(value: unknown): value is ApiRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function pickScalar(record: ApiRecord, keys: string[]): string {
  for (const key of keys) {
    const text = toText(record[key])
    if (text) return text
  }
  return ''
}

/** `PRIMARY` → `Primary`, `not_available` → `Not available`. */
function toDisplayLabel(raw: string): string {
  const spaced = raw.replace(/[_-]+/g, ' ').trim().toLowerCase()
  if (!spaced) return ''
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** The vehicle mapper passes the reading through raw, so group it here: `140,907 km`. */
function formatOdometer(raw: string): string {
  const numeric = Number(raw.replace(/[^\d.]/g, ''))
  if (!raw || !Number.isFinite(numeric) || numeric <= 0) return raw
  return `${numeric.toLocaleString('en-BT')} km`
}

function pickVehicleBlock(record: ApiRecord): ApiRecord | null {
  for (const key of ['vehicle_info', 'vehicleInfo', 'vehicle']) {
    if (isRecord(record[key])) return record[key] as ApiRecord
  }
  return null
}

function mapAssignedVehicle(record: ApiRecord): DriverAssignedVehicle | null {
  const vehicleBlock = pickVehicleBlock(record)
  const row = mapVehicleRecordToListRow(vehicleBlock ? { ...record, ...vehicleBlock } : record)

  const vehicleId =
    pickScalar(record, ['vehicle_id', 'vehicleId']) ||
    (vehicleBlock ? pickScalar(vehicleBlock, ['id', 'uuid']) : '') ||
    row.id
  if (!vehicleId) return null

  const availability = pickScalar(record, ['availability_status', 'availabilityStatus'])

  return {
    id: pickScalar(record, ['id', 'assignment_id', 'assignmentId']) || vehicleId,
    vehicleId,
    plateNumber: row.registration_number === '—' ? '' : row.registration_number,
    makeModel: row.makeModel === '—' ? '' : row.makeModel,
    odometer: row.odometer === '—' ? '' : formatOdometer(row.odometer),
    status: row.status === '—' ? '' : row.status,
    movement: row.movement === '—' ? '' : row.movement,
    priority: toDisplayLabel(pickScalar(record, ['priority', 'assignment_priority'])),
    availability: toDisplayLabel(availability),
    isUnavailable: /unavailable|not.?available/i.test(availability),
  }
}

/** `extractMasterList` misses payloads keyed by `vehicles`. */
function extractAssignmentList(payload: unknown): ApiRecord[] {
  const rows = extractMasterList(payload)
  if (rows.length > 0) return rows

  if (!payload || typeof payload !== 'object') return []
  const root = payload as ApiRecord
  const data = isRecord(root.data) ? root.data : null
  for (const candidate of [root.vehicles, data?.vehicles]) {
    if (Array.isArray(candidate)) {
      return candidate.filter(isRecord)
    }
  }
  return []
}

/**
 * `GET /drivers/{driverId}/vehicles`
 * Assignment records carry the vehicle inline, so no per-vehicle lookup is needed.
 */
export async function fetchDriverAssignedVehicleList(
  driverId: string,
): Promise<DriverAssignedVehicle[]> {
  const trimmed = driverId.trim()
  if (!trimmed) return []

  const payload = await apiGet<unknown>(`/drivers/${encodeURIComponent(trimmed)}/vehicles`)

  return extractAssignmentList(payload)
    .map((record) => mapAssignedVehicle(record))
    .filter((vehicle): vehicle is DriverAssignedVehicle => vehicle !== null)
}
