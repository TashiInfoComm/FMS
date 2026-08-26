import { useQuery } from '@tanstack/react-query'
import {
  CircleCheck,
  CircleX,
  Hourglass,
  Star,
  Timer,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { DashboardStatCard } from '@/features/dashboard/components/DashboardStatCard'
import { ReportCommonFilters } from '@/features/reports/components/ReportCommonFilters'
import { ReportExportActions } from '@/features/reports/components/ReportExportActions'
import { ReportPillTabs } from '@/features/reports/components/ReportPillTabs'
import { ReportTableToolbar } from '@/features/reports/components/ReportTableToolbar'
import { useReportCommonFilters } from '@/features/reports/hooks/useReportCommonFilters'
import { fetchReportAgencyOptions } from '@/features/reports/lib/report-agency-api'
import { reportFilterQueryKey } from '@/features/reports/lib/report-common-filters'
import { TripAnalysisTab } from '@/features/reports/pages/trips/components/TripAnalysisTab'
import {
  approvalStatusBadgeClass,
  approvalStatusDotClass,
  exportTripReport,
  fetchTripAnalysisReport,
  fetchTripApprovalItemsPage,
  fetchTripApprovalsKpis,
  fetchTripDriverAssignmentPage,
  fetchTripSummaryReportPage,
  formatApprovalStatusLabel,
  formatAvgApprovalHours,
  formatDistanceKm,
  formatDriverRating,
  formatKmDriven,
  tripTypeBadgeClass,
  type TripApprovalItemRow,
  type TripApprovalsKpis,
  type TripDriverAssignmentRow,
  type TripReportExportFormat,
  type TripSummaryReportRow,
} from '@/features/reports/pages/trips/lib/trip-reports-api'
import {
  formatTripStatusLabel,
  tripStatusBadgeClass,
} from '@/features/trips/lib/trip-form-utils'
import { fetchTripRequisitionMasterLists } from '@/features/trips/lib/trip-requisition-masters'
import {
  ListPanelMessage,
  MobileListCard,
  MobileListField,
} from '@/shared/components/MobileListCard'
import { PageHeader } from '@/shared/components/PageHeader'
import { SearchableAutocomplete } from '@/shared/components/SearchableAutocomplete'
import { TablePagination } from '@/shared/components/TablePagination'
import { useAccessControl } from '@/shared/hooks/useAccessControl'
import { showErrorToast } from '@/shared/lib/toast'
import { cn } from '@/lib/utils'

const REPORT_TABS = [
  { value: 'summary', label: 'Trip Summary' },
  { value: 'analysis', label: 'Analysis' },
  { value: 'driver-assignment', label: 'Driver Assignment' },
  { value: 'approvals', label: 'Approvals' },
] as const

type ReportTab = (typeof REPORT_TABS)[number]['value']

const SUMMARY_COLUMNS = [
  'Applicant',
  'Dept',
  'Driver',
  'Vehicle',
  'Type',
  'Purpose',
  'Distance',
  'Duration',
  'Status',
] as const

const DRIVER_COLUMNS = ['Driver', 'Agency', 'Completed', 'Cancelled', 'Km Driven', 'Rating'] as const

const APPROVAL_COLUMNS = ['Trip ID', 'Applicant', 'Type', 'Vehicle', 'Status'] as const

const APPROVAL_STATUS_OPTIONS = [
  { value: '', label: 'Status: All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
] as const

const SUMMARY_STATUS_OPTIONS = [
  { value: '', label: 'Status: All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PLANNED', label: 'Planned' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'STARTED', label: 'Started' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'DROPPED_OFF', label: 'Dropped Off' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'REJECTED', label: 'Rejected' },
] as const

const EMPTY_APPROVAL_KPIS: TripApprovalsKpis = {
  pendingCount: 0,
  approvedCount: 0,
  rejectedCount: 0,
  avgApprovalTimeHours: null,
  avgApprovalTimeLabel: '—',
}

function ApprovalKpiCards({
  summary,
  loading,
}: {
  summary: TripApprovalsKpis
  loading: boolean
}) {
  const cards = [
    {
      key: 'pending',
      label: 'Pending',
      value: loading ? '…' : summary.pendingCount.toLocaleString('en-BT'),
      icon: Hourglass,
      accent: '#f59e0b',
    },
    {
      key: 'approved',
      label: 'Approved',
      value: loading ? '…' : summary.approvedCount.toLocaleString('en-BT'),
      icon: CircleCheck,
      accent: '#16a34a',
    },
    {
      key: 'rejected',
      label: 'Rejected',
      value: loading ? '…' : summary.rejectedCount.toLocaleString('en-BT'),
      icon: CircleX,
      accent: '#ef4444',
    },
    {
      key: 'avg-time',
      label: 'Avg Approval Time',
      value: loading
        ? '…'
        : summary.avgApprovalTimeLabel || formatAvgApprovalHours(summary.avgApprovalTimeHours),
      icon: Timer,
      accent: '#3b82f6',
    },
  ] as const

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <DashboardStatCard
          key={card.key}
          label={card.label}
          value={card.value}
          icon={card.icon}
          accent={card.accent}
        />
      ))}
    </div>
  )
}

export default function TripReports() {
  const { role } = useAccessControl()
  const isDriverRole = String(role ?? '')
    .trim()
    .toLowerCase()
    .includes('driver')
  const visibleTabs = isDriverRole
    ? REPORT_TABS.filter((tab) => tab.value === 'summary')
    : REPORT_TABS

  const commonFilters = useReportCommonFilters()
  const [activeTab, setActiveTab] = useState<ReportTab>('summary')
  const [search, setSearch] = useState('')
  const [approvalStatus, setApprovalStatus] = useState('')
  const [tripTypeId, setTripTypeId] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [purposeId, setPurposeId] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [exportingFormat, setExportingFormat] = useState<TripReportExportFormat | null>(null)

  const agenciesQuery = useQuery({
    queryKey: ['report-agency-options'],
    queryFn: fetchReportAgencyOptions,
    staleTime: 60_000,
    enabled: commonFilters.showAgencyFilter,
  })

  const mastersQuery = useQuery({
    queryKey: ['trip-requisition-masters'],
    queryFn: fetchTripRequisitionMasterLists,
    staleTime: 60_000,
    enabled: activeTab === 'summary',
  })

  const listQueryKey = [
    'trip-reports',
    search,
    tripTypeId,
    statusFilter,
    purposeId,
    page,
    pageSize,
    commonFilters.params,
  ] as const

  const summaryQuery = useQuery({
    queryKey: [...listQueryKey, 'summary'],
    queryFn: () =>
      fetchTripSummaryReportPage({
        page,
        pageSize,
        search,
        tripTypeId,
        status: statusFilter,
        purposeId,
        common: commonFilters.params,
      }),
    enabled: activeTab === 'summary',
    staleTime: 30_000,
  })

  const chartFilters = commonFilters.params
  const chartFilterKey = reportFilterQueryKey(chartFilters)

  const analysisQuery = useQuery({
    queryKey: ['trip-reports-analysis', ...chartFilterKey],
    queryFn: () => fetchTripAnalysisReport(chartFilters),
    enabled: activeTab === 'analysis',
    staleTime: 30_000,
  })

  const driverQuery = useQuery({
    queryKey: [...listQueryKey, 'driver-assignment'],
    queryFn: () =>
      fetchTripDriverAssignmentPage({
        page,
        pageSize,
        search,
        common: commonFilters.params,
      }),
    enabled: activeTab === 'driver-assignment',
    staleTime: 30_000,
  })

  const approvalsKpiQuery = useQuery({
    queryKey: ['trip-reports-approvals-kpis', commonFilters.params],
    queryFn: () => fetchTripApprovalsKpis(commonFilters.params),
    enabled: activeTab === 'approvals',
    staleTime: 30_000,
  })

  const approvalItemsQuery = useQuery({
    queryKey: [...listQueryKey, 'approvals-items', approvalStatus],
    queryFn: () =>
      fetchTripApprovalItemsPage({
        page,
        pageSize,
        search,
        approvalStatus,
        common: commonFilters.params,
      }),
    enabled: activeTab === 'approvals',
    staleTime: 30_000,
  })

  const summaryRows = summaryQuery.data?.rows ?? []
  const driverRows = driverQuery.data?.rows ?? []
  const approvalRows = approvalItemsQuery.data?.rows ?? []
  const approvalKpis = approvalsKpiQuery.data ?? EMPTY_APPROVAL_KPIS

  const activeListQuery =
    activeTab === 'summary'
      ? summaryQuery
      : activeTab === 'driver-assignment'
        ? driverQuery
        : approvalItemsQuery

  const totalCount =
    activeTab === 'analysis'
      ? (analysisQuery.data?.totalTrips ?? 0)
      : (activeListQuery.data?.totalCount ?? 0)
  const totalPages =
    activeListQuery.data?.totalPages ?? Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize)))
  const serialBase = activeListQuery.data?.serialBase ?? (page - 1) * pageSize

  useEffect(() => {
    if (isDriverRole && activeTab !== 'summary') setActiveTab('summary')
  }, [activeTab, isDriverRole])

  useEffect(() => {
    setPage(1)
  }, [
    search,
    pageSize,
    activeTab,
    approvalStatus,
    tripTypeId,
    statusFilter,
    purposeId,
    commonFilters.fromDate,
    commonFilters.toDate,
    commonFilters.agencyId,
  ])

  useEffect(() => {
    if (activeTab === 'analysis') return
    if (page > totalPages) setPage(totalPages)
  }, [activeTab, page, totalPages])

  const handleExport = async (format: TripReportExportFormat) => {
    if (exportingFormat) return
    setExportingFormat(format)
    try {
      await exportTripReport({
        tab: activeTab,
        format,
        search,
        tripTypeId,
        status: statusFilter,
        purposeId,
        approvalStatus,
        common: commonFilters.params,
      })
    } catch (error) {
      showErrorToast(error, 'Could not export trip report.')
    } finally {
      setExportingFormat(null)
    }
  }

  const hasActiveFilters = Boolean(
    search.trim() ||
      approvalStatus ||
      tripTypeId ||
      statusFilter ||
      purposeId ||
      commonFilters.agencyId ||
      commonFilters.fromDate ||
      commonFilters.toDate,
  )

  const agencyScopeLabel = useMemo(() => {
    if (!commonFilters.agencyId) return 'All Agencies'
    const match = agenciesQuery.data?.find((option) => option.value === commonFilters.agencyId)
    return match?.label || match?.code || 'Selected agency'
  }, [agenciesQuery.data, commonFilters.agencyId])

  const tripCountLabel = (() => {
    if (activeTab === 'analysis') {
      if (analysisQuery.isLoading) return 'Loading analysis…'
      const count = analysisQuery.data?.totalTrips ?? 0
      return `${count.toLocaleString('en-BT')} trip${count === 1 ? '' : 's'} · ${agencyScopeLabel}`
    }
    if (activeListQuery.isLoading) return 'Loading trips…'
    return `${totalCount.toLocaleString('en-BT')} trip${totalCount === 1 ? '' : 's'} · ${agencyScopeLabel}`
  })()

  const analysisErrorMessage =
    analysisQuery.error instanceof Error
      ? analysisQuery.error.message
      : 'Could not load trip analysis.'

  const tableTitle =
    activeTab === 'summary'
      ? 'Trip Summary'
      : activeTab === 'driver-assignment'
        ? 'Driver Assignment Report'
        : 'Trip Approval Report'

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title="Trip Reports" subtitle={tripCountLabel} />
        <ReportExportActions
          onExport={(format) => void handleExport(format)}
          exportingFormat={exportingFormat}
        />
      </div>

      {visibleTabs.length > 1 ? (
        <ReportPillTabs
          tabs={visibleTabs}
          value={activeTab}
          onValueChange={(next) => {
            setActiveTab(next)
            setSearch('')
            setApprovalStatus('')
            setTripTypeId('')
            setStatusFilter('')
            setPurposeId('')
          }}
          aria-label="Trip report sections"
        />
      ) : null}

      {activeTab === 'approvals' ? (
        <ApprovalKpiCards summary={approvalKpis} loading={approvalsKpiQuery.isLoading} />
      ) : null}

      {activeTab === 'analysis' ? (
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
          <TripAnalysisTab
            data={analysisQuery.data}
            isLoading={analysisQuery.isLoading}
            isError={analysisQuery.isError}
            errorMessage={analysisErrorMessage}
          />
        </>
      ) : (
        <Card className="min-w-0 rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
          <CardContent className="min-w-0 space-y-4 p-0">
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-[var(--fms-text-header)]">{tableTitle}</h2>

              <ReportTableToolbar
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search..."
                searchAriaLabel={`Search ${tableTitle.toLowerCase()}`}
                fromDate={commonFilters.fromDate}
                toDate={commonFilters.toDate}
                org={commonFilters.org}
                onFromDateChange={commonFilters.setFromDate}
                onToDateChange={commonFilters.setToDate}
                onOrgChange={commonFilters.setOrg}
                showAgency={commonFilters.showAgencyFilter}
                extraFilters={
                  activeTab === 'summary' ? (
                    <>
                      <SearchableAutocomplete
                        value={tripTypeId || 'all'}
                        onChange={(value) => setTripTypeId(value === 'all' ? '' : value)}
                        options={[
                          { value: 'all', label: 'Type: All', searchText: 'all trip types' },
                          ...(mastersQuery.data?.tripTypes ?? []).map((option) => ({
                            value: option.value,
                            label: option.label,
                            searchText: option.label,
                          })),
                        ]}
                        loading={mastersQuery.isLoading}
                        placeholder="Type: All"
                        searchPlaceholder="Search type…"
                        emptyMessage="No matching type."
                        className="w-full sm:w-44"
                      />
                      <SearchableAutocomplete
                        value={statusFilter || 'all'}
                        onChange={(value) => setStatusFilter(value === 'all' ? '' : value)}
                        options={SUMMARY_STATUS_OPTIONS.map((option) => ({
                          value: option.value || 'all',
                          label: option.label,
                          searchText: option.label,
                        }))}
                        placeholder="Status: All"
                        searchPlaceholder="Search status…"
                        emptyMessage="No matching status."
                        className="w-full sm:w-44"
                      />
                      <SearchableAutocomplete
                        value={purposeId || 'all'}
                        onChange={(value) => setPurposeId(value === 'all' ? '' : value)}
                        options={[
                          { value: 'all', label: 'Purpose: All', searchText: 'all purposes' },
                          ...(mastersQuery.data?.journeyPurposes ?? []).map((option) => ({
                            value: option.value,
                            label: option.label,
                            searchText: option.label,
                          })),
                        ]}
                        loading={mastersQuery.isLoading}
                        placeholder="Purpose: All"
                        searchPlaceholder="Search purpose…"
                        emptyMessage="No matching purpose."
                        className="w-full sm:w-44"
                      />
                    </>
                  ) : activeTab === 'approvals' ? (
                    <SearchableAutocomplete
                      value={approvalStatus || 'all'}
                      onChange={(value) => setApprovalStatus(value === 'all' ? '' : value)}
                      options={APPROVAL_STATUS_OPTIONS.map((option) => ({
                        value: option.value || 'all',
                        label: option.label,
                        searchText: option.label,
                      }))}
                      placeholder="Status: All"
                      searchPlaceholder="Search status…"
                      emptyMessage="No matching status."
                      className="w-full sm:w-56"
                    />
                  ) : null
                }
              />
            </div>

            {activeTab === 'summary' ? (
              <SummaryReportTable
                rows={summaryRows}
                isLoading={summaryQuery.isLoading}
                isError={summaryQuery.isError}
                errorMessage={
                  summaryQuery.error instanceof Error
                    ? summaryQuery.error.message
                    : 'Could not load trip summary.'
                }
                emptyMessage={
                  hasActiveFilters ? 'No trips match your filters.' : 'No trips found.'
                }
                serialBase={serialBase}
              />
            ) : null}

            {activeTab === 'driver-assignment' ? (
              <DriverAssignmentTable
                rows={driverRows}
                isLoading={driverQuery.isLoading}
                isError={driverQuery.isError}
                errorMessage={
                  driverQuery.error instanceof Error
                    ? driverQuery.error.message
                    : 'Could not load driver assignment report.'
                }
                emptyMessage={
                  hasActiveFilters
                    ? 'No driver assignments match your filters.'
                    : 'No driver assignments found.'
                }
                serialBase={serialBase}
              />
            ) : null}

            {activeTab === 'approvals' ? (
              <ApprovalItemsTable
                rows={approvalRows}
                isLoading={approvalItemsQuery.isLoading}
                isError={approvalItemsQuery.isError}
                errorMessage={
                  approvalItemsQuery.error instanceof Error
                    ? approvalItemsQuery.error.message
                    : 'Could not load trip approval report.'
                }
                emptyMessage={
                  hasActiveFilters
                    ? 'No approval records match your filters.'
                    : 'No approval records found.'
                }
                serialBase={serialBase}
              />
            ) : null}

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

function SummaryReportTable({
  rows,
  isLoading,
  isError,
  errorMessage,
  emptyMessage,
  serialBase,
}: {
  rows: TripSummaryReportRow[]
  isLoading: boolean
  isError: boolean
  errorMessage: string
  emptyMessage: string
  serialBase: number
}) {
  return (
    <>
      <div className="hidden w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
        <table className="w-max min-w-full text-sm">
          <thead className="bg-[#f6f6f7]">
            <tr>
              {SUMMARY_COLUMNS.map((column) => (
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
            {isLoading ? (
              <tr className="border-t border-[var(--fms-strokes)]">
                <td
                  colSpan={SUMMARY_COLUMNS.length}
                  className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                >
                  Loading trip summary…
                </td>
              </tr>
            ) : isError ? (
              <tr className="border-t border-[var(--fms-strokes)]">
                <td
                  colSpan={SUMMARY_COLUMNS.length}
                  className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                >
                  {errorMessage}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr className="border-t border-[var(--fms-strokes)]">
                <td
                  colSpan={SUMMARY_COLUMNS.length}
                  className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-[var(--fms-strokes)]">
                  <td className="px-4 py-3 font-medium text-[var(--fms-text-header)]">
                    {row.applicant}
                  </td>
                  <td className="px-4 py-3 text-[var(--fms-text-header)]">{row.department}</td>
                  <td className="px-4 py-3 text-[var(--fms-text-header)]">{row.driver}</td>
                  <td className="px-4 py-3 text-[var(--fms-text-header)]">{row.vehicle}</td>
                  <td className="px-4 py-3">
                    <span className={tripTypeBadgeClass(row.type)}>{row.type}</span>
                  </td>
                  <td className="px-4 py-3 text-[var(--fms-text-header)]">{row.purpose}</td>
                  <td className="px-4 py-3 tabular-nums text-[var(--fms-text-header)]">
                    {formatDistanceKm(row.distanceKm)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-[var(--fms-text-header)]">
                    {row.durationLabel}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-1 text-xs font-medium',
                        tripStatusBadgeClass(row.status),
                      )}
                    >
                      {formatTripStatusLabel(row.status)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {isLoading ? (
          <ListPanelMessage>Loading trip summary…</ListPanelMessage>
        ) : isError ? (
          <ListPanelMessage tone="error">{errorMessage}</ListPanelMessage>
        ) : rows.length === 0 ? (
          <ListPanelMessage>{emptyMessage}</ListPanelMessage>
        ) : (
          rows.map((row, index) => (
            <MobileListCard key={row.id}>
              <MobileListField label="Sl.No">{serialBase + index + 1}</MobileListField>
              <MobileListField label="Applicant">{row.applicant}</MobileListField>
              <MobileListField label="Dept">{row.department}</MobileListField>
              <MobileListField label="Driver">{row.driver}</MobileListField>
              <MobileListField label="Vehicle">{row.vehicle}</MobileListField>
              <MobileListField label="Type">
                <span className={tripTypeBadgeClass(row.type)}>{row.type}</span>
              </MobileListField>
              <MobileListField label="Purpose">{row.purpose}</MobileListField>
              <MobileListField label="Distance">{formatDistanceKm(row.distanceKm)}</MobileListField>
              <MobileListField label="Duration">{row.durationLabel}</MobileListField>
              <MobileListField label="Status">
                <span
                  className={cn(
                    'inline-flex rounded-full px-2 py-1 text-xs font-medium',
                    tripStatusBadgeClass(row.status),
                  )}
                >
                  {formatTripStatusLabel(row.status)}
                </span>
              </MobileListField>
            </MobileListCard>
          ))
        )}
      </div>
    </>
  )
}

function DriverAssignmentTable({
  rows,
  isLoading,
  isError,
  errorMessage,
  emptyMessage,
  serialBase,
}: {
  rows: TripDriverAssignmentRow[]
  isLoading: boolean
  isError: boolean
  errorMessage: string
  emptyMessage: string
  serialBase: number
}) {
  return (
    <>
      <div className="hidden w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
        <table className="w-max min-w-full text-sm">
          <thead className="bg-[#f6f6f7]">
            <tr>
              {DRIVER_COLUMNS.map((column) => (
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
            {isLoading ? (
              <tr className="border-t border-[var(--fms-strokes)]">
                <td
                  colSpan={DRIVER_COLUMNS.length}
                  className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                >
                  Loading driver assignment report…
                </td>
              </tr>
            ) : isError ? (
              <tr className="border-t border-[var(--fms-strokes)]">
                <td
                  colSpan={DRIVER_COLUMNS.length}
                  className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                >
                  {errorMessage}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr className="border-t border-[var(--fms-strokes)]">
                <td
                  colSpan={DRIVER_COLUMNS.length}
                  className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-[var(--fms-strokes)]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e8f0ff] text-xs font-semibold text-[var(--fms-primary)]"
                      >
                        {row.driverInitial}
                      </span>
                      <span className="font-medium text-[var(--fms-text-header)]">
                        {row.driverName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--fms-text-header)]">{row.agency}</td>
                  <td className="px-4 py-3 tabular-nums text-[var(--fms-text-header)]">
                    {row.completedCount.toLocaleString('en-BT')}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-[var(--fms-text-header)]">
                    {row.cancelledCount.toLocaleString('en-BT')}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-[var(--fms-text-header)]">
                    {formatKmDriven(row.kmDriven)}
                  </td>
                  <td className="px-4 py-3">
                    {row.rating == null ? (
                      <span className="text-[var(--fms-text-subheading)]">—</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 tabular-nums text-[var(--fms-text-header)]">
                        <Star className="h-3.5 w-3.5 fill-[#f59e0b] text-[#f59e0b]" />
                        {formatDriverRating(row.rating)}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {isLoading ? (
          <ListPanelMessage>Loading driver assignment report…</ListPanelMessage>
        ) : isError ? (
          <ListPanelMessage tone="error">{errorMessage}</ListPanelMessage>
        ) : rows.length === 0 ? (
          <ListPanelMessage>{emptyMessage}</ListPanelMessage>
        ) : (
          rows.map((row, index) => (
            <MobileListCard key={row.id}>
              <MobileListField label="Sl.No">{serialBase + index + 1}</MobileListField>
              <MobileListField label="Driver">{row.driverName}</MobileListField>
              <MobileListField label="Agency">{row.agency}</MobileListField>
              <MobileListField label="Completed">
                {row.completedCount.toLocaleString('en-BT')}
              </MobileListField>
              <MobileListField label="Cancelled">
                {row.cancelledCount.toLocaleString('en-BT')}
              </MobileListField>
              <MobileListField label="Km Driven">{formatKmDriven(row.kmDriven)}</MobileListField>
              <MobileListField label="Rating">{formatDriverRating(row.rating)}</MobileListField>
            </MobileListCard>
          ))
        )}
      </div>
    </>
  )
}

function ApprovalItemsTable({
  rows,
  isLoading,
  isError,
  errorMessage,
  emptyMessage,
  serialBase,
}: {
  rows: TripApprovalItemRow[]
  isLoading: boolean
  isError: boolean
  errorMessage: string
  emptyMessage: string
  serialBase: number
}) {
  return (
    <>
      <div className="hidden w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
        <table className="w-max min-w-full text-sm">
          <thead className="bg-[#f6f6f7]">
            <tr>
              {APPROVAL_COLUMNS.map((column) => (
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
            {isLoading ? (
              <tr className="border-t border-[var(--fms-strokes)]">
                <td
                  colSpan={APPROVAL_COLUMNS.length}
                  className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                >
                  Loading trip approval report…
                </td>
              </tr>
            ) : isError ? (
              <tr className="border-t border-[var(--fms-strokes)]">
                <td
                  colSpan={APPROVAL_COLUMNS.length}
                  className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                >
                  {errorMessage}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr className="border-t border-[var(--fms-strokes)]">
                <td
                  colSpan={APPROVAL_COLUMNS.length}
                  className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-[var(--fms-strokes)]">
                  <td className="px-4 py-3 font-medium text-[var(--fms-text-header)]">
                    {row.tripId}
                  </td>
                  <td className="px-4 py-3 text-[var(--fms-text-header)]">{row.applicant}</td>
                  <td className="px-4 py-3">
                    <span className={tripTypeBadgeClass(row.type)}>{row.type}</span>
                  </td>
                  <td className="px-4 py-3 text-[var(--fms-text-header)]">{row.vehicle}</td>
                  <td className="px-4 py-3">
                    <span className={approvalStatusBadgeClass(row.status)}>
                      <span
                        aria-hidden="true"
                        className={cn('h-1.5 w-1.5 rounded-full', approvalStatusDotClass(row.status))}
                      />
                      {formatApprovalStatusLabel(row.status)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {isLoading ? (
          <ListPanelMessage>Loading trip approval report…</ListPanelMessage>
        ) : isError ? (
          <ListPanelMessage tone="error">{errorMessage}</ListPanelMessage>
        ) : rows.length === 0 ? (
          <ListPanelMessage>{emptyMessage}</ListPanelMessage>
        ) : (
          rows.map((row, index) => (
            <MobileListCard key={row.id}>
              <MobileListField label="Sl.No">{serialBase + index + 1}</MobileListField>
              <MobileListField label="Trip ID">{row.tripId}</MobileListField>
              <MobileListField label="Applicant">{row.applicant}</MobileListField>
              <MobileListField label="Type">
                <span className={tripTypeBadgeClass(row.type)}>{row.type}</span>
              </MobileListField>
              <MobileListField label="Vehicle">{row.vehicle}</MobileListField>
              <MobileListField label="Status">
                <span className={approvalStatusBadgeClass(row.status)}>
                  <span
                    aria-hidden="true"
                    className={cn('h-1.5 w-1.5 rounded-full', approvalStatusDotClass(row.status))}
                  />
                  {formatApprovalStatusLabel(row.status)}
                </span>
              </MobileListField>
            </MobileListCard>
          ))
        )}
      </div>
    </>
  )
}
