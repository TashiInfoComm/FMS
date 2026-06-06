import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  filterDriverAssignments,
  formatDriverRoute,
  getDriverAssignments,
} from '@/features/trips/lib/trip-assignment-mock-data'
import { PageHeader } from '@/shared/components/PageHeader'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { DetailRowActionButton } from '@/shared/components/TableRowActionButtons'

export default function MyAssignments() {
  const navigate = useNavigate()
  const crud = useRouteCrudPermissions('/trip/my-assignments')
  const [search, setSearch] = useState('')

  const rows = useMemo(() => {
    const all = getDriverAssignments()
    return filterDriverAssignments(all, search)
  }, [search])

  const openStatusUpdate = (requestId: string) => {
    navigate(`/trip/my-assignments/${encodeURIComponent(requestId)}`)
  }

  return (
    <section className="space-y-5">
      <PageHeader
        title="My Assignments"
        subtitle="Driver first sees assigned trips here, then opens a trip to update its status."
      />

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="space-y-4 p-0">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fms-text-subheading)]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search request ID, applicant, destination, status…"
              className="h-10 pl-9"
              aria-label="Search assignments"
            />
          </div>

          <div className="overflow-hidden rounded-lg border border-[var(--fms-strokes)]">
            <table className="w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  <th className="w-16 px-4 py-3 text-left font-semibold">Sl.No</th>
                  <th className="px-4 py-3 text-left font-semibold">Trip</th>
                  <th className="px-4 py-3 text-left font-semibold">Route</th>
                  <th className="px-4 py-3 text-left font-semibold">Vehicle</th>
                                  <th className="px-4 py-3 text-left font-semibold">Time</th>
                  <th className="px-4 py-3 text-left font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {crud.isResolved && !crud.canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      You do not have permission to view assignments.
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      No assignments match your search.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr
                      key={row.id}
                      className="cursor-pointer border-t border-[var(--fms-strokes)] hover:bg-[#fafafa]"
                      
                    >
                      <td className="px-4 py-3 tabular-nums text-[var(--fms-text-subheading)]">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 font-medium text-[var(--fms-primary)]">
                        {row.requestId}
                      </td>
                      <td className="px-4 py-3">
                        {formatDriverRoute(row.origin, row.destination)}
                      </td>
                      <td className="px-4 py-3">{row.vehiclePlate}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {row.scheduledTime}
                          </td>
                          <td className="px-4 py-3">
                            <DetailRowActionButton
                              name={row.requestId}
                              tooltip="View Details"
                              onClick={() => openStatusUpdate(row.requestId)}
                            />
                          </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
