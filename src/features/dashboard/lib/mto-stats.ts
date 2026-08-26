// Turns the nested MTO fields on `/dashboard/summary` into the cards that layout shows.
import {
  Ban,
  CarFront,
  CircleCheckBig,
  Clock,
  Compass,
  Fuel,
  Siren,
  SquareParking,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

import {
  formatNuExact,
  type DashboardPendingAction,
  type DashboardSlice,
  type DashboardSummary,
} from '@/features/dashboard/lib/dashboard-api'

export type MtoStatItem = {
  id: string
  label: string
  value: string
  icon: LucideIcon
  accent: string
}

function countCard(
  id: string,
  slice: DashboardSlice,
  look: { icon: LucideIcon; accent: string },
): MtoStatItem {
  return {
    id,
    label: slice.label,
    value: slice.value.toLocaleString('en-BT'),
    icon: look.icon,
    accent: look.accent,
  }
}

function tripIcon(label: string): { icon: LucideIcon; accent: string } {
  const text = label.toLowerCase()
  if (text.includes('complet')) return { icon: CircleCheckBig, accent: '#16a34a' }
  if (text.includes('reject')) return { icon: Ban, accent: '#f43f5e' }
  if (text.includes('cancel')) return { icon: Ban, accent: '#94a3b8' }
  if (text.includes('pending') || text.includes('review') || text.includes('plan')) {
    return { icon: Clock, accent: '#f59e0b' }
  }
  return { icon: Compass, accent: '#3b82f6' }
}

function maybeCount(
  items: MtoStatItem[],
  id: string,
  label: string,
  value: number | null,
  look: { icon: LucideIcon; accent: string },
) {
  if (value === null) return
  items.push(countCard(id, { label, value }, look))
}

/** Pending queues (named by service), trip statuses, parking amount, fleet mix, deployments. */
export function buildMtoStatItems(summary: DashboardSummary | undefined): MtoStatItem[] {
  if (!summary) return []

  const items: MtoStatItem[] = []

  maybeCount(items, 'trips-pending-review', 'Trips pending review', summary.pendingReview, {
    icon: Clock,
    accent: '#f59e0b',
  })
  maybeCount(
    items,
    'parking-pending-approval',
    'Parking pending approval',
    summary.parkingPendingApproval,
    { icon: SquareParking, accent: '#f59e0b' },
  )
  maybeCount(
    items,
    'maintenance-pending-mto-approval',
    'Maintenance pending MTO approval',
    summary.pendingMtoApproval,
    { icon: Wrench, accent: '#f59e0b' },
  )

  maybeCount(
    items,
    'emergency-deployments',
    'Emergency deployments',
    summary.emergencyDeployments,
    { icon: Siren, accent: '#ef4444' },
  )

  if (summary.fuelTotalAmount !== null) {
    items.push({
      id: 'fuel-total-amount',
      label: 'Fuel total amount',
      value: formatNuExact(summary.fuelTotalAmount),
      icon: Fuel,
      accent: '#fb923c',
    })
  }

  if (summary.parkingTotalAmount !== null) {
    items.push({
      id: 'parking-total-amount',
      label: 'Parking total amount',
      value: formatNuExact(summary.parkingTotalAmount),
      icon: SquareParking,
      accent: '#06b6d4',
    })
  }

  for (const slice of summary.tripByStatus) {
    const label = /trip/i.test(slice.label) ? slice.label : `${slice.label} trips`
    items.push(countCard(`trip-${slice.label}`, { ...slice, label }, tripIcon(slice.label)))
  }

  for (const slice of summary.fleetByCategory) {
    const label = /fleet|vehicle/i.test(slice.label) ? slice.label : `Fleet · ${slice.label}`
    items.push(
      countCard(`fleet-${slice.label}`, { ...slice, label }, { icon: CarFront, accent: '#3b82f6' }),
    )
  }

  return items
}

/** Queue rows when `/dashboard/pending-actions` is empty, using the summary counts. */
export function pendingApprovalsFromSummary(
  summary: DashboardSummary | undefined,
): DashboardPendingAction[] {
  if (!summary) return []

  const rows: Array<{
    id: string
    title: string
    kind: string
    count: number | null
    href: string
  }> = [
    {
      id: 'trips-pending-review',
      title: 'Trips pending review',
      kind: 'trips',
      count: summary.pendingReview,
      href: '/trip/requisition',
    },
    {
      id: 'parking-pending-approval',
      title: 'Parking pending approval',
      kind: 'parking',
      count: summary.parkingPendingApproval,
      href: '/parking/reimbursement-claims',
    },
    {
      id: 'maintenance-pending-mto-approval',
      title: 'Maintenance pending MTO approval',
      kind: 'maintenance',
      count: summary.pendingMtoApproval,
      href: '/maintenance/work-orders',
    },
  ]

  return rows
    .filter((row) => row.count !== null)
    .map((row) => ({
      id: row.id,
      title: row.title,
      description: '',
      kind: row.kind,
      count: row.count,
      href: row.href,
    }))
}
