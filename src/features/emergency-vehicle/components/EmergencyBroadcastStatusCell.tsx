import type { EmergencyBroadcastStatus } from '@/features/emergency-vehicle/lib/emergency-broadcast-types'
import {
  emergencyBroadcastStatusStyles,
  formatEmergencyBroadcastStatusLabel,
} from '@/features/emergency-vehicle/lib/emergency-broadcast-ui'
import { cn } from '@/lib/utils'

export function EmergencyBroadcastStatusCell({
  status,
  statusLabel,
}: {
  status: EmergencyBroadcastStatus
  statusLabel?: string
}) {
  const styles = emergencyBroadcastStatusStyles(status)
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
        styles.pill,
      )}
    >
      {formatEmergencyBroadcastStatusLabel(status, statusLabel)}
    </span>
  )
}
