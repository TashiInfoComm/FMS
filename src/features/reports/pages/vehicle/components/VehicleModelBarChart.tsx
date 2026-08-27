// Single-series bar chart comparing fleet models, shared by the efficiency and
// maintenance-cost cards on the vehicle performance tab.
import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

type VehicleModelBarChartRow = {
  shortLabel: string
  makeModel: string
  fuelEfficiencyKmPerL?: number
  avgMaintenanceCostNu?: number
}

type VehicleModelBarChartProps = {
  rows: VehicleModelBarChartRow[]
  /** Metric plotted on the Y axis. */
  metric: 'fuelEfficiencyKmPerL' | 'avgMaintenanceCostNu'
  seriesLabel: string
  color: string
  /** Axis ticks; keep short so labels stay on one line. */
  formatTick: (value: number) => string
  /** Tooltip value, where the exact figure matters. */
  formatValue: (value: number) => string
  /** Widen for money axes so `Nu 100k` does not wrap. */
  yAxisWidth?: number
}

export function VehicleModelBarChart({
  rows,
  metric,
  seriesLabel,
  color,
  formatTick,
  formatValue,
  yAxisWidth = 48,
}: VehicleModelBarChartProps) {
  const chartConfig = { value: { label: seriesLabel, color } } satisfies ChartConfig
  // Past ~6 models the labels collide, so they get angled and need a taller axis.
  const isCrowded = rows.length > 6

  const data = useMemo(
    () =>
      rows.map((row) => ({
        label: row.shortLabel,
        makeModel: row.makeModel,
        value: Number(row[metric] ?? 0),
      })),
    [rows, metric],
  )

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
      <BarChart accessibilityLayer data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="4 4" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval={0}
          height={isCrowded ? 64 : 32}
          angle={isCrowded ? -30 : 0}
          textAnchor={isCrowded ? 'end' : 'middle'}
          tick={{ fontSize: 11 }}
          tickFormatter={(value) => {
            const label = String(value)
            return label.length > 9 ? `${label.slice(0, 8)}…` : label
          }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={6}
          width={yAxisWidth}
          tickCount={5}
          tickFormatter={(value) => formatTick(Number(value))}
        />
        <ChartTooltip
          cursor={false}
          labelFormatter={(_label, payload) => String(payload?.[0]?.payload?.makeModel ?? '')}
          content={
            <ChartTooltipContent
              formatter={(value) => (
                <div className="flex w-full items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: color }}
                  />
                  <span className="flex-1 text-muted-foreground">{seriesLabel}</span>
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {formatValue(Number(value) || 0)}
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar
          dataKey="value"
          fill="var(--color-value)"
          radius={[4, 4, 0, 0]}
          maxBarSize={38}
          isAnimationActive={false}
        />
      </BarChart>
    </ChartContainer>
  )
}
