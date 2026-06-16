import { formatUserOrgScopeTypeLabel, type UserOrgScopeListItem, type UserOrgScopeType } from '@/features/user/lib/user-org-scopes-api'
import type { ApiRecord } from '@/features/user/lib/roles-api'
import { pickUserDetailOrganogramIds, toText } from '@/features/user/lib/users-api'
import {
  extractMasterList,
  fetchVehicleAssetNameOptions,
  type MasterOption,
} from '@/features/vehicles/lib/vehicle-create-master-data'
import { resolveAssetNameQueryParam } from '@/features/vehicles/lib/vehicles-api'
import {
  fetchMasterEntityNameById,
  fetchMasterRecordNameById,
  isUuidLike,
} from '@/shared/lib/organogram-master-lookup'
import type { SearchableAutocompleteOption } from '@/shared/components/SearchableAutocomplete'
import { apiDelete, apiGet, apiPost, apiPut } from '@/services/apiClient'
import { applyPagination } from '@/shared/utils/pagination'

export type QuotaOrgScopeOption = {
  scopeType: UserOrgScopeType
  scopeId: string
  label: string
  source: 'profile' | 'org_scope'
}

export type CreateFuelQuotaBody = {
  vehicle_type: string
  fuel_type_id: string
  agency_id: string | null
  department_id: string | null
  division_id: string | null
  sub_division_id: string | null
  ceiling_amount: number
  low_balance_threshold: number
}

export type UpdateFuelQuotaBody = CreateFuelQuotaBody

export type FuelQuotaRuleStatus = 'Active' | 'Inactive'

export type FuelQuotaListRow = {
  id: string
  vehicleCategory: string
  vehicleCategoryValue: string
  organization: string
  fuelTypeId: string
  fuelType: string
  maximumQuota: number
  threshold: number
  effectiveFrom: string
  status: FuelQuotaRuleStatus
  organizationKey: string
  notes?: string
}

export type FuelQuotasPageResult = {
  rows: FuelQuotaListRow[]
  totalCount: number
  totalPages: number
  effectivePageSize: number
  serialBase: number
}

const PAGE_SIZE = 200

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function pickNullableId(value: unknown): string | null {
  const text = toText(value)
  return text || null
}

function nestedRecord(value: unknown): ApiRecord | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as ApiRecord
  }
  return null
}

function mapQuotaStatus(record: ApiRecord): FuelQuotaRuleStatus {
  const status = toText(record.status).toLowerCase()
  if (status === 'inactive' || status === 'disabled') return 'Inactive'
  if (record.is_active === false || record.isActive === false) return 'Inactive'
  return 'Active'
}

function pickFuelTypeId(record: ApiRecord): string {
  const nested = nestedRecord(record.fuel_type ?? record.fuelType)
  if (nested) {
    return toText(nested.id) || toText(nested.fuel_type_id) || toText(nested.fuelTypeId)
  }
  return toText(record.fuel_type_id) || toText(record.fuelTypeId)
}

function pickFuelTypeLabel(record: ApiRecord, fuelTypeId: string, fuelTypes: MasterOption[]): string {
  const nested = nestedRecord(record.fuel_type ?? record.fuelType)
  const fromNested = nested ? toText(nested.name) || toText(nested.code) : ''
  if (fromNested) return fromNested
  const fromFlat = toText(record.fuel_type_name) || toText(record.fuelTypeName)
  if (fromFlat) return fromFlat
  return fuelTypes.find((option) => option.value === fuelTypeId)?.label ?? fuelTypeId
}

function pickEffectiveFrom(record: ApiRecord): string {
  const direct =
    toText(record.effective_from) ||
    toText(record.effectiveFrom) ||
    toText(record.effective_date) ||
    toText(record.effectiveDate)
  if (direct) return direct.slice(0, 10)
  const created = toText(record.created_at) || toText(record.createdAt)
  return created ? created.slice(0, 10) : ''
}

export function fuelQuotaOrgIdsFromRecord(record: ApiRecord): {
  agencyId: string | null
  departmentId: string | null
  divisionId: string | null
  subDivisionId: string | null
} {
  return {
    agencyId: pickNullableId(record.agency_id ?? record.agencyId),
    departmentId: pickNullableId(record.department_id ?? record.departmentId),
    divisionId: pickNullableId(record.division_id ?? record.divisionId),
    subDivisionId: pickNullableId(record.sub_division_id ?? record.subDivisionId ?? record.subdivision_id),
  }
}

type FuelQuotaOrgIds = {
  agencyId: string | null
  departmentId: string | null
  divisionId: string | null
  subDivisionId: string | null
}

function scopeTypeToEntityType(scopeType: UserOrgScopeType): string {
  switch (scopeType) {
    case 'agency':
      return 'agency'
    case 'department':
      return 'department'
    case 'division':
      return 'division'
    case 'sub_division':
      return 'sub-division'
  }
}

function pickQuotaOrgScope(
  orgIds: FuelQuotaOrgIds,
): { scopeType: UserOrgScopeType; scopeId: string } | null {
  if (orgIds.subDivisionId) {
    return { scopeType: 'sub_division', scopeId: orgIds.subDivisionId }
  }
  if (orgIds.divisionId) {
    return { scopeType: 'division', scopeId: orgIds.divisionId }
  }
  if (orgIds.departmentId) {
    return { scopeType: 'department', scopeId: orgIds.departmentId }
  }
  if (orgIds.agencyId) {
    return { scopeType: 'agency', scopeId: orgIds.agencyId }
  }
  return null
}

export async function resolveFuelQuotaOrganizationName(
  orgIds: FuelQuotaOrgIds,
): Promise<string> {
  const scope = pickQuotaOrgScope(orgIds)
  if (!scope) return '—'
  const fromDetail = await fetchMasterEntityNameById(
    scopeTypeToEntityType(scope.scopeType),
    scope.scopeId,
  )
  if (fromDetail?.trim()) return fromDetail.trim()
  return scope.scopeId
}

async function resolveFuelQuotaFuelTypeName(
  fuelTypeId: string,
  fallbackLabel: string,
): Promise<string> {
  const id = fuelTypeId.trim()
  if (!id) return fallbackLabel.trim() || '—'

  const label = fallbackLabel.trim()
  if (label && !isUuidLike(label)) return label

  const fromDetail = await fetchMasterRecordNameById('/master/fuel-types', id)
  if (fromDetail?.trim()) return fromDetail.trim()
  return label || id
}

async function enrichFuelQuotaRowsWithDetailNames(
  rows: FuelQuotaListRow[],
  records: ApiRecord[],
): Promise<FuelQuotaListRow[]> {
  const orgNameByKey = new Map<string, string>()
  const fuelTypeNameById = new Map<string, string>()

  const resolveOrgName = async (orgIds: FuelQuotaOrgIds): Promise<string> => {
    const key = organizationKeyFromOrgIds(orgIds)
    if (!key) return '—'
    const cached = orgNameByKey.get(key)
    if (cached) return cached
    const name = await resolveFuelQuotaOrganizationName(orgIds)
    orgNameByKey.set(key, name)
    return name
  }

  const resolveFuelType = async (fuelTypeId: string, fallbackLabel: string): Promise<string> => {
    const id = fuelTypeId.trim()
    if (!id) return fallbackLabel.trim() || '—'
    const cached = fuelTypeNameById.get(id)
    if (cached) return cached
    const name = await resolveFuelQuotaFuelTypeName(id, fallbackLabel)
    fuelTypeNameById.set(id, name)
    return name
  }

  return Promise.all(
    rows.map(async (row, index) => {
      const record = records[index]
      const orgIds = fuelQuotaOrgIdsFromRecord(record)
      const [organization, fuelType] = await Promise.all([
        resolveOrgName(orgIds),
        resolveFuelType(row.fuelTypeId, row.fuelType),
      ])
      return { ...row, organization, fuelType }
    }),
  )
}

export function organizationKeyFromOrgIds(orgIds: FuelQuotaOrgIds): string {
  if (orgIds.subDivisionId) {
    return orgScopeOptionKey({ scopeType: 'sub_division', scopeId: orgIds.subDivisionId })
  }
  if (orgIds.divisionId) {
    return orgScopeOptionKey({ scopeType: 'division', scopeId: orgIds.divisionId })
  }
  if (orgIds.departmentId) {
    return orgScopeOptionKey({ scopeType: 'department', scopeId: orgIds.departmentId })
  }
  if (orgIds.agencyId) {
    return orgScopeOptionKey({ scopeType: 'agency', scopeId: orgIds.agencyId })
  }
  return ''
}

export function resolveVehicleCategoryFormValue(
  vehicleType: string,
  assetNames: MasterOption[],
): string {
  const trimmed = vehicleType.trim()
  if (!trimmed) return ''
  const byValue = assetNames.find((option) => option.value === trimmed)
  if (byValue) return byValue.value
  const byLabel = assetNames.find(
    (option) => option.label.localeCompare(trimmed, undefined, { sensitivity: 'accent' }) === 0,
  )
  if (byLabel) return byLabel.value
  return trimmed
}

export function resolveVehicleCategoryLabel(
  vehicleType: string,
  assetNames: MasterOption[],
): string {
  const trimmed = vehicleType.trim()
  if (!trimmed) return '—'
  const formValue = resolveVehicleCategoryFormValue(trimmed, assetNames)
  return assetNames.find((option) => option.value === formValue)?.label ?? trimmed
}

export function mapFuelQuotaRecord(
  record: ApiRecord,
  lookups?: { fuelTypes?: MasterOption[]; assetNames?: MasterOption[] },
): FuelQuotaListRow | null {
  const id = toText(record.id) || toText(record.uuid)
  if (!id) return null

  const fuelTypes = lookups?.fuelTypes ?? []
  const assetNames = lookups?.assetNames ?? []
  const vehicleType = toText(record.vehicle_type) || toText(record.vehicleType)
  const fuelTypeId = pickFuelTypeId(record)
  const orgIds = fuelQuotaOrgIdsFromRecord(record)

  return {
    id,
    vehicleCategory: resolveVehicleCategoryLabel(vehicleType, assetNames),
    vehicleCategoryValue: resolveVehicleCategoryFormValue(vehicleType, assetNames),
    organization: '—',
    fuelTypeId,
    fuelType: pickFuelTypeLabel(record, fuelTypeId, fuelTypes),
    maximumQuota: toNumber(record.ceiling_amount ?? record.ceilingAmount),
    threshold: toNumber(record.low_balance_threshold ?? record.lowBalanceThreshold),
    effectiveFrom: pickEffectiveFrom(record),
    status: mapQuotaStatus(record),
    organizationKey: organizationKeyFromOrgIds(orgIds),
    notes: toText(record.notes) || undefined,
  }
}

export function formatQuotaEffectiveDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return isoDate || '—'
  const day = String(parsed.getDate()).padStart(2, '0')
  const month = parsed
    .toLocaleString('en-GB', { month: 'short' })
    .replace('.', '')
    .toUpperCase()
  const year = parsed.getFullYear()
  return `${day} ${month} ${year}`
}

export function fuelQuotasListPath(search: string, page: number, pageSize: number) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('page_size', String(pageSize))
  const q = search.trim()
  if (q) params.set('search', q)
  return `/fuel/quotas?${params.toString()}`
}

export async function fetchFuelQuotasPage(
  search: string,
  page: number,
  pageSize: number,
  lookups?: { fuelTypes?: MasterOption[]; assetNames?: MasterOption[] },
): Promise<FuelQuotasPageResult> {
  const payload = await apiGet<unknown>(fuelQuotasListPath(search, page, pageSize))
  const records = extractMasterList(payload)
  const mapped = records
    .map((record) => ({ record, row: mapFuelQuotaRecord(record, lookups) }))
    .filter((entry): entry is { record: ApiRecord; row: FuelQuotaListRow } => entry.row !== null)
  const enrichedRows = await enrichFuelQuotaRowsWithDetailNames(
    mapped.map((entry) => entry.row),
    mapped.map((entry) => entry.record),
  )
  const paged = applyPagination(payload, enrichedRows, page, pageSize, {
    page,
    pageSize,
    pageLength: enrichedRows.length,
  })
  return {
    rows: paged.rows,
    totalCount: paged.totalCount,
    totalPages: paged.totalPages,
    effectivePageSize: paged.effectivePageSize,
    serialBase: paged.serialBase,
  }
}

function recordsToIdNameOptions(records: ApiRecord[]): MasterOption[] {
  return records
    .map((record) => {
      const id = record.id != null && String(record.id).trim() !== '' ? String(record.id) : ''
      const name = typeof record.name === 'string' ? record.name.trim() : ''
      if (!id) return null
      return { value: id, label: name || id }
    })
    .filter((option): option is MasterOption => option !== null)
}

async function resolveOrgScopeDisplayName(scope: UserOrgScopeListItem): Promise<string> {
  if (scope.name?.trim()) return scope.name.trim()
  const fromDetail = await fetchMasterEntityNameById(
    scopeTypeToEntityType(scope.scopeType),
    scope.scopeId,
  )
  return fromDetail?.trim() || scope.scopeId
}

export function orgScopeOptionKey(
  scope: Pick<QuotaOrgScopeOption, 'scopeType' | 'scopeId'>,
): string {
  return `${scope.scopeType}:${scope.scopeId}`
}

export function parseOrgScopeOptionKey(
  key: string,
): { scopeType: UserOrgScopeType; scopeId: string } | null {
  const trimmed = key.trim()
  if (!trimmed) return null
  const separator = trimmed.indexOf(':')
  if (separator <= 0) return null
  const scopeType = trimmed.slice(0, separator) as UserOrgScopeType
  const scopeId = trimmed.slice(separator + 1).trim()
  if (
    !scopeId ||
    (scopeType !== 'agency' &&
      scopeType !== 'department' &&
      scopeType !== 'division' &&
      scopeType !== 'sub_division')
  ) {
    return null
  }
  return { scopeType, scopeId }
}

/** Maps a selected scope to the POST body org id fields (only one set, others null). */
export function buildFuelQuotaOrgIds(
  scopeType: UserOrgScopeType,
  scopeId: string,
): Pick<
  CreateFuelQuotaBody,
  'agency_id' | 'department_id' | 'division_id' | 'sub_division_id'
> {
  const id = scopeId.trim()
  return {
    agency_id: scopeType === 'agency' ? id : null,
    department_id: scopeType === 'department' ? id : null,
    division_id: scopeType === 'division' ? id : null,
    sub_division_id: scopeType === 'sub_division' ? id : null,
  }
}

export function resolveCurrentUserId(user: ApiRecord | null): string {
  if (!user) return ''
  return toText(user.id) || toText(user.user_id) || toText(user.uuid)
}

type OrganogramLabels = {
  agency: string
  department: string
  division: string
  subDivision: string
}

function resolveOrgScopeName(candidate: string, scopeId: string): string {
  const trimmed = candidate.trim()
  if (trimmed && trimmed !== '—' && !isUuidLike(trimmed)) return trimmed
  return scopeId.trim()
}

export function quotaOrgScopeOptionDescription(option: QuotaOrgScopeOption): string {
  const typeLabel = formatUserOrgScopeTypeLabel(option.scopeType)
  return option.source === 'profile' ? `${typeLabel} · Current profile` : typeLabel
}

export function quotaOrgScopeToAutocompleteOption(
  option: QuotaOrgScopeOption,
): SearchableAutocompleteOption {
  const value = orgScopeOptionKey(option)
  return {
    value,
    label: option.label,
    description: quotaOrgScopeOptionDescription(option),
    searchText: [
      option.label,
      formatUserOrgScopeTypeLabel(option.scopeType),
      option.scopeId,
      value,
    ].join(' '),
  }
}

export function mergeQuotaOrgScopeAutocompleteOptions(
  ...groups: QuotaOrgScopeOption[][]
): SearchableAutocompleteOption[] {
  const merged = new Map<string, SearchableAutocompleteOption>()
  for (const group of groups) {
    for (const option of group) {
      merged.set(orgScopeOptionKey(option), quotaOrgScopeToAutocompleteOption(option))
    }
  }
  return Array.from(merged.values())
}

/** Agency through subdivision tiers on the signed-in user profile. */
export function profileToOrgScopeOptions(
  record: ApiRecord,
  labels: OrganogramLabels,
): QuotaOrgScopeOption[] {
  const ids = pickUserDetailOrganogramIds(record)
  const tiers: Array<{
    scopeType: UserOrgScopeType
    scopeId: string
    displayName: string
  }> = [
    { scopeType: 'agency', scopeId: ids.agencyId, displayName: labels.agency },
    {
      scopeType: 'department',
      scopeId: ids.departmentId,
      displayName: labels.department,
    },
    { scopeType: 'division', scopeId: ids.divisionId, displayName: labels.division },
    {
      scopeType: 'sub_division',
      scopeId: ids.subDivisionId,
      displayName: labels.subDivision,
    },
  ]

  return tiers
    .filter((tier) => tier.scopeId.trim() !== '')
    .map((tier) => ({
      scopeType: tier.scopeType,
      scopeId: tier.scopeId,
      label: resolveOrgScopeName(tier.displayName, tier.scopeId),
      source: 'profile' as const,
    }))
}

/** Most specific organogram tier on the signed-in user profile. */
export function profileToOrgScopeOption(
  record: ApiRecord,
  labels: OrganogramLabels,
): QuotaOrgScopeOption | null {
  const options = profileToOrgScopeOptions(record, labels)
  return options.length > 0 ? options[options.length - 1] : null
}

/** Builds org scope select options; resolves API scope names via per-id detail fetch. */
export async function resolveQuotaOrgScopeOptions(
  profileScopes: QuotaOrgScopeOption[],
  apiScopes: UserOrgScopeListItem[],
): Promise<QuotaOrgScopeOption[]> {
  const options: QuotaOrgScopeOption[] = []
  const seen = new Set<string>()

  const push = (option: QuotaOrgScopeOption) => {
    const key = orgScopeOptionKey(option)
    if (seen.has(key)) return
    seen.add(key)
    options.push(option)
  }

  for (const profileScope of profileScopes) push(profileScope)

  const resolvedScopes = await Promise.all(
    apiScopes.map(async (scope) => {
      const name = await resolveOrgScopeDisplayName(scope)
      return {
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        label: name,
        source: 'org_scope' as const,
      }
    }),
  )

  for (const option of resolvedScopes) push(option)
  return options
}

export async function fetchFuelTypeOptions(): Promise<MasterOption[]> {
  const payload = await apiGet<unknown>(
    `/master/fuel-types?active=true&page=1&page_size=${PAGE_SIZE}&code=&search=`,
  )
  return recordsToIdNameOptions(extractMasterList(payload))
}

export async function fetchQuotaAssetNameOptions(): Promise<MasterOption[]> {
  return fetchVehicleAssetNameOptions()
}

export function resolveQuotaVehicleType(
  assetNameSelection: string,
  assetNames: MasterOption[],
): string {
  return resolveAssetNameQueryParam(assetNameSelection, assetNames)
}

export async function createFuelQuota(body: CreateFuelQuotaBody): Promise<unknown> {
  return apiPost<unknown, CreateFuelQuotaBody>('/fuel/quotas', body)
}

export async function updateFuelQuota(id: string, body: UpdateFuelQuotaBody): Promise<unknown> {
  const trimmed = id.trim()
  if (!trimmed) throw new Error('Missing quota configuration id')
  return apiPut<unknown, UpdateFuelQuotaBody>(
    `/fuel/quotas/${encodeURIComponent(trimmed)}`,
    body,
  )
}

export async function deleteFuelQuota(id: string): Promise<unknown> {
  const trimmed = id.trim()
  if (!trimmed) throw new Error('Missing quota configuration id')
  return apiDelete<unknown>(`/fuel/quotas/${encodeURIComponent(trimmed)}`)
}
