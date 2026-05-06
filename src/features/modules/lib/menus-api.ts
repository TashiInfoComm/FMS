// Types and helpers for `/admin/menus` (list, bulk create, single-menu update by id).
import { apiGet } from '@/services/apiClient'

export type ApiRecord = Record<string, unknown>

export type MenuSubRow = {
  id?: string
  name: string
  route: string
  permission_code?: string
  display_order: number
}

export type MenuRecord = {
  id: string
  name: string
  icon: string
  icon_color: string
  display_order: number
  /** Top-level link when the API has no `sub_menus` (sidebar renders a single link). */
  direct_route?: string
  sub_menus?: MenuSubRow[]
}

/**
 * Normalize list payloads whether the API returns a bare array or wraps rows.
 * Supports envelopes like `{ success, message, data: Menu[] }` and sub-links under `items`
 * (see `/admin/menus`, `/admin/me/menu`).
 */
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
  ]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is ApiRecord => !!item && typeof item === 'object')
    }
  }
  return []
}

/** Sub-menus may be under `sub_menus`, `children`, or `items`. Prefer first non-empty array. */
function pickSubMenusRaw(record: ApiRecord): unknown[] | undefined {
  const candidates = [record.sub_menus, record.subMenus, record.children, record.items]
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
    ''
  )
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
      .map((sub) => ({
        id: toId(sub.id ?? sub.pk) || undefined,
        name: toText(sub.name ?? sub.title ?? sub.label) || '-',
        route: subRowRoute(sub),
        permission_code: toText(sub.permission_code) || undefined,
        display_order:
          typeof sub.display_order === 'number' && Number.isFinite(sub.display_order)
            ? sub.display_order
            : Number.parseInt(String(sub.display_order ?? 0), 10) || 0,
      }))
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

/** Main sidebar: menus for the current user from GET `/admin/me/menu` (filtered server-side). */
export async function fetchUserSidebarMenus(): Promise<MenuRecord[]> {
  const payload = await apiGet<unknown>('/admin/me/menu')
  const records = menusToArray(payload)
    .map((r, i) => mapMenuRecord(r, i))
    .filter((m): m is MenuRecord => m !== null)
  return records
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
