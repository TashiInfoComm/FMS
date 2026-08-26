// Types and helpers for `/admin/menus` (super-admin module CRUD: list, bulk create, update by id).
// Signed-in sidebar uses GET `/admin/me/menu` + GET `/admin/roles/{role}/permissions` — see `fetchUserSidebarMenus`.
import { fetchRolePermissionsRawCached, roleActionsFromAssignedCodes } from '@/features/user/lib/roles-api'
import { apiGet } from '@/services/apiClient'
import { MENU_ITEMS } from '@/shared/constants/access-control'

export type ApiRecord = Record<string, unknown>

/** CRUD flags (0/1) from menu/sub-menu `actions` or GET `/admin/roles/{role}/permissions` `assigned_actions`. */
export type SubMenuRoleActions = {
  read: number
  create: number
  update: number
  delete: number
  export?: number
}

export type MenuSubRow = {
  id?: string
  name: string
  route: string
  permission_code?: string
  display_order: number
  /** Present when the API nests permission flags on each sub-menu (`actions` object). */
  actions?: SubMenuRoleActions
}

export type MenuRecord = {
  id: string
  name: string
  icon: string
  icon_color: string
  display_order: number
  /** Top-level link when the API has no `sub_menus` (sidebar renders a single link). */
  direct_route?: string
  /** When the main menu row carries `actions` for a single direct link. */
  direct_route_actions?: SubMenuRoleActions
  sub_menus?: MenuSubRow[]
}

/**
 * Normalize list payloads whether the API returns a bare array or wraps rows.
 * Supports envelopes like `{ success, message, data: Menu[] }` and sub-links under `items`
 * (see `/admin/me/menu`, `/admin/menus`, `/admin/roles/{role}/permissions`).
 */
const MENU_LIST_KEYS = [
  'menus',
  'menu',
  'items',
  'results',
  'permissions',
  'permission_list',
  'sub_menu_permissions',
  'role_permissions',
  'modules',
  'sub_modules',
  'subMenus',
  'data',
] as const

function arrayFromRecordByKeys(obj: Record<string, unknown>): ApiRecord[] | undefined {
  let fallbackEmpty: ApiRecord[] | undefined
  for (const key of MENU_LIST_KEYS) {
    const candidate = obj[key]
    if (!Array.isArray(candidate)) continue
    const rows = candidate.filter((item): item is ApiRecord => !!item && typeof item === 'object')
    if (rows.length > 0) return rows
    fallbackEmpty = rows
  }
  return fallbackEmpty
}

export function menusToArray(payload: unknown): ApiRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is ApiRecord => !!item && typeof item === 'object')
  }
  if (!payload || typeof payload !== 'object') return []
  const root = payload as Record<string, unknown>
  const dataObj = root.data as Record<string, unknown> | undefined
  // Prefer `data` first so `{ items: [], data: [...] }` does not yield an empty list.
  const candidates = [
    root.data,
    root.menus,
    root.menu,
    root.items,
    root.results,
    dataObj?.menus,
    dataObj?.items,
    dataObj?.results,
    dataObj?.permissions,
    dataObj?.permission_list,
  ]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is ApiRecord => !!item && typeof item === 'object')
    }
  }
  if (dataObj && typeof dataObj === 'object' && !Array.isArray(dataObj)) {
    const nested = arrayFromRecordByKeys(dataObj)
    if (nested && nested.length > 0) return nested
  }
  const fromRoot = arrayFromRecordByKeys(root)
  if (fromRoot && fromRoot.length > 0) return fromRoot

  return []
}

/** Sub-menus may be under `sub_menus`, `children`, or `items`. Prefer first non-empty array. */
function pickSubMenusRaw(record: ApiRecord): unknown[] | undefined {
  const candidates = [
    record.sub_menus,
    record.subMenus,
    record.sub_modules,
    record.subModules,
    record.children,
    record.items,
  ]
  const nonEmpty = candidates.find((c) => Array.isArray(c) && c.length > 0)
  if (nonEmpty) return nonEmpty as unknown[]
  const anyArr = candidates.find((c) => Array.isArray(c))
  return anyArr as unknown[] | undefined
}

function toText(value: unknown) {
  return typeof value === 'string' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

export function toId(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string' && value.trim()) return value.trim()
  return ''
}

function subRowRoute(sub: ApiRecord): string {
  return (
    toText(sub.route) ||
    toText(sub.path) ||
    toText(sub.href) ||
    toText(sub.url) ||
    toText(sub.link) ||
    toText(sub.uri) ||
    toText(sub.page_path) ||
    toText(sub.pagePath) ||
    toText(sub.frontend_route) ||
    toText(sub.frontendRoute) ||
    toText(sub.sub_module_route) ||
    toText(sub.subModuleRoute) ||
    toText(sub.navigation_path) ||
    toText(sub.navigationPath) ||
    ''
  )
}

function normalizeActionFlag(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value === 0 ? 0 : 1
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'string') {
    const t = value.trim().toLowerCase()
    if (t === '1' || t === 'true' || t === 'yes') return 1
  }
  return 0
}

function assignedActionCodes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is string => typeof item === 'string')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

/** `assigned_actions` may be string[] or a CRUD object (same shape as `actions`). */
function roleActionsFromAssignedField(raw: unknown): SubMenuRoleActions | undefined {
  if (raw === undefined || raw === null) return undefined
  if (Array.isArray(raw)) {
    const codes = assignedActionCodes(raw)
    const crud = roleActionsFromAssignedCodes(codes)
    return {
      ...crud,
      export: codes.includes('export') ? 1 : 0,
    }
  }
  if (typeof raw === 'object') return parseSubMenuActions(raw)
  return undefined
}

function looksLikeFlatPermissionRows(rows: ApiRecord[]): boolean {
  if (rows.length < 1) return false
  for (const r of rows) {
    const subs = pickSubMenusRaw(r)
    if (subs && subs.length > 0) return false
  }
  let subIds = 0
  let menuIds = 0
  for (const r of rows) {
    if (toId(r.sub_menu_id ?? r.subMenuId ?? r.submenu_id)) subIds++
    if (toId(r.menu_id ?? r.menuId ?? r.main_menu_id ?? r.module_id ?? r.moduleId)) menuIds++
  }
  return subIds > 0 && menuIds > 0
}

function groupFlatPermissionRowsIntoMenus(rows: ApiRecord[]): ApiRecord[] {
  const byMenu = new Map<string, ApiRecord[]>()
  for (const r of rows) {
    const mid = toId(r.menu_id ?? r.menuId ?? r.main_menu_id ?? r.module_id ?? r.moduleId)
    if (!mid) continue
    const arr = byMenu.get(mid) ?? []
    arr.push(r)
    byMenu.set(mid, arr)
  }
  const out: ApiRecord[] = []
  for (const [mid, subsRaw] of byMenu) {
    const seen = new Set<string>()
    const subs = subsRaw.filter((s) => {
      const sid = toId(s.sub_menu_id ?? s.subMenuId ?? s.submenu_id)
      if (!sid || seen.has(sid)) return false
      seen.add(sid)
      return true
    })
    if (subs.length === 0) continue
    const menuOrder = subs.map((s) =>
      typeof s.display_order === 'number' && Number.isFinite(s.display_order)
        ? s.display_order
        : Number.parseInt(String(s.menu_display_order ?? s.displayOrder ?? 0), 10) || 0,
    )
    const display_order = menuOrder.length > 0 ? Math.min(...menuOrder) : 0
    out.push({
      menu_id: mid,
      menu_name:
        toText(
          subs[0]?.menu_name ??
            subs[0]?.menuName ??
            subs[0]?.main_module_name ??
            subs[0]?.module_name,
        ) || '-',
      icon: subs[0]?.icon ?? subs[0]?.menu_icon,
      icon_color: subs[0]?.icon_color ?? subs[0]?.iconColor,
      display_order,
      sub_menus: subs,
    })
  }
  return out.sort((a, b) => {
    const da =
      typeof a.display_order === 'number' && Number.isFinite(a.display_order)
        ? a.display_order
        : Number.parseInt(String(a.display_order ?? 0), 10) || 0
    const db =
      typeof b.display_order === 'number' && Number.isFinite(b.display_order)
        ? b.display_order
        : Number.parseInt(String(b.display_order ?? 0), 10) || 0
    return da - db
  })
}

function normalizeKey(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

type StaticMenuFallback = { subRoutes: Map<string, string> }

function staticMenuFallbacks(): Map<string, StaticMenuFallback> {
  const out = new Map<string, StaticMenuFallback>()
  for (const item of MENU_ITEMS) {
    if (!item.children?.length) continue
    const subRoutes = new Map<string, string>()
    for (const child of item.children) {
      const href = child.href?.trim()
      if (!href) continue
      subRoutes.set(normalizeKey(child.label), href)
    }
    const key = normalizeKey(item.label)
    if (key) out.set(key, { subRoutes })
  }
  return out
}

const STATIC_MENU_FALLBACKS = staticMenuFallbacks()

/** Final fallback: fill route gaps using {@link MENU_ITEMS} by menu/sub-menu label. */
function applyStaticRouteFallback(menus: MenuRecord[]): MenuRecord[] {
  return menus.map((menu) => {
    const fb = STATIC_MENU_FALLBACKS.get(normalizeKey(menu.name))
    if (!fb || !menu.sub_menus?.length) return menu
    const mapped = menu.sub_menus.map((s) => {
      if (s.route?.trim()) return s
      const fbRoute = fb.subRoutes.get(normalizeKey(s.name))
      return fbRoute ? { ...s, route: fbRoute } : s
    })
    return { ...menu, sub_menus: mapped }
  })
}

type RoleActionLookup = {
  subById: Map<string, SubMenuRoleActions>
  subByPermCode: Map<string, SubMenuRoleActions>
  subByRoute: Map<string, SubMenuRoleActions>
  menuDirectById: Map<string, SubMenuRoleActions>
}

/** Indexes CRUD flags from GET `/admin/roles/{role}/permissions` for matching onto `/admin/me/menu` rows. */
function buildRoleActionLookup(roleMenus: MenuRecord[]): RoleActionLookup {
  const subById = new Map<string, SubMenuRoleActions>()
  const subByPermCode = new Map<string, SubMenuRoleActions>()
  const subByRoute = new Map<string, SubMenuRoleActions>()
  const menuDirectById = new Map<string, SubMenuRoleActions>()

  const addSub = (s: MenuSubRow) => {
    const a = s.actions
    if (!a) return
    const id = (s.id ?? '').trim()
    if (id && !subById.has(id)) subById.set(id, a)
    const pc = normalizeKey(s.permission_code)
    if (pc && !subByPermCode.has(pc)) subByPermCode.set(pc, a)
    const rt = normalizeFrontendRoute(s.route).trim().toLowerCase()
    if (rt && rt !== '/' && !subByRoute.has(rt)) subByRoute.set(rt, a)
  }

  for (const m of roleMenus) {
    if (m.direct_route_actions) {
      const mid = (m.id ?? '').trim()
      if (mid && !menuDirectById.has(mid)) menuDirectById.set(mid, m.direct_route_actions)
    }
    for (const s of m.sub_menus ?? []) addSub(s)
  }

  return { subById, subByPermCode, subByRoute, menuDirectById }
}

function pickSubMenuActionsFromLookup(s: MenuSubRow, lu: RoleActionLookup): SubMenuRoleActions | undefined {
  const id = (s.id ?? '').trim()
  if (id) {
    const hit = lu.subById.get(id)
    if (hit) return hit
  }
  const pc = normalizeKey(s.permission_code)
  if (pc) {
    const hit = lu.subByPermCode.get(pc)
    if (hit) return hit
  }
  const rt = normalizeFrontendRoute(s.route).trim().toLowerCase()
  if (rt && rt !== '/') {
    const hit = lu.subByRoute.get(rt)
    if (hit) return hit
  }
  return undefined
}

/**
 * Sidebar tree from GET `/admin/me/menu` with `actions` taken from GET `/admin/roles/{role}/permissions`
 * (sub-menu id, `permission_code`, or route match).
 */
function mergeMeMenusWithRolePermissionActions(me: MenuRecord[], roleMenus: MenuRecord[]): MenuRecord[] {
  if (roleMenus.length === 0) return me
  const lu = buildRoleActionLookup(roleMenus)
  return me.map((menu) => {
    if (menu.direct_route) {
      const mid = (menu.id ?? '').trim()
      const actions =
        lu.menuDirectById.get(mid) ?? lu.subById.get(mid) ?? menu.direct_route_actions
      return actions ? { ...menu, direct_route_actions: actions } : menu
    }
    const subs = (menu.sub_menus ?? []).map((s) => {
      const fromRole = pickSubMenuActionsFromLookup(s, lu)
      const actions = fromRole ?? s.actions
      return actions ? { ...s, actions } : s
    })
    return { ...menu, sub_menus: subs }
  })
}

/** Parses `items[].actions` (or equivalent) on sub-menu rows. */
export function parseSubMenuActions(raw: unknown): SubMenuRoleActions | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const a = raw as Record<string, unknown>
  if (Object.keys(a).length === 0) return undefined
  const rawUpdate = normalizeActionFlag(a.update) || normalizeActionFlag(a.edit)
  return {
    read: normalizeActionFlag(a.read),
    create: normalizeActionFlag(a.create),
    update: rawUpdate,
    delete: normalizeActionFlag(a.delete),
    export: normalizeActionFlag(a.export),
  }
}

/** True when menu rows already include per-sub-menu `actions` (sidebar gating can use embedded flags). */
export function menusEmbedSubMenuActions(menus: MenuRecord[] | undefined): boolean {
  if (!Array.isArray(menus)) return false
  for (const m of menus) {
    if (m.direct_route_actions) return true
    for (const s of m.sub_menus ?? []) {
      if (s.actions !== undefined) return true
    }
  }
  return false
}

export function findSubMenuRowById(
  menus: MenuRecord[] | undefined,
  subMenuId: string,
): MenuSubRow | undefined {
  const id = subMenuId.trim()
  if (!id || !menus) return undefined
  for (const m of menus) {
    for (const s of m.sub_menus ?? []) {
      if ((s.id ?? '').trim() === id) return s
    }
  }
  return undefined
}

export function mapMenuRecord(record: ApiRecord, fallbackIndex?: number): MenuRecord | null {
  let id = toId(record.id ?? record.menu_id ?? record.pk ?? record.uuid)
  if (!id && typeof fallbackIndex === 'number' && Number.isFinite(fallbackIndex)) {
    id = `menu-${fallbackIndex}`
  }
  if (!id) return null
  const subRaw = pickSubMenusRaw(record)
  let sub_menus: MenuSubRow[] | undefined
  if (Array.isArray(subRaw)) {
    sub_menus = subRaw
      .filter((item): item is ApiRecord => !!item && typeof item === 'object')
      .map((sub) => {
        const actions = parseSubMenuActions(sub.actions)
        return {
          id: toId(sub.id ?? sub.sub_menu_id ?? sub.subMenuId ?? sub.pk) || undefined,
          name: toText(sub.name ?? sub.title ?? sub.sub_menu_name ?? sub.subMenuName ?? sub.label) || '-',
          route: subRowRoute(sub),
          permission_code: toText(sub.permission_code) || undefined,
          display_order:
            typeof sub.display_order === 'number' && Number.isFinite(sub.display_order)
              ? sub.display_order
              : Number.parseInt(String(sub.display_order ?? 0), 10) || 0,
          ...(actions ? { actions } : {}),
        }
      })
  }
  const topRoute =
    toText(record.route) ||
    toText(record.path) ||
    toText(record.href) ||
    toText(record.url) ||
    ''
  const subsHaveRoutes = (sub_menus ?? []).some((s) => s.route.trim() !== '')
  let direct_route: string | undefined
  if (!subsHaveRoutes && topRoute) {
    direct_route = topRoute
  }
  const iconRaw = record.icon ?? record.menu_icon ?? record.icon_name
  const iconStr =
    typeof iconRaw === 'string'
      ? toText(iconRaw)
      : iconRaw && typeof iconRaw === 'object' && typeof (iconRaw as { name?: unknown }).name === 'string'
        ? toText((iconRaw as { name: string }).name)
        : ''
  const colorRaw = record.icon_color ?? record.iconColor ?? record.icon_colour
  const directRouteActions = direct_route ? parseSubMenuActions(record.actions) : undefined

  return {
    id,
    name: toText(record.name ?? record.title ?? record.label) || '-',
    icon: iconStr || 'layout-grid',
    icon_color: toText(colorRaw) || '#64748b',
    display_order:
      typeof record.display_order === 'number' && Number.isFinite(record.display_order)
        ? record.display_order
        : Number.parseInt(String(record.display_order ?? 0), 10) || 0,
    ...(direct_route ? { direct_route } : {}),
    ...(direct_route && directRouteActions ? { direct_route_actions: directRouteActions } : {}),
    sub_menus: direct_route ? undefined : sub_menus,
  }
}

/** One menu group from GET `/admin/roles/{role}/permissions` (`data[]`) → {@link MenuRecord}. */
function mapRolePermissionsMenuRecord(record: ApiRecord, fallbackIndex?: number): MenuRecord | null {
  let id = toId(record.menu_id ?? record.menuId ?? record.id ?? record.pk ?? record.uuid)
  if (!id && typeof fallbackIndex === 'number' && Number.isFinite(fallbackIndex)) {
    id = `menu-${fallbackIndex}`
  }
  if (!id) return null

  const subRaw = pickSubMenusRaw(record)
  let sub_menus: MenuSubRow[] | undefined
  if (Array.isArray(subRaw)) {
    sub_menus = subRaw
      .filter((item): item is ApiRecord => !!item && typeof item === 'object')
      .map((sub) => {
        const rawAssign = sub.assigned_actions ?? sub.assignedActions
        const parsedActions = parseSubMenuActions(sub.actions)
        const actions = Array.isArray(rawAssign)
          ? roleActionsFromAssignedField(rawAssign)
          : parsedActions ?? roleActionsFromAssignedField(rawAssign)
        return {
          id: toId(sub.sub_menu_id ?? sub.subMenuId ?? sub.sub_menuId ?? sub.id ?? sub.pk) || undefined,
          name:
            toText(sub.name ?? sub.title ?? sub.sub_menu_name ?? sub.subMenuName ?? sub.label) || '-',
          route: subRowRoute(sub),
          permission_code: toText(sub.permission_code) || undefined,
          display_order:
            typeof sub.display_order === 'number' && Number.isFinite(sub.display_order)
              ? sub.display_order
              : Number.parseInt(String(sub.display_order ?? 0), 10) || 0,
          ...(actions ? { actions } : {}),
        }
      })
  }

  const topRoute =
    toText(record.route) ||
    toText(record.path) ||
    toText(record.href) ||
    toText(record.url) ||
    ''
  const subsHaveRoutes = (sub_menus ?? []).some((s) => s.route.trim() !== '')
  let direct_route: string | undefined
  if (!subsHaveRoutes && topRoute) {
    direct_route = topRoute
  }
  const iconRaw = record.icon ?? record.menu_icon ?? record.icon_name
  const iconStr =
    typeof iconRaw === 'string'
      ? toText(iconRaw)
      : iconRaw && typeof iconRaw === 'object' && typeof (iconRaw as { name?: unknown }).name === 'string'
        ? toText((iconRaw as { name: string }).name)
        : ''
  const colorRaw = record.icon_color ?? record.iconColor ?? record.icon_colour

  const rawTopAssign = record.assigned_actions ?? record.assignedActions
  const topParsed = parseSubMenuActions(record.actions)
  const directRouteActions = direct_route
    ? Array.isArray(rawTopAssign)
      ? roleActionsFromAssignedField(rawTopAssign)
      : topParsed ?? roleActionsFromAssignedField(rawTopAssign)
    : undefined

  return {
    id,
    name:
      toText(record.menu_name ?? record.menuName ?? record.name ?? record.title ?? record.label) || '-',
    icon: iconStr || 'layout-grid',
    icon_color: toText(colorRaw) || '#64748b',
    display_order:
      typeof record.display_order === 'number' && Number.isFinite(record.display_order)
        ? record.display_order
        : Number.parseInt(String(record.display_order ?? 0), 10) || 0,
    ...(direct_route ? { direct_route } : {}),
    ...(direct_route && directRouteActions ? { direct_route_actions: directRouteActions } : {}),
    sub_menus: direct_route ? undefined : sub_menus,
  }
}

/** Derive a permission_code from route when the form does not collect it explicitly. */
export function permissionCodeFromRoute(route: string) {
  const trimmed = route.trim().replace(/^\/+|\/+$/g, '')
  if (!trimmed) return 'menu:item'
  return trimmed.replace(/\//g, ':')
}

/**
 * Convert API icon strings (Lucide Pascal exports, snake_case, slug) to lucide-dynamic
 * icon keys (`lucide-react/dynamic`, kebab-case). Used with `<DynamicIcon name={…} />`.
 *
 * Important: Avoid `import * as Icons from 'lucide-react'` + runtime lookup — lucide-react
 * is marked `sideEffects: false`, so bundlers strip exports that are not statically referenced,
 * and lookups fall back to a single surviving icon (e.g. LayoutGrid).
 */
export function apiIconLabelToLucideKebab(iconName: string): string {
  let s = iconName.trim().replace(/^(fa-|lucide-)/i, '').trim()
  if (!s) return 'layout-grid'

  s = s.replace(/_/g, '-')

  if (/^[a-z]+$/.test(s) && !s.includes('-')) return s

  if (/^[A-Z][a-z]+$/.test(s) && !/\d/.test(s)) return s.charAt(0).toLowerCase() + s.slice(1)

  if (s.includes('-')) {
    const out = s.toLowerCase().replace(/-+/g, '-').replace(/^-|-$/g, '')
    return out || 'layout-grid'
  }

  s = s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-zA-Z])(\d)/g, '$1-$2')

  const kebab = s.toLowerCase().replace(/^-+/, '')
  return kebab || 'layout-grid'
}

/** React Router `to` value from API sub-menu route (leading slash). */
export function normalizeFrontendRoute(route: string): string {
  const t = route.trim()
  if (!t) return '/'
  return t.startsWith('/') ? t : `/${t}`
}

function stringSetFromStringArrayField(raw: unknown): Set<string> {
  const out = new Set<string>()
  if (!Array.isArray(raw)) return out
  for (const item of raw) {
    if (typeof item === 'string' && item.trim()) out.add(item.trim().toLowerCase())
  }
  return out
}

/** `permission_list` / string `permissions` on each GET `/admin/me/menu` module row (multi-role scoping). */
function moduleUserPermissionSetsFromMeRawRecords(records: ApiRecord[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const rec of records) {
    const mid = toId(rec.id ?? rec.menu_id ?? rec.menuId ?? rec.pk)
    if (!mid) continue
    const pl = rec.permission_list ?? rec.user_permission_list
    let set = stringSetFromStringArrayField(pl)
    const permOnly = rec.permissions
    if (Array.isArray(permOnly) && permOnly.every((x): x is string => typeof x === 'string')) {
      for (const x of permOnly) {
        if (x.trim()) set.add(x.trim().toLowerCase())
      }
    }
    if (set.size > 0) out.set(mid, set)
  }
  return out
}

/** Per-sub-menu permission strings on GET `/admin/me/menu` rows (takes precedence over module list). */
function subMenuUserPermissionSetsFromMeRawRecords(records: ApiRecord[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const rec of records) {
    const subList = pickSubMenusRaw(rec)
    if (!Array.isArray(subList)) continue
    for (const sub of subList) {
      if (!sub || typeof sub !== 'object') continue
      const r = sub as ApiRecord
      const sid = toId(r.id ?? r.sub_menu_id ?? r.subMenuId ?? r.sub_menuId ?? r.pk)
      if (!sid) continue
      const pl = r.permission_list ?? r.user_permission_list
      let set = stringSetFromStringArrayField(pl)
      const permOnly = r.permissions
      if (Array.isArray(permOnly) && permOnly.every((x): x is string => typeof x === 'string')) {
        for (const x of permOnly) {
          if (x.trim()) set.add(x.trim().toLowerCase())
        }
      }
      if (set.size > 0) out.set(sid, set)
    }
  }
  return out
}

/**
 * User-level permission codes from GET `/admin/me/menu` envelope (`data.permission_list`, etc.).
 * Only collects arrays of plain strings (avoids treating nested menu payloads as "permissions").
 */
function envelopeUserPermissionSetFromMePayload(payload: unknown): Set<string> {
  const out = new Set<string>()
  const mergeStrings = (arr: unknown) => {
    if (!Array.isArray(arr)) return
    if (!arr.every((x): x is string => typeof x === 'string')) return
    for (const x of arr) {
      if (x.trim()) out.add(x.trim().toLowerCase())
    }
  }
  const scan = (obj: ApiRecord | null | undefined) => {
    if (!obj) return
    for (const key of ['permission_list', 'user_permission_list', 'user_permissions'] as const) {
      mergeStrings(obj[key])
    }
    const perm = obj.permissions
    mergeStrings(perm)
    const d = obj.data as ApiRecord | undefined
    if (d && typeof d === 'object' && !Array.isArray(d)) scan(d)
  }
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    scan(payload as ApiRecord)
  }
  return out
}

/** Lowercased `assigned_actions` per sub-menu (or top menu id for direct-only rows) from role permission records. */
function assignedActionsBySubMenuFromRoleMenuRecords(records: ApiRecord[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  const push = (id: string, raw: unknown) => {
    if (!id) return
    const set = new Set<string>()
    if (Array.isArray(raw)) {
      for (const x of raw) {
        if (typeof x === 'string' && x.trim()) set.add(x.trim().toLowerCase())
      }
    }
    out.set(id, set)
  }

  for (const menu of records) {
    const subList = pickSubMenusRaw(menu)
    if (Array.isArray(subList) && subList.length > 0) {
      for (const sub of subList) {
        if (!sub || typeof sub !== 'object') continue
        const r = sub as ApiRecord
        const sid = toId(r.sub_menu_id ?? r.subMenuId ?? r.sub_menuId ?? r.id ?? r.pk)
        if (!sid) continue
        push(sid, r.assigned_actions ?? r.assignedActions)
      }
    } else {
      const mid = toId(menu.menu_id ?? menu.menuId ?? menu.id ?? menu.pk)
      if (!mid) continue
      push(mid, menu.assigned_actions ?? menu.assignedActions)
    }
  }
  return out
}

function setsIntersectNonEmpty(a: Set<string>, b: Set<string>): boolean {
  for (const x of a) {
    if (b.has(x)) return true
  }
  return false
}

/**
 * For users with permission lists on GET `/admin/me/menu`, keep only module/sub entries whose
 * `assigned_actions` from GET `/admin/roles/{role}/permissions` overlap that list (or `permission_code` / route code).
 */
function filterMenusByUserPermissionListsAgainstRoleAssigned(
  menus: MenuRecord[],
  mePayload: unknown,
  meRawRecords: ApiRecord[],
  roleRecords: ApiRecord[],
): MenuRecord[] {
  const subUser = subMenuUserPermissionSetsFromMeRawRecords(meRawRecords)
  const modUser = moduleUserPermissionSetsFromMeRawRecords(meRawRecords)
  const envelope = envelopeUserPermissionSetFromMePayload(mePayload)
  const roleAssigned = assignedActionsBySubMenuFromRoleMenuRecords(roleRecords)

  const hasUserLists = subUser.size > 0 || modUser.size > 0 || envelope.size > 0
  if (!hasUserLists) return menus

  const userListFor = (menuId: string, subId: string): Set<string> | undefined => {
    const sub = subUser.get(subId)
    if (sub && sub.size > 0) return sub
    const mod = modUser.get(menuId)
    if (mod && mod.size > 0) return mod
    if (envelope.size > 0) return envelope
    return undefined
  }

  const subAllowed = (menuId: string, s: MenuSubRow): boolean => {
    const sid = (s.id ?? '').trim()
    if (!sid) return true
    const userSet = userListFor(menuId, sid)
    if (!userSet || userSet.size === 0) return true

    const roleSet = roleAssigned.get(sid)
    if (roleSet === undefined) return true
    if (roleSet.size === 0) return false
    if (setsIntersectNonEmpty(roleSet, userSet)) return true

    const pc = normalizeKey(s.permission_code)
    if (pc && userSet.has(pc)) return true
    const routeCode = normalizeKey(permissionCodeFromRoute(s.route))
    if (routeCode && userSet.has(routeCode)) return true
    return false
  }

  const directAllowed = (m: MenuRecord): boolean => {
    const mid = (m.id ?? '').trim()
    if (!mid) return true
    const userSet = userListFor(mid, mid)
    if (!userSet || userSet.size === 0) return true

    const roleSet = roleAssigned.get(mid)
    if (roleSet === undefined) return true
    if (roleSet.size === 0) return false
    if (setsIntersectNonEmpty(roleSet, userSet)) return true
    const pc = normalizeKey(permissionCodeFromRoute(m.direct_route ?? ''))
    if (pc && userSet.has(pc)) return true
    return false
  }

  return menus
    .map((m) => {
      if (m.direct_route) {
        return directAllowed(m) ? m : null
      }
      const subs = (m.sub_menus ?? []).filter((s) => subAllowed(m.id, s))
      if (subs.length === 0) return null
      return { ...m, sub_menus: subs }
    })
    .filter((m): m is MenuRecord => m !== null)
}

/**
 * Main sidebar: structure from GET `/admin/me/menu`, CRUD flags aligned from GET `/admin/roles/{role}/permissions`
 * (sub-menu id, `permission_code`, or route). Does not call GET `/admin/menus` (reserved for super-admin module UI).
 * When `/admin/me/menu` includes `permission_list` / string `permissions` on modules, sub-menus, or the envelope,
 * entries are kept only if the active role's `assigned_actions` for that sub-menu overlap that list (multi-role).
 */
export async function fetchUserSidebarMenus(realmRoleName: string | null | undefined): Promise<MenuRecord[]> {
  const role = typeof realmRoleName === 'string' ? realmRoleName.trim() : ''
  if (!role) return []

  const [meSettled, roleSettled] = await Promise.allSettled([
    apiGet<unknown>('/admin/me/menu'),
    fetchRolePermissionsRawCached(role),
  ])

  const mePayload = meSettled.status === 'fulfilled' ? meSettled.value : undefined
  const meRawRecords =
    mePayload !== undefined ? menusToArray(mePayload) : ([] as ApiRecord[])

  let meMenus: MenuRecord[] = []
  if (meRawRecords.length > 0) {
    meMenus = meRawRecords
      .map((r, i) => mapMenuRecord(r, i))
      .filter((m): m is MenuRecord => m !== null)
  }

  let roleRecords: ApiRecord[] = []
  if (roleSettled.status === 'fulfilled') {
    roleRecords = menusToArray(roleSettled.value)
    if (looksLikeFlatPermissionRows(roleRecords)) {
      roleRecords = groupFlatPermissionRowsIntoMenus(roleRecords)
    }
  }

  const roleMenus = roleRecords
    .map((r, i) => mapRolePermissionsMenuRecord(r, i) ?? mapMenuRecord(r, i))
    .filter((m): m is MenuRecord => m !== null)

  let menus =
    meMenus.length > 0 ? mergeMeMenusWithRolePermissionActions(meMenus, roleMenus) : roleMenus

  menus = applyStaticRouteFallback(menus)

  if (mePayload !== undefined && meRawRecords.length > 0) {
    menus = filterMenusByUserPermissionListsAgainstRoleAssigned(menus, mePayload, meRawRecords, roleRecords)
  }

  return menus
    .sort((a, b) => a.display_order - b.display_order)
    .map((m) => ({
      ...m,
      sub_menus: m.sub_menus
        ? [...m.sub_menus].sort((a, b) => a.display_order - b.display_order)
        : undefined,
    }))
}

export type MenuBulkPayload = {
  id?: string
  name: string
  icon: string
  icon_color: string
  display_order: number
  sub_menus: Array<{
    id?: string
    name: string
    route: string
    permission_code: string
    display_order: number
  }>
}

export function buildBulkPayload(
  id: string | undefined,
  name: string,
  icon: string,
  iconColor: string,
  displayOrder: number,
  subRows: Array<{
    id?: string
    name: string
    route: string
    permission_code?: string
    display_order: number
  }>,
): MenuBulkPayload {
  const base: MenuBulkPayload = {
    name: name.trim(),
    icon: icon.trim(),
    icon_color: iconColor.trim(),
    display_order: displayOrder,
    sub_menus: subRows
      .filter((r) => r.name.trim() && r.route.trim())
      .map((r) => ({
        ...(r.id ? { id: r.id } : {}),
        name: r.name.trim(),
        route: r.route.trim().startsWith('/') ? r.route.trim() : `/${r.route.trim()}`,
        permission_code: (r.permission_code?.trim() || permissionCodeFromRoute(r.route)).trim(),
        display_order: r.display_order,
      })),
  }
  if (id) return { ...base, id }
  return base
}
