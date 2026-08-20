import { Search } from 'lucide-react'
import type { ReactNode } from 'react'

import { Input } from '@/components/ui/input'
import {
  ReportDateRangeFilters,
  ReportOrgFilters,
} from '@/features/reports/components/ReportCommonFilters'
import type { ReportOrgFilterValues } from '@/features/reports/lib/report-common-filters'
import { cn } from '@/lib/utils'

type ReportTableToolbarProps = {
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  searchAriaLabel?: string
  fromDate: string
  toDate: string
  org: ReportOrgFilterValues
  onFromDateChange: (value: string) => void
  onToDateChange: (value: string) => void
  onOrgChange: (next: Partial<ReportOrgFilterValues>) => void
  showAgency: boolean
  /** Page-specific filters (e.g. status) rendered on the first row after dates. */
  extraFilters?: ReactNode
  className?: string
}

/**
 * Report list toolbar: row 1 = search + date range (+ extras); row 2 = organogram filters.
 */
export function ReportTableToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search...',
  searchAriaLabel = 'Search reports',
  fromDate,
  toDate,
  org,
  onFromDateChange,
  onToDateChange,
  onOrgChange,
  showAgency,
  extraFilters,
  className,
}: ReportTableToolbarProps) {
  return (
    <div className={cn('flex w-full min-w-0 flex-col gap-2', className)}>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm lg:shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fms-text-subheading)]" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 pl-9"
            aria-label={searchAriaLabel}
          />
        </div>

        <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <ReportDateRangeFilters
            fromDate={fromDate}
            toDate={toDate}
            onFromDateChange={onFromDateChange}
            onToDateChange={onToDateChange}
          />
          {extraFilters}
        </div>
      </div>

      {showAgency ? <ReportOrgFilters org={org} onOrgChange={onOrgChange} /> : null}
    </div>
  )
}
