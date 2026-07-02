import type { WorkOrderStatus } from '@/features/maintenance/lib/maintenance-mock-data'

/** Minor work orders at or above this total require MTO escalation instead of approval. */
export const MTO_MINOR_ESCALATION_THRESHOLD = 500_000

export function resolveMaintenanceTypeKind(
  typeLabel: string,
  typeCode = '',
): 'major' | 'minor' | null {
  const label = typeLabel.trim().toLowerCase()
  const code = typeCode.trim().toLowerCase()
  if (label === 'major' || code === 'major') return 'major'
  if (label === 'minor' || code === 'minor') return 'minor'
  return null
}

export function shouldEscalateWorkOrderMtoApproval(input: {
  maintenanceTypeLabel: string
  maintenanceTypeCode?: string
  totalAmount: number
}): boolean {
  const kind = resolveMaintenanceTypeKind(
    input.maintenanceTypeLabel,
    input.maintenanceTypeCode,
  )
  if (kind === 'major') return true
  if (kind === 'minor') return input.totalAmount >= MTO_MINOR_ESCALATION_THRESHOLD
  return false
}

export function formatNuAmount(amount: number): string {
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  return `Nu. ${formatted}`
}

function normalizeWorkOrderStatus(status: WorkOrderStatus): string {
  return status.trim().toUpperCase().replace(/\s+/g, '_')
}

export function workOrderStatusBadgeClass(status: WorkOrderStatus): string {
  const normalized = normalizeWorkOrderStatus(status)

  switch (normalized) {
    case 'PENDING_MTO_APPROVAL':
      return 'border-transparent bg-[#fef9c3] text-[#a16207] hover:bg-[#fef9c3]'
    case 'PENDING_AGENCY_APPROVAL':
      return 'border-transparent bg-[#ffedd5] text-[#c2410c] hover:bg-[#ffedd5]'
    case 'APPROVED_FOR_SERVICE':
      return 'border-transparent bg-[#ecfdf5] text-[#34d399] hover:bg-[#ecfdf5]'
    case 'IN_PROGRESS':
      return 'border-transparent bg-[#dbeafe] text-[#1d4ed8] hover:bg-[#dbeafe]'
    case 'PENDING_VERIFICATION':
      return 'border-transparent bg-[#ede9fe] text-[#7c3aed] hover:bg-[#ede9fe]'
    case 'COMPLETED':
      return 'border-transparent bg-[#064e3b] text-[#ecfdf5] hover:bg-[#064e3b]'
    case 'REJECTED':
      return 'border-transparent bg-[#fee2e2] text-[#b91c1c] hover:bg-[#fee2e2]'
    case 'CANCELLED':
      return 'border-transparent bg-[#f3f4f6] text-[#4b5563] hover:bg-[#f3f4f6]'
    default:
      break
  }

  if (normalized.includes('COMPLET')) {
    return 'border-transparent bg-[#064e3b] text-[#ecfdf5] hover:bg-[#064e3b]'
  }
  if (normalized.includes('VERIF')) {
    return 'border-transparent bg-[#ede9fe] text-[#7c3aed] hover:bg-[#ede9fe]'
  }
  if (normalized.includes('APPROV')) {
    return 'border-transparent bg-[#ecfdf5] text-[#34d399] hover:bg-[#ecfdf5]'
  }
  if (normalized.includes('PENDING')) {
    return 'border-transparent bg-[#fef9c3] text-[#a16207] hover:bg-[#fef9c3]'
  }
  if (normalized.includes('REJECT')) {
    return 'border-transparent bg-[#fee2e2] text-[#b91c1c] hover:bg-[#fee2e2]'
  }
  if (normalized.includes('CANCEL')) {
    return 'border-transparent bg-[#f3f4f6] text-[#4b5563] hover:bg-[#f3f4f6]'
  }
  if (normalized.includes('PROGRESS')) {
    return 'border-transparent bg-[#dbeafe] text-[#1d4ed8] hover:bg-[#dbeafe]'
  }

  return 'border-transparent bg-[#edf2f7] text-[#2d3748] hover:bg-[#edf2f7]'
}
