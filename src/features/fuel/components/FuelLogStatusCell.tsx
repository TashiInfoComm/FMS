import type { FuelLogStatus } from '@/features/fuel/lib/fuel-log-mock-data'

export function FuelLogStatusCell({ status }: { status: FuelLogStatus }) {
  const label = status.trim() || '—'

  if (label === 'VERIFIED' || label === 'APPROVED') {
    return (
      <span className="text-xs font-bold uppercase tracking-wide text-[#0a72a5]">
        {label}
      </span>
    )
  }

  if (label === 'REJECTED' || label === 'DECLINED') {
    return (
      <span className="rounded-full bg-[#fee2e2] px-2 py-1 text-xs font-semibold text-[#c53030]">
        {label}
      </span>
    )
  }

  return (
    <span className="rounded-full bg-[#fff4cc] px-2 py-1 text-xs font-semibold text-[#9f7b00]">
      {label}
    </span>
  )
}
