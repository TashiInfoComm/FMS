import type { ReactNode } from 'react'

import { Label } from '@/components/ui/label'
import { SearchableAutocomplete } from '@/shared/components/SearchableAutocomplete'

import type { MasterOption } from '@/features/vehicles/lib/vehicle-create-master-data'

export type MasterDataSelectProps = {
  id: string
  label: ReactNode
  placeholder?: string
  options: MasterOption[]
  value: string
  disabled?: boolean
  loading?: boolean
  error?: boolean
  errorMessage?: string
  onValueChange: (value: string) => void
  side?: 'top' | 'bottom'
}

/** Single-select for vehicle create master-data lists with searchable options. */
export function MasterDataSelect({
  id,
  label,
  placeholder = 'Select…',
  options,
  value,
  disabled = false,
  loading = false,
  error = false,
  errorMessage,
  onValueChange,
  side = 'bottom',
}: MasterDataSelectProps) {
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <SearchableAutocomplete
        id={id}
        value={value}
        onChange={onValueChange}
        options={options}
        disabled={disabled}
        loading={loading}
        error={error}
        placeholder={loading ? 'Loading…' : placeholder}
        searchPlaceholder="Type to search…"
        side={side}
      />
      {errorMessage ? (
        <p className="text-xs font-normal text-[var(--fms-error-text)]">{errorMessage}</p>
      ) : null}
    </div>
  )
}
