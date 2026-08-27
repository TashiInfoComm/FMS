// Compact on-chart figure with the exact amount available on hover.
import { cn } from '@/lib/utils'

type ChartCompactValueProps = {
  compact: string
  exact: string
  className?: string
}

export function ChartCompactValue({ compact, exact, className }: ChartCompactValueProps) {
  return (
    <span className={cn('cursor-help', className)} title={exact} aria-label={exact}>
      {compact}
    </span>
  )
}

type DonutCenterLabelProps = {
  compact: string
  exact: string
  caption: string
  compactClassName?: string
  /** Matches the pie `innerRadius` percent so the hole captures hover, not Recharts. */
  holePercent?: number
}

/** Fills the doughnut hole so hovering the total shows the exact amount, not the pie tooltip. */
export function DonutCenterLabel({
  compact,
  exact,
  caption,
  compactClassName,
  holePercent = 62,
}: DonutCenterLabelProps) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div
        className="pointer-events-auto group relative z-10 flex flex-col items-center justify-center rounded-full"
        style={{ width: `${holePercent}%`, height: `${holePercent}%` }}
      >
        <span
          className={cn(
            'font-semibold tabular-nums text-[var(--fms-text-header)]',
            compactClassName,
          )}
        >
          {compact}
        </span>
        <span className="text-center text-[11px] leading-tight text-[var(--fms-text-subheading)]">
          {caption}
        </span>
        <span
          role="tooltip"
          className="pointer-events-none absolute left-1/2 bottom-full z-20 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border/50 bg-background px-2.5 py-1.5 text-xs font-medium tabular-nums text-foreground shadow-xl group-hover:block group-focus-within:block"
        >
          {exact}
        </span>
      </div>
    </div>
  )
}
