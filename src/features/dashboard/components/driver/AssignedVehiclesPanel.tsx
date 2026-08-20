// Every vehicle currently assigned to the signed-in driver, from `/drivers/{id}/vehicles`.
import { CarFront } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DriverAssignedVehicle } from '@/features/dashboard/lib/driver-vehicles-api'

type AssignedVehiclesPanelProps = {
  vehicles: DriverAssignedVehicle[]
  isLoading: boolean
  isError: boolean
  errorMessage: string
}

export function AssignedVehiclesPanel({
  vehicles,
  isLoading,
  isError,
  errorMessage,
}: AssignedVehiclesPanelProps) {
  return (
    <Card className="min-w-0 gap-0 rounded-xl border border-[var(--fms-strokes)] py-0 ring-0">
      <CardHeader className="flex flex-row flex-wrap items-baseline gap-x-2 gap-y-0 px-4 py-2.5">
        <CardTitle className="text-sm font-semibold text-[var(--fms-text-header)]">
          Assigned Vehicles
        </CardTitle>
        {!isLoading && !isError && vehicles.length > 0 ? (
          <span className="text-xs text-[var(--fms-text-subheading)]">
            {vehicles.length === 1 ? '1 vehicle' : `${vehicles.length} vehicles`}
          </span>
        ) : null}
      </CardHeader>

      <CardContent className="px-4 pb-2.5 pt-0">
        {isLoading ? (
          <p className="py-2 text-sm text-[var(--fms-text-subheading)]">
            Loading assigned vehicles…
          </p>
        ) : isError ? (
          <p className="py-2 text-sm text-[var(--fms-error-text)]">{errorMessage}</p>
        ) : vehicles.length === 0 ? (
          <p className="py-2 text-sm text-[var(--fms-text-subheading)]">
            No vehicle is assigned to you yet.
          </p>
        ) : (
          <ul>
            {vehicles.map((vehicle) => (
              <li key={vehicle.id} className="flex items-center gap-2.5 py-1">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--fms-info-fill)]">
                  <CarFront
                    className="h-3.5 w-3.5 text-[var(--fms-info-text)]"
                    aria-hidden="true"
                  />
                </span>

                <p className="min-w-0 truncate text-sm font-semibold text-[var(--fms-text-header)]">
                  {vehicle.plateNumber || vehicle.makeModel || '—'}
                  {vehicle.plateNumber && vehicle.makeModel ? (
                    <span className="font-normal text-[var(--fms-text-subheading)]">
                      {' '}
                      ({vehicle.makeModel})
                    </span>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
