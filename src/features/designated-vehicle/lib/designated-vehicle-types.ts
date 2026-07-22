export type DesignatedVehicleStatus = 'ACTIVE' | 'UNDER_MAINTENANCE' | 'REPLACEMENT'

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
  designationTypeId?: string
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
  designationTypeId: string
  remarks: string
}
