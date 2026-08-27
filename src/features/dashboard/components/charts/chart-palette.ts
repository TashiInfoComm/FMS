// Shared series colours so a cost category or vehicle status keeps the same colour
// across every dashboard chart.
export const CHART_COLORS = {
  fuel: '#f97316',
  maintenance: '#f59e0b',
  parking: '#06b6d4',
  insurance: '#8b5cf6',
  available: '#22c55e',
  inactive: '#64748b',
  onLoan: '#8b5cf6',
  onTrip: '#3b82f6',
  underMaintenance: '#f59e0b',
  emergency: '#ef4444',
  idle: '#94a3b8',
} as const

/** Fallback colours for labels the API invents, cycled by index. */
export const CHART_SERIES_COLORS = [
  '#3b82f6',
  '#14b8a6',
  '#f59e0b',
  '#8b5cf6',
  '#ef4444',
  '#22c55e',
  '#06b6d4',
  '#f97316',
  '#ec4899',
  '#64748b',
]

/** Colour for a fleet status slice, matched on the label the API sent. */
export function fleetStatusColor(label: string, index: number): string {
  const text = label.toLowerCase()
  if (text.includes('available')) return CHART_COLORS.available
  if (text.includes('inactive') || text.includes('idle')) return CHART_COLORS.idle
  if (text.includes('loan')) return CHART_COLORS.parking
  if (text.includes('trip') || text.includes('dispatch')) return CHART_COLORS.onTrip
  if (text.includes('maintenance') || text.includes('repair')) return CHART_COLORS.underMaintenance
  if (text.includes('emergency')) return CHART_COLORS.emergency
  return CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length]
}

/** Colour for a cost category slice, matched on the label the API sent. */
export function costCategoryColor(label: string, index: number): string {
  const text = label.toLowerCase()
  if (text.includes('fuel')) return CHART_COLORS.fuel
  if (text.includes('maintenance') || text.includes('repair')) return CHART_COLORS.maintenance
  if (text.includes('parking')) return CHART_COLORS.parking
  if (text.includes('insurance')) return CHART_COLORS.insurance
  return CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length]
}

/** Chart config keys have to be safe CSS identifiers. */
export function toSeriesKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'series'
}
