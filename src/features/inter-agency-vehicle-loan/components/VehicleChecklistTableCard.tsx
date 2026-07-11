import { useState } from 'react'

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
import { LoanDetailField } from '@/features/inter-agency-vehicle-loan/components/LoanDetailField'
import type { LoanVehicleChecklist } from '@/features/inter-agency-vehicle-loan/lib/loan-requisition-types'
import {
  formatLoanChecklistStatusLabel,
  formatLoanDateTime,
  formatLoanDispatchFuelLevelLabel,
} from '@/features/inter-agency-vehicle-loan/lib/loan-requisition-ui'
import {
  DetailRowActionButton,
  rowActionsContainerClassName,
} from '@/shared/components/TableRowActionButtons'

export type VehicleChecklistTableRow = {
  vehicleId: string
  registrationNumber: string
  driverName: string
  fuelLevel: string
  odometer: string
  notes: string
  checklist: LoanVehicleChecklist | null
}

type VehicleChecklistDialogState = {
  vehicle: VehicleChecklistTableRow
  checklist: LoanVehicleChecklist
} | null

export function VehicleChecklistTableCard({
  title,
  subtitle,
  timestampLabel,
  timestampValue,
  emptyMessage,
  vehicles,
}: {
  title: string
  subtitle: string
  timestampLabel?: string
  timestampValue?: string
  emptyMessage: string
  vehicles: VehicleChecklistTableRow[]
}) {
  const [checklistDialog, setChecklistDialog] = useState<VehicleChecklistDialogState>(null)

  return (
    <>
      <Card className="border border-[var(--fms-strokes)] bg-white shadow-sm">
        <CardContent className="space-y-4 pt-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-[var(--fms-text-header)]">{title}</p>
              <p className="text-xs text-[var(--fms-text-subheading)]">{subtitle}</p>
            </div>
            {timestampValue ? (
              <p className="text-sm text-[var(--fms-text-subheading)]">
                {timestampLabel}{' '}
                <span className="font-semibold text-[var(--fms-text-header)]">
                  {formatLoanDateTime(timestampValue)}
                </span>
              </p>
            ) : null}
          </div>

          {vehicles.length === 0 ? (
            <p className="text-sm text-[var(--fms-text-subheading)]">{emptyMessage}</p>
          ) : (
            <>
              <div className="hidden w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
                <table className="w-max min-w-full text-sm">
                  <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Registration No.</th>
                      <th className="px-4 py-3 text-left font-semibold">Driver</th>
                      <th className="px-4 py-3 text-left font-semibold">Fuel Level</th>
                      <th className="px-4 py-3 text-left font-semibold">Odometer</th>
                      <th className="px-4 py-3 text-left font-semibold">Notes</th>
                      <th className="px-4 py-3 text-center font-semibold">Checklist</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicles.map((vehicle) => (
                      <tr
                        key={vehicle.vehicleId}
                        className="border-t border-[var(--fms-strokes)]"
                      >
                        <td className="px-4 py-3 font-medium text-[var(--fms-text-header)]">
                          {vehicle.registrationNumber || vehicle.vehicleId}
                        </td>
                        <td className="px-4 py-3 text-[var(--fms-text-header)]">
                          {vehicle.driverName || '—'}
                        </td>
                        <td className="px-4 py-3 text-[var(--fms-text-header)]">
                          {formatLoanDispatchFuelLevelLabel(vehicle.fuelLevel)}
                        </td>
                        <td className="px-4 py-3 text-[var(--fms-text-header)]">
                          {vehicle.odometer || '—'}
                        </td>
                        <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                          {vehicle.notes || '—'}
                        </td>
                        <td className="px-4 py-3">
                          {vehicle.checklist ? (
                            <div className={rowActionsContainerClassName}>
                              <DetailRowActionButton
                                tooltip="View checklist items"
                                onClick={() =>
                                  setChecklistDialog({
                                    vehicle,
                                    checklist: vehicle.checklist!,
                                  })
                                }
                              />
                            </div>
                          ) : (
                            <span className="block text-center text-[var(--fms-text-subheading)]">
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {vehicles.map((vehicle) => (
                  <div
                    key={vehicle.vehicleId}
                    className="space-y-2 rounded-lg border border-[var(--fms-strokes)] p-4"
                  >
                    <LoanDetailField
                      label="Registration No."
                      value={vehicle.registrationNumber || vehicle.vehicleId}
                    />
                    <LoanDetailField label="Driver" value={vehicle.driverName} />
                    <LoanDetailField
                      label="Fuel Level"
                      value={formatLoanDispatchFuelLevelLabel(vehicle.fuelLevel)}
                    />
                    <LoanDetailField label="Odometer" value={vehicle.odometer} />
                    <LoanDetailField label="Notes" value={vehicle.notes} />
                    {vehicle.checklist ? (
                      <div className="flex items-center justify-between gap-3 pt-1">
                        <p className="text-xs font-medium text-[var(--fms-text-subheading)]">
                          Checklist
                        </p>
                        <DetailRowActionButton
                          tooltip="View checklist items"
                          onClick={() =>
                            setChecklistDialog({
                              vehicle,
                              checklist: vehicle.checklist!,
                            })
                          }
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={checklistDialog !== null}
        onOpenChange={(open) => {
          if (!open) setChecklistDialog(null)
        }}
      >
        <DialogContent className="flex max-h-[85vh] w-full max-w-[calc(100%-2rem)] flex-col overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Checklist Items</DialogTitle>
            <DialogDescription>
              {checklistDialog
                ? `${checklistDialog.vehicle.registrationNumber || checklistDialog.vehicle.vehicleId}${
                    checklistDialog.checklist.recordedByName
                      ? ` · Recorded by ${checklistDialog.checklist.recordedByName}`
                      : ''
                  }`
                : ''}
            </DialogDescription>
          </DialogHeader>

          {checklistDialog && checklistDialog.checklist.items.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-[var(--fms-strokes)]">
              <table className="w-full min-w-[28rem] text-sm">
                <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Item</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {checklistDialog.checklist.items.map((item, index) => (
                    <tr
                      key={`${item.item}-${index}`}
                      className="border-t border-[var(--fms-strokes)]"
                    >
                      <td className="px-4 py-3 font-medium text-[var(--fms-text-header)]">
                        {item.item}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">
                        {formatLoanChecklistStatusLabel(item.status)}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {item.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-[var(--fms-text-subheading)]">No checklist items recorded.</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setChecklistDialog(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
