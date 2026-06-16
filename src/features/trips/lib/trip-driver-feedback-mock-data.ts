export type DriverFeedbackStatus = 'Pending' | 'Completed'

export type TripFeedbackRating = 'POOR' | 'FAIR' | 'GOOD' | 'VERY_GOOD' | 'EXCELLENT'

export const TRIP_FEEDBACK_RATINGS: TripFeedbackRating[] = [
  'POOR',
  'FAIR',
  'GOOD',
  'VERY_GOOD',
  'EXCELLENT',
]

export type DriverFeedbackListItem = {
  id: string
  tripId: string
  tripType: string
  date: string
  origin: string
  destination: string
  vehiclePlate: string
  vehicleModel: string
  driverName: string
  driverId?: string
  vehicleId?: string
  tripStatus: string
  feedbackStatus: DriverFeedbackStatus
}

export type DriverFeedbackTrip = DriverFeedbackListItem & {
  driverInitials: string
  driverRole: string
  driverContact: string
  driverOverallRating: number
  driverCompletedTrips: number
  driverRecommendation: string
  submittedRating?: number
  submittedComments?: string
  submittedRatingCode?: TripFeedbackRating
}

export function formatFeedbackRoute(origin: string, destination: string): string {
  return `${origin} → ${destination}`
}

export function formatFeedbackVehicle(plate: string, model: string): string {
  if (plate !== '—' && model !== '—') return `${plate} - ${model}`
  return plate !== '—' ? plate : model !== '—' ? model : '—'
}

export function getRatingLabel(rating: number): string {
  const labels = ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent']
  const index = Math.min(5, Math.max(1, Math.round(rating))) - 1
  return labels[index] ?? '—'
}

export function starsToFeedbackRating(stars: number): TripFeedbackRating {
  const index = Math.min(5, Math.max(1, Math.round(stars))) - 1
  return TRIP_FEEDBACK_RATINGS[index] ?? 'GOOD'
}

export function feedbackRatingToStars(rating: string): number {
  const normalized = rating.trim().toUpperCase().replace(/[\s-]+/g, '_')
  const index = TRIP_FEEDBACK_RATINGS.indexOf(normalized as TripFeedbackRating)
  return index >= 0 ? index + 1 : 0
}

export function getFeedbackRatingLabel(rating: string): string {
  return getRatingLabel(feedbackRatingToStars(rating))
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '—'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}
