// Highest / super admin dashboard: nationwide fleet posture and cost analytics.
import { useMemo } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CostByAgencyList } from '@/features/dashboard/components/CostByAgencyList'
import { DashboardChartCard } from '@/features/dashboard/components/DashboardChartCard'
import { DashboardStatCard } from '@/features/dashboard/components/DashboardStatCard'
import { ParkingClaimsConsolidationCard } from '@/features/dashboard/components/ParkingClaimsConsolidationCard'
import { PendingActionsPanel } from '@/features/dashboard/components/PendingActionsPanel'
import { CostCompositionChart } from '@/features/dashboard/components/charts/CostCompositionChart'
import { CostTrendChart } from '@/features/dashboard/components/charts/CostTrendChart'
import { FleetStatusChart } from '@/features/dashboard/components/charts/FleetStatusChart'
import { MonthlyCostChart } from '@/features/dashboard/components/charts/MonthlyCostChart'
import { useDashboardIdentity } from '@/features/dashboard/hooks/useDashboardIdentity'
import {
  COST_TREND_MONTHS,
  useDashboardCostTrendByAgency,
  useDashboardPendingActions,
  useDashboardSummary,
} from '@/features/dashboard/hooks/useDashboardQueries'
import { errorMessageOf } from '@/features/dashboard/lib/dashboard-ui'
import { buildMtoStatItems, pendingApprovalsFromSummary, visiblePendingActions } from '@/features/dashboard/lib/mto-stats'
import { PageHeader } from '@/shared/components/PageHeader'
import { useAccessControl } from '@/shared/hooks/useAccessControl'

export function NationwideDashboard() {
  const summaryQuery = useDashboardSummary()
  const pendingActionsQuery = useDashboardPendingActions()
  const costTrendQuery = useDashboardCostTrendByAgency()

  const { roles } = useAccessControl()
  const isSuperAdmin = roles.includes('fms-super-admin')

  const { roleTitle, scopeLabel } = useDashboardIdentity(summaryQuery.data?.scopeLabel)

  const summary = summaryQuery.data
  const nationwideStats = useMemo(() => buildMtoStatItems(summary), [summary])
  const fleetStatus = summary?.fleetStatus ?? []
  const fleetStatusTotal = summary?.fleetStatusTotal ?? fleetStatus.reduce((sum, slice) => sum + slice.value, 0)
  const costTrend = costTrendQuery.data?.points ?? []
  const composition = costTrendQuery.data?.composition ?? { slices: [], total: 0 }
  const costByAgency = costTrendQuery.data ?? { slices: [], total: 0 }
  const pendingActions = useMemo(() => {
    const fromApi = visiblePendingActions(pendingActionsQuery.data ?? [])
    return fromApi.length > 0 ? fromApi : pendingApprovalsFromSummary(summary)
  }, [pendingActionsQuery.data, summary])

  const summaryError = errorMessageOf(summaryQuery.error, 'Could not load dashboard summary.')
  const trendError = errorMessageOf(costTrendQuery.error, 'Could not load cost trend.')
  const agencyError = trendError
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
      ) : nationwideStats.length === 0 ? (
        <Card className="rounded-xl border border-[var(--fms-strokes)] ring-0">
          <CardContent className="py-4 text-sm text-[var(--fms-text-subheading)]">
            No metrics are available for your role yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {nationwideStats.map((item) => (
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
        errorMessage={errorMessageOf(
          pendingActionsQuery.error,
          'Could not load pending approvals.',
        )}
      />

      <div className="grid min-w-0 items-stretch gap-4 lg:grid-cols-2">
        <DashboardChartCard
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
          title="Cost Composition"
          isLoading={costTrendQuery.isLoading}
          isError={costTrendQuery.isError}
          errorMessage={trendError}
          isEmpty={composition.total === 0}
          emptyMessage="No cost data available."
          className="overflow-visible"
        >
          <CostCompositionChart
            slices={composition.slices}
            total={composition.total}
            periodLabel={trendWindow.toLowerCase()}
          />
        </DashboardChartCard>
      </div>

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
        title="Cost by Agency"
        isLoading={costTrendQuery.isLoading}
        isError={costTrendQuery.isError}
        errorMessage={agencyError}
        isEmpty={costByAgency.slices.length === 0}
        emptyMessage="No agency cost breakdown available."
        className="overflow-visible"
      >
        <CostByAgencyList slices={costByAgency.slices} />
      </DashboardChartCard>

      {isSuperAdmin ? <ParkingClaimsConsolidationCard /> : null}
    </section>
  )
}
