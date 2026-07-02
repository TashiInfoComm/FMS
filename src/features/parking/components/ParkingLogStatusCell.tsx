import {
  formatParkingLogStatusLabel,
  type ParkingLogStatus,
} from '@/features/parking/lib/parking-logs-mock-data'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<
  ParkingLogStatus,
  { className: string; variant: 'text' | 'badge' }
> = {
  PENDING_CONSOLIDATION: {
    className: 'text-[#0a72a5]',
    variant: 'text',
  },
  CONSOLIDATED: {
    className: 'rounded-full bg-[#e0f2fe] px-2 py-1 text-[#0369a1]',
    variant: 'badge',
  },
  RETURNED: {
    className: 'rounded-full bg-[#fff4cc] px-2 py-1 text-[#9f7b00]',
    variant: 'badge',
  },
  RESUBMITTED: {
    className: 'rounded-full bg-[#ede9fe] px-2 py-1 text-[#6d28d9]',
    variant: 'badge',
  },
  LINE_APPROVED: {
    className: 'text-[#0f8e5c]',
    variant: 'text',
  },
  WITHDRAWN: {
    className: 'rounded-full bg-[#f3f4f6] px-2 py-1 text-[#6b7280]',
    variant: 'badge',
  },
}

export function ParkingLogStatusCell({ status }: { status: ParkingLogStatus }) {
  const style = STATUS_STYLES[status]
  const label = formatParkingLogStatusLabel(status)

  return (
    <span
      className={cn(
        'text-xs font-semibold uppercase tracking-wide',
        style?.className,
      )}
    >
      {label}
    </span>
  )
}
