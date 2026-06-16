// Fetches master-data lists used by the vehicle create form (classification & agency fields).
import { apiGet } from '@/services/apiClient'
import { extractMasterList } from '@/shared/lib/organogram-master-lookup'

export { extractMasterList }
export type {
  OrganogramDisplayLookups,
  OrganogramMasterLookups,
  VehicleDetailMasterLookups,
} from '@/shared/lib/organogram-master-lookup'
export {
  fetchOrganogramDisplayLookups,
  fetchOrganogramMasterLookups,
  fetchVehicleDetailMasterLookups,
  fetchVehicleDetailStatusLookups,
  fetchVehicleListStatusLookups,
} from '@/shared/lib/organogram-master-lookup'

export type MasterOption = { value: string; label: string }

export type VehicleCategoryOption = MasterOption & { code: string }

type ApiRecord = Record<string, unknown>

const PAGE_SIZE = 200

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

function recordsToVehicleCategoryOptions(records: ApiRecord[]): VehicleCategoryOption[] {
  return records
    .filter(isActiveRecord)
    .map((r) => {
      const id = r.id != null && String(r.id).trim() !== '' ? String(r.id) : ''
      const name = typeof r.name === 'string' ? r.name.trim() : ''
      const code = typeof r.code === 'string' ? r.code.trim() : ''
      if (!id) return null
      const label = code && name && code !== name ? `${name} (${code})` : name || code || id
      return { value: id, label, code: code || name }
    })
    .filter((o): o is VehicleCategoryOption => o !== null)
}

/** Master rows keyed by UUID `id` (e.g. vehicle category, fuel type on `/vehicles`). */
function recordsToIdNameOptions(records: ApiRecord[]): MasterOption[] {
  return records
    .filter(isActiveRecord)
    .map((r) => {
      const id = r.id != null && String(r.id).trim() !== '' ? String(r.id) : ''
      const name = typeof r.name === 'string' ? r.name.trim() : ''
      const code = typeof r.code === 'string' ? r.code.trim() : ''
      if (!id) return null
      const label = code && name && code !== name ? `${name} (${code})` : name || code || id
      return { value: id, label }
    })
    .filter((o): o is MasterOption => o !== null)
}

function readAssetNameLabel(record: ApiRecord): string {
  if (typeof record.name === 'string' && record.name.trim()) return record.name.trim()
  if (typeof record.asset_name === 'string' && record.asset_name.trim()) {
    return record.asset_name.trim()
  }
  if (typeof record.code === 'string' && record.code.trim()) return record.code.trim()
  return ''
}

/** Map `/master/asset-names` rows (`{ name: "Hilux" }`, optional `id`) to select options. */
function recordsToAssetNameOptions(records: ApiRecord[]): MasterOption[] {
  return records
    .filter(isActiveRecord)
    .map((record) => {
      const label = readAssetNameLabel(record)
      const id =
        record.id != null && String(record.id).trim() !== '' ? String(record.id).trim() : ''
      const value = id || label
      if (!value) return null
      return { value, label: label || value }
    })
    .filter((option): option is MasterOption => option !== null)
}

/** Active asset names from master for the vehicle create/edit form. */
export async function fetchVehicleAssetNameOptions(): Promise<MasterOption[]> {
  const payload = await apiGet<unknown>(
    `/master/asset-names/full?active=true&page=1&page_size=${PAGE_SIZE}&code=&search=`,
  )
  return recordsToAssetNameOptions(extractMasterList(payload))
}

export function resolveVehicleCategoryCode(
  categoryId: string,
  categories: VehicleCategoryOption[],
): string {
  const trimmed = categoryId.trim()
  if (!trimmed) return ''
  const match = categories.find((category) => category.value === trimmed)
  return match?.code.trim() ?? ''
}

function recordsToVehicleTypeOptions(records: ApiRecord[]): MasterOption[] {
  return records
    .filter(isActiveRecord)
    .map((r) => {
      const id = r.id != null && String(r.id).trim() !== '' ? String(r.id) : ''
      const name = typeof r.name === 'string' ? r.name.trim() : ''
      const code = typeof r.code === 'string' ? r.code.trim() : ''
      const value = id || code
      if (!value) return null
      const label = name || code || value
      return { value, label }
    })
    .filter((o): o is MasterOption => o !== null)
}

export async function fetchVehicleTypesByCategoryCode(
  categoryCode: string,
): Promise<MasterOption[]> {
  const code = categoryCode.trim()
  if (!code) return []
  const payload = await apiGet<unknown>(
    `/master/vehicle-types/category/${encodeURIComponent(code)}?page=1&page_size=${PAGE_SIZE}&code=&search=`,
  )
  return recordsToVehicleTypeOptions(extractMasterList(payload))
}

export type VehicleCreateMasterLists = {
  vehicleTypes: MasterOption[]
  vehicleCategories: VehicleCategoryOption[]
  fuelTypes: MasterOption[]
  vehicleStatuses: MasterOption[]
  vehicleMovementStatuses: MasterOption[]
  agencies: MasterOption[]
  insuranceProviders: MasterOption[]
  vehicleAssetNames: MasterOption[]
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
    vehicleAssetNames,
  ] = await Promise.all([
    apiGet<unknown>(`/master/vehicle-types?active=true&page=1&page_size=${PAGE_SIZE}&code=&search=`),
    apiGet<unknown>(`/master/vehicle-categories?active=true&page=1&page_size=${PAGE_SIZE}&code=&search=`),
    apiGet<unknown>(`/master/fuel-types?active=true&page=1&page_size=${PAGE_SIZE}&code=&search=`),
    apiGet<unknown>(`/master/vehicle-statuses?page=1&page_size=${PAGE_SIZE}&code=&search=`),
    apiGet<unknown>(`/master/vehicle-movement-statuses?active=true&page=1&page_size=${PAGE_SIZE}&code=&search=`),
    apiGet<unknown>(`/master/agencies?active=true&page=1&page_size=${PAGE_SIZE}&search=`),
    apiGet<unknown>(`/master/insurance-providers?active=true&page=1&page_size=${PAGE_SIZE}&code=&search=`),
    fetchVehicleAssetNameOptions(),
  ])

  return {
    vehicleTypes: recordsToCodeNameOptions(
      extractMasterList(vehicleTypePayload),
    ),
    vehicleCategories: recordsToVehicleCategoryOptions(
      extractMasterList(vehicleCategoryPayload),
    ),
    fuelTypes: recordsToIdNameOptions(extractMasterList(fuelTypePayload)),
    vehicleStatuses: recordsToIdNameOptions(
      extractMasterList(vehicleStatusPayload),
    ),
    vehicleMovementStatuses: recordsToIdNameOptions(
      extractMasterList(vehicleMovementPayload),
    ),
    agencies: recordsToAgencyOptions(extractMasterList(agenciesPayload)),
    insuranceProviders: recordsToIdNameOptions(
      extractMasterList(insurancePayload),
    ),
    vehicleAssetNames,
  };
}
