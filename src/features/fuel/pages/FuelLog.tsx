import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  formatFuelLogCost,
  formatFuelLogDate,
  formatFuelLogQuota,
  getFuelLogs,
  type FuelLogRecord,
} from '@/features/fuel/lib/fuel-log-mock-data'
import { PageHeader } from '@/shared/components/PageHeader'
import { DetailRowActionButton } from '@/shared/components/TableRowActionButtons'
import { TablePagination } from '@/shared/components/TablePagination'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'

const TABLE_COLUMNS = [
  'Sl.No',
  'Driver',
  'Vehicle',
  'Quota',
  'Date',
  'Liters',
  'Total Cost',
  'Status',
] as const

function FuelLogStatusCell({ status }: { status: FuelLogRecord['status'] }) {
  if (status === 'VERIFIED') {
    return (
      <span className="text-xs font-bold uppercase tracking-wide text-[#0a72a5]">
        VERIFIED
      </span>
    )
  }
  return (
    <span className="rounded-full bg-[#fff4cc] px-2 py-1 text-xs font-semibold text-[#9f7b00]">
      PENDING
    </span>
  )
}

export default function FuelLog() {
  const navigate = useNavigate()
  const location = useLocation()
  const crud = useRouteCrudPermissions('/fuel/logs')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const allRows = useMemo(() => getFuelLogs(), [location.pathname, location.key])

  const totalCount = allRows.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const serialBase = (page - 1) * pageSize

  const rows = useMemo(() => {
    const start = serialBase
    return allRows.slice(start, start + pageSize)
  }, [allRows, pageSize, serialBase])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const openDetail = (row: FuelLogRecord) => {
    navigate(`/fuel/logs/${encodeURIComponent(row.id)}`)
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title="Fuel Log" subtitle="View and manage fuel refill records." />
        <Button
          asChild
          className="w-full bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)] sm:w-auto"
          disabled={!crud.canCreate && crud.isResolved}
        >
          <Link to="/fuel/create-fuel-log">
            <Plus className="mr-1 h-4 w-4" />
            Add Fuel Log
          </Link>
        </Button>
      </div>

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="space-y-4 p-0">
          <div className="overflow-x-auto rounded-lg border border-[var(--fms-strokes)]">
            <table className="w-full min-w-[1080px] text-sm">
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
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMNS.length + 1}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      No fuel logs found.
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
                      <td className="px-4 py-3 font-semibold text-[var(--fms-text-header)]">
                        {row.vehicle}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {formatFuelLogQuota(row.quotaUsed, row.quotaTotal)}
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
                        <DetailRowActionButton type="button" disabled={!crud.canRead && crud.isResolved} onClick={() => openDetail(row)} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
