export type DriverTripStatus = 'Scheduled' | 'In Progress' | 'Completed'

export type DriverAssignmentListItem = {
  id: string
  requestId: string
  applicantName: string
  origin: string
  destination: string
  vehiclePlate: string
  scheduledTime: string
  status: DriverTripStatus
}

const statusOverrides = new Map<string, DriverTripStatus>()

const ASSIGNMENT_SEED: DriverAssignmentListItem[] = [
  {
    id: 'tr-2024-001',
    requestId: 'TR-2024-001',
    applicantName: 'Tashi Choden',
    origin: 'MoF Office',
    destination: 'GovTech Conference Hall',
    vehiclePlate: 'BG-1-C7000',
    scheduledTime: '01:03 PM',
    status: 'Scheduled',
  },
  {
    id: 'tr-2024-002',
    requestId: 'TR-2024-002',
    applicantName: 'Kinzang Dema',
    origin: 'MoF Office',
    destination: 'RSTA Office',
    vehiclePlate: 'BG-1-A1234',
    scheduledTime: '01:30 PM',
    status: 'Scheduled',
  },
  {
    id: 'tr-2024-034',
    requestId: 'TR-2024-034',
    applicantName: 'Ugyen Tshering',
    origin: 'MoF Office',
    destination: 'Bank of Bhutan',
    vehiclePlate: 'BG-1-D1120',
    scheduledTime: '09:00 AM',
    status: 'Scheduled',
  },
  {
    id: 'tr-2024-004',
    requestId: 'TR-2024-004',
    applicantName: 'Dorji Wangchuk',
    origin: 'Thimphu',
    destination: 'Punakha',
    vehiclePlate: 'BG-1-C9312',
    scheduledTime: '07:00 AM',
    status: 'Scheduled',
  },
]

export function getDriverAssignmentStatus(
  id: string,
  fallback: DriverTripStatus,
): DriverTripStatus {
  return statusOverrides.get(id.trim().toLowerCase()) ?? fallback
}

export function setDriverAssignmentStatus(id: string, status: DriverTripStatus): void {
  statusOverrides.set(id.trim().toLowerCase(), status)
}

export function getDriverAssignments(): DriverAssignmentListItem[] {
  return ASSIGNMENT_SEED.map((row) => ({
    ...row,
    status: getDriverAssignmentStatus(row.id, row.status),
  }))
}

export function formatDriverRoute(origin: string, destination: string): string {
  return `${origin} → ${destination}`
}

export function filterDriverAssignments(
  rows: DriverAssignmentListItem[],
  query: string,
): DriverAssignmentListItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows
  return rows.filter((row) => {
    const haystack = [
      row.requestId,
      row.applicantName,
      row.origin,
      row.destination,
      formatDriverRoute(row.origin, row.destination),
      row.vehiclePlate,
      row.scheduledTime,
      row.status,
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}

export function getDriverAssignmentById(
  tripId: string,
): DriverAssignmentListItem | undefined {
  const key = tripId.trim().toLowerCase()
  const row = ASSIGNMENT_SEED.find(
    (item) =>
      item.id.toLowerCase() === key || item.requestId.toLowerCase() === key,
  )
  if (!row) return undefined
  return {
    ...row,
    status: getDriverAssignmentStatus(row.id, row.status),
  }
}
