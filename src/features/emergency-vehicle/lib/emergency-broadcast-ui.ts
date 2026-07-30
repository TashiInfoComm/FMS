import type { EmergencyBroadcastStatus } from '@/features/emergency-vehicle/lib/emergency-broadcast-types'

const STATUS_LABELS: Record<EmergencyBroadcastStatus, string> = {
  broadcasted: 'Broadcasted',
  active: 'Active',
  deployed: 'Deployed',
  closed: 'Closed',
  cancelled: 'Cancelled',
}

const STATUS_STYLES: Record<EmergencyBroadcastStatus, { pill: string }> = {
  broadcasted: {
    pill: 'bg-[#dbeafe] text-[#1d4ed8]',
  },
  active: {
    pill: 'bg-[#dbeafe] text-[#1d4ed8]',
  },
  deployed: {
    pill: 'bg-[#d0fae5] text-[#007a55]',
  },
  closed: {
    pill: 'bg-[#e5e7eb] text-[#374151]',
  },
  cancelled: {
    pill: 'bg-[#fee2e2] text-[#b91c1c]',
  },
}

export function formatEmergencyBroadcastStatusLabel(
  status: EmergencyBroadcastStatus,
  statusLabel?: string,
): string {
  const trimmed = statusLabel?.trim()
  if (trimmed) return trimmed
  return STATUS_LABELS[status]
}

export function emergencyBroadcastStatusStyles(status: EmergencyBroadcastStatus) {
  return STATUS_STYLES[status]
}

/** Reads and trims `VITE_MAP_API_KEY` (spaces around `=` in `.env` are tolerated). */
export function getGoogleMapsApiKey(): string {
  const raw = import.meta.env.VITE_MAP_API_KEY as string | undefined
  return typeof raw === 'string' ? raw.trim() : ''
}
