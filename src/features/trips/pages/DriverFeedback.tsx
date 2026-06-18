import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { TripTableListToolbar } from '@/features/trips/components/TripTableListToolbar'
import {
  formatFeedbackRoute,
  formatFeedbackVehicle,
  type DriverFeedbackStatus,
} from '@/features/trips/lib/trip-driver-feedback-mock-data'
import { fetchDriverFeedbackTripsPage } from '@/features/trips/lib/trips-api'
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
import { tripStatusBadgeClass } from '@/features/trips/lib/trip-form-utils'
import { cn } from '@/lib/utils'

const TABLE_COLUMN_COUNT = 9

function feedbackBadgeClass(status: DriverFeedbackStatus) {
  return status === 'Pending'
    ? 'border-transparent bg-[#fef3c7] text-[#b45309] hover:bg-[#fef3c7]'
    : 'border-transparent bg-[#d0fae5] text-[#007a55] hover:bg-[#d0fae5]'
}

export default function DriverFeedback() {
  const navigate = useNavigate()
  const crud = useRouteCrudPermissions('/trip/driver-feedback')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const listQuery = useQuery({
    queryKey: ['trips', 'driver-feedback', search, page, pageSize],
    queryFn: () => fetchDriverFeedbackTripsPage(search, page, pageSize),
    enabled: !crud.isResolved || crud.canRead,
    staleTime: 30_000,
  })

  const rows = useMemo(() => listQuery.data?.rows ?? [], [listQuery.data?.rows])
  const totalCount = listQuery.data?.totalCount ?? rows.length
  const effectivePageSize = listQuery.data?.effectivePageSize ?? pageSize
  const totalPages =
    listQuery.data?.totalPages ??
    Math.max(1, Math.ceil(totalCount / Math.max(1, effectivePageSize)))

  useEffect(() => {
    setPage(1)
  }, [search, pageSize])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const openRateDriver = (row: (typeof rows)[number]) => {
    navigate(`/trip/driver-feedback/${encodeURIComponent(row.id)}/rate`, {
      state: {
        hasFeedback: row.feedbackStatus === 'Completed',
        driverName: row.driverName !== '—' ? row.driverName : undefined,
      },
    })
  }

  return (
    <section className="space-y-5">
      <PageHeader
        title="Driver Feedback"
        subtitle="Select a completed trip and rate the assigned driver."
      />

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="space-y-4 p-0">
          <TripTableListToolbar
            search={search}
            onSearchChange={(next) => {
              setSearch(next)
              setPage(1)
            }}
            searchPlaceholder="Search trip type, route, driver, vehicle…"
            searchAriaLabel="Search completed trips"
          />

          <div className="hidden w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
            <table className="w-max min-w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  <th className="w-16 px-4 py-3 text-left font-semibold">Sl.No</th>
                  <th className="px-4 py-3 text-left font-semibold">Trip Type</th>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Route</th>
                  <th className="px-4 py-3 text-left font-semibold">Trip Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Feedback</th>
                  <th className="px-4 py-3 text-left font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {crud.isResolved && !crud.canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMN_COUNT}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      You do not have permission to view driver feedback.
                    </td>
                  </tr>
                ) : listQuery.isLoading ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMN_COUNT}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      Loading completed trips…
                    </td>
                  </tr>
                ) : listQuery.isError ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMN_COUNT}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      {listQuery.error instanceof Error
                        ? listQuery.error.message
                        : 'Could not load completed trips.'}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMN_COUNT}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      {search.trim()
                        ? 'No completed trips match your search.'
                        : 'No completed trips found.'}
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr
                      key={row.id}
                      className={cn(
                        'border-t border-[var(--fms-strokes)]',
                        row.feedbackStatus === 'Pending' && 'hover:bg-[#fafafa]',
                      )}
                    >
                      <td className="px-4 py-3 tabular-nums text-[var(--fms-text-subheading)]">
                        {(listQuery.data?.serialBase ?? 0) + index + 1}
                      </td>
                      <td className="px-4 py-3 font-medium text-[var(--fms-text-header)]">
                        {row.tripType}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.date}</td>
                      <td className="px-4 py-3">
                        {formatFeedbackRoute(row.origin, row.destination)}
                      </td>

                      <td className="px-4 py-3">
                        <Badge className={tripStatusBadgeClass('COMPLETED')}>
                          {row.tripStatus}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={feedbackBadgeClass(row.feedbackStatus)}>
                          {row.feedbackStatus}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <DetailRowActionButton
                          name={row.tripType}
                          tooltip={
                            row.feedbackStatus === 'Completed'
                              ? 'View feedback'
                              : 'Rate driver'
                          }
                          onClick={() => openRateDriver(row)}
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
                You do not have permission to view driver feedback.
              </ListPanelMessage>
            ) : listQuery.isLoading ? (
              <ListPanelMessage>Loading completed trips…</ListPanelMessage>
            ) : listQuery.isError ? (
              <ListPanelMessage tone="error">
                {listQuery.error instanceof Error
                  ? listQuery.error.message
                  : 'Could not load completed trips.'}
              </ListPanelMessage>
            ) : rows.length === 0 ? (
              <ListPanelMessage>
                {search.trim()
                  ? 'No completed trips match your search.'
                  : 'No completed trips found.'}
              </ListPanelMessage>
            ) : (
              rows.map((row, index) => (
                <MobileListCard key={row.id}>
                  <MobileListField label="Sl.No">
                    {(listQuery.data?.serialBase ?? 0) + index + 1}
                  </MobileListField>
                  <MobileListField label="Trip Type">
                    <span className="font-medium text-[var(--fms-text-header)]">
                      {row.tripType}
                    </span>
                  </MobileListField>
                  <MobileListField label="Date">{row.date}</MobileListField>
                  <MobileListField label="Route">
                    {formatFeedbackRoute(row.origin, row.destination)}
                  </MobileListField>
                  <MobileListField label="Vehicle">
                    {formatFeedbackVehicle(row.vehiclePlate, row.vehicleModel)}
                  </MobileListField>
                  <MobileListField label="Driver">{row.driverName}</MobileListField>
                  <p className="text-sm text-[var(--fms-text-subheading)]">
                    <span className="font-medium text-[var(--fms-text-header)]">
                      Trip Status:
                    </span>{' '}
                    <Badge className={tripStatusBadgeClass('COMPLETED')}>
                      {row.tripStatus}
                    </Badge>
                  </p>
                  <p className="text-sm text-[var(--fms-text-subheading)]">
                    <span className="font-medium text-[var(--fms-text-header)]">
                      Feedback:
                    </span>{' '}
                    <Badge className={feedbackBadgeClass(row.feedbackStatus)}>
                      {row.feedbackStatus}
                    </Badge>
                  </p>
                  <div className={`mt-3 ${rowActionsContainerClassName}`}>
                    <DetailRowActionButton
                      name={row.tripType}
                      tooltip={
                        row.feedbackStatus === 'Completed' ? 'View feedback' : 'Rate driver'
                      }
                      onClick={() => openRateDriver(row)}
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
