import { VEHICLE_DESIGNATED_TYPE_OPTIONS } from '@/features/designated-vehicle/lib/designated-vehicle-types'
import { SearchableAutocomplete } from '@/shared/components/SearchableAutocomplete'

const OPTIONS = [
  { value: '', label: 'All Types', searchText: 'all types' },
  ...VEHICLE_DESIGNATED_TYPE_OPTIONS,
]

type DesignatedTypeListFilterProps = {
  value: string
  onChange: (value: string) => void
}

export function DesignatedTypeListFilter({ value, onChange }: DesignatedTypeListFilterProps) {
  return (
    <SearchableAutocomplete
      value={value}
      onChange={onChange}
      options={OPTIONS}
      placeholder="All designated types"
      searchPlaceholder="Search designated type…"
      className="w-full sm:w-[220px] [&_button]:h-8"
    />
  )
}
