import { Eye, Pencil, Plus, Search, Star, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DeleteDialog } from '@/shared/components/DeleteDialog'
import { PageHeader } from '@/shared/components/PageHeader'

type AssignVehicleRow = {
  id: number
  name: string
  cid: string
  license: string
  expiry: string
  status: string
  assignedVehicle: string
  rating: number
}

const initialRows: AssignVehicleRow[] = [
  {
    id: 1,
    name: 'Sonam Dorji',
    cid: '11501001234',
    license: 'LN12345',
    expiry: '2025-12-31',
    status: 'Active',
    assignedVehicle: 'Toyota Hilux',
    rating: 4.5,
  },
  {
    id: 2,
    name: 'Karma Wangmo',
    cid: '11502005678',
    license: 'LN67890',
    expiry: '2024-06-15',
    status: 'On Leave',
    assignedVehicle: 'Honda Civic',
    rating: 4.5,
  },
]

export function AssignVehiclePage() {
  const [rows, setRows] = useState(initialRows)
  const [query, setQuery] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const filteredRows = useMemo(() => {
    if (!query.trim()) return rows
    return rows.filter((row) =>
      `${row.name} ${row.cid} ${row.license} ${row.assignedVehicle}`.toLowerCase().includes(query.toLowerCase()),
    )
  }, [query, rows])

  const askDelete = (id: number) => {
    setSelectedId(id)
    setDeleteOpen(true)
  }

  const confirmDelete = () => {
    if (selectedId === null) return
    setRows((prev) => prev.filter((row) => row.id !== selectedId))
    setSelectedId(null)
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title="Assign Vehicle" subtitle="Manage driver records and assign vehicle configurations" />
        <Button asChild className="w-full sm:w-auto">
          <Link to="/master/assign-vehicle/add">
            <Plus className="mr-1 h-4 w-4" />
            Assign New
          </Link>
        </Button>
      </div>

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="space-y-4 p-0">
          <div className="flex justify-end">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--fms-text-subheading)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by CID or name"
                className="h-10 w-full rounded-md border border-[var(--fms-strokes)] bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[var(--fms-info-border)]"
              />
            </div>
          </div>

          <div className="hidden overflow-hidden rounded-lg border border-[var(--fms-strokes)] md:block">
            <table className="w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Driver ID</th>
                  <th className="px-4 py-3 text-left font-semibold">Name & CID</th>
                  <th className="px-4 py-3 text-left font-semibold">License Number</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Assigned Vehicle</th>
                  <th className="px-4 py-3 text-left font-semibold">Rating</th>
                  <th className="px-4 py-3 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--fms-strokes)]">
                    <td className="px-4 py-3">{row.id}</td>
                    <td className="px-4 py-3">
                      <p>{row.name}</p>
                      <p className="text-xs text-[var(--fms-text-subheading)]">{row.cid}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{row.license}</p>
                      <p className="text-xs text-[var(--fms-text-subheading)]">Exp: {row.expiry}</p>
                    </td>
                    <td className="px-4 py-3">{row.status}</td>
                    <td className="px-4 py-3">{row.assignedVehicle}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1">
                        {row.rating}
                        <Star className="h-3.5 w-3.5 fill-[#facc15] text-[#facc15]" />
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center gap-2">
                        <button type="button" className="rounded p-1 hover:bg-[var(--fms-info-fill)]">
                          <Eye className="h-4 w-4 text-[var(--fms-text-header)]" />
                        </button>
                        <button type="button" className="rounded p-1 hover:bg-[var(--fms-info-fill)]">
                          <Pencil className="h-4 w-4 text-[var(--fms-text-header)]" />
                        </button>
                        <button type="button" className="rounded p-1 hover:bg-[var(--fms-error-fill)]" onClick={() => askDelete(row.id)}>
                          <Trash2 className="h-4 w-4 text-[var(--fms-delete)]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={confirmDelete}
        title="Delete Assignment"
        description="Are you sure you want to delete this assignment? This action cannot be undone."
      />
    </section>
  )
}
