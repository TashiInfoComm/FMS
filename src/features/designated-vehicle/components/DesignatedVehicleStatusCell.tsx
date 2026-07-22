import type { DesignatedVehicleStatus } from '@/features/designated-vehicle/lib/designated-vehicle-types'
import {
  designatedVehicleStatusStyles,
  formatDesignatedVehicleStatusLabel,
} from '@/features/designated-vehicle/lib/designated-vehicle-ui'
import { cn } from '@/lib/utils'

export function DesignatedVehicleStatusCell({ status }: { status: DesignatedVehicleStatus }) {
  const styles = designatedVehicleStatusStyles(status)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium',
        styles.pill,
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', styles.dot)} aria-hidden />
      {formatDesignatedVehicleStatusLabel(status)}
    </span>
  )
}
