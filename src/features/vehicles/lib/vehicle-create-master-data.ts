// Fetches master-data lists used by the vehicle create form (classification & agency fields).
import { apiGet } from '@/services/apiClient'

export type MasterOption = { value: string; label: string }

type ApiRecord = Record<string, unknown>

const PAGE_SIZE = 100

export function extractMasterList(payload: unknown): ApiRecord[] {
  if (Array.isArray(payload)) return payload.filter((item): item is ApiRecord => !!item && typeof item === 'object')
  if (!payload || typeof payload !== 'object') return []
  const root = payload as Record<string, unknown>
  const candidates = [
    root.items,
    root.results,
    root.data,
    (root.data as Record<string, unknown> | undefined)?.items,
    (root.data as Record<string, unknown> | undefined)?.results,
    (root.data as Record<string, unknown> | undefined)?.records,
  ]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is ApiRecord => !!item && typeof item === 'object')
    }
  }
  return []
}

function isActiveRecord(record: ApiRecord): boolean {
  if (record.active === undefined) return true
  return record.active === true || record.active === 1 || record.active === '1'
}

function recordsToCodeNameOptions(records: ApiRecord[]): MasterOption[] {
  return records
    .filter(isActiveRecord)
    .map((r) => {
      const code = typeof r.code === 'string' ? r.code : ''
      const name = typeof r.name === 'string' ? r.name : ''
      const value = code.trim() || name.trim()
      const label = name.trim() || code.trim() || value
      if (!value) return null
      return { value, label }
    })
    .filter((o): o is MasterOption => o !== null)
}

function recordsToAgencyOptions(records: ApiRecord[]): MasterOption[] {
  return records
    .filter(isActiveRecord)
    .map((r) => {
      const id = r.id != null && String(r.id).trim() !== '' ? String(r.id) : ''
      const name = typeof r.name === 'string' ? r.name.trim() : ''
      const code = typeof r.code === 'string' ? r.code.trim() : ''
      const value = id || code
      const label = name || code
      if (!value || !label) return null
      return { value, label }
    })
    .filter((o): o is MasterOption => o !== null)
}

export type VehicleCreateMasterLists = {
  vehicleTypes: MasterOption[]
  vehicleCategories: MasterOption[]
  fuelTypes: MasterOption[]
  vehicleStatuses: MasterOption[]
  vehicleMovementStatuses: MasterOption[]
  agencies: MasterOption[]
  insuranceProviders: MasterOption[]
}

export async function fetchVehicleCreateMasterLists(): Promise<VehicleCreateMasterLists> {
  const [
    vehicleTypePayload,
    vehicleCategoryPayload,
    fuelTypePayload,
    vehicleStatusPayload,
    vehicleMovementPayload,
    agenciesPayload,
    insurancePayload,
  ] = await Promise.all([
    apiGet<unknown>(`/master/vehicle-type?page=1&page_size=${PAGE_SIZE}&code=&search=`),
    apiGet<unknown>(`/master/vehicle-categories?page=1&page_size=${PAGE_SIZE}&code=&search=`),
    apiGet<unknown>(`/master/fuel-types?page=1&page_size=${PAGE_SIZE}&code=&search=`),
    apiGet<unknown>(`/master/vehicle-statuses?page=1&page_size=${PAGE_SIZE}&code=&search=`),
    apiGet<unknown>(`/master/vehicle-movement-statuses?page=1&page_size=${PAGE_SIZE}&code=&search=`),
    apiGet<unknown>(`/master/agencies?page=1&page_size=${PAGE_SIZE}&search=`),
    apiGet<unknown>(`/master/insurance-providers?page=1&page_size=${PAGE_SIZE}&code=&search=`),
  ])

  return {
    vehicleTypes: recordsToCodeNameOptions(extractMasterList(vehicleTypePayload)),
    vehicleCategories: recordsToCodeNameOptions(extractMasterList(vehicleCategoryPayload)),
    fuelTypes: recordsToCodeNameOptions(extractMasterList(fuelTypePayload)),
    vehicleStatuses: recordsToCodeNameOptions(extractMasterList(vehicleStatusPayload)),
    vehicleMovementStatuses: recordsToCodeNameOptions(extractMasterList(vehicleMovementPayload)),
    agencies: recordsToAgencyOptions(extractMasterList(agenciesPayload)),
    insuranceProviders: recordsToCodeNameOptions(extractMasterList(insurancePayload)),
  }
}
