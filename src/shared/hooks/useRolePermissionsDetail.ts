import { useQuery } from '@tanstack/react-query'

import type { MenuSubRow, SubMenuRoleActions } from '@/features/modules/lib/menus-api'
import { menusEmbedSubMenuActions, type MenuRecord } from '@/features/modules/lib/menus-api'
import {
  fetchRoleDetail,
  type ParsedRoleDetail,
  type RoleActions,
} from '@/features/user/lib/roles-api'
import { useUserStore } from '@/services/user-store'
import { useAccessControl } from '@/shared/hooks/useAccessControl'

/**
 * Full GET `/admin/roles/{realmRole}/permissions` for the active realm role.
 * Shares the TanStack Query cache with {@link useRoleSubMenuPermissions} (`role-permissions-detail`).
 */
export function useRolePermissionsDetail() {
  const authenticated = useUserStore((state) => state.authenticated)
  const { apiRoleName } = useAccessControl()

  const query = useQuery({
    queryKey: ['role-permissions-detail', apiRoleName],
    queryFn: () => fetchRoleDetail(apiRoleName!),
    enabled: Boolean(apiRoleName && authenticated),
    staleTime: 60_000,
  })

  return {
    apiRoleName,
    data: query.data,
    permissionsBySubMenu: query.data?.permissionsBySubMenu,
    isLoading: query.isLoading,
    isSuccess: query.isSuccess,
    isError: query.isError,
  }
}

/**
 * When true, sidebar entries should be filtered by `read` (either from embedded `actions` on each
 * sidebar menu row or from GET `/admin/roles/{role}/permissions`).
 */
export function shouldApplySubMenuPermissionFilter(
  detail: ParsedRoleDetail | undefined,
  menus?: MenuRecord[] | undefined,
): boolean {
  if (menusEmbedSubMenuActions(menus)) return true
  const map = detail?.permissionsBySubMenu
  return Boolean(map && map.size > 0)
}

export function canReadSubMenuRow(
  permissionsBySubMenu: Map<string, RoleActions> | undefined,
  subMenu: Pick<MenuSubRow, 'id' | 'actions'>,
  filterActive: boolean,
): boolean {
  if (subMenu.actions !== undefined) return subMenu.actions.read === 1
  if (!filterActive) return true
  const id = typeof subMenu.id === 'string' ? subMenu.id.trim() : ''
  if (!id) return false
  const actions = permissionsBySubMenu?.get(id)
  if (actions === undefined) return false
  return actions.read === 1
}

/** Top-level menu link (no sub-rows): permissive when the id is not present in the role matrix. */
export function canShowDirectRouteMenu(
  permissionsBySubMenu: Map<string, RoleActions> | undefined,
  menuId: string,
  filterActive: boolean,
  directRouteActions?: SubMenuRoleActions | undefined,
): boolean {
  if (directRouteActions !== undefined) return directRouteActions.read === 1
  if (!filterActive) return true
  const id = menuId.trim()
  if (!id) return false
  const actions = permissionsBySubMenu?.get(id)
  if (actions === undefined) return true
  return actions.read === 1
}
