import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { DismissableLayerBranch } from '@radix-ui/react-dismissable-layer'
import { ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type SearchableAutocompleteOption = {
  value: string
  label: string
  description?: string
  /** Extra text included when filtering (e.g. raw API id). */
  searchText?: string
  /** Optional stable key when value alone is not unique. */
  key?: string
}

export type SearchableAutocompleteProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  options: SearchableAutocompleteOption[]
  loading?: boolean
  disabled?: boolean
  error?: boolean
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  loadingMessage?: string
  /** Open panel above the trigger (useful near the bottom of dialogs). */
  side?: 'top' | 'bottom'
  className?: string
}

export function filterOptions(options: SearchableAutocompleteOption[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return options
  return options.filter((option) => {
    const haystack = [option.label, option.description, option.searchText, option.value]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}

/** Portaled dropdown panels use this attribute so dialogs allow focus and pointer events. */
export const SEARCHABLE_AUTOCOMPLETE_PANEL_SELECTOR = '[data-searchable-autocomplete-panel]'

/** Radix dialog sets body pointer-events:none; keep portaled panel interactive and scrollable. */
export function useModalScrollableList(
  listRef: RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return

    let cleanup: (() => void) | undefined
    const attach = () => {
      cleanup?.()
      const el = listRef.current
      if (!el) return

      const onWheel = (event: WheelEvent) => {
        if (!el.contains(event.target as Node)) return
        event.stopPropagation()
        if (el.scrollHeight <= el.clientHeight) return
        event.preventDefault()
        el.scrollTop += event.deltaY
      }

      el.addEventListener('wheel', onWheel, { passive: false })
      cleanup = () => el.removeEventListener('wheel', onWheel)
    }

    attach()
    const frame = requestAnimationFrame(attach)
    return () => {
      cancelAnimationFrame(frame)
      cleanup?.()
    }
  }, [enabled, listRef])
}

const AUTOCOMPLETE_PANEL_Z_INDEX = '200'

/**
 * Place the menu on document.body with fixed coordinates so cards and page
 * shells that use overflow:hidden cannot clip the option list.
 */
export function useAnchoredAutocompletePanel(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  side: 'top' | 'bottom',
) {
  useLayoutEffect(() => {
    if (!open) return

    const update = () => {
      const anchor = anchorRef.current
      const panel = panelRef.current
      if (!anchor || !panel) return

      const rect = anchor.getBoundingClientRect()
      const gap = 4
      const margin = 8
      const spaceBelow = window.innerHeight - rect.bottom - gap - margin
      const spaceAbove = rect.top - gap - margin
      const placeAbove =
        side === 'top'
          ? spaceAbove >= 96 || spaceAbove >= spaceBelow
          : spaceBelow < 160 && spaceAbove > spaceBelow
      const width = Math.max(rect.width, 180)
      const maxWidth = window.innerWidth - margin * 2
      const panelWidth = Math.min(width, maxWidth)
      let left = rect.left
      if (left + panelWidth > window.innerWidth - margin) {
        left = Math.max(margin, window.innerWidth - margin - panelWidth)
      }

      panel.style.position = 'fixed'
      panel.style.zIndex = AUTOCOMPLETE_PANEL_Z_INDEX
      panel.style.left = `${left}px`
      panel.style.width = `${panelWidth}px`
      panel.style.right = 'auto'
      panel.style.pointerEvents = 'auto'
      if (placeAbove) {
        panel.style.top = 'auto'
        panel.style.bottom = `${window.innerHeight - rect.top + gap}px`
      } else {
        panel.style.bottom = 'auto'
        panel.style.top = `${rect.bottom + gap}px`
      }
    }

    update()
    const frame = requestAnimationFrame(update)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, side, anchorRef, panelRef])
}

export function autocompletePanelClassName(className?: string) {
  return cn(
    'pointer-events-auto fixed z-[200] overflow-hidden rounded-xl border border-[var(--fms-strokes)] bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10',
    className,
  )
}

/** Single-select dropdown with inline search and scrollable options (works inside dialogs). */
export function SearchableAutocomplete({
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
  side = 'bottom',
  className,
}: SearchableAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  useModalScrollableList(listRef, open)
  useAnchoredAutocompletePanel(open, containerRef, panelRef, side)

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

  const selected = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  )

  const busy = disabled || loading
  const searchDisabled = disabled
  const triggerLabel = selected?.label ?? (busy ? loadingMessage : placeholder)

  const closeDropdown = () => {
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={containerRef} className={cn('relative min-w-0 max-w-full', className)}>
      <Button
        id={id}
        type="button"
        variant="outline"
        disabled={busy}
        className={cn(
          'h-8 w-full min-w-0 max-w-full justify-between font-normal',
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
        <span
          className={cn(
            'block min-w-0 flex-1 truncate text-left',
            !selected && !value.trim() && 'text-muted-foreground',
          )}
        >
          {loading ? loadingMessage : triggerLabel}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {open
        ? createPortal(
        <DismissableLayerBranch>
          <div
            ref={panelRef}
            role="listbox"
            data-searchable-autocomplete-panel=""
            className={autocompletePanelClassName()}
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
                filtered.map((option, index) => {
                  const isSelected = option.value === value
                  return (
                    <button
                      key={option.key ?? `${option.value}-${index}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={cn(
                        'flex w-full flex-col rounded-md px-2 py-2 text-left text-sm hover:bg-[#f6f6f7]',
                        isSelected && 'bg-[#f6f6f7]',
                      )}
                      onPointerDown={(event) => {
                        event.preventDefault()
                        onChange(option.value)
                        closeDropdown()
                      }}
                    >
                      <span className="font-medium text-[var(--fms-text-header)]">
                        {option.label}
                      </span>
                      {option.description ? (
                        <span className="text-xs text-[var(--fms-text-subheading)]">
                          {option.description}
                        </span>
                      ) : null}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </DismissableLayerBranch>,
        document.body,
      )
        : null}
    </div>
  )
}
