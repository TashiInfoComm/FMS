import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  formatFeedbackRoute,
  formatFeedbackVehicle,
  feedbackRatingToStars,
  getFeedbackRatingLabel,
  getRatingLabel,
  initialsFromName,
  starsToFeedbackRating,
} from '@/features/trips/lib/trip-driver-feedback-mock-data'
import {
  fetchTripDetail,
  fetchTripFeedback,
  mapTripDetailToDriverFeedbackTrip,
  submitTripFeedback,
} from '@/features/trips/lib/trips-api'
import { fetchTripRequisitionMasterLists } from '@/features/trips/lib/trip-requisition-masters'
import { PageHeader } from '@/shared/components/PageHeader'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'
import { cn } from '@/lib/utils'

type RateDriverLocationState = {
  hasFeedback?: boolean
  driverName?: string
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

function StarRatingDisplay({
  value,
  size = 'lg',
  showLabel = true,
}: {
  value: number
  size?: 'lg' | 'sm'
  showLabel?: boolean
}) {
  const starClass = size === 'lg' ? 'h-7 w-7' : 'h-4 w-4'
  return (
    <div className="space-y-2">
      <div className="inline-flex items-center gap-1" aria-label={`${value} out of 5 stars`}>
        {Array.from({ length: 5 }).map((_, index) => {
          const starValue = index + 1
          const filled = starValue <= value
          return (
            <Star
              key={starValue}
              className={cn(
                starClass,
                filled ? 'fill-[#facc15] text-[#facc15]' : 'text-[#d1d5db]',
              )}
            />
          )
        })}
      </div>
      {showLabel && value > 0 ? (
        <p className="text-sm text-[var(--fms-text-header)]">
          <span className="font-medium">{value} / 5 stars</span>
          <span className="text-[var(--fms-text-subheading)]"> · </span>
          <span>{getRatingLabel(value)}</span>
        </p>
      ) : null}
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

  const mastersQuery = useQuery({
    queryKey: ['trips', 'masters'],
    queryFn: fetchTripRequisitionMasterLists,
    staleTime: 5 * 60_000,
  })

  const detailQuery = useQuery({
    queryKey: ['trips', 'detail', tripId, mastersQuery.dataUpdatedAt],
    queryFn: () =>
      fetchTripDetail(tripId, {
        tripTypes: mastersQuery.data?.tripTypes,
        purposes: mastersQuery.data?.journeyPurposes,
        vehicleTypes: mastersQuery.data?.vehicleTypes,
      }),
    enabled:
      Boolean(tripId.trim()) && (mastersQuery.isSuccess || mastersQuery.isError),
    staleTime: 30_000,
  })

  const listHasFeedback = locationState?.hasFeedback === true
  const detailHasFeedback = detailQuery.data?.hasFeedback === true
  const shouldFetchFeedback = listHasFeedback || detailHasFeedback

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
    trip?.driverName && trip.driverName !== '—'
      ? trip.driverName
      : locationState?.driverName && locationState.driverName !== '—'
        ? locationState.driverName
        : '—'

  const driverInitials = initialsFromName(driverName)

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!trip) throw new Error('Trip not found')
      return submitTripFeedback(trip.id, starsToFeedbackRating(rating), comments.trim())
    },
    onSuccess: async () => {
      showSuccessToast('Driver feedback submitted.')
      await queryClient.invalidateQueries({ queryKey: ['trips', 'driver-feedback'] })
      await queryClient.invalidateQueries({ queryKey: ['trips', 'detail', tripId] })
      await queryClient.invalidateQueries({ queryKey: ['trips', 'feedback', tripId] })
      navigate('/trip/driver-feedback')
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to submit feedback.')
    },
  })

  const isViewMode = shouldFetchFeedback && feedbackQuery.isSuccess
  const submittedFeedback = feedbackQuery.data
  const submittedRating = submittedFeedback
    ? feedbackRatingToStars(submittedFeedback.rating)
    : 0
  const submittedComments = submittedFeedback?.reasonForRating ?? ''

  if (
    detailQuery.isLoading ||
    mastersQuery.isLoading ||
    (shouldFetchFeedback && feedbackQuery.isLoading)
  ) {
    return (
      <section className="space-y-5">
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
        <PageHeader
          title="Rate Driver"
          subtitle="Provide feedback for the selected completed trip."
        />
        <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white">
          <CardContent className="px-4 py-8 text-center text-[var(--fms-text-subheading)]">
            {detailQuery.error instanceof Error
              ? detailQuery.error.message
              : 'Trip not found.'}
            <div className="mt-4">
              <Button variant="outline" asChild>
                <Link to="/trip/driver-feedback">
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Back to Driver Feedback
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    )
  }

  if (shouldFetchFeedback && feedbackQuery.isError) {
    return (
      <section className="space-y-5">
        <PageHeader
          title="Driver Feedback"
          subtitle="Submitted feedback for the selected completed trip."
        />
        <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white">
          <CardContent className="px-4 py-8 text-center text-[var(--fms-text-subheading)]">
            {feedbackQuery.error instanceof Error
              ? feedbackQuery.error.message
              : 'Could not load feedback.'}
            <div className="mt-4">
              <Button variant="outline" asChild>
                <Link to="/trip/driver-feedback">
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Back to Driver Feedback
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    )
  }

  const routeLabel = formatFeedbackRoute(trip.origin, trip.destination)
  const vehicleLabel = formatFeedbackVehicle(trip.vehiclePlate, trip.vehicleModel)

  const handleSubmit = () => {
    if (isViewMode || submitMutation.isPending) return
    if (rating < 1) {
      showErrorToast('Please select a star rating before submitting.')
      return
    }
    submitMutation.mutate()
  }

  if (isViewMode && submittedFeedback) {
    return (
      <section className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <PageHeader
            title="Driver Feedback"
            subtitle="Submitted feedback for the selected completed trip."
          />
          <Button variant="outline" className="w-full sm:w-auto" asChild>
            <Link to="/trip/driver-feedback">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_320px] lg:items-start">
          <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-4 sm:p-6">
            <CardContent className="space-y-6 p-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-transparent bg-[#d0fae5] text-[#007a55] hover:bg-[#d0fae5]">
                  Feedback Completed
                </Badge>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FieldReadOnly label="Trip Type" value={trip.tripType} />
                <FieldReadOnly label="Driver" value={driverName} />
                <FieldReadOnly label="Vehicle" value={vehicleLabel} />
                <FieldReadOnly label="Route" value={routeLabel} />
              </div>

              <div className="space-y-3 rounded-xl border border-[var(--fms-strokes)] bg-[#f6f6f7] p-4 sm:p-5">
                <div>
                  <p className="text-sm font-semibold text-[var(--fms-text-header)]">Your Rating</p>
                  <p className="text-xs text-[var(--fms-text-subheading)]">
                    {getFeedbackRatingLabel(submittedFeedback.rating)}
                  </p>
                </div>
                <StarRatingDisplay value={submittedRating} />
              </div>

              <FieldReadOnly
                label="Comments"
                value={submittedComments || '—'}
                className="w-full"
              />
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white shadow-none">
            <CardContent className="space-y-5 px-4 py-5 sm:px-5">
              <p className="text-base font-semibold text-[var(--fms-text-header)]">
                Driver Summary
              </p>
              <div className="flex flex-col items-center text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--fms-primary)] text-2xl font-semibold text-white">
                  {driverInitials !== '—' ? driverInitials : 'DR'}
                </div>
                <p className="mt-3 text-lg font-semibold text-[var(--fms-text-header)]">
                  {driverName !== '—' ? driverName : 'Driver'}
                </p>
                <p className="text-sm text-[var(--fms-text-subheading)]">{trip.driverRole}</p>
                {trip.driverContact !== '—' ? (
                  <p className="mt-1 text-sm text-[var(--fms-text-subheading)]">
                    {trip.driverContact}
                  </p>
                ) : null}
              </div>
              <div className="space-y-3 rounded-lg border border-[var(--fms-strokes)] bg-[#f8f8f9] p-4">
                <div className="space-y-1">
                  <span className="text-sm text-[var(--fms-text-subheading)]">
                    Your Trip Rating
                  </span>
                  <div className="flex items-center gap-2">
                    <StarRatingDisplay value={submittedRating} size="sm" showLabel={false} />
                    <span className="text-sm font-semibold text-[var(--fms-text-header)]">
                      {submittedRating}/5
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--fms-text-subheading)]">Trip Type</span>
                  <span className="font-medium text-[var(--fms-text-header)]">
                    {trip.tripType}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--fms-text-subheading)]">Trip Status</span>
                  <Badge className="border-transparent bg-[#d0fae5] text-[#007a55] hover:bg-[#d0fae5]">
                    {trip.tripStatus}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Rate Driver"
          subtitle="Provide feedback for the selected completed trip."
        />
        <Button variant="outline" className="w-full sm:w-auto" asChild>
          <Link to="/trip/driver-feedback">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

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
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--fms-primary)] text-2xl font-semibold text-white">
                {driverInitials !== '—' ? driverInitials : 'DR'}
              </div>
              <p className="mt-3 text-lg font-semibold text-[var(--fms-text-header)]">
                {driverName !== '—' ? driverName : 'Driver'}
              </p>
              <p className="text-sm text-[var(--fms-text-subheading)]">{trip.driverRole}</p>
              {trip.driverContact !== '—' ? (
                <p className="mt-1 text-sm text-[var(--fms-text-subheading)]">
                  {trip.driverContact}
                </p>
              ) : null}
            </div>
            <div className="space-y-3 rounded-lg border border-[var(--fms-strokes)] bg-[#f8f8f9] p-4">
              <div className="space-y-1">
                <span className="text-sm text-[var(--fms-text-subheading)]">Overall Rating</span>
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, index) => {
                      const starValue = index + 1
                      const filled = starValue <= Math.round(trip.driverOverallRating)
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
                    {trip.driverOverallRating > 0
                      ? `${trip.driverOverallRating}/5`
                      : 'Not rated yet'}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--fms-text-subheading)]">Trip Type</span>
                <span className="font-medium text-[var(--fms-text-header)]">
                  {trip.tripType}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--fms-text-subheading)]">Trip Status</span>
                <Badge className="border-transparent bg-[#d0fae5] text-[#007a55] hover:bg-[#d0fae5]">
                  {trip.tripStatus}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
