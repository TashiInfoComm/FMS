/** Master option value + label from trip-type / journey-purpose / vehicle-type APIs. */
export type TripMasterOption = { value: string; label: string }

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

export function formatTripDisplayTime(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return '—'
  if (/^\d{1,2}:\d{2}/.test(trimmed)) return trimmed
  const parsed = new Date(`1970-01-01T${trimmed}`)
  if (Number.isNaN(parsed.getTime())) return trimmed
  return parsed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
