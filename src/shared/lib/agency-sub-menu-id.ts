// Maps Agency page tabs to sidebar sub-menu ids (GET `/admin/me/menu`) for role permission lookups.
import type { MenuRecord } from '@/features/modules/lib/menus-api'
import { normalizeFrontendRoute } from '@/features/modules/lib/menus-api'

const AGENCY_PAGE_ROUTE = '/master/agency'

export type AgencyHierarchyTab = 'Agency' | 'Department' | 'Division' | 'Sub-Division'

function normalizeSubMenuLabel(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Returns true when sub-module display name corresponds to the active hierarchy tab.
 * Separate sub-menus (e.g. "Agency" vs "Department") can share the same frontend route.
 */
export function agencyHierarchyTabMatchesSubMenuName(subName: string, tab: AgencyHierarchyTab): boolean {
  const n = normalizeSubMenuLabel(subName)
  const looksLikeSubDivision =
    (n.includes('sub') && (n.includes('division') || /\bsub[-\s]?div/.test(n))) || n.includes('subdivision')
  const looksLikeDivision = n.includes('division') || /\bdiv\b/.test(n)

  switch (tab) {
    case 'Agency':
      if (looksLikeSubDivision) return false
      return n === 'agency' || (n.includes('agency') && !n.includes('department'))
    case 'Department':
      return n.includes('department')
    case 'Division':
      if (looksLikeSubDivision) return false
      return looksLikeDivision || n === 'division'
    case 'Sub-Division':
      return looksLikeSubDivision
    default:
      return false
  }
}

function collectSubsForRoute(menus: MenuRecord[], routePath: string) {
  const target = normalizeFrontendRoute(routePath)
  const out: Array<{ id: string; name: string }> = []
  for (const menu of menus) {
    for (const sub of menu.sub_menus ?? []) {
      const id = (sub.id ?? '').trim()
      if (!id) continue
      if (normalizeFrontendRoute(sub.route) !== target) continue
      out.push({ id, name: sub.name })
    }
  }
  return out
}

/**
 * Resolves `sub_menu_id` for role permission maps given the tab shown on `/master/agency`.
 * Prefers name matches when several sub-menus share one route; falls back to a single route match.
 */
export function findAgencyHierarchySubMenuId(menus: MenuRecord[], tab: AgencyHierarchyTab): string | null {
  const onRoute = collectSubsForRoute(menus, AGENCY_PAGE_ROUTE)
  const named = onRoute.filter((s) => agencyHierarchyTabMatchesSubMenuName(s.name, tab)).map((s) => s.id)
  if (named.length === 1) return named[0]
  if (named.length > 1) return named[0]

  if (onRoute.length === 1) return onRoute[0].id
  return null
}
