import type { DriverOffenceStatus } from '@/features/driver-offence/lib/driver-offence-types'
import {
  driverOffenceStatusStyles,
  formatDriverOffenceStatusLabel,
} from '@/features/driver-offence/lib/driver-offence-ui'
import { cn } from '@/lib/utils'

export function DriverOffenceStatusCell({ status }: { status: DriverOffenceStatus }) {
  const styles = driverOffenceStatusStyles(status)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium',
        styles.pill,
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', styles.dot)} aria-hidden />
      {formatDriverOffenceStatusLabel(status)}
    </span>
  )
}
