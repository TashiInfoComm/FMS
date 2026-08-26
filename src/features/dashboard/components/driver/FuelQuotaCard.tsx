// Live fuel quota standing per assigned vehicle.
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CHART_COLORS } from '@/features/dashboard/components/charts/chart-palette'
import { formatNuExact } from '@/features/dashboard/lib/dashboard-api'
import type { DriverVehicleFuelQuota } from '@/features/dashboard/lib/driver-fuel-quota-api'

type FuelQuotaCardProps = {
  items: DriverVehicleFuelQuota[]
  isLoading?: boolean
  isError?: boolean
  errorMessage?: string
}

function QuotaVehicleItem({ item }: { item: DriverVehicleFuelQuota }) {
  const barWidth =
    item.remainingPercent === null ? 0 : Math.min(100, Math.max(0, item.remainingPercent))
  const allocation =
    item.usedNu !== null && item.allocatedNu !== null
      ? `${formatNuExact(item.usedNu)} / ${item.allocatedNu.toLocaleString('en-BT')}`
      : ''

  const figures = [
    {
      value: item.remainingNu !== null ? formatNuExact(item.remainingNu) : '—',
      label: 'Remaining',
    },
    {
      value: item.usedNu !== null ? formatNuExact(item.usedNu) : '—',
      label: 'Used this month',
    },
    {
      value:
        item.avgEfficiency !== null
          ? `${item.avgEfficiency.toLocaleString('en-BT')} km/L`
          : '—',
      label: 'Avg efficiency',
    },
  ]

  return (
    <li className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 text-sm font-semibold text-[var(--fms-text-header)]">
          {item.registrationNumber || item.makeModel || '—'}
          {item.registrationNumber && item.makeModel ? (
            <span className="font-normal text-[var(--fms-text-subheading)]">
              {' '}
              ({item.makeModel})
            </span>
          ) : null}
        </p>
        {allocation ? (
          <span className="rounded-md bg-[var(--fms-info-fill)] px-2.5 py-1 text-xs font-semibold text-[var(--fms-info-text)]">
            {allocation}
          </span>
        ) : null}
      </div>

      <div
        className="h-3.5 w-full overflow-hidden rounded"
        style={{ backgroundColor: '#eaeef6' }}
        role="progressbar"
        aria-valuenow={barWidth}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Fuel quota remaining for ${item.registrationNumber || item.makeModel || 'vehicle'}`}
      >
        <div
          className="h-full rounded"
          style={{ width: `${barWidth}%`, backgroundColor: CHART_COLORS.fuel }}
        />
      </div>

      <dl className="flex flex-wrap gap-x-8 gap-y-3">
        {figures.map((figure) => (
          <div key={figure.label}>
            <dd className="text-xl font-semibold text-[var(--fms-text-header)]">{figure.value}</dd>
            <dt className="text-[11px] font-medium text-[var(--fms-text-subheading)]">
              {figure.label}
            </dt>
          </div>
        ))}
      </dl>
    </li>
  )
}

export function FuelQuotaCard({
  items,
  isLoading = false,
  isError = false,
  errorMessage = 'Could not load fuel quota.',
}: FuelQuotaCardProps) {
  return (
    <Card className="min-w-0 rounded-xl border border-[var(--fms-strokes)] ring-0">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base font-semibold text-[var(--fms-text-header)]">
          Fuel Quota — Real-time
        </CardTitle>
        {!isLoading && !isError && items.length > 1 ? (
          <span className="text-xs text-[var(--fms-text-subheading)]">
            {items.length} vehicles
          </span>
        ) : null}
      </CardHeader>

      <CardContent>
        {isError ? (
          <p className="text-sm text-[var(--fms-error-text)]">{errorMessage}</p>
        ) : isLoading ? (
          <p className="text-sm text-[var(--fms-text-subheading)]">Loading fuel quota…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-[var(--fms-text-subheading)]">
            No fuel quota for your assigned vehicles.
          </p>
        ) : (
          <ul className="max-h-[28rem] divide-y divide-[var(--fms-strokes)] overflow-y-auto [&>li]:py-5 [&>li:first-child]:pt-0 [&>li:last-child]:pb-0">
            {items.map((item) => (
              <QuotaVehicleItem key={item.id} item={item} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
