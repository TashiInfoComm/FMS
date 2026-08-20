// Highest / super admin dashboard: nationwide fleet posture and cost analytics.
import { useMemo } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CostByAgencyList } from '@/features/dashboard/components/CostByAgencyList'
import { DashboardChartCard } from '@/features/dashboard/components/DashboardChartCard'
import { DashboardStatCard } from '@/features/dashboard/components/DashboardStatCard'
import { ParkingClaimsConsolidationCard } from '@/features/dashboard/components/ParkingClaimsConsolidationCard'
import { CostTrendChart } from '@/features/dashboard/components/charts/CostTrendChart'
import { FleetStatusChart } from '@/features/dashboard/components/charts/FleetStatusChart'
import { MonthlyCostChart } from '@/features/dashboard/components/charts/MonthlyCostChart'
import { useDashboardIdentity } from '@/features/dashboard/hooks/useDashboardIdentity'
import {
  COST_TREND_MONTHS,
  useDashboardCostTrend,
  useDashboardSummary,
} from '@/features/dashboard/hooks/useDashboardQueries'
import { errorMessageOf } from '@/features/dashboard/lib/dashboard-ui'
import { buildMtoStatItems } from '@/features/dashboard/lib/mto-stats'
import { PageHeader } from '@/shared/components/PageHeader'
import { useAccessControl } from '@/shared/hooks/useAccessControl'

export function NationwideDashboard() {
  const summaryQuery = useDashboardSummary()
  const costTrendQuery = useDashboardCostTrend()

  const { roles } = useAccessControl()
  const isSuperAdmin = roles.includes('fms-super-admin')

  const { roleTitle, scopeLabel } = useDashboardIdentity(summaryQuery.data?.scopeLabel)

  const summary = summaryQuery.data
  const nationwideStats = useMemo(() => buildMtoStatItems(summary), [summary])
  const fleetStatus = summary?.fleetStatus ?? []
  const fleetStatusTotal = fleetStatus.reduce((sum, slice) => sum + slice.value, 0)
  const costByAgency = summary?.costByAgency ?? []
  const costTrend = costTrendQuery.data ?? []

  const summaryError = errorMessageOf(summaryQuery.error, 'Could not load dashboard summary.')
  const trendError = errorMessageOf(costTrendQuery.error, 'Could not load cost trend.')
  const trendMeta = `Last ${COST_TREND_MONTHS} months · Nu`

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

      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-1">
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

      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
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
        </div>

        <div className="min-w-0 lg:col-span-1">
          <DashboardChartCard
            title="Cost by Agency"
            isLoading={summaryQuery.isLoading}
            isError={summaryQuery.isError}
            errorMessage={summaryError}
            isEmpty={costByAgency.length === 0}
            emptyMessage="No agency cost breakdown available."
          >
            <CostByAgencyList slices={costByAgency} />
          </DashboardChartCard>
        </div>
      </div>

      {isSuperAdmin ? <ParkingClaimsConsolidationCard /> : null}
    </section>
  )
}
