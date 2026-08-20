import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { Input } from '@/components/ui/input'
import { fetchReportAgencyOptions } from '@/features/reports/lib/report-agency-api'
import type { ReportOrgFilterValues } from '@/features/reports/lib/report-common-filters'
import {
  fetchAdminDepartmentGroupNodes,
  fetchAdminDivisionGroupNodes,
  fetchAdminSubDivisionGroupNodes,
} from '@/features/vehicles/lib/vehicle-agency-assignment-api'
import { SearchableAutocomplete } from '@/shared/components/SearchableAutocomplete'
import { cn } from '@/lib/utils'

export type ReportDateRangeFiltersProps = {
  fromDate: string
  toDate: string
  onFromDateChange: (value: string) => void
  onToDateChange: (value: string) => void
  className?: string
  fromDateId?: string
  toDateId?: string
}

export type ReportOrgFiltersProps = {
  org: ReportOrgFilterValues
  onOrgChange: (next: Partial<ReportOrgFilterValues>) => void
  className?: string
}

export type ReportCommonFiltersProps = ReportDateRangeFiltersProps &
  ReportOrgFiltersProps & {
    /** When false (MTO / non–highest-admin), organogram selects are not rendered. */
    showAgency: boolean
  }

const ORG_ALL = 'all'

function orgNodesToOptions(
  nodes: { id: string; name: string; code?: string | null }[],
  allLabel: string,
) {
  return [
    { value: ORG_ALL, label: allLabel, searchText: 'all' },
    ...nodes.map((node) => ({
      value: node.id,
      label: node.name,
      searchText: [node.name, node.code, node.id].filter(Boolean).join(' '),
    })),
  ]
}

/** From / To date inputs for report pages. */
export function ReportDateRangeFilters({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  className,
  fromDateId = 'report-from-date',
  toDateId = 'report-to-date',
}: ReportDateRangeFiltersProps) {
  return (
    <div
      className={cn(
        'flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5 sm:w-auto">
        <label
          htmlFor={fromDateId}
          className="shrink-0 text-xs text-[var(--fms-text-subheading)]"
        >
          From
        </label>
        <Input
          id={fromDateId}
          type="date"
          value={fromDate}
          max={toDate || undefined}
          onChange={(event) => onFromDateChange(event.target.value)}
          className="h-8 w-full sm:w-[150px]"
          aria-label="From date"
        />
      </div>

      <div className="flex min-w-0 items-center gap-1.5 sm:w-auto">
        <label
          htmlFor={toDateId}
          className="shrink-0 text-xs text-[var(--fms-text-subheading)]"
        >
          To
        </label>
        <Input
          id={toDateId}
          type="date"
          value={toDate}
          min={fromDate || undefined}
          onChange={(event) => onToDateChange(event.target.value)}
          className="h-8 w-full sm:w-[150px]"
          aria-label="To date"
        />
      </div>
    </div>
  )
}

/** Cascading Agency → Department → Division → Sub-division filters. */
export function ReportOrgFilters({ org, onOrgChange, className }: ReportOrgFiltersProps) {
  const agenciesQuery = useQuery({
    queryKey: ['report-agency-options'],
    queryFn: fetchReportAgencyOptions,
    staleTime: 60_000,
  })

  const departmentsQuery = useQuery({
    queryKey: ['report-department-options', org.agencyCode, org.agencyId],
    queryFn: () => fetchAdminDepartmentGroupNodes(org.agencyCode, org.agencyId),
    enabled: Boolean(org.agencyId && org.agencyCode),
    staleTime: 60_000,
  })

  const divisionsQuery = useQuery({
    queryKey: ['report-division-options', org.departmentCode, org.departmentId],
    queryFn: () => fetchAdminDivisionGroupNodes(org.departmentCode, org.departmentId),
    enabled: Boolean(org.departmentId && org.departmentCode),
    staleTime: 60_000,
  })

  const subDivisionsQuery = useQuery({
    queryKey: ['report-sub-division-options', org.divisionCode, org.divisionId],
    queryFn: () => fetchAdminSubDivisionGroupNodes(org.divisionCode, org.divisionId),
    enabled: Boolean(org.divisionId && org.divisionCode),
    staleTime: 60_000,
  })

  const agencyOptions = useMemo(
    () => [
      {
        value: ORG_ALL,
        label: 'Agency: All',
        searchText: 'all agencies',
      },
      ...(agenciesQuery.data ?? []).map((option) => ({
        value: option.value,
        label: option.label,
        searchText: option.searchText ?? option.label,
      })),
    ],
    [agenciesQuery.data],
  )

  const departmentOptions = useMemo(
    () => orgNodesToOptions(departmentsQuery.data ?? [], 'Department: All'),
    [departmentsQuery.data],
  )

  const divisionOptions = useMemo(
    () => orgNodesToOptions(divisionsQuery.data ?? [], 'Division: All'),
    [divisionsQuery.data],
  )

  const subDivisionOptions = useMemo(
    () => orgNodesToOptions(subDivisionsQuery.data ?? [], 'Sub-division: All'),
    [subDivisionsQuery.data],
  )

  const handleAgencyChange = (next: string) => {
    if (next === ORG_ALL) {
      onOrgChange({
        agencyId: '',
        agencyCode: '',
        departmentId: '',
        departmentCode: '',
        divisionId: '',
        divisionCode: '',
        subDivisionId: '',
      })
      return
    }

    const selected = agenciesQuery.data?.find((option) => option.value === next)
    onOrgChange({
      agencyId: next,
      agencyCode: selected?.code ?? '',
      departmentId: '',
      departmentCode: '',
      divisionId: '',
      divisionCode: '',
      subDivisionId: '',
    })
  }

  const handleDepartmentChange = (next: string) => {
    if (next === ORG_ALL) {
      onOrgChange({
        departmentId: '',
        departmentCode: '',
        divisionId: '',
        divisionCode: '',
        subDivisionId: '',
      })
      return
    }

    const selected = departmentsQuery.data?.find((node) => node.id === next)
    onOrgChange({
      departmentId: next,
      departmentCode: selected?.code ?? '',
      divisionId: '',
      divisionCode: '',
      subDivisionId: '',
    })
  }

  const handleDivisionChange = (next: string) => {
    if (next === ORG_ALL) {
      onOrgChange({
        divisionId: '',
        divisionCode: '',
        subDivisionId: '',
      })
      return
    }

    const selected = divisionsQuery.data?.find((node) => node.id === next)
    onOrgChange({
      divisionId: next,
      divisionCode: selected?.code ?? '',
      subDivisionId: '',
    })
  }

  const handleSubDivisionChange = (next: string) => {
    onOrgChange({
      subDivisionId: next === ORG_ALL ? '' : next,
    })
  }

  return (
    <div
      className={cn(
        'flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center',
        className,
      )}
    >
      <SearchableAutocomplete
        id="report-agency-filter"
        value={org.agencyId || ORG_ALL}
        onChange={handleAgencyChange}
        options={agencyOptions}
        loading={agenciesQuery.isLoading}
        placeholder="Agency: All"
        searchPlaceholder="Search agency…"
        emptyMessage="No matching agency."
        loadingMessage="Loading agencies…"
        className="w-full sm:w-[220px]"
      />

      <SearchableAutocomplete
        id="report-department-filter"
        value={org.departmentId || ORG_ALL}
        onChange={handleDepartmentChange}
        options={departmentOptions}
        loading={departmentsQuery.isLoading}
        disabled={!org.agencyId}
        placeholder="Department: All"
        searchPlaceholder="Search department…"
        emptyMessage="No matching department."
        loadingMessage="Loading departments…"
        className="w-full sm:w-[220px]"
      />

      <SearchableAutocomplete
        id="report-division-filter"
        value={org.divisionId || ORG_ALL}
        onChange={handleDivisionChange}
        options={divisionOptions}
        loading={divisionsQuery.isLoading}
        disabled={!org.departmentId}
        placeholder="Division: All"
        searchPlaceholder="Search division…"
        emptyMessage="No matching division."
        loadingMessage="Loading divisions…"
        className="w-full sm:w-[220px]"
      />

      <SearchableAutocomplete
        id="report-sub-division-filter"
        value={org.subDivisionId || ORG_ALL}
        onChange={handleSubDivisionChange}
        options={subDivisionOptions}
        loading={subDivisionsQuery.isLoading}
        disabled={!org.divisionId}
        placeholder="Sub-division: All"
        searchPlaceholder="Search sub-division…"
        emptyMessage="No matching sub-division."
        loadingMessage="Loading sub-divisions…"
        className="w-full sm:w-[220px]"
      />
    </div>
  )
}

/**
 * Shared report filters: From Date, To Date, and cascading Agency → Department → Division → Sub-division.
 * Use with `useReportCommonFilters` on every report page.
 */
export function ReportCommonFilters({
  fromDate,
  toDate,
  org,
  onFromDateChange,
  onToDateChange,
  onOrgChange,
  showAgency,
  className,
  fromDateId,
  toDateId,
}: ReportCommonFiltersProps) {
  return (
    <div className={cn('flex w-full min-w-0 flex-col gap-2', className)}>
      <ReportDateRangeFilters
        fromDate={fromDate}
        toDate={toDate}
        onFromDateChange={onFromDateChange}
        onToDateChange={onToDateChange}
        fromDateId={fromDateId}
        toDateId={toDateId}
      />
      {showAgency ? <ReportOrgFilters org={org} onOrgChange={onOrgChange} /> : null}
    </div>
  )
}
