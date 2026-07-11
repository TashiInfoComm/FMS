export type LoanRequisitionStatus =
  | 'DRAFT'
  | 'PENDING_HIGHEST_ADMIN'
  | 'PENDING_BORROWING_HEAD'
  | 'PENDING_LENDING_HEAD'
  | 'PENDING_MTO_COMMIT'
  | 'VEHICLE_COMMITTED'
  | 'ACTIVE'
  | 'RETURNED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'

export type LoanAuditStep =
  | 'REQUIREMENT_SUBMITTED'
  | 'FLEET_ANALYSIS_COMPLETED'
  | 'REQUISITION_SENT'
  | 'LENDING_AGENCY_ACCEPTED'
  | 'VEHICLES_COMMITTED'
  | 'HANDOVER_COMPLETED'
  | 'LOAN_ACTIVE'
  | 'VEHICLE_RETURNED'

export type FuelingResponsibility = 'BORROWING_AGENCY' | 'LENDING_AGENCY'

export type VehicleCategoryOption = {
  value: string
  label: string
}

export type LoanVehicleRequirement = {
  id: string
  vehicleCategory: string
  vehicleCategoryLabel: string
  numberOfVehicles: number
  fuelingResponsibility: FuelingResponsibility
  reason: string
  startDate: string
  endDate: string
  driverRequired: boolean
}

export type LoanAuditTimelineEntry = {
  step: LoanAuditStep
  triggerLabel?: string
  completed: boolean
  date?: string
}

export type LoanAuditTimelineDisplayEntry = LoanAuditTimelineEntry & {
  isCurrent: boolean
}

export type LoanRequisitionListRow = {
  id: string
  requestId: string
  borrowingAgency: string
  lendingAgency: string
  vehicleCategories: string[]
  numberOfVehicles: number
  loanPeriodDays: number
  startDate: string
  endDate: string
  fuelingResponsibility: FuelingResponsibility
  status: LoanRequisitionStatus
}

export type LoanRequisitionDetail = {
  id: string
  requestId: string
  borrowingAgency: string
  lendingAgency: string
  lendingAgencyId: string
  fuelingResponsibility: FuelingResponsibility
  reason: string
  status: LoanRequisitionStatus
  requirements: LoanVehicleRequirement[]
  committedVehicles: LoanCommittedVehicle[]
  handoverChecklistRecorded: boolean
  returnChecklistRecorded: boolean
  rejectionReason: string
  highestAdminRemarks: string
  borrowingHeadRemarks: string
  lendingHeadRemarks: string
  dispatchedAt: string
  returnedAt: string
  recommendedAgencies: LoanRecommendedAgency[]
}

export type LoanRecommendedAgency = {
  id: string
  name: string
}

export type CreateLoanRequisitionPayload = {
  vehicle_requirements: Array<{
    vehicle_category_id: string
    vehicle_count: number
    reason: string
    start_date: string
    end_date: string
    driver_required: boolean
  }>
  fueling_responsibility: FuelingResponsibility
  remarks: string
}

export type LoanFleetSearchVehicleOption = {
  id: string
  registrationNumber: string
  make: string
  model: string
  year: string
  color: string
  primaryDriverId: string
  primaryDriverName: string
  primaryDriverLicense: string
}

export type LoanFleetSearchRequirement = {
  vehicleCategory: string
  vehicleCategoryId: string
  requestedCount: number
  availableCount: number
  driverRequired: boolean
  vehicles: LoanFleetSearchVehicleOption[]
}

export type LoanFleetSearchOption = {
  id: string
  agencyName: string
  fullyMatches: boolean
  totalAvailable: number
  requirements: LoanFleetSearchRequirement[]
}

export type HighestAdminDecisionBody =
  | {
      action: 'forward'
      recommended_agency_ids: string[]
      remarks: string
    }
  | {
      action: 'reject'
      remarks: string
    }

export type BorrowingHeadDecisionBody =
  | {
      action: 'approve'
      lending_agency_id: string
      remarks: string
    }
  | {
      action: 'reject'
      remarks: string
    }

export type LendingHeadDecisionBody = {
  action: 'approve' | 'reject'
  remarks: string
}

export type CommitLoanVehicleItem = {
  vehicle_id: string
  driver_id: string | null
  notes: string
}

export type CommitLoanVehiclesBody = {
  vehicles: CommitLoanVehicleItem[]
}

export type LoanCommitVehicleRow = {
  vehicleId: string
  registrationNumber: string
  makeModelDisplay: string
  vehicleCategory: string
  requirementKey: string
  vehicleCountRequested: number
  driverRequired: boolean
  primaryDriverId: string
  primaryDriverDisplay: string
}

export type LoanCommittedVehicle = {
  vehicleId: string
  registrationNumber: string
  makeModelDisplay: string
  vehicleCategory: string
  driverRequired: boolean
  driverName: string
  notes: string
  fuelLevelAtDispatch: string
  odometerAtDispatch: string
  fuelLevelAtReturn: string
  odometerAtReturn: string
  returnNotes: string
  preDispatchChecklist: LoanVehicleChecklist | null
  postReturnChecklist: LoanVehicleChecklist | null
}

export type LoanVehicleChecklist = {
  checklistType: string
  recordedByName: string
  items: LoanDispatchChecklistItem[]
}

export type LoanDispatchChecklistItem = {
  item: string
  status: string
  notes: string | null
}

export type LoanVehicleDispatchItem = {
  vehicle_id: string
  fuel_level_at_dispatch: string
  odometer_at_dispatch: number
  checklist_items: LoanDispatchChecklistItem[]
}

export type DispatchLoanVehiclesBody = {
  vehicle_dispatches: LoanVehicleDispatchItem[]
}

export type LoanVehicleReturnItem = {
  vehicle_id: string
  fuel_level_at_return: string
  odometer_at_return: number
  notes: string | null
  checklist_items: LoanDispatchChecklistItem[]
}

export type ReturnLoanVehiclesBody = {
  vehicle_returns: LoanVehicleReturnItem[]
}

export type ChecklistItemOption = {
  code: string
  name: string
  description: string
  active: boolean
}
