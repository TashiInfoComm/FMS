import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import {
  fetchRoleDetail,
  resolvePrimaryRealmRole,
  type ParsedRoleDetail,
  type RoleActions,
} from '@/features/user/lib/roles-api'
import { useUserStore } from '@/services/user-store'
import { FMS_ROLE_PREFERENCE_CHANGED } from '@/shared/lib/realm-role-mapping'

/**
 * Full GET `/admin/roles/{realmRole}/permissions` for the active realm role.
 * Shares the TanStack Query cache with {@link useRoleSubMenuPermissions} (`role-permissions-detail`).
 */
export function useRolePermissionsDetail() {
  const user = useUserStore((state) => state.user)
  const authenticated = useUserStore((state) => state.authenticated)
  const userRecord = user && typeof user === 'object' ? (user as Record<string, unknown>) : null

  const [preferenceRev, setPreferenceRev] = useState(0)
  useEffect(() => {
    const onChange = () => setPreferenceRev((n) => n + 1)
    window.addEventListener(FMS_ROLE_PREFERENCE_CHANGED, onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener(FMS_ROLE_PREFERENCE_CHANGED, onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [])

  const apiRoleName = useMemo(() => {
    void preferenceRev
    return resolvePrimaryRealmRole(userRecord)
  }, [userRecord, preferenceRev])

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

/** When true, sidebar sub-modules require GET role row `read` for their `sub_menu_id`. */
export function shouldApplySubMenuPermissionFilter(detail: ParsedRoleDetail | undefined): boolean {
  const map = detail?.permissionsBySubMenu
  return Boolean(map && map.size > 0)
}

export function canReadSubMenuRow(
  permissionsBySubMenu: Map<string, RoleActions> | undefined,
  subMenuId: string | undefined,
  filterActive: boolean,
): boolean {
  if (!filterActive) return true
  const id = typeof subMenuId === 'string' ? subMenuId.trim() : ''
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
): boolean {
  if (!filterActive) return true
  const id = menuId.trim()
  if (!id) return false
  const actions = permissionsBySubMenu?.get(id)
  if (actions === undefined) return true
  return actions.read === 1
}
