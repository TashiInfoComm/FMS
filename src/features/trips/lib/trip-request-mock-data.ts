export type TripRequestPriority = 'Normal' | 'High' | 'Low'

export type TripRequestStatus = string

export type TripSuggestedVehicle = {
  plateNumber: string
  make: string
  model: string
  fuelEfficiency: string
  color: string
}

export type TripSuggestedDriver = {
  name: string
  rating: number
  contact: string
  licenseNumber?: string
}

export function formatSuggestedVehicleMakeModel(vehicle: TripSuggestedVehicle): string {
  const parts = [vehicle.make, vehicle.model].filter((part) => part && part !== '—')
  if (parts.length > 0) return parts.join(' ')
  return '—'
}

export type TripAccompanyingOfficial = {
  employeeCid: string
  fullName: string
}

export type TripRequestListItem = {
  id: string
  requestId: string
  applicantName: string
  applicantDepartment: string
  tripType: string
  origin: string
  destination: string
  route: string
  dateOfJourney: string
  timeOfJourney: string
  suggestedVehicle: TripSuggestedVehicle
  suggestedDriver: TripSuggestedDriver
  priority: TripRequestPriority
  status: TripRequestStatus
  statusCode: string
  hasFeedback: boolean
}

export type TripRequestDetail = TripRequestListItem & {
  employeeId: string
  designation: string
  agency: string
  department: string
  division: string
  subDivision: string
  contactNumber: string
  email: string
  purposeOfJourney: string
  preferredVehicleType: string
  dateOfReturn?: string
  tripDurationDays?: number
  pickupRequired?: boolean
  remarks: string
  tripDetailsJustification?: string
  accompanyingOfficials: TripAccompanyingOfficial[]
  movementOrderFile?: {
    name: string
    sizeLabel?: string
    url?: string
  }
}

export const TRIP_REQUEST_MOCK_ROWS: TripRequestDetail[] = [
  {
    id: 'tr-2026-001',
    requestId: 'TR-2026-001',
    applicantName: 'Kinzang Dema',
    applicantDepartment: 'Department of Revenue & Customs',
    employeeId: 'EMP-10452',
    designation: 'Senior Revenue Officer',
    agency: 'Ministry of Finance',
    department: 'Department of Revenue & Customs',
    division: 'Domestic Tax Division',
    subDivision: 'Thimphu Region',
    contactNumber: '17751234',
    email: 'kinzang.dema@mof.gov.bt',
    tripType: 'Long Trip',
    purposeOfJourney: 'Official inspection and coordination',
    preferredVehicleType: 'SUV / Pickup',
    origin: 'Thimphu',
    destination: 'Punakha',
    route: 'Thimphu -> Punakha',
    dateOfJourney: '30-Apr-2026',
    timeOfJourney: '09:30 AM',
    dateOfReturn: '02-May-2026',
    tripDurationDays: 3,
    remarks: 'Requires overnight stay at Punakha guest house.',
    tripDetailsJustification:
      'Field verification of revenue collection posts and coordination with regional office.',
    accompanyingOfficials: [
      { employeeCid: '11501004567', fullName: 'Sonam Dorji' },
      { employeeCid: '11501007890', fullName: 'Pema Lhamo' },
    ],
    movementOrderFile: {
      name: 'movement-order-tr-2026-001.pdf',
      sizeLabel: '248 KB',
    },
    suggestedVehicle: {
      plateNumber: 'BG-1-A1234',
      make: 'Toyota',
      model: 'Hilux',
      fuelEfficiency: '12 km/l',
      color: 'White',
    },
    suggestedDriver: {
      name: 'Pema Wangdi',
      rating: 4.5,
      contact: '17854321',
      licenseNumber: 'DL-12345',
    },
    priority: 'Normal',
    status: 'Pending Review',
    statusCode: 'PLANNED',
    hasFeedback: false,
  },
  {
    id: 'tr-2026-002',
    requestId: 'TR-2026-002',
    applicantName: 'Tashi Choden',
    applicantDepartment: 'Budget Department',
    employeeId: 'EMP-10891',
    designation: 'Budget Analyst',
    agency: 'Ministry of Finance',
    department: 'Budget Department',
    division: 'Capital Budget Division',
    subDivision: 'Planning Unit',
    contactNumber: '17659876',
    email: 'tashi.choden@mof.gov.bt',
    tripType: 'Local Trip',
    purposeOfJourney: 'Conference attendance',
    preferredVehicleType: 'Sedan',
    origin: 'MoF Office',
    destination: 'GovTech Conference Hall',
    route: 'MoF Office -> GovTech Conference Hall',
    dateOfJourney: '05-May-2026',
    timeOfJourney: '02:00 PM',
    pickupRequired: true,
    remarks: 'Return pickup required after the session ends at 5:30 PM.',
    accompanyingOfficials: [],
    suggestedVehicle: {
      plateNumber: 'BG-1-B5678',
      make: 'Hyundai',
      model: 'Elantra',
      fuelEfficiency: '14 km/l',
      color: 'Silver',
    },
    suggestedDriver: {
      name: 'Karma Wangmo',
      rating: 4.2,
      contact: '17723456',
    },
    priority: 'Low',
    status: 'Pending Review',
    statusCode: 'PLANNED',
    hasFeedback: false,
  },
  {
    id: 'tr-2026-003',
    requestId: 'TR-2026-003',
    applicantName: 'Ugyen Tshering',
    applicantDepartment: 'Macroeconomic Affairs',
    employeeId: 'EMP-11203',
    designation: 'Economist',
    agency: 'Ministry of Finance',
    department: 'Macroeconomic Affairs',
    division: 'Fiscal Policy Division',
    subDivision: 'Analysis Unit',
    contactNumber: '17567890',
    email: 'ugyen.tshering@mof.gov.bt',
    tripType: 'Pick and Drop',
    purposeOfJourney: 'Airport transfer for visiting delegate',
    preferredVehicleType: 'Sedan',
    origin: 'Paro International Airport',
    destination: 'MoF Office',
    route: 'Paro International Airport -> MoF Office',
    dateOfJourney: '12-May-2026',
    timeOfJourney: '10:15 AM',
    pickupRequired: true,
    remarks: 'Delegate arrival on Drukair KB204.',
    accompanyingOfficials: [{ employeeCid: '11501003321', fullName: 'Dechen Zam' }],
    suggestedVehicle: {
      plateNumber: 'BG-1-C9012',
      make: 'Toyota',
      model: 'Corolla',
      fuelEfficiency: '15 km/l',
      color: 'Black',
    },
    suggestedDriver: {
      name: 'Sonam Tenzin',
      rating: 4.8,
      contact: '17854321',
    },
    priority: 'Normal',
    status: 'Pending Review',
    statusCode: 'PLANNED',
    hasFeedback: false,
  },
  {
    id: 'tr-2026-004',
    requestId: 'TR-2026-004',
    applicantName: 'Dorji Wangchuk',
    applicantDepartment: 'Public Finance Management',
    employeeId: 'EMP-11567',
    designation: 'Deputy Director',
    agency: 'Ministry of Finance',
    department: 'Public Finance Management',
    division: 'Treasury Division',
    subDivision: 'Payments Unit',
    contactNumber: '17456789',
    email: 'dorji.wangchuk@mof.gov.bt',
    tripType: 'Long Trip',
    purposeOfJourney: 'Emergency coordination — flood response',
    preferredVehicleType: 'SUV / Pickup',
    origin: 'Thimphu',
    destination: 'Gelephu',
    route: 'Thimphu -> Gelephu',
    dateOfJourney: '18-May-2026',
    timeOfJourney: '06:00 AM',
    dateOfReturn: '20-May-2026',
    tripDurationDays: 2,
    remarks: 'Urgent travel for disaster assessment.',
    tripDetailsJustification:
      'Immediate field assessment and release of contingency funds for affected gewogs.',
    accompanyingOfficials: [
      { employeeCid: '11501009987', fullName: 'Kinley Norbu' },
    ],
    movementOrderFile: {
      name: 'movement-order-tr-2026-004.pdf',
      sizeLabel: '312 KB',
    },
    suggestedVehicle: {
      plateNumber: 'BG-1-A2210',
      make: 'Toyota',
      model: 'Hilux',
      fuelEfficiency: '12 km/l',
      color: 'White',
    },
    suggestedDriver: {
      name: 'Sonam Tenzin',
      rating: 4.8,
      contact: '17854321',
    },
    priority: 'High',
    status: 'Pending Review',
    statusCode: 'PLANNED',
    hasFeedback: false,
  },
]

export const TRIP_OVERRIDE_VEHICLE_TYPES = [
  { value: 'sedan', label: 'Sedan' },
  { value: 'suv', label: 'SUV' },
  { value: 'pickup', label: 'Pickup' },
] as const

export const TRIP_OVERRIDE_VEHICLE_CATEGORIES = [
  { value: 'official', label: 'Official' },
  { value: 'pool', label: 'Pool Vehicle' },
  { value: 'rental', label: 'Rental' },
] as const

export const TRIP_OVERRIDE_VEHICLES = [
  { value: 'bg-1-a1234', label: 'BG-1-A1234 · Toyota Hilux' },
  { value: 'bg-1-a2210', label: 'BG-1-A2210 · Toyota Hilux' },
  { value: 'bg-1-b5678', label: 'BG-1-B5678 · Hyundai Elantra' },
  { value: 'bg-1-c9012', label: 'BG-1-C9012 · Toyota Corolla' },
] as const

export const TRIP_OVERRIDE_DRIVERS = [
  { value: 'pema-wangdi', label: 'Pema Wangdi · 17854321' },
  { value: 'sonam-tenzin', label: 'Sonam Tenzin · 17854321' },
  { value: 'karma-wangmo', label: 'Karma Wangmo · 17723456' },
  { value: 'sonam-dorji', label: 'Sonam Dorji · 17651234' },
] as const

export function formatTripRoute(origin: string, destination: string): string {
  const from = origin.trim()
  const to = destination.trim()
  if (from && from !== '—' && to && to !== '—') return `${from} -> ${to}`
  if (from && from !== '—') return from
  if (to && to !== '—') return to
  return '—'
}

export function formatTripDateTime(date: string, time: string): string {
  const datePart = date.trim()
  const timePart = time.trim()
  if ((!datePart || datePart === '—') && (!timePart || timePart === '—')) return '—'
  if (!datePart || datePart === '—') return timePart
  if (!timePart || timePart === '—') return datePart
  return `${datePart}, ${timePart}`
}

export function formatSuggestedAssignment(
  vehicle: TripSuggestedVehicle,
  driver: TripSuggestedDriver,
): string {
  return `${vehicle.plateNumber} · ${vehicle.model} · ${vehicle.fuelEfficiency} — ${driver.name} · Rating ${driver.rating}/5`
}

export function getTripRequestById(id: string): TripRequestDetail | undefined {
  const key = id.trim().toLowerCase()
  return TRIP_REQUEST_MOCK_ROWS.find(
    (row) => row.id.toLowerCase() === key || row.requestId.toLowerCase() === key,
  )
}

export type TripRequestsSummary = {
  pendingReview: number
  autoApproved: number
  completedToday: number
  inProgress: number
  mtoRequired: number
  byStatus: Record<string, number>
}

export function formatTripSummaryStatusLabel(status: string): string {
  return status
    .trim()
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function computeTripRequestSummary(rows: TripRequestListItem[]): TripRequestsSummary {
  const byStatus: Record<string, number> = {}
  for (const row of rows) {
    const code = row.statusCode.trim().toUpperCase() || row.status.trim().toUpperCase()
    if (!code || code === '—') continue
    byStatus[code] = (byStatus[code] ?? 0) + 1
  }

  return {
    pendingReview: byStatus.PLANNED ?? byStatus.DRAFT ?? 0,
    autoApproved: 0,
    completedToday: byStatus.COMPLETED ?? 0,
    inProgress: (byStatus.IN_PROGRESS ?? 0) + (byStatus.STARTED ?? 0),
    mtoRequired: 0,
    byStatus,
  }
}

export type TripRequisitionMockRow = {
  id: string
  serialNo: number
  tripType: string
  purpose: string
  journeyDate: string
  origin: string
  destination: string
  status: string
}

export function mapTripRequestsToRequisitionRows(
  rows: TripRequestDetail[],
): TripRequisitionMockRow[] {
  return rows.map((row, index) => ({
    id: row.id,
    serialNo: index + 1,
    tripType: row.tripType,
    purpose: row.purposeOfJourney,
    journeyDate: row.dateOfJourney,
    origin: row.origin,
    destination: row.destination,
    status: row.status,
  }))
}

export const TRIP_REQUISITION_MOCK_ROWS = mapTripRequestsToRequisitionRows(
  TRIP_REQUEST_MOCK_ROWS,
)

export function filterTripRequests(
  rows: TripRequestListItem[],
  query: string,
): TripRequestListItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows
  return rows.filter((row) => {
    const haystack = [
      row.requestId,
      row.applicantName,
      row.applicantDepartment,
      row.tripType,
      row.origin,
      row.destination,
      row.route,
      formatTripDateTime(row.dateOfJourney, row.timeOfJourney),
      row.status,
      row.priority,
      row.suggestedVehicle.plateNumber,
      row.suggestedDriver.name,
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}
