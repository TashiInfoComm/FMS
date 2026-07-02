export type ParkingLogStatus =
  | 'PENDING_CONSOLIDATION'
  | 'CONSOLIDATED'
  | 'RETURNED'
  | 'RESUBMITTED'
  | 'LINE_APPROVED'
  | 'WITHDRAWN'

export const PARKING_LOG_STATUSES: ParkingLogStatus[] = [
  'PENDING_CONSOLIDATION',
  'CONSOLIDATED',
  'RETURNED',
  'RESUBMITTED',
  'LINE_APPROVED',
  'WITHDRAWN',
]

export function formatParkingLogStatusLabel(status: ParkingLogStatus): string {
  switch (status) {
    case 'PENDING_CONSOLIDATION':
      return 'Pending Consolidation'
    case 'CONSOLIDATED':
      return 'Consolidated'
    case 'RETURNED':
      return 'Returned'
    case 'RESUBMITTED':
      return 'Resubmitted'
    case 'LINE_APPROVED':
      return 'Line Approved'
    case 'WITHDRAWN':
      return 'Withdrawn'
    default:
      return status
  }
}

export type ParkingLogListRow = {
  id: string
  vehicleId?: string
  vehicleRegistrationNumber?: string
  date: string
  location: string
  amount: number
  receiptFileName: string
  receiptUrl?: string
  receiptImagePath?: string
  status: ParkingLogStatus
  returnedRemarks?: string
}

export function formatParkingLogDate(isoDate: string): string {
  const trimmed = isoDate.trim()
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed)
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    return `${day}/${month}/${year}`
  }

  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return isoDate

  const day = String(parsed.getDate()).padStart(2, '0')
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const year = parsed.getFullYear()
  return `${day}/${month}/${year}`
}

export function getParkingLogAutoDateIso(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}



export function formatParkingAmount(amount: number): string {
  return `Nu. ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
