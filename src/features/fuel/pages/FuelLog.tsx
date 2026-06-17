import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FuelTableListToolbar } from '@/features/fuel/components/FuelTableListToolbar'
import { FuelLogStatusCell } from '@/features/fuel/components/FuelLogStatusCell'
import {
  fetchFuelLogsPage,
  type FuelLogListRow,
} from '@/features/fuel/lib/fuel-logs-api'
import {
  formatFuelLogCost,
  formatFuelLogDate,
  formatFuelLogQuota,
} from '@/features/fuel/lib/fuel-log-mock-data'
import {
  ListPanelMessage,
  MobileListCard,
  MobileListField,
} from '@/shared/components/MobileListCard'
import { PageHeader } from '@/shared/components/PageHeader'
import {
  DetailRowActionButton,
  rowActionsContainerClassName,
} from '@/shared/components/TableRowActionButtons'
import { TablePagination } from '@/shared/components/TablePagination'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'

const TABLE_COLUMNS = [
  'Sl.No',
  'Driver',
  'Vehicle',
  'Date',
  'Liters',
  'Total Cost',
  'Status',
] as const

export default function FuelLog() {
  const navigate = useNavigate()
  const crud = useRouteCrudPermissions('/fuel/logs')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const listQuery = useQuery({
    queryKey: ['fuel-logs', search, page, pageSize],
    queryFn: () => fetchFuelLogsPage(search, page, pageSize),
    enabled: !crud.isResolved || crud.canRead,
    staleTime: 30_000,
  })

  const rows = listQuery.data?.rows ?? []
  const totalCount = listQuery.data?.totalCount ?? rows.length
  const effectivePageSize = listQuery.data?.effectivePageSize ?? pageSize
  const totalPages =
    listQuery.data?.totalPages ?? Math.max(1, Math.ceil(totalCount / Math.max(1, effectivePageSize)))
  const serialBase = listQuery.data?.serialBase ?? (page - 1) * pageSize

  useEffect(() => {
    setPage(1)
  }, [search, pageSize])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const openDetail = (row: FuelLogListRow) => {
    navigate(`/fuel/logs/${encodeURIComponent(row.id)}`)
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title="Fuel Log" subtitle="View and manage fuel refill records." />
        {crud.canCreate ? (
          <Button
            asChild
            className="w-full bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)] sm:w-auto"
          >
            <Link to="/fuel/create-fuel-log">
              <Plus className="mr-1 h-4 w-4" />
              Add Fuel Log
            </Link>
          </Button>
        ) : null}
      </div>

      <Card className="min-w-0 rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="min-w-0 space-y-4 p-0">
          <FuelTableListToolbar
            search={search}
            onSearchChange={(next) => {
              setSearch(next)
              setPage(1)
            }}
            searchPlaceholder="Search driver, vehicle, status, date…"
            searchAriaLabel="Search fuel logs"
          />

          <div className="hidden w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
            <table className="w-max min-w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  {TABLE_COLUMNS.map((column) => (
                    <th
                      key={column}
                      className="px-4 py-3 text-left font-semibold"
                    >
                      {column}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {crud.isResolved && !crud.canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMNS.length + 1}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      You do not have permission to view fuel logs.
                    </td>
                  </tr>
                ) : listQuery.isLoading ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMNS.length + 1}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      Loading fuel logs…
                    </td>
                  </tr>
                ) : listQuery.isError ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMNS.length + 1}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      {listQuery.error instanceof Error
                        ? listQuery.error.message
                        : 'Could not load fuel logs.'}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMNS.length + 1}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      {search.trim()
                        ? 'No fuel logs match your search.'
                        : 'No fuel logs found.'}
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr
                      key={row.id}
                      className="border-t border-[var(--fms-strokes)]"
                    >
                      <td className="px-4 py-3 tabular-nums text-[var(--fms-text-subheading)]">
                        {serialBase + index + 1}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">
                        {row.driver}
                      </td>
                      <td className="px-4 py-3  text-[var(--fms-text-header)]">
                        {row.vehicle}
                      </td>
                     
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {formatFuelLogDate(row.date)}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.liters}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {formatFuelLogCost(row.totalCost)}
                      </td>
                      <td className="px-4 py-3">
                        <FuelLogStatusCell status={row.status} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <DetailRowActionButton
                          type="button"
                          disabled={!crud.canRead && crud.isResolved}
                          onClick={() => openDetail(row)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {crud.isResolved && !crud.canRead ? (
              <ListPanelMessage>
                You do not have permission to view fuel logs.
              </ListPanelMessage>
            ) : listQuery.isLoading ? (
              <ListPanelMessage>Loading fuel logs…</ListPanelMessage>
            ) : listQuery.isError ? (
              <ListPanelMessage tone="error">
                {listQuery.error instanceof Error
                  ? listQuery.error.message
                  : 'Could not load fuel logs.'}
              </ListPanelMessage>
            ) : rows.length === 0 ? (
              <ListPanelMessage>
                {search.trim()
                  ? 'No fuel logs match your search.'
                  : 'No fuel logs found.'}
              </ListPanelMessage>
            ) : (
              rows.map((row, index) => (
                <MobileListCard key={row.id}>
                  <MobileListField label="Sl.No">
                    {serialBase + index + 1}
                  </MobileListField>
                  <MobileListField label="Driver">{row.driver}</MobileListField>
                  <MobileListField label="Vehicle">{row.vehicle}</MobileListField>
                  <MobileListField label="Quota">
                    {formatFuelLogQuota(row.quotaUsed, row.quotaTotal)}
                  </MobileListField>
                  <MobileListField label="Date">
                    {formatFuelLogDate(row.date)}
                  </MobileListField>
                  <MobileListField label="Liters">{row.liters}</MobileListField>
                  <MobileListField label="Total Cost">
                    {formatFuelLogCost(row.totalCost)}
                  </MobileListField>
                  <p className="text-sm text-[var(--fms-text-subheading)]">
                    <span className="font-medium text-[var(--fms-text-header)]">
                      Status:
                    </span>{' '}
                    <FuelLogStatusCell status={row.status} />
                  </p>
                  <div className={`mt-3 ${rowActionsContainerClassName}`}>
                    <DetailRowActionButton
                      type="button"
                      disabled={!crud.canRead && crud.isResolved}
                      onClick={() => openDetail(row)}
                    />
                  </div>
                </MobileListCard>
              ))
            )}
          </div>

          <TablePagination
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={(nextPage) =>
              setPage(Math.max(1, Math.min(nextPage, totalPages)))
            }
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
