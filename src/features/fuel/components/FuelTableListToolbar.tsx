import type { ReactNode } from 'react'

import { FuelTableListSearch } from '@/features/fuel/components/FuelTableListSearch'
import { cn } from '@/lib/utils'

type FuelTableListToolbarProps = {
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder: string
  searchAriaLabel: string
  leading?: ReactNode
  className?: string
}

export function FuelTableListToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  searchAriaLabel,
  leading,
  className,
}: FuelTableListToolbarProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 sm:flex-row sm:items-center',
        leading ? 'sm:justify-end' : 'sm:justify-end',
        className,
      )}
    >
      {leading ? (
        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {leading}
        </div>
      ) : null}
      <FuelTableListSearch
        value={search}
        onValueChange={onSearchChange}
        placeholder={searchPlaceholder}
        ariaLabel={searchAriaLabel}
        className="w-full justify-end sm:max-w-sm sm:shrink-0"
      />
    </div>
  )
}
