import { Check } from 'lucide-react'

import type { LoanAuditTimelineDisplayEntry } from '@/features/inter-agency-vehicle-loan/lib/loan-requisition-types'
import {
  formatLoanAuditStepLabel,
  formatLoanDateTime,
} from '@/features/inter-agency-vehicle-loan/lib/loan-requisition-ui'
import { cn } from '@/lib/utils'

export function LoanAuditTimeline({
  entries,
  isLoading,
}: {
  entries: LoanAuditTimelineDisplayEntry[]
  isLoading: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="border-b border-[var(--fms-strokes)] pb-4">
        <p className="text-base font-semibold text-[var(--fms-text-header)]">Audit Timeline</p>
        <p className="text-xs text-[var(--fms-text-subheading)]">Lifecycle of the loan</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--fms-text-subheading)]">Loading timeline…</p>
      ) : (
        <ol className="space-y-0">
          {entries.map((entry, index) => {
            const isLast = index === entries.length - 1
            const label = entry.triggerLabel ?? formatLoanAuditStepLabel(entry.step)
            const connectorCompleted =
              !isLast && entry.completed && entries[index + 1]?.completed

            return (
              <li key={entry.step} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
                      entry.completed
                        ? 'border-[var(--fms-button)] bg-[var(--fms-button)] text-white'
                        : 'border-[#cbd5e1] bg-white',
                    )}
                  >
                    {entry.completed ? (
                      <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-[#cbd5e1]" />
                    )}
                  </span>
                  {!isLast ? (
                    <span
                      className={cn(
                        'my-1 w-0.5 min-h-6 flex-1 rounded-full',
                        connectorCompleted ? 'bg-[var(--fms-button)]' : 'bg-[#e2e8f0]',
                      )}
                    />
                  ) : null}
                </div>
                <div className={cn('min-w-0 pb-5', isLast && 'pb-0')}>
                  <p
                    className={cn(
                      'text-sm font-medium leading-snug',
                      entry.isCurrent
                        ? 'text-[var(--fms-button)]'
                        : entry.completed
                          ? 'text-[var(--fms-text-header)]'
                          : 'text-[#94a3b8]',
                    )}
                  >
                    {label}
                  </p>
                  {entry.date ? (
                    <p className="mt-0.5 text-xs text-[var(--fms-text-subheading)]">
                      {formatLoanDateTime(entry.date)}
                    </p>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
