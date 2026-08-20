// GET `/vehicles` and `/vehicles/{id}` — normalizes common list/detail envelope shapes.
import {
  extractMasterList,
  type MasterOption,
  type VehicleCreateMasterLists,
} from '@/features/vehicles/lib/vehicle-create-master-data'
import { pickVehicleAssignmentNames } from '@/features/vehicles/lib/vehicle-organogram-display'
import { apiClient, apiGet, apiPost, apiPut } from '@/services/apiClient'
import { isUuidLike } from '@/shared/lib/organogram-master-lookup'
import { applyPagination } from '@/shared/utils/pagination'

type ApiRecord = Record<string, unknown>

function pickBoolean(record: ApiRecord, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'boolean') return value
  }
  return undefined
}

function pickScalar(record: ApiRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return ''
}

export type VehicleListRow = {
  id: string
  registration_number: string
  makeModel: string
  status: string
  movement: string
  odometer: string
  color: string
  quota_initialized: boolean
}

export type VehicleReportRow = {
  id: string
  vehicleNumber: string
  makeModel: string
  year: string
  fuelType: string
  currentAgency: string
  vehicleCategory: string
  status: string
  movementStatus: string
}

function pickNestedRelationName(record: ApiRecord, objectKeys: string[]): string {
  for (const key of objectKeys) {
    const value = record[key]
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const name = pickScalar(value as ApiRecord, ['name', 'label', 'title'])
      if (name && !isUuidLike(name)) return name
    }
  }
  return ''
}

function pickVehicleListId(record: ApiRecord): string {
  return pickScalar(record, [
    'id',
    'uuid',
    'vehicleId',
    'vehicle_uuid',
    'vehicleUuid',
    'vehicle_id',
  ])
}

function pickVehicleRegistrationNumber(record: ApiRecord): string {
  return pickScalar(record, [
    'registration_number',
    'registrationNumber',
    'vehicle_number',
    'vehicleNumber',
    'plate_number',
    'plateNumber',
    'vehicle_name',
    'vehicleName',
  ])
}

function flattenVehicleRecord(record: ApiRecord): ApiRecord {
  const vehicleBlock =
    record.vehicle && typeof record.vehicle === 'object' && !Array.isArray(record.vehicle)
      ? (record.vehicle as ApiRecord)
      : null
  return vehicleBlock ? { ...record, ...vehicleBlock } : record
}

export function extractVehicleList(payload: unknown): ApiRecord[] {
  const fromMaster = extractMasterList(payload)
  if (fromMaster.length > 0) return fromMaster

  if (!payload || typeof payload !== 'object') return []
  const root = payload as ApiRecord
  const data = root.data
  const dataObj =
    data && typeof data === 'object' && !Array.isArray(data) ? (data as ApiRecord) : null

  const candidates: unknown[] = [
    root.vehicles,
    dataObj?.vehicles,
    root.vehicle_list,
    dataObj?.vehicle_list,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is ApiRecord => !!item && typeof item === 'object')
    }
  }

  return []
}

function pickVehicleVin(record: ApiRecord): string {
  return pickScalar(record, ['vin', 'VIN'])
}

function resolveVehicleRowIdentity(record: ApiRecord): { id: string; registration_number: string } {
  const flat = flattenVehicleRecord(record)
  const registration_number = pickVehicleRegistrationNumber(flat)
  const vin = pickVehicleVin(flat)
  const primaryId = pickVehicleListId(flat)
  return {
    id: primaryId,
    registration_number: registration_number || vin || '—',
  }
}

export function mapVehicleRecordToListRow(record: ApiRecord): VehicleListRow {
  const flat = flattenVehicleRecord(record)
  const { id, registration_number } = resolveVehicleRowIdentity(record)
  const make = pickScalar(flat, ['make', 'vehicle_make'])
  const model = pickScalar(flat, ['model', 'vehicle_model'])
  const year = pickScalar(flat, ['manufacturing_year', 'year', 'manufacturingYear', 'model_year'])
  let makeModel = pickScalar(flat, ['make_model', 'makeModel', 'vehicle_name', 'name', 'title'])
  if (!makeModel && (make || model)) {
    makeModel = [make, model].filter(Boolean).join(' ')
    if (year) makeModel = `${makeModel} (${year})`
  }
  const status =
    pickNestedRelationName(flat, ['vehicle_status', 'vehicleStatus']) ||
    pickScalar(flat, [
      'vehicle_status_name',
      'status_name',
      'status',
      'vehicle_status',
      'vehicleStatus',
    ])
  const movement =
    pickNestedRelationName(flat, ['movement_status', 'movementStatus']) ||
    pickScalar(flat, [
      'vehicle_movement_status_name',
      'movement_status_name',
      'movement_status',
      'vehicle_movement_status',
      'vehicleMovementStatus',
    ])
  const odoRaw = pickScalar(flat, [
    "odometer_reading",
    "current_odometer_km",
    "odometer",
    "odo_meter",
  ]);
  const odometer = odoRaw ? (/\bkm\b/i.test(odoRaw) ? odoRaw : `${odoRaw} km`) : ''
  const color = pickScalar(flat, ['color', 'vehicle_color'])
  const quotaInitialized = pickBoolean(flat, [
    'quota_initialized',
    'quotaInitialized',
  ])
  return {
    id,
    color: color || '—',
    registration_number,
    makeModel: makeModel || '—',
    status: status || '—',
    movement: movement || '—',
    odometer: odometer || '—',
    quota_initialized: quotaInitialized ?? true,
  }
}

/** Report row mapper — same source fields as list view, with extra columns for reports. */
export function mapVehicleRecordToReportRow(record: ApiRecord): VehicleReportRow {
  const flat = flattenVehicleRecord(record)
  const listRow = mapVehicleRecordToListRow(record)

  const make = pickScalar(flat, ['make', 'vehicle_make'])
  const model = pickScalar(flat, ['model', 'vehicle_model'])
  const year = pickScalar(flat, ['manufacturing_year', 'year', 'manufacturingYear', 'model_year'])

  let makeModel = pickScalar(flat, ['make_model', 'makeModel', 'vehicle_name', 'name', 'title'])
  if (!makeModel && (make || model)) {
    makeModel = [make, model].filter(Boolean).join(' ')
  }

  const fuelType =
    pickNestedRelationName(flat, ['fuel_type', 'fuelType']) ||
    pickScalar(flat, ['fuel_type_name', 'fuelTypeName', 'fuel_type', 'fuelType'])

  const vehicleCategory =
    pickNestedRelationName(flat, ['vehicle_category', 'vehicleCategory']) ||
    pickScalar(flat, [
      'vehicle_category_name',
      'vehicleCategoryName',
      'vehicle_category',
      'vehicleCategory',
      'category_name',
      'categoryName',
    ])

  const assignmentNames = pickVehicleAssignmentNames(record)

  const currentAgency =
    assignmentNames.current ||
    pickNestedRelationName(flat, ['current_agency', 'currentAgency']) ||
    pickScalar(flat, [
      'current_agency_name',
      'currentAgencyName',
      'current_agency',
      'currentAgency',
      'agency_name',
      'agencyName',
    ])

  return {
    id: listRow.id,
    vehicleNumber: listRow.registration_number,
    makeModel: makeModel || listRow.makeModel.replace(/\s*\(\d{4}\)$/, '') || '—',
    year: year || '—',
    fuelType: fuelType || '—',
    currentAgency: currentAgency || '—',
    vehicleCategory: vehicleCategory || '—',
    status: listRow.status,
    movementStatus: listRow.movement,
  }
}

export type VehiclesListPageResult = {
  rows: VehicleListRow[]
  totalCount: number
  totalPages: number
  effectivePageSize: number
}

function vehiclesListPath(search: string, page: number, pageSize: number) {
  let path = `/vehicles?page=${page}&page_size=${pageSize}`
  const q = search.trim()
  if (q) path += `&search=${encodeURIComponent(q)}`
  return path
}

export async function fetchVehiclesPage(
  search: string,
  page: number,
  pageSize: number,
): Promise<VehiclesListPageResult> {
  const payload = await apiGet<unknown>(vehiclesListPath(search, page, pageSize))
  const records = extractVehicleList(payload)
  const rows = records
    .map((record) => mapVehicleRecordToListRow(record))
    .filter((row) => Boolean(row.id.trim()) && isUuidLike(row.id))
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

export async function fetchVehicles(): Promise<VehicleListRow[]> {
  const pageSize = 100
  const firstPage = await fetchVehiclesPage('', 1, pageSize)
  const rows = [...firstPage.rows]
  if (firstPage.totalPages > 1) {
    for (let page = 2; page <= firstPage.totalPages; page += 1) {
      const nextPage = await fetchVehiclesPage('', page, pageSize)
      rows.push(...nextPage.rows)
    }
  }
  return rows
}

function unwrapVehicleDetail(payload: unknown): ApiRecord | null {
  if (!payload || typeof payload !== 'object') return null
  const root = payload as ApiRecord
  const data = root.data
  if (data && typeof data === 'object' && !Array.isArray(data)) return data as ApiRecord
  return root
}

export async function fetchVehicleById(vehicleId: string): Promise<ApiRecord> {
  const trimmed = vehicleId.trim()
  if (!trimmed) throw new Error('Missing vehicle id')
  const payload = await apiGet<unknown>(`/vehicles/${encodeURIComponent(trimmed)}`)
  const record = unwrapVehicleDetail(payload)
  if (!record) throw new Error('Invalid vehicle response')
  // Keep full payload for nested original/current agency fields on detail page.
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return { ...(payload as ApiRecord), ...record }
  }
  return record
}

/** Body shape for POST `/vehicles` and PUT `/vehicles/{vehicle_id}`. */
export type VehicleUpsertBody = {
  registration_number: string
  vin: string
  chassis_number: string
  engine_number: string
  make: string
  model: string
  year: number
  color: string
  vehicle_category_id: string
  vehicle_type_id: string
  fuel_type_id: string
  engine_capacity_cc: number
  seating_capacity: number
  registration_date: string
  registration_expiry: string
  insurance_provider_id: string
  insurance_expiry: string
  gps_device_imei: string
  cost: number
  identification_code: string
  status_id: string
  movement_status_id: string
  asset_name_id: string
  fuel_quota_balance?: number
}

const FORM_KEYS = [
  "registration_number",
  "vin",
  "chassis_number",
  "engine_number",
  "make",
  "model",
  "year",
  "color",
  "vehicle_category_id",
  "vehicle_type_id",
  "fuel_type_id",
  "engine_capacity_cc",
  "seating_capacity",
  "registration_date",
  "registration_expiry",
  "insurance_provider_id",
  "insurance_expiry",
  "gps_device_imei",
  "cost",
  "identification_code",
  "status_id",
  "movement_status_id",
  "asset_name_id",
  "fuel_quota_balance",
] as const;

export type VehicleFormStringState = Record<(typeof FORM_KEYS)[number], string>

export function emptyVehicleFormState(): VehicleFormStringState {
  return FORM_KEYS.reduce(
    (acc, key) => {
      acc[key] = ''
      return acc
    },
    {} as VehicleFormStringState,
  )
}

function pickStringFromRecord(record: ApiRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function pickNumberAsString(record: ApiRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function resolveMasterOptionValue(options: MasterOption[], ...candidates: string[]): string {
  for (const raw of candidates) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    const byValue = options.find((o) => o.value.toLowerCase() === trimmed.toLowerCase())
    if (byValue) return byValue.value
    const byLabel = options.find((o) => o.label.toLowerCase() === trimmed.toLowerCase())
    if (byLabel) return byLabel.value
  }
  return candidates.map((c) => c.trim()).find(Boolean) ?? ''
}

/** Display name for GET `/vehicles/vehicle-info?asset_name=` (master stores name as value when no id). */
export function resolveAssetNameQueryParam(
  assetNameId: string,
  options: MasterOption[],
): string {
  const trimmed = assetNameId.trim()
  if (!trimmed) return ''
  const match = options.find((o) => o.value.toLowerCase() === trimmed.toLowerCase())
  return (match?.label || trimmed).trim()
}

/** GET `/vehicles/vehicle-info` — lookup vehicle in GIMS before create. */
export async function fetchVehicleInfoFromGims(params: {
  asset_name: string
  vehicle_number: string
}): Promise<unknown> {
  const asset_name = params.asset_name.trim()
  const vehicle_number = params.vehicle_number.trim()
  if (!asset_name) throw new Error('Select an asset name before searching GIMS.')
  if (!vehicle_number) throw new Error('Enter a registration number before searching GIMS.')

  const qs = new URLSearchParams({ asset_name, vehicle_number })
  return apiGet<unknown>(`/vehicles/vehicle-info?${qs.toString()}`)
}

/** Map GIMS vehicle-info payload into vehicle create form fields (resolves master ids by name). */
export function mapGimsVehicleInfoToFormState(
  payload: unknown,
  masters: VehicleCreateMasterLists,
): VehicleFormStringState {
  const record = unwrapVehicleDetail(payload)
  if (!record) throw new Error('Invalid vehicle info response')

  const base = vehicleRecordToFormState(record)

  return {
    ...base,
    vehicle_category_id: resolveMasterOptionValue(
      masters.vehicleCategories,
      base.vehicle_category_id,
      pickStringFromRecord(record, [
        'vehicle_category_name',
        'vehicle_category',
        'category_name',
        'category',
      ]),
    ),
    fuel_type_id: resolveMasterOptionValue(
      masters.fuelTypes,
      base.fuel_type_id,
      pickStringFromRecord(record, ['fuel_type_name', 'fuel_type', 'fuelType']),
    ),
    status_id: resolveMasterOptionValue(
      masters.vehicleStatuses,
      base.status_id,
      pickStringFromRecord(record, [
        'vehicle_status_name',
        'status_name',
        'status',
        'vehicle_status',
      ]),
    ),
    movement_status_id: resolveMasterOptionValue(
      masters.vehicleMovementStatuses,
      base.movement_status_id,
      pickStringFromRecord(record, [
        'vehicle_movement_status_name',
        'movement_status_name',
        'movement_status',
        'vehicle_movement_status',
      ]),
    ),
    insurance_provider_id: resolveMasterOptionValue(
      masters.insuranceProviders,
      base.insurance_provider_id,
      pickStringFromRecord(record, [
        'insurance_provider_name',
        'insurance_provider',
        'insuranceProvider',
      ]),
    ),
    asset_name_id: resolveMasterOptionValue(
      masters.vehicleAssetNames,
      base.asset_name_id,
      pickStringFromRecord(record, ['asset_name', 'assetName', 'asset_name_id']),
    ),
  }
}

/** Normalize GET `/vehicles/{id}` into flat string fields for controlled inputs. */
export function vehicleRecordToFormState(record: ApiRecord): VehicleFormStringState {
  const categoryId = pickStringFromRecord(record, [
    'vehicle_category_id',
    'vehicleCategoryId',
  ])
  const vehicleTypeId = pickStringFromRecord(record, [
    'vehicle_type_id',
    'vehicleTypeId',
  ])
  const fuelId = pickStringFromRecord(record, ['fuel_type_id', 'fuelTypeId'])

  return {
    registration_number: pickStringFromRecord(record, [
      "registration_number",
      "registrationNumber",
      "vehicle_number",
    ]),
    vin: pickStringFromRecord(record, ["vin", "VIN"]),
    chassis_number: pickStringFromRecord(record, [
      "chassis_number",
      "chassisNo",
      "chassisNumber",
    ]),
    engine_number: pickStringFromRecord(record, [
      "engine_number",
      "engineNumber",
      "engineNo",
    ]),
    make: pickStringFromRecord(record, [
      "manufacturerName",
      "make",
      "vehicle_make",
    ]),
    model: pickStringFromRecord(record, [
      "model",
      "vehicle_model",
      "assetName",
    ]),
    year: pickNumberAsString(record, [
      "year",
      "manufacturing_year",
      "manufacturingYear",
      "model_year",
      "vehicleModel",
    ]),
    color: pickStringFromRecord(record, ["color", "vehicle_color"]),
    vehicle_category_id: categoryId,
    vehicle_type_id: vehicleTypeId,
    fuel_type_id: fuelId,
    status_id: pickStringFromRecord(record, ["status_id", "statusId"]),
    movement_status_id: pickStringFromRecord(record, [
      "movement_status_id",
      "movementStatusId",
    ]),
    asset_name_id: pickStringFromRecord(record, [
      "asset_name_id",
      "assetNameId",
    ]),
    engine_capacity_cc: pickNumberAsString(record, [
      "engine_capacity_cc",
      "engineCapacityCc",
      "engine_capacity",
      "engineCapacity",
    ]),
    seating_capacity: pickNumberAsString(record, [
      "seating_capacity",
      "seatingCapacity",
    ]),
    registration_date: pickStringFromRecord(record, [
      "registration_date",
      "registrationDate",
    ]).slice(0, 10),
    registration_expiry: pickStringFromRecord(record, [
      "registration_expiry",
      "registrationExpiry",
    ]).slice(0, 10),
    insurance_provider_id: pickStringFromRecord(record, [
      "insurance_provider_id",
      "insurancePolicyNumber",
    ]),
    insurance_expiry: pickStringFromRecord(record, [
      "insurance_expiry",
      "insuranceExpiry",
    ]).slice(0, 10),
    gps_device_imei: pickStringFromRecord(record, [
      "gps_device_imei",
      "gpsDeviceImei",
      "gps_device_id",
      "gpsDeviceId",
    ]),
    cost: pickNumberAsString(record, ["cost", "vehicle_cost"]),
    identification_code: pickStringFromRecord(record, [
      "identification_code",
      "identificationCode",
    ]),
    fuel_quota_balance: pickNumberAsString(record, [
      "fuel_quota_balance",
      "fuelQuotaBalance",
    ]),
  };
}

function parseIntField(raw: string, fallback = 0): number {
  const n = Number.parseInt(raw.trim(), 10)
  return Number.isFinite(n) ? n : fallback
}

function parseFloatField(raw: string, fallback = 0): number {
  const n = Number.parseFloat(raw.trim())
  return Number.isFinite(n) ? n : fallback
}

export function vehicleFormStateToPayload(
  form: VehicleFormStringState,
  options?: { isEdit?: boolean },
): VehicleUpsertBody {
  const body: VehicleUpsertBody = {
    registration_number: form.registration_number.trim(),
    vin: form.registration_number.trim(),
    chassis_number: form.chassis_number.trim(),
    engine_number: form.engine_number.trim(),
    make: form.make.trim(),
    model: form.model.trim(),
    year: parseIntField(form.year, 0),
    color: form.color.trim(),
    vehicle_category_id: form.vehicle_category_id.trim(),
    vehicle_type_id: form.vehicle_type_id.trim(),
    fuel_type_id: form.fuel_type_id.trim(),
    engine_capacity_cc: parseIntField(form.engine_capacity_cc, 0),
    seating_capacity: parseIntField(form.seating_capacity, 0),
    registration_date: form.registration_date.trim(),
    registration_expiry: form.registration_expiry.trim(),
    insurance_provider_id: form.insurance_provider_id.trim(),
    insurance_expiry: form.insurance_expiry.trim(),
    gps_device_imei: form.gps_device_imei.trim(),
    cost: parseFloatField(form.cost, 0),
    identification_code: form.identification_code.trim(),
    status_id: form.status_id.trim(),
    movement_status_id: form.movement_status_id.trim(),
    asset_name_id: form.asset_name_id.trim(),
  }
  if (!options?.isEdit) {
    const fuelQuotaBalance = form.fuel_quota_balance.trim()
    if (fuelQuotaBalance) {
      body.fuel_quota_balance = parseFloatField(fuelQuotaBalance, 0)
    }
  }
  return body
}

export async function createVehicle(body: VehicleUpsertBody): Promise<unknown> {
  return apiPost<unknown, VehicleUpsertBody>('/vehicles', body)
}

/** POST `/vehicles/sync` — pull/sync vehicles (super-admin). */
export async function syncVehicles(): Promise<unknown> {
  return apiClient<unknown>('/vehicles/sync', { method: 'POST' })
}

export async function updateVehicle(vehicleId: string, body: VehicleUpsertBody): Promise<unknown> {
  const trimmed = vehicleId.trim()
  if (!trimmed) throw new Error('Missing vehicle id')
  return apiPut<unknown, VehicleUpsertBody>(`/vehicles/${encodeURIComponent(trimmed)}`, body)
}

export type VehicleQuotaInitialBody = {
  fuel_quota_balance: number
}

/** POST `/vehicles/{vehicle_id}/quota-initial` — sets initial fuel quota when `quota_initialized` is false. */
export async function assignVehicleQuotaInitial(
  vehicleId: string,
  fuelQuotaBalance: number,
): Promise<unknown> {
  const trimmed = vehicleId.trim()
  if (!trimmed) throw new Error('Missing vehicle id')
  if (!Number.isFinite(fuelQuotaBalance) || fuelQuotaBalance <= 0) {
    throw new Error('Enter a valid fuel quota amount')
  }
  return apiPost<unknown, VehicleQuotaInitialBody>(
    `/vehicles/${encodeURIComponent(trimmed)}/quota-initial`,
    { fuel_quota_balance: fuelQuotaBalance },
  )
}
