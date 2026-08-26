import type { ReactNode } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type DashboardChartCardProps = {
  title: string
  /** Range or unit hint beside the title, e.g. `Last 6 months · Nu`. */
  meta?: string
  isLoading: boolean
  isError: boolean
  errorMessage: string
  isEmpty: boolean
  emptyMessage: string
  className?: string
  children: ReactNode
}

/** Card shell for dashboard charts, with the shared loading / error / empty states. */
export function DashboardChartCard({
  title,
  meta,
  isLoading,
  isError,
  errorMessage,
  isEmpty,
  emptyMessage,
  className,
  children,
}: DashboardChartCardProps) {
  return (
    <Card className={cn('min-w-0 rounded-xl border border-[var(--fms-strokes)] ring-0', className)}>
      <CardHeader className="flex flex-row flex-wrap items-baseline gap-x-2 gap-y-1">
        <CardTitle className="text-base font-semibold text-[var(--fms-text-header)]">
          {title}
        </CardTitle>
        {meta ? <span className="text-xs text-[var(--fms-text-subheading)]">{meta}</span> : null}
      </CardHeader>
      <CardContent className="min-w-0">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Skeleton className="h-full w-full rounded-lg" />
          </div>
        ) : isError ? (
          <p className="flex h-64 items-center justify-center text-sm text-[var(--fms-error-text)]">
            {errorMessage}
          </p>
        ) : isEmpty ? (
          <p className="flex h-64 items-center justify-center text-sm text-[var(--fms-text-subheading)]">
            {emptyMessage}
          </p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}
