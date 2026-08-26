import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { ReportExportActions } from '@/features/reports/components/ReportExportActions'
import { ReportPillTabs } from '@/features/reports/components/ReportPillTabs'
import { ReportTableToolbar } from '@/features/reports/components/ReportTableToolbar'
import { useReportCommonFilters } from '@/features/reports/hooks/useReportCommonFilters'
import {
  exportFuelReport,
  fetchFuelConsumptionReportPage,
  fetchFuelQuotaReportPage,
  formatAvgKmPerL,
  formatFuelLiters,
  formatFuelNu,
  type FuelReportExportFormat,
} from '@/features/reports/pages/fuel/lib/fuel-reports-api'
import {
  ListPanelMessage,
  MobileListCard,
  MobileListField,
} from '@/shared/components/MobileListCard'
import { PageHeader } from '@/shared/components/PageHeader'
import { TablePagination } from '@/shared/components/TablePagination'
import { showErrorToast } from '@/shared/lib/toast'

const REPORT_TABS = [
  { value: 'consumption', label: 'Consumption' },
  { value: 'quota', label: 'Quota' },
] as const

type ReportTab = (typeof REPORT_TABS)[number]['value']

const CONSUMPTION_COLUMNS = [
  'Vehicle',
  'Fuel Used',
  'Fuel Cost',
  'Avg Km/L',
] as const

const QUOTA_COLUMNS = [
  'Vehicle',
  'Allocated',
  'Used',
  'Remaining',
  'Utilization',
] as const

export default function FuelReports() {
  const commonFilters = useReportCommonFilters()
  const [activeTab, setActiveTab] = useState<ReportTab>('consumption')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [exportingFormat, setExportingFormat] = useState<FuelReportExportFormat | null>(null)

  const listQueryKey = [
    'fuel-reports',
    activeTab,
    search,
    page,
    pageSize,
    commonFilters.params,
  ] as const

  const consumptionQuery = useQuery({
    queryKey: [...listQueryKey, 'consumption'],
    queryFn: () =>
      fetchFuelConsumptionReportPage({
        page,
        pageSize,
        search,
        common: commonFilters.params,
      }),
    enabled: activeTab === 'consumption',
    staleTime: 30_000,
  })

  const quotaQuery = useQuery({
    queryKey: [...listQueryKey, 'quota'],
    queryFn: () =>
      fetchFuelQuotaReportPage({
        page,
        pageSize,
        search,
        common: commonFilters.params,
      }),
    enabled: activeTab === 'quota',
    staleTime: 30_000,
  })

  const activeQuery = activeTab === 'consumption' ? consumptionQuery : quotaQuery
  const consumptionRows = consumptionQuery.data?.rows ?? []
  const quotaRows = quotaQuery.data?.rows ?? []
  const totalCount = activeQuery.data?.totalCount ?? 0
  const totalPages =
    activeQuery.data?.totalPages ?? Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize)))
  const serialBase = activeQuery.data?.serialBase ?? (page - 1) * pageSize

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

  const handleExport = async (format: FuelReportExportFormat) => {
    if (exportingFormat) return
    setExportingFormat(format)
    try {
      await exportFuelReport({
        tab: activeTab,
        format,
        search,
        common: commonFilters.params,
      })
    } catch (error) {
      showErrorToast(error, 'Could not export fuel report.')
    } finally {
      setExportingFormat(null)
    }
  }

  const hasActiveFilters = Boolean(
    search.trim() ||
    commonFilters.agencyId ||
    commonFilters.fromDate ||
    commonFilters.toDate,
  )

  const consumptionEmptyMessage = hasActiveFilters
    ? 'No consumption records match your filters.'
    : 'No consumption records found.'
  const quotaEmptyMessage = hasActiveFilters
    ? 'No quota records match your filters.'
    : 'No quota records found.'

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title="Fuel Reports" />
        <ReportExportActions
          onExport={(format) => void handleExport(format)}
          exportingFormat={exportingFormat}
        />
      </div>

      <ReportPillTabs
        tabs={REPORT_TABS}
        value={activeTab}
        onValueChange={(next) => {
          setActiveTab(next)
          setSearch('')
        }}
        aria-label="Fuel report types"
      />

      <Card className="min-w-0 rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="min-w-0 space-y-4 p-0">
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-[var(--fms-text-header)]">
              {activeTab === 'consumption' ? 'Fuel Consumption Report' : 'Fuel Quota Report'}
            </h2>

            <ReportTableToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search..."
              searchAriaLabel={
                activeTab === 'consumption'
                  ? 'Search fuel consumption report'
                  : 'Search fuel quota report'
              }
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
            {activeTab === 'consumption' ? (
              <table className="w-max min-w-full text-sm">
                <thead className="bg-[#f6f6f7]">
                  <tr>
                    {CONSUMPTION_COLUMNS.map((column) => (
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
                  {consumptionQuery.isLoading ? (
                    <tr className="border-t border-[var(--fms-strokes)]">
                      <td
                        colSpan={CONSUMPTION_COLUMNS.length}
                        className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                      >
                        Loading consumption report…
                      </td>
                    </tr>
                  ) : consumptionQuery.isError ? (
                    <tr className="border-t border-[var(--fms-strokes)]">
                      <td
                        colSpan={CONSUMPTION_COLUMNS.length}
                        className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                      >
                        {consumptionQuery.error instanceof Error
                          ? consumptionQuery.error.message
                          : 'Could not load consumption report.'}
                      </td>
                    </tr>
                  ) : consumptionRows.length === 0 ? (
                    <tr className="border-t border-[var(--fms-strokes)]">
                      <td
                        colSpan={CONSUMPTION_COLUMNS.length}
                        className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                      >
                        {consumptionEmptyMessage}
                      </td>
                    </tr>
                  ) : (
                    consumptionRows.map((row) => (
                      <tr key={row.id} className="border-t border-[var(--fms-strokes)]">
                        <td className="px-4 py-3 text-[var(--fms-text-header)]">{row.vehicleLabel}</td>
                        <td className="px-4 py-3 tabular-nums text-[var(--fms-text-header)]">
                          {formatFuelLiters(row.fuelUsedL)}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-[var(--fms-text-header)]">
                          {formatFuelNu(row.fuelCostNu)}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-[var(--fms-text-header)]">
                          {formatAvgKmPerL(row.avgKmPerL)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-max min-w-full text-sm">
                <thead className="bg-[#f6f6f7]">
                  <tr>
                    {QUOTA_COLUMNS.map((column) => (
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
                  {quotaQuery.isLoading ? (
                    <tr className="border-t border-[var(--fms-strokes)]">
                      <td
                        colSpan={QUOTA_COLUMNS.length}
                        className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                      >
                        Loading quota report…
                      </td>
                    </tr>
                  ) : quotaQuery.isError ? (
                    <tr className="border-t border-[var(--fms-strokes)]">
                      <td
                        colSpan={QUOTA_COLUMNS.length}
                        className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                      >
                        {quotaQuery.error instanceof Error
                          ? quotaQuery.error.message
                          : 'Could not load quota report.'}
                      </td>
                    </tr>
                  ) : quotaRows.length === 0 ? (
                    <tr className="border-t border-[var(--fms-strokes)]">
                      <td
                        colSpan={QUOTA_COLUMNS.length}
                        className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                      >
                        {quotaEmptyMessage}
                      </td>
                    </tr>
                  ) : (
                    quotaRows.map((row) => (
                      <tr key={row.id} className="border-t border-[var(--fms-strokes)]">
                        <td className="px-4 py-3 text-[var(--fms-text-header)]">{row.vehicleLabel}</td>
                        <td className="px-4 py-3 tabular-nums text-[var(--fms-text-header)]">
                          {formatFuelNu(row.allocatedL)}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-[var(--fms-text-header)]">
                          {formatFuelNu(row.usedL)}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-[var(--fms-text-header)]">
                          {formatFuelNu(row.remainingL)}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-[var(--fms-text-header)]">
                          {row.utilizationPct.toLocaleString('en-BT', {
                            maximumFractionDigits: 1,
                          })}
                          %
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="space-y-3 md:hidden">
            {activeTab === 'consumption' ? (
              consumptionQuery.isLoading ? (
                <ListPanelMessage>Loading consumption report…</ListPanelMessage>
              ) : consumptionQuery.isError ? (
                <ListPanelMessage tone="error">
                  {consumptionQuery.error instanceof Error
                    ? consumptionQuery.error.message
                    : 'Could not load consumption report.'}
                </ListPanelMessage>
              ) : consumptionRows.length === 0 ? (
                <ListPanelMessage>{consumptionEmptyMessage}</ListPanelMessage>
              ) : (
                consumptionRows.map((row, index) => (
                  <MobileListCard key={row.id}>
                    <MobileListField label="Sl.No">{serialBase + index + 1}</MobileListField>
                    <MobileListField label="Vehicle">{row.vehicleLabel}</MobileListField>
                    <MobileListField label="Fuel Used">
                      {formatFuelLiters(row.fuelUsedL)}
                    </MobileListField>
                    <MobileListField label="Fuel Cost">{formatFuelNu(row.fuelCostNu)}</MobileListField>
                    <MobileListField label="Avg Km/L">
                      {formatAvgKmPerL(row.avgKmPerL)}
                    </MobileListField>
                    <MobileListField label="Cost / Km">
                      {formatFuelNu(row.costPerKmNu)}
                    </MobileListField>
                  </MobileListCard>
                ))
              )
            ) : quotaQuery.isLoading ? (
              <ListPanelMessage>Loading quota report…</ListPanelMessage>
            ) : quotaQuery.isError ? (
              <ListPanelMessage tone="error">
                {quotaQuery.error instanceof Error
                  ? quotaQuery.error.message
                  : 'Could not load quota report.'}
              </ListPanelMessage>
            ) : quotaRows.length === 0 ? (
              <ListPanelMessage>{quotaEmptyMessage}</ListPanelMessage>
            ) : (
              quotaRows.map((row, index) => (
                <MobileListCard key={row.id}>
                  <MobileListField label="Sl.No">{serialBase + index + 1}</MobileListField>
                  <MobileListField label="Vehicle">{row.vehicleLabel}</MobileListField>
                  <MobileListField label="Allocated">
                    {formatFuelNu(row.allocatedL)}
                  </MobileListField>
                  <MobileListField label="Used">{formatFuelNu(row.usedL)}</MobileListField>
                  <MobileListField label="Remaining">
                    {formatFuelNu(row.remainingL)}
                  </MobileListField>
                  <MobileListField label="Utilization">
                    {row.utilizationPct.toLocaleString('en-BT', { maximumFractionDigits: 1 })}%
                  </MobileListField>
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
    </section>
  )
}
