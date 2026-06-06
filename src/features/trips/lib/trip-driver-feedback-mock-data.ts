export type DriverFeedbackStatus = 'Pending' | 'Submitted'

export type DriverFeedbackTrip = {
  id: string
  tripId: string
  date: string
  origin: string
  destination: string
  vehiclePlate: string
  vehicleModel: string
  driverName: string
  driverInitials: string
  driverRole: string
  driverOverallRating: number
  driverCompletedTrips: number
  driverRecommendation: string
  tripStatus: 'Completed'
  feedbackStatus: DriverFeedbackStatus
  submittedRating?: number
  submittedComments?: string
}

const FEEDBACK_SEED: DriverFeedbackTrip[] = [
  {
    id: 'tr-2026-003',
    tripId: 'TR-2026-003',
    date: '27-Apr-2026',
    origin: 'MoF Office',
    destination: 'Bank of Bhutan',
    vehiclePlate: 'BG-1-C9312',
    vehicleModel: 'Toyota Land Cruiser',
    driverName: 'Ugyen Lhamo',
    driverInitials: 'UL',
    driverRole: 'Government Driver',
    driverOverallRating: 4.6,
    driverCompletedTrips: 142,
    driverRecommendation: 'Highly Recommended',
    tripStatus: 'Completed',
    feedbackStatus: 'Submitted',
    submittedRating: 5,
    submittedComments: 'Professional and on time.',
  },
  {
    id: 'tr-2026-005',
    tripId: 'TR-2026-005',
    date: '27-Apr-2026',
    origin: 'MoF Office',
    destination: 'RSTA Office',
    vehiclePlate: 'BG-1-A1234',
    vehicleModel: 'Toyota Hilux',
    driverName: 'Pema Wangdi',
    driverInitials: 'PW',
    driverRole: 'Government Driver',
    driverOverallRating: 4.2,
    driverCompletedTrips: 128,
    driverRecommendation: 'Highly Recommended',
    tripStatus: 'Completed',
    feedbackStatus: 'Submitted',
    submittedRating: 4,
    submittedComments: 'Smooth trip with courteous service.',
  },
  {
    id: 'tr-2026-006',
    tripId: 'TR-2026-006',
    date: '27-Apr-2026',
    origin: 'MoF Office',
    destination: 'Parliament',
    vehiclePlate: 'BG-1-C7000',
    vehicleModel: 'Toyota Coaster',
    driverName: 'Sonam Tshomo',
    driverInitials: 'ST',
    driverRole: 'Government Driver',
    driverOverallRating: 4.4,
    driverCompletedTrips: 96,
    driverRecommendation: 'Highly Recommended',
    tripStatus: 'Completed',
    feedbackStatus: 'Submitted',
    submittedRating: 5,
    submittedComments: 'Excellent coordination throughout the journey.',
  },
  {
    id: 'tr-2026-004',
    tripId: 'TR-2026-004',
    date: '29-Apr-2026',
    origin: 'MoF Office',
    destination: 'RSTA Office',
    vehiclePlate: 'BG-1-A1234',
    vehicleModel: 'Toyota Hilux',
    driverName: 'Pema Wangdi',
    driverInitials: 'PW',
    driverRole: 'Government Driver',
    driverOverallRating: 4.2,
    driverCompletedTrips: 128,
    driverRecommendation: 'Highly Recommended',
    tripStatus: 'Completed',
    feedbackStatus: 'Pending',
  },
]

const feedbackOverrides = new Map<
  string,
  Pick<DriverFeedbackTrip, 'feedbackStatus' | 'submittedRating' | 'submittedComments'>
>()

function normalizeId(id: string): string {
  return id.trim().toLowerCase()
}

function applyOverrides(row: DriverFeedbackTrip): DriverFeedbackTrip {
  const override = feedbackOverrides.get(normalizeId(row.id))
  if (!override) return row
  return { ...row, ...override }
}

export function getDriverFeedbackTrips(): DriverFeedbackTrip[] {
  return FEEDBACK_SEED.map(applyOverrides)
}

export function getDriverFeedbackTripById(tripId: string): DriverFeedbackTrip | undefined {
  const key = normalizeId(tripId)
  return getDriverFeedbackTrips().find(
    (row) => normalizeId(row.id) === key || normalizeId(row.tripId) === key,
  )
}

export function filterDriverFeedbackTrips(
  rows: DriverFeedbackTrip[],
  search: string,
): DriverFeedbackTrip[] {
  const q = search.trim().toLowerCase()
  if (!q) return rows
  return rows.filter((row) => {
    const haystack = [
      row.tripId,
      row.date,
      row.origin,
      row.destination,
      row.vehiclePlate,
      row.vehicleModel,
      row.driverName,
      row.feedbackStatus,
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}

export function formatFeedbackRoute(origin: string, destination: string): string {
  return `${origin} → ${destination}`
}

export function formatFeedbackVehicle(plate: string, model: string): string {
  return `${plate} - ${model}`
}

export function submitDriverFeedback(
  tripId: string,
  rating: number,
  comments: string,
): boolean {
  const row = getDriverFeedbackTripById(tripId)
  if (!row || row.feedbackStatus === 'Submitted') return false
  feedbackOverrides.set(normalizeId(row.id), {
    feedbackStatus: 'Submitted',
    submittedRating: rating,
    submittedComments: comments.trim() || undefined,
  })
  return true
}

export function getRatingLabel(rating: number): string {
  if (rating <= 1) return 'Poor'
  if (rating <= 2) return 'Fair'
  if (rating <= 3) return 'Average'
  if (rating <= 4) return 'Good'
  return 'Excellent'
}
