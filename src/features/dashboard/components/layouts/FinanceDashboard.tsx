// Finance officer dashboard: spend totals, how they break down, and claims awaiting sign-off.
import { SquareParking } from 'lucide-react'
import { useMemo } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardChartCard } from '@/features/dashboard/components/DashboardChartCard'
import { DashboardStatCard } from '@/features/dashboard/components/DashboardStatCard'
import { CostCompositionChart } from '@/features/dashboard/components/charts/CostCompositionChart'
import { MonthlyCostChart } from '@/features/dashboard/components/charts/MonthlyCostChart'
import { useDashboardIdentity } from '@/features/dashboard/hooks/useDashboardIdentity'
import {
  COST_TREND_MONTHS,
  useDashboardCostTrend,
  useDashboardSummary,
} from '@/features/dashboard/hooks/useDashboardQueries'
import {
  formatNuCompact,
  formatNuExact,
  toCostComposition,
} from '@/features/dashboard/lib/dashboard-api'
import { FINANCE_STAT_CARDS } from '@/features/dashboard/lib/dashboard-stat-specs'
import { errorMessageOf } from '@/features/dashboard/lib/dashboard-ui'
import { PageHeader } from '@/shared/components/PageHeader'

export function FinanceDashboard() {
  const summaryQuery = useDashboardSummary()
  const costTrendQuery = useDashboardCostTrend()

  const { roleTitle, scopeLabel } = useDashboardIdentity(summaryQuery.data?.scopeLabel)

  const summary = summaryQuery.data
  const financeStats = useMemo(() => {
    if (!summary) return []

    const items: Array<{
      id: string
      label: string
      value: string
      icon: (typeof FINANCE_STAT_CARDS)[number]['icon']
      accent: string
    }> = []

    if (summary.parkingTotalAmount !== null) {
      items.push({
        id: 'parking-total-amount',
        label: 'Parking total amount',
        value: formatNuExact(summary.parkingTotalAmount),
        icon: SquareParking,
        accent: '#06b6d4',
      })
    }

    for (const spec of FINANCE_STAT_CARDS) {
      const value = summary.metrics[spec.key]
      if (value === undefined) continue
      items.push({
        id: spec.key,
        label:
          spec.showPeriod && summary.periodLabel
            ? `${spec.label} (${summary.periodLabel})`
            : spec.label,
        value: spec.format === 'currency' ? formatNuCompact(value) : value.toLocaleString('en-BT'),
        icon: spec.icon,
        accent: spec.accent,
      })
    }

    return items
  }, [summary])
  const costTrend = useMemo(() => costTrendQuery.data ?? [], [costTrendQuery.data])
  const composition = useMemo(() => toCostComposition(costTrend), [costTrend])

  const summaryError = errorMessageOf(summaryQuery.error, 'Could not load dashboard summary.')
  const trendError = errorMessageOf(costTrendQuery.error, 'Could not load cost trend.')
  const trendWindow = `Last ${COST_TREND_MONTHS} months`
  const trendMeta = `${trendWindow} · Nu`

  return (
    <section className="space-y-5">
      <PageHeader
        title={`${roleTitle} Dashboard`}
        subtitle={[scopeLabel, summary?.periodLabel].filter(Boolean).join(' · ')}
      />

      {summaryQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[74px] rounded-lg" />
          ))}
        </div>
      ) : summaryQuery.isError ? (
        <Card className="rounded-xl border border-[var(--fms-strokes)] ring-0">
          <CardContent className="py-4 text-sm text-[var(--fms-error-text)]">{summaryError}</CardContent>
        </Card>
      ) : financeStats.length === 0 ? (
        <Card className="rounded-xl border border-[var(--fms-strokes)] ring-0">
          <CardContent className="py-4 text-sm text-[var(--fms-text-subheading)]">
            No metrics are available for your role yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {financeStats.map((item) => (
            <DashboardStatCard
              key={item.id}
              label={item.label}
              value={item.value}
              icon={item.icon}
              accent={item.accent}
            />
          ))}
        </div>
      )}

      <div className="grid min-w-0 gap-4 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-2">
          <DashboardChartCard
            title="Cost Composition"
            isLoading={costTrendQuery.isLoading}
            isError={costTrendQuery.isError}
            errorMessage={trendError}
            isEmpty={composition.slices.length === 0}
            emptyMessage="No cost data available."
          >
            <CostCompositionChart
              slices={composition.slices}
              total={composition.total}
              periodLabel={trendWindow.toLowerCase()}
            />
          </DashboardChartCard>
        </div>

        <div className="min-w-0 lg:col-span-3">
          <DashboardChartCard
            title="Monthly Cost Summary"
            meta={trendMeta}
            isLoading={costTrendQuery.isLoading}
            isError={costTrendQuery.isError}
            errorMessage={trendError}
            isEmpty={costTrend.length === 0}
            emptyMessage="No cost data available."
          >
            <MonthlyCostChart points={costTrend} />
          </DashboardChartCard>
        </div>
      </div>
    </section>
  )
}
