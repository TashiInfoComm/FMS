export type TripRequestPriority = 'Normal' | 'High' | 'Low'

export type TripRequestStatus = 'Pending Review' | 'Approved' | 'Rejected'

export type TripSuggestedVehicle = {
  plateNumber: string
  model: string
  fuelEfficiency: string
  color: string
}

export type TripSuggestedDriver = {
  name: string
  rating: number
  contact: string
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
  dateOfJourney: string
  timeOfJourney: string
  suggestedVehicle: TripSuggestedVehicle
  suggestedDriver: TripSuggestedDriver
  priority: TripRequestPriority
  status: TripRequestStatus
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
  movementOrderFileName?: string
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
    movementOrderFileName: 'movement-order-tr-2026-001.pdf',
    suggestedVehicle: {
      plateNumber: 'BG-1-A1234',
      model: 'Toyota Hilux',
      fuelEfficiency: '12 km/l',
      color: 'White',
    },
    suggestedDriver: {
      name: 'Pema Wangdi',
      rating: 4.5,
      contact: '17854321',
    },
    priority: 'Normal',
    status: 'Pending Review',
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
    dateOfJourney: '05-May-2026',
    timeOfJourney: '02:00 PM',
    pickupRequired: true,
    remarks: 'Return pickup required after the session ends at 5:30 PM.',
    accompanyingOfficials: [],
    suggestedVehicle: {
      plateNumber: 'BG-1-B5678',
      model: 'Hyundai Elantra',
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
    dateOfJourney: '12-May-2026',
    timeOfJourney: '10:15 AM',
    pickupRequired: true,
    remarks: 'Delegate arrival on Drukair KB204.',
    accompanyingOfficials: [{ employeeCid: '11501003321', fullName: 'Dechen Zam' }],
    suggestedVehicle: {
      plateNumber: 'BG-1-C9012',
      model: 'Toyota Corolla',
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
    movementOrderFileName: 'movement-order-tr-2026-004.pdf',
    suggestedVehicle: {
      plateNumber: 'BG-1-A2210',
      model: 'Toyota Hilux',
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
  return `${origin} to ${destination}`
}

export function formatTripDateTime(date: string, time: string): string {
  return `${date}, ${time}`
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

export function computeTripRequestSummary(rows: TripRequestListItem[]) {
  const pending = rows.filter((r) => r.status === 'Pending Review').length
  const longTrips = rows.filter((r) => r.tripType.toLowerCase().includes('long')).length
  const localOrPickDrop = rows.filter(
    (r) =>
      r.tripType.toLowerCase().includes('local') ||
      r.tripType.toLowerCase().includes('pick'),
  ).length
  const highPriority = rows.filter((r) => r.priority === 'High').length
  return { pending, longTrips, localOrPickDrop, highPriority }
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
      formatTripRoute(row.origin, row.destination),
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
