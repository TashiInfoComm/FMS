// Derives coarse permission_code strings for nav gating from API menus + role matrix.
import { permissionCodeFromRoute, type MenuRecord } from '@/features/modules/lib/menus-api'
import type { ParsedRoleDetail } from '@/features/user/lib/roles-api'

function matrixFilterActive(detail: ParsedRoleDetail | undefined): boolean {
  const map = detail?.permissionsBySubMenu
  return Boolean(map && map.size > 0)
}

/**
 * Permission codes usable with `permissions.includes('…')` (e.g. dashboard link).
 * Built from sidebar menu rows (GET `/admin/roles/{role}/permissions`). Sub-menus may embed
 * `actions` (read/create/…); otherwise the role-permissions map (`read` on sub_menu_id) is used when present.
 */
export function buildEffectivePermissionCodes(
  menus: MenuRecord[] | undefined,
  detail: ParsedRoleDetail | undefined,
): string[] {
  const list = Array.isArray(menus) ? menus : []
  const permMap = detail?.permissionsBySubMenu
  const matrixActive = matrixFilterActive(detail)

  const codes = new Set<string>()
  const addCode = (route: string, explicit?: string) => {
    const trimmed = explicit?.trim()
    const code = trimmed || permissionCodeFromRoute(route)
    if (code) codes.add(code)
    const path = normalizePath(route)
    if (path === '/dashboard' || code === 'dashboard') codes.add('dashboard:view')
  }

  for (const m of list) {
    if (m.direct_route?.trim()) {
      const rid = (m.id ?? '').trim()
      const embedded = m.direct_route_actions
      if (embedded) {
        if (embedded.read === 1) addCode(m.direct_route)
        continue
      }
      if (!matrixActive || !permMap?.size) {
        addCode(m.direct_route)
        continue
      }
      const actions = permMap.get(rid)
      if (actions?.read === 1) addCode(m.direct_route)
      continue
    }
    const subs = m.sub_menus ?? []
    for (const s of subs) {
      const sid = typeof s.id === 'string' ? s.id.trim() : ''
      if (!sid || !s.route.trim()) continue

      if (s.actions) {
        if (s.actions.read === 1) addCode(s.route, s.permission_code ?? undefined)
        continue
      }

      if (!matrixActive || !permMap?.size) {
        addCode(s.route, s.permission_code ?? undefined)
        continue
      }
      if (permMap.get(sid)?.read !== 1) continue
      addCode(s.route, s.permission_code ?? undefined)
    }
  }

  return [...codes]
}

function normalizePath(route: string | undefined): string {
  const t = (route?.trim() ?? '') || ''
  if (!t) return ''
  const withSlash = t.startsWith('/') ? t : `/${t}`
  return withSlash.replace(/\/+$/, '') || '/'
}
