/**
 * Helpers and types for admin user flows: list/detail (`/admin/users`),
 * directory lookup (`/public/employees/{id}|{cid}`, `/admin/citizens/{cid}`),
 * role options, and create-payload builders. Normalizes heterogeneous API shapes.
 */
import { apiGet, apiPost } from '@/services/apiClient'
import type { AdminGroupNode, DirectoryOrganogramHints } from '@/features/user/lib/groups-api'
import { mapRoleListRecord, rolesToArray, type ApiRecord } from '@/features/user/lib/roles-api'

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
  const last = toText(r.last_name) || toText(r.lastName)
  if (first || last) return [first, last].filter(Boolean).join(' ').trim()
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
  return (
    toText(r.cid) ||
    toText(r.citizen_id) ||
    toText(r.citizenId) ||
    toText(r.cid_no) ||
    toText(r.cidNumber) ||
    toText(r.cid_number) ||
    ''
  )
}

/** When the API returns only a display `name`, split it once for separate first/last form fields. */
function splitFullNameForPerson(display: string): { first: string; last: string } {
  const t = display.trim()
  if (!t || t === '-') return { first: '', last: '' }
  const i = t.indexOf(' ')
  if (i === -1) return { first: t, last: '' }
  return { first: t.slice(0, i).trim(), last: t.slice(i + 1).trim() }
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
  const lastNameRaw = toText(r.last_name) || toText(r.lastName)
  const displayName = pickName(r) || '-'
  let firstName = firstNameRaw || undefined
  let lastName = lastNameRaw || undefined
  if (!firstName && !lastName && displayName !== '-') {
    const sp = splitFullNameForPerson(displayName)
    if (sp.first) firstName = sp.first
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

/** Tier labels from `groups`: index 0 agency … 3 sub division (API convention). */
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

function cleanStoredGroupId(value: unknown): string {
  const s = toText(value).trim()
  if (!s || s === '0') return ''
  return s
}

/** Resolves tier UUIDs from a saved user row: top-level ids first, else `groups[0..3]` id fields. */
function pickOrganogramTierIds(record: ApiRecord): {
  agencyId: string
  departmentId: string
  divisionId: string
  subDivisionId: string
} {
  const m = mergeNestedUserEnvelope(record)
  const fromFlat = {
    agencyId: cleanStoredGroupId(m.agency_id ?? m.agencyId),
    departmentId: cleanStoredGroupId(m.department_id ?? m.departmentId),
    divisionId: cleanStoredGroupId(m.division_id ?? m.divisionId),
    subDivisionId: cleanStoredGroupId(m.sub_division_id ?? m.subDivisionId ?? m.subdivision_id),
  }
  if (
    fromFlat.agencyId ||
    fromFlat.departmentId ||
    fromFlat.divisionId ||
    fromFlat.subDivisionId
  ) {
    return fromFlat
  }
  const g = m.groups
  if (!Array.isArray(g)) {
    return { agencyId: '', departmentId: '', divisionId: '', subDivisionId: '' }
  }
  const entryId = (item: unknown): string => {
    if (typeof item === 'string') return cleanStoredGroupId(item)
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const o = item as ApiRecord
      return cleanStoredGroupId(o.id ?? o.group_id ?? o.uuid ?? o.groupId)
    }
    return ''
  }
  return {
    agencyId: entryId(g[0]),
    departmentId: entryId(g[1]),
    divisionId: entryId(g[2]),
    subDivisionId: entryId(g[3]),
  }
}

function resolveOrganogramNamesFromNodes(
  r: ApiRecord,
  nodes: AdminGroupNode[],
  fromGroups: { agency: string; department: string; division: string; subDivision: string },
): { agency: string; department: string; division: string; subDivision: string } {
  const nameById = new Map(nodes.map((n) => [n.id, n.name]))
  const ids = pickOrganogramTierIds(r)
  const one = (id: string, fallback: string) => {
    if (id) {
      const name = nameById.get(id)
      if (name) return name
      return fallback.trim() || id
    }
    return fallback.trim()
  }
  return {
    agency: one(ids.agencyId, fromGroups.agency),
    department: one(ids.departmentId, fromGroups.department),
    division: one(ids.divisionId, fromGroups.division),
    subDivision: one(ids.subDivisionId, fromGroups.subDivision),
  }
}

/** Projects a user API record into flat strings for read-only cards (detail page). */
export function mapUserDetailFields(
  r: ApiRecord,
  options?: { groupNodes?: AdminGroupNode[] },
) {
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
  const fromGroups = organogramLabelsFromGroups(r)
  const { agency, department, division, subDivision } =
    options?.groupNodes && options.groupNodes.length > 0
      ? resolveOrganogramNamesFromNodes(r, options.groupNodes, fromGroups)
      : fromGroups

  let rolesLabel = '-'
  if (Array.isArray(r.realm_roles) && r.realm_roles.length > 0) {
    rolesLabel = r.realm_roles.map((x) => (typeof x === 'string' ? x : toText((x as ApiRecord).name))).join(', ')
  } else if (Array.isArray(r.roles) && r.roles.length > 0) {
    rolesLabel = r.roles
      .map((x) => {
        if (typeof x === 'string') return x
        if (x && typeof x === 'object') return toText((x as ApiRecord).name) || toText((x as ApiRecord).role_name)
        return ''
      })
      .filter(Boolean)
      .join(', ')
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
  const last_name = payloadTextField(profile.lastName ?? '') || fromDisplay.last_name
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

export type PendingUserRejectPayload = PendingUserApprovePayload & {
  reason: string
}

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
  const last_name = payloadTextField(profile.lastName ?? '') || fromDisplay.last_name
  const roles = realmRoleNamesFromUserRecord(merged)
  const org = profile.persistedOrgIds
  const pw = payloadTextField(
    toText(merged.password) || toText(merged.user_password) || toText(merged.temporary_password),
  )

  const base: PendingUserApprovePayload = {
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
    `/admin/users/pending/${encodeURIComponent(id)}/approve`,
    body,
  )
}

export function rejectPendingUser(userId: string, body: PendingUserRejectPayload): Promise<unknown> {
  const id = userId.trim()
  if (!id) throw new Error('User id is required for reject')
  return apiPost<unknown, PendingUserRejectPayload>(
    `/admin/users/pending/${encodeURIComponent(id)}/reject`,
    body,
  )
}
