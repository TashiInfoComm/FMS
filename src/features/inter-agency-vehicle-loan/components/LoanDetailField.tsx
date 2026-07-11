import { cn } from '@/lib/utils'

export function LoanDetailField({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={cn('min-w-0 space-y-1', className)}>
      <p className="text-xs font-medium text-[var(--fms-text-subheading)]">{label}</p>
      <p className="text-sm font-semibold text-[var(--fms-text-header)]">{value || '—'}</p>
    </div>
  )
}
