// Route: `/vehicle/list/:vehicleId`. Loads one vehicle from GET `/vehicles/{vehicle_id}`.
// Agency names via `original_assignment` / `current_assignment` → GET `/master/{entity_type}/id/{entity_id}`.
// Status names via `status_id` / `movement_status_id` → GET `/master/vehicle-statuses/{id}` etc.
// Other nested relations (insurance, fuel type, …) use embedded objects from the vehicle response.
import { ArrowLeft, Pencil } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { isUuidLike } from '@/shared/lib/organogram-master-lookup'
import { fetchVehicleById } from '@/features/vehicles/lib/vehicles-api'
import {
  fetchVehicleDetailResolvedNames,
  flattenVehicleDetailRecord,
  isVehicleAgencyKindField,
  isVehicleStatusKindField,
  resolveVehicleAgencyDisplayName,
  resolveVehicleStatusDisplayName,
} from '@/features/vehicles/lib/vehicle-organogram-display'
import {
  isGroupedVehicleDetailKey,
  VEHICLE_DETAIL_SECTIONS,
  type VehicleDetailField,
} from '@/features/vehicles/pages/vehicle-detail-sections'
import { PageHeader } from '@/shared/components/PageHeader'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { cn } from '@/lib/utils'

type ApiRecord = Record<string, unknown>

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

function formatLocalDateTimeLabel(date: Date): string {
  const year = date.getFullYear()
  const month = MONTH_NAMES[date.getMonth()]
  const day = date.getDate()
  let hours = date.getHours()
  const minutes = date.getMinutes()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  if (hours === 0) hours = 12
  const mm = String(minutes).padStart(2, '0')
  return `${year} ${month} ${day} at ${hours}:${mm} ${ampm}`
}

/** ISO-8601 datetime strings (e.g. from API) → readable local date/time. */
function tryFormatIsoDateTimeString(value: string): string | null {
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed)) return null
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  return formatLocalDateTimeLabel(parsed)
}

function humanizeKey(key: string) {
  const spaced = key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
  return spaced
    .split(' ')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : ''))
    .join(' ')
}

/** Nested API relations (e.g. `fuel_type`, `vehicle_category`) often expose `name`. */
function resolveRelationDisplayName(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const obj = value as ApiRecord
  for (const key of ['name', 'label', 'title', 'code'] as const) {
    const candidate = obj[key]
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  }
  return null
}

function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  const relationName = resolveRelationDisplayName(value)
  if (relationName !== null) return relationName
  if (typeof value === 'string') {
    const asDateTime = tryFormatIsoDateTimeString(value)
    if (asDateTime !== null) return asDateTime
    if (isUuidLike(value.trim())) return '—'
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

function pickTitle(record: ApiRecord) {
  const direct =
    typeof record.vehicle_name === 'string'
      ? record.vehicle_name.trim()
      : typeof record.name === 'string'
        ? record.name.trim()
        : ''
  if (direct) return direct
  const make = typeof record.make === 'string' ? record.make : typeof record.vehicle_make === 'string' ? record.vehicle_make : ''
  const model = typeof record.model === 'string' ? record.model : typeof record.vehicle_model === 'string' ? record.vehicle_model : ''
  const combined = [make, model].filter((s) => s && String(s).trim()).join(' ')
  if (combined.trim()) return combined.trim()
  const num =
    typeof record.vehicle_number === 'string'
      ? record.vehicle_number
      : typeof record.registration_number === 'string'
        ? record.registration_number
        : ''
  return num.trim() || 'Vehicle detail'
}

function pickValueForKeys(record: ApiRecord, keys: readonly string[]): unknown {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) continue
    const value = record[key]
    if (value === null || value === undefined) continue
    if (typeof value === 'string' && !value.trim()) continue
    return value
  }
  return undefined
}

function VehicleDetailSkeleton() {
  return (
    <div className="space-y-5 rounded-xl border border-[var(--fms-strokes)] bg-white p-4">
      {Array.from({ length: 3 }).map((_, cardIdx) => (
        <Card key={`sk-card-${cardIdx}`} className="border border-[var(--fms-strokes)] bg-white shadow-sm">
          <CardContent className="space-y-4 pt-5">
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-64" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={`sk-${cardIdx}-${i}`} className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-full max-w-xs" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

const CREATED_BY_KEYS = new Set(['created_by', 'createdBy'])

function resolveAdditionalEntryDisplayText(
  key: string,
  value: unknown,
  resolvedNamesQuery: {
    isLoading: boolean
    data: Awaited<ReturnType<typeof fetchVehicleDetailResolvedNames>> | undefined
  },
): string {
  if (CREATED_BY_KEYS.has(key)) {
    if (resolvedNamesQuery.isLoading) return 'Loading…'
    const name = resolvedNamesQuery.data?.createdBy?.trim()
    if (name) return name
  }
  return formatDetailValue(value)
}

function resolveFieldDisplayText(
  field: VehicleDetailField,
  sectionId: string,
  raw: unknown,
  resolvedNamesQuery: {
    isLoading: boolean
    data: Awaited<ReturnType<typeof fetchVehicleDetailResolvedNames>> | undefined
  },
): string {
  const agencyKind = isVehicleAgencyKindField(field)
  if (sectionId === 'agency' && agencyKind !== null) {
    return resolvedNamesQuery.isLoading
      ? 'Loading…'
      : resolveVehicleAgencyDisplayName(agencyKind, resolvedNamesQuery.data?.assignments)
  }

  const statusKind = isVehicleStatusKindField(field)
  if (statusKind) {
    return resolvedNamesQuery.isLoading
      ? 'Loading…'
      : resolveVehicleStatusDisplayName(statusKind, resolvedNamesQuery.data)
  }

  return formatDetailValue(raw)
}

export function VehicleDetailPage() {
  const { vehicleId } = useParams<{ vehicleId: string }>()
  const crud = useRouteCrudPermissions('/vehicle/list')

  const vehicleQuery = useQuery({
    queryKey: ['vehicles', 'detail', vehicleId],
    enabled: Boolean(vehicleId?.trim()) && crud.isResolved && crud.canRead,
    queryFn: async () => {
      if (!vehicleId?.trim()) throw new Error('Missing vehicle id')
      return fetchVehicleById(vehicleId)
    },
  })

  const resolvedNamesQuery = useQuery({
    queryKey: ['vehicles', 'detail', vehicleId, 'resolved-names'],
    enabled: Boolean(vehicleQuery.data) && crud.isResolved && crud.canRead,
    queryFn: () => fetchVehicleDetailResolvedNames(vehicleQuery.data as ApiRecord),
    staleTime: 60_000,
  })

  const title = useMemo(() => {
    const record = vehicleQuery.data
    if (!record) return 'Vehicle detail'
    return pickTitle(record)
  }, [vehicleQuery.data])

  const additionalEntries = useMemo(() => {
    const record = vehicleQuery.data
    if (!record) return []
    return Object.entries(record)
      .filter(([key]) => !isGroupedVehicleDetailKey(key) && key !== 'id')
      .sort(([a], [b]) => a.localeCompare(b))
  }, [vehicleQuery.data])

  if (crud.isLoading || !crud.isResolved) {
    return (
      <section className="space-y-5">
        <PageHeader title="Vehicle detail" subtitle="Loading permissions…" />
        <VehicleDetailSkeleton />
      </section>
    )
  }

  if (crud.isResolved && !crud.canRead) {
    return (
      <section className="space-y-5">
        <PageHeader title="Vehicle detail" subtitle="View vehicle information" />
        <p className="text-sm text-[var(--fms-text-subheading)]">You do not have permission to view vehicle details.</p>
        <Button variant="outline" asChild>
          <Link to="/vehicle/list">Back to list</Link>
        </Button>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title={title} subtitle="Detail Vehicle Information " />
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          {crud.canUpdate && vehicleId ? (
            <Button variant="default" asChild className="w-full sm:w-auto">
              <Link
                to={`/vehicle/list/${encodeURIComponent(vehicleId)}/edit`}
                className="inline-flex items-center justify-center gap-2"
              >
                <Pencil className="h-4 w-4" aria-hidden />
                Edit vehicle
              </Link>
            </Button>
          ) : null}
          <Button variant="outline" asChild className="w-full shrink-0 sm:w-auto">
            <Link to="/vehicle/list" className="inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to list
            </Link>
          </Button>
        </div>
      </div>

      {vehicleQuery.isLoading ? (
        <VehicleDetailSkeleton />
      ) : vehicleQuery.isError ? (
        <p className="text-sm text-[var(--fms-error-text)]">
          {vehicleQuery.error instanceof Error ? vehicleQuery.error.message : 'Could not load vehicle.'}
        </p>
      ) : (
        <div className="space-y-5 rounded-xl border border-[var(--fms-strokes)] bg-white p-4">
          {VEHICLE_DETAIL_SECTIONS.map((section) => (
            <Card key={section.id} className="border border-[var(--fms-strokes)] bg-white shadow-sm">
              <CardContent className="space-y-4 pt-5">
                <div>
                  <p className="text-base font-semibold text-[var(--fms-text-header)]">{section.title}</p>
                  <p className="text-xs text-[var(--fms-text-subheading)]">{section.subtitle}</p>
                </div>
                <div className="grid gap-x-6 gap-y-4 md:grid-cols-2 lg:grid-cols-3">
                  {section.fields.map((field) => {
                    const record = flattenVehicleDetailRecord(vehicleQuery.data as ApiRecord)
                    const raw = pickValueForKeys(record, field.keys)
                    const text = resolveFieldDisplayText(
                      field,
                      section.id,
                      raw,
                      resolvedNamesQuery,
                    )
                    const multiline = text.includes('\n')
                    return (
                      <div key={`${section.id}-${field.label}`} className="min-w-0">
                        <p className="text-xs font-medium text-[var(--fms-text-subheading)]">{field.label}</p>
                        <p
                          className={cn(
                            'mt-1 text-sm text-[var(--fms-text-header)]',
                            multiline &&
                              'max-h-48 overflow-auto rounded-md bg-[#f6f6f7] p-2 font-mono text-xs whitespace-pre-wrap',
                          )}
                        >
                          {text}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}

          {additionalEntries.length > 0 ? (
            <Card className="border border-[var(--fms-strokes)] bg-white shadow-sm">
              <CardHeader className="border-b border-[var(--fms-strokes)] pb-3">
                <CardTitle className="text-base font-semibold text-[var(--fms-text-header)]">
                  Additional information
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-x-6 gap-y-4 pt-4 sm:grid-cols-2 lg:grid-cols-3">
                {additionalEntries.map(([key, value]) => {
                  const text = resolveAdditionalEntryDisplayText(key, value, resolvedNamesQuery)
                  const multiline = text.includes('\n')
                  return (
                    <div key={key} className="min-w-0">
                      <p className="text-xs font-medium text-[var(--fms-text-subheading)]">{humanizeKey(key)}</p>
                      <p
                        className={cn(
                          'mt-1 text-sm text-[var(--fms-text-header)]',
                          multiline &&
                            'max-h-48 overflow-auto rounded-md bg-[#f6f6f7] p-2 font-mono text-xs whitespace-pre-wrap',
                        )}
                      >
                        {text}
                      </p>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </section>
  )
}
