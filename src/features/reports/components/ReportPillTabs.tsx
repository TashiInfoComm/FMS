import { cn } from '@/lib/utils'

export type ReportPillTab<T extends string = string> = {
  value: T
  label: string
}

type ReportPillTabsProps<T extends string> = {
  tabs: ReadonlyArray<ReportPillTab<T>>
  value: T
  onValueChange: (value: T) => void
  className?: string
  'aria-label'?: string
}

/**
 * Underline-style report tabs (matches Fuel Reports design: Consumption / Quota).
 */
export function ReportPillTabs<T extends string>({
  tabs,
  value,
  onValueChange,
  className,
  'aria-label': ariaLabel = 'Report sections',
}: ReportPillTabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('flex items-center gap-6 border-b border-[var(--fms-strokes)]', className)}
    >
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(tab.value)}
            className={cn(
              '-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors',
              active
                ? 'border-[var(--fms-button)] text-[var(--fms-button)]'
                : 'border-transparent text-[var(--fms-text-subheading)] hover:text-[var(--fms-text-header)]',
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
