import type { ReactNode } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

type ReportChartCardProps = {
  title: string
  /** Unit hint beside the title, e.g. `km / litre`. */
  meta?: string
  isLoading: boolean
  isError: boolean
  errorMessage: string
  isEmpty: boolean
  emptyMessage: string
  children: ReactNode
}

/** Card shell for report charts, with the shared loading / error / empty states. */
export function ReportChartCard({
  title,
  meta,
  isLoading,
  isError,
  errorMessage,
  isEmpty,
  emptyMessage,
  children,
}: ReportChartCardProps) {
  return (
    <Card className="min-w-0 rounded-xl border border-[var(--fms-strokes)] ring-0">
      <CardHeader className="flex flex-row flex-wrap items-baseline gap-x-2 gap-y-1">
        <CardTitle className="text-base font-semibold text-[var(--fms-text-header)]">
          {title}
        </CardTitle>
        {meta ? <span className="text-xs text-[var(--fms-text-subheading)]">{meta}</span> : null}
      </CardHeader>
      <CardContent className="min-w-0">
        {isLoading ? (
          <Skeleton className="h-64 w-full rounded-lg" />
        ) : isError ? (
          <p className="flex h-64 items-center justify-center text-center text-sm text-[var(--fms-delete)]">
            {errorMessage}
          </p>
        ) : isEmpty ? (
          <p className="flex h-64 items-center justify-center text-center text-sm text-[var(--fms-text-subheading)]">
            {emptyMessage}
          </p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}
