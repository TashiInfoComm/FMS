import { ArrowLeft } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  formatDriverRoute,
  getDriverAssignmentById,
  setDriverAssignmentStatus,
  type DriverTripStatus,
} from '@/features/trips/lib/trip-assignment-mock-data'
import { PageHeader } from '@/shared/components/PageHeader'
import { showSuccessToast } from '@/shared/lib/toast'
import { cn } from '@/lib/utils'

function FieldReadOnly({
  label,
  value,
  className,
}: {
  label: string
  value?: string
  className?: string
}) {
  const display = value && value !== '—' ? value : ''
  return (
    <div className={cn('space-y-2', className)}>
      <Label>{label}</Label>
      <Input
        readOnly
        value={display}
        placeholder="Auto Fetch"
        className="bg-[#f8f8f9] text-[var(--fms-text-header)]"
      />
    </div>
  )
}

export default function UpdateTripStatus() {
  const { tripId = '' } = useParams()
  const navigate = useNavigate()
  const [refreshKey, setRefreshKey] = useState(0)
  const assignment = useMemo(
    () => getDriverAssignmentById(tripId),
    [tripId, refreshKey],
  )

  if (!assignment) {
    return (
      <section className="space-y-5">
        <PageHeader
          title="Update Trip Status"
          subtitle="Update the current trip status for the selected assignment."
        />
        <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white">
          <CardContent className="px-4 py-8 text-center text-[var(--fms-text-subheading)]">
            Assignment not found.
            <div className="mt-4">
              <Button variant="outline" asChild>
                <Link to="/trip/my-assignments">
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Back to My Assignments
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    )
  }

  const currentStatus = assignment.status
  const routeLabel = formatDriverRoute(assignment.origin, assignment.destination)
  const canStart = currentStatus === 'Scheduled'
  const canEnd = currentStatus === 'In Progress'

  const persistStatus = (next: DriverTripStatus) => {
    setDriverAssignmentStatus(assignment.id, next)
    setRefreshKey((key) => key + 1)
  }

  const handleStartTrip = () => {
    if (!canStart) return
    persistStatus('In Progress')
    showSuccessToast('Trip started.')
  }

  const handleEndTrip = () => {
    if (!canEnd) return
    persistStatus('Completed')
    showSuccessToast('Trip ended.')
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Update Trip Status"
          subtitle="Update the current trip status for the selected assignment."
        />
        <Button variant="outline" className="w-full sm:w-auto" asChild>
          <Link to="/trip/my-assignments">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-4 sm:p-6">
        <CardContent className="space-y-6 p-0">
          <div className="grid gap-4 sm:grid-cols-3">
            <FieldReadOnly label="Trip ID" value={assignment.requestId} />
            <FieldReadOnly label="Route" value={routeLabel} />
            <FieldReadOnly label="Vehicle" value={assignment.vehiclePlate} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldReadOnly label="Scheduled Time" value={assignment.scheduledTime} />
            <FieldReadOnly label="Current Status" value={currentStatus} />
          </div>

          <div className="rounded-xl border border-[var(--fms-strokes)] bg-[#f6f6f7] p-4 sm:p-5">
            <p className="text-sm font-semibold text-[var(--fms-text-header)]">
              Status Action
            </p>

            <div className="mt-4 rounded-lg border border-[var(--fms-strokes)] bg-white p-4">
              <p className="font-semibold text-[var(--fms-text-header)]">
                Current Assignment
              </p>
              <p className="mt-1 text-sm text-[var(--fms-text-header)]">{routeLabel}</p>
              <p className="mt-1 text-xs text-[var(--fms-text-subheading)]">
                Vehicle: {assignment.vehiclePlate}
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                className="h-11 bg-[var(--fms-primary)] hover:bg-[var(--fms-primary)]/90"
                disabled={!canStart}
                onClick={handleStartTrip}
              >
                Start Trip
              </Button>
              <Button
                type="button"
                className="h-11 border-transparent bg-[#86efac] text-[#14532d] hover:bg-[#4ade80]"
                disabled={!canEnd}
                onClick={handleEndTrip}
              >
                End Trip
              </Button>
            </div>

            {currentStatus === 'Completed' ? (
              <p className="mt-3 text-center text-xs text-[var(--fms-text-subheading)]">
                This trip is completed.{' '}
                <button
                  type="button"
                  className="font-medium text-[var(--fms-primary)] underline-offset-2 hover:underline"
                  onClick={() => navigate('/trip/my-assignments')}
                >
                  Return to assignments
                </button>
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
