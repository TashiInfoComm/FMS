// Applicant dashboard: a personal welcome, their trip counts, and a notification feed.
import { Ban, CircleCheckBig, Clock, Route, type LucideIcon } from 'lucide-react'
import { useMemo } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ApplicantStatCard,
  type ApplicantStatTone,
} from '@/features/dashboard/components/applicant/ApplicantStatCard'
import { NotificationsPanel } from '@/features/dashboard/components/applicant/NotificationsPanel'
import { useDashboardIdentity } from '@/features/dashboard/hooks/useDashboardIdentity'
import { useDashboardSummary } from '@/features/dashboard/hooks/useDashboardQueries'
import type { DashboardSummary } from '@/features/dashboard/lib/dashboard-api'
import { errorMessageOf } from '@/features/dashboard/lib/dashboard-ui'
import { PageHeader } from '@/shared/components/PageHeader'

type ApplicantTripCard = {
  id: string
  label: string
  value: string
  icon: LucideIcon
  tone: ApplicantStatTone
  caption?: string
}

function tripCardLook(label: string): { icon: LucideIcon; tone: ApplicantStatTone; caption?: string } {
  const text = label.toLowerCase()
  if (text.includes('complet')) {
    return { icon: CircleCheckBig, tone: 'green', caption: 'Finished' }
  }
  if (text.includes('cancel')) {
    return { icon: Ban, tone: 'rose', caption: 'Cancelled' }
  }
  if (text.includes('pending') || text.includes('review')) {
    return { icon: Clock, tone: 'amber', caption: 'Awaiting approval' }
  }
  return { icon: Route, tone: 'blue' }
}

function buildApplicantTripCards(summary: DashboardSummary | undefined): ApplicantTripCard[] {
  if (!summary) return []

  const cards: ApplicantTripCard[] = []

  if (summary.pendingReview !== null) {
    cards.push({
      id: 'pending-review',
      label: 'Pending review',
      value: summary.pendingReview.toLocaleString('en-BT'),
      icon: Clock,
      tone: 'amber',
      caption: 'Awaiting approval',
    })
  }

  for (const slice of summary.tripByStatus) {
    const label = /trip/i.test(slice.label) ? slice.label : `${slice.label} trips`
    const look = tripCardLook(slice.label)
    cards.push({
      id: `trip-${slice.label}`,
      label,
      value: slice.value.toLocaleString('en-BT'),
      icon: look.icon,
      tone: look.tone,
      caption: look.caption,
    })
  }

  return cards
}

export function ApplicantDashboard() {
  const summaryQuery = useDashboardSummary()
  const { firstName } = useDashboardIdentity(summaryQuery.data?.scopeLabel)
  const summaryError = errorMessageOf(summaryQuery.error, 'Could not load dashboard summary.')
  const tripCards = useMemo(
    () => buildApplicantTripCards(summaryQuery.data),
    [summaryQuery.data],
  )

  return (
    <section className="space-y-5">
      <PageHeader
        title={firstName ? `Welcome Back, ${firstName} 👋` : 'Welcome Back 👋'}
        subtitle="Manage your official trips, vehicle requests and travel history."
      />

      {summaryQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-[132px] rounded-2xl" />
          ))}
        </div>
      ) : summaryQuery.isError ? (
        <Card className="rounded-2xl border border-[var(--fms-strokes)] ring-0">
          <CardContent className="py-4 text-sm text-[var(--fms-error-text)]">
            {summaryError}
          </CardContent>
        </Card>
      ) : tripCards.length === 0 ? (
        <Card className="rounded-2xl border border-[var(--fms-strokes)] ring-0">
          <CardContent className="py-4 text-sm text-[var(--fms-text-subheading)]">
            You have no trip activity yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {tripCards.map((card) => (
            <ApplicantStatCard
              key={card.id}
              label={card.label}
              value={card.value}
              icon={card.icon}
              tone={card.tone}
              caption={card.caption}
            />
          ))}
        </div>
      )}

      <NotificationsPanel
        notifications={summaryQuery.data?.notifications ?? []}
        isLoading={summaryQuery.isLoading}
        isError={summaryQuery.isError}
        errorMessage={summaryError}
      />
    </section>
  )
}
