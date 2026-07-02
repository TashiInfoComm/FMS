import type { ParkingClaimStatus } from '@/features/parking/lib/parking-logs-api'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<ParkingClaimStatus, string> = {
  PENDING_APPROVAL: 'rounded-full bg-[#fef3c7] px-2 py-1 text-[#b45309]',
  APPROVED: 'rounded-full bg-[#e0f2fe] px-2 py-1 text-[#0369a1]',
  PAID: 'rounded-full bg-[#d0fae5] px-2 py-1 text-[#007a55]',
  REJECTED: 'rounded-full bg-[#fde8e8] px-2 py-1 text-[#c53030]',
}

export function formatParkingClaimStatusLabel(status: ParkingClaimStatus): string {
  switch (status) {
    case 'PENDING_APPROVAL':
      return 'Pending approval'
    case 'APPROVED':
      return 'Approved'
    case 'PAID':
      return 'Paid'
    case 'REJECTED':
      return 'Rejected'
    default:
      return status
  }
}

export function ParkingClaimStatusCell({ status }: { status: ParkingClaimStatus }) {
  return (
    <span
      className={cn(
        'inline-flex text-xs font-medium uppercase tracking-wide',
        STATUS_STYLES[status],
      )}
    >
      {formatParkingClaimStatusLabel(status)}
    </span>
  )
}
