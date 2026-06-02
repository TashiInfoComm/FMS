import type { ReactNode } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableAutocomplete } from '@/shared/components/SearchableAutocomplete'

import type { AdminGroupNode } from '@/features/user/lib/groups-api'

export type OrgGroupSelectProps = {
  label: ReactNode
  options: AdminGroupNode[]
  selectedId: string
  selectedName: string
  locked: boolean
  disabled: boolean
  placeholder?: string
  onSelect: (id: string, name: string) => void
}

/** Org tier picker backed by `GET /public/groups`; locked tiers render read-only. */
export function OrgGroupSelect({
  label,
  options,
  selectedId,
  selectedName,
  locked,
  disabled,
  placeholder = 'Select…',
  onSelect,
}: OrgGroupSelectProps) {
  if (locked) {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <Input readOnly value={selectedName || '—'} disabled={disabled} className="bg-[#fafafa]" />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <SearchableAutocomplete
        value={selectedId}
        onChange={(id) => {
          const next = options.find((o) => o.id === id)
          if (next) onSelect(next.id, next.name)
        }}
        options={options.map((o) => ({ value: o.id, label: o.name, searchText: o.id }))}
        disabled={disabled}
        placeholder={placeholder}
        searchPlaceholder="Type to search…"
      />
    </div>
  )
}
