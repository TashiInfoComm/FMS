// Resolves the heading text every role dashboard shows: role title, scope and the user's name.
import { useMemo } from 'react'

import { mapUserDetailFields } from '@/features/user/lib/users-api'
import { useUserStore } from '@/services/user-store'
import { useAccessControl } from '@/shared/hooks/useAccessControl'
import { formatRealmRoleTitle } from '@/shared/lib/format-realm-role-display'

/** Roles whose dashboard covers every agency rather than a single one. */
const NATIONWIDE_ROLES = new Set(['fms-super-admin', 'fms-highest-admin'])

export type DashboardIdentity = {
  role: string
  roleTitle: string
  /** Agency (or nationwide) the figures belong to; empty when unknown. */
  scopeLabel: string
  fullName: string
  firstName: string
  /** Signed-in user id, used as the driver id on per-driver endpoints. */
  userId: string
}

/** @param apiScopeLabel Scope reported by `/dashboard/summary`, which wins when present. */
export function useDashboardIdentity(apiScopeLabel?: string): DashboardIdentity {
  const user = useUserStore((state) => state.user)
  const { role } = useAccessControl()

  const details = useMemo(() => {
    const record = user && typeof user === 'object' && !Array.isArray(user) ? user : null
    if (!record) return null
    return mapUserDetailFields(record as Record<string, unknown>)
  }, [user])

  const roleString = String(role)
  const fullName = details?.name && details.name !== '-' ? details.name : ''
  const agency = details?.agency && details.agency !== '-' ? details.agency : ''
  const userId = details?.id && details.id !== '-' ? details.id : ''

  const scopeLabel =
    apiScopeLabel || (NATIONWIDE_ROLES.has(roleString) ? 'All Agencies · Nationwide' : agency)

  return {
    role: roleString,
    roleTitle: formatRealmRoleTitle(roleString),
    scopeLabel,
    fullName,
    firstName: fullName.split(/\s+/)[0] ?? '',
    userId,
  }
}
