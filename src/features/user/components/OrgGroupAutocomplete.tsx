import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import type { AdminGroupNode } from '@/features/user/lib/groups-api'

export type OrgGroupAutocompleteProps = {
  label: ReactNode
  options: AdminGroupNode[]
  selectedId: string
  selectedName: string
  locked: boolean
  disabled: boolean
  placeholder?: string
  onSelect: (id: string, name: string) => void
}

/** Searchable dropdown for one tier of `GET /public/groups`; locked tiers render read-only. */
export function OrgGroupAutocomplete({
  label,
  options,
  selectedId,
  selectedName,
  locked,
  disabled,
  placeholder = 'Search…',
  onSelect,
}: OrgGroupAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => {
    if (locked || selectedId) setQ(selectedName || '')
  }, [locked, selectedId, selectedName])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const base = needle ? options.filter((o) => o.name.toLowerCase().includes(needle)) : options
    return base.slice(0, 80)
  }, [options, q])

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
      <div className="relative">
        <Input
          value={q}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 180)
          }}
        />
        {open && !disabled && filtered.length > 0 ? (
          <ul
            role="listbox"
            className="absolute left-0 right-0 z-50 mt-1 max-h-52 overflow-auto rounded-md border border-[var(--fms-strokes)] bg-white py-1 shadow-md"
          >
            {filtered.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  role="option"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--fms-info-fill)]"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onSelect(o.id, o.name)
                    setQ(o.name)
                    setOpen(false)
                  }}
                >
                  {o.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
