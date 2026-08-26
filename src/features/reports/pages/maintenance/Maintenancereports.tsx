import { useQuery } from '@tanstack/react-query'
import {
  CircleCheckBig,
  ClipboardList,
  Clock,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardStatCard } from '@/features/dashboard/components/DashboardStatCard'
import { WORK_ORDER_STATUS_OPTIONS } from '@/features/maintenance/lib/maintenance-mock-data'
import { fetchMaintenanceTypes } from '@/features/maintenance/lib/maintenance-masters-api'
import {
  formatWorkOrderStatusLabel,
  workOrderStatusBadgeClass,
} from '@/features/maintenance/lib/maintenance-ui'
import { ReportExportActions } from '@/features/reports/components/ReportExportActions'
import { ReportTableToolbar } from '@/features/reports/components/ReportTableToolbar'
import { useReportCommonFilters } from '@/features/reports/hooks/useReportCommonFilters'
import {
  fetchMaintenanceReportSummary,
  fetchMaintenanceWorkOrdersPage,
  formatMaintenanceReportAmount,
  toMaintenanceDisplayLabel,
  type MaintenanceReportSlice,
} from '@/features/reports/pages/maintenance/lib/maintenance-reports-api'
import {
  ListPanelMessage,
  MobileListCard,
  MobileListField,
} from '@/shared/components/MobileListCard'
import { PageHeader } from '@/shared/components/PageHeader'
import { SearchableAutocomplete } from '@/shared/components/SearchableAutocomplete'
import { TablePagination } from '@/shared/components/TablePagination'

const REPORT_COLUMNS = [
  'Work Order',
  'Vehicle',
  'Type',
  'Trigger',
  'Status',
  'Date',
  'Est. Cost',
  'Actual Cost',
] as const

type SummaryStatItem = {
  id: string
  label: string
  value: string
  icon: LucideIcon
  accent: string
}

function statusLook(label: string): { icon: LucideIcon; accent: string } {
  const text = label.toLowerCase()
  if (text.includes('complet')) return { icon: CircleCheckBig, accent: '#16a34a' }
  if (text.includes('pending') || text.includes('approv')) return { icon: Clock, accent: '#f59e0b' }
  if (text.includes('reject') || text.includes('cancel')) return { icon: Clock, accent: '#f43f5e' }
  return { icon: ClipboardList, accent: '#3b82f6' }
}

function buildSummaryStatItems(
  total: number | null | undefined,
  openCount: number | null | undefined,
  byStatus: MaintenanceReportSlice[],
  byTriggerType: MaintenanceReportSlice[],
): SummaryStatItem[] {
  const items: SummaryStatItem[] = []

  if (total !== null && total !== undefined) {
    items.push({
      id: 'total',
      label: 'Total work orders',
      value: total.toLocaleString('en-BT'),
      icon: ClipboardList,
      accent: '#3b82f6',
    })
  }
  if (openCount !== null && openCount !== undefined) {
    items.push({
      id: 'open',
      label: 'Open work orders',
      value: openCount.toLocaleString('en-BT'),
      icon: Clock,
      accent: '#f59e0b',
    })
  }

  for (const slice of byStatus) {
    const look = statusLook(slice.label)
    items.push({
      id: `status-${slice.key}`,
      label: `Status · ${slice.label}`,
      value: slice.value.toLocaleString('en-BT'),
      icon: look.icon,
      accent: look.accent,
    })
  }

  for (const slice of byTriggerType) {
    items.push({
      id: `trigger-${slice.key}`,
      label: `Trigger · ${slice.label}`,
      value: slice.value.toLocaleString('en-BT'),
      icon: Zap,
      accent: '#06b6d4',
    })
  }

  return items
}

export default function MaintenanceReports() {
  const commonFilters = useReportCommonFilters()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const typesQuery = useQuery({
    queryKey: ['maintenance-report-types'],
    queryFn: fetchMaintenanceTypes,
    staleTime: 60_000,
  })

  const summaryQuery = useQuery({
    queryKey: ['maintenance-report-summary', commonFilters.params],
    queryFn: () => fetchMaintenanceReportSummary(commonFilters.params),
    staleTime: 30_000,
  })

  const listQuery = useQuery({
    queryKey: [
      'maintenance-work-orders-report',
      search,
      typeFilter,
      statusFilter,
      page,
      pageSize,
      commonFilters.params,
    ],
    queryFn: () =>
      fetchMaintenanceWorkOrdersPage({
        page,
        pageSize,
        search,
        type: typeFilter,
        status: statusFilter,
        common: commonFilters.params,
      }),
    staleTime: 30_000,
  })

  const rows = listQuery.data?.rows ?? []
  const totalCount = listQuery.data?.totalCount ?? 0
  const effectivePageSize = listQuery.data?.effectivePageSize ?? pageSize
  const totalPages =
    listQuery.data?.totalPages ??
    Math.max(1, Math.ceil(totalCount / Math.max(1, effectivePageSize)))
  const serialBase = listQuery.data?.serialBase ?? (page - 1) * effectivePageSize

  const summaryStats = useMemo(
    () =>
      buildSummaryStatItems(
        summaryQuery.data?.total,
        summaryQuery.data?.openCount,
        summaryQuery.data?.byStatus ?? [],
        summaryQuery.data?.byTriggerType ?? [],
      ),
    [summaryQuery.data],
  )

  const typeOptions = useMemo(
    () => [
      { value: 'all', label: 'Type: All', searchText: 'all types' },
      ...(typesQuery.data ?? []).map((option) => ({
        value: option.value,
        label: option.label,
        searchText: [option.label, option.code, option.value].join(' '),
      })),
    ],
    [typesQuery.data],
  )

  const statusOptions = useMemo(
    () =>
      WORK_ORDER_STATUS_OPTIONS.map((option) => ({
        value: option.value === 'all' ? 'all' : option.value,
        label: option.value === 'all' ? 'Status: All' : option.label,
        searchText: option.label,
      })),
    [],
  )

  useEffect(() => {
    setPage(1)
  }, [
    search,
    typeFilter,
    statusFilter,
    pageSize,
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
      typeFilter ||
      statusFilter ||
      commonFilters.agencyId ||
      commonFilters.fromDate ||
      commonFilters.toDate,
  )

  const emptyMessage = hasActiveFilters
    ? 'No work orders match your filters.'
    : 'No work orders found.'

  const recordCountLabel = listQuery.isLoading
    ? 'Loading records…'
    : `${totalCount.toLocaleString('en-BT')} record${totalCount === 1 ? '' : 's'}`

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title="Maintenance Reports" subtitle={recordCountLabel} />
        <ReportExportActions onExport={handleExport} />
      </div>

      {summaryQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-[74px] rounded-lg" />
          ))}
        </div>
      ) : summaryStats.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {summaryStats.map((item) => (
            <DashboardStatCard
              key={item.id}
              label={item.label}
              value={item.value}
              icon={item.icon}
              accent={item.accent}
            />
          ))}
        </div>
      ) : null}

      <Card className="min-w-0 rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="min-w-0 space-y-4 p-0">
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-[var(--fms-text-header)]">
              Maintenance Summary
            </h2>

            <ReportTableToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search..."
              searchAriaLabel="Search maintenance report"
              fromDate={commonFilters.fromDate}
              toDate={commonFilters.toDate}
              org={commonFilters.org}
              onFromDateChange={commonFilters.setFromDate}
              onToDateChange={commonFilters.setToDate}
              onOrgChange={commonFilters.setOrg}
              showAgency={commonFilters.showAgencyFilter}
              extraFilters={
                <>
                  <SearchableAutocomplete
                    value={typeFilter || 'all'}
                    onChange={(value) => setTypeFilter(value === 'all' ? '' : value)}
                    options={typeOptions}
                    loading={typesQuery.isLoading}
                    placeholder="Type: All"
                    searchPlaceholder="Search type…"
                    emptyMessage="No matching type."
                    className="w-full sm:w-44"
                  />
                  <SearchableAutocomplete
                    value={statusFilter || 'all'}
                    onChange={(value) => setStatusFilter(value === 'all' ? '' : value)}
                    options={statusOptions}
                    placeholder="Status: All"
                    searchPlaceholder="Search status…"
                    emptyMessage="No matching status."
                    className="w-full sm:w-52"
                  />
                </>
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
                {listQuery.isLoading ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={REPORT_COLUMNS.length}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      Loading work orders…
                    </td>
                  </tr>
                ) : listQuery.isError ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={REPORT_COLUMNS.length}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      {listQuery.error instanceof Error
                        ? listQuery.error.message
                        : 'Could not load work orders.'}
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
                        {row.workOrderNumber}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[var(--fms-text-header)]">
                        {row.vehicle}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">{row.type}</td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">
                        {toMaintenanceDisplayLabel(row.triggerType)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={workOrderStatusBadgeClass(row.status)}>
                          {formatWorkOrderStatusLabel(row.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[var(--fms-text-header)]">
                        {row.date}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[var(--fms-text-header)]">
                        {formatMaintenanceReportAmount(row.estimatedCost)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[var(--fms-text-header)]">
                        {formatMaintenanceReportAmount(row.actualCost)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {listQuery.isLoading ? (
              <ListPanelMessage>Loading work orders…</ListPanelMessage>
            ) : listQuery.isError ? (
              <ListPanelMessage tone="error">
                {listQuery.error instanceof Error
                  ? listQuery.error.message
                  : 'Could not load work orders.'}
              </ListPanelMessage>
            ) : rows.length === 0 ? (
              <ListPanelMessage>{emptyMessage}</ListPanelMessage>
            ) : (
              rows.map((row, index) => (
                <MobileListCard key={row.id}>
                  <MobileListField label="Sl.No">{serialBase + index + 1}</MobileListField>
                  <MobileListField label="Work Order">{row.workOrderNumber}</MobileListField>
                  <MobileListField label="Vehicle">{row.vehicle}</MobileListField>
                  <MobileListField label="Type">{row.type}</MobileListField>
                  <MobileListField label="Trigger">
                    {toMaintenanceDisplayLabel(row.triggerType)}
                  </MobileListField>
                  <MobileListField label="Status">
                    <Badge className={workOrderStatusBadgeClass(row.status)}>
                      {formatWorkOrderStatusLabel(row.status)}
                    </Badge>
                  </MobileListField>
                  <MobileListField label="Date">{row.date}</MobileListField>
                  <MobileListField label="Est. Cost">
                    {formatMaintenanceReportAmount(row.estimatedCost)}
                  </MobileListField>
                  <MobileListField label="Actual Cost">
                    {formatMaintenanceReportAmount(row.actualCost)}
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
