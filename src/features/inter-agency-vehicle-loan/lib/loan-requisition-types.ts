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
  completed: boolean
  date?: string
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
  vehicleCategory: string
  loanPeriodDays: number
  requestedCount: number
  acceptedCount: number
  committedCount: number
  fuelingResponsibility: FuelingResponsibility
  reason: string
  driverRequired: boolean
  borrowStartDatetime: string
  borrowEndDatetime: string
  status: LoanRequisitionStatus
  requirements: LoanVehicleRequirement[]
  auditTimeline: LoanAuditTimelineEntry[]
  requestedVehicleSummary: string
  committedVehicleSummary: string
  handoverChecklistRecorded: boolean
  returnChecklistRecorded: boolean
  rejectionReason: string
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

export type LoanFleetSearchAgency = {
  id: string
  name: string
  code: string
  availableVehicles: number
  matchingCategories: string
  capacitySummary: string
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
