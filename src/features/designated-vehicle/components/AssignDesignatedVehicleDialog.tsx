import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  createDesignatedOfficial,
  fetchDesignatedVehicleByVehicleId,
  fetchUsageTypeOptions,
  updateDesignatedOfficial,
} from '@/features/designated-vehicle/lib/designated-vehicle-api'
import type { AssignDesignatedVehicleFormValues } from '@/features/designated-vehicle/lib/designated-vehicle-types'
import { fetchAllDriverVehicleAssignmentsByVehicleId } from '@/features/vehicles/lib/driver-vehicle-assignments-api'
import { fetchVehicles } from '@/features/vehicles/lib/vehicles-api'
import { searchUserDetailByCid } from '@/features/user/lib/users-api'
import { SearchableAutocomplete } from '@/shared/components/SearchableAutocomplete'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

const EMPTY_FORM: AssignDesignatedVehicleFormValues = {
  vehicleId: '',
  driverName: '',
  officialCid: '',
  officialName: '',
  designation: '',
  designationTypeId: '',
  remarks: '',
}

function isPrimaryPriority(priority: string): boolean {
  const numeric = Number.parseInt(String(priority), 10)
  return numeric === 1 || priority.trim().toUpperCase() === 'PRIMARY'
}

function formatDriverDisplayName(name: string, priority: string, hasMultipleDrivers: boolean): string {
  const trimmedName = name.trim()
  if (!trimmedName || trimmedName === '—') return ''
  if (hasMultipleDrivers && isPrimaryPriority(priority)) {
    return `${trimmedName} (Primary)`
  }
  return trimmedName
}

type AssignDesignatedVehicleDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode?: 'create' | 'edit'
  editVehicleId?: string | null
}

export function AssignDesignatedVehicleDialog({
  open,
  onOpenChange,
  mode = 'create',
  editVehicleId = null,
}: AssignDesignatedVehicleDialogProps) {
  const queryClient = useQueryClient()
  const isEdit = mode === 'edit'
  const [form, setForm] = useState<AssignDesignatedVehicleFormValues>(EMPTY_FORM)
  const [cidInput, setCidInput] = useState('')
  const [formInitialized, setFormInitialized] = useState(!isEdit)

  const vehiclesQuery = useQuery({
    queryKey: ['designated-vehicle', 'vehicles-select'],
    queryFn: fetchVehicles,
    enabled: open && !isEdit,
    staleTime: 60_000,
  })

  const editDetailQuery = useQuery({
    queryKey: ['designated-vehicles', 'edit-detail', editVehicleId],
    queryFn: () => fetchDesignatedVehicleByVehicleId(editVehicleId ?? ''),
    enabled: open && isEdit && Boolean(editVehicleId?.trim()),
    staleTime: 30_000,
  })

  const usageTypesQuery = useQuery({
    queryKey: ['designated-vehicle', 'usage-types'],
    queryFn: fetchUsageTypeOptions,
    enabled: open,
    staleTime: 60_000,
  })

  const usageTypeOptions = useMemo(() => {
    const base = usageTypesQuery.data ?? []
    const selectedId = form.designationTypeId.trim()
    if (!selectedId || base.some((option) => option.value === selectedId)) {
      return base
    }

    const selectedLabel =
      editDetailQuery.data?.designationTypeId === selectedId
        ? editDetailQuery.data?.designationTypeName?.trim() ?? ''
        : ''

    return [
      ...base,
      {
        value: selectedId,
        label: selectedLabel || selectedId,
        searchText: [selectedLabel, selectedId].filter(Boolean).join(' '),
      },
    ]
  }, [
    editDetailQuery.data?.designationTypeId,
    editDetailQuery.data?.designationTypeName,
    form.designationTypeId,
    usageTypesQuery.data,
  ])

  const vehicleOptions = useMemo(
    () =>
      (vehiclesQuery.data ?? []).map((vehicle) => ({
        value: vehicle.id,
        label: vehicle.registration_number || vehicle.id,
        description: vehicle.makeModel || undefined,
        searchText: [vehicle.registration_number, vehicle.makeModel, vehicle.id].join(' '),
      })),
    [vehiclesQuery.data],
  )

  const activeVehicleId = isEdit ? editVehicleId?.trim() ?? '' : form.vehicleId.trim()

  const driverQuery = useQuery({
    queryKey: ['designated-vehicle', 'driver-by-vehicle', activeVehicleId],
    queryFn: () => fetchAllDriverVehicleAssignmentsByVehicleId(activeVehicleId),
    enabled: open && Boolean(activeVehicleId),
    staleTime: 30_000,
  })

  const driverDisplayName = useMemo(() => {
    if (!activeVehicleId) return ''
    if (driverQuery.isLoading || driverQuery.isFetching) return ''
    const assignments = driverQuery.data ?? []
    if (assignments.length === 0) return ''
    const primary =
      assignments.find((row) => isPrimaryPriority(row.priority)) ?? assignments[0]
    return formatDriverDisplayName(
      primary.name,
      primary.priority,
      assignments.length > 1,
    )
  }, [activeVehicleId, driverQuery.data, driverQuery.isFetching, driverQuery.isLoading])

  useEffect(() => {
    if (open && isEdit) {
      setFormInitialized(false)
    }
  }, [open, isEdit, editVehicleId])

  useEffect(() => {
    if (!open) return
    if (!isEdit) {
      setForm(EMPTY_FORM)
      setCidInput('')
      setFormInitialized(true)
      return
    }
    if (!editDetailQuery.data || formInitialized) return

    const detail = editDetailQuery.data
    if (!detail) return

    setForm({
      vehicleId: detail.vehicleId,
      driverName: detail.driverName ?? '',
      officialCid: detail.officialCid !== '—' ? detail.officialCid : '',
      officialName: detail.officialName !== '—' ? detail.officialName : '',
      designation: detail.designation !== '—' ? detail.designation : '',
      designationTypeId: detail.designationTypeId ?? '',
      remarks: detail.remarks ?? '',
    })
    setCidInput(detail.officialCid !== '—' ? detail.officialCid : '')
    setFormInitialized(true)
  }, [editDetailQuery.data, formInitialized, isEdit, open])

  const officialSearchMutation = useMutation({
    mutationFn: (cid: string) => searchUserDetailByCid(cid),
    onSuccess: (result) => {
      if (!result) {
        setForm((prev) => ({ ...prev, officialName: '', designation: '' }))
        showErrorToast('No official found for this CID.')
        return
      }
      setForm((prev) => ({
        ...prev,
        officialCid: result.citizenId,
        officialName: result.fullName,
        designation: result.designation,
      }))
    },
    onError: (error) => {
      showErrorToast(error, 'Could not find official by CID')
    },
  })

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setCidInput('')
    setFormInitialized(!isEdit)
    officialSearchMutation.reset()
  }

  const closeDialog = () => {
    onOpenChange(false)
    resetForm()
  }

  const handleSearchOfficial = () => {
    const trimmed = cidInput.trim()
    if (!trimmed) {
      showErrorToast('Enter an official CID before searching.')
      return
    }
    setForm((prev) => ({ ...prev, officialCid: trimmed, officialName: '', designation: '' }))
    officialSearchMutation.mutate(trimmed)
  }

  const saveMutation = useMutation({
    mutationFn: async (values: AssignDesignatedVehicleFormValues) => {
      const vehicleId = values.vehicleId.trim()
      const body = {
        cid: values.officialCid.trim(),
        full_name: values.officialName.trim(),
        designation: values.designation.trim(),
        designation_type_id: values.designationTypeId.trim(),
        remarks: values.remarks.trim(),
      }
      if (isEdit) {
        return updateDesignatedOfficial(vehicleId, body)
      }
      return createDesignatedOfficial(vehicleId, body)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['designated-vehicles'] })
      showSuccessToast(isEdit ? 'Designated vehicle updated.' : 'Vehicle assigned successfully.')
      closeDialog()
    },
    onError: (error) => {
      showErrorToast(error, isEdit ? 'Failed to update designated vehicle' : 'Failed to assign vehicle')
    },
  })

  const handleSubmit = () => {
    const vehicleId = isEdit ? activeVehicleId : form.vehicleId.trim()
    if (!vehicleId) {
      showErrorToast('Please select a vehicle.')
      return
    }
    if (!isEdit && !driverDisplayName.trim()) {
      showErrorToast('No driver is assigned to the selected vehicle.')
      return
    }
    if (!form.officialCid.trim()) {
      showErrorToast('Official CID is required.')
      return
    }
    if (!form.officialName.trim()) {
      showErrorToast('Official name could not be resolved. Search by CID first.')
      return
    }
    if (!form.designation.trim()) {
      showErrorToast('Official designation could not be resolved. Search by CID first.')
      return
    }
    if (!form.designationTypeId.trim()) {
      showErrorToast('Please select a vehicle designated type.')
      return
    }
    saveMutation.mutate({
      ...form,
      vehicleId,
      driverName: driverDisplayName,
    })
  }

  const isLoadingEdit = isEdit && (editDetailQuery.isLoading || !formInitialized)

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeDialog()}>
      <DialogContent className="w-[min(100%-2rem,56rem)] sm:max-w-[56rem]">
        <DialogHeader className="text-center">
          <DialogTitle>{isEdit ? 'Edit Assigned Vehicle' : 'Assign Vehicle Form'}</DialogTitle>
        </DialogHeader>

        {isLoadingEdit ? (
          <p className="py-8 text-center text-sm text-[var(--fms-text-subheading)]">
            Loading assignment details…
          </p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="designated-vehicle-select">
                Designated Vehicle <span className="text-[var(--fms-delete)]">*</span>
              </Label>
              {isEdit ? (
                <Input
                  id="designated-vehicle-select"
                  value={
                    editDetailQuery.data
                      ? `${editDetailQuery.data.registrationNumber} (${editDetailQuery.data.makeModel})`
                      : form.vehicleId
                  }
                  readOnly
                  className="bg-[#fafafa]"
                />
              ) : (
                <SearchableAutocomplete
                  id="designated-vehicle-select"
                  value={form.vehicleId}
                  onChange={(vehicleId) =>
                    setForm((prev) => ({ ...prev, vehicleId, driverName: '' }))
                  }
                  options={vehicleOptions}
                  loading={vehiclesQuery.isLoading}
                  placeholder="Select Vehicle"
                  searchPlaceholder="Search vehicle…"
                  emptyMessage="No vehicles found."
                  loadingMessage="Loading vehicles…"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="designated-vehicle-driver">
                Driver <span className="text-[var(--fms-delete)]">*</span>
              </Label>
              <Input
                id="designated-vehicle-driver"
                value={driverDisplayName}
                readOnly
                placeholder={
                  driverQuery.isLoading || driverQuery.isFetching
                    ? 'Loading driver…'
                    : activeVehicleId
                      ? 'No driver assigned to this vehicle'
                      : 'Auto populate after selecting vehicle'
                }
                className="bg-[#fafafa]"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="designated-vehicle-cid">
                Official CID No <span className="text-[var(--fms-delete)]">*</span>
              </Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="designated-vehicle-cid"
                  value={cidInput}
                  onChange={(event) => {
                    const value = event.target.value
                    setCidInput(value)
                  setForm((prev) => ({
                    ...prev,
                    officialCid: value,
                    officialName: '',
                    designation: '',
                  }))
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      handleSearchOfficial()
                    }
                  }}
                  placeholder="Enter CID number"
                  className="min-w-0 flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 sm:min-w-[10.5rem]"
                  disabled={officialSearchMutation.isPending}
                  onClick={handleSearchOfficial}
                >
                  <Search className="mr-1.5 h-4 w-4" />
                  {officialSearchMutation.isPending ? 'Searching…' : 'Search Official'}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="designated-vehicle-official-name">
                Official Name <span className="text-[var(--fms-delete)]">*</span>
              </Label>
              <Input
                id="designated-vehicle-official-name"
                value={form.officialName}
                readOnly
                placeholder={
                  officialSearchMutation.isPending
                    ? 'Searching official…'
                    : 'Search official by CID to populate full name'
                }
                className="bg-[#fafafa]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="designated-vehicle-designation">
                Designation <span className="text-[var(--fms-delete)]">*</span>
              </Label>
              <Input
                id="designated-vehicle-designation"
                value={form.designation}
                readOnly
                placeholder={
                  officialSearchMutation.isPending
                    ? 'Searching official…'
                    : 'Search official by CID to populate designation'
                }
                className="bg-[#fafafa]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="designated-vehicle-designation-type">
                Vehicle Designated Type <span className="text-[var(--fms-delete)]">*</span>
              </Label>
              <SearchableAutocomplete
                id="designated-vehicle-designation-type"
                value={form.designationTypeId}
                onChange={(designationTypeId) =>
                  setForm((prev) => ({ ...prev, designationTypeId }))
                }
                options={usageTypeOptions}
                loading={usageTypesQuery.isLoading}
                placeholder="Select vehicle designated type"
                searchPlaceholder="Search vehicle designated type…"
                emptyMessage="No vehicle designated types found."
                loadingMessage="Loading vehicle designated types…"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="designated-vehicle-remarks">Remarks</Label>
              <textarea
                id="designated-vehicle-remarks"
                value={form.remarks}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, remarks: event.target.value }))
                }
                placeholder="Enter remarks (optional)"
                className="min-h-20 w-full rounded-md border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--fms-info-border)]"
              />
            </div>
          </div>
        )}

        <DialogFooter className="justify-center sm:justify-center">
          <Button
            type="button"
            className="min-w-40"
            disabled={saveMutation.isPending || isLoadingEdit}
            onClick={handleSubmit}
          >
            {saveMutation.isPending
              ? isEdit
                ? 'Updating…'
                : 'Assigning…'
              : isEdit
                ? 'Update'
                : 'Assign Vehicle'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
