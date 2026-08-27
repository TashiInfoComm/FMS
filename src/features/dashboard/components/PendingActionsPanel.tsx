// Lists items awaiting the signed-in user's review, linking each to its module screen.
import {
  ArrowLeftRight,
  ClipboardList,
  Fuel,
  Route,
  ShieldAlert,
  Siren,
  SquareParking,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DashboardPendingAction } from '@/features/dashboard/lib/dashboard-api'
import { cn } from '@/lib/utils'

/** Kind keyword to icon; the kind is a normalized (alphanumeric-only) string. */
const PENDING_ACTION_ICONS: Array<{ match: RegExp; icon: LucideIcon }> = [
  { match: /(vehicleloan|interagency|lending|loan)/, icon: ArrowLeftRight },
  { match: /emergency/, icon: Siren },
  { match: /(fuel|quota)/, icon: Fuel },
  { match: /(parking|reimburse|claim)/, icon: SquareParking },
  { match: /(workorder|maintenance|repair)/, icon: Wrench },
  { match: /(trip|requisition|journey)/, icon: Route },
  { match: /(offence|offense)/, icon: ShieldAlert },
  { match: /(user|account|driver)/, icon: Users },
]

function iconForKind(kind: string): LucideIcon {
  return PENDING_ACTION_ICONS.find((entry) => entry.match.test(kind))?.icon ?? ClipboardList
}

type PendingActionsPanelProps = {
  actions: DashboardPendingAction[]
  isLoading: boolean
  isError: boolean
  errorMessage?: string
  /** Defaults to `Pending Actions`; the dispatch dashboard calls these approvals. */
  title?: string
  /** `pending` reads `3 pending` in amber, `count` is a bare red total. */
  badge?: 'pending' | 'count'
  className?: string
}

export function PendingActionsPanel({
  actions,
  isLoading,
  isError,
  errorMessage,
  title = 'Pending Actions',
  badge = 'pending',
  className,
}: PendingActionsPanelProps) {
  const navigate = useNavigate()

  const visibleActions = actions.filter((action) => action.count === null || action.count > 0)
  const pendingTotal = visibleActions.reduce((sum, action) => sum + (action.count ?? 1), 0)

  return (
    <Card className={cn('rounded-xl border border-[var(--fms-strokes)] ring-0', className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base font-semibold text-[var(--fms-text-header)]">
          {title}
        </CardTitle>
        {!isLoading && !isError && visibleActions.length > 0 ? (
          badge === 'count' ? (
            <span className="rounded-md bg-[var(--fms-error-fill)] px-2.5 py-0.5 text-xs font-semibold text-[var(--fms-error-text)]">
              {pendingTotal}
            </span>
          ) : (
            <span className="rounded-full bg-[var(--fms-warning-fill)] px-2.5 py-1 text-xs font-medium text-[#9a6700]">
              {pendingTotal} pending
            </span>
          )
        ) : null}
      </CardHeader>

      <CardContent className="pt-0">
        {isLoading ? (
          <p className="py-4 text-sm text-[var(--fms-text-subheading)]">Loading pending actions…</p>
        ) : isError ? (
          <p className="py-4 text-sm text-[var(--fms-error-text)]">
            {errorMessage ?? 'Could not load pending actions.'}
          </p>
        ) : visibleActions.length === 0 ? (
          <p className="py-4 text-sm text-[var(--fms-text-subheading)]">
            Nothing needs your attention right now.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--fms-strokes)]">
            {visibleActions.map((action) => {
              const Icon = iconForKind(action.kind)
              return (
                <li
                  key={action.id}
                  className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--fms-info-fill)]">
                      <Icon className="h-4 w-4 text-[var(--fms-info-text)]" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--fms-text-header)]">
                        {action.title}
                        {action.count !== null ? (
                          <span className="ml-1.5 text-[var(--fms-text-subheading)]">
                            ({action.count})
                          </span>
                        ) : null}
                      </p>
                      {action.description ? (
                        <p className="text-xs text-[var(--fms-text-subheading)]">
                          {action.description}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    className="shrink-0 self-start bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)] sm:self-auto"
                    disabled={!action.href}
                    onClick={() => {
                      if (action.href) navigate(action.href)
                    }}
                  >
                    Review
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
