export type TripRequestPriority = 'Normal' | 'High' | 'Low'

export type TripRequestStatus = string

export type TripSuggestedVehicle = {
  plateNumber: string
  make: string
  model: string
  fuelEfficiency: string
  color: string
}

export type TripSuggestedDriver = {
  name: string
  rating: number
  contact: string
  licenseNumber?: string
}

export function formatSuggestedVehicleMakeModel(vehicle: TripSuggestedVehicle): string {
  const parts = [vehicle.make, vehicle.model].filter((part) => part && part !== '—')
  if (parts.length > 0) return parts.join(' ')
  return '—'
}

export type TripAccompanyingOfficial = {
  employeeCid: string
  fullName: string
}

export type TripRequestListItem = {
  id: string
  requestId: string
  applicantName: string
  applicantDepartment: string
  tripType: string
  origin: string
  destination: string
  route: string
  dateOfJourney: string
  timeOfJourney: string
  suggestedVehicle: TripSuggestedVehicle
  suggestedDriver: TripSuggestedDriver
  priority: TripRequestPriority
  status: TripRequestStatus
  statusCode: string
  hasFeedback: boolean
}

export function formatTripRoute(origin: string, destination: string): string {
  const from = origin.trim()
  const to = destination.trim()
  if (from && from !== '—' && to && to !== '—') return `${from} -> ${to}`
  if (from && from !== '—') return from
  if (to && to !== '—') return to
  return '—'
}

export function formatTripDateTime(date: string, time: string): string {
  const datePart = date.trim()
  const timePart = time.trim()
  if ((!datePart || datePart === '—') && (!timePart || timePart === '—')) return '—'
  if (!datePart || datePart === '—') return timePart
  if (!timePart || timePart === '—') return datePart
  return `${datePart}, ${timePart}`
}

export type TripRequestsSummary = {
  pendingReview: number
  autoApproved: number
  completedToday: number
  inProgress: number
  mtoRequired: number
  byStatus: Record<string, number>
}

export function formatTripSummaryStatusLabel(status: string): string {
  return status
    .trim()
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function computeTripRequestSummary(rows: TripRequestListItem[]): TripRequestsSummary {
  const byStatus: Record<string, number> = {}
  for (const row of rows) {
    const code = row.statusCode.trim().toUpperCase() || row.status.trim().toUpperCase()
    if (!code || code === '—') continue
    byStatus[code] = (byStatus[code] ?? 0) + 1
  }

  return {
    pendingReview: byStatus.PLANNED ?? byStatus.DRAFT ?? 0,
    autoApproved: 0,
    completedToday: byStatus.COMPLETED ?? 0,
    inProgress: (byStatus.IN_PROGRESS ?? 0) + (byStatus.STARTED ?? 0),
    mtoRequired: 0,
    byStatus,
  }
}
