export type QuotaRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export type QuotaRequestRecord = {
  id: string
  name: string
  contact: string
  email: string
  vehicle: string
  quotaUsed: number
  quotaTotal: number
  recommendedAmount: number
  prepaymentAmount: number
  remarks: string
  status: QuotaRequestStatus
}

const SEED_REQUESTS: Omit<QuotaRequestRecord, 'id'>[] = [
  {
    name: 'Karma Dorji',
    contact: '17777777',
    email: 'karma.dorji@example.com',
    vehicle: 'BG-1-A1234',
    quotaUsed: 780,
    quotaTotal: 5000,
    recommendedAmount: 4220,
    prepaymentAmount: 6000,
    remarks: '',
    status: 'PENDING',
  },
  {
    name: 'Pema Wangdi',
    contact: '17888888',
    email: 'pema.wangdi@example.com',
    vehicle: 'BG-2-B4471',
    quotaUsed: 950,
    quotaTotal: 6000,
    recommendedAmount: 5050,
    prepaymentAmount: 5000,
    remarks:
      'Current fuel balance is below the approved threshold, and the recommended amount is required for upcoming official vehicle movement. Kindly process the pre-payment.',
    status: 'PENDING',
  },
  {
    name: 'Sonam Choden',
    contact: '17666666',
    email: 'sonam.choden@example.com',
    vehicle: 'BG-3-C2190',
    quotaUsed: 1100,
    quotaTotal: 7000,
    recommendedAmount: 5900,
    prepaymentAmount: 6000,
    remarks: '',
    status: 'PENDING',
  },
  {
    name: 'Tashi Namgay',
    contact: '17123456',
    email: 'tashi.namgay@example.com',
    vehicle: 'BG-4-D8820',
    quotaUsed: 3200,
    quotaTotal: 5000,
    recommendedAmount: 1800,
    prepaymentAmount: 5000,
    remarks: '',
    status: 'PENDING',
  },
]

function buildGeneratedRequest(index: number): QuotaRequestRecord {
  const seed = SEED_REQUESTS[index % SEED_REQUESTS.length]
  const quotaTotal = seed.quotaTotal + (index % 3) * 500
  const quotaUsed = Math.min(quotaTotal - 200, seed.quotaUsed + index * 120)
  const statuses: QuotaRequestStatus[] = ['PENDING', 'APPROVED', 'REJECTED']

  return {
    id: `quota-request-${index + 1}`,
    name: `${seed.name.split(' ')[0]} ${index + 5}`,
    contact: String(17000000 + index),
    email: `driver${index + 1}@example.com`,
    vehicle: `BG-${(index % 9) + 1}-X${1000 + index}`,
    quotaUsed,
    quotaTotal,
    recommendedAmount: Math.max(0, quotaTotal - quotaUsed),
    prepaymentAmount: Math.max(0, quotaTotal - quotaUsed + 500),
    remarks:
      index % 4 === 1
        ? seed.remarks
        : index % 3 === 0
          ? 'Routine quota replenishment for field duty.'
          : '',
    status: statuses[index % 5 === 0 ? 1 : index % 7 === 0 ? 2 : 0],
  }
}

let quotaRequests: QuotaRequestRecord[] = [
  ...SEED_REQUESTS.map((request, index) => ({
    ...request,
    id: `quota-request-${index + 1}`,
  })),
  ...Array.from({ length: 48 }, (_, offset) =>
    buildGeneratedRequest(SEED_REQUESTS.length + offset),
  ),
]

export const QUOTA_REQUEST_STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
] as const

export function getQuotaRequests(): QuotaRequestRecord[] {
  return quotaRequests
}

export function getQuotaRequestById(id: string): QuotaRequestRecord | undefined {
  return quotaRequests.find((request) => request.id === id)
}

export function updateQuotaRequest(
  id: string,
  patch: Partial<Pick<QuotaRequestRecord, 'prepaymentAmount' | 'remarks' | 'status'>>,
): QuotaRequestRecord | undefined {
  const index = quotaRequests.findIndex((request) => request.id === id)
  if (index < 0) return undefined
  quotaRequests = quotaRequests.map((request, i) =>
    i === index ? { ...request, ...patch } : request,
  )
  return quotaRequests[index]
}

export function deleteQuotaRequest(id: string): boolean {
  const before = quotaRequests.length
  quotaRequests = quotaRequests.filter((request) => request.id !== id)
  return quotaRequests.length < before
}

export function filterQuotaRequests(
  rows: QuotaRequestRecord[],
  search: string,
  statusFilter: string,
): QuotaRequestRecord[] {
  const query = search.trim().toLowerCase()
  return rows.filter((row) => {
    const matchesStatus =
      statusFilter === 'all' || row.status === statusFilter
    if (!matchesStatus) return false
    if (!query) return true
    return (
      row.name.toLowerCase().includes(query) ||
      row.contact.includes(query) ||
      row.email.toLowerCase().includes(query) ||
      row.vehicle.toLowerCase().includes(query)
    )
  })
}

export function formatCurrentQuota(used: number, total: number): string {
  const usedFormatted = used.toLocaleString('en-US')
  const totalFormatted = total.toLocaleString('en-US')
  return `Nu. ${usedFormatted} / Nu. ${totalFormatted}`
}

export function formatNuDisplay(amount: number): string {
  return `Nu. ${amount.toLocaleString('en-US')}`
}
