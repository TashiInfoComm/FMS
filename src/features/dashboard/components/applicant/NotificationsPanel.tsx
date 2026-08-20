// Informational feed for the applicant dashboard: approvals, assignments and reminders.
import {
  Bell,
  CarFront,
  CircleCheckBig,
  Clock,
  Star,
  type LucideIcon,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DashboardNotification } from '@/features/dashboard/lib/dashboard-api'

/** Kind keyword to icon and tint; the kind is a normalized (alphanumeric-only) string. */
const NOTIFICATION_STYLES: Array<{
  match: RegExp
  icon: LucideIcon
  tile: string
  iconColor: string
}> = [
  { match: /(vehicle|assign)/, icon: CarFront, tile: 'bg-[#eff6ff]', iconColor: 'text-[#1d4ed8]' },
  {
    match: /(approve|complete|confirm)/,
    icon: CircleCheckBig,
    tile: 'bg-[#f0fdf4]',
    iconColor: 'text-[#008236]',
  },
  { match: /(remind|upcoming|schedule)/, icon: Clock, tile: 'bg-[#fffbeb]', iconColor: 'text-[#bb4d00]' },
  { match: /(feedback|rating|rate)/, icon: Star, tile: 'bg-[#eff6ff]', iconColor: 'text-[#1d4ed8]' },
]

function styleForKind(kind: string) {
  return (
    NOTIFICATION_STYLES.find((entry) => entry.match.test(kind)) ?? {
      icon: Bell,
      tile: 'bg-[#eff6ff]',
      iconColor: 'text-[#1d4ed8]',
    }
  )
}

type NotificationsPanelProps = {
  notifications: DashboardNotification[]
  isLoading: boolean
  isError: boolean
  errorMessage: string
}

export function NotificationsPanel({
  notifications,
  isLoading,
  isError,
  errorMessage,
}: NotificationsPanelProps) {
  const unreadCount = notifications.filter((item) => item.isUnread).length

  return (
    <Card className="rounded-2xl border border-[var(--fms-strokes)] ring-0">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base font-semibold text-[var(--fms-text-header)]">
          Notifications
        </CardTitle>
        {!isLoading && !isError && unreadCount > 0 ? (
          <span className="rounded-full bg-[#eff6ff] px-2.5 py-0.5 text-xs font-medium text-[#1d4ed8]">
            {unreadCount} new
          </span>
        ) : null}
      </CardHeader>

      <CardContent className="pt-0">
        {isLoading ? (
          <p className="py-4 text-sm text-[var(--fms-text-subheading)]">Loading notifications…</p>
        ) : isError ? (
          <p className="py-4 text-sm text-[var(--fms-error-text)]">{errorMessage}</p>
        ) : notifications.length === 0 ? (
          <p className="py-4 text-sm text-[var(--fms-text-subheading)]">
            You have no notifications right now.
          </p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {notifications.map((item) => {
              const style = styleForKind(item.kind)
              const Icon = style.icon
              return (
                <li
                  key={item.id}
                  className="flex items-start gap-3 rounded-xl bg-[rgba(239,246,255,0.4)] p-2.5"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${style.tile}`}
                  >
                    <Icon className={`h-4 w-4 ${style.iconColor}`} aria-hidden="true" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-[var(--fms-text-header)]">
                        {item.title}
                      </p>
                      {item.isUnread ? (
                        <span
                          aria-label="Unread"
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--fms-button)]"
                        />
                      ) : null}
                    </div>
                    {item.description ? (
                      <p className="text-xs text-[var(--fms-text-subheading)]">{item.description}</p>
                    ) : null}
                    {item.timeLabel ? (
                      <p className="pt-0.5 text-[11px] text-[var(--fms-text-subheading)] opacity-80">
                        {item.timeLabel}
                      </p>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
