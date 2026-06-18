import { useEffect, useMemo, useRef, useState } from 'react'
import { DismissableLayerBranch } from '@radix-ui/react-dismissable-layer'
import { Check, ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import {
  filterOptions,
  useModalScrollableList,
  type SearchableAutocompleteOption,
} from '@/shared/components/SearchableAutocomplete'

export type SearchableMultiAutocompleteProps = {
  id?: string
  value: string[]
  onChange: (value: string[]) => void
  options: SearchableAutocompleteOption[]
  loading?: boolean
  disabled?: boolean
  error?: boolean
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  loadingMessage?: string
  formatTriggerLabel?: (selected: string[], options: SearchableAutocompleteOption[]) => string
  side?: 'top' | 'bottom'
  className?: string
}

function defaultTriggerLabel(
  selected: string[],
  placeholder: string,
  options: SearchableAutocompleteOption[],
) {
  if (selected.length === 0) return placeholder
  if (selected.length === 1) {
    return options.find((o) => o.value === selected[0])?.label ?? selected[0]
  }
  return `${selected.length} selected`
}

/** Multi-select dropdown with search and scrollable checkbox options (works inside dialogs). */
export function SearchableMultiAutocomplete({
  id,
  value,
  onChange,
  options,
  loading = false,
  disabled = false,
  error = false,
  placeholder = 'Search and select…',
  searchPlaceholder = 'Type to search…',
  emptyMessage = 'No options found.',
  loadingMessage = 'Loading…',
  formatTriggerLabel,
  side = 'bottom',
  className,
}: SearchableMultiAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  useModalScrollableList(listRef, open)

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      searchInputRef.current?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (containerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return
      }
      setOpen(false)
      setQuery('')
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const filtered = useMemo(() => filterOptions(options, query), [options, query])

  const triggerLabel = loading
    ? loadingMessage
    : (formatTriggerLabel?.(value, options) ??
      defaultTriggerLabel(value, placeholder, options))

  const toggleValue = (optionValue: string) => {
    onChange(
      value.includes(optionValue)
        ? value.filter((item) => item !== optionValue)
        : [...value, optionValue],
    )
  }

  const busy = disabled || loading
  const searchDisabled = disabled

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Button
        id={id}
        type="button"
        variant="outline"
        disabled={busy}
        className={cn(
          'h-8 w-full justify-between font-normal',
          error && 'border-[var(--fms-delete)]',
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-invalid={error ? true : undefined}
        onClick={() => {
          if (busy) return
          setOpen((prev) => !prev)
        }}
      >
        <span className={cn('truncate text-left', value.length === 0 && 'text-muted-foreground')}>
          {triggerLabel}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {open ? (
        <DismissableLayerBranch>
          <div
            ref={panelRef}
            role="listbox"
            aria-multiselectable
            data-searchable-autocomplete-panel=""
            className={cn(
              'absolute left-0 right-0 z-[100] overflow-hidden rounded-xl border border-[var(--fms-strokes)] bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10',
              side === 'top' ? 'bottom-full mb-1' : 'top-full mt-1',
            )}
          >
            <div className="border-b border-[var(--fms-strokes)] p-2">
              <Input
                ref={searchInputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                autoFocus
                disabled={searchDisabled}
              />
            </div>
            <div
              ref={listRef}
              className="max-h-52 overflow-y-auto overscroll-contain p-1"
            >
              {loading ? (
                <p className="px-2 py-3 text-sm text-[var(--fms-text-subheading)]">
                  {loadingMessage}
                </p>
              ) : filtered.length === 0 ? (
                <p className="px-2 py-3 text-sm text-[var(--fms-text-subheading)]">
                  {emptyMessage}
                </p>
              ) : (
                filtered.map((option) => {
                  const isSelected = value.includes(option.value)
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={cn(
                        'flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-[#f6f6f7]',
                        isSelected && 'bg-[#f6f6f7]',
                      )}
                      onPointerDown={(event) => {
                        event.preventDefault()
                        toggleValue(option.value)
                      }}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[var(--fms-strokes)]',
                          isSelected && 'border-[var(--fms-button)] bg-[var(--fms-button)]',
                        )}
                      >
                        {isSelected ? (
                          <Check className="h-3 w-3 text-white" aria-hidden />
                        ) : null}
                      </span>
                      <span className="min-w-0 font-medium text-[var(--fms-text-header)]">
                        {option.label}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </DismissableLayerBranch>
      ) : null}
    </div>
  )
}
