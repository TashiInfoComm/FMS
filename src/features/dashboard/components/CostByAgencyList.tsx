// Ranks agency spend as proportional bars against the highest-spending agency.
import { CHART_SERIES_COLORS } from '@/features/dashboard/components/charts/chart-palette'
import {
  formatNuCompact,
  formatNuExact,
  type DashboardSlice,
} from '@/features/dashboard/lib/dashboard-api'

type CostByAgencyListProps = {
  slices: DashboardSlice[]
}

export function CostByAgencyList({ slices }: CostByAgencyListProps) {
  const highest = slices.reduce((max, slice) => Math.max(max, slice.value), 0)

  return (
    <ul className="space-y-3">
      {slices.map((slice, index) => {
        const share = highest > 0 ? Math.max(4, Math.round((slice.value / highest) * 100)) : 0
        return (
          <li key={`${slice.label}-${index}`} className="grid grid-cols-[minmax(3.5rem,7rem)_1fr_auto] items-center gap-3">
            <span className="truncate text-sm font-medium text-[var(--fms-text-header)]" title={slice.label}>
              {slice.label}
            </span>
            <span
              className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--fms-neutral-fill)]"
              role="img"
              aria-label={`${slice.label}: ${formatNuExact(slice.value)}`}
            >
              <span
                className="block h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${share}%`,
                  backgroundColor: CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length],
                }}
              />
            </span>
            <span className="text-right text-sm font-semibold tabular-nums text-[var(--fms-text-header)]">
              {formatNuCompact(slice.value)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
