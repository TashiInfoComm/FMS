import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts'

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
import { CHART_SERIES_COLORS, toSeriesKey } from '@/features/dashboard/components/charts/chart-palette'
import { formatCompactNumber } from '@/features/dashboard/lib/dashboard-api'
import { ReportChartCard } from '@/features/reports/components/ReportChartCard'
import type { TripAnalysisReport, TripReportSlice } from '@/features/reports/pages/trips/lib/trip-reports-api'

type TripAnalysisTabProps = {
  data: TripAnalysisReport | undefined
  isLoading: boolean
  isError: boolean
  errorMessage: string
}

function sliceColor(index: number): string {
  return CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length]
}

function TripsByMonthChart({ slices }: { slices: TripReportSlice[] }) {
  const chartConfig = { trips: { label: 'Trips', color: '#3b82f6' } } satisfies ChartConfig

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
      <BarChart accessibilityLayer data={slices} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="4 4" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval={0}
          tick={{ fontSize: 11 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={6}
          width={36}
          tickCount={5}
          tickFormatter={(value) => formatCompactNumber(Number(value))}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value) => (
                <ChartTooltipRow
                  color="#3b82f6"
                  label="Trips"
                  value={Number(value || 0).toLocaleString('en-BT')}
                />
              )}
            />
          }
        />
        <Bar
          dataKey="value"
          fill="var(--color-trips)"
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
          isAnimationActive={false}
        />
      </BarChart>
    </ChartContainer>
  )
}

function TripsDonut({
  slices,
  totalTrips,
}: {
  slices: TripReportSlice[]
  totalTrips: number
}) {
  const { data, chartConfig, total } = useMemo(() => {
    const config: ChartConfig = {}
    const rows = slices.map((slice, index) => {
      const key = toSeriesKey(slice.label) || `type-${index}`
      const color = sliceColor(index)
      config[key] = { label: slice.label, color }
      return { key, label: slice.label, value: slice.value, color }
    })
    const sliceTotal = rows.reduce((sum, row) => sum + row.value, 0)
    return { data: rows, chartConfig: config, total: totalTrips || sliceTotal }
  }, [slices, totalTrips])

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
        <DonutCenterLabel
          compact={formatCompactNumber(total)}
          exact={total.toLocaleString('en-BT')}
          caption="trips"
          compactClassName="text-2xl"
        />
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
            <span className="text-[var(--fms-text-subheading)]">
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

function TripBreakdownBars({ slices }: { slices: TripReportSlice[] }) {
  const highest = slices.reduce((max, slice) => Math.max(max, slice.value), 0)

  return (
    <ul className="space-y-3">
      {slices.map((slice, index) => {
        const share = highest > 0 ? Math.max(4, Math.round((slice.value / highest) * 100)) : 0
        return (
          <li
            key={slice.key}
            className="grid grid-cols-[minmax(4.5rem,8rem)_1fr_auto] items-center gap-3"
          >
            <span
              className="truncate text-sm font-medium text-[var(--fms-text-header)]"
              title={slice.label}
            >
              {slice.label}
            </span>
            <span
              className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--fms-neutral-fill)]"
              role="img"
              aria-label={`${slice.label}: ${slice.value.toLocaleString('en-BT')} trips`}
            >
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${share}%`,
                  backgroundColor: sliceColor(index),
                }}
              />
            </span>
            <span className="text-right text-sm font-semibold tabular-nums text-[var(--fms-text-header)]">
              <ChartCompactValue
                compact={formatCompactNumber(slice.value)}
                exact={slice.value.toLocaleString('en-BT')}
              />
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export function TripAnalysisTab({
  data,
  isLoading,
  isError,
  errorMessage,
}: TripAnalysisTabProps) {
  const emptyMessage = 'No trip analysis data for the selected filters.'
  const byMonth = data?.byMonth ?? []
  const byTripType = data?.byTripType ?? []
  const byAgency = data?.byAgency ?? []
  const byPurpose = data?.byPurpose ?? []
  const monthEmpty = byMonth.every((slice) => slice.value === 0)

  return (
    <div className="space-y-4">
      <div className="grid min-w-0 items-stretch gap-4 lg:grid-cols-2">
        <ReportChartCard
          className="h-full"
          title="Trips by Trip Type"
          isLoading={isLoading}
          isError={isError}
          errorMessage={errorMessage}
          isEmpty={byTripType.length === 0}
          emptyMessage={emptyMessage}
        >
          <TripsDonut slices={byTripType} totalTrips={data?.totalTrips ?? 0} />
        </ReportChartCard>

        <ReportChartCard
          className="h-full"
          title="Trips by Purpose"
          isLoading={isLoading}
          isError={isError}
          errorMessage={errorMessage}
          isEmpty={byPurpose.length === 0}
          emptyMessage={emptyMessage}
        >
          <TripsDonut slices={byPurpose} totalTrips={data?.totalTrips ?? 0} />
        </ReportChartCard>
      </div>

      <ReportChartCard
        title="Trips by Month"
        isLoading={isLoading}
        isError={isError}
        errorMessage={errorMessage}
        isEmpty={monthEmpty}
        emptyMessage={emptyMessage}
      >
        <TripsByMonthChart slices={byMonth} />
      </ReportChartCard>

      <ReportChartCard
        title="Trips by Agency"
        isLoading={isLoading}
        isError={isError}
        errorMessage={errorMessage}
        isEmpty={byAgency.length === 0}
        emptyMessage={emptyMessage}
      >
        <TripBreakdownBars slices={byAgency} />
      </ReportChartCard>
    </div>
  )
}
