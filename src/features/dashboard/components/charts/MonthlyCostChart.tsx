// Stacked monthly spend by cost head (fuel / maintenance / parking).
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

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
  insurance: { label: 'Insurance', color: CHART_COLORS.insurance },
} satisfies ChartConfig

type MonthlyCostChartProps = {
  points: DashboardCostTrendPoint[]
}

export function MonthlyCostChart({ points }: MonthlyCostChartProps) {
  // Insurance is only broken out for the scopes whose payload carries it.
  const hasInsurance = points.some((point) => point.insurance > 0)
  const topRadius: [number, number, number, number] = [4, 4, 0, 0]

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
      <BarChart accessibilityLayer data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
          cursor={false}
          labelFormatter={(label, payload) => {
            const total = Number(payload?.[0]?.payload?.total) || 0
            return `${label} · ${formatNuExact(total)}`
          }}
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
        <ChartLegend
          verticalAlign="top"
          align="right"
          content={<ChartLegendContent className="justify-end pt-0 pb-3" />}
        />
        <Bar
          dataKey="fuel"
          stackId="cost"
          fill="var(--color-fuel)"
          maxBarSize={34}
          isAnimationActive={false}
        />
        <Bar
          dataKey="maintenance"
          stackId="cost"
          fill="var(--color-maintenance)"
          maxBarSize={34}
          isAnimationActive={false}
        />
        <Bar
          dataKey="parking"
          stackId="cost"
          fill="var(--color-parking)"
          radius={hasInsurance ? undefined : topRadius}
          maxBarSize={34}
          isAnimationActive={false}
        />
        {hasInsurance ? (
          <Bar
            dataKey="insurance"
            stackId="cost"
            fill="var(--color-insurance)"
            radius={topRadius}
            maxBarSize={34}
            isAnimationActive={false}
          />
        ) : null}
      </BarChart>
    </ChartContainer>
  )
}
