// Lists vehicles with search, details, and management actions.
import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { DeleteDialog } from '@/shared/components/DeleteDialog'
import { PageHeader } from '@/shared/components/PageHeader'
import {
  DeleteRowActionButton,
  DetailRowActionButton,
  EditRowActionButton,
  rowActionsContainerClassName,
} from '@/shared/components/TableRowActionButtons'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'

type VehicleItem = {
  id: number
  makeModel: string
  status: string
  movement: string
  odometer: string
}

const initialVehicles: VehicleItem[] = [
  { id: 1, makeModel: 'Toyota Hilux (2020)', status: 'Active', movement: 'On Trip', odometer: '45,200 km' },
  { id: 2, makeModel: 'Ford Transit (2019)', status: 'Under Maintenance', movement: 'At Rest', odometer: '89,000 km' },
]

export function VehicleManagementPage() {
  const crud = useRouteCrudPermissions('/vehicle/list')
  const [vehicles, setVehicles] = useState(initialVehicles)
  const [query, setQuery] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null)

  // Client-side search across id, model, status, and movement labels.
  const filteredVehicles = useMemo(() => {
    if (!query.trim()) return vehicles
    return vehicles.filter((vehicle) => `${vehicle.id} ${vehicle.makeModel} ${vehicle.status} ${vehicle.movement}`.toLowerCase().includes(query.toLowerCase()))
  }, [query, vehicles])

  const askDelete = (id: number) => {
    if (!crud.canDelete) return
    setSelectedVehicleId(id)
    setDeleteOpen(true)
  }

  const confirmDelete = () => {
    if (!crud.canDelete) return
    if (selectedVehicleId === null) return
    // Mirrors AssignVehiclePage: optimistic local delete for the mock table.
    setVehicles((prev) => prev.filter((vehicle) => vehicle.id !== selectedVehicleId))
    setSelectedVehicleId(null)
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title="Vehicle" subtitle="Manage vehicle records and configurations" />
        {crud.canCreate ? (
          <Button asChild className="w-full sm:w-auto">
            <Link to="/vehicle/add">
              <Plus className="mr-1 h-4 w-4" />
              Add New
            </Link>
          </Button>
        ) : null}
      </div>

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="space-y-4 p-0">
          <div className="flex justify-end">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--fms-text-subheading)]" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by code or name"
                className="pl-9"
              />
            </div>
          </div>

          <div className="hidden overflow-hidden rounded-lg border border-[var(--fms-strokes)] md:block">
            <table className="w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Vehicle ID</th>
                  <th className="px-4 py-3 text-left font-semibold">Make & Model</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Movement</th>
                  <th className="px-4 py-3 text-left font-semibold">OdoMeter</th>
                  <th className="px-4 py-3 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {crud.isResolved && !crud.canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td colSpan={6} className="px-4 py-6 text-center text-[var(--fms-text-subheading)]">
                      You do not have permission to view this data.
                    </td>
                  </tr>
                ) : (
                filteredVehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="border-t border-[var(--fms-strokes)]">
                    <td className="px-4 py-3">{vehicle.id}</td>
                    <td className="px-4 py-3">{vehicle.makeModel}</td>
                    <td className="px-4 py-3">
                      <span className={vehicle.status === 'Active' ? 'rounded-full bg-[#d7f8e8] px-2 py-1 text-xs text-[#0f8e5c]' : 'rounded-full bg-[#fff4cc] px-2 py-1 text-xs text-[#9f7b00]'}>
                        {vehicle.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={vehicle.movement === 'On Trip' ? 'rounded-full bg-[#dbeafe] px-2 py-1 text-xs text-[#1d4ed8]' : 'rounded-full bg-[#eceff3] px-2 py-1 text-xs text-[#64748b]'}>
                        {vehicle.movement}
                      </span>
                    </td>
                    <td className="px-4 py-3">{vehicle.odometer}</td>
                    <td className="px-4 py-3">
                      <div className={rowActionsContainerClassName}>
                        <DetailRowActionButton type="button" disabled={!crud.canRead} title="Detail" aria-label="View vehicle details" />
                        <EditRowActionButton type="button" disabled={!crud.canUpdate} title="Edit" aria-label="Edit vehicle" />
                        <DeleteRowActionButton type="button" disabled={!crud.canDelete} onClick={() => askDelete(vehicle.id)} />
                      </div>
                    </td>
                  </tr>
                ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={confirmDelete}
        title="Delete Vehicle"
        description="Are you sure you want to delete this vehicle? This action cannot be undone."
      />
    </section>
  )
}
