import { AlertTriangle } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DriverOffenceStatusCell } from '@/features/driver-offence/components/DriverOffenceStatusCell'
import type { DriverOffenceDetail } from '@/features/driver-offence/lib/driver-offence-types'
import { formatOffenceAmount } from '@/features/driver-offence/lib/driver-offence-ui'
import { cn } from '@/lib/utils'

type DriverOffenceDetailDialogProps = {
  detail: DriverOffenceDetail | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-b border-[var(--fms-strokes)]/60 py-3">
      <p className="text-xs text-[var(--fms-text-subheading)]">{label}</p>
      <p className="mt-1 text-sm font-medium text-[var(--fms-text-header)]">{value || '—'}</p>
    </div>
  )
}

export function DriverOffenceDetailDialog({
  detail,
  open,
  onOpenChange,
}: DriverOffenceDetailDialogProps) {
  if (!detail) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(100%-2rem,42rem)] sm:max-w-[42rem]">
        <DialogHeader className="space-y-3">
          <div className="flex items-start justify-between gap-3 pr-8">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <AlertTriangle className="h-4 w-4 text-[var(--fms-delete)]" aria-hidden />
              Offense Form
            </DialogTitle>
            <DriverOffenceStatusCell status={detail.status} />
          </div>
        </DialogHeader>

        <div className="grid gap-x-6 md:grid-cols-2">
          <DetailField label="Driver Name" value={detail.driverName} />
          <DetailField label="Employee ID" value={detail.employeeId} />
          <DetailField label="License Number" value={detail.licenseNumber} />
          <DetailField label="Agency" value={detail.agency} />
          <DetailField label="Vehicle Number" value={detail.vehicleNumber} />
          <DetailField label="Vehicle Type" value={detail.vehicleType} />
          <DetailField label="Offence Date & Time" value={detail.offenceDateTime} />
          <DetailField label="Offence Location" value={detail.offenceLocation} />
          <div className="min-w-0 border-b border-[var(--fms-strokes)]/60 py-3 md:col-span-2">
            <p className="text-xs text-[var(--fms-text-subheading)]">Offence Details</p>
            <p className="mt-1 text-sm font-medium text-[var(--fms-text-header)]">
              {detail.offenceDetails || '—'}
            </p>
          </div>
          <DetailField label="Fine / Penalty" value={formatOffenceAmount(detail.fineAmount)} />
          <div className="min-w-0 border-b border-[var(--fms-strokes)]/60 py-3">
            <p className="text-xs text-[var(--fms-text-subheading)]">Status</p>
            <div
              className={cn(
                'mt-2 rounded-md px-3 py-2 text-sm font-medium',
                detail.status === 'UNPAID'
                  ? 'bg-[#fde8e8] text-[#c53030]'
                  : 'bg-[#d0fae5] text-[#007a55]',
              )}
            >
              {detail.status === 'UNPAID' ? 'Unpaid' : 'Paid'}
            </div>
          </div>
          <DetailField label="Source" value={detail.source} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
