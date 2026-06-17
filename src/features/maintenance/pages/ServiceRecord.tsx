import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { WorkOrderListItem } from '@/features/maintenance/lib/maintenance-mock-data'
import { workOrderStatusBadgeClass } from '@/features/maintenance/lib/maintenance-ui'
import { fetchWorkOrdersPage } from '@/features/maintenance/lib/work-orders-api'
import { PageHeader } from '@/shared/components/PageHeader'
import {
  DetailRowActionButton,
  rowActionsContainerClassName,
} from '@/shared/components/TableRowActionButtons'
import { TablePagination } from '@/shared/components/TablePagination'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'

const COMPLETED_STATUS_FILTER = 'COMPLETED'

function ServiceRecordCell({ row }: { row: WorkOrderListItem }) {
  return (
    <p className="font-semibold text-[var(--fms-text-header)]">
      {row.workOrderId}
    </p>
  )
}

export default function ServiceRecord() {
  const navigate = useNavigate()
  const crud = useRouteCrudPermissions('/maintenance/records')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const listQuery = useQuery({
    queryKey: [
      'maintenance-service-records',
      search,
      COMPLETED_STATUS_FILTER,
      page,
      pageSize,
    ],
    queryFn: () =>
      fetchWorkOrdersPage(search, COMPLETED_STATUS_FILTER, page, pageSize),
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
  }, [search, pageSize])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const openDetail = (id: string) => {
    navigate(`/maintenance/work-orders/${encodeURIComponent(id)}`, {
      state: { returnTo: '/maintenance/records' },
    })
  }

  return (
    <section className="space-y-5">
      <PageHeader
        title="Vehicle Service"
        subtitle="Report issues and complete assigned vehicle maintenance."
      />

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="space-y-4 p-0">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fms-text-subheading)]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search work order ID, vehicle, status…"
              className="h-10 pl-9"
              aria-label="Search vehicle service records"
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
                      You do not have permission to view service records.
                    </td>
                  </tr>
                ) : listQuery.isLoading ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      Loading service records…
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
                        : 'Could not load service records.'}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      {search.trim()
                        ? 'No completed service records match your search.'
                        : 'No completed service records found.'}
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
                        <ServiceRecordCell row={row} />
                      </td>
                      <td className="px-4 py-4 text-[var(--fms-text-header)]">
                        {row.vehiclePlate}
                      </td>
                      <td className="px-4 py-4 text-[var(--fms-text-subheading)]">
                        {row.maintenanceType}
                      </td>
                      <td className="px-4 py-4">
                        <Badge
                          className={workOrderStatusBadgeClass(row.status)}
                        >
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
                            aria-label={`View service record ${row.workOrderId}`}
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
