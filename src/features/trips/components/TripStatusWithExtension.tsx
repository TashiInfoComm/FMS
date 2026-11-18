import { Badge } from '@/components/ui/badge'
import { tripStatusBadgeClass } from '@/features/trips/lib/trip-form-utils'

export function TripStatusWithExtension({
  status,
  statusCode,
  extensionStatusLabel,
}: {
  status: string
  statusCode?: string
  extensionStatusLabel?: string
}) {
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge className={tripStatusBadgeClass(statusCode || status)}>{status}</Badge>
      {extensionStatusLabel ? (
        <span className="text-xs text-[var(--fms-text-subheading)]">({extensionStatusLabel})</span>
      ) : null}
    </div>
  )
}
