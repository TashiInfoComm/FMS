import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { TripTableListToolbar } from '@/features/trips/components/TripTableListToolbar'
import { formatDriverRoute } from '@/features/trips/lib/trip-assignment-mock-data'
import { formatApplicantOrgLine, tripStatusBadgeClass } from '@/features/trips/lib/trip-form-utils'
import { formatTripDateTime } from '@/features/trips/lib/trip-request-mock-data'
import { fetchDriverAssignmentsPage } from '@/features/trips/lib/trips-api'
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

const TABLE_COLUMN_COUNT = 8

export default function MyAssignments() {
  const navigate = useNavigate()
  const crud = useRouteCrudPermissions('/trip/my-assignments')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const listQuery = useQuery({
    queryKey: ['trips', 'driver-assignments', search, page, pageSize],
    queryFn: () => fetchDriverAssignmentsPage(search, page, pageSize),
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

  const openStatusUpdate = (row: (typeof rows)[number]) => {
    navigate(`/trip/my-assignments/${encodeURIComponent(row.id)}`, {
      state: { hasFeedback: row.hasFeedback },
    })
  }

  return (
    <section className="space-y-5">
      <PageHeader
        title="My Assignments"
        subtitle="Driver first sees assigned trips here, then opens a trip to update its status."
      />

      <Card className="min-w-0 rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="min-w-0 space-y-4 p-0">
          <TripTableListToolbar
            search={search}
            onSearchChange={(next) => {
              setSearch(next)
              setPage(1)
            }}
            searchPlaceholder="Search request ID, applicant, destination, status…"
            searchAriaLabel="Search assignments"
          />

          <div className="hidden w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
            <table className="w-max min-w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  <th className="w-16 px-4 py-3 text-left font-semibold">Sl.No</th>
                  <th className="px-4 py-3 text-left font-semibold">Trip Type</th>
                  <th className="px-4 py-3 text-left font-semibold">Applicant</th>
                  <th className="px-4 py-3 text-left font-semibold">Route</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Journey Start
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
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
                      You do not have permission to view assignments.
                    </td>
                  </tr>
                ) : listQuery.isLoading ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMN_COUNT}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      Loading assignments…
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
                        : 'Could not load assignments.'}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMN_COUNT}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      {search.trim()
                        ? 'No assignments match your search.'
                        : 'No assignments found.'}
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr
                      key={row.id}
                      className="cursor-pointer border-t border-[var(--fms-strokes)] hover:bg-[#fafafa]"
                      onClick={() => openStatusUpdate(row)}
                    >
                      <td className="px-4 py-3 tabular-nums text-[var(--fms-text-subheading)]">
                        {(listQuery.data?.serialBase ?? 0) + index + 1}
                      </td>
                      <td className="px-4 py-3">{row.tripType}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--fms-text-header)]">
                          {row.applicantName}
                        </p>
                        <p className="text-xs text-[var(--fms-text-subheading)]">
                          {formatApplicantOrgLine(
                            row.applicantAgency,
                            row.applicantDepartment,
                          )}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        {formatDriverRoute(row.origin, row.destination)}
                      </td>
                     
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatTripDateTime(
                          row.journeyStartDate,
                          row.journeyStartTime,
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={tripStatusBadgeClass(
                            row.statusCode || row.status,
                          )}
                        >
                          {row.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <DetailRowActionButton
                          name={row.requestId}
                          tooltip="Start/End Trip"
                          onClick={() => openStatusUpdate(row)}
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
                You do not have permission to view assignments.
              </ListPanelMessage>
            ) : listQuery.isLoading ? (
              <ListPanelMessage>Loading assignments…</ListPanelMessage>
            ) : listQuery.isError ? (
              <ListPanelMessage tone="error">
                {listQuery.error instanceof Error
                  ? listQuery.error.message
                  : 'Could not load assignments.'}
              </ListPanelMessage>
            ) : rows.length === 0 ? (
              <ListPanelMessage>
                {search.trim()
                  ? 'No assignments match your search.'
                  : 'No assignments found.'}
              </ListPanelMessage>
            ) : (
              rows.map((row, index) => (
                <MobileListCard
                  key={row.id}
                  onClick={() => openStatusUpdate(row)}
                >
                  <MobileListField label="Sl.No">
                    {(listQuery.data?.serialBase ?? 0) + index + 1}
                  </MobileListField>
                  <MobileListField label="Trip Type">{row.tripType}</MobileListField>
                  <MobileListField label="Applicant">
                    <span className="font-medium text-[var(--fms-text-header)]">
                      {row.applicantName}
                    </span>
                    <br />
                    <span className="text-xs">
                      {formatApplicantOrgLine(
                        row.applicantAgency,
                        row.applicantDepartment,
                      )}
                    </span>
                  </MobileListField>
                  <MobileListField label="Route">
                    {formatDriverRoute(row.origin, row.destination)}
                  </MobileListField>
                  <MobileListField label="Vehicle">{row.vehiclePlate}</MobileListField>
                  <MobileListField label="Journey Start">
                    {formatTripDateTime(row.journeyStartDate, row.journeyStartTime)}
                  </MobileListField>
                  <p className="text-sm text-[var(--fms-text-subheading)]">
                    <span className="font-medium text-[var(--fms-text-header)]">
                      Status:
                    </span>{' '}
                    <Badge
                      className={tripStatusBadgeClass(
                        row.statusCode || row.status,
                      )}
                    >
                      {row.status}
                    </Badge>
                  </p>
                  <div
                    className={`mt-3 ${rowActionsContainerClassName}`}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <DetailRowActionButton
                      name={row.requestId}
                      tooltip="Start/End Trip"
                      onClick={() => openStatusUpdate(row)}
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
