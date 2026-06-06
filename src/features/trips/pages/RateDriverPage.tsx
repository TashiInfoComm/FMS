import { ArrowLeft, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  formatFeedbackRoute,
  formatFeedbackVehicle,
  getDriverFeedbackTripById,
  getRatingLabel,
  submitDriverFeedback,
} from '@/features/trips/lib/trip-driver-feedback-mock-data'
import { PageHeader } from '@/shared/components/PageHeader'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'
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
                  filled
                    ? 'fill-[#facc15] text-[#facc15]'
                    : 'text-[#d1d5db]',
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
  const navigate = useNavigate()
  const trip = useMemo(() => getDriverFeedbackTripById(tripId), [tripId])

  const [rating, setRating] = useState(0)
  const [comments, setComments] = useState('')

  const isSubmitted = trip?.feedbackStatus === 'Submitted'
  const displayRating = isSubmitted ? (trip?.submittedRating ?? 0) : rating
  const displayComments = isSubmitted ? (trip?.submittedComments ?? '') : comments

  if (!trip) {
    return (
      <section className="space-y-5">
        <PageHeader
          title="Rate Driver"
          subtitle="Provide feedback for the selected completed trip."
        />
        <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white">
          <CardContent className="px-4 py-8 text-center text-[var(--fms-text-subheading)]">
            Trip not found.
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
    if (isSubmitted) return
    if (rating < 1) {
      showErrorToast('Please select a star rating before submitting.')
      return
    }
    const ok = submitDriverFeedback(trip.tripId, rating, comments)
    if (!ok) {
      showErrorToast('Unable to submit feedback. Please try again.')
      return
    }
    showSuccessToast('Driver feedback submitted.')
    navigate('/trip/driver-feedback')
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
              <FieldReadOnly label="Trip" value={trip.tripId} />
              <FieldReadOnly label="Driver" value={trip.driverName} />
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
              <StarRatingInput
                value={displayRating}
                onChange={setRating}
                disabled={isSubmitted}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback-comments">Comments</Label>
              <textarea
                id="feedback-comments"
                value={displayComments}
                onChange={(event) => setComments(event.target.value)}
                readOnly={isSubmitted}
                placeholder="Share your experience with the driver…"
                className="min-h-[120px] w-full rounded-lg border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:bg-[#f8f8f9]"
              />
            </div>

            {isSubmitted ? (
              <p className="text-sm text-[var(--fms-text-subheading)]">
                Feedback has already been submitted for this trip.
              </p>
            ) : (
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  className="h-11 bg-[var(--fms-primary)] hover:bg-[var(--fms-primary)]/90"
                  onClick={handleSubmit}
                >
                  Submit Feedback
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  onClick={() => navigate('/trip/driver-feedback')}
                >
                  Cancel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-[var(--fms-strokes)] bg-[#f6f6f7] shadow-none">
          <CardContent className="space-y-5 px-4 py-5 sm:px-5">
            <p className="text-base font-semibold text-[var(--fms-text-header)]">
              Driver Summary
            </p>
            <div className="flex flex-col items-center text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--fms-primary)] text-2xl font-semibold text-white">
                {trip.driverInitials}
              </div>
              <p className="mt-3 text-lg font-semibold text-[var(--fms-text-header)]">
                {trip.driverName}
              </p>
              <p className="text-sm text-[var(--fms-text-subheading)]">
                {trip.driverRole}
              </p>
            </div>
            <div className="space-y-3 rounded-lg border border-[var(--fms-strokes)] bg-white p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--fms-text-subheading)]">Overall Rating</span>
                <span className="font-semibold text-[var(--fms-text-header)]">
                  {trip.driverOverallRating}/5
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--fms-text-subheading)]">Completed Trips</span>
                <span className="font-semibold text-[var(--fms-text-header)]">
                  {trip.driverCompletedTrips}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--fms-text-subheading)]">Status</span>
                <Badge className="border-transparent bg-[#d0fae5] text-[#007a55] hover:bg-[#d0fae5]">
                  {trip.driverRecommendation}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
