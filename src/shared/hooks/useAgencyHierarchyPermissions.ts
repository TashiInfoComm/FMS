import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { fetchUserSidebarMenus } from '@/features/modules/lib/menus-api'
import { useUserStore } from '@/services/user-store'
import {
  findAgencyHierarchySubMenuId,
  type AgencyHierarchyTab,
} from '@/shared/lib/agency-sub-menu-id'

import { useAccessControl } from '@/shared/hooks/useAccessControl'
import { useRoleSubMenuPermissions } from '@/shared/hooks/useRoleSubMenuPermissions'

/**
 * Resolves which sidebar sub_menu applies to `activeTab`, then derives CRUD flags via `useRoleSubMenuPermissions`.
 * Used on `/master/agency` to gate Agency / Department / Division / Sub-Division tabs until menus and
 * permissions are loaded; callers should treat CRUD booleans as false until `isResolved` is true.
 */
export function useAgencyHierarchyPermissions(activeTab: AgencyHierarchyTab) {
  const authenticated = useUserStore((state) => state.authenticated)
  const { apiRoleName } = useAccessControl()

  const menusQuery = useQuery({
    queryKey: ['role-sidebar-menus', apiRoleName],
    queryFn: () => fetchUserSidebarMenus(apiRoleName),
    staleTime: 60_000,
    enabled: authenticated && Boolean(apiRoleName),
  })

  const subMenuId = useMemo(
    () => findAgencyHierarchySubMenuId(menusQuery.data ?? [], activeTab),
    [menusQuery.data, activeTab],
  )

  const rolePerm = useRoleSubMenuPermissions(subMenuId)

  const menusReady = !authenticated || menusQuery.isSuccess
  const isResolved = Boolean(subMenuId && menusReady && rolePerm.isResolved)

  return {
    subMenuId,
    apiRoleName: rolePerm.apiRoleName,
    isLoading: menusQuery.isLoading || rolePerm.isLoading,
    isError: menusQuery.isError || rolePerm.isError,
    isResolved,
    canRead: isResolved ? rolePerm.canRead : false,
    canCreate: isResolved ? rolePerm.canCreate : false,
    canUpdate: isResolved ? rolePerm.canUpdate : false,
    canDelete: isResolved ? rolePerm.canDelete : false,
  }
}
