import type {
  FuelingResponsibility,
  LoanAuditStep,
  LoanFleetSearchRequirement,
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
  { pill: string }
> = {
  DRAFT: {
    pill: 'bg-[#f1f5f9] text-[#475569]',

  },
  PENDING_HIGHEST_ADMIN: {
    pill: 'bg-[#dbeafe] text-[#1d4ed8]',

  },
  PENDING_BORROWING_HEAD: {
    pill: 'bg-[#e0f2fe] text-[#0369a1]',
  },
  PENDING_LENDING_HEAD: {
    pill: 'bg-[#e0e7ff] text-[#4338ca]',

  },
  PENDING_MTO_COMMIT: {
    pill: 'bg-[#ede9fe] text-[#6d28d9]',

  },
  VEHICLE_COMMITTED: {
    pill: 'bg-[#ccfbf1] text-[#0f766e]',

  },
  ACTIVE: {
    pill: 'bg-[#cffafe] text-[#0891b2]',

  },
  RETURNED: {
    pill: 'bg-[#fef3c7] text-[#b45309]',

  },
  COMPLETED: {
    pill: 'bg-[#d0fae5] text-[#007a55]',

  },
  REJECTED: {
    pill: 'bg-[#fde8e8] text-[#c53030]',

  },
  CANCELLED: {
    pill: 'bg-[#f3f4f6] text-[#6b7280]',

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

export function formatFleetSearchRequirementsSummary(
  requirements: LoanFleetSearchRequirement[],
): string {
  if (requirements.length === 0) return '—'
  return requirements
    .map((requirement) => {
      const category = requirement.vehicleCategory || 'Vehicle'
      if (requirement.requestedCount > 0 || requirement.availableCount > 0) {
        return `${category}: ${requirement.requestedCount} number of vehicle(s)`
      }
      return category
    })
    .join('; ')
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

export function formatLoanDateTime(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return '—'
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return trimmed
  return parsed.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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

export const FUELING_RESPONSIBILITY_OPTIONS = [
  { value: 'BORROWING_AGENCY' as const, label: 'Borrowing Agency' },
  { value: 'LENDING_AGENCY' as const, label: 'Lending Agency' },
]

export const LOAN_DISPATCH_FUEL_LEVEL_OPTIONS = [
  { value: 'FULL', label: 'Full' },
  { value: 'THREE_QUARTER', label: '3/4' },
  { value: 'HALF', label: '1/2' },
  { value: 'QUARTER', label: '1/4' },
  { value: 'EMPTY', label: 'Empty' },
] as const

export const LOAN_DISPATCH_CHECKLIST_STATUS_OPTIONS = [
  { value: 'OK', label: 'OK' },
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'MISSING', label: 'Missing' },
  { value: 'NOT_APPLICABLE', label: 'Not Applicable' },
] as const

export function formatLoanChecklistStatusLabel(value: string): string {
  const normalized = value.trim().toUpperCase()
  const match = LOAN_DISPATCH_CHECKLIST_STATUS_OPTIONS.find(
    (option) => option.value === normalized,
  )
  if (match) return match.label
  if (!normalized) return '—'
  return normalized
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function formatLoanDispatchFuelLevelLabel(value: string): string {
  const normalized = value.trim().toUpperCase()
  const match = LOAN_DISPATCH_FUEL_LEVEL_OPTIONS.find((option) => option.value === normalized)
  if (match) return match.label
  if (!normalized) return '—'
  return normalized
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function formatFleetSearchMakeModelDisplay(
  make: string,
  model: string,
  year: string,
  color: string,
): string {
  const base = [make, model].map((value) => value.trim()).filter(Boolean).join(' ')
  if (!base) return '—'

  const yearText = year.trim()
  const colorText = color.trim()
  if (!yearText && !colorText) return base

  return `${base}((${yearText})(${colorText}))`
}

export function formatFleetSearchPrimaryDriverDisplay(name: string, license: string): string {
  const nameText = name.trim()
  const licenseText = license.trim()
  if (!nameText && !licenseText) return '—'
  if (!nameText) return `(${licenseText})`
  if (!licenseText) return nameText
  return `${nameText} (${licenseText})`
}
