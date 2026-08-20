import type { Role } from '@/shared/constants/access-control'

/** Cascading organogram selection for highest-admin report filters. */
export type ReportOrgFilterValues = {
  agencyId: string
  agencyCode: string
  departmentId: string
  departmentCode: string
  divisionId: string
  divisionCode: string
  subDivisionId: string
}

/** Shared filter values used across all report pages. */
export type ReportCommonFilterValues = {
  fromDate: string
  toDate: string
  org: ReportOrgFilterValues
}

/** Query params shared by report APIs (`date_from`, `date_to`, optional `agency_id`). */
export type ReportCommonFilterParams = {
  date_from?: string
  date_to?: string
  agency_id?: string
}

export const EMPTY_REPORT_ORG_FILTER: ReportOrgFilterValues = {
  agencyId: '',
  agencyCode: '',
  departmentId: '',
  departmentCode: '',
  divisionId: '',
  divisionCode: '',
  subDivisionId: '',
}

export const EMPTY_REPORT_COMMON_FILTERS: ReportCommonFilterValues = {
  fromDate: '',
  toDate: '',
  org: { ...EMPTY_REPORT_ORG_FILTER },
}

/** Lowest selected organogram id is sent as `agency_id` to report APIs. */
export function resolveReportOrgFilterAgencyId(org: ReportOrgFilterValues): string {
  return (
    org.subDivisionId.trim() ||
    org.divisionId.trim() ||
    org.departmentId.trim() ||
    org.agencyId.trim() ||
    ''
  )
}

export function hasReportOrgFilter(org: ReportOrgFilterValues): boolean {
  return Boolean(resolveReportOrgFilterAgencyId(org))
}

export function isHighestAdminRole(role: Role | null | undefined): boolean {
  if (!role) return false
  const slug = String(role).trim().toLowerCase()
  return (
    slug === 'fms-highest-admin' ||
    slug === 'highest-admin' ||
    slug.includes('highest-admin')
  )
}

/**
 * Highest admin (and super-admin) see Agency; MTO and other agency-scoped roles do not.
 * Active realm slug is often `fms-highest-admin` (UI: "Highest admin"), not only `fms-super-admin`.
 */
export function canShowAgencyFilter(role: Role | null | undefined): boolean {
  if (!role) return false
  const slug = String(role).trim().toLowerCase()
  return (
    slug === 'fms-highest-admin' ||
    slug === 'highest-admin' ||
    slug === 'fms-super-admin' ||
    slug === 'super-admin' ||
    slug.includes('highest-admin') ||
    slug.includes('super-admin')
  )
}

/** Builds API query params from common filters. Omits agency when the role cannot use it. */
export function toReportCommonFilterParams(
  values: ReportCommonFilterValues,
  options?: { includeAgency?: boolean },
): ReportCommonFilterParams {
  const params: ReportCommonFilterParams = {}
  const from = values.fromDate.trim()
  const to = values.toDate.trim()
  if (from) params.date_from = from
  if (to) params.date_to = to

  const includeAgency = options?.includeAgency ?? true
  const agencyId = resolveReportOrgFilterAgencyId(values.org)
  if (includeAgency && agencyId) params.agency_id = agencyId

  return params
}

/** Appends common report filters onto a `URLSearchParams` instance. */
export function appendReportCommonFilterParams(
  searchParams: URLSearchParams,
  params: ReportCommonFilterParams,
): void {
  if (params.date_from) searchParams.set('date_from', params.date_from)
  if (params.date_to) searchParams.set('date_to', params.date_to)
  if (params.agency_id) searchParams.set('agency_id', params.agency_id)
}
