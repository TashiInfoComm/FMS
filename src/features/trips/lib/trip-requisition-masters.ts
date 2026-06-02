import { apiGet } from '@/services/apiClient'
import { extractMasterList } from '@/shared/lib/organogram-master-lookup'

import type { TripMasterOption } from '@/features/trips/lib/trip-form-utils'

export type { TripMasterOption }

type ApiRecord = Record<string, unknown>
const PAGE_SIZE = 200

function isActiveRecord(record: ApiRecord): boolean {
  if (record.active === undefined) return true
  return record.active === true || record.active === 1 || record.active === '1'
}

function recordsToCodeNameOptions(records: ApiRecord[]): TripMasterOption[] {
  return records
    .filter(isActiveRecord)
    .map((r) => {
      const code = typeof r.code === 'string' ? r.code.trim() : ''
      const name = typeof r.name === 'string' ? r.name.trim() : ''
      const value = code || name
      const label = name || code
      if (!value) return null
      return { value, label }
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
    tripTypes: recordsToCodeNameOptions(extractMasterList(tripTypesPayload)),
    journeyPurposes: recordsToCodeNameOptions(extractMasterList(purposesPayload)),
    vehicleTypes: recordsToCodeNameOptions(extractMasterList(vehicleTypesPayload)),
  }
}

export function labelForMasterOption(
  options: TripMasterOption[],
  value: string,
): string {
  const match = options.find((o) => o.value === value)
  return match?.label ?? value
}
