// Types and helpers for `/admin/roles` (list) and `/admin/roles/bulk` (create/update with sub-menu permissions).
import { apiGet } from '@/services/apiClient'
import type { MenuRecord } from '@/features/modules/lib/menus-api'
import { resolveActiveRealmRoleString } from '@/shared/lib/realm-role-mapping'

export type ApiRecord = Record<string, unknown>

export type RoleActions = {
  read: number
  create: number
  update: number
  delete: number
}

export type RolePermissionPayload = {
  sub_menu_id: string
  /** Flags for each action code (0/1). Supports CRUD and extended actions from the API. */
  actions: Record<string, number>
  resource_scope: string | null
}

export type RoleBulkBody = {
  role_name: string
  description: string
  permissions: RolePermissionPayload[]
}

export type FlatSubMenuRow = {
  sub_menu_id: string
  label: string
}

/** Main module (menu) → sub-modules with ids, for grouped permission tables. */
export type MenuPermissionGroup = {
  mainModule: string
  items: Array<{ sub_menu_id: string; subModule: string }>
}

export function groupMenusForPermissionMatrix(menus: MenuRecord[]): MenuPermissionGroup[] {
  const map = new Map<string, Array<{ sub_menu_id: string; subModule: string }>>()
  for (const m of menus) {
    const subs = m.sub_menus ?? []
    for (const s of subs) {
      const sid = (s.id ?? '').trim()
      if (!sid) continue
      const arr = map.get(m.name) ?? []
      arr.push({ sub_menu_id: sid, subModule: s.name })
      map.set(m.name, arr)
    }
  }
  return [...map.entries()]
    .map(([mainModule, items]) => ({
      mainModule,
      items: items.sort((a, b) => a.subModule.localeCompare(b.subModule)),
    }))
    .sort((a, b) => a.mainModule.localeCompare(b.mainModule))
}

/** Flat rows in group order (matches {@link groupMenusForPermissionMatrix} traversal). */
export function flatSubMenusFromGroups(groups: MenuPermissionGroup[]): FlatSubMenuRow[] {
  const out: FlatSubMenuRow[] = []
  for (const g of groups) {
    for (const item of g.items) {
      out.push({
        sub_menu_id: item.sub_menu_id,
        label: `${g.mainModule} › ${item.subModule}`,
      })
    }
  }
  return out
}

export type RoleListRow = {
  serialNo: number
  roleName: string
  description: string
}

function toText(value: unknown) {
  return typeof value === 'string' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

export function toId(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string' && value.trim()) return value.trim()
  return ''
}

/** Realm role string for `/admin/roles/{role}/permissions` (honors `fms-role` / coarse mapping). */
export function resolvePrimaryRealmRole(user: Record<string, unknown> | null): string | null {
  return resolveActiveRealmRoleString(user)
}

export function rolesToArray(payload: unknown): ApiRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is ApiRecord => !!item && typeof item === 'object')
  }
  if (!payload || typeof payload !== 'object') return []
  const root = payload as Record<string, unknown>
  const dataObj = root.data as Record<string, unknown> | undefined
  const candidates = [
    root.data,
    root.roles,
    root.items,
    root.results,
    dataObj?.roles,
    dataObj?.items,
    dataObj?.results,
  ]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is ApiRecord => !!item && typeof item === 'object')
    }
  }
  return []
}

function unwrapRecord(payload: unknown): ApiRecord | null {
  if (!payload || typeof payload !== 'object') return null
  const root = payload as ApiRecord
  const data = root.data
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const inner = data as ApiRecord
    const innerRoleStr = typeof inner.role === 'string' ? inner.role.trim() : ''
    if (inner.role_name || inner.roleName || inner.permissions || innerRoleStr) return inner
    const nested = inner.role ?? inner.role_detail
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) return nested as ApiRecord
  }
  const rootRoleStr = typeof root.role === 'string' ? root.role.trim() : ''
  if (root.role_name || root.roleName || root.permissions || rootRoleStr) return root
  return root
}

export function mapRoleListRecord(record: ApiRecord): { roleName: string; description: string } {
  const roleName =
    toText(record.role_name) ||
    toText(record.roleName) ||
    toText(record.name) ||
    toText(record.keycloak_role) ||
    '-'
  const description = toText(record.description) || '-'
  return { roleName, description }
}

export function normalizeAction(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value === 0 ? 0 : 1
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'string') {
    const t = value.trim().toLowerCase()
    if (t === '1' || t === 'true' || t === 'yes') return 1
  }
  return 0
}

export function normalizeActionCode(value: string): string {
  return value.trim().toLowerCase()
}

function stringArrayFromField(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((s) => normalizeActionCode(s))
    .filter(Boolean)
}

/**
 * GET `/admin/roles/{role}/permissions` may return `{ data: [ { menu_id, menu_name, sub_menus: [ { sub_menu_id, available_actions, assigned_actions } ] } ] }`.
 */
function parseNestedMenuPermissions(payload: unknown): {
  availableBySubMenu: Map<string, string[]>
  assignedBySubMenu: Map<string, string[]>
} | null {
  if (!payload || typeof payload !== 'object') return null
  const root = payload as ApiRecord
  const data = root.data
  if (!Array.isArray(data) || data.length === 0) return null

  let sawPermShape = false
  for (const menu of data as ApiRecord[]) {
    const subList = menu.sub_menus ?? menu.subMenus
    if (!Array.isArray(subList)) continue
    for (const sub of subList) {
      if (!sub || typeof sub !== 'object') continue
      const r = sub as ApiRecord
      if (
        Array.isArray(r.available_actions) ||
        Array.isArray(r.availableActions) ||
        Array.isArray(r.assigned_actions) ||
        Array.isArray(r.assignedActions)
      ) {
        sawPermShape = true
        break
      }
    }
    if (sawPermShape) break
  }
  if (!sawPermShape) return null

  const availableBySubMenu = new Map<string, string[]>()
  const assignedBySubMenu = new Map<string, string[]>()

  for (const menu of data as ApiRecord[]) {
    const subList = menu.sub_menus ?? menu.subMenus
    if (!Array.isArray(subList)) continue
    for (const sub of subList) {
      if (!sub || typeof sub !== 'object') continue
      const r = sub as ApiRecord
      const sid = toId(r.sub_menu_id ?? r.subMenuId ?? r.id ?? r.sub_menuId)
      if (!sid) continue
      const avail = stringArrayFromField(r.available_actions ?? r.availableActions)
      const assign = stringArrayFromField(r.assigned_actions ?? r.assignedActions)
      if (avail.length > 0) availableBySubMenu.set(sid, avail)
      assignedBySubMenu.set(sid, assign)
    }
  }

  return { availableBySubMenu, assignedBySubMenu }
}

export function roleActionsFromAssignedCodes(assigned: Iterable<string>): RoleActions {
  const set = new Set([...assigned].map(normalizeActionCode))
  return {
    read: set.has('read') ? 1 : 0,
    create: set.has('create') ? 1 : 0,
    /** Some APIs use `edit` instead of `update`. */
    update: set.has('update') || set.has('edit') ? 1 : 0,
    delete: set.has('delete') ? 1 : 0,
  }
}

export function assignedSetFromRoleActions(a: RoleActions): Set<string> {
  const s = new Set<string>()
  if (a.read) s.add('read')
  if (a.create) s.add('create')
  if (a.update) s.add('update')
  if (a.delete) s.add('delete')
  return s
}

function actionsFromUnknown(actions: unknown): RoleActions {
  if (!actions || typeof actions !== 'object') {
    return { read: 0, create: 0, update: 0, delete: 0 }
  }
  const a = actions as ApiRecord
  const rawUpdate = normalizeAction(a.update) || normalizeAction(a.edit)
  return {
    read: normalizeAction(a.read),
    create: normalizeAction(a.create),
    update: rawUpdate,
    delete: normalizeAction(a.delete),
  }
}

function permissionsArrayFromRecord(record: ApiRecord): ApiRecord[] {
  const candidates = [record.permissions, record.permission_list, record.sub_menu_permissions]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is ApiRecord => !!item && typeof item === 'object')
    }
  }
  return []
}

export function permissionsArrayFromPayload(payload: unknown): ApiRecord[] {
  const record = unwrapRecord(payload)
  if (!record) return []
  return permissionsArrayFromRecord(record)
}

export function permissionsMapFromArray(rows: ApiRecord[]): Map<string, RoleActions> {
  const map = new Map<string, RoleActions>()
  for (const row of rows) {
    const sid = toId(row.sub_menu_id ?? row.subMenuId ?? row.submenu_id)
    if (!sid) continue
    map.set(sid, actionsFromUnknown(row.actions))
  }
  return map
}

export type ParsedRoleDetail = {
  role_name: string
  description: string
  permissionsBySubMenu: Map<string, RoleActions>
  /** Lowercased action codes from API per sub-menu; empty sub-menu omitted. */
  availableActionsBySubMenu: Map<string, string[]>
  assignedActionsBySubMenu: Map<string, string[]>
}

export function parseRoleDetailPayload(payload: unknown, fallbackRoleName: string): ParsedRoleDetail | null {
  const nested = parseNestedMenuPermissions(payload)
  const record = unwrapRecord(payload)
  if (!record && !nested) return null

  const roleField = record?.role
  const role_name = record
    ? toText(record.role_name) ||
      toText(record.roleName) ||
      (typeof roleField === 'string' && roleField.trim() ? roleField.trim() : '') ||
      (roleField && typeof roleField === 'object' && !Array.isArray(roleField)
        ? toText((roleField as ApiRecord).role_name) ||
          toText((roleField as ApiRecord).roleName) ||
          toText((roleField as ApiRecord).name)
        : '') ||
      toText(record.name) ||
      fallbackRoleName
    : fallbackRoleName
  const description = record ? toText(record.description) : ''

  const permissionsBySubMenu = record ? permissionsMapFromArray(permissionsArrayFromRecord(record)) : new Map()
  const availableActionsBySubMenu = nested?.availableBySubMenu ?? new Map()
  const assignedActionsBySubMenu = nested?.assignedBySubMenu ?? new Map()

  if (nested) {
    for (const [sid, assign] of assignedActionsBySubMenu) {
      permissionsBySubMenu.set(sid, roleActionsFromAssignedCodes(assign))
    }
  }

  return {
    role_name,
    description,
    permissionsBySubMenu,
    availableActionsBySubMenu,
    assignedActionsBySubMenu,
  }
}

/** Sub-menus that have an id — required for permission rows. */
export function flattenSubMenusForRoleMatrix(menus: MenuRecord[]): FlatSubMenuRow[] {
  const out: FlatSubMenuRow[] = []
  for (const m of menus) {
    const subs = m.sub_menus ?? []
    for (const s of subs) {
      const sid = (s.id ?? '').trim()
      if (!sid) continue
      out.push({
        sub_menu_id: sid,
        label: `${m.name} › ${s.name}`,
      })
    }
  }
  return out.sort((a, b) => a.label.localeCompare(b.label))
}

export function defaultActions(): RoleActions {
  return { read: 0, create: 0, update: 0, delete: 0 }
}

/** When API does not list `available_actions`, bulk payload uses CRUD codes only. */
export const DEFAULT_ACTION_CODES_FOR_BULK = ['read', 'create', 'update', 'delete'] as const

export function resolveAvailableActionsForSubMenu(
  subMenuId: string,
  availableBySubMenu: Map<string, string[]>,
  assignedCodes: Iterable<string>,
): string[] {
  const fromApi = availableBySubMenu.get(subMenuId)
  const base =
    fromApi && fromApi.length > 0 ? [...fromApi] : [...DEFAULT_ACTION_CODES_FOR_BULK]
  const seen = new Set(base.map(normalizeActionCode))
  const out = [...base]
  for (const a of assignedCodes) {
    const k = normalizeActionCode(a)
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(k)
  }
  return out
}

/** Column order: read → create → update → delete first, then other codes in first-seen order (for matrix tables). */
export function collectMatrixColumnCodes(
  groups: MenuPermissionGroup[],
  availableBySubMenu: Map<string, string[]>,
): string[] {
  const ordered: string[] = []
  const seen = new Set<string>()
  const push = (code: string) => {
    const k = normalizeActionCode(code)
    if (!k || seen.has(k)) return
    seen.add(k)
    ordered.push(k)
  }
  for (const g of groups) {
    for (const item of g.items) {
      const list = resolveAvailableActionsForSubMenu(item.sub_menu_id, availableBySubMenu, [])
      for (const c of list) push(c)
    }
  }
  const crud = (['read', 'create', 'update', 'delete'] as const).filter((c) => seen.has(c))
  const extras = ordered.filter((c) => !['read', 'create', 'update', 'delete'].includes(c))
  return [...crud, ...extras]
}

function actionsRecordForBulk(available: string[], assigned: Set<string>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const code of available) {
    const k = normalizeActionCode(code)
    if (!k) continue
    out[k] = assigned.has(k) ? 1 : 0
  }
  return out
}

export function buildBulkPayload(
  role_name: string,
  description: string,
  flatSubs: FlatSubMenuRow[],
  assignedBySubMenu: Map<string, Set<string>>,
  availableBySubMenu?: Map<string, string[]>,
): RoleBulkBody {
  const permissions: RolePermissionPayload[] = flatSubs.map((row) => {
    const assigned = assignedBySubMenu.get(row.sub_menu_id) ?? new Set<string>()
    const fromApi = availableBySubMenu?.get(row.sub_menu_id)
    const available =
      fromApi && fromApi.length > 0 ? fromApi : [...DEFAULT_ACTION_CODES_FOR_BULK]
    return {
      sub_menu_id: row.sub_menu_id,
      actions: actionsRecordForBulk(available, assigned),
      resource_scope: null,
    }
  })
  return {
    role_name: role_name.trim(),
    description: description.trim(),
    permissions,
  }
}

function detailFromListRecord(match: ApiRecord, fallbackRoleName: string): ParsedRoleDetail {
  const { roleName, description } = mapRoleListRecord(match)
  const desc = description === '-' ? '' : description
  const parsed = parseRoleDetailPayload(match, fallbackRoleName)
  if (parsed && parsed.permissionsBySubMenu.size > 0) {
    return {
      role_name: roleName !== '-' ? roleName : parsed.role_name,
      description: parsed.description.trim() || desc,
      permissionsBySubMenu: parsed.permissionsBySubMenu,
      availableActionsBySubMenu: parsed.availableActionsBySubMenu,
      assignedActionsBySubMenu: parsed.assignedActionsBySubMenu,
    }
  }
  return {
    role_name: roleName !== '-' ? roleName : fallbackRoleName,
    description: desc,
    permissionsBySubMenu: new Map(),
    availableActionsBySubMenu: new Map(),
    assignedActionsBySubMenu: new Map(),
  }
}

/**
 * Loads sub-menu permission flags from GET `/admin/roles/{role}/permissions` only.
 * Does not call GET `/admin/roles/{role}` (single-role by name). Description may come from that response,
 * the roles list match, or be empty.
 */
export async function fetchRoleDetail(roleName: string): Promise<ParsedRoleDetail> {
  try {
    const permPayload = await apiGet<unknown>(
      `/admin/roles/${encodeURIComponent(roleName)}/permissions`,
    )
    const fromPermissions = parseRoleDetailPayload(permPayload, roleName)
    if (fromPermissions) {
      const resolved = fromPermissions.role_name || roleName
      return { ...fromPermissions, role_name: resolved }
    }
  } catch {
    /* fall through */
  }

  const searchPayload = await apiGet<unknown>(
    `/admin/roles?page_size=200&search=${encodeURIComponent(roleName)}`,
  )
  const records = rolesToArray(searchPayload)
  const match = records.find((r) => {
    const rn = mapRoleListRecord(r).roleName
    return rn === roleName || rn.toLowerCase() === roleName.toLowerCase()
  })
  if (!match) throw new Error('Role not found')

  const resolvedName = mapRoleListRecord(match).roleName
  try {
    const permPayload = await apiGet<unknown>(
      `/admin/roles/${encodeURIComponent(resolvedName)}/permissions`,
    )
    const fromPermissions = parseRoleDetailPayload(permPayload, resolvedName)
    if (fromPermissions) {
      const { description: listDescRaw } = mapRoleListRecord(match)
      const listDesc = listDescRaw === '-' ? '' : listDescRaw
      const mergedDesc = fromPermissions.description.trim() || listDesc
      return {
        ...fromPermissions,
        role_name: fromPermissions.role_name || resolvedName,
        description: mergedDesc,
      }
    }
  } catch {
    /* use list row only */
  }

  return detailFromListRecord(match, roleName)
}
