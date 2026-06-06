import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { TRIP_REQUISITION_MOCK_ROWS } from '@/features/trips/lib/trip-request-mock-data'
import { PageHeader } from '@/shared/components/PageHeader'
import { TablePagination } from '@/shared/components/TablePagination'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'

function TripRequisition() {
  const crud = useRouteCrudPermissions('/trip/requisition')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const allRows = TRIP_REQUISITION_MOCK_ROWS
  const totalCount = allRows.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  const rows = useMemo(() => {
    const start = (page - 1) * pageSize
    return allRows.slice(start, start + pageSize)
  }, [allRows, page, pageSize])

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="My Trips"
          subtitle="View and manage all submitted trip requests."
        />
        {crud.canCreate ? (
          <Button asChild className="w-full sm:w-auto">
            <Link to="/trip/request/create">
              <Plus className="mr-1 h-4 w-4" />
              Request New Trip
            </Link>
          </Button>
        ) : null}
      </div>

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="space-y-4 p-0">
          <div className="overflow-hidden rounded-lg border border-[var(--fms-strokes)]">
            <table className="w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Sl.No</th>
                  <th className="px-4 py-3 text-left font-semibold">Trip</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Purpose of Journey
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Journey Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Origin</th>
                  <th className="px-4 py-3 text-left font-semibold">Destination</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {crud.isResolved && !crud.canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      You do not have permission to view this data.
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      No trip requests found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-[var(--fms-strokes)]"
                    >
                      <td className="px-4 py-3">{row.serialNo}</td>
                      <td className="px-4 py-3">{row.tripType}</td>
                      <td className="px-4 py-3">{row.purpose}</td>
                      <td className="px-4 py-3">{row.journeyDate}</td>
                      <td className="px-4 py-3">{row.origin}</td>
                      <td className="px-4 py-3">{row.destination}</td>
                      <td className="px-4 py-3">{row.status}</td>
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

export default TripRequisition
