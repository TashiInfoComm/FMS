// Stat card set for the finance dashboard. A card only renders when its metric
// key is present in `/dashboard/summary`.
import { Coins, Fuel, SquareParking, Wrench, type LucideIcon } from 'lucide-react'

import type { DashboardMetricKey } from '@/features/dashboard/lib/dashboard-api'

export type StatCardSpec = {
  key: DashboardMetricKey
  label: string
  icon: LucideIcon
  /** Left edge accent colour. */
  accent: string
  format: 'count' | 'currency' | 'percent' | 'rating'
  /** Appends the summary period to the label, e.g. `Fuel Cost (August 2026)`. */
  showPeriod?: boolean
}

/** Finance officer / accountant. */
export const FINANCE_STAT_CARDS: StatCardSpec[] = [
  {
    key: 'maintenanceCost',
    label: 'Total Maintenance Cost',
    icon: Wrench,
    accent: '#2f5fd0',
    format: 'currency',
  },
  {
    key: 'parkingCost',
    label: 'Total Parking Cost',
    icon: SquareParking,
    accent: '#3b82f6',
    format: 'currency',
  },
  { key: 'fuelCost', label: 'Total Fuel Cost', icon: Fuel, accent: '#fb923c', format: 'currency' },
  { key: 'operatingCost', label: 'Overall Cost', icon: Coins, accent: '#14b8a6', format: 'currency' },
]
