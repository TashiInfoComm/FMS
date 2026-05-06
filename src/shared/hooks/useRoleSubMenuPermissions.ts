import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { fetchRoleDetail, resolvePrimaryRealmRole } from '@/features/user/lib/roles-api'
import { useUserStore } from '@/services/user-store'
import {
  FMS_ROLE_PREFERENCE_CHANGED,
} from '@/shared/lib/realm-role-mapping'

export type RoleCrudAction = 'read' | 'create' | 'update' | 'delete'

/**
 * Loads GET `/admin/roles/{realmRole}/permissions` for the signed-in user's primary realm role and
 * maps permission rows for `subMenuId` into `canRead` / `canCreate` / `canUpdate` / `canDelete`.
 * When `subMenuId` is missing or permissions are still loading, CRUD flags are false and `isResolved` is false.
 */
export function useRoleSubMenuPermissions(subMenuId: string | null | undefined) {
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

  const permissionsQuery = useQuery({
    queryKey: ['role-permissions-detail', apiRoleName],
    queryFn: () => fetchRoleDetail(apiRoleName!),
    enabled: Boolean(apiRoleName && authenticated),
    staleTime: 60_000,
  })

  const permMap = permissionsQuery.data?.permissionsBySubMenu
  const actions =
    subMenuId && permMap instanceof Map ? permMap.get(subMenuId) : undefined

  const resolved = Boolean(subMenuId && apiRoleName && permissionsQuery.isSuccess)

  const allowed = (action: RoleCrudAction) => (resolved ? actions?.[action] === 1 : false)

  return {
    apiRoleName,
    isLoading: permissionsQuery.isLoading,
    isError: permissionsQuery.isError,
    isResolved: resolved,
    canRead: allowed('read'),
    canCreate: allowed('create'),
    canUpdate: allowed('update'),
    canDelete: allowed('delete'),
    allowed,
  }
}
