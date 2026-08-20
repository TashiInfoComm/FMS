import { useEffect, useMemo, useState } from 'react'

import {
  canShowAgencyFilter,
  EMPTY_REPORT_COMMON_FILTERS,
  EMPTY_REPORT_ORG_FILTER,
  hasReportOrgFilter,
  resolveReportOrgFilterAgencyId,
  toReportCommonFilterParams,
  type ReportCommonFilterParams,
  type ReportCommonFilterValues,
  type ReportOrgFilterValues,
} from '@/features/reports/lib/report-common-filters'
import { useAccessControl } from '@/shared/hooks/useAccessControl'

type UseReportCommonFiltersResult = {
  values: ReportCommonFilterValues
  fromDate: string
  toDate: string
  org: ReportOrgFilterValues
  /** Lowest selected organogram id (for active-filter checks and API `agency_id`). */
  agencyId: string
  setFromDate: (value: string) => void
  setToDate: (value: string) => void
  setOrg: (next: Partial<ReportOrgFilterValues>) => void
  setValues: (next: Partial<ReportCommonFilterValues>) => void
  reset: () => void
  /** True for Highest admin / super-admin; false for MTO and other roles. */
  showAgencyFilter: boolean
  /** Ready-to-send query params (agency omitted when hidden). */
  params: ReportCommonFilterParams
}

/**
 * Shared From / To / organogram filter state for every report page.
 * Agency hierarchy is only exposed for Highest admin (and super-admin); MTO never receives `agency_id`.
 */
export function useReportCommonFilters(
  initial?: Partial<ReportCommonFilterValues>,
): UseReportCommonFiltersResult {
  const { role } = useAccessControl()
  const showAgencyFilter = canShowAgencyFilter(role)

  const [values, setValuesState] = useState<ReportCommonFilterValues>(() => ({
    ...EMPTY_REPORT_COMMON_FILTERS,
    ...initial,
    org: { ...EMPTY_REPORT_ORG_FILTER, ...initial?.org },
  }))

  const agencyId = useMemo(
    () => resolveReportOrgFilterAgencyId(values.org),
    [values.org],
  )

  // Clear organogram when the active role can no longer filter by it (e.g. role switcher).
  useEffect(() => {
    if (!showAgencyFilter && hasReportOrgFilter(values.org)) {
      setValuesState((prev) => ({ ...prev, org: { ...EMPTY_REPORT_ORG_FILTER } }))
    }
  }, [showAgencyFilter, values.org])

  const params = useMemo(
    () =>
      toReportCommonFilterParams(values, {
        includeAgency: showAgencyFilter,
      }),
    [values, showAgencyFilter],
  )

  return {
    values,
    fromDate: values.fromDate,
    toDate: values.toDate,
    org: values.org,
    agencyId,
    setFromDate: (fromDate) => setValuesState((prev) => ({ ...prev, fromDate })),
    setToDate: (toDate) => setValuesState((prev) => ({ ...prev, toDate })),
    setOrg: (next) =>
      setValuesState((prev) => ({
        ...prev,
        org: { ...prev.org, ...next },
      })),
    setValues: (next) =>
      setValuesState((prev) => ({
        ...prev,
        ...next,
        org: next.org ? { ...prev.org, ...next.org } : prev.org,
      })),
    reset: () => setValuesState({ ...EMPTY_REPORT_COMMON_FILTERS }),
    showAgencyFilter,
    params,
  }
}
