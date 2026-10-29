// Shared gate for features limited to users who handle designated vehicles.
// Pass the realm roles for the feature (renewal today; fuel, parking, and others later).
import { useUserStore } from '@/services/user-store'
import { mapApiRoleValue } from '@/shared/lib/realm-role-mapping'

/** Roles that also see Maintenance → Renewal when they handle designated vehicles. */
export const DESIGNATED_RENEWAL_ROLES = [
  'fms-mto',
  'fms-finance-officer',
  'fms-accountant',
] as const

/** Roles that can add a fuel log when they handle designated vehicles. */
export const DESIGNATED_FUEL_LOG_ROLES = ['fms-mto'] as const

/** Roles that see Parking Expense Logs when they handle designated vehicles. */
export const DESIGNATED_PARKING_LOG_ROLES = ['fms-mto'] as const

const AGENCY_ADMIN_ROLE = 'fms-agency-admin'
const FINANCE_OFFICER_ROLE = 'fms-finance-officer'
const ACCOUNTANT_ROLE = 'fms-accountant'
const DRIVER_ROLE = 'fms-driver'
const MTO_ROLE = 'fms-mto'

function matchesRenewalActorRole(activeRole: string | null | undefined, slug: string): boolean {
  if (roleMatches(activeRole, slug)) return true
  const token = slug.replace(/^fms-/, '')
  const raw = (activeRole ?? '').trim().toLowerCase().replace(/[\s_]+/g, '-')
  return raw === token || raw.endsWith(`-${token}`)
}

function isTruthyFlag(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true'
}

/** `handles_designated_vehicles` on the profile saved from `/auth/me` into the user store. */
export function userHandlesDesignatedVehicles(user: unknown): boolean {
  if (!user || typeof user !== 'object' || Array.isArray(user)) return false
  return isTruthyFlag((user as Record<string, unknown>).handles_designated_vehicles)
}

/** True when the active role matches `slug`, including legacy labels mapped to realm slugs. */
export function roleMatches(role: string | null | undefined, slug: string): boolean {
  const raw = role?.trim() ?? ''
  if (!raw) return false
  const target = slug.toLowerCase()
  if (raw.toLowerCase() === target) return true
  const mapped = mapApiRoleValue(raw)
  return mapped !== null && String(mapped).toLowerCase() === target
}

/** True when the active role matches any slug in `roles`. */
export function roleMatchesAny(
  role: string | null | undefined,
  roles: readonly string[],
): boolean {
  const raw = role?.trim().toLowerCase() ?? ''
  if (raw && roles.some((slug) => slug.toLowerCase() === raw)) return true
  const mapped = mapApiRoleValue(role)
  if (mapped === null) return false
  const mappedSlug = String(mapped).toLowerCase()
  return roles.some((slug) => slug.toLowerCase() === mappedSlug)
}

/**
 * True when the signed-in user has `handles_designated_vehicles` and the active role
 * is one of `roles`. Each module passes its own role list.
 */
export function canAccessDesignatedFeature(
  activeRole: string | null | undefined,
  roles: readonly string[],
): boolean {
  return (
    roleMatchesAny(activeRole, roles) &&
    userHandlesDesignatedVehicles(useUserStore.getState().user)
  )
}

/** Agency admin never sees the Maintenance Renewal submenu. */
export function isAgencyAdminRole(role: string | null | undefined): boolean {
  return roleMatches(role, AGENCY_ADMIN_ROLE)
}

/** Active roles that are force-shown Renewal when they handle designated vehicles. */
export function isDesignatedRenewalRole(role: string | null | undefined): boolean {
  return roleMatchesAny(role, DESIGNATED_RENEWAL_ROLES)
}

/**
 * True when the signed-in user handles designated vehicles
 * and the active role is MTO, finance officer, or accountant.
 */
export function canShowMaintenanceRenewalMenu(activeRole: string | null | undefined): boolean {
  return canAccessDesignatedFeature(activeRole, DESIGNATED_RENEWAL_ROLES)
}

/**
 * True when the active role is MTO, finance officer, or accountant
 * and the profile has `handles_designated_vehicles`.
 * Pass `user` from the store subscription so the check updates after `/auth/me` hydrates.
 */
export function canFilterDesignatedVehicleLists(
  activeRole: string | null | undefined,
  user?: unknown,
): boolean {
  const profile = user === undefined ? useUserStore.getState().user : user
  if (!userHandlesDesignatedVehicles(profile)) return false
  return DESIGNATED_RENEWAL_ROLES.some((slug) => matchesRenewalActorRole(activeRole, slug))
}

/**
 * True when the active role is MTO and the profile has `handles_designated_vehicles`.
 * Pass `user` from the store subscription so the check updates after `/auth/me` hydrates.
 */
export function canShowDesignatedFuelLogCreate(
  activeRole: string | null | undefined,
  user?: unknown,
): boolean {
  const profile = user === undefined ? useUserStore.getState().user : user
  return (
    roleMatchesAny(activeRole, DESIGNATED_FUEL_LOG_ROLES) &&
    userHandlesDesignatedVehicles(profile)
  )
}

/**
 * Finance officer may verify a renewal, including a finance officer
 * whose profile has `handles_designated_vehicles`.
 */
export function canVerifyRenewalApplication(activeRole: string | null | undefined): boolean {
  return matchesRenewalActorRole(activeRole, FINANCE_OFFICER_ROLE)
}

/**
 * Accountant may proceed with a renewal, including an accountant
 * whose profile has `handles_designated_vehicles`.
 */
export function canProceedRenewalApplication(activeRole: string | null | undefined): boolean {
  return matchesRenewalActorRole(activeRole, ACCOUNTANT_ROLE)
}

/**
 * Driver, or MTO whose profile has `handles_designated_vehicles`.
 * Pass `user` from the store subscription so the check updates after `/auth/me` hydrates.
 */
export function canDriverOrDesignatedMtoActOnRenewal(
  activeRole: string | null | undefined,
  user?: unknown,
): boolean {
  if (matchesRenewalActorRole(activeRole, DRIVER_ROLE)) return true
  const profile = user === undefined ? useUserStore.getState().user : user
  return matchesRenewalActorRole(activeRole, MTO_ROLE) && userHandlesDesignatedVehicles(profile)
}

/**
 * True when the active role is MTO and the profile has `handles_designated_vehicles`.
 * Pass `user` from the store subscription so the check updates after `/auth/me` hydrates.
 */
export function canShowDesignatedParkingLog(
  activeRole: string | null | undefined,
  user?: unknown,
): boolean {
  const profile = user === undefined ? useUserStore.getState().user : user
  return (
    roleMatchesAny(activeRole, DESIGNATED_PARKING_LOG_ROLES) &&
    userHandlesDesignatedVehicles(profile)
  )
}
