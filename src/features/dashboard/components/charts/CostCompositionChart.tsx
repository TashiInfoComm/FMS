// Doughnut split of spend by cost head, with the window total in the center.
import { useMemo } from 'react'
import { Cell, Pie, PieChart } from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { ChartTooltipRow } from '@/features/dashboard/components/charts/ChartTooltipRow'
import { costCategoryColor, toSeriesKey } from '@/features/dashboard/components/charts/chart-palette'
import { formatNuExact, type DashboardSlice } from '@/features/dashboard/lib/dashboard-api'

type CostCompositionChartProps = {
  slices: DashboardSlice[]
  total: number
  /** Window the total covers, e.g. `last 6 months`. */
  periodLabel: string
}

export function CostCompositionChart({ slices, total, periodLabel }: CostCompositionChartProps) {
  const { data, chartConfig } = useMemo(() => {
    const config: ChartConfig = {}
    const rows = slices.map((slice, index) => {
      const key = toSeriesKey(slice.label)
      const color = costCategoryColor(slice.label, index)
      config[key] = { label: slice.label, color }
      return { key, label: slice.label, value: slice.value, color }
    })
    return { data: rows, chartConfig: config }
  }, [slices])

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <ChartContainer config={chartConfig} className="aspect-square h-48 w-48">
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, name, item) => {
                    const amount = Number(value) || 0
                    const share = total > 0 ? Math.round((amount / total) * 100) : 0
                    return (
                      <ChartTooltipRow
                        color={item?.payload?.color}
                        label={chartConfig[String(name)]?.label ?? name}
                        value={`${formatNuExact(amount)} (${share}%)`}
                      />
                    )
                  }}
                />
              }
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="key"
              innerRadius="62%"
              outerRadius="100%"
              stroke="#ffffff"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.map((row) => (
                <Cell key={row.key} fill={row.color} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold tabular-nums text-[var(--fms-text-header)]">
            {formatNuExact(total)}
          </span>
          <span className="text-[11px] text-[var(--fms-text-subheading)]">{periodLabel}</span>
        </div>
      </div>

      <ul className="flex w-full flex-wrap justify-center gap-x-5 gap-y-2">
        {data.map((row) => (
          <li key={row.key} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: row.color }}
            />
            <span className="font-medium text-[var(--fms-text-header)]">{row.label}</span>
            <span className="tabular-nums text-[var(--fms-text-subheading)]">
              {formatNuExact(row.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
