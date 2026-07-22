import type { DriverOffenceStatus } from '@/features/driver-offence/lib/driver-offence-types'

const STATUS_LABELS: Record<DriverOffenceStatus, string> = {
  UNPAID: 'Unpaid',
  PAID: 'Paid',
}

const STATUS_STYLES: Record<DriverOffenceStatus, { pill: string; dot: string }> = {
  UNPAID: {
    pill: 'bg-[#fde8e8] text-[#c53030]',
    dot: 'bg-[#e53e3e]',
  },
  PAID: {
    pill: 'bg-[#d0fae5] text-[#007a55]',
    dot: 'bg-[#007a55]',
  },
}

export function formatDriverOffenceStatusLabel(status: DriverOffenceStatus): string {
  return STATUS_LABELS[status]
}

export function driverOffenceStatusStyles(status: DriverOffenceStatus) {
  return STATUS_STYLES[status]
}

export function formatOffenceAmount(amount: number): string {
  return `Nu. ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`
}

export function formatOffenceListDate(value: string): string {
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
