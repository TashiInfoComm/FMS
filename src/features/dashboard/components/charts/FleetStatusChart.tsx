// Doughnut breakdown of vehicles by operational status, with the fleet total in the center.
import { useMemo } from 'react'
import { Cell, Pie, PieChart } from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  ChartCompactValue,
  DonutCenterLabel,
} from '@/features/dashboard/components/charts/ChartCompactValue'
import { ChartTooltipRow } from '@/features/dashboard/components/charts/ChartTooltipRow'
import {
  fleetStatusColor,
  toSeriesKey,
} from '@/features/dashboard/components/charts/chart-palette'
import { formatCompactNumber, type DashboardSlice } from '@/features/dashboard/lib/dashboard-api'

type FleetStatusChartProps = {
  slices: DashboardSlice[]
  total: number
}

export function FleetStatusChart({ slices, total }: FleetStatusChartProps) {
  const { data, pieData, chartConfig } = useMemo(() => {
    const config: ChartConfig = {}
    const rows = slices.map((slice, index) => {
      const key = toSeriesKey(slice.label)
      const color = fleetStatusColor(slice.label, index)
      config[key] = { label: slice.label, color }
      return { key, label: slice.label, value: slice.value, color }
    })
    return {
      data: rows,
      pieData: rows.filter((row) => row.value > 0),
      chartConfig: config,
    }
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
                    if (!name) return null
                    const count = Number(value) || 0
                    const share = total > 0 ? Math.round((count / total) * 100) : 0
                    return (
                      <ChartTooltipRow
                        color={item?.payload?.color}
                        label={chartConfig[String(name)]?.label ?? name}
                        value={`${count.toLocaleString('en-BT')} (${share}%)`}
                      />
                    )
                  }}
                />
              }
            />
            {pieData.length > 0 ? (
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="key"
                innerRadius="62%"
                outerRadius="100%"
                stroke="#ffffff"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {pieData.map((row) => (
                  <Cell key={row.key} fill={row.color} />
                ))}
              </Pie>
            ) : null}
          </PieChart>
        </ChartContainer>

        <DonutCenterLabel
          compact={formatCompactNumber(total)}
          exact={total.toLocaleString('en-BT')}
          caption={total === 1 ? 'vehicle' : 'vehicles'}
          compactClassName="text-3xl"
          holePercent={62}
        />
      </div>

      <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        {data.map((row) => (
          <li key={row.key} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: row.color }}
            />
            <span className="text-[var(--fms-text-subheading)]">{row.label}</span>
            <span className="font-semibold text-[var(--fms-text-header)]">
              <ChartCompactValue
                compact={formatCompactNumber(row.value)}
                exact={row.value.toLocaleString('en-BT')}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
