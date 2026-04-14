import { useMemo, useState } from 'react'

import { DEFAULT_ROLE, ROLE_PERMISSIONS, type Permission, type Role } from '@/shared/constants/access-control'

export function useAccessControl() {
  const [role, setRoleState] = useState<Role>(() => (localStorage.getItem('fms-role') as Role | null) ?? DEFAULT_ROLE)

  const permissions = useMemo<Permission[]>(() => {
    const stored = localStorage.getItem('fms-permissions')
    if (!stored) return ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS[DEFAULT_ROLE]

    try {
      return JSON.parse(stored) as Permission[]
    } catch {
      return ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS[DEFAULT_ROLE]
    }
  }, [role])

  const setRole = (nextRole: Role) => {
    localStorage.setItem('fms-role', nextRole)
    localStorage.removeItem('fms-permissions')
    setRoleState(nextRole)
  }

  return { role, permissions, setRole }
}
