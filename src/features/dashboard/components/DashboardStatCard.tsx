import type { LucideIcon } from 'lucide-react'

import { Card } from '@/components/ui/card'

type DashboardStatCardProps = {
  label: string
  value: string
  icon: LucideIcon
  /** Left edge accent, also tinting the icon. */
  accent: string
  /** Trailing unit or comparison, e.g. `%` or `/ 24`. */
  suffix?: string
}

export function DashboardStatCard({
  label,
  value,
  icon: Icon,
  accent,
  suffix,
}: DashboardStatCardProps) {
  return (
    <Card className="gap-0 rounded-lg border border-[var(--fms-strokes)] py-0 ring-0">
      <div className="flex items-stretch">
        <span
          aria-hidden="true"
          className="w-1 shrink-0 rounded-l-lg"
          style={{ backgroundColor: accent }}
        />
        <div className="min-w-0 flex-1 space-y-1.5 px-3 py-3">
          <div className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: accent }} aria-hidden="true" />
            <p
              className="line-clamp-2 text-xs font-medium leading-snug text-[var(--fms-text-subheading)]"
              title={label}
            >
              {label}
            </p>
          </div>
          <p className="flex items-baseline gap-1">
            <span className="truncate text-2xl font-semibold leading-none text-[var(--fms-text-header)]">
              {value}
            </span>
            {suffix ? (
              <span className="text-xs font-medium text-[var(--fms-text-subheading)]">{suffix}</span>
            ) : null}
          </p>
        </div>
      </div>
    </Card>
  )
}
