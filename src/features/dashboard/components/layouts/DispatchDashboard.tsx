// MTO dashboard: what needs approving today, plus the cost picture behind those decisions.
import { useMemo } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardChartCard } from '@/features/dashboard/components/DashboardChartCard'
import { DashboardStatCard } from '@/features/dashboard/components/DashboardStatCard'
import { PendingActionsPanel } from '@/features/dashboard/components/PendingActionsPanel'
import { CostCompositionChart } from '@/features/dashboard/components/charts/CostCompositionChart'
import { CostTrendChart } from '@/features/dashboard/components/charts/CostTrendChart'
import { FleetStatusChart } from '@/features/dashboard/components/charts/FleetStatusChart'
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
import { buildMtoStatItems, pendingApprovalsFromSummary, visiblePendingActions } from '@/features/dashboard/lib/mto-stats'
import { PageHeader } from '@/shared/components/PageHeader'

export function DispatchDashboard() {
  const summaryQuery = useDashboardSummary()
  const pendingActionsQuery = useDashboardPendingActions()
  const costTrendQuery = useDashboardCostTrend()

  const { roleTitle, scopeLabel } = useDashboardIdentity(summaryQuery.data?.scopeLabel)

  const mtoStats = useMemo(() => buildMtoStatItems(summaryQuery.data), [summaryQuery.data])
  const pendingActions = useMemo(() => {
    const fromApi = visiblePendingActions(pendingActionsQuery.data ?? [])
    return fromApi.length > 0 ? fromApi : pendingApprovalsFromSummary(summaryQuery.data)
  }, [pendingActionsQuery.data, summaryQuery.data])
  const costTrend = useMemo(() => costTrendQuery.data ?? [], [costTrendQuery.data])
  const composition = useMemo(() => toCostComposition(costTrend), [costTrend])
  const fleetStatus = summaryQuery.data?.fleetStatus ?? []
  const fleetStatusTotal =
    summaryQuery.data?.fleetStatusTotal ??
    fleetStatus.reduce((sum, slice) => sum + slice.value, 0)

  const summaryError = errorMessageOf(summaryQuery.error, 'Could not load dashboard summary.')
  const trendError = errorMessageOf(costTrendQuery.error, 'Could not load cost trend.')
  const trendWindow = `Last ${COST_TREND_MONTHS} months`
  const trendMeta = `${trendWindow} · Nu`

  return (
    <section className="space-y-5">
      <PageHeader
        title={`${roleTitle} Dashboard`}
        subtitle={[scopeLabel, roleTitle].filter(Boolean).join(' · ')}
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
      ) : mtoStats.length === 0 ? (
        <Card className="rounded-xl border border-[var(--fms-strokes)] ring-0">
          <CardContent className="py-4 text-sm text-[var(--fms-text-subheading)]">
            No metrics are available for your role yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {mtoStats.map((item) => (
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

      <div className="grid min-w-0 items-stretch gap-4 lg:grid-cols-2">
        <DashboardChartCard
          className="h-full"
          title="Fleet Status Distribution"
          isLoading={summaryQuery.isLoading}
          isError={summaryQuery.isError}
          errorMessage={summaryError}
          isEmpty={fleetStatus.length === 0}
          emptyMessage="No vehicle status data available."
        >
          <FleetStatusChart slices={fleetStatus} total={fleetStatusTotal} />
        </DashboardChartCard>

        <DashboardChartCard
          className="h-full"
          title="Cost Composition"
          isLoading={costTrendQuery.isLoading}
          isError={costTrendQuery.isError}
          errorMessage={trendError}
          isEmpty={composition.total === 0}
          emptyMessage="No cost data available."
        >
          <CostCompositionChart
            slices={composition.slices}
            total={composition.total}
            periodLabel={trendWindow.toLowerCase()}
          />
        </DashboardChartCard>
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
    </section>
  )
}
