import type { ReactNode } from 'react'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type { MasterOption } from '@/features/vehicles/lib/vehicle-create-master-data'

export type MasterDataSelectProps = {
  id: string
  label: ReactNode
  placeholder?: string
  options: MasterOption[]
  value: string
  disabled?: boolean
  loading?: boolean
  onValueChange: (value: string) => void
}

/** Single-select for vehicle create master-data lists (scrollable Select). */
export function MasterDataSelect({
  id,
  label,
  placeholder = 'Select…',
  options,
  value,
  disabled = false,
  loading = false,
  onValueChange,
}: MasterDataSelectProps) {
  const busy = disabled || loading

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value || undefined}
        onValueChange={onValueChange}
        disabled={busy}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={loading ? 'Loading…' : placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={`${o.value}-${o.label}`} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
