// Fuel, maintenance and parking spend over the trailing months, as filled trend lines.
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { ChartTooltipRow } from '@/features/dashboard/components/charts/ChartTooltipRow'
import { CHART_COLORS } from '@/features/dashboard/components/charts/chart-palette'
import {
  formatCompactNumber,
  formatNuExact,
  type DashboardCostTrendPoint,
} from '@/features/dashboard/lib/dashboard-api'

const chartConfig = {
  fuel: { label: 'Fuel', color: CHART_COLORS.fuel },
  maintenance: { label: 'Maintenance', color: CHART_COLORS.maintenance },
  parking: { label: 'Parking', color: CHART_COLORS.parking },
} satisfies ChartConfig

type CostTrendChartProps = {
  points: DashboardCostTrendPoint[]
}

export function CostTrendChart({ points }: CostTrendChartProps) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
      <AreaChart accessibilityLayer data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={6}
          width={52}
          tickCount={5}
          tickFormatter={(value) => formatCompactNumber(Number(value))}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name, item) => (
                <ChartTooltipRow
                  color={item?.color}
                  label={chartConfig[name as keyof typeof chartConfig]?.label ?? name}
                  value={formatNuExact(Number(value) || 0)}
                />
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent className="justify-start" />} />
        <Area
          dataKey="fuel"
          type="monotone"
          stroke="var(--color-fuel)"
          strokeWidth={2}
          fill="var(--color-fuel)"
          fillOpacity={0.12}
          dot={{ fill: '#ffffff', stroke: 'var(--color-fuel)', strokeWidth: 2, r: 3.5 }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
        <Area
          dataKey="maintenance"
          type="monotone"
          stroke="var(--color-maintenance)"
          strokeWidth={2}
          fill="var(--color-maintenance)"
          fillOpacity={0.1}
          dot={{ fill: '#ffffff', stroke: 'var(--color-maintenance)', strokeWidth: 2, r: 3.5 }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
        <Area
          dataKey="parking"
          type="monotone"
          stroke="var(--color-parking)"
          strokeWidth={2}
          fill="var(--color-parking)"
          fillOpacity={0.08}
          dot={{ fill: '#ffffff', stroke: 'var(--color-parking)', strokeWidth: 2, r: 3.5 }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}
