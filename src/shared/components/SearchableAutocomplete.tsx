import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
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
  /** Open panel above the trigger (useful in scrollable dialogs). */
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

const PANEL_GAP_PX = 4
/** Above dialog overlay/content (z-50) so lists are not clipped by modal overflow. */
const PANEL_Z_INDEX = 100

export function useFloatingPanelPosition(
  anchorRef: RefObject<HTMLElement | null>,
  open: boolean,
  side: 'top' | 'bottom',
) {
  const [style, setStyle] = useState<CSSProperties>({})

  const update = useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()

    if (side === 'top') {
      setStyle({
        position: 'fixed',
        left: rect.left,
        width: rect.width,
        bottom: window.innerHeight - rect.top + PANEL_GAP_PX,
        zIndex: PANEL_Z_INDEX,
        pointerEvents: 'auto',
      })
      return
    }
    setStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      top: rect.bottom + PANEL_GAP_PX,
      zIndex: PANEL_Z_INDEX,
      pointerEvents: 'auto',
    })
  }, [anchorRef, side])

  useEffect(() => {
    if (!open) return
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, update])

  return style
}

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
  const panelStyle = useFloatingPanelPosition(containerRef, open, side)
  useModalScrollableList(listRef, open)

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

  const triggerLabel = selected?.label ?? (value.trim() ? value : placeholder)

  const closeDropdown = () => {
    setOpen(false)
    setQuery('')
  }

  const busy = disabled || loading

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
                style={panelStyle}
                className="pointer-events-auto overflow-hidden rounded-xl border border-[var(--fms-strokes)] bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10"
              >
                <div className="border-b border-[var(--fms-strokes)] p-2">
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={searchPlaceholder}
                    autoFocus
                    disabled={busy}
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
                      const isSelected = option.value === value
                      return (
                        <button
                          key={option.value}
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
