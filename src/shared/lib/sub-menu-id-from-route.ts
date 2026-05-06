import type { MenuRecord } from '@/features/modules/lib/menus-api'
import { normalizeFrontendRoute } from '@/features/modules/lib/menus-api'

export type SubMenuRouteMatch = { id: string; name: string; display_order: number }

function normalizeHint(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Lists sub-menus whose `route` equals `routePath`, plus optional top-level menus that only expose `direct_route`.
 */
export function collectSubMenusMatchingRoute(menus: MenuRecord[], routePath: string): SubMenuRouteMatch[] {
  const target = normalizeFrontendRoute(routePath)
  const out: SubMenuRouteMatch[] = []

  if (!Array.isArray(menus)) return []

  for (const menu of menus) {
    const dr = menu.direct_route?.trim()
    if (dr && normalizeFrontendRoute(dr) === target) {
      const id = String(menu.id ?? '').trim()
      if (id)
        out.push({
          id,
          name: menu.name.trim() || '-',
          display_order:
            typeof menu.display_order === 'number' && Number.isFinite(menu.display_order)
              ? menu.display_order
              : Number.parseInt(String(menu.display_order ?? 0), 10) || 0,
        })
    }

    for (const sub of menu.sub_menus ?? []) {
      const id = (sub.id ?? '').trim()
      const route = (sub.route ?? '').trim()
      if (!id || !route) continue
      if (normalizeFrontendRoute(route) !== target) continue
      const order =
        typeof sub.display_order === 'number' && Number.isFinite(sub.display_order)
          ? sub.display_order
          : Number.parseInt(String(sub.display_order ?? 0), 10) || 0
      out.push({
        id,
        name: sub.name.trim() || '-',
        display_order: order,
      })
    }
  }

  return out.sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name))
}

export type FindSubMenuIdOpts = {
  /** When multiple sub-menus share the same route (e.g. Agency tabs), narrow by submenu display name (substring match). */
  nameHint?: string | null | undefined
}

/**
 * Resolves a single `sub_menu_id` for role permission lookups, or null when ambiguous or missing.
 */
export function findSubMenuIdByRoutePath(
  menus: MenuRecord[],
  routePath: string,
  opts?: FindSubMenuIdOpts,
): string | null {
  const list = Array.isArray(menus) ? menus : []
  const rows = collectSubMenusMatchingRoute(list, routePath)
  if (rows.length === 0) return null
  if (rows.length === 1) return rows[0].id

  const hintRaw = opts?.nameHint?.trim()
  if (!hintRaw) return null

  const hint = normalizeHint(hintRaw)
  const hinted = rows.filter((r) => normalizeHint(r.name).includes(hint) || hint.includes(normalizeHint(r.name)))
  if (hinted.length === 1) return hinted[0].id

  const words = hint.split(/\s+/).filter(Boolean)
  if (words.length > 0) {
    const multi = rows.filter((r) => {
      const rn = normalizeHint(r.name)
      return words.every((w) => rn.includes(w))
    })
    if (multi.length === 1) return multi[0].id
  }

  return null
}
