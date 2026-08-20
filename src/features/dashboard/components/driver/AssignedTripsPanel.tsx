// The driver's schedule for today, each row linking through to the trip or work order.
import { Compass } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DashboardTripItem } from '@/features/dashboard/lib/dashboard-api'

/** In-progress work is highlighted; everything else reads as a neutral standing. */
function statusTone(status: string): { dot: string; text: string; background: string } {
  const value = status.toLowerCase()
  if (/trip|progress|ongoing|active|dispatch/.test(value)) {
    return { dot: '#3b82f6', text: '#3b82f6', background: 'rgba(59,130,246,0.13)' }
  }
  return { dot: 'var(--fms-text-subheading)', text: 'var(--fms-text-subheading)', background: 'transparent' }
}

type AssignedTripsPanelProps = {
  trips: DashboardTripItem[]
  isLoading: boolean
  isError: boolean
  errorMessage: string
}

export function AssignedTripsPanel({
  trips,
  isLoading,
  isError,
  errorMessage,
}: AssignedTripsPanelProps) {
  const navigate = useNavigate()

  return (
    <Card className="min-w-0 rounded-xl border border-[var(--fms-strokes)] ring-0">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-[var(--fms-text-header)]">
          Today&apos;s Assigned Trips
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0">
        {isLoading ? (
          <p className="py-4 text-sm text-[var(--fms-text-subheading)]">Loading today&apos;s trips…</p>
        ) : isError ? (
          <p className="py-4 text-sm text-[var(--fms-error-text)]">{errorMessage}</p>
        ) : trips.length === 0 ? (
          <p className="py-4 text-sm text-[var(--fms-text-subheading)]">
            Nothing is scheduled for you today.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--fms-strokes)]">
            {trips.map((trip) => {
              const tone = statusTone(trip.status)
              return (
                <li key={trip.id} className="flex items-center gap-3 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-[var(--fms-info-fill)]">
                    <Compass className="h-4 w-4 text-[var(--fms-info-text)]" aria-hidden="true" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--fms-text-header)]">
                      {trip.title}
                    </p>
                    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                      {trip.description ? (
                        <span className="truncate text-xs text-[var(--fms-text-subheading)]">
                          {trip.description}
                        </span>
                      ) : null}
                      {trip.status ? (
                        <span
                          className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                          style={{ backgroundColor: tone.background, color: tone.text }}
                        >
                          <span
                            aria-hidden="true"
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: tone.dot }}
                          />
                          {trip.status}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {trip.href ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0 rounded-[9px] border-[var(--fms-strokes)] text-xs"
                      onClick={() => navigate(trip.href!)}
                    >
                      View
                    </Button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
