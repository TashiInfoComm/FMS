// Agency admin dashboard: agency-scoped approvals, MTO-style stats, and cost analytics.
import { useMemo } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardChartCard } from '@/features/dashboard/components/DashboardChartCard'
import { DashboardStatCard } from '@/features/dashboard/components/DashboardStatCard'
import { PendingActionsPanel } from '@/features/dashboard/components/PendingActionsPanel'
import { CostCompositionChart } from '@/features/dashboard/components/charts/CostCompositionChart'
import { CostTrendChart } from '@/features/dashboard/components/charts/CostTrendChart'
import { MonthlyCostChart } from '@/features/dashboard/components/charts/MonthlyCostChart'
import { useDashboardIdentity } from '@/features/dashboard/hooks/useDashboardIdentity'
import {
  COST_TREND_MONTHS,
  useDashboardCostTrend,
  useDashboardPendingActions,
  useDashboardSummary,
} from '@/features/dashboard/hooks/useDashboardQueries'
import { toCostComposition } from '@/features/dashboard/lib/dashboard-api'
import { errorMessageOf } from '@/features/dashboard/lib/dashboard-ui'
import { buildMtoStatItems, pendingApprovalsFromSummary } from '@/features/dashboard/lib/mto-stats'
import { PageHeader } from '@/shared/components/PageHeader'

export function AgencyAdminDashboard() {
  const summaryQuery = useDashboardSummary()
  const pendingActionsQuery = useDashboardPendingActions()
  const costTrendQuery = useDashboardCostTrend()

  const { roleTitle, scopeLabel } = useDashboardIdentity(summaryQuery.data?.scopeLabel)

  const summary = summaryQuery.data
  const agencyStats = useMemo(() => buildMtoStatItems(summary), [summary])
  const pendingActions = useMemo(() => {
    const fromApi = pendingActionsQuery.data ?? []
    return fromApi.length > 0 ? fromApi : pendingApprovalsFromSummary(summary)
  }, [pendingActionsQuery.data, summary])
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
        subtitle={[scopeLabel, 'My Agency', roleTitle].filter(Boolean).join(' · ')}
      />

      {summaryQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-[74px] rounded-lg" />
          ))}
        </div>
      ) : summaryQuery.isError ? (
        <Card className="rounded-xl border border-[var(--fms-strokes)] ring-0">
          <CardContent className="py-4 text-sm text-[var(--fms-error-text)]">
            {summaryError}
          </CardContent>
        </Card>
      ) : agencyStats.length === 0 ? (
        <Card className="rounded-xl border border-[var(--fms-strokes)] ring-0">
          <CardContent className="py-4 text-sm text-[var(--fms-text-subheading)]">
            No metrics are available for your role yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {agencyStats.map((item) => (
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

      <PendingActionsPanel
        title="Pending Approvals"
        badge="count"
        actions={pendingActions}
        isLoading={pendingActionsQuery.isLoading}
        isError={pendingActionsQuery.isError && pendingActions.length === 0}
        errorMessage={errorMessageOf(pendingActionsQuery.error, 'Could not load pending approvals.')}
      />

      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-1">
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

        <div className="min-w-0 lg:col-span-2">
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

      <DashboardChartCard
        title="Cost Trend — Fuel, Maintenance & Parking"
        meta={trendMeta}
        isLoading={costTrendQuery.isLoading}
        isError={costTrendQuery.isError}
        errorMessage={trendError}
        isEmpty={costTrend.length === 0}
        emptyMessage="No cost data available."
      >
        <CostTrendChart points={costTrend} />
      </DashboardChartCard>
    </section>
  )
}
