// Turns the nested driver fields on `/dashboard/summary` into the cards that layout shows.
import {
  CircleCheckBig,
  Clock,
  Compass,
  SquareParking,
  Star,
  type LucideIcon,
} from 'lucide-react'

import type { DashboardSlice, DashboardSummary } from '@/features/dashboard/lib/dashboard-api'

export type DriverStatItem = {
  id: string
  label: string
  value: string
  icon: LucideIcon
  accent: string
  suffix?: string
}

function tripIcon(label: string): { icon: LucideIcon; accent: string } {
  const text = label.toLowerCase()
  if (text.includes('complet')) return { icon: CircleCheckBig, accent: '#16a34a' }
  if (text.includes('pending') || text.includes('review')) return { icon: Clock, accent: '#f59e0b' }
  return { icon: Compass, accent: '#3b82f6' }
}

function countCard(
  id: string,
  slice: DashboardSlice,
  look: { icon: LucideIcon; accent: string },
): DriverStatItem {
  return {
    id,
    label: slice.label,
    value: slice.value.toLocaleString('en-BT'),
    icon: look.icon,
    accent: look.accent,
  }
}

/** Cards for trip-by-status, parking claims, maintenance counts and driver rating. */
export function buildDriverStatItems(summary: DashboardSummary | undefined): DriverStatItem[] {
  if (!summary) return []

  const items: DriverStatItem[] = []

  if (summary.driverRating) {
    if (summary.driverRating.average !== null) {
      items.push({
        id: 'rating-average',
        label: 'My Rating',
        value: summary.driverRating.average.toLocaleString('en-BT', { maximumFractionDigits: 2 }),
        icon: Star,
        accent: '#22c55e',
        suffix: '/5',
      })
    }
    if (summary.driverRating.reviews !== null) {
      items.push({
        id: 'rating-reviews',
        label: 'Reviews',
        value: summary.driverRating.reviews.toLocaleString('en-BT'),
        icon: Star,
        accent: '#14b8a6',
      })
    }
  }

  if (summary.parkingClaims !== null) {
    items.push({
      id: 'parking-claims',
      label: 'Parking Claims',
      value: summary.parkingClaims.toLocaleString('en-BT'),
      icon: SquareParking,
      accent: '#06b6d4',
    })
  }

  for (const slice of summary.tripByStatus) {
    const label = /trip/i.test(slice.label) ? slice.label : `${slice.label} trips`
    items.push(countCard(`trip-${slice.label}`, { ...slice, label }, tripIcon(slice.label)))
  }

  for (const slice of summary.maintenanceStats) {
    items.push(
      countCard(`maintenance-${slice.label}`, slice, {
        icon: CircleCheckBig,
        accent: '#22c55e',
      }),
    )
  }

  return items
}
