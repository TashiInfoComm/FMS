// Per-endpoint hooks so each role layout only fetches the aggregates its design shows.
import { useQuery } from '@tanstack/react-query'

import {
  fetchDashboardCostTrend,
  fetchDashboardCostTrendByAgency,
  fetchDashboardPendingActions,
  fetchDashboardSummary,
} from '@/features/dashboard/lib/dashboard-api'
import { useAccessControl } from '@/shared/hooks/useAccessControl'

/** Trend window shared by the cost charts. */
export const COST_TREND_MONTHS = 12

export function useDashboardSummary() {
  const { role } = useAccessControl()
  return useQuery({
    queryKey: ['dashboard-summary', role],
    queryFn: fetchDashboardSummary,
    staleTime: 60_000,
  })
}

export function useDashboardPendingActions() {
  const { role } = useAccessControl()
  return useQuery({
    queryKey: ['dashboard-pending-actions', role],
    queryFn: fetchDashboardPendingActions,
    staleTime: 30_000,
  })
}

export function useDashboardCostTrend(months: number = COST_TREND_MONTHS) {
  const { role } = useAccessControl()
  return useQuery({
    queryKey: ['dashboard-cost-trend', role, months],
    queryFn: () => fetchDashboardCostTrend(months),
    staleTime: 60_000,
  })
}

export function useDashboardCostTrendByAgency(months: number = COST_TREND_MONTHS) {
  const { role } = useAccessControl()
  return useQuery({
    queryKey: ['dashboard-cost-trend-by-agency', role, months],
    queryFn: () => fetchDashboardCostTrendByAgency(months),
    staleTime: 60_000,
  })
}
