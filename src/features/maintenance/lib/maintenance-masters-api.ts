import type { ApiRecord } from '@/features/user/lib/roles-api'
import { apiGet } from '@/services/apiClient'
import { extractMasterList } from '@/shared/lib/organogram-master-lookup'

const PAGE_SIZE = 200

export type MaintenanceMasterOption = {
  value: string
  label: string
  code: string
}

function pickScalar(record: ApiRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return ''
}

function isActiveRecord(record: ApiRecord): boolean {
  if (record.active === undefined) return true
  return record.active === true || record.active === 1 || record.active === '1'
}

function mapMasterOption(record: ApiRecord): MaintenanceMasterOption | null {
  const value = pickScalar(record, ['id', 'uuid'])
  const code = pickScalar(record, ['code'])
  const label = pickScalar(record, ['name', 'label']) || code
  if (!value) return null
  return { value, label, code }
}

function mapMasterOptions(payload: unknown): MaintenanceMasterOption[] {
  return extractMasterList(payload)
    .filter(isActiveRecord)
    .map(mapMasterOption)
    .filter((option): option is MaintenanceMasterOption => option !== null)
}

export async function fetchMaintenanceTypes(): Promise<MaintenanceMasterOption[]> {
  const payload = await apiGet<unknown>(
    `/master/maintenance-types?active=true&page=1&page_size=${PAGE_SIZE}&code=&search=`,
  )
  return mapMasterOptions(payload)
}

export async function fetchProblemCategoriesByMaintenanceTypeId(
  maintenanceTypeId: string,
  maintenanceTypes: MaintenanceMasterOption[],
): Promise<MaintenanceMasterOption[]> {
  const trimmedId = maintenanceTypeId.trim()
  if (!trimmedId) return []

  const maintenanceType =
    maintenanceTypes.find((option) => option.value === trimmedId) ??
    maintenanceTypes.find((option) => option.code === trimmedId)
  const maintenanceTypeCode = maintenanceType?.code.trim()
  if (!maintenanceTypeCode) return []

  const payload = await apiGet<unknown>(
    `/master/problem-categories/by-maintenance-type/${encodeURIComponent(maintenanceTypeCode)}?page=1&page_size=${PAGE_SIZE}&search=`,
  )
  return mapMasterOptions(payload)
}
