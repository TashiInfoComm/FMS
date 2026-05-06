// Exposes permission-aware menu visibility and access helpers.
import { useMemo, useState } from 'react'

import { queryClient } from '@/lib/query-client'
import { DEFAULT_ROLE, ROLE_PERMISSIONS, type Permission, type Role } from '@/shared/constants/access-control'
import {
  getMappedRolesFromUserProfile,
  mapApiRoleValue,
  notifyRolePreferenceChanged,
  pickPrimaryCoarseRole,
} from '@/shared/lib/realm-role-mapping'
import { useUserStore } from '@/services/user-store'

function readPinnedRoleFromStorage(): Role | null {
  if (typeof window === 'undefined') return null
  const storedRole = localStorage.getItem('fms-role')
  if (!storedRole) return null
  return mapApiRoleValue(storedRole.trim())
}

export function useAccessControl() {
  const user = useUserStore((state) => state.user)
  const userRecord = user && typeof user === 'object' ? (user as Record<string, unknown>) : null

  const mappedApiRoles = useMemo(() => getMappedRolesFromUserProfile(userRecord), [userRecord])

  const [pinnedRole, setPinnedRole] = useState<Role | null>(() => readPinnedRoleFromStorage())

  const fallbackRole = useMemo(() => pickPrimaryCoarseRole(mappedApiRoles), [mappedApiRoles])
  const role = pinnedRole ?? fallbackRole

  const permissions = useMemo<Permission[]>(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('fms-permissions') : null
    if (stored) {
      try {
        return JSON.parse(stored) as Permission[]
      } catch {
        // fall through to role-based defaults
      }
    }

    const effectiveCoarse =
      pinnedRole ??
      (mappedApiRoles.length > 0 ? pickPrimaryCoarseRole(mappedApiRoles) : DEFAULT_ROLE)

    return ROLE_PERMISSIONS[effectiveCoarse] ?? ROLE_PERMISSIONS[DEFAULT_ROLE]
  }, [pinnedRole, mappedApiRoles])

  const setRole = (nextRole: Role) => {
    localStorage.setItem('fms-role', nextRole)
    localStorage.removeItem('fms-permissions')
    setPinnedRole(nextRole)
    notifyRolePreferenceChanged()
    void queryClient.invalidateQueries({ queryKey: ['role-permissions-detail'] })
    void queryClient.invalidateQueries({ queryKey: ['me-menu'] })
  }

  return {
    /** Realm / profile roles normalized to coarse app roles for navigation defaults. */
    roles: mappedApiRoles,
    role,
    permissions,
    setRole,
  }
}
