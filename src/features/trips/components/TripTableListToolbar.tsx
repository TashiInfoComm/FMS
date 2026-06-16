import { FuelTableListSearch } from '@/features/fuel/components/FuelTableListSearch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { TripMasterOption } from '@/features/trips/lib/trip-requisition-masters'

const TRIP_TYPE_FILTER_ALL = '__all_trip_types__'

type TripTypeFilterSelectProps = {
  value: string
  onValueChange: (tripTypeId: string) => void
  options: TripMasterOption[]
  loading?: boolean
}

function TripTypeFilterSelect({
  value,
  onValueChange,
  options,
  loading,
}: TripTypeFilterSelectProps) {
  const selectValue = value.trim() === '' ? TRIP_TYPE_FILTER_ALL : value.trim()

  return (
    <Select
      value={selectValue}
      onValueChange={(next) =>
        onValueChange(next === TRIP_TYPE_FILTER_ALL ? '' : next)
      }
      disabled={loading}
    >
      <SelectTrigger className="w-full sm:w-[220px]">
        <SelectValue placeholder={loading ? 'Loading trip types…' : 'All trip types'} />
      </SelectTrigger>
      <SelectContent align="start">
        <SelectItem value={TRIP_TYPE_FILTER_ALL}>All trip types</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

type TripTableListToolbarProps = {
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder: string
  searchAriaLabel: string
  tripTypeId: string
  onTripTypeIdChange: (tripTypeId: string) => void
  tripTypeOptions: TripMasterOption[]
  tripTypesLoading?: boolean
}

export function TripTableListToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  searchAriaLabel,
  tripTypeId,
  onTripTypeIdChange,
  tripTypeOptions,
  tripTypesLoading,
}: TripTableListToolbarProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
      <TripTypeFilterSelect
        value={tripTypeId}
        onValueChange={onTripTypeIdChange}
        options={tripTypeOptions}
        loading={tripTypesLoading}
      />
      <FuelTableListSearch
        value={search}
        onValueChange={onSearchChange}
        placeholder={searchPlaceholder}
        ariaLabel={searchAriaLabel}
        className="w-full sm:max-w-sm sm:shrink-0"
      />
    </div>
  )
}
