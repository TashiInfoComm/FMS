import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { fetchUserSidebarMenus, findSubMenuRowById } from '@/features/modules/lib/menus-api'
import { fetchRoleDetail, grantedActionCodesFromActionsObject, normalizeActionCode } from '@/features/user/lib/roles-api'
import { useUserStore } from '@/services/user-store'
import { useAccessControl } from '@/shared/hooks/useAccessControl'

export type RoleCrudAction = 'read' | 'create' | 'update' | 'delete'

/**
 * Resolves CRUD flags for a sidebar `subMenuId` from embedded row `actions` when present,
 * otherwise from the cached GET `/admin/roles/{realmRole}/permissions` role-permissions query.
 * When `subMenuId` is missing or data is still loading, flags are false and `isResolved` is false.
 */
export function useRoleSubMenuPermissions(subMenuId: string | null | undefined) {
  const authenticated = useUserStore((state) => state.authenticated)
  const { apiRoleName } = useAccessControl()

  const permissionsQuery = useQuery({
    queryKey: ['role-permissions-detail', apiRoleName],
    queryFn: () => fetchRoleDetail(apiRoleName!),
    enabled: Boolean(apiRoleName && authenticated),
    staleTime: 60_000,
  })

  const menusQuery = useQuery({
    queryKey: ['role-sidebar-menus', apiRoleName],
    queryFn: () => fetchUserSidebarMenus(apiRoleName),
    enabled: Boolean(authenticated && apiRoleName),
    staleTime: 60_000,
  })

  const menuRow = useMemo(() => {
    if (!subMenuId?.trim() || !menusQuery.data) return undefined
    return findSubMenuRowById(menusQuery.data, subMenuId)
  }, [menusQuery.data, subMenuId])

  const embeddedActions = menuRow?.actions

  const permMap = permissionsQuery.data?.permissionsBySubMenu
  const matrixActions =
    subMenuId && permMap instanceof Map ? permMap.get(subMenuId) : undefined

  const actions = embeddedActions ?? matrixActions

  const assignedCodes = useMemo(() => {
    if (!subMenuId?.trim()) return new Set<string>()
    const fromDetail = permissionsQuery.data?.assignedActionsBySubMenu?.get(subMenuId)
    if (fromDetail?.length) {
      return new Set(fromDetail.map(normalizeActionCode))
    }
    if (actions) {
      const fromFlags = grantedActionCodesFromActionsObject(actions)
      if (fromFlags.length > 0) return new Set(fromFlags)
    }
    return new Set<string>()
  }, [subMenuId, permissionsQuery.data, actions])

  const resolved = Boolean(
    subMenuId &&
      (embeddedActions !== undefined
        ? menusQuery.isSuccess
        : apiRoleName && permissionsQuery.isSuccess),
  )

  const hasAction = useCallback(
    (code: string) => resolved && assignedCodes.has(normalizeActionCode(code)),
    [assignedCodes, resolved],
  )

  const allowed = (action: RoleCrudAction) => hasAction(action)

  return {
    apiRoleName,
    isLoading:
      menusQuery.isLoading ||
      (embeddedActions === undefined && Boolean(apiRoleName) && permissionsQuery.isLoading),
    isError: menusQuery.isError || permissionsQuery.isError,
    isResolved: resolved,
    canRead: allowed('read'),
    canCreate: allowed('create'),
    canUpdate: allowed('update'),
    canDelete: allowed('delete'),
    canCancel: hasAction('cancel'),
    canApprove: hasAction('approve'),
    canReject: hasAction('reject'),
    canAssign: hasAction('assign'),
    canExport: hasAction('export'),
    hasAction,
    allowed,
  }
}
