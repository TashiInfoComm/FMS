import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function LoanChecklistPlaceholderCard({
  title,
  recorded,
}: {
  title: string
  recorded: boolean
}) {
  return (
    <Card className="border border-[var(--fms-strokes)] bg-white shadow-sm">
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[var(--fms-text-header)]">{title}</p>
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-medium',
              recorded
                ? 'bg-[#d0fae5] text-[#007a55]'
                : 'bg-[#f1f5f9] text-[#64748b]',
            )}
          >
            {recorded ? 'Recorded' : 'Not Recorded'}
          </span>
        </div>
        <p className="text-sm text-[var(--fms-text-subheading)]">
          {recorded
            ? 'This checklist has been completed.'
            : 'This checklist has not been completed.'}
        </p>
      </CardContent>
    </Card>
  )
}
