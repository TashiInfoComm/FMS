import type {
  FuelingResponsibility,
  LoanAuditStep,
  LoanRequisitionStatus,
} from '@/features/inter-agency-vehicle-loan/lib/loan-requisition-types'

export const LOAN_REQUISITION_STATUS_OPTIONS: LoanRequisitionStatus[] = [
  'DRAFT',
  'PENDING_HIGHEST_ADMIN',
  'PENDING_BORROWING_HEAD',
  'PENDING_LENDING_HEAD',
  'PENDING_MTO_COMMIT',
  'VEHICLE_COMMITTED',
  'ACTIVE',
  'RETURNED',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
]

export const LOAN_AUDIT_STEPS: LoanAuditStep[] = [
  'REQUIREMENT_SUBMITTED',
  'FLEET_ANALYSIS_COMPLETED',
  'REQUISITION_SENT',
  'LENDING_AGENCY_ACCEPTED',
  'VEHICLES_COMMITTED',
  'HANDOVER_COMPLETED',
  'LOAN_ACTIVE',
  'VEHICLE_RETURNED',
]

const STATUS_LABELS: Record<LoanRequisitionStatus, string> = {
  DRAFT: 'Draft',
  PENDING_HIGHEST_ADMIN: 'Pending Highest Admin',
  PENDING_BORROWING_HEAD: 'Pending Borrowing Head',
  PENDING_LENDING_HEAD: 'Pending Lending Head',
  PENDING_MTO_COMMIT: 'Pending MTO Commit',
  VEHICLE_COMMITTED: 'Vehicle Committed',
  ACTIVE: 'Active',
  RETURNED: 'Returned',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
}

const STATUS_STYLES: Record<
  LoanRequisitionStatus,
  { pill: string; dot: string }
> = {
  DRAFT: {
    pill: 'bg-[#f1f5f9] text-[#475569]',
    dot: 'bg-[#94a3b8]',
  },
  PENDING_HIGHEST_ADMIN: {
    pill: 'bg-[#dbeafe] text-[#1d4ed8]',
    dot: 'bg-[#1d4ed8]',
  },
  PENDING_BORROWING_HEAD: {
    pill: 'bg-[#e0f2fe] text-[#0369a1]',
    dot: 'bg-[#0284c7]',
  },
  PENDING_LENDING_HEAD: {
    pill: 'bg-[#e0e7ff] text-[#4338ca]',
    dot: 'bg-[#4f46e5]',
  },
  PENDING_MTO_COMMIT: {
    pill: 'bg-[#ede9fe] text-[#6d28d9]',
    dot: 'bg-[#7c3aed]',
  },
  VEHICLE_COMMITTED: {
    pill: 'bg-[#ccfbf1] text-[#0f766e]',
    dot: 'bg-[#0d9488]',
  },
  ACTIVE: {
    pill: 'bg-[#d0fae5] text-[#007a55]',
    dot: 'bg-[#007a55]',
  },
  RETURNED: {
    pill: 'bg-[#fef3c7] text-[#b45309]',
    dot: 'bg-[#d97706]',
  },
  COMPLETED: {
    pill: 'bg-[#dcfce7] text-[#15803d]',
    dot: 'bg-[#16a34a]',
  },
  REJECTED: {
    pill: 'bg-[#fde8e8] text-[#c53030]',
    dot: 'bg-[#e53e3e]',
  },
  CANCELLED: {
    pill: 'bg-[#f3f4f6] text-[#6b7280]',
    dot: 'bg-[#9ca3af]',
  },
}

const AUDIT_STEP_LABELS: Record<LoanAuditStep, string> = {
  REQUIREMENT_SUBMITTED: 'Requirement Submitted',
  FLEET_ANALYSIS_COMPLETED: 'Fleet Analysis Completed',
  REQUISITION_SENT: 'Requisition Sent',
  LENDING_AGENCY_ACCEPTED: 'Lending Agency Accepted',
  VEHICLES_COMMITTED: 'Vehicles Committed',
  HANDOVER_COMPLETED: 'Handover Completed',
  LOAN_ACTIVE: 'Loan Active',
  VEHICLE_RETURNED: 'Vehicle Returned',
}

const FUELING_LABELS: Record<FuelingResponsibility, string> = {
  BORROWING_AGENCY: 'Borrowing Agency',
  LENDING_AGENCY: 'Lending Agency',
}

export function canBorrowerModifyLoan(status: LoanRequisitionStatus): boolean {
  return status === 'DRAFT' || status === 'PENDING_HIGHEST_ADMIN'
}

export function formatLoanRequisitionStatusLabel(status: LoanRequisitionStatus): string {
  return STATUS_LABELS[status]
}

export function loanRequisitionStatusStyles(status: LoanRequisitionStatus) {
  return STATUS_STYLES[status]
}

export function formatLoanAuditStepLabel(step: LoanAuditStep): string {
  return AUDIT_STEP_LABELS[step]
}

export function formatFuelingResponsibilityLabel(value: FuelingResponsibility): string {
  return FUELING_LABELS[value]
}

export function formatLoanPeriodDays(days: number): string {
  return `${days} day${days === 1 ? '' : 's'}`
}

export function formatLoanDate(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return '—'
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return trimmed
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function parseDateOnly(value: string): Date | null {
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  const [year, month, day] = trimmed.split('-').map(Number)
  const parsed = new Date(year, month - 1, day)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

export function calculateLoanDurationDays(
  startLocal: string,
  endLocal: string,
): string {
  const startDateOnly = parseDateOnly(startLocal)
  const endDateOnly = parseDateOnly(endLocal)
  if (startDateOnly && endDateOnly) {
    if (endDateOnly.getTime() < startDateOnly.getTime()) return ''
    const msPerDay = 1000 * 60 * 60 * 24
    const diffDays = Math.round(
      (endDateOnly.getTime() - startDateOnly.getTime()) / msPerDay,
    )
    return String(Math.max(1, diffDays + 1))
  }

  const start = new Date(startLocal.trim())
  const end = new Date(endLocal.trim())
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return ''
  if (end.getTime() < start.getTime()) return ''
  const msPerDay = 1000 * 60 * 60 * 24
  const days = Math.ceil((end.getTime() - start.getTime()) / msPerDay)
  return String(Math.max(1, days))
}

export function formatLoanDurationDisplay(
  startLocal: string,
  endLocal: string,
): string {
  const days = calculateLoanDurationDays(startLocal, endLocal)
  if (!days) return ''
  const parsed = Number.parseInt(days, 10)
  return formatLoanPeriodDays(parsed)
}

export const VEHICLE_CATEGORY_OPTIONS = [
  { value: 'light-vehicle', label: 'Light Vehicle' },
  { value: '4x4-utility', label: '4x4 Utility' },
  { value: 'bus', label: 'Bus' },
  { value: 'heavy-vehicle', label: 'Heavy Vehicle' },
  { value: 'motorcycle', label: 'Motorcycle' },
] as const

export const FUELING_RESPONSIBILITY_OPTIONS = [
  { value: 'BORROWING_AGENCY' as const, label: 'Borrowing Agency' },
  { value: 'LENDING_AGENCY' as const, label: 'Lending Agency' },
]

export function vehicleCategoryLabel(value: string): string {
  return VEHICLE_CATEGORY_OPTIONS.find((option) => option.value === value)?.label ?? value
}
