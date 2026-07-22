import type { DesignatedVehicleStatus } from '@/features/designated-vehicle/lib/designated-vehicle-types'

const STATUS_LABELS: Record<DesignatedVehicleStatus, string> = {
  ACTIVE: 'Active',
  UNDER_MAINTENANCE: 'Under Maintenance',
  REPLACEMENT: 'Replacement',
}

const STATUS_STYLES: Record<DesignatedVehicleStatus, { pill: string; dot: string }> = {
  ACTIVE: {
    pill: 'bg-[#d0fae5] text-[#007a55]',
    dot: 'bg-[#007a55]',
  },
  UNDER_MAINTENANCE: {
    pill: 'bg-[#ffedd5] text-[#c2410c]',
    dot: 'bg-[#ea580c]',
  },
  REPLACEMENT: {
    pill: 'bg-[#dbeafe] text-[#1d4ed8]',
    dot: 'bg-[#1d4ed8]',
  },
}

export function formatDesignatedVehicleStatusLabel(status: DesignatedVehicleStatus): string {
  return STATUS_LABELS[status]
}

export function designatedVehicleStatusStyles(status: DesignatedVehicleStatus) {
  return STATUS_STYLES[status]
}

export function formatCurrencyNu(amount: number): string {
  return `Nu. ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}
