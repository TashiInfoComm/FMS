import { apiGet } from '@/services/apiClient'
import { extractMasterList } from '@/shared/lib/organogram-master-lookup'

import {
  deriveTripTypeCategory,
  type TripMasterOption,
} from '@/features/trips/lib/trip-form-utils'

export type { TripMasterOption }

type ApiRecord = Record<string, unknown>
const PAGE_SIZE = 200

function isActiveRecord(record: ApiRecord): boolean {
  if (record.active === undefined) return true
  return record.active === true || record.active === 1 || record.active === '1'
}

function recordId(record: ApiRecord): string {
  const id = record.id
  if (typeof id === 'string' && id.trim()) return id.trim()
  if (typeof id === 'number' && Number.isFinite(id)) return String(id)
  return ''
}

function recordsToIdNameOptions(records: ApiRecord[]): TripMasterOption[] {
  return records
    .filter(isActiveRecord)
    .map((r): TripMasterOption | null => {
      const code = typeof r.code === 'string' ? r.code.trim() : ''
      const name = typeof r.name === 'string' ? r.name.trim() : ''
      const value = recordId(r) || code || name
      const label = name || code
      if (!value) return null
      return { value, label, code: code || undefined }
    })
    .filter((o): o is TripMasterOption => o !== null)
}

function recordsToTripTypeOptions(records: ApiRecord[]): TripMasterOption[] {
  return records
    .filter(isActiveRecord)
    .map((r): TripMasterOption | null => {
      const code = typeof r.code === 'string' ? r.code.trim() : ''
      const name = typeof r.name === 'string' ? r.name.trim() : ''
      const value = recordId(r) || code || name
      const label = name || code
      const categoryRaw =
        typeof r.category === 'string'
          ? r.category.trim()
          : typeof r.trip_type_category === 'string'
            ? r.trip_type_category.trim()
            : ''
      const category = categoryRaw || deriveTripTypeCategory(label, code)
      if (!value) return null
      return { value, label, category, code: code || undefined }
    })
    .filter((o): o is TripMasterOption => o !== null)
}

export type TripRequisitionMasterLists = {
  tripTypes: TripMasterOption[]
  journeyPurposes: TripMasterOption[]
  vehicleTypes: TripMasterOption[]
}

export async function fetchTripRequisitionMasterLists(): Promise<TripRequisitionMasterLists> {
  const [tripTypesPayload, purposesPayload, vehicleTypesPayload] = await Promise.all([
    apiGet<unknown>(`/master/trip-types?active=true&page=1&page_size=${PAGE_SIZE}&code=&search=`),
    apiGet<unknown>(
      `/master/journey-purposes?active=true&page=1&page_size=${PAGE_SIZE}&code=&search=`,
    ),
    apiGet<unknown>(`/master/vehicle-categories?active=true&page=1&page_size=${PAGE_SIZE}&code=&search=`),
  ])

  return {
    tripTypes: recordsToTripTypeOptions(extractMasterList(tripTypesPayload)),
    journeyPurposes: recordsToIdNameOptions(extractMasterList(purposesPayload)),
    vehicleTypes: recordsToIdNameOptions(extractMasterList(vehicleTypesPayload)),
  }
}

export function categoryForMasterOption(
  options: TripMasterOption[],
  value: string,
): string {
  const match = options.find((o) => o.value === value)
  return match?.category || deriveTripTypeCategory(match?.label ?? '', match?.code)
}

export function labelForMasterOption(
  options: TripMasterOption[],
  value: string,
): string {
  const match = options.find((o) => o.value === value)
  return match?.label ?? value
}
