export type QuotaUpdatePendingStatus = 'READY_UPDATE'

export type QuotaUpdatePendingRecord = {
  id: string
  requestId: string
  driver: string
  vehicle: string
  quotaUsed: number
  quotaTotal: number
  financeApprovedAmount: number
  status: QuotaUpdatePendingStatus
}

const SEED_PENDING: Omit<QuotaUpdatePendingRecord, 'id'>[] = [
  {
    requestId: 'FQR-2026-0020',
    driver: 'Karma Dorji',
    vehicle: 'BG-1-A1234',
    quotaUsed: 780,
    quotaTotal: 5000,
    financeApprovedAmount: 7000,
    status: 'READY_UPDATE',
  },
  {
    requestId: 'FQR-2026-0019',
    driver: 'Pema Wangdi',
    vehicle: 'BG-2-B4471',
    quotaUsed: 950,
    quotaTotal: 6000,
    financeApprovedAmount: 5000,
    status: 'READY_UPDATE',
  },
  {
    requestId: 'FQR-2026-0018',
    driver: 'Sonam Choden',
    vehicle: 'BG-3-C2190',
    quotaUsed: 1100,
    quotaTotal: 7000,
    financeApprovedAmount: 6000,
    status: 'READY_UPDATE',
  },
  {
    requestId: 'FQR-2026-0017',
    driver: 'Tashi Namgay',
    vehicle: 'BG-4-D8820',
    quotaUsed: 3200,
    quotaTotal: 5000,
    financeApprovedAmount: 5000,
    status: 'READY_UPDATE',
  },
]

function buildGeneratedPending(index: number): QuotaUpdatePendingRecord {
  const seed = SEED_PENDING[index % SEED_PENDING.length]
  const year = 2026
  const requestNum = String(20 - index).padStart(4, '0')

  return {
    id: `quota-update-pending-${index + 1}`,
    requestId: `FQR-${year}-${requestNum}`,
    driver: seed.driver,
    vehicle: `BG-${(index % 9) + 1}-X${1000 + index}`,
    quotaUsed: seed.quotaUsed + (index % 4) * 150,
    quotaTotal: seed.quotaTotal + (index % 3) * 500,
    financeApprovedAmount: seed.financeApprovedAmount + (index % 5) * 200,
    status: 'READY_UPDATE',
  }
}

let pendingUpdates: QuotaUpdatePendingRecord[] = [
  ...SEED_PENDING.map((row, index) => ({
    ...row,
    id: `quota-update-pending-${index + 1}`,
  })),
  ...Array.from({ length: 22 }, (_, offset) =>
    buildGeneratedPending(SEED_PENDING.length + offset),
  ),
]

export function getQuotaUpdatePendingList(): QuotaUpdatePendingRecord[] {
  return pendingUpdates
}

export function filterQuotaUpdatePending(
  rows: QuotaUpdatePendingRecord[],
  search: string,
): QuotaUpdatePendingRecord[] {
  const query = search.trim().toLowerCase()
  if (!query) return rows
  return rows.filter(
    (row) =>
      row.requestId.toLowerCase().includes(query) ||
      row.driver.toLowerCase().includes(query) ||
      row.vehicle.toLowerCase().includes(query) ||
      row.status.toLowerCase().includes(query) ||
      row.id.toLowerCase().includes(query) ||
      String(row.financeApprovedAmount).includes(query),
  )
}

export function removeQuotaUpdatePending(id: string): boolean {
  const before = pendingUpdates.length
  pendingUpdates = pendingUpdates.filter((row) => row.id !== id)
  return pendingUpdates.length < before
}

export function getQuotaUpdateVehicleOptions(
  rows: QuotaUpdatePendingRecord[],
): string[] {
  return [...new Set(rows.map((row) => row.vehicle))].sort()
}
