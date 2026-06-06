import type { WorkOrderStatus } from '@/features/maintenance/lib/maintenance-mock-data'

export function formatNuAmount(amount: number): string {
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  return `Nu. ${formatted}`
}

export function workOrderStatusBadgeClass(status: WorkOrderStatus): string {
  switch (status) {
    case 'Pending':
    case 'Pending Approval':
      return 'border-transparent bg-[#fef9c3] text-[#ca8a04] hover:bg-[#fef9c3]'
    case 'Approved':
    case 'Approved for Service':
      return 'border-transparent bg-[#d0fae5] text-[#007a55] hover:bg-[#d0fae5]'
    case 'Completed':
      return 'border-transparent bg-[#dbeafe] text-[#1d4ed8] hover:bg-[#dbeafe]'
    case 'Rejected':
      return 'border-transparent bg-[#fde8e8] text-[#c53030] hover:bg-[#fde8e8]'
    default:
      return 'border-transparent bg-[#edf2f7] text-[#2d3748] hover:bg-[#edf2f7]'
  }
}
