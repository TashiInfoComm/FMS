// Each realm role gets its own dashboard composition, so the page picks a layout up front.
export type DashboardLayoutId =
  | 'nationwide'
  | 'agency'
  | 'dispatch'
  | 'finance'
  | 'driver'
  | 'applicant'

const LAYOUT_BY_ROLE: Record<string, DashboardLayoutId> = {
  'fms-super-admin': 'nationwide',
  'fms-highest-admin': 'nationwide',
  'fms-agency-admin': 'agency',
  'fms-mto': 'dispatch',
  'fms-finance-officer': 'finance',
  'fms-driver': 'driver',
  'fms-applicant': 'applicant',
}

/**
 * Layout for a realm role slug. Roles the realm may add later (e.g. an accountant)
 * fall back by keyword so they still land on the closest-matching dashboard.
 */
export function resolveDashboardLayout(role: string): DashboardLayoutId {
  const slug = role.trim().toLowerCase()
  const exact = LAYOUT_BY_ROLE[slug]
  if (exact) return exact

  if (/accountant|finance|audit/.test(slug)) return 'finance'
  if (/mto|transport.?officer|dispatch/.test(slug)) return 'dispatch'
  if (/driver/.test(slug)) return 'driver'
  if (/applicant|requester/.test(slug)) return 'applicant'
  if (/highest|nationwide|super/.test(slug)) return 'nationwide'

  return 'agency'
}
