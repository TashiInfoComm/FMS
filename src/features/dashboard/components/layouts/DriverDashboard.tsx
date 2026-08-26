// Driver dashboard: the vehicles they hold, their standing, and what they are driving today.
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardStatCard } from '@/features/dashboard/components/DashboardStatCard'
import { AssignedTripsPanel } from '@/features/dashboard/components/driver/AssignedTripsPanel'
import { AssignedVehiclesPanel } from '@/features/dashboard/components/driver/AssignedVehiclesPanel'
import { FuelQuotaCard } from '@/features/dashboard/components/driver/FuelQuotaCard'
import { useDashboardIdentity } from '@/features/dashboard/hooks/useDashboardIdentity'
import { useDashboardSummary } from '@/features/dashboard/hooks/useDashboardQueries'
import { errorMessageOf } from '@/features/dashboard/lib/dashboard-ui'
import { buildDriverStatItems } from '@/features/dashboard/lib/driver-stats'
import {
  fetchDriverFuelQuotaPage,
  mapDriverVehicleQuotas,
} from '@/features/dashboard/lib/driver-fuel-quota-api'
import { fetchDriverAssignedVehicleList } from '@/features/dashboard/lib/driver-vehicles-api'
import { PageHeader } from '@/shared/components/PageHeader'

export function DriverDashboard() {
  // Costs and approvals belong to other roles, so the driver view only needs the summary.
  const summaryQuery = useDashboardSummary()

  const { roleTitle, scopeLabel, fullName, userId } = useDashboardIdentity(
    summaryQuery.data?.scopeLabel,
  )

  // The signed-in user is the driver, so their id keys the per-driver vehicle endpoint.
  const vehiclesQuery = useQuery({
    queryKey: ['dashboard', 'driver-assigned-vehicles', userId],
    queryFn: () => fetchDriverAssignedVehicleList(userId),
    enabled: Boolean(userId),
    staleTime: 60_000,
  })

  const quotaQuery = useQuery({
    queryKey: ['dashboard', 'driver-fuel-quota'],
    queryFn: fetchDriverFuelQuotaPage,
    staleTime: 60_000,
  })

  const summary = summaryQuery.data
  const summaryError = errorMessageOf(summaryQuery.error, 'Could not load dashboard summary.')
  const driverStats = useMemo(() => buildDriverStatItems(summary), [summary])
  const fuelQuotas = useMemo(
    () =>
      mapDriverVehicleQuotas(
        vehiclesQuery.data ?? [],
        quotaQuery.data?.quotaRows ?? [],
        quotaQuery.data?.consumptionRows ?? [],
      ),
    [quotaQuery.data, vehiclesQuery.data],
  )

  return (
    <section className="space-y-5">
      <PageHeader
        title={`${roleTitle} Dashboard`}
        subtitle={[roleTitle, fullName, scopeLabel].filter(Boolean).join(' · ')}
      />

      <AssignedVehiclesPanel
        vehicles={vehiclesQuery.data ?? []}
        isLoading={vehiclesQuery.isLoading}
        isError={vehiclesQuery.isError}
        errorMessage={errorMessageOf(
          vehiclesQuery.error,
          'Could not load your assigned vehicles.',
        )}
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
      ) : driverStats.length === 0 ? (
        <Card className="rounded-xl border border-[var(--fms-strokes)] ring-0">
          <CardContent className="py-4 text-sm text-[var(--fms-text-subheading)]">
            No metrics are available for your role yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {driverStats.map((item) => (
            <DashboardStatCard
              key={item.id}
              label={item.label}
              value={item.value}
              icon={item.icon}
              accent={item.accent}
              suffix={item.suffix}
            />
          ))}
        </div>
      )}

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <FuelQuotaCard
          items={fuelQuotas}
          isLoading={quotaQuery.isLoading || vehiclesQuery.isLoading}
          isError={quotaQuery.isError}
          errorMessage={errorMessageOf(quotaQuery.error, 'Could not load fuel quota.')}
        />

        <AssignedTripsPanel
          trips={summary?.todaysTrips ?? []}
          isLoading={summaryQuery.isLoading}
          isError={summaryQuery.isError}
          errorMessage={summaryError}
        />
      </div>
    </section>
  )
}
