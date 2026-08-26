import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { TripFeedbackSections } from '@/features/trips/components/TripFeedbackSections'
import {
  formatFeedbackRoute,
  getRatingLabel,
  initialsFromName,
  starsToFeedbackRating,
} from '@/features/trips/lib/trip-driver-feedback-mock-data'
import { formatAssignedVehicleDetail } from '@/features/trips/lib/trip-request-mock-data'
import { getTripFeedbackLeg } from '@/features/trips/lib/trip-form-utils'
import {
  fetchDriverRating,
  fetchTripDetail,
  fetchTripFeedback,
  filterTripFeedbackByPickup,
  mapTripDetailToDriverFeedbackTrip,
  submitTripFeedback,
} from '@/features/trips/lib/trips-api'
import { BackToListButton } from '@/shared/components/BackToListButton'
import { PageHeader } from '@/shared/components/PageHeader'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'
import { cn } from '@/lib/utils'

type RateDriverLocationState = {
  hasFeedback?: boolean
  driverName?: string
  feedbackLeg?: number
  pickupRequired?: boolean
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
  const display = value && value !== '—' ? value : '—'
  return (
    <div className={cn('space-y-2', className)}>
      <Label>{label}</Label>
      <div className="rounded-lg border border-[var(--fms-strokes)] bg-[#f8f8f9] px-3 py-2.5 text-sm font-medium text-[var(--fms-text-header)]">
        {display}
      </div>
    </div>
  )
}

function StarRatingInput({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (rating: number) => void
  disabled?: boolean
}) {
  const [hovered, setHovered] = useState(0)
  const active = hovered || value

  return (
    <div className="space-y-2">
      <div
        className="inline-flex items-center gap-1"
        onMouseLeave={() => setHovered(0)}
        role="radiogroup"
        aria-label="Rate your experience from 1 to 5 stars"
      >
        {Array.from({ length: 5 }).map((_, index) => {
          const starValue = index + 1
          const filled = starValue <= active
          return (
            <button
              key={starValue}
              type="button"
              role="radio"
              aria-checked={value === starValue}
              disabled={disabled}
              className={cn(
                'rounded p-0.5 transition-colors',
                disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:scale-105',
              )}
              onMouseEnter={() => !disabled && setHovered(starValue)}
              onClick={() => !disabled && onChange(starValue)}
            >
              <Star
                className={cn(
                  'h-7 w-7',
                  filled ? 'fill-[#facc15] text-[#facc15]' : 'text-[#d1d5db]',
                )}
              />
            </button>
          )
        })}
      </div>
      <p className="text-sm text-[var(--fms-text-header)]">
        {value > 0 ? (
          <>
            <span className="font-medium">{value} / 5 stars</span>
            <span className="text-[var(--fms-text-subheading)]"> · </span>
            <span>{getRatingLabel(value)}</span>
          </>
        ) : (
          <span className="text-[var(--fms-text-subheading)]">
            Select a rating from 1 to 5 stars
          </span>
        )}
      </p>
    </div>
  )
}

export default function RateDriverPage() {
  const { tripId = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const locationState = (location.state as RateDriverLocationState | null) ?? null
  const [rating, setRating] = useState(0)
  const [comments, setComments] = useState('')

  const detailQuery = useQuery({
    queryKey: ['trips', 'detail', tripId],
    queryFn: () => fetchTripDetail(tripId),
    enabled: Boolean(tripId.trim()),
    staleTime: 30_000,
  })

  const listHasFeedback = locationState?.hasFeedback === true
  const detailHasFeedback = detailQuery.data?.hasFeedback === true
  const requestedFeedbackLeg = locationState?.feedbackLeg
  const shouldForceRateMode =
    requestedFeedbackLeg === 1 || requestedFeedbackLeg === 2
  const shouldFetchFeedback =
    !shouldForceRateMode && (listHasFeedback || detailHasFeedback)

  const feedbackQuery = useQuery({
    queryKey: ['trips', 'feedback', tripId],
    queryFn: () => fetchTripFeedback(tripId),
    enabled: Boolean(tripId.trim()) && shouldFetchFeedback && detailQuery.isSuccess,
    staleTime: 30_000,
    retry: false,
  })

  const trip = useMemo(
    () => (detailQuery.data ? mapTripDetailToDriverFeedbackTrip(detailQuery.data) : null),
    [detailQuery.data],
  )

  const driverName =
    detailQuery.data?.assignedDriver.name &&
      detailQuery.data.assignedDriver.name !== '—'
      ? detailQuery.data.assignedDriver.name
      : trip?.driverName && trip.driverName !== '—'
        ? trip.driverName
        : '—'

  const driverInitials = initialsFromName(driverName)
  const displayDriverInitials =
    driverInitials && driverInitials !== '—' ? driverInitials : initialsFromName('Driver')
  const driverId = detailQuery.data?.assignedDriverId?.trim() ?? ''

  const driverRatingQuery = useQuery({
    queryKey: ['trips', 'driver-rating', driverId],
    queryFn: () => fetchDriverRating(driverId),
    enabled: Boolean(driverId) && detailQuery.isSuccess && !shouldFetchFeedback,
    staleTime: 30_000,
    retry: false,
  })

  const driverAverageRating = driverRatingQuery.data?.averageRating ?? 0
  const driverTotalReviews = driverRatingQuery.data?.totalReviews ?? 0

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!trip) throw new Error('Trip not found')
      const status = detailQuery.data?.statusCode || detailQuery.data?.status || trip.tripStatus
      const isPickupTrip = detailQuery.data?.pickupRequired === true
      const leg = requestedFeedbackLeg ?? (isPickupTrip ? getTripFeedbackLeg(status) : 1)
      return submitTripFeedback(
        trip.id,
        starsToFeedbackRating(rating),
        comments.trim(),
        leg,
      )
    },
    onSuccess: async () => {
      showSuccessToast('Driver feedback submitted.')
      await queryClient.invalidateQueries({ queryKey: ['trips', 'driver-feedback'] })
      await queryClient.invalidateQueries({ queryKey: ['trips', 'detail', tripId] })
      await queryClient.invalidateQueries({ queryKey: ['trips', 'feedback', tripId] })
      if (driverId) {
        await queryClient.invalidateQueries({ queryKey: ['trips', 'driver-rating', driverId] })
      }
      navigate('/trip/driver-feedback')
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to submit feedback.')
    },
  })

  const isViewMode = shouldFetchFeedback && feedbackQuery.isSuccess
  const pickupRequired = detailQuery.data?.pickupRequired
  const visibleFeedback = useMemo(
    () => filterTripFeedbackByPickup(feedbackQuery.data ?? [], pickupRequired),
    [feedbackQuery.data, pickupRequired],
  )
  const hasDualLegFeedback = pickupRequired === true && visibleFeedback.length > 1

  if (
    detailQuery.isLoading ||
    (shouldFetchFeedback && feedbackQuery.isLoading)
  ) {
    return (
      <section className="space-y-5">
        <BackToListButton to="/trip/driver-feedback" />
        <PageHeader
          title={shouldFetchFeedback ? 'Driver Feedback' : 'Rate Driver'}
          subtitle={
            shouldFetchFeedback
              ? 'Loading submitted feedback for this trip.'
              : 'Provide feedback for the selected completed trip.'
          }
        />
        <p className="text-sm text-[var(--fms-text-subheading)]">
          {shouldFetchFeedback ? 'Loading feedback…' : 'Loading trip…'}
        </p>
      </section>
    )
  }

  if (detailQuery.isError || !trip) {
    return (
      <section className="space-y-5">
        <BackToListButton to="/trip/driver-feedback" />
        <PageHeader
          title="Rate Driver"
          subtitle="Provide feedback for the selected completed trip."
        />
        <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white">
          <CardContent className="px-4 py-8 text-center text-[var(--fms-text-subheading)]">
            {detailQuery.error instanceof Error
              ? detailQuery.error.message
              : 'Trip not found.'}
          </CardContent>
        </Card>
      </section>
    )
  }

  if (shouldFetchFeedback && feedbackQuery.isError) {
    return (
      <section className="space-y-5">
        <BackToListButton to="/trip/driver-feedback" />
        <PageHeader
          title="Driver Feedback"
          subtitle="Submitted feedback for the selected completed trip."
        />
        <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white">
          <CardContent className="px-4 py-8 text-center text-[var(--fms-text-subheading)]">
            {feedbackQuery.error instanceof Error
              ? feedbackQuery.error.message
              : 'Could not load feedback.'}
          </CardContent>
        </Card>
      </section>
    )
  }

  const routeLabel = formatFeedbackRoute(trip.origin, trip.destination)
  const vehicleLabel = detailQuery.data
    ? formatAssignedVehicleDetail(detailQuery.data.assignedVehicle)
    : '—'
  const driverContact =
    detailQuery.data?.assignedDriver.contact &&
      detailQuery.data.assignedDriver.contact !== '—'
      ? detailQuery.data.assignedDriver.contact
      : trip.driverContact

  const handleSubmit = () => {
    if (isViewMode || submitMutation.isPending) return
    if (rating < 1) {
      showErrorToast('Please select a star rating before submitting.')
      return
    }
    submitMutation.mutate()
  }

  if (isViewMode && visibleFeedback.length > 0) {
    return (
      <section className="space-y-5">
        <BackToListButton to="/trip/driver-feedback" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <PageHeader
            title="Driver Feedback"
            subtitle="Submitted feedback for the selected completed trip."
          />
        </div>

        <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-4 sm:p-6">
          <CardContent className="space-y-6 p-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-transparent bg-[#d0fae5] text-[#007a55] hover:bg-[#d0fae5]">
                Feedback Completed
              </Badge>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FieldReadOnly label="Trip Type" value={trip.tripType} />
              {hasDualLegFeedback ? null : (
                <>
                  <FieldReadOnly label="Driver" value={driverName} />
                  <FieldReadOnly label="Vehicle" value={vehicleLabel} />
                </>
              )}
              <FieldReadOnly label="Route" value={routeLabel} />
            </div>

            <TripFeedbackSections
              items={visibleFeedback}
              pickupRequired={pickupRequired}
              layout={hasDualLegFeedback ? 'horizontal' : 'auto'}
            />
          </CardContent>
        </Card>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <BackToListButton to="/trip/driver-feedback" />
      <PageHeader
        title="Rate Driver"
        subtitle="Provide feedback for the selected completed trip."
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px] lg:items-start">
        <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-4 sm:p-6">
          <CardContent className="space-y-6 p-0">
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldReadOnly label="Trip Type" value={trip.tripType} />
              <FieldReadOnly label="Driver" value={driverName} />
              <FieldReadOnly label="Vehicle" value={vehicleLabel} />
              <FieldReadOnly label="Route" value={routeLabel} />
            </div>

            <div className="space-y-3 rounded-xl border border-[var(--fms-strokes)] bg-[#f6f6f7] p-4 sm:p-5">
              <div>
                <p className="text-sm font-semibold text-[var(--fms-text-header)]">
                  Rate Your Experience
                </p>
                <p className="text-xs text-[var(--fms-text-subheading)]">
                  Average Rating (0-5)
                </p>
              </div>
              <StarRatingInput value={rating} onChange={setRating} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback-comments">Comments</Label>
              <textarea
                id="feedback-comments"
                value={comments}
                onChange={(event) => setComments(event.target.value)}
                placeholder="Share your experience with the driver…"
                className="min-h-[120px] w-full rounded-lg border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              <Button
                type="button"
                className="h-11 min-w-[180px] rounded-full bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)]"
                disabled={submitMutation.isPending}
                onClick={handleSubmit}
              >
                {submitMutation.isPending ? 'Submitting…' : 'Submit Feedback'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full"
                onClick={() => navigate('/trip/driver-feedback')}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white shadow-none">
          <CardContent className="space-y-5 px-4 py-5 sm:px-5">
            <p className="text-base font-semibold text-[var(--fms-text-header)]">
              Driver Summary
            </p>
            <div className="flex flex-col items-center text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[var(--fms-strokes)] bg-[var(--fms-primary,#1d4ed8)] text-2xl font-semibold text-white">
                {displayDriverInitials}
              </div>
              <p className="mt-3 text-lg font-semibold text-[var(--fms-text-header)]">
                {driverName !== '—' ? driverName : 'Driver'}
              </p>
              <p className="text-sm text-[var(--fms-text-subheading)]">{trip.driverRole}</p>
              {driverContact !== '—' ? (
                <p className="mt-1 text-sm text-[var(--fms-text-subheading)]">
                  {driverContact}
                </p>
              ) : null}
            </div>
            <div className="space-y-3 rounded-lg border border-[var(--fms-strokes)] bg-[#f8f8f9] p-4">
              <div className="space-y-1">
                <span className="text-sm text-[var(--fms-text-subheading)]">Overall Rating</span>
                {driverRatingQuery.isLoading ? (
                  <p className="text-sm text-[var(--fms-text-subheading)]">Loading rating…</p>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="inline-flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, index) => {
                          const starValue = index + 1
                          const filled = starValue <= Math.round(driverAverageRating)
                          return (
                            <Star
                              key={starValue}
                              className={cn(
                                'h-4 w-4',
                                filled ? 'fill-[#facc15] text-[#facc15]' : 'text-[#d1d5db]',
                              )}
                            />
                          )
                        })}
                      </div>
                      <span className="text-sm font-semibold text-[var(--fms-text-header)]">
                        {driverAverageRating > 0
                          ? `${Number.isInteger(driverAverageRating) ? driverAverageRating : driverAverageRating.toFixed(1)}/5`
                          : 'Not rated yet'}
                      </span>
                    </div>
                    {driverTotalReviews > 0 ? (
                      <p className="text-xs text-[var(--fms-text-subheading)]">
                        {driverTotalReviews} review{driverTotalReviews === 1 ? '' : 's'}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
