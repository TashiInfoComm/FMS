import type { ReactNode } from 'react'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/** Skeleton for a label + value pair on read-only detail pages. */
export function DetailLabeledValueSkeleton({
  label,
  className,
}: {
  label: string
  className?: string
}) {
  return (
    <div className={cn('min-w-0 space-y-2', className)}>
      <p className="text-xs font-medium text-[var(--fms-text-subheading)]">{label}</p>
      <Skeleton className="h-4 w-full max-w-xs" />
    </div>
  )
}

/** Skeleton for input-style read-only fields (label + input height). */
export function DetailReadOnlyFieldSkeleton({
  label,
  className,
}: {
  label: string
  className?: string
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-xs font-medium text-[var(--fms-text-subheading)]">{label}</p>
      <Skeleton className="h-9 w-full rounded-md" />
    </div>
  )
}

/** Skeleton for boxed detail fields (e.g. quota request cards). */
export function DetailFieldBoxSkeleton({
  label,
  className,
}: {
  label: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--fms-strokes)] bg-[#f8f8f9] px-4 py-3',
        className,
      )}
    >
      <p className="text-sm text-[var(--fms-text-subheading)]">{label}</p>
      <Skeleton className="mt-2 h-5 w-32" />
    </div>
  )
}

/** Summary card with icon, label, and skeleton value. */
export function DetailSummaryCardSkeleton({
  label,
}: {
  label: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--fms-strokes)] bg-[#f6f6f7] p-4">
      <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-xs text-[var(--fms-text-subheading)]">{label}</p>
        <Skeleton className="h-4 w-full max-w-[10rem]" />
      </div>
    </div>
  )
}

/** Field row skeleton matching uppercase label detail cards. */
export function DetailFieldRowSkeleton({
  label,
  className,
}: {
  label: string
  className?: string
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--fms-text-subheading)]">
        {label}
      </p>
      <Skeleton className="h-4 w-full max-w-xs" />
    </div>
  )
}

/** Inline skeleton for a single value while its lookup API is pending. */
export function DetailInlineValueSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn('inline-block h-4 w-24', className)} />
}

/** Renders children or a skeleton value when `loading` is true. */
export function DetailFieldValue({
  loading,
  children,
  className,
}: {
  loading?: boolean
  children: ReactNode
  className?: string
}) {
  if (loading) {
    return <DetailInlineValueSkeleton className={className} />
  }
  return <>{children}</>
}
