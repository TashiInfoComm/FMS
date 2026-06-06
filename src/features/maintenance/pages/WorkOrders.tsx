import { Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  filterWorkOrders,
  WORK_ORDER_MOCK_ROWS,
  type WorkOrderListItem,
} from '@/features/maintenance/lib/maintenance-mock-data'
import { workOrderStatusBadgeClass } from '@/features/maintenance/lib/maintenance-ui'
import { PageHeader } from '@/shared/components/PageHeader'
import {
  DetailRowActionButton,
  rowActionsContainerClassName,
} from '@/shared/components/TableRowActionButtons'
import { TablePagination } from '@/shared/components/TablePagination'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'

function WorkOrderCell({ row }: { row: WorkOrderListItem }) {
  return (
    <div className="space-y-0.5">
      <p className="font-semibold text-[var(--fms-text-header)]">
        {row.workOrderId}
      </p>
      {row.assetCode ? (
        <p className="text-sm text-[var(--fms-text-header)]">{row.assetCode}</p>
      ) : null}
    </div>
  )
}

export default function WorkOrders() {
  const navigate = useNavigate()
  const crud = useRouteCrudPermissions('/maintenance/work-orders')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const filtered = useMemo(
    () => filterWorkOrders(WORK_ORDER_MOCK_ROWS, search),
    [search],
  )

  const totalCount = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  const serialBase = (page - 1) * pageSize

  const rows = useMemo(() => {
    const start = serialBase
    return filtered.slice(start, start + pageSize)
  }, [filtered, pageSize, serialBase])

  useEffect(() => {
    setPage(1)
  }, [search, pageSize])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const openDetail = (workOrderId: string) => {
    navigate(`/maintenance/work-orders/${encodeURIComponent(workOrderId)}`)
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Maintenance Work Orders"
          subtitle="Review, approve and verify maintenance work."
        />
        {crud.canCreate ? (
          <Button asChild className="w-full sm:w-auto">
            <Link to="/maintenance/work-orders/create">
              <Plus className="mr-1 h-4 w-4" />
              New Requisition
            </Link>
          </Button>
        ) : null}
      </div>

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="space-y-4 p-0">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fms-text-subheading)]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search work order ID, vehicle, status…"
              className="h-10 pl-9"
              aria-label="Search work orders"
            />
          </div>

          <div className="overflow-hidden rounded-lg border border-[var(--fms-strokes)]">
            <table className="w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  <th className="w-16 px-4 py-3 text-left font-semibold">Sl.No</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Work Orders
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Vehicle Number
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Maintenance Type
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {crud.isResolved && !crud.canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      You do not have permission to view work orders.
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      No work orders match your search.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr
                      key={row.id}
                      className="border-t border-[var(--fms-strokes)]"
                    >
                      <td className="px-4 py-4 tabular-nums text-[var(--fms-text-subheading)]">
                        {serialBase + index + 1}
                      </td>
                      <td className="px-4 py-4">
                        <WorkOrderCell row={row} />
                      </td>
                      <td className="px-4 py-4 text-[var(--fms-text-header)]">
                        {row.vehiclePlate}
                      </td>
                      <td className="px-4 py-4 text-[var(--fms-text-subheading)]">
                        {row.maintenanceType}
                      </td>
                      <td className="px-4 py-4">
                        <Badge className={workOrderStatusBadgeClass(row.status)}>
                          {row.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <div
                          className={`${rowActionsContainerClassName} justify-end`}
                        >
                          <DetailRowActionButton
                            type="button"
                            tooltip="View details"
                            aria-label={`View work order ${row.workOrderId}`}
                            onClick={() => openDetail(row.workOrderId)}
                          />
                        </div>
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
