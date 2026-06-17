export type QuotaRequestStatus =
  | 'PENDING'
  | 'FORWARDED'
  | 'APPROVED'
  | 'COMPLETED'
  | 'TOPPED_UP'
  | 'REJECTED'
  | 'MTO_REJECTED'
  | 'FINANCE_REJECTED'

export const QUOTA_REQUEST_STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'FORWARDED', label: 'Forwarded' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'TOPPED_UP', label: 'Topped Up' },
  { value: 'MTO_REJECTED', label: 'MTO Rejected' },
  { value: 'FINANCE_REJECTED', label: 'Finance Rejected' },
  { value: 'REJECTED', label: 'Rejected' },
] as const

export function formatCurrentQuota(used: number, total: number): string {
  const usedFormatted = used.toLocaleString('en-US')
  const totalFormatted = total.toLocaleString('en-US')
  return `Nu. ${usedFormatted} / Nu. ${totalFormatted}`
}

export function formatNuDisplay(amount: number): string {
  return `Nu. ${amount.toLocaleString('en-US')}`
}
