import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  dispatchLoanVehicles,
  fetchChecklistItemOptions,
  fetchLoanDetail,
} from '@/features/inter-agency-vehicle-loan/lib/loan-requisition-api'
import type { ChecklistItemOption } from '@/features/inter-agency-vehicle-loan/lib/loan-requisition-types'
import {
  LOAN_DISPATCH_CHECKLIST_STATUS_OPTIONS,
  LOAN_DISPATCH_FUEL_LEVEL_OPTIONS,
} from '@/features/inter-agency-vehicle-loan/lib/loan-requisition-ui'
import { SearchableAutocomplete } from '@/shared/components/SearchableAutocomplete'
import { BackToListButton } from '@/shared/components/BackToListButton'
import { PageHeader } from '@/shared/components/PageHeader'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

type ChecklistFormRow = {
  key: string
  item: string
  status: string
  notes: string
}

type VehicleDispatchFormRow = {
  key: string
  vehicleId: string
  fuelLevel: string
  odometer: string
  checklistItems: ChecklistFormRow[]
}

function createRowKey(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function createChecklistRowsFromMaster(items: ChecklistItemOption[]): ChecklistFormRow[] {
  return items.map((item) => ({
    key: item.code || createRowKey('checklist'),
    item: item.name,
    status: 'OK',
    notes: '',
  }))
}

function createEmptyDispatchRow(checklistItems: ChecklistFormRow[] = []): VehicleDispatchFormRow {
  return {
    key: createRowKey('dispatch'),
    vehicleId: '',
    fuelLevel: 'FULL',
    odometer: '',
    checklistItems,
  }
}

function DispatchVehicle() {
  const { loanId } = useParams<{ loanId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const crud = useRouteCrudPermissions('/vehicle-loan/lending')
  const [dispatchRows, setDispatchRows] = useState<VehicleDispatchFormRow[]>([
    createEmptyDispatchRow(),
  ])

  const detailQuery = useQuery({
    queryKey: ['vehicle-loan', 'detail', loanId],
    queryFn: () => fetchLoanDetail(loanId!),
    enabled: Boolean(loanId?.trim()) && (!crud.isResolved || crud.canRead),
    staleTime: 30_000,
  })

  const checklistQuery = useQuery({
    queryKey: ['master', 'item-names', 'dispatch'],
    queryFn: fetchChecklistItemOptions,
    enabled: !crud.isResolved || crud.canCreate || crud.canUpdate,
    staleTime: 60_000,
  })

  const detail = detailQuery.data
  const committedVehicles = useMemo(
    () => detail?.committedVehicles ?? [],
    [detail?.committedVehicles],
  )
  const masterChecklistItems = useMemo(
    () => checklistQuery.data ?? [],
    [checklistQuery.data],
  )

  useEffect(() => {
    if (masterChecklistItems.length === 0) return

    setDispatchRows((prev) => {
      const nextChecklist = createChecklistRowsFromMaster(masterChecklistItems)
      const shouldSeedVehicle =
        Boolean(detail) &&
        committedVehicles.length > 0 &&
        prev.length === 1 &&
        !prev[0].vehicleId

      return prev.map((row, index) => {
        const existingByItem = new Map(
          row.checklistItems
            .filter((item) => item.item.trim())
            .map((item) => [item.item, item] as const),
        )

        return {
          ...row,
          vehicleId:
            shouldSeedVehicle && index === 0
              ? committedVehicles[0].vehicleId
              : row.vehicleId,
          checklistItems: nextChecklist.map((item) => {
            const existing = existingByItem.get(item.item)
            return existing
              ? {
                  ...item,
                  status: existing.status || 'OK',
                  notes: existing.notes,
                }
              : item
          }),
        }
      })
    })
  }, [committedVehicles, detail, masterChecklistItems])

  const vehicleOptions = useMemo(
    () =>
      committedVehicles.map((vehicle) => ({
        value: vehicle.vehicleId,
        label: vehicle.registrationNumber || vehicle.vehicleId,
        description: [vehicle.makeModelDisplay, vehicle.vehicleCategory]
          .filter(Boolean)
          .join(' · '),
        searchText: [
          vehicle.registrationNumber,
          vehicle.makeModelDisplay,
          vehicle.vehicleCategory,
          vehicle.vehicleId,
        ]
          .filter(Boolean)
          .join(' '),
      })),
    [committedVehicles],
  )

  const dispatchMutation = useMutation({
    mutationFn: async () => {
      if (!loanId?.trim()) throw new Error('Missing loan id')

      const vehicle_dispatches = dispatchRows.map((row) => {
        const odometer = Number(row.odometer)
        return {
          vehicle_id: row.vehicleId.trim(),
          fuel_level_at_dispatch: row.fuelLevel.trim(),
          odometer_at_dispatch: odometer,
          checklist_items: row.checklistItems.map((item) => ({
            item: item.item.trim(),
            status: item.status.trim(),
            notes: item.notes.trim() ? item.notes.trim() : null,
          })),
        }
      })

      return dispatchLoanVehicles(loanId, { vehicle_dispatches })
    },
    onSuccess: async () => {
      showSuccessToast('Vehicles dispatched successfully.')
      await queryClient.invalidateQueries({ queryKey: ['vehicle-loan'] })
      navigate(`/vehicle-loan/${loanId}`, {
        state: { backPath: '/vehicle-loan/lending' },
      })
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to dispatch vehicles')
    },
  })

  const selectedVehicleIds = useMemo(
    () => new Set(dispatchRows.map((row) => row.vehicleId).filter(Boolean)),
    [dispatchRows],
  )

  const updateDispatchRow = (key: string, patch: Partial<VehicleDispatchFormRow>) => {
    setDispatchRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    )
  }

  const addDispatchRow = () => {
    if (dispatchRows.length >= committedVehicles.length) {
      showErrorToast('You can only dispatch committed vehicles for this loan.')
      return
    }
    if (masterChecklistItems.length === 0) {
      showErrorToast('Checklist items are still loading. Please wait.')
      return
    }
    setDispatchRows((prev) => [
      ...prev,
      createEmptyDispatchRow(createChecklistRowsFromMaster(masterChecklistItems)),
    ])
  }

  const removeDispatchRow = (key: string) => {
    setDispatchRows((prev) => (prev.length <= 1 ? prev : prev.filter((row) => row.key !== key)))
  }

  const updateChecklistRow = (
    dispatchKey: string,
    checklistKey: string,
    patch: Partial<Pick<ChecklistFormRow, 'status' | 'notes'>>,
  ) => {
    setDispatchRows((prev) =>
      prev.map((row) => {
        if (row.key !== dispatchKey) return row
        return {
          ...row,
          checklistItems: row.checklistItems.map((item) =>
            item.key === checklistKey ? { ...item, ...patch } : item,
          ),
        }
      }),
    )
  }

  const removeChecklistRow = (dispatchKey: string, checklistKey: string) => {
    setDispatchRows((prev) =>
      prev.map((row) => {
        if (row.key !== dispatchKey) return row
        if (row.checklistItems.length <= 1) {
          showErrorToast('At least one checklist item is required.')
          return row
        }
        return {
          ...row,
          checklistItems: row.checklistItems.filter((item) => item.key !== checklistKey),
        }
      }),
    )
  }

  const validateAndSubmit = () => {
    if (!detail) return
    if (committedVehicles.length === 0) {
      showErrorToast('No committed vehicles available to dispatch.')
      return
    }

    for (const [index, row] of dispatchRows.entries()) {
      if (!row.vehicleId.trim()) {
        showErrorToast(`Select a vehicle for dispatch entry ${index + 1}.`)
        return
      }
      if (!committedVehicles.some((vehicle) => vehicle.vehicleId === row.vehicleId)) {
        showErrorToast(`Dispatch entry ${index + 1} must use a committed vehicle.`)
        return
      }
      if (!row.fuelLevel.trim()) {
        showErrorToast(`Select fuel level for dispatch entry ${index + 1}.`)
        return
      }
      const odometer = Number(row.odometer)
      if (!row.odometer.trim() || !Number.isFinite(odometer) || odometer < 0) {
        showErrorToast(`Enter a valid odometer reading for dispatch entry ${index + 1}.`)
        return
      }
      if (row.checklistItems.length === 0) {
        showErrorToast(`Checklist items are required for dispatch entry ${index + 1}.`)
        return
      }
      for (const [itemIndex, item] of row.checklistItems.entries()) {
        if (!item.item.trim()) {
          showErrorToast(
            `Checklist item ${itemIndex + 1} is missing for dispatch entry ${index + 1}.`,
          )
          return
        }
        if (!item.status.trim()) {
          showErrorToast(
            `Select checklist status for ${item.item} in dispatch entry ${index + 1}.`,
          )
          return
        }
      }
    }

    const uniqueVehicleIds = new Set(dispatchRows.map((row) => row.vehicleId))
    if (uniqueVehicleIds.size !== dispatchRows.length) {
      showErrorToast('Each vehicle can only be dispatched once.')
      return
    }

    dispatchMutation.mutate()
  }

  if (crud.isResolved && !crud.canRead) {
    return (
      <section className="space-y-5">
        <PageHeader title="Dispatch Vehicles" subtitle="Vehicle loan dispatch" />
        <p className="text-sm text-[var(--fms-text-subheading)]">
          You do not have permission to dispatch vehicles for this loan.
        </p>
      </section>
    )
  }

  if (detailQuery.isLoading) {
    return (
      <section className="space-y-5">
        <PageHeader title="Dispatch Vehicles" subtitle="Loading loan details…" />
        <div className="h-48 animate-pulse rounded-xl border border-[var(--fms-strokes)] bg-white" />
      </section>
    )
  }

  if (detailQuery.isError || !detail) {
    return (
      <section className="space-y-5">
        <BackToListButton
          to={`/vehicle-loan/${loanId}`}
          state={{ backPath: '/vehicle-loan/lending' }}
        />
        <PageHeader title="Dispatch Vehicles" subtitle="Loan not found" />
        <p className="text-sm text-[var(--fms-text-subheading)]">
          {detailQuery.error instanceof Error
            ? detailQuery.error.message
            : `No requisition matches "${loanId}".`}
        </p>
      </section>
    )
  }

  if (detail.status !== 'VEHICLE_COMMITTED') {
    return (
      <section className="space-y-5">
        <BackToListButton
          to={`/vehicle-loan/${loanId}`}
          state={{ backPath: '/vehicle-loan/lending' }}
        />
        <PageHeader
          title="Dispatch Vehicles"
          subtitle={`${detail.requestId} is not ready for dispatch`}
        />
        <p className="text-sm text-[var(--fms-text-subheading)]">
          Dispatch is only available when the loan status is Vehicle Committed.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <div className="space-y-3">
        <BackToListButton
          to={`/vehicle-loan/${loanId}`}
          state={{ backPath: '/vehicle-loan/lending' }}
        />
        <PageHeader
          title="Dispatch Vehicles"
          subtitle={`Record handover checklist and dispatch for ${detail.requestId}`}
        />
      </div>

      {committedVehicles.length === 0 ? (
        <Card className="border border-[var(--fms-strokes)] bg-white shadow-sm">
          <CardContent className="pt-5">
            <p className="text-sm text-[var(--fms-text-subheading)]">
              No committed vehicles found for this loan.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {dispatchRows.map((row, index) => {
              const availableVehicleOptions = vehicleOptions.filter(
                (option) =>
                  option.value === row.vehicleId || !selectedVehicleIds.has(option.value),
              )

              return (
                <Card
                  key={row.key}
                  className="border border-[var(--fms-strokes)] bg-white shadow-sm"
                >
                  <CardContent className="space-y-4 pt-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-base font-semibold text-[var(--fms-text-header)]">
                        Vehicle Dispatch {index + 1}
                      </p>
                      {dispatchRows.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-[var(--fms-error-text)]"
                          onClick={() => removeDispatchRow(row.key)}
                          disabled={dispatchMutation.isPending}
                        >
                          <Trash2 className="mr-1 h-4 w-4" />
                          Remove
                        </Button>
                      ) : null}
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2 md:col-span-1">
                        <Label>
                          Vehicle <span className="text-[var(--fms-delete)]">*</span>
                        </Label>
                        <SearchableAutocomplete
                          value={row.vehicleId}
                          onChange={(value) => updateDispatchRow(row.key, { vehicleId: value })}
                          options={availableVehicleOptions}
                          placeholder="Select committed vehicle"
                          searchPlaceholder="Search registration, make, model…"
                          emptyMessage="No committed vehicles available"
                          disabled={dispatchMutation.isPending}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>
                          Fuel Level <span className="text-[var(--fms-delete)]">*</span>
                        </Label>
                        <Select
                          value={row.fuelLevel}
                          onValueChange={(value) =>
                            updateDispatchRow(row.key, { fuelLevel: value })
                          }
                          disabled={dispatchMutation.isPending}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select fuel level" />
                          </SelectTrigger>
                          <SelectContent>
                            {LOAN_DISPATCH_FUEL_LEVEL_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`odometer-${row.key}`}>
                          Odometer <span className="text-[var(--fms-delete)]">*</span>
                        </Label>
                        <Input
                          id={`odometer-${row.key}`}
                          type="number"
                          min={0}
                          value={row.odometer}
                          onChange={(event) =>
                            updateDispatchRow(row.key, { odometer: event.target.value })
                          }
                          placeholder="e.g. 45230"
                          disabled={dispatchMutation.isPending}
                        />
                      </div>
                    </div>

                    <div className="space-y-3 border-t border-[var(--fms-strokes)] pt-4">
                      <div>
                        <p className="text-sm font-semibold text-[var(--fms-text-header)]">
                          Checklist Items
                        </p>
                        <p className="text-xs text-[var(--fms-text-subheading)]">
                          Review each master checklist item and record status
                        </p>
                      </div>

                      {checklistQuery.isLoading ? (
                        <p className="text-sm text-[var(--fms-text-subheading)]">
                          Loading checklist items…
                        </p>
                      ) : checklistQuery.isError ? (
                        <p className="text-sm text-[var(--fms-error-text)]">
                          {checklistQuery.error instanceof Error
                            ? checklistQuery.error.message
                            : 'Could not load checklist items.'}
                        </p>
                      ) : row.checklistItems.length === 0 ? (
                        <p className="text-sm text-[var(--fms-text-subheading)]">
                          No checklist items found.
                        </p>
                      ) : (
                        <div className="overflow-x-auto rounded-lg border border-[var(--fms-strokes)]">
                          <table className="min-w-full text-sm">
                            <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                              <tr>
                                <th className="px-4 py-3 text-left font-semibold">Item</th>
                                <th className="px-4 py-3 text-left font-semibold">Status</th>
                                <th className="px-4 py-3 text-left font-semibold">Notes</th>
                                <th className="px-4 py-3 text-right font-semibold">
                                  <span className="sr-only">Actions</span>
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {row.checklistItems.map((item) => (
                                <tr
                                  key={item.key}
                                  className="border-t border-[var(--fms-strokes)]"
                                >
                                  <td className="px-4 py-3 font-medium text-[var(--fms-text-header)]">
                                    {item.item}
                                  </td>
                                  <td className="px-4 py-3">
                                    <Select
                                      value={item.status}
                                      onValueChange={(value) =>
                                        updateChecklistRow(row.key, item.key, { status: value })
                                      }
                                      disabled={dispatchMutation.isPending}
                                    >
                                      <SelectTrigger className="w-full min-w-[140px]">
                                        <SelectValue placeholder="Select status" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {LOAN_DISPATCH_CHECKLIST_STATUS_OPTIONS.map((option) => (
                                          <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </td>
                                  <td className="px-4 py-3">
                                    <Input
                                      value={item.notes}
                                      onChange={(event) =>
                                        updateChecklistRow(row.key, item.key, {
                                          notes: event.target.value,
                                        })
                                      }
                                      placeholder="Optional notes"
                                      disabled={dispatchMutation.isPending}
                                    />
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="text-[var(--fms-error-text)]"
                                      onClick={() => removeChecklistRow(row.key, item.key)}
                                      disabled={
                                        dispatchMutation.isPending ||
                                        row.checklistItems.length <= 1
                                      }
                                      aria-label={`Remove ${item.item}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={addDispatchRow}
              disabled={
                dispatchMutation.isPending || dispatchRows.length >= committedVehicles.length
              }
            >
              <Plus className="mr-1 h-4 w-4" />
              Add vehicle
            </Button>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                asChild
                disabled={dispatchMutation.isPending}
              >
                <Link
                  to={`/vehicle-loan/${loanId}`}
                  state={{ backPath: '/vehicle-loan/lending' }}
                >
                  Cancel
                </Link>
              </Button>
              <Button
                type="button"
                disabled={dispatchMutation.isPending || (!crud.canCreate && !crud.canUpdate)}
                onClick={validateAndSubmit}
              >
                {dispatchMutation.isPending ? 'Dispatching…' : 'Dispatch'}
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

export default DispatchVehicle
