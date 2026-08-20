import { useQuery } from '@tanstack/react-query'
import { FileSpreadsheet } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ReportCommonFilters } from '@/features/reports/components/ReportCommonFilters'
import { ReportPillTabs } from '@/features/reports/components/ReportPillTabs'
import { ReportTableToolbar } from '@/features/reports/components/ReportTableToolbar'
import { useReportCommonFilters } from '@/features/reports/hooks/useReportCommonFilters'
import { VehiclePerformanceTab } from '@/features/reports/pages/vehicle/components/VehiclePerformanceTab'
import {
  fetchVehicleEfficiencyByModel,
  fetchVehicleReportPage,
} from '@/features/reports/pages/vehicle/lib/vehicle-reports-api'
import {
  ListPanelMessage,
  MobileListCard,
  MobileListField,
} from '@/shared/components/MobileListCard'
import { PageHeader } from '@/shared/components/PageHeader'
import { TablePagination } from '@/shared/components/TablePagination'

const REPORT_TABS = [
  { value: 'register', label: 'Master Register' },
  { value: 'performance', label: 'Performance' },
] as const

type ReportTab = (typeof REPORT_TABS)[number]['value']

const VEHICLE_REPORT_COLUMNS = [
  'Vehicle Number',
  'Make/Model',
  'Year',
  'Fuel Type',
  'Current Agency',
  'Vehicle Category',
  'Status',
  'Movement Status',
] as const

function vehicleStatusBadgeClass(status: string): string {
  return status.toLowerCase() === 'active'
    ? 'rounded-full bg-[#d7f8e8] px-2 py-1 text-xs text-[#0f8e5c]'
    : 'rounded-full bg-[#fff4cc] px-2 py-1 text-xs text-[#9f7b00]'
}

export default function VehicleReports() {
  const commonFilters = useReportCommonFilters()
  const [activeTab, setActiveTab] = useState<ReportTab>('register')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const listQueryKey = [
    'vehicle-reports',
    search,
    page,
    pageSize,
    commonFilters.params,
  ] as const

  const vehicleReportQuery = useQuery({
    queryKey: listQueryKey,
    queryFn: () =>
      fetchVehicleReportPage({
        page,
        pageSize,
        search,
        common: commonFilters.params,
      }),
    enabled: activeTab === 'register',
    staleTime: 30_000,
  })

  const performanceQuery = useQuery({
    queryKey: ['vehicle-reports-efficiency-by-model', commonFilters.params],
    queryFn: () => fetchVehicleEfficiencyByModel(commonFilters.params),
    enabled: activeTab === 'performance',
    staleTime: 30_000,
  })

  const rows = vehicleReportQuery.data?.rows ?? []
  const performanceRows = performanceQuery.data ?? []
  const totalCount = vehicleReportQuery.data?.totalCount ?? 0
  const totalPages =
    vehicleReportQuery.data?.totalPages ??
    Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize)))
  const serialBase = vehicleReportQuery.data?.serialBase ?? (page - 1) * pageSize

  useEffect(() => {
    setPage(1)
  }, [
    search,
    pageSize,
    activeTab,
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
      commonFilters.agencyId ||
      commonFilters.fromDate ||
      commonFilters.toDate,
  )

  const emptyMessage = hasActiveFilters
    ? 'No vehicles match your filters.'
    : 'No vehicles found.'

  const performanceErrorMessage =
    performanceQuery.error instanceof Error
      ? performanceQuery.error.message
      : 'Could not load model performance report.'

  const vehicleCountLabel = vehicleReportQuery.isLoading
    ? 'Loading vehicles…'
    : `${totalCount.toLocaleString('en-BT')} vehicle${totalCount === 1 ? '' : 's'}`

  const modelCountLabel = performanceQuery.isLoading
    ? 'Loading model performance…'
    : `${performanceRows.length.toLocaleString('en-BT')} model${
        performanceRows.length === 1 ? '' : 's'
      } compared`

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Vehicle Reports"
          subtitle={activeTab === 'register' ? vehicleCountLabel : modelCountLabel}
        />
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

      <ReportPillTabs
        tabs={REPORT_TABS}
        value={activeTab}
        onValueChange={(next) => {
          setActiveTab(next)
          setSearch('')
        }}
        aria-label="Vehicle report sections"
      />

      {activeTab === 'performance' ? (
        <>
          <ReportCommonFilters
            fromDate={commonFilters.fromDate}
            toDate={commonFilters.toDate}
            org={commonFilters.org}
            onFromDateChange={commonFilters.setFromDate}
            onToDateChange={commonFilters.setToDate}
            onOrgChange={commonFilters.setOrg}
            showAgency={commonFilters.showAgencyFilter}
          />

          <VehiclePerformanceTab
            rows={performanceRows}
            isLoading={performanceQuery.isLoading}
            isError={performanceQuery.isError}
            errorMessage={performanceErrorMessage}
          />
        </>
      ) : (
        <Card className="min-w-0 rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
          <CardContent className="min-w-0 space-y-4 p-0">
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-[var(--fms-text-header)]">
                Vehicle Inventory
              </h2>

              <ReportTableToolbar
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search..."
                searchAriaLabel="Search vehicle report"
                fromDate={commonFilters.fromDate}
                toDate={commonFilters.toDate}
                org={commonFilters.org}
                onFromDateChange={commonFilters.setFromDate}
                onToDateChange={commonFilters.setToDate}
                onOrgChange={commonFilters.setOrg}
                showAgency={commonFilters.showAgencyFilter}
              />
            </div>

            <div className="hidden w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
              <table className="w-max min-w-full text-sm">
                <thead className="bg-[#f6f6f7]">
                  <tr>
                    {VEHICLE_REPORT_COLUMNS.map((column) => (
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
                  {vehicleReportQuery.isLoading ? (
                    <tr className="border-t border-[var(--fms-strokes)]">
                      <td
                        colSpan={VEHICLE_REPORT_COLUMNS.length}
                        className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                      >
                        Loading vehicle report…
                      </td>
                    </tr>
                  ) : vehicleReportQuery.isError ? (
                    <tr className="border-t border-[var(--fms-strokes)]">
                      <td
                        colSpan={VEHICLE_REPORT_COLUMNS.length}
                        className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                      >
                        {vehicleReportQuery.error instanceof Error
                          ? vehicleReportQuery.error.message
                          : 'Could not load vehicle report.'}
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr className="border-t border-[var(--fms-strokes)]">
                      <td
                        colSpan={VEHICLE_REPORT_COLUMNS.length}
                        className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                      >
                        {emptyMessage}
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.id} className="border-t border-[var(--fms-strokes)]">
                        <td className="px-4 py-3 font-medium text-[var(--fms-text-header)]">
                          {row.vehicleNumber}
                        </td>
                        <td className="px-4 py-3 text-[var(--fms-text-header)]">{row.makeModel}</td>
                        <td className="px-4 py-3 tabular-nums text-[var(--fms-text-header)]">
                          {row.year}
                        </td>
                        <td className="px-4 py-3 text-[var(--fms-text-header)]">{row.fuelType}</td>
                        <td className="px-4 py-3 text-[var(--fms-text-header)]">
                          {row.currentAgency}
                        </td>
                        <td className="px-4 py-3 text-[var(--fms-text-header)]">
                          {row.vehicleCategory}
                        </td>
                        <td className="px-4 py-3">
                          <span className={vehicleStatusBadgeClass(row.status)}>{row.status}</span>
                        </td>
                        <td className="px-4 py-3 text-[var(--fms-text-header)]">
                          {row.movementStatus}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {vehicleReportQuery.isLoading ? (
                <ListPanelMessage>Loading vehicle report…</ListPanelMessage>
              ) : vehicleReportQuery.isError ? (
                <ListPanelMessage tone="error">
                  {vehicleReportQuery.error instanceof Error
                    ? vehicleReportQuery.error.message
                    : 'Could not load vehicle report.'}
                </ListPanelMessage>
              ) : rows.length === 0 ? (
                <ListPanelMessage>{emptyMessage}</ListPanelMessage>
              ) : (
                rows.map((row, index) => (
                  <MobileListCard key={row.id}>
                    <MobileListField label="Sl.No">{serialBase + index + 1}</MobileListField>
                    <MobileListField label="Vehicle Number">{row.vehicleNumber}</MobileListField>
                    <MobileListField label="Make/Model">{row.makeModel}</MobileListField>
                    <MobileListField label="Year">{row.year}</MobileListField>
                    <MobileListField label="Fuel Type">{row.fuelType}</MobileListField>
                    <MobileListField label="Current Agency">{row.currentAgency}</MobileListField>
                    <MobileListField label="Vehicle Category">
                      {row.vehicleCategory}
                    </MobileListField>
                    <MobileListField label="Status">
                      <span className={vehicleStatusBadgeClass(row.status)}>{row.status}</span>
                    </MobileListField>
                    <MobileListField label="Movement Status">{row.movementStatus}</MobileListField>
                  </MobileListCard>
                ))
              )}
            </div>

            <TablePagination
              page={page}
              totalPages={totalPages}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={(nextPage) => setPage(Math.max(1, Math.min(nextPage, totalPages)))}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize)
                setPage(1)
              }}
            />
          </CardContent>
        </Card>
      )}
    </section>
  )
}
