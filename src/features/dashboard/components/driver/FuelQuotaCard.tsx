// Live fuel quota standing: how much of the allocation is left, and how it is being spent.
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CHART_COLORS } from '@/features/dashboard/components/charts/chart-palette'
import { formatNuExact, type DashboardFuelQuota } from '@/features/dashboard/lib/dashboard-api'

type FuelQuotaCardProps = {
  quota: DashboardFuelQuota
}

export function FuelQuotaCard({ quota }: FuelQuotaCardProps) {
  const remaining = quota.remainingPercent
  const barWidth = remaining === null ? 0 : Math.min(100, Math.max(0, remaining))

  // Quotas are small enough to read exactly, e.g. `Nu 3,400 / 5,000`.
  const allocation =
    quota.usedAmount !== null && quota.totalAmount !== null
      ? `${formatNuExact(quota.usedAmount)} / ${quota.totalAmount.toLocaleString('en-BT')}`
      : ''

  const figures = [
    { value: remaining !== null ? `${remaining}%` : '—', label: 'Remaining' },
    {
      value:
        quota.usedLitres !== null ? `${quota.usedLitres.toLocaleString('en-BT')} L` : '—',
      label: 'Used this month',
    },
    {
      value:
        quota.avgEfficiency !== null
          ? `${quota.avgEfficiency.toLocaleString('en-BT', { maximumFractionDigits: 1 })} km/L`
          : '—',
      label: 'Avg efficiency',
    },
  ]

  return (
    <Card className="min-w-0 rounded-xl border border-[var(--fms-strokes)] ring-0">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base font-semibold text-[var(--fms-text-header)]">
          Fuel Quota — Real-time
        </CardTitle>
        {allocation ? (
          <span className="rounded-md bg-[var(--fms-info-fill)] px-2.5 py-1 text-xs font-semibold text-[var(--fms-info-text)]">
            {allocation}
          </span>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-4">
        <div
          className="h-3.5 w-full overflow-hidden rounded"
          style={{ backgroundColor: '#eaeef6' }}
          role="progressbar"
          aria-valuenow={barWidth}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Fuel quota remaining"
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
      </CardContent>
    </Card>
  )
}
