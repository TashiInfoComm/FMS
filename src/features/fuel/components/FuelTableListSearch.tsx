import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type FuelTableListSearchProps = {
  value: string
  onValueChange: (value: string) => void
  placeholder: string
  ariaLabel: string
  className?: string
}

export function FuelTableListSearch({
  value,
  onValueChange,
  placeholder,
  ariaLabel,
  className,
}: FuelTableListSearchProps) {
  return (
    <div className={cn('relative w-full', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fms-text-subheading)]" />
      <Input
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        className="h-8 pl-9"
        aria-label={ariaLabel}
      />
    </div>
  )
}
