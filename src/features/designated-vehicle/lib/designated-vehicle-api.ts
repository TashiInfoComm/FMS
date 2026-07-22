import type {
  DesignatedVehicleDetail,
  DesignatedVehicleListRow,
  DesignatedVehicleStatus,
} from '@/features/designated-vehicle/lib/designated-vehicle-types'
import { apiDelete, apiGet, apiPost, apiPut } from '@/services/apiClient'
import type { SearchableAutocompleteOption } from '@/shared/components/SearchableAutocomplete'
import { extractMasterList } from '@/shared/lib/organogram-master-lookup'
import { applyPagination } from '@/shared/utils/pagination'

const USAGE_TYPES_PAGE_SIZE = 200

type ApiRecord = Record<string, unknown>

function toText(value: unknown): string {
  return typeof value === 'string'
    ? value.trim()
    : typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : ''
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
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

function unwrapDataRecord(payload: unknown): ApiRecord | null {
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

function extractListRecords(payload: unknown): ApiRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is ApiRecord => Boolean(item) && typeof item === 'object')
  }
  if (!payload || typeof payload !== 'object') return []
  const root = payload as ApiRecord
  const data = root.data
  const candidates: unknown[] = [
    root.items,
    root.results,
    root.rows,
    root.list,
    root.designated_officials,
    Array.isArray(data) ? data : undefined,
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as ApiRecord).items
      : undefined,
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as ApiRecord).results
      : undefined,
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as ApiRecord).rows
      : undefined,
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as ApiRecord).designated_officials
      : undefined,
  ]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is ApiRecord => Boolean(item) && typeof item === 'object')
    }
  }
  return []
}

function toDesignatedVehicleStatus(value: string): DesignatedVehicleStatus {
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_')
  if (normalized.includes('MAINTENANCE')) return 'UNDER_MAINTENANCE'
  if (normalized.includes('REPLACEMENT')) return 'REPLACEMENT'
  return 'ACTIVE'
}

function pickOfficialName(record: ApiRecord): string {
  return (
    pickFirstText(record, ['full_name', 'fullName', 'official_name', 'officialName', 'name']) ||
    [
      pickFirstText(record, ['first_name', 'firstName']),
      pickFirstText(record, ['middle_name', 'middleName']),
      pickFirstText(record, ['last_name', 'lastName']),
    ]
      .filter(Boolean)
      .join(' ')
      .trim()
  )
}

function pickDesignationTypeInfo(
  record: ApiRecord,
  official: ApiRecord,
): { id: string; name: string } {
  const nested =
    getNestedRecord(official, 'designation_type') ||
    getNestedRecord(official, 'designationType') ||
    getNestedRecord(record, 'designation_type') ||
    getNestedRecord(record, 'designationType')

  const id =
    pickFirstText(official, ['designation_type_id', 'designationTypeId']) ||
    pickFirstText(record, ['designation_type_id', 'designationTypeId']) ||
    pickFirstText(nested ?? {}, ['id', 'uuid'])
  const name =
    pickFirstText(nested ?? {}, ['name', 'label', 'title']) ||
    pickFirstText(official, ['designation_type_name', 'designationTypeName']) ||
    pickFirstText(record, ['designation_type_name', 'designationTypeName'])

  return { id, name }
}

function mapUsageTypeOption(record: ApiRecord): SearchableAutocompleteOption | null {
  const id =
    record.id != null && String(record.id).trim() !== '' ? String(record.id).trim() : ''
  const name = pickFirstText(record, ['name', 'label', 'title'])
  const code = pickFirstText(record, ['code'])
  const value = id || code
  if (!value) return null
  const label = name || code || value
  return {
    value,
    label,
    description: code && code !== label ? code : undefined,
    searchText: [label, code, value].filter(Boolean).join(' '),
  }
}

function isActiveUsageType(record: ApiRecord): boolean {
  if (record.active === undefined) return true
  return record.active === true || record.active === 1 || record.active === '1'
}

export async function fetchUsageTypeOptions(): Promise<SearchableAutocompleteOption[]> {
  const payload = await apiGet<unknown>(
    `/master/usage-types?active=true&page=1&page_size=${USAGE_TYPES_PAGE_SIZE}&code=&search=`,
  )
  return extractMasterList(payload)
    .filter(isActiveUsageType)
    .map(mapUsageTypeOption)
    .filter((option): option is SearchableAutocompleteOption => option !== null)
}

function pickMakeModel(vehicle: ApiRecord | null): string {
  if (!vehicle) return ''
  const makeModel = pickFirstText(vehicle, ['makeModel', 'make_model'])
  if (makeModel) return makeModel
  return [pickFirstText(vehicle, ['make']), pickFirstText(vehicle, ['model'])]
    .filter(Boolean)
    .join(' ')
    .trim()
}

function mapDesignatedVehicleListRow(record: ApiRecord): DesignatedVehicleListRow | null {
  const vehicle = getNestedRecord(record, 'vehicle')
  const official =
    getNestedRecord(record, 'official') ||
    getNestedRecord(record, 'designated_official') ||
    getNestedRecord(record, 'official_info') ||
    record
  const vehicleId =
    pickFirstText(record, ['vehicle_id', 'vehicleId']) ||
    pickFirstText(vehicle ?? {}, ['id', 'vehicle_id', 'uuid'])
  if (!vehicleId) return null

  const registrationNumber =
    pickFirstText(record, ['registration_number', 'registrationNumber', 'vehicle_number']) ||
    pickFirstText(vehicle ?? {}, ['registration_number', 'registrationNumber', 'vehicle_number'])

  const makeModel =
    pickMakeModel(vehicle) || pickMakeModel(record) || pickMakeModel(official) || ''
  const designationType = pickDesignationTypeInfo(record, official)

  return {
    id: vehicleId,
    vehicleId,
    registrationNumber: registrationNumber || '—',
    makeModel: makeModel || '—',
    officialName: pickOfficialName(official) || pickOfficialName(record) || '—',
    designation:
      pickFirstText(official, ['designation', 'position', 'title']) ||
      pickFirstText(record, ['designation', 'position', 'title']) ||
      '—',
    designationTypeName: designationType.name || '—',
    status: toDesignatedVehicleStatus(
      pickFirstText(record, ['status', 'vehicle_status', 'assignment_status']) ||
        pickFirstText(vehicle ?? {}, ['status', 'vehicle_status']),
    ),
  }
}

function mapDesignatedVehicleDetail(record: ApiRecord): DesignatedVehicleDetail | null {
  const listRow = mapDesignatedVehicleListRow(record)
  if (!listRow) return null

  const vehicle = getNestedRecord(record, 'vehicle')
  const official =
    getNestedRecord(record, 'official') ||
    getNestedRecord(record, 'designated_official') ||
    getNestedRecord(record, 'official_info') ||
    record
  const driver =
    getNestedRecord(record, 'driver') ||
    getNestedRecord(record, 'driver_info') ||
    getNestedRecord(vehicle ?? {}, 'driver_info')

  const odometerKm = toNumber(
    pickFirstText(vehicle ?? record, ['odometer', 'odometer_km', 'odometerKm']),
  )
  const currentQuota = toNumber(
    pickFirstText(record, ['current_quota', 'currentQuota', 'fuel_quota_balance']),
  )
  const thresholdAmount = toNumber(
    pickFirstText(record, ['threshold_amount', 'thresholdAmount']),
  )
  const monthlyAllocation = toNumber(
    pickFirstText(record, ['monthly_allocation', 'monthlyAllocation', 'fuel_quota']),
  )
  const quotaUsedPercent = toNumber(
    pickFirstText(record, ['quota_used_percent', 'quotaUsedPercent']),
  )
  const designationType = pickDesignationTypeInfo(record, official)
  const remarks =
    pickFirstText(official, ['remarks', 'remark']) ||
    pickFirstText(record, ['remarks', 'remark'])

  return {
    vehicleId: listRow.vehicleId,
    officialCid:
      pickFirstText(official, ['cid', 'citizen_id', 'citizenId', 'cid_no']) || '—',
    officialName: listRow.officialName,
    designation: listRow.designation,
    designationTypeId: designationType.id || undefined,
    designationTypeName: designationType.name || undefined,
    remarks: remarks || undefined,
    agency:
      pickFirstText(official, ['agency', 'agency_name', 'agencyName']) ||
      pickFirstText(record, ['agency', 'agency_name', 'agencyName']) ||
      '—',
    registrationNumber: listRow.registrationNumber,
    makeModel: listRow.makeModel,
    status: listRow.status,
    driverName:
      (driver ? pickOfficialName(driver) : '') ||
      pickFirstText(record, ['driver_name', 'driverName']) ||
      (driver ? pickFirstText(driver, ['name', 'full_name']) : '') ||
      undefined,
    odometerKm: odometerKm ?? undefined,
    fuelType: pickFirstText(vehicle ?? record, ['fuel_type', 'fuelType']) || undefined,
    currentQuota: currentQuota ?? undefined,
    thresholdAmount: thresholdAmount ?? undefined,
    monthlyAllocation: monthlyAllocation ?? undefined,
    quotaUsedPercent: quotaUsedPercent ?? undefined,
    lastServiceDate:
      pickFirstText(record, ['last_service_date', 'lastServiceDate', 'last_service']) || undefined,
  }
}

export type DesignatedVehiclesPageResult = {
  rows: DesignatedVehicleListRow[]
  totalCount: number
  totalPages: number
  effectivePageSize: number
}

function designatedOfficialsListPath(search: string, page: number, pageSize: number): string {
  let path = `/vehicles/designated-officials?page=${page}&page_size=${pageSize}`
  const q = search.trim()
  if (q) path += `&search=${encodeURIComponent(q)}`
  return path
}

export async function fetchDesignatedVehiclesPage(
  search: string,
  page: number,
  pageSize: number,
): Promise<DesignatedVehiclesPageResult> {
  const payload = await apiGet<unknown>(designatedOfficialsListPath(search, page, pageSize))
  const records = extractListRecords(payload)
  const rows = records
    .map(mapDesignatedVehicleListRow)
    .filter((row): row is DesignatedVehicleListRow => row !== null)
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

export async function fetchDesignatedVehicleByVehicleId(
  vehicleId: string,
): Promise<DesignatedVehicleDetail | null> {
  const trimmed = vehicleId.trim()
  if (!trimmed) return null
  const payload = await apiGet<unknown>(
    `/vehicles/${encodeURIComponent(trimmed)}/designated-official`,
  )
  const record = unwrapDataRecord(payload)
  if (!record) return null
  return mapDesignatedVehicleDetail(record)
}

export type DesignatedOfficialUpsertBody = {
  cid: string
  full_name: string
  designation: string
  designation_type_id: string
  remarks: string
}

export async function createDesignatedOfficial(
  vehicleId: string,
  body: DesignatedOfficialUpsertBody,
): Promise<unknown> {
  return apiPost<unknown, DesignatedOfficialUpsertBody>(
    `/vehicles/${encodeURIComponent(vehicleId)}/designated-official`,
    body,
  )
}

export async function updateDesignatedOfficial(
  vehicleId: string,
  body: DesignatedOfficialUpsertBody,
): Promise<unknown> {
  return apiPut<unknown, DesignatedOfficialUpsertBody>(
    `/vehicles/${encodeURIComponent(vehicleId)}/designated-official`,
    body,
  )
}

export async function deleteDesignatedOfficial(vehicleId: string): Promise<unknown> {
  return apiDelete<unknown>(
    `/vehicles/${encodeURIComponent(vehicleId)}/designated-official`,
  )
}
