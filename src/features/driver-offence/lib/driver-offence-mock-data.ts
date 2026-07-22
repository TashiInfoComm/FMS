import type {
  DriverOffenceDetail,
  DriverOffenceListRow,
} from '@/features/driver-offence/lib/driver-offence-types'

export const MOCK_DRIVER_OFFENCES: DriverOffenceListRow[] = [
  {
    id: 'off-1',
    offenceDate: '2026-07-06',
    offence: 'Speeding',
    amount: 1500,
    status: 'UNPAID',
  },
  {
    id: 'off-2',
    offenceDate: '2026-06-28',
    offence: 'Dangerous Driving',
    amount: 3000,
    status: 'PAID',
  },
  {
    id: 'off-3',
    offenceDate: '2026-06-15',
    offence: 'Illegal Parking',
    amount: 500,
    status: 'UNPAID',
  },
  {
    id: 'off-4',
    offenceDate: '2026-06-02',
    offence: 'Red Light Violation',
    amount: 2000,
    status: 'PAID',
  },
  {
    id: 'off-5',
    offenceDate: '2026-05-20',
    offence: 'Speeding',
    amount: 1500,
    status: 'PAID',
  },
  {
    id: 'off-6',
    offenceDate: '2026-05-08',
    offence: 'Wrong Lane Driving',
    amount: 1000,
    status: 'UNPAID',
  },
  {
    id: 'off-7',
    offenceDate: '2026-04-22',
    offence: 'Illegal U-Turn',
    amount: 750,
    status: 'PAID',
  },
  {
    id: 'off-8',
    offenceDate: '2026-04-10',
    offence: 'Overloading',
    amount: 2500,
    status: 'UNPAID',
  },
]

const MOCK_DETAILS: Record<string, DriverOffenceDetail> = {
  'off-1': {
    id: 'off-1',
    driverName: 'Pema Dorji',
    employeeId: 'MOF-DRV-018',
    licenseNumber: 'DL-102938-BT',
    agency: 'Ministry of Finance',
    vehicleNumber: 'BG-1-A1234',
    vehicleType: 'Toyota Hilux',
    offenceDateTime: '06 Jul 2026, 08:42 AM',
    offenceLocation: 'Babesa-Thimphu Expressway',
    offenceDetails: 'Speeding above permitted limit',
    fineAmount: 1500,
    status: 'UNPAID',
    source: 'eRAILIS',
  },
  'off-2': {
    id: 'off-2',
    driverName: 'Pema Dorji',
    employeeId: 'MOF-DRV-018',
    licenseNumber: 'DL-102938-BT',
    agency: 'Ministry of Finance',
    vehicleNumber: 'BG-1-A1234',
    vehicleType: 'Toyota Hilux',
    offenceDateTime: '28 Jun 2026, 02:15 PM',
    offenceLocation: 'Changlimithang, Thimphu',
    offenceDetails: 'Dangerous driving in congested area',
    fineAmount: 3000,
    status: 'PAID',
    source: 'eRAILIS',
  },
}

function buildDefaultDetail(row: DriverOffenceListRow): DriverOffenceDetail {
  return {
    id: row.id,
    driverName: 'Pema Dorji',
    employeeId: 'MOF-DRV-018',
    licenseNumber: 'DL-102938-BT',
    agency: 'Ministry of Finance',
    vehicleNumber: 'BG-1-A1234',
    vehicleType: 'Toyota Hilux',
    offenceDateTime: `${row.offenceDate}, 10:00 AM`,
    offenceLocation: 'Thimphu',
    offenceDetails: row.offence,
    fineAmount: row.amount,
    status: row.status,
    source: 'eRAILIS',
  }
}

export function getMockDriverOffenceDetail(id: string): DriverOffenceDetail | null {
  const row = MOCK_DRIVER_OFFENCES.find((item) => item.id === id)
  if (!row) return null
  return MOCK_DETAILS[id] ?? buildDefaultDetail(row)
}

export function filterMockDriverOffences(
  rows: DriverOffenceListRow[],
  search: string,
): DriverOffenceListRow[] {
  const q = search.trim().toLowerCase()
  if (!q) return rows
  return rows.filter((row) =>
    [row.offence, row.status, row.offenceDate, String(row.amount)]
      .join(' ')
      .toLowerCase()
      .includes(q),
  )
}

export function paginateMockRows<T>(rows: T[], page: number, pageSize: number) {
  const totalCount = rows.length
  const totalPages = Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize)))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * pageSize
  return {
    rows: rows.slice(start, start + pageSize),
    totalCount,
    totalPages,
    effectivePageSize: pageSize,
    page: safePage,
  }
}
