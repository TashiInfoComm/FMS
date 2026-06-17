import { formatCurrentQuota } from '@/features/fuel/lib/quota-request-mock-data'

export type FuelLogStatus = string

export function formatFuelLogDate(isoDate: string): string {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parsed)
}

export function getFuelLogAutoDateIso(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getFuelLogAutoDateLabel(): string {
  return formatFuelLogDate(getFuelLogAutoDateIso())
}

export function formatFuelLogQuota(used: number, total: number): string {
  return formatCurrentQuota(used, total)
}

export function formatFuelLogCost(amount: number): string {
  return `Nu. ${amount.toLocaleString('en-US')}`
}

export function formatFuelLogLiters(liters: number): string {
  const formatted = Number.isInteger(liters)
    ? String(liters)
    : liters.toLocaleString('en-US', { maximumFractionDigits: 1 })
  return `${formatted} L`
}

export function formatFuelLogOdometer(km: number): string {
  return `${km.toLocaleString('en-US')} Km`
}
