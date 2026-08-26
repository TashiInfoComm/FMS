import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckSquare, Clock3 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  declineEmergencyVehicleType,
  fetchEmergencyAvailableVehicles,
  fetchEmergencyIncidentById,
  deployEmergencyIncident,
  formatEmergencyResponseDeadline,
} from '@/features/emergency-vehicle/lib/emergency-incidents-api'
import { cn } from '@/lib/utils'
import { BackToListButton } from '@/shared/components/BackToListButton'
import { ListPanelMessage } from '@/shared/components/MobileListCard'
import { DetailFieldBoxSkeleton } from '@/shared/components/detail-loading'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-[var(--fms-text-subheading)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--fms-text-header)]">{value || '—'}</p>
    </div>
  )
}

function VehicleDeployment() {
  const { incidentId = '' } = useParams<{ incidentId: string }>()
  const resolvedId = decodeURIComponent(incidentId).trim()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [selectedVehicleTypeId, setSelectedVehicleTypeId] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState('')
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false)
  const [declineNotes, setDeclineNotes] = useState('')

  const detailQuery = useQuery({
    queryKey: ['emergency', 'incidents', 'detail', resolvedId],
    queryFn: () => fetchEmergencyIncidentById(resolvedId),
    enabled: resolvedId.length > 0,
    staleTime: 30_000,
    refetchInterval: 30_000,
  })

  const detail = detailQuery.data
  const vehicleTypes = detail?.vehicleTypes ?? []
  const selectedVehicleType = vehicleTypes.find((type) => type.id === selectedVehicleTypeId)
  const selectedVehicleTypeName =
    selectedVehicleType?.name || selectedVehicleType?.code || 'vehicle type'

  useEffect(() => {
    if (!detail) return
    const firstTypeId = detail.vehicleTypes[0]?.id ?? detail.vehicleTypeIds[0] ?? ''
    setSelectedVehicleTypeId((current) => {
      if (current && detail.vehicleTypes.some((type) => type.id === current)) {
        return current
      }
      if (current && detail.vehicleTypeIds.includes(current)) return current
      return firstTypeId
    })
  }, [detail])

  useEffect(() => {
    setSelectedIds(new Set())
  }, [selectedVehicleTypeId])

  const vehiclesQuery = useQuery({
    queryKey: ['emergency', 'deploy', 'vehicles', selectedVehicleTypeId],
    queryFn: () => fetchEmergencyAvailableVehicles(selectedVehicleTypeId),
    enabled: selectedVehicleTypeId.trim().length > 0,
    staleTime: 30_000,
  })

  const vehicles = vehiclesQuery.data ?? []
  const deadline = formatEmergencyResponseDeadline(
    detail?.initiatedAt ?? '',
    detail?.timeoutMinutes ?? null,
  )

  const selectedCount = selectedIds.size
  const allSelected = vehicles.length > 0 && selectedCount === vehicles.length

  const deployMutation = useMutation({
    mutationFn: () =>
      deployEmergencyIncident(resolvedId, {
        vehicle_ids: [...selectedIds],
        vehicle_type_id: selectedVehicleTypeId,
        notes: notes.trim(),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['emergency', 'incidents'] })
      showSuccessToast('Vehicles deployed successfully')
      navigate('/emergency/request')
    },
    onError: (error) => {
      showErrorToast(error, 'Could not deploy vehicles')
    },
  })

  const declineVehicleTypeMutation = useMutation({
    mutationFn: (responseNotes: string) =>
      declineEmergencyVehicleType(resolvedId, selectedVehicleTypeId, responseNotes),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['emergency', 'incidents'] })
      showSuccessToast(`${selectedVehicleTypeName} request declined`)
      setDeclineDialogOpen(false)
      setDeclineNotes('')
      navigate('/emergency/request')
    },
    onError: (error) => {
      showErrorToast(error, 'Could not decline vehicle type request')
    },
  })

  const toggleVehicle = (vehicleId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(vehicleId)) next.delete(vehicleId)
      else next.add(vehicleId)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
      return
    }
    setSelectedIds(new Set(vehicles.map((vehicle) => vehicle.id)))
  }

  const confirmDeploy = () => {
    if (selectedIds.size === 0) {
      showErrorToast('Select at least one vehicle to deploy.')
      return
    }
    if (!selectedVehicleTypeId.trim()) {
      showErrorToast('Select a vehicle type.')
      return
    }
    deployMutation.mutate()
  }

  const openDeclineDialog = () => {
    if (!selectedVehicleTypeId.trim()) {
      showErrorToast('Select a vehicle type.')
      return
    }
    setDeclineNotes('')
    setDeclineDialogOpen(true)
  }

  const closeDeclineDialog = () => {
    if (declineVehicleTypeMutation.isPending) return
    setDeclineDialogOpen(false)
    setDeclineNotes('')
  }

  const confirmDeclineVehicleType = () => {
    if (!selectedVehicleTypeId.trim()) {
      showErrorToast('Select a vehicle type.')
      return
    }
    const responseNotes = declineNotes.trim()
    if (!responseNotes) {
      showErrorToast('Response notes are required.')
      return
    }
    declineVehicleTypeMutation.mutate(responseNotes)
  }

  const isLoading = detailQuery.isLoading
  const hasError = detailQuery.isError || (!detailQuery.isLoading && !detail)
  const isMutating = deployMutation.isPending || declineVehicleTypeMutation.isPending

  return (
    <section className="space-y-5">
      <BackToListButton to="/emergency/request" />

      <Card className="min-w-0 overflow-visible rounded-xl border border-[var(--fms-strokes)] bg-white p-3 sm:p-5">
        <CardContent className="min-w-0 space-y-5 p-0">
          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <DetailFieldBoxSkeleton key={index} label="Loading" />
              ))}
            </div>
          ) : hasError ? (
            <ListPanelMessage>
              {detailQuery.isError
                ? 'Failed to load emergency incident details.'
                : 'Emergency incident not found.'}
            </ListPanelMessage>
          ) : detail ? (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <h1 className="text-xl font-semibold text-[var(--fms-text-header)] sm:text-2xl">
                  Emergency Response Form
                </h1>
                <div className="inline-flex items-center gap-2 self-start rounded-full border border-[#fdba74] bg-[#fff7ed] px-3 py-1.5 text-sm font-medium text-[#c2410c]">
                  <Clock3 className="h-4 w-4" aria-hidden />
                  Deadline in {deadline.value}
                </div>
              </div>

              <div className="grid gap-4 rounded-xl border border-[var(--fms-strokes)] bg-[#fafafa] p-4 sm:grid-cols-2">
                <SummaryItem label="Emergency Location" value={detail.location} />
                <SummaryItem
                  label="Vehicle Type Required"
                  value={detail.vehicleCategory}
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-[var(--fms-text-header)]">
                  Incident Description
                </p>
                <div className="min-h-20 rounded-lg border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm text-[var(--fms-text-header)]">
                  {detail.description || '—'}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-[var(--fms-text-header)]">
                  Deployment notes
                </p>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Deploying units for backup"
                  rows={3}
                  className="min-h-20 w-full rounded-lg border border-[var(--fms-strokes)] bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>

              <div className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-xs font-semibold tracking-wide text-[var(--fms-text-subheading)] uppercase">
                    Available Vehicles
                  </h2>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-medium text-[#c2410c]">
                      {selectedCount} vehicle{selectedCount === 1 ? '' : 's'} selected
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      disabled={vehicles.length === 0}
                      onClick={toggleSelectAll}
                    >
                      {allSelected ? 'Clear all' : 'Select all'}
                    </Button>
                  </div>
                </div>

                <div className="max-w-sm space-y-2">
                  <Label
                    htmlFor="emergency-deploy-vehicle-type"
                    className="text-sm font-medium text-[var(--fms-text-header)]"
                  >
                    Filter by vehicle type
                  </Label>
                  {vehicleTypes.length === 0 ? (
                    <p className="text-sm text-[var(--fms-text-subheading)]">
                      No vehicle types available for this incident.
                    </p>
                  ) : (
                    <Select
                      value={selectedVehicleTypeId}
                      onValueChange={setSelectedVehicleTypeId}
                    >
                      <SelectTrigger
                        id="emergency-deploy-vehicle-type"
                        className="h-9 w-full bg-white"
                      >
                        <SelectValue placeholder="Select vehicle type" />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicleTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name || type.code || type.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {!selectedVehicleTypeId ? (
                  <ListPanelMessage>Select a vehicle type to load available vehicles.</ListPanelMessage>
                ) : vehiclesQuery.isLoading ? (
                  <ListPanelMessage>Loading available vehicles…</ListPanelMessage>
                ) : vehiclesQuery.isError ? (
                  <ListPanelMessage>Failed to load available vehicles.</ListPanelMessage>
                ) : vehicles.length === 0 ? (
                  <ListPanelMessage>No available vehicles found for this type.</ListPanelMessage>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-[var(--fms-strokes)]">
                    <table className="w-max min-w-full text-sm">
                      <thead className="bg-[#f6f6f7] text-[var(--fms-text-subheading)]">
                        <tr>
                          <th className="px-3 py-3 text-left">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-[var(--fms-button)]"
                              checked={allSelected}
                              onChange={toggleSelectAll}
                              aria-label="Select all vehicles"
                            />
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
                            Vehicle No.
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
                            Make / Model
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
                            Category
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
                            Vehicle Type
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
                            Movement Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {vehicles.map((vehicle) => {
                          const checked = selectedIds.has(vehicle.id)
                          return (
                            <tr
                              key={vehicle.id}
                              className={cn(
                                'border-t border-[var(--fms-strokes)] hover:bg-[#fafafa]',
                                checked && 'bg-[#f8fafc]',
                              )}
                            >
                              <td className="px-3 py-3">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 accent-[var(--fms-button)]"
                                  checked={checked}
                                  onChange={() => toggleVehicle(vehicle.id)}
                                  aria-label={`Select ${vehicle.registrationNumber}`}
                                />
                              </td>
                              <td className="px-4 py-3 font-medium text-[var(--fms-text-header)]">
                                {vehicle.registrationNumber}
                              </td>
                              <td className="px-4 py-3 text-[var(--fms-text-header)]">
                                {vehicle.makeModel}
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex rounded-full bg-[#f0f0f2] px-2.5 py-1 text-xs font-medium text-[var(--fms-text-header)]">
                                  {vehicle.category}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-[var(--fms-text-header)]">
                                {vehicle.vehicleTypeName}
                              </td>
                              <td className="px-4 py-3 text-[var(--fms-text-header)]">
                                {vehicle.status}
                              </td>
                              <td className="px-4 py-3 text-[var(--fms-text-header)]">
                                {vehicle.movementStatus}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-[var(--fms-strokes)] pt-4 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="border-[var(--fms-delete)] text-[var(--fms-delete)] hover:bg-[var(--fms-error-fill)]"
                  disabled={isMutating || !selectedVehicleTypeId || selectedIds.size !== 0}
                  onClick={openDeclineDialog}
                >
                  Decline {selectedVehicleTypeName} vehicle type request
                </Button>
                <Button
                  type="button"
                  className="bg-[var(--fms-button)] text-white hover:bg-[var(--fms-button-hover)]"
                  disabled={isMutating || selectedIds.size === 0}
                  onClick={confirmDeploy}
                >
                  <CheckSquare className="mr-1 h-4 w-4" />
                  {deployMutation.isPending ? 'Deploying…' : 'Confirm Deployment'}
                </Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={declineDialogOpen}
        onOpenChange={(open) => !open && closeDeclineDialog()}
      >
        <DialogContent className="max-w-md">
          <DialogHeader className="items-center text-center">
            <div className="mb-2 rounded-full bg-[var(--fms-error-fill)] p-2.5">
              <AlertTriangle className="h-5 w-5 text-[var(--fms-delete)]" />
            </div>
            <DialogTitle>Decline {selectedVehicleTypeName} Request</DialogTitle>
            <DialogDescription>
              Decline the {selectedVehicleTypeName} request for this emergency? This notifies
              that your agency cannot provide this vehicle type.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="emergency-decline-vehicle-type-notes">
              Response notes <span className="text-[var(--fms-delete)]">*</span>
            </Label>
            <textarea
              id="emergency-decline-vehicle-type-notes"
              value={declineNotes}
              onChange={(event) => setDeclineNotes(event.target.value)}
              placeholder="No vehicle of this type is available right now"
              rows={4}
              className="min-h-[96px] w-full rounded-lg border border-[var(--fms-strokes)] bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <DialogFooter className="justify-center gap-2 sm:justify-center">
            <Button
              type="button"
              variant="outline"
              disabled={declineVehicleTypeMutation.isPending}
              onClick={closeDeclineDialog}
            >
              Close
            </Button>
            <Button
              type="button"
              className="bg-[var(--fms-delete)] text-white hover:bg-[#c70009]"
              disabled={declineVehicleTypeMutation.isPending}
              onClick={confirmDeclineVehicleType}
            >
              {declineVehicleTypeMutation.isPending ? 'Declining…' : 'Confirm Decline'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

export default VehicleDeployment
