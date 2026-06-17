import { useQuery } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { WorkOrderListItem } from '@/features/maintenance/lib/maintenance-mock-data'
import { WORK_ORDER_STATUS_OPTIONS } from '@/features/maintenance/lib/maintenance-mock-data'
import { workOrderStatusBadgeClass } from '@/features/maintenance/lib/maintenance-ui'
import { fetchWorkOrdersPage } from '@/features/maintenance/lib/work-orders-api'
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
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const listQuery = useQuery({
    queryKey: ['maintenance-work-orders', search, statusFilter, page, pageSize],
    queryFn: () => fetchWorkOrdersPage(search, statusFilter, page, pageSize),
    enabled: !crud.isResolved || crud.canRead,
    staleTime: 30_000,
  })

  const rows = useMemo(() => listQuery.data?.rows ?? [], [listQuery.data?.rows])
  const totalCount = listQuery.data?.totalCount ?? rows.length
  const effectivePageSize = listQuery.data?.effectivePageSize ?? pageSize
  const totalPages =
    listQuery.data?.totalPages ??
    Math.max(1, Math.ceil(totalCount / Math.max(1, effectivePageSize)))
  const serialBase = listQuery.data?.serialBase ?? (page - 1) * pageSize

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, pageSize])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const openDetail = (id: string) => {
    navigate(`/maintenance/work-orders/${encodeURIComponent(id)}`)
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select
              value={statusFilter}
              onValueChange={(next) => {
                setStatusFilter(next)
                setPage(1)
              }}
            >
              <SelectTrigger className="h-10 w-full sm:w-[220px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                {WORK_ORDER_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fms-text-subheading)]" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search work order ID, vehicle, status…"
                className="h-10 pl-9"
                aria-label="Search work orders"
              />
            </div>
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
                ) : listQuery.isLoading ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      Loading work orders…
                    </td>
                  </tr>
                ) : listQuery.isError ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={6}
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
                      colSpan={6}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      {search.trim() || statusFilter !== 'all'
                        ? 'No work orders match your filters.'
                        : 'No work orders found.'}
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
                            onClick={() => openDetail(row.id)}
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
