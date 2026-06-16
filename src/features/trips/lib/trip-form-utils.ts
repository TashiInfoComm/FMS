/** Master option value + label from trip-type / journey-purpose / vehicle-type APIs. */
export type TripMasterOption = {
  value: string
  label: string
  category?: string
  code?: string
}

export const TRIP_PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
] as const

export type TripPriority = (typeof TRIP_PRIORITY_OPTIONS)[number]['value']

export function deriveTripTypeCategory(label: string, code?: string): string {
  const hay = `${label} ${code ?? ''}`.toUpperCase()
  if (hay.includes('LONG')) return 'LONG'
  if (hay.includes('PICK') || hay.includes('DROP')) return 'PICK_DROP'
  if (hay.includes('LOCAL')) return 'LOCAL'
  return 'LONG'
}

export function toIsoDatetime(localValue: string): string {
  const trimmed = localValue.trim()
  if (!trimmed) return ''
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return trimmed
  return parsed.toISOString()
}

export function isSameCalendarDay(startLocal: string, endLocal: string): boolean {
  const start = new Date(startLocal.trim())
  const end = new Date(endLocal.trim())
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false
  return (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate()
  )
}

export function calculateTripDurationDays(
  startLocal: string,
  endLocal: string,
): string {
  const start = new Date(startLocal.trim())
  const end = new Date(endLocal.trim())
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return ''
  if (end.getTime() < start.getTime()) return ''
  const msPerDay = 1000 * 60 * 60 * 24
  const days = Math.ceil((end.getTime() - start.getTime()) / msPerDay)
  return String(Math.max(1, days))
}

export function formatTripDurationDisplay(
  startLocal: string,
  endLocal: string,
): string {
  const start = new Date(startLocal.trim())
  const end = new Date(endLocal.trim())
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return ''
  if (end.getTime() < start.getTime()) return ''

  if (isSameCalendarDay(startLocal, endLocal)) {
    const totalMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60))
    if (totalMinutes <= 0) return ''
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    if (hours > 0 && minutes > 0) {
      return `${hours} hr${hours === 1 ? '' : 's'} ${minutes} min`
    }
    if (hours > 0) {
      return `${hours} hr${hours === 1 ? '' : 's'}`
    }
    return `${minutes} min`
  }

  const days = Number.parseInt(calculateTripDurationDays(startLocal, endLocal), 10)
  if (!Number.isFinite(days) || days <= 0) return ''
  return `${days} day${days === 1 ? '' : 's'}`
}

export function resolveTripDurationDisplay(options: {
  journeyStartDatetime?: string
  journeyEndDatetime?: string
  tripDurationDays?: number
}): string {
  const { journeyStartDatetime, journeyEndDatetime, tripDurationDays } = options
  if (journeyStartDatetime?.trim() && journeyEndDatetime?.trim()) {
    const formatted = formatTripDurationDisplay(
      journeyStartDatetime,
      journeyEndDatetime,
    )
    if (formatted) return formatted
  }
  if (tripDurationDays != null && tripDurationDays > 0) {
    return `${tripDurationDays} day${tripDurationDays === 1 ? '' : 's'}`
  }
  return ''
}

export function isLocalOrPickDropTrip(label: string, code?: string): boolean {
  const hay = `${label} ${code ?? ''}`.toLowerCase()
  if (hay.includes('long')) return false
  return (
    hay.includes('local') ||
    hay.includes('pick') ||
    hay.includes('drop')
  )
}

export function isLongTrip(label: string, code?: string): boolean {
  return `${label} ${code ?? ''}`.toLowerCase().includes('long')
}

export function formatTripDisplayDate(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return '—'
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return trimmed
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function resolveTripStatusLabel(
  statusLabel?: string,
  statusCode?: string,
): string {
  if (statusLabel?.trim()) return statusLabel.trim()
  if (statusCode?.trim()) {
    return statusCode
      .trim()
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }
  return '—'
}

export type TripStatusCode =
  | 'DRAFT'
  | 'PLANNED'
  | 'ASSIGNED'
  | 'STARTED'
  | 'IN_PROGRESS'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REJECTED'

const TRIP_STATUS_CODES = new Set<string>([
  'DRAFT',
  'PLANNED',
  'ASSIGNED',
  'STARTED',
  'IN_PROGRESS',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
])

const TRIP_STATUS_ALIASES: Record<string, TripStatusCode> = {
  draft: 'DRAFT',
  planned: 'PLANNED',
  assigned: 'ASSIGNED',
  scheduled: 'ASSIGNED',
  started: 'STARTED',
  in_progress: 'IN_PROGRESS',
  inprogress: 'IN_PROGRESS',
  paused: 'PAUSED',
  completed: 'COMPLETED',
  complete: 'COMPLETED',
  cancelled: 'CANCELLED',
  canceled: 'CANCELLED',
  rejected: 'REJECTED',
}

export function canStartTrip(statusCode: string): boolean {
  const code = normalizeTripStatusCode(statusCode)
  return code === 'ASSIGNED' || code === 'PLANNED'
}

export function canCompleteTrip(statusCode: string): boolean {
  const code = normalizeTripStatusCode(statusCode)
  return code === 'STARTED' || code === 'IN_PROGRESS'
}

export function canCancelTrip(statusCode: string): boolean {
  const code = normalizeTripStatusCode(statusCode)
  return code === 'DRAFT' || code === 'PLANNED' || code === 'ASSIGNED'
}

export function isTripPendingReview(statusCode: string): boolean {
  const code = normalizeTripStatusCode(statusCode)
  return code === 'PLANNED' || code === 'ASSIGNED'
}

export function isTripPlanned(statusCode: string): boolean {
  return normalizeTripStatusCode(statusCode) === 'PLANNED'
}

export function isTripCompleted(statusCode: string): boolean {
  return normalizeTripStatusCode(statusCode) === 'COMPLETED'
}

export function normalizeTripStatusCode(value: string): TripStatusCode | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const underscored = trimmed.toUpperCase().replace(/[\s-]+/g, '_')
  if (TRIP_STATUS_CODES.has(underscored)) {
    return underscored as TripStatusCode
  }

  const aliasKey = trimmed.toLowerCase().replace(/[\s-]+/g, '_')
  return TRIP_STATUS_ALIASES[aliasKey] ?? null
}

export function tripStatusBadgeClass(statusCodeOrLabel: string): string {
  const code = normalizeTripStatusCode(statusCodeOrLabel)

  switch (code) {
    case 'DRAFT':
      return 'border-transparent bg-[#edf2f7] text-[#4a5568] hover:bg-[#edf2f7]'
    case 'PLANNED':
      return 'border-transparent bg-[#e0e7ff] text-[#4338ca] hover:bg-[#e0e7ff]'
    case 'ASSIGNED':
      return 'border-transparent bg-[#e8f0ff] text-[var(--fms-primary)] hover:bg-[#e8f0ff]'
    case 'STARTED':
      return 'border-transparent bg-[#cffafe] text-[#0e7490] hover:bg-[#cffafe]'
    case 'IN_PROGRESS':
      return 'border-transparent bg-[#fef3c7] text-[#b45309] hover:bg-[#fef3c7]'
    case 'PAUSED':
      return 'border-transparent bg-[#fffbeb] text-[#d97706] hover:bg-[#fffbeb]'
    case 'COMPLETED':
      return 'border-transparent bg-[#d0fae5] text-[#007a55] hover:bg-[#d0fae5]'
    case 'CANCELLED':
      return 'border-transparent bg-[#f1f5f9] text-[#64748b] hover:bg-[#f1f5f9]'
    case 'REJECTED':
      return 'border-transparent bg-[#fde8e8] text-[#c53030] hover:bg-[#fde8e8]'
    default:
      return 'border-transparent bg-[#edf2f7] text-[#2d3748] hover:bg-[#edf2f7]'
  }
}

export function formatTripDisplayTime(value: string): string {
  const trimmed = value.trim()
  if (!trimmed || trimmed === '—') return '—'
  if (/am|pm/i.test(trimmed)) return trimmed

  const toTwelveHour = (date: Date) =>
    date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })

  const isoParsed = new Date(trimmed)
  if (!Number.isNaN(isoParsed.getTime()) && trimmed.includes('T')) {
    return toTwelveHour(isoParsed)
  }

  const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?/)
  if (timeMatch) {
    const parsed = new Date(`1970-01-01T${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:00`)
    if (!Number.isNaN(parsed.getTime())) return toTwelveHour(parsed)
  }

  return trimmed
}

export function formatApplicantOrgLine(agency: string, department: string): string {
  const parts = [agency, department].filter((part) => part.trim() && part.trim() !== '—')
  return parts.join(' · ') || '—'
}

export function formatFileSizeLabel(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  const kb = bytes / 1024
  if (kb < 1024) {
    return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`
  }
  const mb = kb / 1024
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`
}
