export type DesignatedVehicleStatus = 'ACTIVE' | 'UNDER_MAINTENANCE' | 'REPLACEMENT'

export const VEHICLE_DESIGNATED_TYPES = [
  'MINISTER',
  'SECRETARIAT',
  'PROTOCOL',
  'UTILITY',
] as const

export type VehicleDesignatedType = (typeof VEHICLE_DESIGNATED_TYPES)[number]

export const VEHICLE_DESIGNATED_TYPE_OPTIONS: {
  value: VehicleDesignatedType
  label: string
  searchText: string
}[] = [
  { value: 'MINISTER', label: 'Minister', searchText: 'MINISTER Minister' },
  { value: 'SECRETARIAT', label: 'Secretariat', searchText: 'SECRETARIAT Secretariat' },
  { value: 'PROTOCOL', label: 'Protocol', searchText: 'PROTOCOL Protocol' },
  { value: 'UTILITY', label: 'Utility', searchText: 'UTILITY Utility' },
]

export function isVehicleDesignatedType(value: string): value is VehicleDesignatedType {
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_')
  return (VEHICLE_DESIGNATED_TYPES as readonly string[]).includes(normalized)
}

export function normalizeVehicleDesignatedType(value: string): string {
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_')
  return isVehicleDesignatedType(normalized) ? normalized : value.trim()
}

export function vehicleDesignatedTypeLabel(value: string): string {
  const normalized = normalizeVehicleDesignatedType(value)
  return (
    VEHICLE_DESIGNATED_TYPE_OPTIONS.find((option) => option.value === normalized)?.label ||
    value.trim()
  )
}

export type DesignatedVehicleListRow = {
  id: string
  vehicleId: string
  registrationNumber: string
  makeModel: string
  officialName: string
  designation: string
  designationTypeName: string
  status: DesignatedVehicleStatus
}

export type DesignatedVehicleDetail = {
  vehicleId: string
  officialCid: string
  officialName: string
  designation: string
  designationType?: string
  designationTypeName?: string
  remarks?: string
  agency: string
  registrationNumber: string
  makeModel: string
  status: DesignatedVehicleStatus
  driverName?: string
  odometerKm?: number
  fuelType?: string
  currentQuota?: number
  thresholdAmount?: number
  monthlyAllocation?: number
  quotaUsedPercent?: number
  lastServiceDate?: string
}

export type AssignDesignatedVehicleFormValues = {
  vehicleId: string
  driverName: string
  officialCid: string
  officialName: string
  designation: string
  designationType: string
  remarks: string
}
