// Dashboard endpoints are shared by every role and the payload shape differs per
// deployment, so each field is resolved from a list of candidate keys at any depth
// rather than a fixed schema. Anything the backend omits stays undefined and the
// UI simply drops that card.
import { apiGet } from '@/services/apiClient'

type ApiRecord = Record<string, unknown>

/** Metrics the stat cards can show; only the keys present in the payload are rendered. */
export type DashboardMetricKey =
  | 'totalVehicles'
  | 'onTrip'
  | 'underMaintenance'
  | 'emergencyDeployed'
  | 'idleVehicles'
  | 'fuelCost'
  | 'maintenanceCost'
  | 'parkingCost'
  | 'operatingCost'

export type DashboardMetrics = Partial<Record<DashboardMetricKey, number>>

/** One labelled slice of a breakdown (fleet status, cost by agency, cost composition). */
export type DashboardSlice = {
  label: string
  value: number
}

/** Agency row from `cost-trend?by_agency=true`, including the cost-head split. */
export type DashboardAgencyCostSlice = DashboardSlice & {
  fuel: number
  maintenance: number
  parking: number
  insurance: number
}

export type DashboardFuelQuota = {
  remainingPercent: number | null
  remainingLitres: number | null
  usedLitres: number | null
  allocatedLitres: number | null
  avgEfficiency: number | null
  usedAmount: number | null
  totalAmount: number | null
}

export type DashboardTripItem = {
  id: string
  title: string
  description: string
  status: string
  href: string | null
}

export type DashboardNotification = {
  id: string
  title: string
  description: string
  timeLabel: string
  /** Slug used to pick the row icon. */
  kind: string
  isUnread: boolean
}

export type DashboardSummary = {
  metrics: DashboardMetrics
  /** e.g. `August 2026`, shown beside cost figures. */
  periodLabel: string
  /** Agency or nationwide label reported by the API. */
  scopeLabel: string
  fleetStatus: DashboardSlice[]
  /** `fleet.total` / `utilization.total` when the API sends a fleet size separately from the slices. */
  fleetStatusTotal: number
  costByAgency: DashboardSlice[]
  fuelQuota: DashboardFuelQuota | null
  todaysTrips: DashboardTripItem[]
  notifications: DashboardNotification[]
  /** `trips.by_status` counts, e.g. `{ COMPLETED: 1 }`. */
  tripByStatus: DashboardSlice[]
  /** `trips.pending_review`. */
  pendingReview: number | null
  /** `maintenance.pending_mto_approval`. */
  pendingMtoApproval: number | null
  /** Scalar counts from `maintenance`, including zeros. */
  maintenanceStats: DashboardSlice[]
  /** `parking.total_claims`. */
  parkingClaims: number | null
  /** `fuel.total_amount`. */
  fuelTotalAmount: number | null
  /** `maintenance.total_amount`. */
  maintenanceTotalAmount: number | null
  /** `parking.total_amount`. */
  parkingTotalAmount: number | null
  /** `parking.pending_approval`. */
  parkingPendingApproval: number | null
  /** `fuel.pending_quota` / `fuel.pending_approval`. */
  fuelPendingApproval: number | null
  /** `fleet.by_category` counts. */
  fleetByCategory: DashboardSlice[]
  /** `emergency.total_deployments`. */
  emergencyDeployments: number | null
  /** `driver_rating.average_rating` / `total_reviews`. */
  driverRating: { average: number | null; reviews: number | null } | null
}

export type DashboardPendingAction = {
  id: string
  title: string
  description: string
  kind: string
  count: number | null
  href: string | null
}

export type DashboardCostTrendPoint = {
  label: string
  fuel: number
  maintenance: number
  parking: number
  insurance: number
  total: number
}

/** Combined payload of `cost-trend?by_agency=true` — monthly series plus agency split. */
export type DashboardCostTrendByAgency = {
  points: DashboardCostTrendPoint[]
  slices: DashboardAgencyCostSlice[]
  total: number
  composition: { slices: DashboardSlice[]; total: number }
}

/** Nested payloads are walked this deep when hunting for a field. */
const MAX_DEPTH = 6

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function isRecord(value: unknown): value is ApiRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed.replace(/,/g, ''))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

const LABEL_ACRONYMS = new Set(['id', 'cid', 'ndi', 'mto', 'vip', 'gps', 'kpi'])

/** `pending_mto_approval` → `Pending MTO Approval`, for labels the API sends as enums. */
function toDisplayLabel(raw: string): string {
  const spaced = raw
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
  if (!spaced) return raw

  return spaced
    .split(' ')
    .map((word) =>
      LABEL_ACRONYMS.has(word.toLowerCase())
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join(' ')
}

type FlatEntry = { value: unknown; depth: number }

/**
 * Flattens a payload into `key → value` and `parentkeychildkey → value`, keeping the
 * shallowest hit for each key so a top-level `fuel_cost` beats a nested one.
 */
function flattenScalars(payload: unknown): Map<string, FlatEntry> {
  const flat = new Map<string, FlatEntry>()

  const remember = (key: string, value: unknown, depth: number) => {
    const existing = flat.get(key)
    if (existing && existing.depth <= depth) return
    flat.set(key, { value, depth })
  }

  const walk = (node: unknown, depth: number, prefix: string) => {
    if (depth > MAX_DEPTH || !isRecord(node)) return

    for (const [rawKey, value] of Object.entries(node)) {
      const key = normalizeKey(rawKey)
      if (!key) continue
      const pathKey = prefix ? `${prefix}${key}` : key

      if (isRecord(value)) {
        walk(value, depth + 1, pathKey)
        continue
      }
      if (Array.isArray(value)) continue

      remember(key, value, depth)
      if (pathKey !== key) remember(pathKey, value, depth)
    }
  }

  walk(payload, 0, '')
  return flat
}

function pickFlatNumber(flat: Map<string, FlatEntry>, keys: string[]): number | null {
  for (const key of keys) {
    const entry = flat.get(normalizeKey(key))
    if (!entry) continue
    const numeric = toNumber(entry.value)
    if (numeric !== null) return numeric
  }
  return null
}

function pickFlatText(flat: Map<string, FlatEntry>, keys: string[]): string {
  for (const key of keys) {
    const entry = flat.get(normalizeKey(key))
    if (!entry) continue
    const text = toText(entry.value)
    if (text) return text
  }
  return ''
}

/** Depth-first search for the first array/record held under any of `keys`. */
function findContainer(
  payload: unknown,
  keys: string[],
  kind: 'array' | 'record',
): unknown | undefined {
  const wanted = new Set(keys.map(normalizeKey))
  const matches = (value: unknown) => (kind === 'array' ? Array.isArray(value) : isRecord(value))

  const walk = (node: unknown, depth: number): unknown | undefined => {
    if (depth > MAX_DEPTH || !isRecord(node)) return undefined

    for (const [key, value] of Object.entries(node)) {
      if (wanted.has(normalizeKey(key)) && matches(value)) return value
    }
    for (const value of Object.values(node)) {
      const found = walk(value, depth + 1)
      if (found !== undefined) return found
    }
    return undefined
  }

  return walk(payload, 0)
}

function extractRecordList(payload: unknown, keys: string[]): ApiRecord[] {
  if (Array.isArray(payload)) {
    const records = payload.filter(isRecord)
    if (records.length > 0) return records
  }
  const found = findContainer(payload, keys, 'array')
  return Array.isArray(found) ? found.filter(isRecord) : []
}

function findBreakdown(payload: unknown, keys: string[]): unknown | undefined {
  return findContainer(payload, keys, 'array') ?? findContainer(payload, keys, 'record')
}

function pickValue(record: ApiRecord, keys: readonly string[]): unknown {
  const byKey = new Map<string, unknown>()
  for (const [key, value] of Object.entries(record)) byKey.set(normalizeKey(key), value)

  for (const key of keys) {
    const value = byKey.get(normalizeKey(key))
    if (value !== undefined && value !== null) return value
  }
  return undefined
}

function pickNumber(record: ApiRecord, keys: readonly string[]): number | null {
  return toNumber(pickValue(record, keys))
}

function pickText(record: ApiRecord, keys: string[]): string {
  const value = pickValue(record, keys)
  const text = toText(value)
  if (text) return text

  if (isRecord(value)) {
    const nested = toText(
      pickValue(value, ['name', 'display_name', 'label', 'short_name', 'abbreviation', 'code']),
    )
    if (nested) return nested
  }
  return ''
}

/** Breakdowns arrive either as rows or as a `{ label: value }` map. */
function toSlices(source: unknown, labelKeys: string[], valueKeys: string[]): DashboardSlice[] {
  if (Array.isArray(source)) {
    return source
      .filter(isRecord)
      .map((record) => {
        const label = pickText(record, labelKeys)
        const value = pickNumber(record, valueKeys)
        return !label || value === null ? null : { label, value }
      })
      .filter((slice): slice is DashboardSlice => slice !== null)
  }

  if (isRecord(source)) {
    return Object.entries(source)
      .map(([key, raw]) => {
        const value = toNumber(raw)
        return value === null ? null : { label: toDisplayLabel(key), value }
      })
      .filter((slice): slice is DashboardSlice => slice !== null)
  }

  return []
}

const METRIC_KEYS: Record<DashboardMetricKey, string[]> = {
  totalVehicles: [
    'total_vehicles',
    'vehicles_total',
    'vehicle_count',
    'total_vehicle_count',
    'fleet_size',
    'vehicles',
  ],
  onTrip: [
    'on_trip',
    'on_trip_vehicles',
    'vehicles_on_trip',
    'on_trip_count',
    'ongoing_trips',
    'active_trips',
  ],
  underMaintenance: [
    'under_maintenance',
    'vehicles_under_maintenance',
    'under_maintenance_count',
    'maintenance_vehicles',
    'in_maintenance',
  ],
  emergencyDeployed: [
    'emergency_deployed',
    'emergency_deployed_vehicles',
    'deployed_emergency_vehicles',
    'emergency_deployed_count',
    'emergency_deployments',
  ],
  idleVehicles: ['idle_vehicles', 'vehicles_idle', 'idle_vehicle_count', 'idle_count', 'idle'],
  fuelCost: ['fuel_cost', 'total_fuel_cost', 'fuel_expense', 'fuel_total', 'fuel_amount', 'fuel'],
  maintenanceCost: [
    'maintenance_cost',
    'total_maintenance_cost',
    'maintenance_expense',
    'maintenance_total',
    'maintenance_amount',
    'maintenance',
  ],
  parkingCost: [
    'parking_cost',
    'total_parking_cost',
    'parking_expense',
    'parking_total',
    'parking_amount',
    'parking',
  ],
  operatingCost: [
    'operating_cost',
    'total_operating_cost',
    'operational_cost',
    'total_cost',
    'total_expense',
    'grand_total',
  ],
}

const FLEET_STATUS_KEYS = [
  'fleet_status_distribution',
  'fleet_status',
  'status_distribution',
  'vehicle_status_distribution',
  'vehicles_by_status',
  'status_counts',
  'by_status',
  'statuses',
]

const COST_BY_AGENCY_KEYS = [
  'cost_by_agency',
  'agency_costs',
  'costs_by_agency',
  'by_agency',
  'agency_wise_cost',
  'agency_breakdown',
  'agencies',
]

const FLEET_STATUS_FIELDS = [
  { label: 'Available', keys: ['available'] },
  { label: 'Inactive', keys: ['inactive'] },
  { label: 'On Loan', keys: ['on_loan', 'onLoan'] },
  { label: 'On Trip', keys: ['on_trip', 'onTrip'] },
  { label: 'Under Maintenance', keys: ['under_maintenance', 'underMaintenance'] },
] as const

/** Fallback donut when the API sends counts but no status breakdown. */
function fleetStatusFromMetrics(metrics: DashboardMetrics): {
  slices: DashboardSlice[]
  total: number
} {
  const total = metrics.totalVehicles
  if (total === undefined) return { slices: [], total: 0 }

  const onTrip = metrics.onTrip ?? 0
  const maintenance = metrics.underMaintenance ?? 0
  const emergency = metrics.emergencyDeployed ?? 0
  const idle = metrics.idleVehicles ?? 0
  const available = Math.max(0, total - onTrip - maintenance - emergency - idle)

  const slices = [
    { label: 'Available', value: available },
    { label: 'On Trip', value: onTrip },
    { label: 'Under Maintenance', value: maintenance },
    { label: 'Emergency Deployed', value: emergency },
    { label: 'Idle', value: idle },
  ]

  return { slices, total }
}

function extractFleetStatus(payload: unknown, metrics: DashboardMetrics): {
  slices: DashboardSlice[]
  total: number
} {
  const fleet = extractNamedRecord(payload, ['fleet'])
  const utilization =
    extractNamedRecord(payload, ['utilization']) ??
    (fleet && isRecord(fleet.utilization) ? fleet.utilization : null)
  const root =
    isRecord(payload) && isRecord(payload.data) && !Array.isArray(payload.data)
      ? payload.data
      : isRecord(payload)
        ? payload
        : null
  const rootHasStatuses =
    root != null &&
    FLEET_STATUS_FIELDS.some(({ keys }) => pickNumber(root, keys) !== null)

  if (fleet || utilization || rootHasStatuses) {
    const pickStatus = (keys: readonly string[]): number =>
      (utilization ? pickNumber(utilization, keys) : null) ??
      (fleet ? pickNumber(fleet, keys) : null) ??
      (rootHasStatuses && root ? pickNumber(root, keys) : null) ??
      0

    const slices = FLEET_STATUS_FIELDS.map(({ label, keys }) => ({
      label,
      value: pickStatus(keys),
    }))

    const reportedTotal =
      (utilization ? pickNumber(utilization, ['total', 'total_vehicles', 'vehicle_count']) : null) ??
      (fleet ? pickNumber(fleet, ['total', 'total_vehicles', 'vehicle_count']) : null) ??
      (rootHasStatuses && root
        ? pickNumber(root, ['total', 'total_vehicles', 'vehicle_count'])
        : null)

    return {
      slices,
      total: reportedTotal ?? slices.reduce((sum, slice) => sum + slice.value, 0),
    }
  }

  const fromBreakdown = toSlices(
    findBreakdown(payload, FLEET_STATUS_KEYS),
    ['label', 'status', 'name', 'status_name', 'state'],
    ['value', 'count', 'total', 'vehicles', 'vehicle_count'],
  ).filter((slice) => slice.value > 0)

  if (fromBreakdown.length > 0) {
    return {
      slices: fromBreakdown,
      total: fromBreakdown.reduce((sum, slice) => sum + slice.value, 0),
    }
  }

  return fleetStatusFromMetrics(metrics)
}

const FUEL_QUOTA_KEYS = ['fuel_quota', 'quota', 'fuel_balance_detail', 'fuel']

function extractFuelQuota(payload: unknown): DashboardFuelQuota | null {
  const block = findContainer(payload, FUEL_QUOTA_KEYS, 'record')
  if (!isRecord(block)) return null

  const remaining = pickNumber(block, [
    'remaining_percent',
    'remaining_percentage',
    'balance_percent',
    'percent_remaining',
    'remaining',
  ])

  const quota: DashboardFuelQuota = {
    // A ratio (0–1) and a percentage are both plausible here.
    remainingPercent:
      remaining !== null && remaining > 0 && remaining <= 1 ? Math.round(remaining * 100) : remaining,
    remainingLitres: pickNumber(block, [
      'remaining_litres',
      'remaining_liters',
      'remaining_l',
    ]),
    allocatedLitres: pickNumber(block, [
      'allocated_litres',
      'allocated_liters',
      'allocated_l',
    ]),
    usedLitres: pickNumber(block, [
      'used_litres',
      'used_liters',
      'litres_used',
      'liters_used',
      'consumed_litres',
    ]),
    avgEfficiency: pickNumber(block, [
      'avg_efficiency',
      'average_efficiency',
      'efficiency',
      'km_per_litre',
      'kmpl',
    ]),
    usedAmount: pickNumber(block, [
      'used_amount',
      'amount_used',
      'spent_amount',
      'consumed_amount',
    ]),
    totalAmount: pickNumber(block, [
      'total_amount',
      'quota_amount',
      'allocated_amount',
      'limit_amount',
    ]),
  }

  return Object.values(quota).some((value) => value !== null) ? quota : null
}

const TODAYS_TRIPS_KEYS = [
  'todays_trips',
  'today_trips',
  'trips_today',
  'assigned_trips',
  'my_trips',
  'today_schedule',
  'schedule',
  'trips',
]

function tripDescription(record: ApiRecord): string {
  const explicit = pickText(record, ['description', 'subtitle', 'detail', 'details', 'summary'])
  if (explicit) return explicit

  const plate = pickText(record, [
    'plate_number',
    'vehicle_number',
    'registration_number',
    'vehicle',
  ])
  const distance = pickNumber(record, ['distance_km', 'distance', 'estimated_distance'])
  const duration = pickText(record, ['duration', 'duration_label', 'estimated_duration', 'hours'])
  const route = pickText(record, ['route', 'destination', 'to_location', 'destination_name'])

  return [
    plate,
    distance === null ? '' : `${distance.toLocaleString('en-BT')} km`,
    duration,
    route,
  ]
    .filter(Boolean)
    .join(' · ')
}

function extractTodaysTrips(payload: unknown): DashboardTripItem[] {
  const found = findContainer(payload, TODAYS_TRIPS_KEYS, 'array')
  const rows = Array.isArray(found) ? found.filter(isRecord) : []

  return rows
    .map((record, index) => {
      const title = pickText(record, [
        'title',
        'purpose',
        'trip_purpose',
        'name',
        'label',
        'reference_number',
        'trip_number',
      ])
      if (!title) return null

      const kind = normalizeKey(
        toText(pickValue(record, ['kind', 'type', 'category', 'module'])) || title,
      )

      return {
        id:
          toText(pickValue(record, ['id', 'trip_id', 'reference_id', 'reference', 'uuid'])) ||
          `trip-${index}`,
        title,
        description: tripDescription(record),
        status: toDisplayLabel(
          toText(pickValue(record, ['status', 'trip_status', 'state', 'status_name'])),
        ),
        href: resolveActionHref(record, kind),
      }
    })
    .filter((trip): trip is DashboardTripItem => trip !== null)
}

const NOTIFICATION_KEYS = [
  'notifications',
  'alerts',
  'recent_activity',
  'recent_activities',
  'activities',
  'updates',
  'feed',
]

function extractNotifications(payload: unknown): DashboardNotification[] {
  const found = findContainer(payload, NOTIFICATION_KEYS, 'array')
  const rows = Array.isArray(found) ? found.filter(isRecord) : []

  return rows
    .map((record, index) => {
      const title = pickText(record, ['title', 'subject', 'label', 'name', 'event', 'type_label'])
      const description = pickText(record, [
        'message',
        'body',
        'description',
        'detail',
        'details',
        'content',
      ])
      if (!title && !description) return null

      const kind = toText(
        pickValue(record, ['kind', 'type', 'category', 'event_type', 'module']),
      )
      const readFlag = pickValue(record, ['is_read', 'read', 'seen', 'is_seen'])

      return {
        id:
          toText(pickValue(record, ['id', 'notification_id', 'reference_id', 'uuid'])) ||
          `notification-${index}`,
        title: title || toDisplayLabel(kind) || 'Notification',
        description,
        timeLabel: pickText(record, [
          'time_ago',
          'time_label',
          'relative_time',
          'created_at_label',
          'created_at',
          'timestamp',
          'date',
        ]),
        kind: normalizeKey(kind || title),
        // Treat anything without a read flag as new, so nothing is silently hidden.
        isUnread: readFlag === undefined ? true : !toNumber(readFlag),
      }
    })
    .filter((notification): notification is DashboardNotification => notification !== null)
}

function extractNamedRecord(payload: unknown, names: string[]): ApiRecord | null {
  const found = findContainer(payload, names, 'record')
  return isRecord(found) ? found : null
}

/** Turns `{ COMPLETED: 1, PENDING_REVIEW: 0 }` (or a row list) into labelled slices. */
function recordToCountSlices(source: unknown): DashboardSlice[] {
  return toSlices(
    source,
    ['label', 'status', 'name', 'status_name', 'state', 'key', 'category'],
    ['value', 'count', 'total'],
  )
}

function extractTripByStatus(payload: unknown): DashboardSlice[] {
  const trips = extractNamedRecord(payload, ['trips'])
  if (!trips) return []
  return recordToCountSlices(pickValue(trips, ['by_status', 'byStatus', 'status_counts']))
}

function extractPendingReview(payload: unknown): number | null {
  const trips = extractNamedRecord(payload, ['trips'])
  if (!trips) return null
  return pickNumber(trips, ['pending_review', 'pendingReview', 'pending_reviews'])
}

function extractPendingMtoApproval(payload: unknown): number | null {
  const maintenance = extractNamedRecord(payload, ['maintenance'])
  if (!maintenance) return null
  return pickNumber(maintenance, ['pending_mto_approval', 'pendingMtoApproval'])
}

function extractFuelTotalAmount(payload: unknown): number | null {
  const fuel = extractNamedRecord(payload, ['fuel'])
  if (!fuel) return null
  return pickNumber(fuel, ['total_amount', 'totalAmount'])
}

function extractMaintenanceTotalAmount(payload: unknown): number | null {
  const maintenance = extractNamedRecord(payload, ['maintenance'])
  if (!maintenance) return null
  return pickNumber(maintenance, ['total_amount', 'totalAmount'])
}

function extractParkingTotalAmount(payload: unknown): number | null {
  const parking = extractNamedRecord(payload, ['parking'])
  if (!parking) return null
  return pickNumber(parking, ['total_amount', 'totalAmount'])
}

function extractParkingPendingApproval(payload: unknown): number | null {
  const parking = extractNamedRecord(payload, ['parking'])
  if (!parking) return null
  return pickNumber(parking, ['pending_approval', 'pendingApproval'])
}

function extractFuelPendingApproval(payload: unknown): number | null {
  const fuel = extractNamedRecord(payload, ['fuel'])
  if (!fuel) return null
  return pickNumber(fuel, [
    'pending_quota',
    'pendingQuota',
    'pending_approval',
    'pendingApproval',
    'forwarded_count',
    'forwardedCount',
  ])
}

function extractFleetByCategory(payload: unknown): DashboardSlice[] {
  const fleet = extractNamedRecord(payload, ['fleet'])
  if (!fleet) return []
  return recordToCountSlices(pickValue(fleet, ['by_category', 'byCategory']))
}

function extractEmergencyDeployments(payload: unknown): number | null {
  const emergency = extractNamedRecord(payload, ['emergency'])
  if (!emergency) return null
  return pickNumber(emergency, ['total_deployments', 'totalDeployments'])
}

function extractMaintenanceStats(payload: unknown): DashboardSlice[] {
  const maintenance = extractNamedRecord(payload, ['maintenance'])
  if (!maintenance) return []

  const value = pickNumber(maintenance, [
    'approved_for_service',
    'approvedForService',
    'approved_for_servicing',
  ])
  if (value === null) return []

  return [{ label: 'Maintenance approved for service', value }]
}

function extractParkingClaims(payload: unknown): number | null {
  const parking = extractNamedRecord(payload, ['parking'])
  if (!parking) return null
  return pickNumber(parking, ['total_claims', 'totalClaims', 'claims', 'claim_count'])
}

function extractDriverRating(
  payload: unknown,
): { average: number | null; reviews: number | null } | null {
  const rating = extractNamedRecord(payload, ['driver_rating', 'driverRating'])
  if (!rating) return null

  const average = pickNumber(rating, [
    'average_rating',
    'averageRating',
    'avg_rating',
    'avgRating',
    'rating',
  ])
  const reviews = pickNumber(rating, [
    'total_reviews',
    'totalReviews',
    'review_count',
    'reviews',
  ])

  if (average === null && reviews === null) return null
  return { average, reviews }
}

function mapSummary(payload: unknown): DashboardSummary {
  const flat = flattenScalars(payload)
  const metrics: DashboardMetrics = {}

  for (const [key, candidates] of Object.entries(METRIC_KEYS) as [
    DashboardMetricKey,
    string[],
  ][]) {
    const value = pickFlatNumber(flat, candidates)
    if (value !== null) metrics[key] = value
  }

  const fleetStatus = extractFleetStatus(payload, metrics)

  return {
    metrics,
    periodLabel: pickFlatText(flat, [
      'period_label',
      'period',
      'month_label',
      'current_month',
      'month_name',
      'as_of',
    ]),
    scopeLabel: pickFlatText(flat, [
      'scope_label',
      'scope',
      'agency_name',
      'agency',
      'organization',
      'organisation',
    ]),
    fleetStatus: fleetStatus.slices,
    fleetStatusTotal: fleetStatus.total,
    costByAgency: toSlices(
      findBreakdown(payload, COST_BY_AGENCY_KEYS),
      ['label', 'agency', 'agency_name', 'name', 'short_name', 'agency_code', 'code'],
      [
        'value',
        'total',
        'total_cost',
        'operating_cost',
        'cost',
        'amount',
        'total_amount',
        'total_expense',
      ],
    )
      .filter((slice) => slice.value > 0)
      .sort((a, b) => b.value - a.value),
    fuelQuota: extractFuelQuota(payload),
    todaysTrips: extractTodaysTrips(payload),
    notifications: extractNotifications(payload),
    tripByStatus: extractTripByStatus(payload),
    pendingReview: extractPendingReview(payload),
    pendingMtoApproval: extractPendingMtoApproval(payload),
    maintenanceStats: extractMaintenanceStats(payload),
    parkingClaims: extractParkingClaims(payload),
    fuelTotalAmount: extractFuelTotalAmount(payload),
    maintenanceTotalAmount: extractMaintenanceTotalAmount(payload),
    parkingTotalAmount: extractParkingTotalAmount(payload),
    parkingPendingApproval: extractParkingPendingApproval(payload),
    fuelPendingApproval: extractFuelPendingApproval(payload),
    fleetByCategory: extractFleetByCategory(payload),
    emergencyDeployments: extractEmergencyDeployments(payload),
    driverRating: extractDriverRating(payload),
  }
}

/** `GET /dashboard/summary` — role-scoped counts, costs and per-role extras. */
export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  return mapSummary(await apiGet<unknown>('/dashboard/summary'))
}

/** Deep links for pending actions and trips when the API sends no href. */
const ACTION_ROUTES = [
  { match: /(vehicle.?loan|inter.?agency|lending|loan)/, href: '/vehicle-loan/approval' },
  { match: /emergency/, href: '/emergency/request' },
  { match: /quota/, href: '/fuel/quota-request-list' },
  { match: /fuel/, href: '/fuel/logs' },
  { match: /(parking|reimburse|claim)/, href: '/parking/reimbursement-claims' },
  { match: /(work\s*orders?|work.?order|maintenance|repair)/, href: '/maintenance/work-orders' },
  { match: /(trip.?request|trip requests?)/, href: '/trip/request' },
  { match: /(trip|requisition|journey)/, href: '/trip/requisition' },
  { match: /(offence|offense)/, href: '/offences' },
  { match: /(user|account)/, href: '/users' },
  { match: /vehicle/, href: '/vehicle/list' },
]

function hrefForPendingAction(kind: string, title = ''): string | null {
  const haystack = `${kind} ${title}`.toLowerCase()
  return ACTION_ROUTES.find((route) => route.match.test(haystack))?.href ?? null
}

function resolveActionHref(record: ApiRecord, kind: string, title = ''): string | null {
  const explicit = toText(
    pickValue(record, ['href', 'link', 'url', 'route', 'path', 'redirect_url']),
  )
  if (explicit) return explicit

  return hrefForPendingAction(kind, title)
}

function mapPendingActionRecord(record: ApiRecord, index: number, fallbackKind = ''): DashboardPendingAction {
  const explicitTitle = pickText(record, [
    'title',
    'label',
    'action',
    'action_title',
    'name',
    'type_label',
    'subject',
  ])
  const rawKind = toText(
    pickValue(record, ['kind', 'type', 'action_type', 'category', 'module', 'entity_type', 'service']),
  )
  const kind = normalizeKey(rawKind || fallbackKind || explicitTitle).replace(/\s+/g, '')
  const title = explicitTitle || toDisplayLabel(rawKind || fallbackKind) || 'Pending action'

  return {
    id:
      toText(pickValue(record, ['id', 'action_id', 'reference_id', 'reference', 'uuid'])) ||
      `${kind || 'action'}-${index}`,
    title,
    description: pickText(record, [
      'description',
      'subtitle',
      'detail',
      'details',
      'message',
      'summary',
      'remarks',
      'note',
    ]),
    kind: kind || normalizeKey(title),
    count: pickNumber(record, ['count', 'pending_count', 'total', 'quantity', 'pending']),
    href: resolveActionHref(record, kind || normalizeKey(title), title),
  }
}

function pendingActionsFromKeyedRecord(payload: unknown): DashboardPendingAction[] {
  const root =
    isRecord(payload) && isRecord(payload.data) && !Array.isArray(payload.data)
      ? payload.data
      : payload
  if (!isRecord(root)) return []

  return Object.entries(root)
    .map(([key, value], index) => {
      if (!isRecord(value)) return null
      if (pickNumber(value, ['count', 'pending_count', 'total', 'quantity', 'pending']) === null) {
        return null
      }
      return mapPendingActionRecord(value, index, key)
    })
    .filter((action): action is DashboardPendingAction => action !== null)
}

function mapPendingActions(payload: unknown): DashboardPendingAction[] {
  const fromList = extractRecordList(payload, [
    'pending_actions',
    'pendingactions',
    'pending_approvals',
    'approvals',
    'actions',
    'items',
    'results',
    'records',
    'data',
  ]).map((record, index) => mapPendingActionRecord(record, index))

  if (fromList.length > 0) return fromList.filter((action) => Boolean(action.title))
  return pendingActionsFromKeyedRecord(payload).filter((action) => Boolean(action.title))
}

/** `GET /dashboard/pending-actions` — the queue each role has to act on. */
export async function fetchDashboardPendingActions(): Promise<DashboardPendingAction[]> {
  return mapPendingActions(await apiGet<unknown>('/dashboard/pending-actions'))
}

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

/** Accepts `2026-08`, a bare month number, or an already-formatted label. */
function toMonthLabel(raw: unknown, index: number): string {
  const text = toText(raw)

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})/)
  if (isoMatch) {
    const monthIndex = Number(isoMatch[2]) - 1
    const year = isoMatch[1].slice(2)
    if (monthIndex >= 0 && monthIndex < 12) return `${MONTH_LABELS[monthIndex]} ${year}`
  }

  const numeric = Number(text)
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 12) return MONTH_LABELS[numeric - 1]

  return text || `Point ${index + 1}`
}

function costHeadsFromRecord(record: ApiRecord): Omit<DashboardCostTrendPoint, 'label'> {
  const fuel = pickNumber(record, ['fuel', 'fuel_cost', 'total_fuel_cost', 'fuel_amount']) ?? 0
  const maintenance =
    pickNumber(record, [
      'maintenance',
      'maintenance_cost',
      'total_maintenance_cost',
      'maintenance_amount',
    ]) ?? 0
  const parking =
    pickNumber(record, ['parking', 'parking_cost', 'total_parking_cost', 'parking_amount']) ?? 0
  const insurance =
    pickNumber(record, [
      'insurance',
      'insurance_cost',
      'total_insurance_cost',
      'insurance_amount',
    ]) ?? 0

  return {
    fuel,
    maintenance,
    parking,
    insurance,
    total:
      pickNumber(record, ['total', 'total_cost', 'operating_cost', 'grand_total']) ??
      fuel + maintenance + parking + insurance,
  }
}

function mapCostTrend(payload: unknown): DashboardCostTrendPoint[] {
  return extractRecordList(payload, [
    'periods',
    'cost_trend',
    'costtrend',
    'trend',
    'trends',
    'months',
    'series',
    'points',
    'items',
    'results',
    'data',
  ])
    .map((record, index) => {
      const monthLabel = pickText(record, [
        'month_label',
        'label',
        'month_name',
        'month_key',
        'period',
        'year_month',
        'date',
      ])
      const year = pickNumber(record, ['year'])
      const month = pickNumber(record, ['month'])
      const label =
        monthLabel ||
        (year !== null && month !== null && month >= 1 && month <= 12
          ? `${MONTH_LABELS[month - 1]} ${year}`
          : toMonthLabel(pickValue(record, ['month']), index))

      return { label, ...costHeadsFromRecord(record) }
    })
    .filter((point) => !/^total$/i.test(point.label))
}

/** `GET /dashboard/cost-trend?months=n` — monthly fuel/maintenance/parking/insurance spend. */
export async function fetchDashboardCostTrend(
  months: number,
): Promise<DashboardCostTrendPoint[]> {
  const query = new URLSearchParams({ months: String(months) }).toString()
  return mapCostTrend(await apiGet<unknown>(`/dashboard/cost-trend?${query}`))
}

function pickAgencyLabel(record: ApiRecord): string {
  const name = pickText(record, [
    'agency_name',
    'agency',
    'organisation',
    'organization',
    'name',
    'label',
  ])
  if (name) return name
  const short = pickText(record, ['short_name', 'abbreviation', 'agency_short_name'])
  if (short) return short
  return pickText(record, ['agency_code', 'code']).replace(/_/g, ' ')
}

function mapCostByAgencySlices(payload: unknown): {
  slices: DashboardAgencyCostSlice[]
  total: number
} {
  const records = extractRecordList(payload, [
    'by_agency',
    'byAgency',
    'agencies',
    'agency_costs',
    'cost_by_agency',
  ])
  const slices = records
    .map((record) => {
      const heads = costHeadsFromRecord(record)
      return {
        label: pickAgencyLabel(record),
        value: heads.total,
        fuel: heads.fuel,
        maintenance: heads.maintenance,
        parking: heads.parking,
        insurance: heads.insurance,
      }
    })
    .filter((slice) => Boolean(slice.label) && slice.value > 0)
    .sort((a, b) => b.value - a.value)

  const totals = findContainer(payload, ['totals', 'summary'], 'record')
  const reportedTotal =
    isRecord(totals) ? pickNumber(totals, ['total', 'total_cost', 'grand_total', 'amount']) : null

  return {
    slices,
    total: reportedTotal ?? slices.reduce((sum, slice) => sum + slice.value, 0),
  }
}

function mapCostCompositionFromPayload(
  payload: unknown,
  points: DashboardCostTrendPoint[],
): { slices: DashboardSlice[]; total: number } {
  const totals = findContainer(payload, ['totals', 'summary'], 'record')
  if (isRecord(totals)) {
    const fromTotals = toCostComposition([{ label: 'Total', ...costHeadsFromRecord(totals) }])
    if (fromTotals.slices.length > 0) return fromTotals
  }
  return toCostComposition(points)
}

/** `GET /dashboard/cost-trend?by_agency=true&months=n` — monthly series and agency split in one call. */
export async function fetchDashboardCostTrendByAgency(
  months: number,
): Promise<DashboardCostTrendByAgency> {
  const query = new URLSearchParams({
    months: String(months),
    by_agency: 'true',
  }).toString()
  const payload = await apiGet<unknown>(`/dashboard/cost-trend?${query}`)
  const points = mapCostTrend(payload)
  const { slices, total } = mapCostByAgencySlices(payload)
  return {
    points,
    slices,
    total,
    composition: mapCostCompositionFromPayload(payload, points),
  }
}

/** Totals the trend series by category, for the composition donut. */
export function toCostComposition(points: DashboardCostTrendPoint[]): {
  slices: DashboardSlice[]
  total: number
} {
  const slices = (
    [
      { label: 'Fuel', key: 'fuel', always: true },
      { label: 'Maintenance', key: 'maintenance', always: true },
      { label: 'Parking', key: 'parking', always: true },
      { label: 'Insurance', key: 'insurance', always: false },
    ] as const
  )
    .map(({ label, key, always }) => ({
      label,
      value: points.reduce((sum, point) => sum + (Number(point[key]) || 0), 0),
      always,
    }))
    .filter((slice) => slice.always || slice.value > 0)
    .map(({ label, value }) => ({ label, value }))

  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  if (total === 0) return { slices: [], total: 0 }

  return { slices, total }
}

/** `16057` → `16k`, `2500` → `2.5k`, `2000000` → `2M`. */
function toCompactDigits(scaled: number): string {
  const abs = Math.abs(scaled)
  const rounded = abs >= 10 ? Math.round(abs) : Math.round(abs * 10) / 10
  const digits = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  return scaled < 0 ? `-${digits}` : digits
}

export function formatCompactNumber(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${toCompactDigits(value / 1_000_000)}M`
  if (abs >= 1_000) return `${toCompactDigits(value / 1_000)}k`
  return value.toLocaleString('en-BT', { maximumFractionDigits: 0 })
}

/** Card and axis figures, where space is tight: `Nu 16k`. */
export function formatNuCompact(value: number): string {
  return `Nu ${formatCompactNumber(value)}`
}

/** Tooltips and totals, where the exact figure matters: `Nu 1,254,300`. */
export function formatNuExact(value: number): string {
  return `Nu ${value.toLocaleString('en-BT', { maximumFractionDigits: 2 })}`
}
