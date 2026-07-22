import { Car, Fuel, User, Wrench, X } from 'lucide-react'
import type { ReactNode } from 'react'

import { DesignatedVehicleStatusCell } from '@/features/designated-vehicle/components/DesignatedVehicleStatusCell'
import type { DesignatedVehicleDetail } from '@/features/designated-vehicle/lib/designated-vehicle-types'
import {
  formatCurrencyNu,
  getInitials,
} from '@/features/designated-vehicle/lib/designated-vehicle-ui'
import { cn } from '@/lib/utils'

type DesignatedVehicleDetailDrawerProps = {
  detail: DesignatedVehicleDetail | null
  open: boolean
  loading?: boolean
  onClose: () => void
}

function DetailSection({
  title,
  icon,
  action,
  children,
}: {
  title: string
  icon: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-[var(--fms-strokes)] bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--fms-text-header)]">
          {icon}
          {title}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--fms-strokes)]/70 bg-[#fafafa] px-3 py-2.5">
      <p className="text-xs text-[var(--fms-text-subheading)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--fms-text-header)]">{value}</p>
    </div>
  )
}

export function DesignatedVehicleDetailDrawer({
  detail,
  open,
  loading = false,
  onClose,
}: DesignatedVehicleDetailDrawerProps) {
  if (!open) return null

  const quotaTone =
    detail && detail.quotaUsedPercent !== undefined
      ? detail.quotaUsedPercent >= 80
        ? 'bg-[#f97316]'
        : detail.quotaUsedPercent >= 60
          ? 'bg-[#eab308]'
          : 'bg-[#22c55e]'
      : 'bg-[#22c55e]'

  const showFuelSummary =
    detail &&
    (detail.currentQuota !== undefined ||
      detail.thresholdAmount !== undefined ||
      detail.monthlyAllocation !== undefined ||
      detail.quotaUsedPercent !== undefined)

  return (
    <>
      <button
        type="button"
        aria-label="Close detail drawer"
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
      />
      <aside
        className={cn(
          'fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl',
          'animate-in slide-in-from-right duration-200',
        )}
      >
        <div className="flex items-center justify-between border-b border-[var(--fms-strokes)] px-4 py-3">
          <h2 className="text-base font-semibold text-[var(--fms-text-header)]">
            Designated Vehicle Detail
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[var(--fms-text-subheading)] hover:bg-[#f6f6f7]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-[var(--fms-text-subheading)]">
              Loading details…
            </p>
          ) : !detail ? (
            <p className="py-8 text-center text-sm text-[var(--fms-delete)]">
              Could not load designated vehicle details.
            </p>
          ) : (
            <>
          <DetailSection title="Official Profile" icon={<User className="h-4 w-4 text-[var(--fms-primary)]" />}>
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--fms-primary)] text-sm font-semibold text-white">
                {getInitials(detail.officialName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[var(--fms-text-header)]">{detail.officialName}</p>
                <p className="text-sm text-[var(--fms-text-subheading)]">{detail.designation}</p>
                {detail.designationTypeName ? (
                  <p className="text-sm text-[var(--fms-text-subheading)]">
                    {detail.designationTypeName}
                  </p>
                ) : null}
                {detail.agency && detail.agency !== '—' ? (
                  <p className="text-sm text-[var(--fms-text-subheading)]">{detail.agency}</p>
                ) : null}
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-[var(--fms-strokes)]/70 bg-[#fafafa] px-3 py-2">
              <p className="text-xs text-[var(--fms-text-subheading)]">CID No.</p>
              <p className="mt-0.5 text-sm font-medium text-[var(--fms-text-header)]">
                {detail.officialCid}
              </p>
            </div>
            {detail.remarks ? (
              <div className="mt-3 rounded-lg border border-[var(--fms-strokes)]/70 bg-[#fafafa] px-3 py-2">
                <p className="text-xs text-[var(--fms-text-subheading)]">Remarks</p>
                <p className="mt-0.5 text-sm text-[var(--fms-text-header)]">{detail.remarks}</p>
              </div>
            ) : null}
          </DetailSection>

          <DetailSection
            title="Vehicle Details"
            icon={<Car className="h-4 w-4 text-[var(--fms-primary)]" />}
            action={<DesignatedVehicleStatusCell status={detail.status} />}
          >
            <div>
              <p className="font-semibold text-[var(--fms-text-header)]">{detail.registrationNumber}</p>
              <p className="text-sm text-[var(--fms-text-subheading)]">{detail.makeModel}</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {detail.odometerKm !== undefined ? (
                <MetricCard
                  label="Odometer"
                  value={`${detail.odometerKm.toLocaleString('en-US')} km`}
                />
              ) : null}
              {detail.fuelType ? (
                <MetricCard label="Fuel type" value={detail.fuelType} />
              ) : null}
            </div>
            {detail.driverName ? (
              <p className="mt-3 rounded-lg bg-[#f6f6f7] px-3 py-2 text-sm text-[var(--fms-text-subheading)]">
                Assigned driver:{' '}
                <span className="font-medium text-[var(--fms-text-header)]">{detail.driverName}</span>
              </p>
            ) : null}
          </DetailSection>

          {showFuelSummary ? (
          <DetailSection title="Fuel Summary" icon={<Fuel className="h-4 w-4 text-[var(--fms-primary)]" />}>
            <div className="grid grid-cols-2 gap-2">
              {detail.currentQuota !== undefined ? (
                <MetricCard label="Current Quota" value={formatCurrencyNu(detail.currentQuota)} />
              ) : null}
              {detail.thresholdAmount !== undefined ? (
                <MetricCard label="Threshold Amount" value={formatCurrencyNu(detail.thresholdAmount)} />
              ) : null}
            </div>
            {detail.quotaUsedPercent !== undefined ? (
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-[var(--fms-text-subheading)]">
                <span>Monthly quota used</span>
                <span className="font-medium text-[var(--fms-text-header)]">
                  {detail.quotaUsedPercent}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#e5e7eb]">
                <div
                  className={cn('h-full rounded-full transition-all', quotaTone)}
                  style={{ width: `${Math.min(100, detail.quotaUsedPercent)}%` }}
                />
              </div>
              {detail.monthlyAllocation !== undefined ? (
                <p className="text-xs text-[var(--fms-text-subheading)]">
                  Allocation: {formatCurrencyNu(detail.monthlyAllocation)} / month
                </p>
              ) : null}
            </div>
            ) : null}
          </DetailSection>
          ) : null}

          {detail.lastServiceDate ? (
          <DetailSection
            title="Maintenance Summary"
            icon={<Wrench className="h-4 w-4 text-[var(--fms-primary)]" />}
          >
            <MetricCard label="Last service" value={detail.lastServiceDate} />
          </DetailSection>
          ) : null}
            </>
          )}
        </div>
      </aside>
    </>
  )
}
