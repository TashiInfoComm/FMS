import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { LoanRequisitionStatusCell } from '@/features/inter-agency-vehicle-loan/components/LoanRequisitionStatusCell'
import type { LoanRequisitionStatus } from '@/features/inter-agency-vehicle-loan/lib/loan-requisition-types'
import {
  LOAN_REQUISITION_STATUS_OPTIONS,
  formatLoanDate,
  formatLoanRequisitionStatusLabel,
} from '@/features/inter-agency-vehicle-loan/lib/loan-requisition-ui'
import { ReportExportActions } from '@/features/reports/components/ReportExportActions'
import { ReportPillTabs } from '@/features/reports/components/ReportPillTabs'
import { ReportTableToolbar } from '@/features/reports/components/ReportTableToolbar'
import { useReportCommonFilters } from '@/features/reports/hooks/useReportCommonFilters'
import { isHighestAdminRole } from '@/features/reports/lib/report-common-filters'
import { fetchVehicleLoanRequisitionReportPage } from '@/features/reports/pages/vehicleLoan/lib/vehicle-loan-reports-api'
import { SearchableAutocomplete } from '@/shared/components/SearchableAutocomplete'
import {
  ListPanelMessage,
  MobileListCard,
  MobileListField,
} from '@/shared/components/MobileListCard'
import { PageHeader } from '@/shared/components/PageHeader'
import { TablePagination } from '@/shared/components/TablePagination'
import { useAccessControl } from '@/shared/hooks/useAccessControl'

const REPORT_TABS = [
  { value: 'borrowing', label: 'Borrowing List' },
  { value: 'lending', label: 'Lending Request List' },
] as const

type ReportTab = (typeof REPORT_TABS)[number]['value']

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  ...LOAN_REQUISITION_STATUS_OPTIONS.map((status) => ({
    value: status,
    label: formatLoanRequisitionStatusLabel(status),
  })),
]

export default function VehicleLoanReports() {
  const { role } = useAccessControl()
  const isHighestAdmin = isHighestAdminRole(role)
  const commonFilters = useReportCommonFilters()
  const [activeTab, setActiveTab] = useState<ReportTab>('borrowing')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<LoanRequisitionStatus | ''>('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const asLending = !isHighestAdmin && activeTab === 'lending'

  const listQueryKey = [
    'vehicle-loan-reports',
    activeTab,
    search,
    statusFilter,
    page,
    pageSize,
    commonFilters.params,
  ] as const

  const loanReportQuery = useQuery({
    queryKey: listQueryKey,
    queryFn: () =>
      fetchVehicleLoanRequisitionReportPage({
        page,
        pageSize,
        search,
        asLending,
        status: statusFilter,
        common: commonFilters.params,
      }),
    staleTime: 30_000,
  })

  const rows = loanReportQuery.data?.rows ?? []
  const totalCount = loanReportQuery.data?.totalCount ?? 0
  const effectivePageSize = loanReportQuery.data?.effectivePageSize ?? pageSize
  const totalPages =
    loanReportQuery.data?.totalPages ??
    Math.max(1, Math.ceil(totalCount / Math.max(1, effectivePageSize)))
  const serialBase = loanReportQuery.data?.serialBase ?? (page - 1) * effectivePageSize
  const showLendingAgency =
    asLending ||
    rows.some((row) => row.lendingAgency.trim() && row.lendingAgency !== '—')
  const tableColumnCount = showLendingAgency ? 7 : 6

  useEffect(() => {
    setPage(1)
  }, [
    search,
    statusFilter,
    pageSize,
    activeTab,
    commonFilters.fromDate,
    commonFilters.toDate,
    commonFilters.agencyId,
  ])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const handleExport = (format: 'xlsx' | 'pdf') => {
    window.alert(
      `${format === 'pdf' ? 'PDF' : 'Excel'} export will be available once the export API is connected.`,
    )
  }

  const hasActiveFilters = Boolean(
    search.trim() ||
      statusFilter ||
      commonFilters.agencyId ||
      commonFilters.fromDate ||
      commonFilters.toDate,
  )

  const emptyMessage = hasActiveFilters
    ? 'No requisitions match your filters.'
    : asLending
      ? 'No lending requests found.'
      : 'No borrowing requisitions found.'

  const loanCountLabel = loanReportQuery.isLoading
    ? 'Loading requisitions…'
    : `${totalCount.toLocaleString('en-BT')} requisition${totalCount === 1 ? '' : 's'}`

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title={isHighestAdmin ? 'Vehicle loan report' : 'Vehicle Loan Reports'}
          subtitle={loanCountLabel}
        />
        <ReportExportActions onExport={handleExport} />
      </div>

      {!isHighestAdmin ? (
        <ReportPillTabs
          tabs={REPORT_TABS}
          value={activeTab}
          onValueChange={(next) => {
            setActiveTab(next)
            setSearch('')
            setStatusFilter('')
          }}
          aria-label="Vehicle loan report types"
        />
      ) : null}

      <Card className="min-w-0 rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="min-w-0 space-y-4 p-0">
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-[var(--fms-text-header)]">
              {asLending ? 'Lending Request List' : 'Borrowing List'}
            </h2>

            <ReportTableToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search ..."
              searchAriaLabel={
                asLending ? 'Search lending request list' : 'Search borrowing list'
              }
              fromDate={commonFilters.fromDate}
              toDate={commonFilters.toDate}
              org={commonFilters.org}
              onFromDateChange={commonFilters.setFromDate}
              onToDateChange={commonFilters.setToDate}
              onOrgChange={commonFilters.setOrg}
              showAgency={commonFilters.showAgencyFilter}
              extraFilters={
                <SearchableAutocomplete
                  value={statusFilter}
                  onChange={(value) => setStatusFilter(value as LoanRequisitionStatus | '')}
                  options={STATUS_FILTER_OPTIONS}
                  placeholder="All Statuses"
                  searchPlaceholder="Search status…"
                  emptyMessage="No matching status."
                  className="w-full sm:w-56"
                />
              }
            />
          </div>

          <div className="hidden w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
            <table className="w-max min-w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Request ID</th>
                  <th className="px-4 py-3 text-left font-semibold">Borrowing Agency</th>
                  {showLendingAgency ? (
                    <th className="px-4 py-3 text-left font-semibold">Lending Agency</th>
                  ) : null}
                  <th className="px-4 py-3 text-left font-semibold">No. of Vehicle Requested</th>
                  <th className="px-4 py-3 text-left font-semibold">Start Date</th>
                  <th className="px-4 py-3 text-left font-semibold">End Date</th>
                  <th className="px-4 py-3 text-center font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {loanReportQuery.isLoading ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={tableColumnCount}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      Loading requisitions…
                    </td>
                  </tr>
                ) : loanReportQuery.isError ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={tableColumnCount}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      {loanReportQuery.error instanceof Error
                        ? loanReportQuery.error.message
                        : 'Could not load vehicle loan report.'}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={tableColumnCount}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-t border-[var(--fms-strokes)]">
                      <td className="px-4 py-3 font-medium text-[var(--fms-text-header)]">
                        {row.requestId}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">
                        {row.borrowingAgency}
                      </td>
                      {showLendingAgency ? (
                        <td className="px-4 py-3 text-[var(--fms-text-header)]">
                          {row.lendingAgency}
                        </td>
                      ) : null}
                      <td className="px-4 py-3 tabular-nums text-[var(--fms-text-header)]">
                        {row.numberOfVehicles.toLocaleString('en-BT')}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">
                        {formatLoanDate(row.startDate)}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">
                        {formatLoanDate(row.endDate)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <LoanRequisitionStatusCell status={row.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {loanReportQuery.isLoading ? (
              <ListPanelMessage>Loading requisitions…</ListPanelMessage>
            ) : loanReportQuery.isError ? (
              <ListPanelMessage tone="error">
                {loanReportQuery.error instanceof Error
                  ? loanReportQuery.error.message
                  : 'Could not load vehicle loan report.'}
              </ListPanelMessage>
            ) : rows.length === 0 ? (
              <ListPanelMessage>{emptyMessage}</ListPanelMessage>
            ) : (
              rows.map((row, index) => (
                <MobileListCard key={row.id}>
                  <MobileListField label="Sl.No">{serialBase + index + 1}</MobileListField>
                  <MobileListField label="Request ID">{row.requestId}</MobileListField>
                  <MobileListField label="Borrowing Agency">{row.borrowingAgency}</MobileListField>
                  {showLendingAgency ? (
                    <MobileListField label="Lending Agency">{row.lendingAgency}</MobileListField>
                  ) : null}
                  <MobileListField label="No. of Vehicle Requested">
                    {row.numberOfVehicles.toLocaleString('en-BT')}
                  </MobileListField>
                  <MobileListField label="Start Date">
                    {formatLoanDate(row.startDate)}
                  </MobileListField>
                  <MobileListField label="End Date">{formatLoanDate(row.endDate)}</MobileListField>
                  <MobileListField label="Status">
                    <LoanRequisitionStatusCell status={row.status} />
                  </MobileListField>
                </MobileListCard>
              ))
            )}
          </div>

          <TablePagination
            page={page}
            totalPages={totalPages}
            pageSize={effectivePageSize}
            totalCount={totalCount}
            onPageChange={(nextPage) => setPage(Math.max(1, Math.min(nextPage, totalPages)))}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize)
              setPage(1)
            }}
          />
        </CardContent>
      </Card>
    </section>
  )
}
