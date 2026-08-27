// Finance officer dashboard: spend totals, how they break down, and claims awaiting sign-off.
import { Fuel, SquareParking, Wrench } from 'lucide-react'
import { useMemo } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardChartCard } from '@/features/dashboard/components/DashboardChartCard'
import { DashboardStatCard } from '@/features/dashboard/components/DashboardStatCard'
import { PendingActionsPanel } from '@/features/dashboard/components/PendingActionsPanel'
import { CostCompositionChart } from '@/features/dashboard/components/charts/CostCompositionChart'
import { MonthlyCostChart } from '@/features/dashboard/components/charts/MonthlyCostChart'
import { useDashboardIdentity } from '@/features/dashboard/hooks/useDashboardIdentity'
import {
  COST_TREND_MONTHS,
  useDashboardCostTrend,
  useDashboardPendingActions,
  useDashboardSummary,
} from '@/features/dashboard/hooks/useDashboardQueries'
import {
  formatNuCompact,
  formatNuExact,
  toCostComposition,
} from '@/features/dashboard/lib/dashboard-api'
import { FINANCE_STAT_CARDS } from '@/features/dashboard/lib/dashboard-stat-specs'
import { errorMessageOf } from '@/features/dashboard/lib/dashboard-ui'
import { financePendingApprovalsFromSummary, visiblePendingActions } from '@/features/dashboard/lib/mto-stats'
import { PageHeader } from '@/shared/components/PageHeader'

export function FinanceDashboard() {
  const summaryQuery = useDashboardSummary()
  const pendingActionsQuery = useDashboardPendingActions()
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

    const hasFuelOrParkingTotals =
      summary.fuelTotalAmount !== null || summary.parkingTotalAmount !== null

    if (summary.fuelTotalAmount !== null) {
      items.push({
        id: 'fuel-total-amount',
        label: 'Fuel total amount',
        value: formatNuExact(summary.fuelTotalAmount),
        icon: Fuel,
        accent: '#fb923c',
      })
    }

    if (hasFuelOrParkingTotals && summary.maintenanceTotalAmount !== null) {
      items.push({
        id: 'maintenance-total-amount',
        label: 'Maintenance total amount',
        value: formatNuExact(summary.maintenanceTotalAmount),
        icon: Wrench,
        accent: '#f59e0b',
      })
    }

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
      if (spec.key === 'fuelCost' && summary.fuelTotalAmount !== null) continue
      if (spec.key === 'maintenanceCost' && summary.maintenanceTotalAmount !== null) continue
      if (spec.key === 'parkingCost' && summary.parkingTotalAmount !== null) continue
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
  const pendingActions = useMemo(() => {
    const fromApi = visiblePendingActions(pendingActionsQuery.data ?? [])
    return fromApi.length > 0 ? fromApi : financePendingApprovalsFromSummary(summary)
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

      <DashboardChartCard
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
