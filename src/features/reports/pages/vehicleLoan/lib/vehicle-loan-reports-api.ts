import { fetchLoansPage } from '@/features/inter-agency-vehicle-loan/lib/loan-requisition-api'
import type { LoanRequisitionListRow } from '@/features/inter-agency-vehicle-loan/lib/loan-requisition-types'
import type { LoanRequisitionStatus } from '@/features/inter-agency-vehicle-loan/lib/loan-requisition-types'
import type { ReportCommonFilterParams } from '@/features/reports/lib/report-common-filters'

export type VehicleLoanRequisitionReportResult = {
  rows: LoanRequisitionListRow[]
  totalCount: number
  totalPages: number
  effectivePageSize: number
  serialBase: number
}

export type VehicleLoanRequisitionReportQuery = {
  page: number
  pageSize: number
  search?: string
  asLending: boolean
  status?: LoanRequisitionStatus | ''
  common: ReportCommonFilterParams
}

/**
 * `GET /loans?as_lending=true|false`
 * Borrowing / lending requisition lists for vehicle loan reports.
 */
export async function fetchVehicleLoanRequisitionReportPage(
  query: VehicleLoanRequisitionReportQuery,
): Promise<VehicleLoanRequisitionReportResult> {
  const status = query.status?.trim() ? query.status : undefined
  const paged = await fetchLoansPage(
    query.search ?? '',
    query.page,
    query.pageSize,
    query.asLending,
    status,
    query.common,
  )

  const effectivePageSize = paged.effectivePageSize
  const serialBase = Math.max(0, (query.page - 1) * effectivePageSize)

  return {
    rows: paged.rows,
    totalCount: paged.totalCount,
    totalPages: paged.totalPages,
    effectivePageSize,
    serialBase,
  }
}

export type { LoanRequisitionListRow }
