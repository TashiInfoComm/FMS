/**
 * Helpers and types for admin user flows: list/detail (`/admin/users`),
 * directory lookup (`/public/employees/{id}|{cid}`, `/admin/citizens/{cid}`),
 * role options, and create-payload builders. Normalizes heterogeneous API shapes.
 */
import { apiGet, apiPost } from '@/services/apiClient'
import { mapRoleListRecord, rolesToArray, type ApiRecord } from '@/features/user/lib/roles-api'
import {
  fetchMasterEntityNameById,
  isUuidLike,
  resolveAdminGroupIdToName,
  type OrganogramDisplayLookups,
} from '@/shared/lib/organogram-master-lookup'
import { formatRealmRoleDisplayName } from '@/shared/lib/format-realm-role-display'

type DirectoryOrganogramHints = {
  level1Id?: string
  level2Id?: string
  level3Id?: string
  level4Id?: string
  level1Name?: string
  level2Name?: string
  level3Name?: string
  level4Name?: string
  subGroupId?: string
  subGroupName?: string
  directoryAgencyId?: string
  directoryAgencyName?: string
}

/** Turns API scalars into a display/field string; avoids `undefined`/object leaking into form fields. */
export function toText(value: unknown) {
  return typeof value === 'string' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

/**
 * Extracts the inner `data` object when present (`{ data: { ... } }`); otherwise returns the root if it is an object.
 * Used so GET responses work whether the backend wraps the entity or not.
 */
export function unwrapDataRecord(payload: unknown): ApiRecord | null {
  if (!payload || typeof payload !== 'object') return null
  const root = payload as ApiRecord
  const data = root.data
  if (data && typeof data === 'object' && !Array.isArray(data)) return data as ApiRecord
  return root
}

/** Resolved organogram UUIDs from the create form or from `GET /admin/users/:id` when present. */
export type CreateUserOrgIds = {
  agency_id?: string
  department_id?: string
  division_id?: string
  sub_division_id?: string
}

export type FetchedPerson = {
  /** Raw id used for lookup (employee id or cid). */
  lookupId: string
  employeeId: string
  cid: string
  name: string
  agency: string
  department: string
  division: string
  /** Sub division / sub-office from directory when present. */
  subDivision: string
  designation: string
  /** True when designation was returned by directory/NDI mapping — keep read-only in registration form; unrelated to user typing. */
  designationFromDirectory: boolean
  contact: string
  email: string
  /** Directory/API given name when returned separately (preferred over splitting `name` in the create payload). */
  firstName?: string
  /** Directory/API middle name when returned separately (shown in form; combined into `last_name` on submit). */
  middleName?: string
  /** Directory/API family name when returned separately. */
  lastName?: string
  /** UUIDs from a saved user row, for `PUT /admin/users/:id` when the edit form has no tier pickers. */
  persistedOrgIds?: CreateUserOrgIds
  /**
   * When the employee directory returns organogram / EMS fields (`OrganogramLevel1`…`Level4_ID`, `SubGroup`, etc.),
   * they are captured here so the UI can match against `GET /public/groups`.
   */
  organogramHints?: DirectoryOrganogramHints
  /**
   * Citizen (`/admin/citizens/{cid}`) responses typically supply only a display name—other directory fields are entered manually.
   * Employee lookup fills all mapped fields and stays read-only in the form until the next fetch.
   */
  //password?:'password',
  directoryLookup?: 'employee' | 'citizen'
}

/** Directory returned a non-empty usable value → show read-only. Empty or `'-'` → user may type. */
export function isDirectoryProvided(val: string) {
  const t = val.trim()
  return t !== '' && t !== '-'
}

/** Default username when the field is still empty: employee id when present, otherwise CID. */
export function suggestedUsername(profile: FetchedPerson) {
  // if (isDirectoryProvided(profile.employeeId)) {
  //   return profile.employeeId.trim().toLowerCase()
  // }
  const cid = profile.cid.trim()
  if (cid && cid !== '-') return cid.toLowerCase()
  return ''
}

function cleanOrganogramId(value: unknown): string | undefined {
  const s = toText(value).trim()
  if (!s || s === '0') return undefined
  return s
}

function cleanOrganogramName(value: unknown): string | undefined {
  const s = toText(value).trim()
  return s || undefined
}

/** Extracts EMS-style organogram hints from a directory payload when present. */
export function pickOrganogramHints(r: ApiRecord): DirectoryOrganogramHints | undefined {
  const level1Id = cleanOrganogramId(r.Level1_ID ?? r.level1_id ?? r.level1Id)
  const level2Id = cleanOrganogramId(r.Level2_ID ?? r.level2_id ?? r.level2Id)
  const level3Id = cleanOrganogramId(r.Level3_ID ?? r.level3_id ?? r.level3Id)
  const level4Id = cleanOrganogramId(r.Level4_ID ?? r.level4_id ?? r.level4Id)
  const level1Name = cleanOrganogramName(r.OrganogramLevel1 ?? r.organogramLevel1 ?? r.organogram_level_1)
  const level2Name = cleanOrganogramName(r.OrganogramLevel2 ?? r.organogramLevel2 ?? r.organogram_level_2)
  const level3Name = cleanOrganogramName(r.OrganogramLevel3 ?? r.organogramLevel3 ?? r.organogram_level_3)
  const level4Name = cleanOrganogramName(r.OrganogramLevel4 ?? r.organogramLevel4 ?? r.organogram_level_4)
  const subGroupId = cleanOrganogramId(r.SubGroupID ?? r.sub_group_id ?? r.subGroupId)
  const subGroupName = cleanOrganogramName(r.SubGroup ?? r.sub_group ?? r.subGroupName ?? r.sub_group_name)
  const directoryAgencyId = cleanOrganogramId(r.agencyID ?? r.agency_id ?? r.agencyId)
  const directoryAgencyName = cleanOrganogramName(r.agencyName ?? r.agency_name)

  const hints: DirectoryOrganogramHints = {}
  if (level1Id) hints.level1Id = level1Id
  if (level2Id) hints.level2Id = level2Id
  if (level3Id) hints.level3Id = level3Id
  if (level4Id) hints.level4Id = level4Id
  if (level1Name) hints.level1Name = level1Name
  if (level2Name) hints.level2Name = level2Name
  if (level3Name) hints.level3Name = level3Name
  if (level4Name) hints.level4Name = level4Name
  if (subGroupId) hints.subGroupId = subGroupId
  if (subGroupName) hints.subGroupName = subGroupName
  if (directoryAgencyId) hints.directoryAgencyId = directoryAgencyId
  if (directoryAgencyName) hints.directoryAgencyName = directoryAgencyName

  if (Object.keys(hints).length === 0) return undefined
  return hints
}

/**
 * True when lookup/NDI returned agency, department, and division labels (not only EMS organogram keys).
 * Used to auto-resolve `/public/groups` tiers by name when `pickOrganogramHints` produced nothing.
 * Sub division / section is optional — many payloads omit it but the first three tiers are still enough to match.
 * Does not require `employeeId` so CID-only directory rows with organogram labels still resolve.
 */
export function hasEmployeeDirectoryOrgLabels(profile: FetchedPerson): boolean {
  return (
    isDirectoryProvided(profile.agency) &&
    isDirectoryProvided(profile.department) &&
    isDirectoryProvided(profile.division)
  )
}

/**
 * Merges EMS-style `organogramHints` with tier names from `agency` / `department` / `division` / `subDivision`
 * when the directory supplies those label tiers (first three required; fourth only if sub division / section is present).
 * API organogram fields override labels.
 */
export function mergedOrganogramHintsForProfile(profile: FetchedPerson): DirectoryOrganogramHints | undefined {
  const fromApi = profile.organogramHints
  const fromLabels: DirectoryOrganogramHints | undefined = hasEmployeeDirectoryOrgLabels(profile)
    ? {
        level1Name: profile.agency.trim(),
        level2Name: profile.department.trim(),
        level3Name: profile.division.trim(),
        ...(isDirectoryProvided(profile.subDivision) ? { level4Name: profile.subDivision.trim() } : {}),
      }
    : undefined
  if (!fromApi && !fromLabels) return undefined
  if (!fromApi) return fromLabels
  if (!fromLabels) return fromApi
  return { ...fromLabels, ...fromApi }
}

/** Derives a single display name string from `name`, `full_name`, `first_name`+`last_name` (or camelCase), or employee/citizen aliases. */
function pickName(r: ApiRecord): string {
  const name = toText(r.name) || toText(r.full_name)
  if (name) return name
  const first = toText(r.first_name) || toText(r.firstName)
  const middle =
    toText(r.middle_name) ||
    toText(r.middleName) ||
    toText(r.mid) ||
    toText(r.second_name) ||
    toText(r.secondName)
  const last = toText(r.last_name) || toText(r.lastName)
  if (first || middle || last) return [first, middle, last].filter(Boolean).join(' ').trim()
  return toText(r.employee_name) || toText(r.citizen_name) || ''
}

/** Job title / designation from directory (EMS and heterogeneous API keys). */
function pickDesignation(r: ApiRecord): string {
  return (
    toText(r.designation) ||
    toText(r.positionTitle) ||
    toText(r.position_title) ||
    toText(r.PositionTitle) ||
    toText(r.position) ||
    toText(r.title) ||
    ''
  )
}

/** Citizen ID from directory/user payloads (snake_case and camelCase). */
function pickCid(r: ApiRecord): string {
  const direct =
    toText(r.cid) ||
    toText(r.citizen_id) ||
    toText(r.citizenId) ||
    toText(r.cid_no) ||
    toText(r.cidNumber) ||
    toText(r.cid_number) ||
    ''
  if (direct) return direct

  const attrs = r.attributes
  if (attrs && typeof attrs === 'object' && !Array.isArray(attrs)) {
    const a = attrs as Record<string, unknown>
    for (const key of ['cid', 'citizen_id', 'citizenId', 'cid_no', 'cid_number'] as const) {
      const value = a[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
      if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) {
        return value[0].trim()
      }
    }
  }

  return ''
}

/** When the API returns only a display `name`, split into first / middle / last for the form. */
function splitFullNameForPerson(display: string): { first: string; middle: string; last: string } {
  const t = display.trim()
  if (!t || t === '-') return { first: '', middle: '', last: '' }
  const tokens = t.split(/\s+/).filter(Boolean)
  if (tokens.length === 1) return { first: tokens[0]!, middle: '', last: '' }
  if (tokens.length === 2) return { first: tokens[0]!, middle: '', last: tokens[1]! }
  return {
    first: tokens[0]!,
    middle: tokens.slice(1, -1).join(' '),
    last: tokens[tokens.length - 1]!,
  }
}

/** Maps an API user/profile record into the create/edit form shape (directory or saved user). */
export function apiRecordToFetchedPerson(r: ApiRecord): FetchedPerson {
  const emp =
    toText(r.employee_id) ||
    toText(r.emp_id) ||
    toText(r.employeeNumber) ||
    toText(r.empid) ||
    toText(r.eid) ||
    toText(r.accessToken) ||
    ''
  const cid = pickCid(r)
  const lookupId =
    emp || cid || toText(r.id) || toText(r.user_id) || toText(r.uuid) || 'user'
  let base = mapRecordToPerson(r, lookupId)
  const fromGroups = organogramLabelsFromGroups(r)
  const mergeTierLabel = (current: string, fromGroup: string) => {
    const c = current.trim()
    if (c && c !== '-') return current
    const g = fromGroup.trim()
    return g || current
  }
  base = {
    ...base,
    agency: mergeTierLabel(base.agency, fromGroups.agency),
    department: mergeTierLabel(base.department, fromGroups.department),
    division: mergeTierLabel(base.division, fromGroups.division),
    subDivision: mergeTierLabel(base.subDivision, fromGroups.subDivision),
  }
  const agency_id = toText(r.agency_id ?? r.agencyId).trim()
  const department_id = toText(r.department_id ?? r.departmentId).trim()
  const division_id = toText(r.division_id ?? r.divisionId).trim()
  const sub_division_id = toText(r.sub_division_id ?? r.subDivisionId ?? r.subdivision_id).trim()
  if (agency_id || department_id || division_id || sub_division_id) {
    return {
      ...base,
      persistedOrgIds: {
        ...(agency_id ? { agency_id } : {}),
        ...(department_id ? { department_id } : {}),
        ...(division_id ? { division_id } : {}),
        ...(sub_division_id ? { sub_division_id } : {}),
      },
    }
  }
  return base
}

/**
 * True when a directory-like API record has enough identity to prefill signup (CID and/or employee id).
 */
export function recordHasDirectoryIdentity(r: ApiRecord): boolean {
  const p = apiRecordToFetchedPerson(r)
  return (
    isDirectoryProvided(p.cid) ||
    isDirectoryProvided(p.employeeId) 
  )
}

/**
 * Maps a directory-shaped object (e.g. NDI `check_callback_response` `data`) into `FetchedPerson` without GET /public/employees.
 */
export function fetchedPersonFromDirectoryLikeRecord(r: ApiRecord): FetchedPerson {
  const person = apiRecordToFetchedPerson(r)
  const hasEmp = isDirectoryProvided(person.employeeId)
  return {
    ...person,
    directoryLookup: hasEmp ? 'employee' : 'citizen',
  }
}

/** Realm / role names assigned to a user record (for edit form checkboxes). */
export function realmRoleNamesFromUserRecord(r: ApiRecord): string[] {
  const out: string[] = []
  /** Normalizes one array element to a role name string (string or `{ name|role_name|keycloak_role }`). */
  const pick = (x: unknown): string | null => {
    if (typeof x === 'string' && x.trim()) return x.trim()
    if (x && typeof x === 'object') {
      const o = x as ApiRecord
      return toText(o.name) || toText(o.role_name) || toText(o.keycloak_role)
    }
    return null
  }
  for (const key of ['realm_roles', 'roles'] as const) {
    const list = r[key]
    if (!Array.isArray(list)) continue
    for (const x of list) {
      const n = pick(x)
      if (n) out.push(n)
    }
  }
  return [...new Set(out)]
}

/** Builds `FetchedPerson` from any directory/user record, using `lookupId` as the stable key when employee/cid are ambiguous. */
function mapRecordToPerson(r: ApiRecord, lookupId: string): FetchedPerson {
  const organogramHints = pickOrganogramHints(r)
  const firstNameRaw = toText(r.first_name) || toText(r.firstName)
  const middleNameRaw =
    toText(r.middle_name) ||
    toText(r.middleName) ||
    toText(r.mid) ||
    toText(r.second_name) ||
    toText(r.secondName)
  const lastNameRaw = toText(r.last_name) || toText(r.lastName)
  const displayName = pickName(r) || '-'
  let firstName = firstNameRaw || undefined
  let middleName = middleNameRaw || undefined
  let lastName = lastNameRaw || undefined
  if (!firstName && !lastName && !middleName && displayName !== '-') {
    const sp = splitFullNameForPerson(displayName)
    if (sp.first) firstName = sp.first
    if (sp.middle) middleName = sp.middle
    if (sp.last) lastName = sp.last
  }
  const designation = pickDesignation(r)
  return {
    lookupId,
    employeeId:
      toText(r.employee_id) ||
      toText(r.emp_id) ||
      toText(r.employeeNumber) ||
      toText(r.empid) ||
      toText(r.eid) ||
      toText(r.employee_no) ||
      '',
    cid: pickCid(r),
    name: displayName,
    firstName,
    middleName,
    lastName,
    agency:
      toText(r.agency) ||
      toText(r.agency_name) ||
      toText(r.organization) ||
      toText(r.ministry) ||
      '-',
    department: toText(r.department) || toText(r.dept) || '-',
    division:
      toText(r.division) ||
      toText(r.division_name) ||
      toText(r.divisionName) ||
      '-',
    subDivision:
      toText(r.sub_division) ||
      toText(r.subDivision) ||
      toText(r.subdivision) ||
      toText(r.sub_division_name) ||
      toText(r.section) ||
      toText(r.Section) ||
      '-',
    designation,
    designationFromDirectory: isDirectoryProvided(designation),
    contact:
      toText(r.contact) ||
      toText(r.contact_no) ||
      toText(r.contact_number) ||
      toText(r.phone) ||
      toText(r.mobile) ||
      '-',
    email: toText(r.email) || '-',
    organogramHints,
  }
}

/** `GET /public/employees/{empid}` → `FetchedPerson`; throws if missing or empty id. */
export async function fetchEmployeeById(empid: string): Promise<FetchedPerson> {
  const trimmed = empid.trim()
  if (!trimmed) throw new Error('Employee ID is required')
  const payload = await apiGet<unknown>(`/public/employees/${encodeURIComponent(trimmed)}`)
  const r = unwrapDataRecord(payload)
  if (!r) throw new Error('Employee not found')
  const person = mapRecordToPerson(r, trimmed)
  const employeeId = isDirectoryProvided(person.employeeId) ? person.employeeId.trim() : trimmed
  return { ...person, employeeId, directoryLookup: 'employee' }
}

/**
 * `GET /public/employees/{cid}` → `FetchedPerson` for create-user flow (lookup by CID only).
 * Agencies / department / divisions are prefilled when the API returns them; otherwise they stay empty/`'-'` so the user can type them—same mapping as numeric employee lookups.
 */
export async function fetchEmployeeByCid(cid: string): Promise<FetchedPerson> {
  const trimmed = cid.trim()
  if (!trimmed) throw new Error('Citizen ID is required')
  const payload = await apiGet<unknown>(`/public/employees/${encodeURIComponent(trimmed)}`)
  const r = unwrapDataRecord(payload)
  if (!r) throw new Error('No directory record found for this CID')
  const person = mapRecordToPerson(r, trimmed)
  const cidResolved = pickCid(r) || trimmed
  return { ...person, cid: cidResolved, directoryLookup: 'employee' }
}

/** `GET /admin/citizens/{cid}` → `FetchedPerson`; directory usually returns only a name—other fields are left empty for manual entry. */
export async function fetchCitizenByCid(cid: string): Promise<FetchedPerson> {
  const trimmed = cid.trim()
  if (!trimmed) throw new Error('Citizen ID is required')
  const payload = await apiGet<unknown>(`/admin/citizens/${encodeURIComponent(trimmed)}`)
  const r = unwrapDataRecord(payload)
  if (!r) throw new Error('Citizen not found')
  const name = pickName(r) || '-'
  const cidFromApi = pickCid(r) || trimmed
  const designationRaw = pickDesignation(r)
  return {
    lookupId: trimmed,
    cid: cidFromApi,
    employeeId: '',
    name,
    agency: '',
    department: '',
    division: '',
    subDivision: '',
    designation: designationRaw,
    designationFromDirectory: isDirectoryProvided(designationRaw),
    contact: '',
    email: '',
    organogramHints: undefined,
    directoryLookup: 'citizen',
  }
}

/** Flattens `{ user: … }` / `{ profile: … }` payloads so nested list/detail rows match flat fields. */
export function mergeNestedUserEnvelope(record: ApiRecord): ApiRecord {
  let merged: ApiRecord = { ...record }
  const u = record.user
  if (u && typeof u === 'object' && !Array.isArray(u)) {
    merged = { ...merged, ...(u as ApiRecord) }
  }
  const p = record.profile
  if (p && typeof p === 'object' && !Array.isArray(p)) {
    merged = { ...merged, ...(p as ApiRecord) }
  }
  return merged
}

/** Registration / approval status (e.g. `pending`) from flexible API shapes. */
export function pickUserRegistrationStatus(record: ApiRecord): string {
  const r = mergeNestedUserEnvelope(record)
  const attrs = r.attributes
  const fromAttributes = (): string => {
    if (!attrs || typeof attrs !== 'object' || Array.isArray(attrs)) return ''
    const a = attrs as Record<string, unknown>
    for (const key of ['status', 'user_status', 'registration_status'] as const) {
      const v = a[key]
      if (typeof v === 'string' && v.trim()) return v.trim()
      if (Array.isArray(v) && typeof v[0] === 'string' && v[0].trim()) return v[0].trim()
    }
    return ''
  }

  const direct =
    toText(r.status) ||
    toText(r.user_status) ||
    toText(r.account_status) ||
    toText(r.registration_status) ||
    toText(r.approval_status) ||
    toText((r as { userStatus?: unknown }).userStatus) ||
    toText((r as { accountStatus?: unknown }).accountStatus)

  const rawStatus = r.status
  if (!direct && rawStatus && typeof rawStatus === 'object' && !Array.isArray(rawStatus)) {
    const code = toText((rawStatus as ApiRecord).code) || toText((rawStatus as ApiRecord).value)
    if (code) return code
  }

  return direct || fromAttributes() || '-'
}

/** `GET /admin/users/{id}` → merged `ApiRecord` for detail/edit screens. */
export async function fetchUserById(userId: string): Promise<ApiRecord> {
  const trimmed = userId.trim()
  if (!trimmed) throw new Error('User id is required')
  const payload = await apiGet<unknown>(`/admin/users/${encodeURIComponent(trimmed)}`)
  const r = unwrapDataRecord(payload)
  if (!r) throw new Error('User not found')
  return mergeNestedUserEnvelope(r)
}

export type UserCidSearchResult = {
  cid: string
  fullName: string
}

export type UserDetailCidSearchResult = {
  userId: string
  citizenId: string
  fullName: string
  employeeId: string
  contactNumber: string
}

function usersListRecordsFromPayload(payload: unknown): ApiRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is ApiRecord => !!item && typeof item === 'object')
  }
  if (!payload || typeof payload !== 'object') return []
  const root = payload as ApiRecord

  const arrayFromEnvelope = (obj: ApiRecord): ApiRecord[] | null => {
    for (const key of ['items', 'results', 'users', 'records', 'rows', 'list', 'data'] as const) {
      const value = obj[key]
      if (Array.isArray(value)) {
        return value.filter((item): item is ApiRecord => !!item && typeof item === 'object')
      }
    }
    return null
  }

  const direct = arrayFromEnvelope(root)
  if (direct) return direct

  const data = root.data
  if (Array.isArray(data)) {
    return data.filter((item): item is ApiRecord => !!item && typeof item === 'object')
  }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const nested = arrayFromEnvelope(data as ApiRecord)
    if (nested) return nested
  }

  return []
}

function cidsMatch(left: string, right: string): boolean {
  const a = left.trim()
  const b = right.trim()
  if (!a || !b) return false
  if (a === b) return true
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) {
    try {
      return BigInt(a) === BigInt(b)
    } catch {
      return false
    }
  }
  return false
}

function pickUserIdFromRecord(record: ApiRecord): string {
  const merged = mergeNestedUserEnvelope(record)
  return (
    toText(merged.id) ||
    toText(merged.user_id) ||
    toText(merged.uuid) ||
    toText(merged.keycloak_id) ||
    toText(merged.keycloak_user_id) ||
    ''
  )
}

function mapUserRecordToCidSearchResult(raw: ApiRecord): UserCidSearchResult | null {
  const merged = mergeNestedUserEnvelope(raw)
  const cid = pickCid(merged)
  const fullName = pickName(merged)
  if (!cid || !fullName) return null
  return { cid, fullName }
}

function mapUserRecordToDetailCidSearchResult(
  raw: ApiRecord,
  searchedCid = '',
): UserDetailCidSearchResult | null {
  const merged = mergeNestedUserEnvelope(raw)
  const detail = mapUserDetailFields(merged)
  const userId = detail.id !== '-' ? detail.id : ''
  const citizenId = pickCid(merged) || searchedCid.trim()
  if (!userId || !citizenId) return null
  return {
    userId,
    citizenId,
    fullName: detail.name !== '-' ? detail.name : '',
    employeeId: detail.employeeId !== '-' ? detail.employeeId : '',
    contactNumber: detail.contact !== '-' ? detail.contact : '',
  }
}

function findExactCidUserRecord(records: ApiRecord[], trimmed: string): ApiRecord | null {
  for (const raw of records) {
    const merged = mergeNestedUserEnvelope(raw)
    if (cidsMatch(pickCid(merged), trimmed)) return raw
  }
  return null
}

function findUserRecordInList(records: ApiRecord[], trimmed: string): ApiRecord | null {
  const exact = findExactCidUserRecord(records, trimmed)
  if (exact) return exact

  if (records.length === 1) {
    const only = records[0]
    if (only && pickUserIdFromRecord(only)) return mergeNestedUserEnvelope(only)
  }

  return null
}

async function findUserRecordByCid(cid: string): Promise<ApiRecord | null> {
  const trimmed = cid.trim()
  if (!trimmed) return null

  const { records } = await fetchUsersListPage({
    page: '1',
    page_size: '20',
    search: trimmed,
  })
  return findUserRecordInList(records, trimmed)
}

async function fetchUsersListPage(
  query: Record<string, string>,
): Promise<{ payload: unknown; records: ApiRecord[] }> {
  const params = new URLSearchParams(query)
  const payload = await apiGet<unknown>(`/admin/users?${params.toString()}`)
  return { payload, records: usersListRecordsFromPayload(payload) }
}

export type UserSelectOption = {
  id: string
  name: string
}

function mapUserRecordToSelectOption(raw: ApiRecord): UserSelectOption | null {
  const merged = mergeNestedUserEnvelope(raw)
  const detail = mapUserDetailFields(merged)
  if (!detail.id || detail.id === '-' || !detail.name || detail.name === '-') return null
  return { id: detail.id, name: detail.name }
}

/** Users for select lists (`GET /admin/users`, first page). */
export async function fetchUsersForSelect(pageSize = 100): Promise<UserSelectOption[]> {
  const params = new URLSearchParams()
  params.set('page', '1')
  params.set('page_size', String(pageSize))
  params.set('role', 'fms-driver')
  const payload = await apiGet<unknown>(`/admin/users?${params.toString()}`)
  return usersListRecordsFromPayload(payload)
    .map(mapUserRecordToSelectOption)
    .filter((row): row is UserSelectOption => row !== null)
}

/** Search `GET /admin/users` by CID; returns CID and display name. */
export async function searchUserByCid(cid: string): Promise<UserCidSearchResult | null> {
  const record = await findUserRecordByCid(cid)
  if (!record) return null
  return mapUserRecordToCidSearchResult(record)
}

/** Search `GET /admin/users` by CID; returns user id and profile fields for forms. */
export async function searchUserDetailByCid(
  cid: string,
): Promise<UserDetailCidSearchResult | null> {
  const trimmed = cid.trim()
  const record = await findUserRecordByCid(trimmed)
  if (!record) return null
  return mapUserRecordToDetailCidSearchResult(record, trimmed)
}

/** Tier labels from `groups`: index 0 agency … 3 sub division (legacy / string rows only). */
function organogramLabelsFromGroups(record: ApiRecord): {
  agency: string
  department: string
  division: string
  subDivision: string
} {
  const g = record.groups
  if (!Array.isArray(g)) {
    return { agency: '', department: '', division: '', subDivision: '' }
  }
  const textAt = (index: number): string => {
    const item = g[index]
    if (typeof item === 'string') return item.trim()
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return toText((item as ApiRecord).name).trim()
    }
    return ''
  }
  return {
    agency: textAt(0),
    department: textAt(1),
    division: textAt(2),
    subDivision: textAt(3),
  }
}

/**
 * Parses `/agency/…` paths from the user payload into four tier labels.
 * Deeper paths join remaining segments into `subDivision` (e.g. repeated org unit names in the trail).
 */
function parseOrganogramPath(path: string): {
  agency: string
  department: string
  division: string
  subDivision: string
} {
  const parts = path
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
  let i = 0
  if (parts[i]?.toLowerCase() === 'agency') i += 1
  const rest = parts.slice(i)
  const agency = rest[0] ?? ''
  const department = rest[1] ?? ''
  const division = rest[2] ?? ''
  const subDivision = rest.length > 4 ? rest.slice(3).join(' / ') : (rest[3] ?? '')
  return { agency, department, division, subDivision }
}

/** Resolves organogram display names from `groups` on the user record (match `*_id` to `id`, then `path` fallback). */
function organogramLabelsFromEmbeddedGroups(record: ApiRecord): {
  agency: string
  department: string
  division: string
  subDivision: string
} {
  const r = mergeNestedUserEnvelope(record)
  const ids = pickOrganogramTierIds(r)
  const groups = r.groups
  if (!Array.isArray(groups)) {
    return { agency: '', department: '', division: '', subDivision: '' }
  }

  const byId = new Map<string, { name: string; path: string }>()
  for (const item of groups) {
    if (typeof item === 'string') continue
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const o = item as ApiRecord
    const id = cleanStoredGroupId(
      o.id ?? o.group_id ?? o.uuid ?? o.groupId ?? o.entity_id ?? o.entityId,
    )
    if (!id) continue
    const name = toText(o.name).trim()
    const path = toText(o.path).trim()
    byId.set(id.toLowerCase(), { name, path })
  }

  const labelFor = (id: string) => {
    if (!id) return ''
    return byId.get(id.toLowerCase())?.name ?? ''
  }

  let agency = labelFor(ids.agencyId)
  let department = labelFor(ids.departmentId)
  let division = labelFor(ids.divisionId)
  let subDivision = labelFor(ids.subDivisionId)

  const needsSubLabel = Boolean(ids.subDivisionId)
  const complete =
    Boolean(agency && department && division) && (!needsSubLabel || Boolean(subDivision))

  if (complete) {
    return { agency, department, division, subDivision }
  }

  const tierOrder = [ids.subDivisionId, ids.divisionId, ids.departmentId, ids.agencyId]
  let anchorPath = ''
  for (const tid of tierOrder) {
    if (!tid) continue
    const p = byId.get(tid.toLowerCase())?.path ?? ''
    if (p) {
      anchorPath = p
      break
    }
  }
  if (!anchorPath) {
    for (const item of groups) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      const p = toText((item as ApiRecord).path).trim()
      if (p) {
        anchorPath = p
        break
      }
    }
  }

  if (anchorPath) {
    const parsed = parseOrganogramPath(anchorPath)
    if (!agency) agency = parsed.agency
    if (!department) department = parsed.department
    if (!division) division = parsed.division
    if (!subDivision) subDivision = parsed.subDivision
  }

  if (!agency && !department && !division && !subDivision) {
    return organogramLabelsFromGroups(r)
  }

  return { agency, department, division, subDivision }
}

function cleanStoredGroupId(value: unknown): string {
  const s = toText(value).trim()
  if (!s || s === '0') return ''
  return s
}

/** When the API stores a tier id in `agency` / `department` instead of `agency_id`. */
function uuidTierIdFromField(value: unknown): string {
  const s = cleanStoredGroupId(value)
  return s && isUuidLike(s) ? s : ''
}

function readAttributeScalar(record: ApiRecord, key: string): string {
  const attrs = record.attributes
  if (!attrs || typeof attrs !== 'object' || Array.isArray(attrs)) return ''
  const raw = (attrs as ApiRecord)[key]
  if (typeof raw === 'string') return cleanStoredGroupId(raw)
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const s = cleanStoredGroupId(item)
      if (s) return s
    }
  }
  return ''
}

function hasExplicitOrganogramTierField(
  record: ApiRecord,
  snakeKey: string,
  camelKey: string,
): boolean {
  if (snakeKey in record || camelKey in record) return true
  const attrs = record.attributes
  return Boolean(
    attrs && typeof attrs === 'object' && !Array.isArray(attrs) && snakeKey in attrs,
  )
}

/** Uses positional `groups[n]` only when the tier id field is absent — not when it is explicitly null. */
function resolveOrganogramTierId(
  record: ApiRecord,
  snakeKey: string,
  camelKey: string,
  flatId: string,
  groupFallback: string,
): string {
  if (hasExplicitOrganogramTierField(record, snakeKey, camelKey)) {
    return flatId
  }
  return flatId || groupFallback
}

/**
 * Organogram tier ids from `GET /admin/users/:id` (`data.agency_id`, `department_id`,
 * `division_id`, `sub_division_id`). Resolved via `/admin/groups` and `/public/groups` for display names.
 */
export function pickUserDetailOrganogramIds(record: ApiRecord): {
  agencyId: string
  departmentId: string
  divisionId: string
  subDivisionId: string
} {
  const m = mergeNestedUserEnvelope(record)
  const fromFlat = {
    agencyId:
      cleanStoredGroupId(m.agency_id ?? m.agencyId) ||
      readAttributeScalar(m, 'agency_id') ||
      uuidTierIdFromField(m.agency),
    departmentId:
      cleanStoredGroupId(m.department_id ?? m.departmentId) ||
      readAttributeScalar(m, 'department_id') ||
      uuidTierIdFromField(m.department),
    divisionId:
      cleanStoredGroupId(m.division_id ?? m.divisionId) ||
      readAttributeScalar(m, 'division_id') ||
      uuidTierIdFromField(m.division),
    subDivisionId:
      cleanStoredGroupId(m.sub_division_id ?? m.subDivisionId ?? m.subdivision_id) ||
      readAttributeScalar(m, 'sub_division_id') ||
      uuidTierIdFromField(m.sub_division) ||
      uuidTierIdFromField(m.subDivision) ||
      uuidTierIdFromField(m.subdivision),
  }

  const g = m.groups
  if (!Array.isArray(g)) return fromFlat

  const entryId = (item: unknown): string => {
    if (typeof item === 'string') return cleanStoredGroupId(item)
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const o = item as ApiRecord
      return cleanStoredGroupId(
        o.id ?? o.group_id ?? o.uuid ?? o.groupId ?? o.entity_id ?? o.entityId,
      )
    }
    return ''
  }
  return {
    agencyId: resolveOrganogramTierId(
      m,
      'agency_id',
      'agencyId',
      fromFlat.agencyId,
      entryId(g[0]),
    ),
    departmentId: resolveOrganogramTierId(
      m,
      'department_id',
      'departmentId',
      fromFlat.departmentId,
      entryId(g[1]),
    ),
    divisionId: resolveOrganogramTierId(
      m,
      'division_id',
      'divisionId',
      fromFlat.divisionId,
      entryId(g[2]),
    ),
    subDivisionId: resolveOrganogramTierId(
      m,
      'sub_division_id',
      'subDivisionId',
      fromFlat.subDivisionId,
      entryId(g[3]),
    ),
  }
}

function pickOrganogramTierIds(record: ApiRecord) {
  return pickUserDetailOrganogramIds(record)
}

function isMissingOrganogramLabel(value: string): boolean {
  const t = value.trim()
  return !t || t === '—' || isUuidLike(t)
}

/** Plain-text tier labels on the user payload (directory / legacy shapes). */
function organogramLabelsFromFlatFields(record: ApiRecord): {
  agency: string
  department: string
  division: string
  subDivision: string
} {
  const m = mergeNestedUserEnvelope(record)
  const keep = (value: unknown): string => {
    const t = toText(value).trim()
    return t && !isUuidLike(t) ? t : ''
  }
  return {
    agency:
      keep(m.agency_name) ||
      keep(m.agencyName) ||
      keep(m.organization) ||
      keep(m.ministry) ||
      keep(m.agency),
    department:
      keep(m.department_name) ||
      keep(m.departmentName) ||
      keep(m.dept) ||
      keep(m.department),
    division: keep(m.division_name) || keep(m.divisionName) || keep(m.division),
    subDivision:
      keep(m.sub_division_name) ||
      keep(m.subDivisionName) ||
      keep(m.sub_division) ||
      keep(m.subDivision) ||
      keep(m.subdivision) ||
      keep(m.section),
  }
}

function pickOrganogramDisplayLabel(...candidates: string[]): string {
  for (const candidate of candidates) {
    if (!isMissingOrganogramLabel(candidate)) return candidate.trim()
  }
  return '—'
}

/** Resolves one tier id via `/admin/groups` + `/public/groups`, then embedded/flat fallbacks. */
function resolveUserOrganogramTierLabel(
  tierId: string,
  embeddedLabel: string,
  flatLabel: string,
  lookups?: OrganogramDisplayLookups,
): string {
  const fromLookup =
    lookups && tierId.trim() ? resolveAdminGroupIdToName(tierId, lookups) ?? '' : ''
  return pickOrganogramDisplayLabel(fromLookup, embeddedLabel, flatLabel)
}

/** Maps user detail organogram ids to labels using group trees, then user payload fallbacks. */
export function resolveUserOrganogramNames(
  record: ApiRecord,
  lookups?: OrganogramDisplayLookups,
): {
  agency: string
  department: string
  division: string
  subDivision: string
} {
  const ids = pickUserDetailOrganogramIds(record)
  const embedded = organogramLabelsFromEmbeddedGroups(record)
  const flat = organogramLabelsFromFlatFields(record)
  return {
    agency: resolveUserOrganogramTierLabel(ids.agencyId, embedded.agency, flat.agency, lookups),
    department: resolveUserOrganogramTierLabel(
      ids.departmentId,
      embedded.department,
      flat.department,
      lookups,
    ),
    division: resolveUserOrganogramTierLabel(ids.divisionId, embedded.division, flat.division, lookups),
    subDivision: resolveUserOrganogramTierLabel(
      ids.subDivisionId,
      embedded.subDivision,
      flat.subDivision,
      lookups,
    ),
  }
}

export type UserOrganogramDisplayNames = {
  agency: string
  department: string
  division: string
  subDivision: string
}

/**
 * Resolves organogram tier labels via `GET /master/{tier}/id/{id}` (no `/admin/groups`).
 * Falls back to names embedded on the user record or plain-text tier fields.
 */
export async function fetchUserOrganogramDisplayNames(
  record: ApiRecord,
): Promise<UserOrganogramDisplayNames> {
  const ids = pickUserDetailOrganogramIds(record)
  const fallback = resolveUserOrganogramNames(record)

  const resolveTier = async (
    entityType: string,
    tierId: string,
    fallbackLabel: string,
  ): Promise<string> => {
    const id = tierId.trim()
    if (id) {
      const fromMaster = await fetchMasterEntityNameById(entityType, id)
      if (fromMaster) return fromMaster
    }
    if (!isMissingOrganogramLabel(fallbackLabel)) return fallbackLabel.trim()
    return '—'
  }

  const [agency, department, division, subDivision] = await Promise.all([
    resolveTier('agency', ids.agencyId, fallback.agency),
    resolveTier('department', ids.departmentId, fallback.department),
    resolveTier('division', ids.divisionId, fallback.division),
    resolveTier('sub-division', ids.subDivisionId, fallback.subDivision),
  ])

  return { agency, department, division, subDivision }
}

/** Projects a user API record into flat strings for read-only cards (detail page). */
export function mapUserDetailFields(r: ApiRecord, lookups?: OrganogramDisplayLookups) {
  const id =
    toText(r.id) ||
    toText(r.user_id) ||
    toText(r.uuid) ||
    '-'
  const username = toText(r.username) || toText(r.user_name) || '-'
  const name = pickName(r) || username
  const email = toText(r.email) || '-'
  const contact =
    toText(r.contact) ||
    toText(r.contact_no) ||
    toText(r.contact_number) ||
    toText(r.phone) ||
    toText(r.mobile) ||
    '-'
  const employeeId =
    toText(r.employee_id) ||
    toText(r.emp_id) ||
    toText(r.employeeNumber) ||
    toText(r.empid) ||
    toText(r.eid) ||
    toText(r.emp_id) ||
    '-'
  const cid = pickCid(r) || '-'
  const status = pickUserRegistrationStatus(r)
  const designation = pickDesignation(r)
  const organogram = resolveUserOrganogramNames(r, lookups)
  const agency = organogram.agency
  const department = organogram.department
  const division = organogram.division
  const subDivision = organogram.subDivision

  let rolesLabel = '-'
  if (Array.isArray(r.realm_roles) && r.realm_roles.length > 0) {
    const parts = r.realm_roles.map((x) =>
      typeof x === 'string' ? x : toText((x as ApiRecord).name),
    )
    const label = parts
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => formatRealmRoleDisplayName(p))
      .join(', ')
    rolesLabel = label || '-'
  } else if (Array.isArray(r.roles) && r.roles.length > 0) {
    const parts = r.roles.map((x) => {
      if (typeof x === 'string') return x
      if (x && typeof x === 'object') return toText((x as ApiRecord).name) || toText((x as ApiRecord).role_name)
      return ''
    })
    const label = parts
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => formatRealmRoleDisplayName(p))
      .join(', ')
    rolesLabel = label || '-'
  }

  return {
    id,
    username,
    name,
    email,
    contact,
    employeeId,
    cid,
    rolesLabel,
    status,
    designation,
    agency,
    department,
    division,
    subDivision,
  }
}

export type RealmRoleOption = { roleName: string; description: string }

/** Loads realm roles from `GET /public/roles`, dedupes by name for create/edit checkboxes. */
export async function fetchRealmRoleOptions(): Promise<RealmRoleOption[]> {
  const payload = await apiGet<unknown>('/public/roles')
  const seen = new Set<string>()
  const options: RealmRoleOption[] = []
  for (const row of rolesToArray(payload)) {
    const mapped = mapRoleListRecord(row)
    const roleName =
      mapped.roleName === '-' ? toText((row as ApiRecord).name) || '-' : mapped.roleName
    if (!roleName || roleName === '-' || seen.has(roleName)) continue
    seen.add(roleName)
    options.push({
      roleName,
      description: mapped.description === '-' ? '' : mapped.description,
    })
  }
  return options
}

/**
 * Body for POST `/admin/users` (and PUT updates): backend expects snake_case user fields plus organogram UUIDs and `roles`.
 * `agency_code` and `ministry_code` are sent as empty strings when not used.
 */
export type CreateUserPayload = {
  username: string
  emp_id: string
  cid: string
  first_name: string
  last_name: string
  email: string
  agency_code: string
  ministry_code: string
  agency_id: string
  department_id: string
  division_id: string
  sub_division_id: string
  designation: string
  contact_no: string
  /** Omitted when empty (e.g. public signup defers role assignment to the server). */
  roles?: string[]
}

function payloadTextField(value: string): string {
  const t = value.trim()
  if (!t || t === '-') return ''
  return t
}

function splitDisplayName(display: string): { first_name: string; last_name: string } {
  const t = payloadTextField(display)
  if (!t) return { first_name: '', last_name: '' }
  const i = t.indexOf(' ')
  if (i === -1) return { first_name: t, last_name: '' }
  return { first_name: t.slice(0, i), last_name: t.slice(i + 1).trim() }
}

/** Assembles `POST|PUT /admin/users` JSON from directory/profile, username, realm roles, and optional or persisted group ids. */
export function buildCreateUserPayload(
  profile: FetchedPerson,
  username: string,
  realmRoles: string[],
  orgIds?: CreateUserOrgIds | null,
): CreateUserPayload {
  const u = username.trim()
  const mergedOrg: CreateUserOrgIds = { ...profile.persistedOrgIds, ...(orgIds ?? {}) }
  const fromDisplay = splitDisplayName(profile.name)
  const first_name =
    payloadTextField(profile.firstName ?? '') || fromDisplay.first_name
  const middle_for_last = payloadTextField(profile.middleName ?? '')
  const last_surname = payloadTextField(profile.lastName ?? '')
  const last_name =
    [middle_for_last, last_surname].filter(Boolean).join(' ').trim() || fromDisplay.last_name
  const roles = [...new Set(realmRoles.map((s) => s.trim()).filter(Boolean))]
  return {
    username: u,
    emp_id: payloadTextField(profile.employeeId),
    cid: payloadTextField(profile.cid),
    first_name,
    last_name,
    email: payloadTextField(profile.email),
    agency_code: '',
    ministry_code: '',
    agency_id: (mergedOrg.agency_id ?? '').trim(),
    department_id: (mergedOrg.department_id ?? '').trim(),
    division_id: (mergedOrg.division_id ?? '').trim(),
    sub_division_id: (mergedOrg.sub_division_id ?? '').trim(),
    designation: payloadTextField(profile.designation),
    contact_no: payloadTextField(profile.contact),
    ...(roles.length > 0 ? { roles } : {}),
  }
}

/** Body for POST `/admin/users/pending/:user_id/approve`; matches pending-registration user fields (+ optional `password` when supplied by the API). */
export type PendingUserApprovePayload = {
  action: 'approve'
  username: string
  emp_id: string
  cid: string
  first_name: string
  last_name: string
  email: string
  agency_code: string
  ministry_code: string
  department_id: string
  division_id: string
  sub_division_id: string
  designation: string
  contact_no: string
  roles: string[]
  password?: string
}

export type PendingUserRejectPayload = {
  action: "reject";
  reason: string;
};

/**
 * Builds the JSON body for approve/reject pending user from `GET /admin/users/:id` (merged envelope).
 */
export function buildPendingUserActionPayload(record: ApiRecord): PendingUserApprovePayload {
  const merged = mergeNestedUserEnvelope(record)
  const profile = apiRecordToFetchedPerson(merged)
  const username = payloadTextField(toText(merged.username) || toText(merged.user_name))
  if (!username) throw new Error('Username is required for this action')

  const fromDisplay = splitDisplayName(profile.name)
  const first_name =
    payloadTextField(profile.firstName ?? '') || fromDisplay.first_name
  const middle_for_last = payloadTextField(profile.middleName ?? '')
  const last_surname = payloadTextField(profile.lastName ?? '')
  const last_name =
    [middle_for_last, last_surname].filter(Boolean).join(' ').trim() || fromDisplay.last_name
  const roles = realmRoleNamesFromUserRecord(merged)
  const org = profile.persistedOrgIds
  const pw = payloadTextField(
    toText(merged.password) || toText(merged.user_password) || toText(merged.temporary_password),
  )

  const base: PendingUserApprovePayload = {
    action: 'approve',
    username,
    emp_id: payloadTextField(profile.employeeId),
    cid: payloadTextField(profile.cid),
    first_name,
    last_name,
    email: payloadTextField(profile.email),
    agency_code: payloadTextField(toText(merged.agency_code) || toText(merged.agencyCode)),
    ministry_code: payloadTextField(toText(merged.ministry_code) || toText(merged.ministryCode)),
    department_id: (org?.department_id ?? toText(merged.department_id ?? merged.departmentId)).trim(),
    division_id: (org?.division_id ?? toText(merged.division_id ?? merged.divisionId)).trim(),
    sub_division_id: (
      org?.sub_division_id ??
      toText(merged.sub_division_id ?? merged.subDivisionId ?? merged.subdivision_id)
    ).trim(),
    designation: payloadTextField(profile.designation),
    contact_no: payloadTextField(profile.contact),
    roles,
  }

  return pw ? { ...base, password: pw } : base
}

export function approvePendingUser(userId: string, body: PendingUserApprovePayload): Promise<unknown> {
  const id = userId.trim()
  if (!id) throw new Error('User id is required for approve')
  return apiPost<unknown, PendingUserApprovePayload>(
    `/admin/users/${encodeURIComponent(id)}/workflow-action`,
    body,
  );
}

export function rejectPendingUser(userId: string, body: PendingUserRejectPayload): Promise<unknown> {
  const id = userId.trim()
  if (!id) throw new Error('User id is required for reject')
  return apiPost<unknown, PendingUserRejectPayload>(
    `/admin/users/${encodeURIComponent(id)}/workflow-action`,
    body,
  );
}
