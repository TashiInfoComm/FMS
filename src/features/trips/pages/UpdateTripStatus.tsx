import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Flag, MapPin, Play, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDriverRoute } from '@/features/trips/lib/trip-assignment-mock-data'
import {
  formatAssignedVehicleDetail,
  formatTripDateTime,
} from '@/features/trips/lib/trip-request-mock-data'
import {
  canCompleteTrip,
  canStartTrip,
  isLocalOrPickDropTrip,
  isTripCompleted,
  normalizeTripStatusCode,
} from '@/features/trips/lib/trip-form-utils'
import { TripFeedbackSections } from '@/features/trips/components/TripFeedbackSections'
import {
  completeTrip,
  fetchTripDetail,
  fetchTripFeedback,
  filterTripFeedbackByPickup,
  filterTripFeedbackForCurrentUser,
  startTrip,
} from '@/features/trips/lib/trips-api'
import { apiClient } from '@/services/apiClient'
import { useUserStore } from '@/services/user-store'
import { PageHeader } from '@/shared/components/PageHeader'
import { useAccessControl } from '@/shared/hooks/useAccessControl'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'
import { cn } from '@/lib/utils'

function resolveProfileUserId(user: unknown): string {
  if (!user || typeof user !== 'object' || Array.isArray(user)) return ''
  const profile = user as Record<string, unknown>
  const rawId = profile.id ?? profile.user_id ?? profile.userId ?? profile.uuid
  return typeof rawId === 'string' ? rawId.trim() : ''
}

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

function OdometerDialog({
  open,
  title,
  label,
  value,
  onValueChange,
  onClose,
  onSubmit,
  isSubmitting,
  submitLabel,
}: {
  open: boolean
  title: string
  label: string
  value: string
  onValueChange: (value: string) => void
  onClose: () => void
  onSubmit: () => void
  isSubmitting: boolean
  submitLabel: string
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isSubmitting && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="odometer-input">
            {label} <span className="text-[var(--fms-delete)]">*</span>
          </Label>
          <Input
            id="odometer-input"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            placeholder="Enter odometer reading"
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={isSubmitting} onClick={onSubmit}>
            {isSubmitting ? 'Saving…' : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type UpdateTripStatusLocationState = {
  hasFeedback?: boolean
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Users
  title: string
  subtitle: string
}) {
  return (
    <div className="flex gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e8f0ff] text-[var(--fms-primary)]">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-base font-semibold text-[var(--fms-text-header)]">{title}</p>
        <p className="text-xs text-[var(--fms-text-subheading)]">{subtitle}</p>
      </div>
    </div>
  )
}

export default function UpdateTripStatus() {
  const { tripId = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const locationState = (location.state as UpdateTripStatusLocationState | null) ?? null
  const listHasFeedback = locationState?.hasFeedback === true
  const { role } = useAccessControl()
  const user = useUserStore((state) => state.user)
  const currentUserId = useMemo(() => resolveProfileUserId(user), [user])
  const isDriverRole = role === 'fms-driver'
  const [startDialogOpen, setStartDialogOpen] = useState(false)
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false)
  const [startOdometer, setStartOdometer] = useState('')
  const [endOdometer, setEndOdometer] = useState('')

  const detailQuery = useQuery({
    queryKey: ['trips', 'detail', tripId],
    queryFn: () => fetchTripDetail(tripId),
    enabled: Boolean(tripId.trim()),
    staleTime: 30_000,
  })

  const hasFeedback = detailQuery.data?.hasFeedback === true || listHasFeedback
  const showDriverRatingButton = hasFeedback

  const feedbackQuery = useQuery({
    queryKey: ['trips', 'feedback', tripId],
    queryFn: () => fetchTripFeedback(tripId),
    enabled: feedbackDialogOpen && showDriverRatingButton,
    staleTime: 30_000,
    retry: false,
  })

  const visibleTripFeedback = useMemo(() => {
    const source = feedbackQuery.data ?? []
    const scoped = isDriverRole
      ? filterTripFeedbackForCurrentUser(source, currentUserId)
      : source
    return filterTripFeedbackByPickup(scoped, detailQuery.data?.pickupRequired)
  }, [feedbackQuery.data, isDriverRole, currentUserId, detailQuery.data?.pickupRequired])

  const startMutation = useMutation({
    mutationFn: (odometer: number) => startTrip(tripId, odometer),
    onSuccess: async () => {
      showSuccessToast('Trip started.')
      setStartDialogOpen(false)
      setStartOdometer('')
      await queryClient.invalidateQueries({ queryKey: ['trips', 'detail', tripId] })
      await queryClient.invalidateQueries({ queryKey: ['trips', 'driver-assignments'] })
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to start trip.')
    },
  })

  const completeMutation = useMutation({
    mutationFn: (odometer: number) => completeTrip(tripId, odometer),
    onSuccess: async () => {
      showSuccessToast('Trip completed.')
      setCompleteDialogOpen(false)
      setEndOdometer('')
      await queryClient.invalidateQueries({ queryKey: ['trips', 'detail', tripId] })
      await queryClient.invalidateQueries({ queryKey: ['trips', 'driver-assignments'] })
      navigate('/trip/my-assignments')
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to complete trip.')
    },
  })

  const dropOffMutation = useMutation({
    mutationFn: async () => {
      const trimmed = tripId.trim()
      if (!trimmed) throw new Error('Trip ID is required')
      await apiClient(`/trips/${encodeURIComponent(trimmed)}/drop-off`, {
        method: 'POST',
      })
    },
    onSuccess: async () => {
      showSuccessToast('Drop off recorded.')
      await queryClient.invalidateQueries({ queryKey: ['trips', 'detail', tripId] })
      await queryClient.invalidateQueries({ queryKey: ['trips', 'driver-assignments'] })
      navigate('/trip/my-assignments')
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to record drop off.')
    },
  })

  if (detailQuery.isLoading) {
    return (
      <section className="space-y-5">
        <PageHeader
          title="Update Trip Status"
          subtitle="Update the current trip status for the selected assignment."
        />
        <p className="text-sm text-[var(--fms-text-subheading)]">Loading assignment…</p>
      </section>
    )
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <section className="space-y-5">
        <PageHeader
          title="Update Trip Status"
          subtitle="Update the current trip status for the selected assignment."
        />
        <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white">
          <CardContent className="px-4 py-8 text-center text-[var(--fms-text-subheading)]">
            {detailQuery.error instanceof Error
              ? detailQuery.error.message
              : 'Assignment not found.'}
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

  const trip = detailQuery.data
  const routeLabel = formatDriverRoute(trip.origin, trip.destination)
  const vehicleLabel = formatAssignedVehicleDetail(trip.assignedVehicle)
  const journeyStart = formatTripDateTime(trip.dateOfJourney, trip.timeOfJourney)
  const journeyEnd = formatTripDateTime(trip.dateOfReturn ?? '', trip.timeOfReturn ?? '')
  const canStart = canStartTrip(trip.statusCode)
  const statusCode = normalizeTripStatusCode(trip.statusCode) ?? ''
  const isPickupDropOff = trip.pickupRequired === true && !hasFeedback
  const canEnd =
    canCompleteTrip(trip.statusCode) ||
    (trip.pickupRequired === true && hasFeedback && statusCode === 'DROPPED_OFF')
  const completed = isTripCompleted(trip.statusCode)
  const showPickupRequired = isLocalOrPickDropTrip(trip.tripType)
  const endActionPending = isPickupDropOff
    ? dropOffMutation.isPending
    : completeMutation.isPending

  const startDisabledReason = completed
    ? 'This trip is already completed.'
    : canEnd
      ? 'The trip is already in progress.'
      : !canStart
        ? `Start is available when status is Assigned or Planned (current: ${trip.status}).`
        : null

  const parseOdometer = (value: string): number | null => {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed) || parsed < 0) return null
    return parsed
  }

  const handleStartSubmit = () => {
    const odometer = parseOdometer(startOdometer)
    if (odometer == null) {
      showErrorToast('Enter a valid start odometer reading.')
      return
    }
    startMutation.mutate(odometer)
  }

  const handleCompleteSubmit = () => {
    const odometer = parseOdometer(endOdometer)
    if (odometer == null) {
      showErrorToast('Enter a valid end odometer reading.')
      return
    }
    completeMutation.mutate(odometer)
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Update Trip Status"
          subtitle="Update the current trip status for the selected assignment."
        />
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {showDriverRatingButton ? (
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setFeedbackDialogOpen(true)}
            >
              View the driver rating
            </Button>
          ) : null}
          <Button variant="outline" className="w-full sm:w-auto" asChild>
            <Link to="/trip/my-assignments">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>
      </div>


      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-4 sm:p-6">
        <CardContent className="space-y-6 p-0">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FieldReadOnly label="Trip Type" value={trip.tripType} />
            {showPickupRequired && trip.pickupRequired != null ? (
              <FieldReadOnly
                label="Pickup Required"
                value={trip.pickupRequired ? 'Yes' : 'No'}
              />
            ) : null}
            <FieldReadOnly label="Route" value={routeLabel} />
            <FieldReadOnly label="Vehicle" value={vehicleLabel} />
            <FieldReadOnly label="Journey Start" value={journeyStart} />
            <FieldReadOnly label="Journey End" value={journeyEnd} />
            <FieldReadOnly label="Current Status" value={trip.status} />
            {trip.startOdometer != null ? (
              <FieldReadOnly
                label="Start Odometer"
                value={String(trip.startOdometer)}
              />
            ) : null}
            {trip.endOdometer != null ? (
              <FieldReadOnly label="End Odometer" value={String(trip.endOdometer)} />
            ) : null}
          </div>
          <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white">
            <CardContent className="space-y-4 pt-5">
              <SectionHeader
                icon={Users}
                title="Accompanying Officials"
                subtitle="Employees travelling with the applicant on this trip."
              />
              {trip.accompanyingOfficials.length === 0 ? (
                <p className="text-sm text-[var(--fms-text-subheading)]">
                  No accompanying officials on this request.
                </p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-[var(--fms-strokes)]">
                  <table className="w-full text-sm">
                    <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                      <tr>
                        <th className="w-16 px-4 py-3 text-left font-semibold">Sl.No</th>
                        <th className="px-4 py-3 text-left font-semibold">Employee CID</th>
                        <th className="px-4 py-3 text-left font-semibold">Full Name</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trip.accompanyingOfficials.map((official, index) => (
                        <tr
                          key={`${official.employeeCid}-${index}`}
                          className="border-t border-[var(--fms-strokes)]"
                        >
                          <td className="px-4 py-3 tabular-nums text-[var(--fms-text-subheading)]">
                            {index + 1}
                          </td>
                          <td className="px-4 py-3">{official.employeeCid}</td>
                          <td className="px-4 py-3">{official.fullName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

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
                Vehicle: {vehicleLabel}
              </p>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div
                className={cn(
                  'rounded-xl border-2 p-4 transition-colors',
                  canStart
                    ? 'border-[var(--fms-primary)] bg-[#eef4ff] shadow-sm'
                    : 'border-[var(--fms-strokes)] bg-white',
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
                      canStart
                        ? 'bg-[var(--fms-success-border)] text-white shadow-md'
                        : 'bg-[#e8e8ea] text-[var(--fms-text-subheading)]',
                    )}
                  >
                    <Play className={cn('h-5 w-5', canStart && 'ml-0.5 fill-current')} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      <p className="font-semibold text-[var(--fms-text-header)]">Start Trip</p>
                      <p className="mt-0.5 text-xs text-[var(--fms-text-subheading)]">
                        {canStart
                          ? 'Record your starting odometer reading to begin this assignment.'
                          : startDisabledReason}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="lg"
                      variant={canStart ? 'default' : 'outline'}
                      className={cn(
                        'h-11 w-full font-semibold',
                        canStart
                          ? 'border-[var(--fms-success-border)] bg-[var(--fms-success-border)] text-white shadow-md'
                          : 'border-[var(--fms-strokes)] bg-white text-[var(--fms-text-subheading)]',
                      )}
                      disabled={!canStart || startMutation.isPending}
                      onClick={() => setStartDialogOpen(true)}
                    >
                      <Play className="mr-2 h-4 w-4 fill-current" />
                      {startMutation.isPending ? 'Starting…' : 'Start Trip Now'}
                    </Button>
                  </div>
                </div>
              </div>

              <div
                className={cn(
                  'rounded-xl border-2 p-4 transition-colors',
                  canEnd
                    ? 'border-[#22c55e] bg-[#f0fdf4] shadow-sm'
                    : 'border-[var(--fms-strokes)] bg-white',
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
                      canEnd
                        ? 'bg-[#16a34a] text-white shadow-md'
                        : 'bg-[#e8e8ea] text-[var(--fms-text-subheading)]',
                    )}
                  >
                    <Flag className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      <p className="font-semibold text-[var(--fms-text-header)]">
                        {isPickupDropOff ? 'Drop Off' : 'End Trip'}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--fms-text-subheading)]">
                        {canEnd
                          ? isPickupDropOff
                            ? 'Confirm drop off to complete this pickup assignment.'
                            : trip.pickupRequired === true && hasFeedback
                              ? 'Record your ending odometer reading to complete this pickup assignment.'
                              : 'Record your ending odometer reading to complete this assignment.'
                          : completed
                            ? 'This trip has already been completed.'
                            : isPickupDropOff
                              ? 'Drop off is available after the trip has been started.'
                              : trip.pickupRequired === true && hasFeedback
                                ? 'End trip is available after drop off and passenger feedback.'
                                : 'End is available after the trip has been started.'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="lg"
                      variant={canEnd ? 'default' : 'outline'}
                      className={cn(
                        'h-11 w-full font-semibold',
                        canEnd
                          ? 'border-[#16a34a] bg-[#16a34a] text-white shadow-md hover:bg-[#15803d]'
                          : 'border-[var(--fms-strokes)] bg-white text-[var(--fms-text-subheading)]',
                      )}
                      disabled={!canEnd || endActionPending}
                      onClick={() =>
                        isPickupDropOff
                          ? dropOffMutation.mutate()
                          : setCompleteDialogOpen(true)
                      }
                    >
                      {isPickupDropOff ? (
                        <MapPin className="mr-2 h-4 w-4" />
                      ) : (
                        <Flag className="mr-2 h-4 w-4" />
                      )}
                      {endActionPending
                        ? isPickupDropOff
                          ? 'Dropping off…'
                          : 'Completing…'
                        : isPickupDropOff
                          ? 'Drop Off'
                          : 'End Trip Now'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {completed ? (
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



      <OdometerDialog
        open={startDialogOpen}
        title="Start Trip"
        label="Start Odometer"
        value={startOdometer}
        onValueChange={setStartOdometer}
        onClose={() => {
          setStartDialogOpen(false)
          setStartOdometer('')
        }}
        onSubmit={handleStartSubmit}
        isSubmitting={startMutation.isPending}
        submitLabel="Start Trip"
      />

      <OdometerDialog
        open={completeDialogOpen}
        title="End Trip"
        label="End Odometer"
        value={endOdometer}
        onValueChange={setEndOdometer}
        onClose={() => {
          setCompleteDialogOpen(false)
          setEndOdometer('')
        }}
        onSubmit={handleCompleteSubmit}
        isSubmitting={completeMutation.isPending}
        submitLabel="End Trip"
      />

      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent
          className={cn(
            visibleTripFeedback.length > 1
              ? 'w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)]'
              : 'max-w-md sm:max-w-md',
          )}
        >
          <DialogHeader>
            <DialogTitle>Driver Rating</DialogTitle>
            <DialogDescription>
              Feedback submitted for trip {trip.requestId}.
            </DialogDescription>
          </DialogHeader>
          {feedbackQuery.isLoading ? (
            <p className="text-sm text-[var(--fms-text-subheading)]">Loading feedback…</p>
          ) : feedbackQuery.isError ? (
            <p className="text-sm text-[var(--fms-text-subheading)]">
              {feedbackQuery.error instanceof Error
                ? feedbackQuery.error.message
                : 'Could not load driver rating.'}
            </p>
          ) : visibleTripFeedback.length > 0 ? (
            <TripFeedbackSections
              items={visibleTripFeedback}
              pickupRequired={trip.pickupRequired}
              layout={visibleTripFeedback.length > 1 ? 'horizontal' : 'auto'}
            />
          ) : (
            <p className="text-sm text-[var(--fms-text-subheading)]">No feedback found.</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFeedbackDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
