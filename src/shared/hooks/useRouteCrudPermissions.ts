import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { fetchUserSidebarMenus, type MenuRecord } from '@/features/modules/lib/menus-api'
import { findSubMenuIdByRoutePath } from '@/shared/lib/sub-menu-id-from-route'
import { useAccessControl } from '@/shared/hooks/useAccessControl'
import { useRoleSubMenuPermissions } from '@/shared/hooks/useRoleSubMenuPermissions'
import { useUserStore } from '@/services/user-store'

export type UseRouteCrudPermissionsOptions = {
  /** Bypass route matching and use this sub_menu id directly (already resolved). */
  explicitSubMenuId?: string | null | undefined
  /**
   * When multiple sub-menus share the same route path, match by label (substring, case-insensitive),
   * e.g. Vehicle Type vs Vehicle Category on `/master/vehicle-type-category`.
   */
  subMenuNameHint?: string | null | undefined
}

/**
 * Maps the signed-in user's realm role + sidebar menus from GET `/admin/roles/{role}/permissions` to CRUD flags for the sidebar sub-menu
 * that matches `sidebarRoute` (React Router path, e.g. `/master/fuel-type`).
 */
export function useRouteCrudPermissions(
  sidebarRoute: string | null | undefined,
  options?: UseRouteCrudPermissionsOptions,
) {
  const authenticated = useUserStore((state) => state.authenticated)
  const { apiRoleName } = useAccessControl()

  const menusQuery = useQuery({
    queryKey: ['role-sidebar-menus', apiRoleName],
    queryFn: () => fetchUserSidebarMenus(apiRoleName),
    staleTime: 60_000,
    enabled: authenticated && Boolean(apiRoleName),
  })

  const menusList = useMemo(
    () => (Array.isArray(menusQuery.data) ? menusQuery.data : ([] as MenuRecord[])),
    [menusQuery.data],
  )

  const resolvedSubMenuId = useMemo(() => {
    if (options?.explicitSubMenuId) return options.explicitSubMenuId
    if (!sidebarRoute?.trim()) return null
    return findSubMenuIdByRoutePath(menusList, sidebarRoute, {
      nameHint: options?.subMenuNameHint ?? undefined,
    })
  }, [menusList, sidebarRoute, options?.explicitSubMenuId, options?.subMenuNameHint])

  const rolePerm = useRoleSubMenuPermissions(resolvedSubMenuId ?? null)

  const menusReady = !authenticated || menusQuery.isSuccess
  const idKnown = resolvedSubMenuId !== null && resolvedSubMenuId !== undefined && resolvedSubMenuId !== ''

  const isResolved = Boolean(
    authenticated && menusReady && idKnown && rolePerm.isResolved,
  )

  const isLoading =
    Boolean(authenticated) &&
    ((!menusReady && menusQuery.isLoading) ||
      (!isResolved && idKnown && rolePerm.isLoading))

  return {
    subMenuId: resolvedSubMenuId,
    menusQuery,
    apiRoleName: rolePerm.apiRoleName,
    isLoading,
    isError: menusQuery.isError || rolePerm.isError,
    isResolved,
    canRead: isResolved && rolePerm.canRead,
    canCreate: isResolved && rolePerm.canCreate,
    canUpdate: isResolved && rolePerm.canUpdate,
    canDelete: isResolved && rolePerm.canDelete,
    canCancel: isResolved && rolePerm.canCancel,
    canApprove: isResolved && rolePerm.canApprove,
    canReject: isResolved && rolePerm.canReject,
    hasAction: (code: string) => isResolved && rolePerm.hasAction(code),
    allowed: rolePerm.allowed,
  }
}
