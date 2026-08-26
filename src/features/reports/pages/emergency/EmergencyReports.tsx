import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { ReportExportActions } from '@/features/reports/components/ReportExportActions'
import { ReportPillTabs } from '@/features/reports/components/ReportPillTabs'
import { ReportTableToolbar } from '@/features/reports/components/ReportTableToolbar'
import { useReportCommonFilters } from '@/features/reports/hooks/useReportCommonFilters'
import {
  fetchEmergencyDeploymentsReportPage,
  fetchEmergencyMtoActivityReportPage,
  formatAvgDeploymentDurationMinutes,
  formatAvgResponseTime,
  type EmergencyDeploymentsSummary,
} from '@/features/reports/pages/emergency/lib/emergency-reports-api'
import {
  ListPanelMessage,
  MobileListCard,
  MobileListField,
} from '@/shared/components/MobileListCard'
import { PageHeader } from '@/shared/components/PageHeader'
import { TablePagination } from '@/shared/components/TablePagination'

const REPORT_TABS = [
  { value: 'mto-activity', label: 'MTO Activity' },
  { value: 'deployments', label: 'Deployment by Vehicle Type' },
] as const

type ReportTab = (typeof REPORT_TABS)[number]['value']

const MTO_COLUMNS = [
  'MTO',
  'Agency',
  'Deployed',
  'Declined',
  'Escalations',
  'Avg Response Time',
] as const

const DEPLOYMENT_COLUMNS = ['Vehicle Type', 'Deployments'] as const

const EMPTY_SUMMARY: EmergencyDeploymentsSummary = {
  avgDeploymentDurationMinutes: null,
  totalDeployments: 0,
  currentlyActive: 0,
  released: 0,
}

function DeploymentSummaryCards({
  summary,
  loading,
}: {
  summary: EmergencyDeploymentsSummary
  loading: boolean
}) {
  const cards = [
    {
      key: 'avg-duration',
      label: 'Avg Deployment Duration',
      value: loading ? '…' : formatAvgDeploymentDurationMinutes(summary.avgDeploymentDurationMinutes),
    },
    {
      key: 'total',
      label: 'Total Deployments',
      value: loading ? '…' : summary.totalDeployments.toLocaleString('en-BT'),
    },
    {
      key: 'active',
      label: 'Currently Active',
      value: loading ? '…' : summary.currentlyActive.toLocaleString('en-BT'),
    },
    {
      key: 'released',
      label: 'Released',
      value: loading ? '…' : summary.released.toLocaleString('en-BT'),
    },
  ] as const

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.key}
          className="rounded-xl border border-[var(--fms-strokes)] bg-[#fafafa] px-4 py-3"
        >
          <p className="text-xs font-medium text-[var(--fms-text-subheading)]">{card.label}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--fms-text-header)]">
            {card.value}
          </p>
        </div>
      ))}
    </div>
  )
}

export default function EmergencyReports() {
  const commonFilters = useReportCommonFilters()
  const [activeTab, setActiveTab] = useState<ReportTab>('mto-activity')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const listQueryKey = [
    'emergency-reports',
    activeTab,
    search,
    page,
    pageSize,
    commonFilters.params,
  ] as const

  const mtoQuery = useQuery({
    queryKey: [...listQueryKey, 'mto-activity'],
    queryFn: () =>
      fetchEmergencyMtoActivityReportPage({
        page,
        pageSize,
        search,
        common: commonFilters.params,
      }),
    enabled: activeTab === 'mto-activity',
    staleTime: 30_000,
  })

  const deploymentsQuery = useQuery({
    queryKey: [...listQueryKey, 'deployments'],
    queryFn: () =>
      fetchEmergencyDeploymentsReportPage({
        page,
        pageSize,
        search,
        common: commonFilters.params,
      }),
    enabled: activeTab === 'deployments',
    staleTime: 30_000,
  })

  const activeQuery = activeTab === 'mto-activity' ? mtoQuery : deploymentsQuery
  const mtoRows = mtoQuery.data?.rows ?? []
  const deploymentRows = deploymentsQuery.data?.rows ?? []
  const deploymentsSummary = deploymentsQuery.data?.summary ?? EMPTY_SUMMARY
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

  const handleExport = (format: 'xlsx' | 'pdf') => {
    window.alert(
      `${format === 'pdf' ? 'PDF' : 'Excel'} export will be available once the export API is connected.`,
    )
  }

  const hasActiveFilters = Boolean(
    search.trim() ||
      commonFilters.agencyId ||
      commonFilters.fromDate ||
      commonFilters.toDate,
  )

  const mtoEmptyMessage = hasActiveFilters
    ? 'No MTO activity matches your filters.'
    : 'No MTO activity found.'
  const deploymentsEmptyMessage = hasActiveFilters
    ? 'No vehicle type deployments match your filters.'
    : 'No vehicle type deployments found.'

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Emergency Reports"
          subtitle="National emergency dispatch coordination"
        />
        <ReportExportActions onExport={handleExport} />
      </div>

      <ReportPillTabs
        tabs={REPORT_TABS}
        value={activeTab}
        onValueChange={(next) => {
          setActiveTab(next)
          setSearch('')
        }}
        aria-label="Emergency report types"
      />

      <Card className="min-w-0 rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="min-w-0 space-y-4 p-0">
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-[var(--fms-text-header)]">
              {activeTab === 'mto-activity'
                ? 'MTO Activity Report'
                : 'Deployment by Vehicle Type'}
            </h2>

            <ReportTableToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search..."
              searchAriaLabel={
                activeTab === 'mto-activity'
                  ? 'Search MTO activity report'
                  : 'Search deployment by vehicle type'
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

          {activeTab === 'deployments' ? (
            <DeploymentSummaryCards
              summary={deploymentsSummary}
              loading={deploymentsQuery.isLoading}
            />
          ) : null}

          <div className="hidden w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
            {activeTab === 'mto-activity' ? (
              <table className="w-max min-w-full text-sm">
                <thead className="bg-[#f6f6f7]">
                  <tr>
                    {MTO_COLUMNS.map((column) => (
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
                  {mtoQuery.isLoading ? (
                    <tr className="border-t border-[var(--fms-strokes)]">
                      <td
                        colSpan={MTO_COLUMNS.length}
                        className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                      >
                        Loading MTO activity report…
                      </td>
                    </tr>
                  ) : mtoQuery.isError ? (
                    <tr className="border-t border-[var(--fms-strokes)]">
                      <td
                        colSpan={MTO_COLUMNS.length}
                        className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                      >
                        {mtoQuery.error instanceof Error
                          ? mtoQuery.error.message
                          : 'Could not load MTO activity report.'}
                      </td>
                    </tr>
                  ) : mtoRows.length === 0 ? (
                    <tr className="border-t border-[var(--fms-strokes)]">
                      <td
                        colSpan={MTO_COLUMNS.length}
                        className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                      >
                        {mtoEmptyMessage}
                      </td>
                    </tr>
                  ) : (
                    mtoRows.map((row) => (
                      <tr key={row.id} className="border-t border-[var(--fms-strokes)]">
                        <td className="px-4 py-3 font-semibold text-[var(--fms-text-header)]">
                          {row.mtoName}
                        </td>
                        <td className="px-4 py-3 text-[var(--fms-text-header)]">
                          {row.agencyName}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-[var(--fms-text-header)]">
                          {row.deployedCount.toLocaleString('en-BT')}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-[var(--fms-text-header)]">
                          {row.declinedCount.toLocaleString('en-BT')}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-[var(--fms-text-header)]">
                          {row.escalationCount.toLocaleString('en-BT')}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-[var(--fms-text-header)]">
                          {formatAvgResponseTime(row)}
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
                    {DEPLOYMENT_COLUMNS.map((column) => (
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
                  {deploymentsQuery.isLoading ? (
                    <tr className="border-t border-[var(--fms-strokes)]">
                      <td
                        colSpan={DEPLOYMENT_COLUMNS.length}
                        className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                      >
                        Loading deployment by vehicle type…
                      </td>
                    </tr>
                  ) : deploymentsQuery.isError ? (
                    <tr className="border-t border-[var(--fms-strokes)]">
                      <td
                        colSpan={DEPLOYMENT_COLUMNS.length}
                        className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                      >
                        {deploymentsQuery.error instanceof Error
                          ? deploymentsQuery.error.message
                          : 'Could not load deployment by vehicle type.'}
                      </td>
                    </tr>
                  ) : deploymentRows.length === 0 ? (
                    <tr className="border-t border-[var(--fms-strokes)]">
                      <td
                        colSpan={DEPLOYMENT_COLUMNS.length}
                        className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                      >
                        {deploymentsEmptyMessage}
                      </td>
                    </tr>
                  ) : (
                    deploymentRows.map((row) => (
                      <tr key={row.id} className="border-t border-[var(--fms-strokes)]">
                        <td className="px-4 py-3 font-semibold text-[var(--fms-text-header)]">
                          {row.vehicleTypeName}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-[var(--fms-text-header)]">
                          {row.deploymentCount.toLocaleString('en-BT')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="space-y-3 md:hidden">
            {activeTab === 'mto-activity' ? (
              mtoQuery.isLoading ? (
                <ListPanelMessage>Loading MTO activity report…</ListPanelMessage>
              ) : mtoQuery.isError ? (
                <ListPanelMessage tone="error">
                  {mtoQuery.error instanceof Error
                    ? mtoQuery.error.message
                    : 'Could not load MTO activity report.'}
                </ListPanelMessage>
              ) : mtoRows.length === 0 ? (
                <ListPanelMessage>{mtoEmptyMessage}</ListPanelMessage>
              ) : (
                mtoRows.map((row, index) => (
                  <MobileListCard key={row.id}>
                    <MobileListField label="Sl.No">{serialBase + index + 1}</MobileListField>
                    <MobileListField label="MTO">{row.mtoName}</MobileListField>
                    <MobileListField label="Agency">{row.agencyName}</MobileListField>
                    <MobileListField label="Deployed">
                      {row.deployedCount.toLocaleString('en-BT')}
                    </MobileListField>
                    <MobileListField label="Declined">
                      {row.declinedCount.toLocaleString('en-BT')}
                    </MobileListField>
                    <MobileListField label="Escalations">
                      {row.escalationCount.toLocaleString('en-BT')}
                    </MobileListField>
                    <MobileListField label="Avg Response Time">
                      {formatAvgResponseTime(row)}
                    </MobileListField>
                  </MobileListCard>
                ))
              )
            ) : deploymentsQuery.isLoading ? (
              <ListPanelMessage>Loading deployment by vehicle type…</ListPanelMessage>
            ) : deploymentsQuery.isError ? (
              <ListPanelMessage tone="error">
                {deploymentsQuery.error instanceof Error
                  ? deploymentsQuery.error.message
                  : 'Could not load deployment by vehicle type.'}
              </ListPanelMessage>
            ) : deploymentRows.length === 0 ? (
              <ListPanelMessage>{deploymentsEmptyMessage}</ListPanelMessage>
            ) : (
              deploymentRows.map((row, index) => (
                <MobileListCard key={row.id}>
                  <MobileListField label="Sl.No">{serialBase + index + 1}</MobileListField>
                  <MobileListField label="Vehicle Type">{row.vehicleTypeName}</MobileListField>
                  <MobileListField label="Deployments">
                    {row.deploymentCount.toLocaleString('en-BT')}
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
