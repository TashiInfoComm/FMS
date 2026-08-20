import { useQuery } from '@tanstack/react-query'
import { FileSpreadsheet } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  formatParkingClaimStatusLabel,
  ParkingClaimStatusCell,
} from '@/features/parking/components/ParkingClaimStatusCell'
import type { ParkingClaimStatus } from '@/features/parking/lib/parking-logs-api'
import { ReportTableToolbar } from '@/features/reports/components/ReportTableToolbar'
import { useReportCommonFilters } from '@/features/reports/hooks/useReportCommonFilters'
import {
  fetchParkingReportPage,
  formatParkingReportAmount,
} from '@/features/reports/pages/parking/lib/parking-reports-api'
import { SearchableAutocomplete } from '@/shared/components/SearchableAutocomplete'
import {
  ListPanelMessage,
  MobileListCard,
  MobileListField,
} from '@/shared/components/MobileListCard'
import { PageHeader } from '@/shared/components/PageHeader'
import { TablePagination } from '@/shared/components/TablePagination'

const REPORT_COLUMNS = [
  'Driver',
  'Agency',
  'Department',
  'Division',
  'Sub-division',
  'Month & Year',
  'Receipts',
  'Claim Amount',
  'Status',
] as const

const STATUS_FILTER_OPTIONS: { value: ParkingClaimStatus | ''; label: string }[] = [
  { value: '', label: 'Status: All' },
  { value: 'PENDING_APPROVAL', label: formatParkingClaimStatusLabel('PENDING_APPROVAL') },
  { value: 'APPROVED', label: formatParkingClaimStatusLabel('APPROVED') },
  { value: 'PAID', label: formatParkingClaimStatusLabel('PAID') },
  { value: 'REJECTED', label: formatParkingClaimStatusLabel('REJECTED') },
]

export default function ParkingReports() {
  const commonFilters = useReportCommonFilters()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ParkingClaimStatus | ''>('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const listQueryKey = [
    'parking-reports',
    search,
    statusFilter,
    page,
    pageSize,
    commonFilters.params,
  ] as const

  const parkingReportQuery = useQuery({
    queryKey: listQueryKey,
    queryFn: () =>
      fetchParkingReportPage({
        page,
        pageSize,
        search,
        status: statusFilter,
        common: commonFilters.params,
      }),
    staleTime: 30_000,
  })

  const rows = parkingReportQuery.data?.rows ?? []
  const totalCount = parkingReportQuery.data?.totalCount ?? 0
  const effectivePageSize = parkingReportQuery.data?.effectivePageSize ?? pageSize
  const totalPages =
    parkingReportQuery.data?.totalPages ??
    Math.max(1, Math.ceil(totalCount / Math.max(1, effectivePageSize)))
  const serialBase = parkingReportQuery.data?.serialBase ?? (page - 1) * effectivePageSize

  useEffect(() => {
    setPage(1)
  }, [
    search,
    statusFilter,
    pageSize,
    commonFilters.fromDate,
    commonFilters.toDate,
    commonFilters.agencyId,
  ])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const handleExport = () => {
    window.alert('Excel export will be available once the export API is connected.')
  }

  const hasActiveFilters = Boolean(
    search.trim() ||
      statusFilter ||
      commonFilters.agencyId ||
      commonFilters.fromDate ||
      commonFilters.toDate,
  )

  const emptyMessage = hasActiveFilters
    ? 'No monthly claims match your filters.'
    : 'No monthly claims found.'

  const claimCountLabel = parkingReportQuery.isLoading
    ? 'Loading monthly claims…'
    : `${totalCount.toLocaleString('en-BT')} monthly claim${totalCount === 1 ? '' : 's'}`

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title="Parking Reports" subtitle={claimCountLabel} />
        <Button
          type="button"
          variant="outline"
          onClick={handleExport}
          className="w-full border-[var(--fms-strokes)] bg-white text-[var(--fms-text-header)] hover:bg-[#fafafa] sm:w-auto"
        >
          <FileSpreadsheet className="mr-1 h-4 w-4" />
          Export Excel
        </Button>
      </div>

      <Card className="min-w-0 rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="min-w-0 space-y-4 p-0">
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-[var(--fms-text-header)]">
              Monthly Reimbursement Claims
            </h2>

            <ReportTableToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search..."
              searchAriaLabel="Search parking report"
              fromDate={commonFilters.fromDate}
              toDate={commonFilters.toDate}
              org={commonFilters.org}
              onFromDateChange={commonFilters.setFromDate}
              onToDateChange={commonFilters.setToDate}
              onOrgChange={commonFilters.setOrg}
              showAgency={commonFilters.showAgencyFilter}
              extraFilters={
                <SearchableAutocomplete
                  value={statusFilter || 'all'}
                  onChange={(value) =>
                    setStatusFilter(value === 'all' ? '' : (value as ParkingClaimStatus))
                  }
                  options={STATUS_FILTER_OPTIONS.map((option) => ({
                    value: option.value || 'all',
                    label: option.label,
                    searchText: option.label,
                  }))}
                  placeholder="Status: All"
                  searchPlaceholder="Search status…"
                  emptyMessage="No matching status."
                  className="w-full sm:w-56"
                />
              }
            />
          </div>

          <div className="hidden w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
            <table className="w-max min-w-full text-sm">
              <thead className="bg-[#f6f6f7]">
                <tr>
                  {REPORT_COLUMNS.map((column) => (
                    <th
                      key={column}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--fms-text-subheading)]"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parkingReportQuery.isLoading ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={REPORT_COLUMNS.length}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      Loading parking report…
                    </td>
                  </tr>
                ) : parkingReportQuery.isError ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={REPORT_COLUMNS.length}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      {parkingReportQuery.error instanceof Error
                        ? parkingReportQuery.error.message
                        : 'Could not load parking report.'}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={REPORT_COLUMNS.length}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-t border-[var(--fms-strokes)]">
                      <td className="px-4 py-3 font-semibold text-[var(--fms-text-header)]">
                        {row.driver}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">{row.agency}</td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">{row.department}</td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">{row.division}</td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">{row.subDivision}</td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">{row.monthLabel}</td>
                      <td className="px-4 py-3 tabular-nums text-[var(--fms-text-header)]">
                        {row.receipts.toLocaleString('en-BT')}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[var(--fms-text-header)]">
                        {formatParkingReportAmount(row.claimAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <ParkingClaimStatusCell status={row.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {parkingReportQuery.isLoading ? (
              <ListPanelMessage>Loading parking report…</ListPanelMessage>
            ) : parkingReportQuery.isError ? (
              <ListPanelMessage tone="error">
                {parkingReportQuery.error instanceof Error
                  ? parkingReportQuery.error.message
                  : 'Could not load parking report.'}
              </ListPanelMessage>
            ) : rows.length === 0 ? (
              <ListPanelMessage>{emptyMessage}</ListPanelMessage>
            ) : (
              rows.map((row, index) => (
                <MobileListCard key={row.id}>
                  <MobileListField label="Sl.No">{serialBase + index + 1}</MobileListField>
                  <MobileListField label="Driver">{row.driver}</MobileListField>
                  <MobileListField label="Agency">{row.agency}</MobileListField>
                  <MobileListField label="Department">{row.department}</MobileListField>
                  <MobileListField label="Division">{row.division}</MobileListField>
                  <MobileListField label="Sub-division">{row.subDivision}</MobileListField>
                  <MobileListField label="Month & Year">{row.monthLabel}</MobileListField>
                  <MobileListField label="Receipts">
                    {row.receipts.toLocaleString('en-BT')}
                  </MobileListField>
                  <MobileListField label="Claim Amount">
                    {formatParkingReportAmount(row.claimAmount)}
                  </MobileListField>
                  <MobileListField label="Status">
                    <ParkingClaimStatusCell status={row.status} />
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
