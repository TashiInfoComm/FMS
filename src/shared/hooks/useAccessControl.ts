// Exposes permission-aware menu visibility and access helpers.
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

import { fetchUserSidebarMenus, menusEmbedSubMenuActions } from '@/features/modules/lib/menus-api'
import { queryClient } from '@/lib/query-client'
import { useUserStore } from '@/services/user-store'
import { type Permission, type Role } from '@/shared/constants/access-control'
import { buildEffectivePermissionCodes } from '@/shared/lib/nav-permission-codes'
import {
  FMS_ROLE_PREFERENCE_CHANGED,
  getMappedRolesFromUserProfile,
  mapApiRoleValue,
  notifyRolePreferenceChanged,
  pickPrimaryRealmRole,
  resolveActiveRealmRoleString,
} from '@/shared/lib/realm-role-mapping'

function readPinnedRoleFromStorage(): Role | null {
  if (typeof window === 'undefined') return null
  const storedRole = localStorage.getItem('fms-role')
  if (!storedRole) return null
  return mapApiRoleValue(storedRole.trim())
}

export function useAccessControl() {
  const user = useUserStore((state) => state.user)
  const authenticated = useUserStore((state) => state.authenticated)
  const userRecord = user && typeof user === 'object' ? (user as Record<string, unknown>) : null

  const mappedApiRoles = useMemo(() => getMappedRolesFromUserProfile(userRecord), [userRecord])

  const [pinnedRole, setPinnedRole] = useState<Role | null>(() => readPinnedRoleFromStorage())

  // Keep every `useAccessControl` instance in sync after the header role switcher updates
  // `localStorage['fms-role']`. Without this, nested consumers (e.g. `useRolePermissionsDetail`,
  // `useRoleSubMenuPermissions`) hold a stale `pinnedRole` and keep fetching with the previous
  // role string until the page is refreshed.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const syncFromStorage = () => {
      const next = readPinnedRoleFromStorage()
      setPinnedRole((prev) => (prev === next ? prev : next))
    }
    window.addEventListener(FMS_ROLE_PREFERENCE_CHANGED, syncFromStorage)
    window.addEventListener('storage', syncFromStorage)
    return () => {
      window.removeEventListener(FMS_ROLE_PREFERENCE_CHANGED, syncFromStorage)
      window.removeEventListener('storage', syncFromStorage)
    }
  }, [])

  const fallbackRole = useMemo(() => pickPrimaryRealmRole(mappedApiRoles), [mappedApiRoles])
  const role = pinnedRole ?? fallbackRole

  const apiRoleName = useMemo(
    () => resolveActiveRealmRoleString(userRecord, role),
    [userRecord, role],
  )

  const menuQuery = useQuery({
    queryKey: ['role-sidebar-menus', apiRoleName],
    queryFn: () => fetchUserSidebarMenus(apiRoleName),
    staleTime: 60_000,
    enabled: authenticated && Boolean(apiRoleName),
  })

  const permissions = useMemo<Permission[]>(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('fms-permissions') : null
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as unknown
        if (Array.isArray(parsed) && parsed.every((p) => typeof p === 'string')) {
          return parsed as Permission[]
        }
      } catch {
        /* fall through */
      }
    }

    if (!authenticated) return []

    const menusEmbed = menusEmbedSubMenuActions(menuQuery.data)

    const effective =
      menuQuery.data && (menusEmbed || menuQuery.isSuccess || menuQuery.isError)
        ? buildEffectivePermissionCodes(menuQuery.data, undefined)
        : []

    if (effective.length > 0) return effective

    const waitingMenus = menuQuery.isLoading || menuQuery.isFetching
    if (waitingMenus) return []

    return ['dashboard:view']
  }, [
    authenticated,
    menuQuery.data,
    menuQuery.isLoading,
    menuQuery.isFetching,
    menuQuery.isSuccess,
    menuQuery.isError,
  ])

  const setRole = (nextRole: Role) => {
    localStorage.setItem('fms-role', String(nextRole))
    localStorage.removeItem('fms-permissions')
    setPinnedRole(nextRole)
    // Drop cached entries for the previous role so the sidebar/permission gates do not flash
    // stale data while the new role's queries resolve.
    queryClient.removeQueries({ queryKey: ['role-permissions-detail'] })
    queryClient.removeQueries({ queryKey: ['role-sidebar-menus'] })
    notifyRolePreferenceChanged()
    void queryClient.invalidateQueries({ queryKey: ['role-permissions-detail'] })
    void queryClient.invalidateQueries({ queryKey: ['role-sidebar-menus'] })
  }

  return {
    roles: mappedApiRoles,
    role,
    apiRoleName,
    permissions,
    setRole,
  }
}
