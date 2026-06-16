import { formatCurrentQuota } from '@/features/fuel/lib/quota-request-mock-data'

export type FuelLogStatus = string

export type FuelLogRecord = {
  id: string
  driver: string
  vehicle: string
  quotaUsed: number
  quotaTotal: number
  date: string
  liters: number
  totalCost: number
  location: string
  odometerKm: number
  receiptFileName: string
  status: FuelLogStatus
}

export const FUEL_LOG_AUTO_DRIVER = 'Karma Dorji'
export const FUEL_LOG_AUTO_VEHICLE = 'BG-1-A1234'

export const FUEL_LOG_LOCATION_OPTIONS = [
  'Tashi BOD',
  'Thimphu Depot',
  'Paro Station',
  'Phuentsholing Terminal',
] as const

const SEED_LOGS: Omit<FuelLogRecord, 'id'>[] = [
  {
    driver: 'Karma Dorji',
    vehicle: 'BG-1-A1234',
    quotaUsed: 780,
    quotaTotal: 5000,
    date: '2026-04-13',
    liters: 35,
    totalCost: 2520,
    location: 'Tashi BOD',
    odometerKm: 35000,
    receiptFileName: 'receipt_bg1a1234.jpg',
    status: 'VERIFIED',
  },
  {
    driver: 'Pema Wangdi',
    vehicle: 'BG-2-B4471',
    quotaUsed: 950,
    quotaTotal: 6000,
    date: '2026-04-12',
    liters: 28,
    totalCost: 2016,
    location: 'Thimphu Depot',
    odometerKm: 42100,
    receiptFileName: 'receipt_bg2b4471.jpg',
    status: 'VERIFIED',
  },
  {
    driver: 'Sonam Choden',
    vehicle: 'BG-3-C2190',
    quotaUsed: 1100,
    quotaTotal: 7000,
    date: '2026-04-11',
    liters: 40,
    totalCost: 2880,
    location: 'Paro Station',
    odometerKm: 28750,
    receiptFileName: 'receipt_bg3c2190.png',
    status: 'PENDING',
  },
  {
    driver: 'Tashi Namgay',
    vehicle: 'BG-4-D8820',
    quotaUsed: 3200,
    quotaTotal: 5000,
    date: '2026-04-10',
    liters: 22,
    totalCost: 1584,
    location: 'Tashi BOD',
    odometerKm: 51200,
    receiptFileName: 'receipt_bg4d8820.jpg',
    status: 'VERIFIED',
  },
]

function buildGeneratedLog(index: number): FuelLogRecord {
  const seed = SEED_LOGS[index % SEED_LOGS.length]
  const day = String((index % 28) + 1).padStart(2, '0')
  const month = String((index % 12) + 1).padStart(2, '0')

  return {
    id: `fuel-log-${index + 1}`,
    driver: seed.driver,
    vehicle: `BG-${(index % 9) + 1}-X${1000 + index}`,
    quotaUsed: seed.quotaUsed + (index % 5) * 120,
    quotaTotal: seed.quotaTotal + (index % 3) * 500,
    date: `2026-${month}-${day}`,
    liters: seed.liters + (index % 4) * 2,
    totalCost: seed.totalCost + index * 45,
    location: FUEL_LOG_LOCATION_OPTIONS[index % FUEL_LOG_LOCATION_OPTIONS.length],
    odometerKm: seed.odometerKm + index * 350,
    receiptFileName: `receipt_${index + 1}.jpg`,
    status: index % 6 === 0 ? 'PENDING' : 'VERIFIED',
  }
}

let fuelLogs: FuelLogRecord[] = [
  ...SEED_LOGS.map((row, index) => ({
    ...row,
    id: `fuel-log-${index + 1}`,
  })),
  ...Array.from({ length: 22 }, (_, offset) =>
    buildGeneratedLog(SEED_LOGS.length + offset),
  ),
]

export function getFuelLogs(): FuelLogRecord[] {
  return fuelLogs
}

export function filterFuelLogs(rows: FuelLogRecord[], search: string): FuelLogRecord[] {
  const query = search.trim().toLowerCase()
  if (!query) return rows
  return rows.filter((row) => {
    const dateLabel = formatFuelLogDate(row.date).toLowerCase()
    return (
      row.driver.toLowerCase().includes(query) ||
      row.vehicle.toLowerCase().includes(query) ||
      row.status.toLowerCase().includes(query) ||
      row.id.toLowerCase().includes(query) ||
      row.location.toLowerCase().includes(query) ||
      dateLabel.includes(query) ||
      String(row.liters).includes(query) ||
      String(row.totalCost).includes(query)
    )
  })
}

export function getFuelLogById(id: string): FuelLogRecord | undefined {
  return fuelLogs.find((row) => row.id === id)
}

export type CreateFuelLogInput = {
  driver: string
  vehicle: string
  date: string
  liters: number
  totalCost: number
  location: string
  odometerKm: number
  receiptFileName: string
}

export function createFuelLog(input: CreateFuelLogInput): FuelLogRecord {
  const record: FuelLogRecord = {
    id: `fuel-log-${Date.now()}`,
    driver: input.driver,
    vehicle: input.vehicle,
    quotaUsed: 780,
    quotaTotal: 5000,
    date: input.date,
    liters: input.liters,
    totalCost: input.totalCost,
    location: input.location,
    odometerKm: input.odometerKm,
    receiptFileName: input.receiptFileName,
    status: 'PENDING',
  }
  fuelLogs = [record, ...fuelLogs]
  return record
}

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
