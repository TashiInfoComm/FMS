import type { AgencyHierarchyTab } from '@/shared/lib/agency-sub-menu-id'
import { apiClient, apiGet } from '@/services/apiClient'

export type ApiRecord = Record<string, unknown>
export type HierarchyTableRow = Record<string, string | number | boolean>
export type HierarchyFormValues = Record<string, string>

export type HierarchyFieldConfig = {
  key: string
  label: string
  type: 'text' | 'textarea'
  placeholder?: string
}

export type HierarchyParentField = 'agency_id' | 'department_id' | 'division_id'

export function emptyHierarchyFormValues(fields: HierarchyFieldConfig[]): HierarchyFormValues {
  return Object.fromEntries(fields.map((field) => [field.key, '']))
}

export function toText(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export function toId(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return ''
}

export function toObject(value: unknown): ApiRecord | undefined {
  return value && typeof value === 'object' ? (value as ApiRecord) : undefined
}

export function readName(source: unknown) {
  const obj = toObject(source)
  if (!obj) return '-'
  const name = toText(obj.name).trim()
  if (name) return name
  const label = toText(obj.label).trim()
  if (label) return label
  return '-'
}

export function readId(source: unknown) {
  const obj = toObject(source)
  if (!obj) return ''
  return toId(obj.id)
}

export function extractHierarchyList(payload: unknown): ApiRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is ApiRecord => !!item && typeof item === 'object')
  }
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

export function agencyListPath(search: string, page: number, pageSize: number) {
  const q = encodeURIComponent(search.trim())
  return `/master/agencies?page=${page}&page_size=${pageSize}&search=${q}`
}

export function departmentListPath(
  agencyCode: string,
  search: string,
  page: number,
  pageSize: number,
) {
  const q = encodeURIComponent(search.trim())
  return `/master/agencies/${encodeURIComponent(agencyCode)}/departments?page=${page}&page_size=${pageSize}&search=${q}`
}

export function divisionListPath(
  departmentCode: string,
  search: string,
  page: number,
  pageSize: number,
) {
  const q = encodeURIComponent(search.trim())
  return `/master/departments/${encodeURIComponent(departmentCode)}/divisions?page=${page}&page_size=${pageSize}&search=${q}`
}

export function subDivisionListPath(
  divisionCode: string,
  search: string,
  page: number,
  pageSize: number,
) {
  const q = encodeURIComponent(search.trim())
  return `/master/divisions/${encodeURIComponent(divisionCode)}/sub-divisions?page=${page}&page_size=${pageSize}&search=${q}`
}

export function hierarchyBasePath(tab: AgencyHierarchyTab) {
  if (tab === 'Agency') return '/master/agencies'
  if (tab === 'Department') return '/master/departments'
  if (tab === 'Division') return '/master/divisions'
  return '/master/sub-divisions'
}

export function mapAgencyRows(records: ApiRecord[], serialStart: number): HierarchyTableRow[] {
  return records.map((item, index) => {
    const serialNo = serialStart + index + 1
    const id = toId(item.id) || String(index + 1)
    const code = toText(item.code)
    const name = toText(item.name)
    const description = toText(item.description)
    const active = typeof item.active === 'boolean' ? item.active : item.active === 1 || item.active === '1'

    return {
      serialNo,
      id,
      code,
      name,
      agencyName: name || '-',
      shortName: code || '-',
      description: description || '-',
      active,
    }
  })
}

export function mapDepartmentRows(records: ApiRecord[], serialStart: number): HierarchyTableRow[] {
  return records.map((item, index) => {
    const serialNo = serialStart + index + 1
    const id = toId(item.id) || String(index + 1)
    const code = toText(item.code)
    const name = toText(item.name)
    const description = toText(item.description)
    const active = typeof item.active === 'boolean' ? item.active : item.active === 1 || item.active === '1'

    return {
      serialNo,
      id,
      code,
      name,
      departmentName: name || '-',
      displayCode: code || '-',
      description: description || '-',
      active,
    }
  })
}

export function mapDivisionRows(records: ApiRecord[], serialStart: number): HierarchyTableRow[] {
  return records.map((item, index) => {
    const serialNo = serialStart + index + 1
    const id = toId(item.id) || String(index + 1)
    const code = toText(item.code)
    const name = toText(item.name)
    const description = toText(item.description)
    const active = typeof item.active === 'boolean' ? item.active : item.active === 1 || item.active === '1'

    return {
      serialNo,
      id,
      code,
      name,
      division: name || '-',
      displayCode: code || '-',
      description: description || '-',
      active,
    }
  })
}

export function mapSubDivisionRows(records: ApiRecord[], serialStart: number): HierarchyTableRow[] {
  return records.map((item, index) => {
    const serialNo = serialStart + index + 1
    const id = toId(item.id) || String(index + 1)
    const code = toText(item.code)
    const name = toText(item.name)
    const description = toText(item.description)
    const active = typeof item.active === 'boolean' ? item.active : item.active === 1 || item.active === '1'

    return {
      serialNo,
      id,
      code,
      name,
      subDivision: name || '-',
      displayCode: code || '-',
      description: description || '-',
      active,
    }
  })
}

export function buildHierarchyPayload(
  form: HierarchyFormValues,
  parentField?: HierarchyParentField,
  parentId?: string,
) {
  const payload: Record<string, string | number | boolean> = {
    code: form.code.trim(),
    name: form.name.trim(),
    description: form.description.trim(),
    display_order: 1,
    active: true,
  }

  if (parentField && parentId?.trim()) {
    payload[parentField] = parentId.trim()
  }

  return payload
}

export function buildHierarchyStatusPayload(
  row: HierarchyTableRow,
  active: boolean,
  parentField?: HierarchyParentField,
  parentId?: string,
) {
  const payload: Record<string, string | number | boolean> = {
    code: toText(row.code).trim(),
    name: toText(row.name).trim(),
    description: toText(row.description === '-' ? '' : row.description).trim(),
    display_order: 1,
    active,
  }

  if (parentField && parentId?.trim()) {
    payload[parentField] = parentId.trim()
  }

  return payload
}

export type HierarchyEntitySummary = {
  id: string
  code: string
  name: string
}

export type DepartmentEntitySummary = HierarchyEntitySummary & {
  agencyId?: string
  agencyName?: string
  agencyCode?: string
}

export type DivisionEntitySummary = HierarchyEntitySummary & {
  departmentId?: string
  departmentName?: string
  departmentCode?: string
  agencyId?: string
  agencyName?: string
  agencyCode?: string
}

function unwrapHierarchyRecord(payload: unknown): ApiRecord | null {
  if (!payload || typeof payload !== 'object') return null
  const root = payload as ApiRecord
  const data =
    root.data && typeof root.data === 'object' && !Array.isArray(root.data)
      ? (root.data as ApiRecord)
      : null

  const candidates = [data, root]
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue
    const id = toId(candidate.id) || toText(candidate.code)
    if (id) return candidate
  }

  return data ?? root
}

function readNestedAgency(record: ApiRecord) {
  const agencyObj = toObject(record.agency) ?? toObject(record.parent_agency)
  return {
    agencyId: toId(record.agency_id) || readId(agencyObj),
    agencyName: toText(record.agency_name) || readName(agencyObj),
    agencyCode: toText(record.agency_code) || toText(agencyObj?.code),
  }
}

function readNestedDepartment(record: ApiRecord) {
  const departmentObj =
    toObject(record.department) ?? toObject(record.parent_department)
  return {
    departmentId: toId(record.department_id) || readId(departmentObj),
    departmentName: toText(record.department_name) || readName(departmentObj),
    departmentCode: toText(record.department_code) || toText(departmentObj?.code),
  }
}
function mapHierarchyEntitySummary(record: ApiRecord | null): HierarchyEntitySummary | null {
  if (!record) return null
  const id = toId(record.id)
  const code = toText(record.code)
  const name = toText(record.name)
  if (!id && !code) return null
  return {
    id: id || code,
    code: code || id,
    name: name || code || id,
  }
}

export async function fetchAgencyByCode(code: string): Promise<HierarchyEntitySummary | null> {
  const trimmed = code.trim()
  if (!trimmed) return null
  const payload = await apiGet<unknown>(`/master/agencies/${encodeURIComponent(trimmed)}`)
  return mapHierarchyEntitySummary(unwrapHierarchyRecord(payload))
}

export async function fetchDepartmentByCode(
  code: string,
): Promise<DepartmentEntitySummary | null> {
  const trimmed = code.trim()
  if (!trimmed) return null
  const payload = await apiGet<unknown>(`/master/departments/${encodeURIComponent(trimmed)}`)
  const record = unwrapHierarchyRecord(payload)
  const base = mapHierarchyEntitySummary(record)
  if (!base) return null
  return { ...base, ...readNestedAgency(record ?? {}) }
}

export async function fetchDivisionByCode(code: string): Promise<DivisionEntitySummary | null> {
  const trimmed = code.trim()
  if (!trimmed) return null
  const payload = await apiGet<unknown>(`/master/divisions/${encodeURIComponent(trimmed)}`)
  const record = unwrapHierarchyRecord(payload)
  const base = mapHierarchyEntitySummary(record)
  if (!base) return null
  const department = readNestedDepartment(record ?? {})
  const agency = readNestedAgency(record ?? {})
  return { ...base, ...department, ...agency }
}

export async function syncAgencyHierarchy(): Promise<unknown> {
  return apiClient<unknown>('/master/sync/agency-hierarchy', { method: 'POST' })
}
