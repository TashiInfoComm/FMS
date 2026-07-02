import { Star } from 'lucide-react'
import { useMemo } from 'react'

import { Label } from '@/components/ui/label'
import {
  feedbackRatingToStars,
  formatFeedbackVehicle,
  getFeedbackRatingLabel,
} from '@/features/trips/lib/trip-driver-feedback-mock-data'
import {
  filterTripFeedbackByPickup,
  type TripFeedbackItem,
} from '@/features/trips/lib/trips-api'
import { cn } from '@/lib/utils'

function FeedbackStars({ value, size = 'md' }: { value: number; size?: 'md' | 'sm' }) {
  const starClass = size === 'md' ? 'h-6 w-6' : 'h-4 w-4'
  return (
    <div className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
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
  )
}

function getFeedbackLegTitle(leg: number, pickupRequired?: boolean): string | null {
  if (pickupRequired !== true) return null
  if (leg === 1) return 'Drop Off Rating'
  if (leg === 2) return 'Pickup Rating'
  return null
}

type TripFeedbackSectionsProps = {
  items: TripFeedbackItem[]
  pickupRequired?: boolean
  starSize?: 'md' | 'sm'
  layout?: 'auto' | 'horizontal' | 'vertical'
  className?: string
}

export function TripFeedbackSections({
  items,
  pickupRequired,
  starSize = 'md',
  layout = 'auto',
  className,
}: TripFeedbackSectionsProps) {
  const visibleItems = useMemo(
    () => filterTripFeedbackByPickup(items, pickupRequired),
    [items, pickupRequired],
  )
  const resolvedLayout =
    layout === 'auto' ? (visibleItems.length > 1 ? 'horizontal' : 'vertical') : layout

  if (visibleItems.length === 0) {
    return (
      <p className={cn('text-sm text-[var(--fms-text-subheading)]', className)}>
        No feedback found.
      </p>
    )
  }

  return (
    <div
      className={cn(
        resolvedLayout === 'horizontal'
          ? 'flex gap-4 overflow-x-auto pb-1'
          : 'space-y-4',
        className,
      )}
    >
      {visibleItems.map((item) => {
        const ratingStars = feedbackRatingToStars(item.rating)
        const vehicleLabel = formatFeedbackVehicle(item.vehiclePlate, item.vehicleModel)
        const legTitle = getFeedbackLegTitle(item.leg, pickupRequired)

        return (
          <div
            key={item.id ?? `leg-${item.leg}`}
            className={cn(
              'space-y-4 rounded-lg border border-[var(--fms-strokes)] bg-[#f6f6f7] p-4',
              resolvedLayout === 'horizontal' && 'min-w-[260px] flex-1 shrink-0',
            )}
          >
            {legTitle ? (
              <p className="text-sm font-bold text-[var(--fms-text-header)]">{legTitle}</p>
            ) : null}

            {vehicleLabel !== '—' ? (
              <div className="space-y-2">
                <Label>Vehicle</Label>
                <div className="rounded-lg border border-[var(--fms-strokes)] bg-[#f8f8f9] px-3 py-2.5 text-sm text-[var(--fms-text-header)]">
                  {vehicleLabel}
                </div>
              </div>
            ) : null}

            {item.driverName?.trim() ? (
              <div className="space-y-2">
                <Label>Driver</Label>
                <div className="rounded-lg border border-[var(--fms-strokes)] bg-[#f8f8f9] px-3 py-2.5 text-sm text-[var(--fms-text-header)]">
                  {item.driverName}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Rating</Label>
              <FeedbackStars value={ratingStars} size={starSize} />
              <p className="text-sm text-[var(--fms-text-header)]">
                <span className="font-medium">{ratingStars} / 5 stars</span>
                <span className="text-[var(--fms-text-subheading)]"> · </span>
                <span>{getFeedbackRatingLabel(item.rating)}</span>
              </p>
            </div>

            <div className="space-y-2">
              <Label>Remarks</Label>
              <div className="min-h-[72px] rounded-lg border border-[var(--fms-strokes)] bg-[#f8f8f9] px-3 py-2.5 text-sm text-[var(--fms-text-header)]">
                {item.reasonForRating.trim() || '—'}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
