// Ranks agency spend as proportional bars against the highest-spending agency.
import { CHART_COLORS, CHART_SERIES_COLORS } from '@/features/dashboard/components/charts/chart-palette'
import { ChartCompactValue } from '@/features/dashboard/components/charts/ChartCompactValue'
import { ChartTooltipRow } from '@/features/dashboard/components/charts/ChartTooltipRow'
import {
  formatNuCompact,
  formatNuExact,
  type DashboardAgencyCostSlice,
} from '@/features/dashboard/lib/dashboard-api'

type CostByAgencyListProps = {
  slices: DashboardAgencyCostSlice[]
}

export function CostByAgencyList({ slices }: CostByAgencyListProps) {
  const highest = slices.reduce((max, slice) => Math.max(max, slice.value), 0)

  return (
    <ul className="space-y-3 overflow-visible">
      {slices.map((slice, index) => {
        const share = highest > 0 ? Math.max(6, Math.round((slice.value / highest) * 100)) : 0
        return (
          <li
            key={`${slice.label}-${index}`}
            className="group relative grid grid-cols-[minmax(12rem,22rem)_minmax(0,1fr)_auto] items-center gap-3"
          >
            <span className="text-sm font-medium leading-snug break-words text-[var(--fms-text-header)]">
              {slice.label}
            </span>
            <span
              className="h-2.5 w-full cursor-help overflow-hidden rounded-full bg-[#eaeef6]"
              role="img"
              aria-label={`${slice.label}: fuel ${formatNuExact(slice.fuel)}, maintenance ${formatNuExact(slice.maintenance)}, parking ${formatNuExact(slice.parking)}, total ${formatNuExact(slice.value)}`}
            >
              <span
                className="block h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${share}%`,
                  backgroundColor: CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length],
                }}
              />
            </span>
            <span className="min-w-[5.5rem] text-right text-sm font-semibold tabular-nums text-[var(--fms-text-header)]">
              <ChartCompactValue compact={formatNuCompact(slice.value)} exact={formatNuExact(slice.value)} />
            </span>

            <div
              role="tooltip"
              className="pointer-events-none invisible absolute left-1/2 bottom-full z-20 mb-1.5 w-56 -translate-x-1/2 rounded-lg border border-border/50 bg-background px-2.5 py-2 text-xs shadow-xl group-hover:visible group-focus-within:visible"
            >
              <p className="mb-1.5 font-medium text-foreground">{slice.label}</p>
              <div className="grid gap-1.5">
                <ChartTooltipRow
                  color={CHART_COLORS.fuel}
                  label="Fuel"
                  value={formatNuExact(slice.fuel)}
                />
                <ChartTooltipRow
                  color={CHART_COLORS.maintenance}
                  label="Maintenance"
                  value={formatNuExact(slice.maintenance)}
                />
                <ChartTooltipRow
                  color={CHART_COLORS.parking}
                  label="Parking"
                  value={formatNuExact(slice.parking)}
                />
                {slice.insurance > 0 ? (
                  <ChartTooltipRow
                    color={CHART_COLORS.insurance}
                    label="Insurance"
                    value={formatNuExact(slice.insurance)}
                  />
                ) : null}
                <ChartTooltipRow label="Total" value={formatNuExact(slice.value)} />
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
