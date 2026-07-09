import type { LoanRequisitionStatus } from '@/features/inter-agency-vehicle-loan/lib/loan-requisition-types'
import {
  formatLoanRequisitionStatusLabel,
  loanRequisitionStatusStyles,
} from '@/features/inter-agency-vehicle-loan/lib/loan-requisition-ui'
import { cn } from '@/lib/utils'

export function LoanRequisitionStatusCell({ status }: { status: LoanRequisitionStatus }) {
  const styles = loanRequisitionStatusStyles(status)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-1.5 py-1 text-xs font-medium',
        styles.pill,
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full')} aria-hidden />
      {formatLoanRequisitionStatusLabel(status)}
    </span>
  )
}
