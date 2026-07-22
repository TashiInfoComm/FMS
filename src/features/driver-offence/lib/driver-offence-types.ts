export type DriverOffenceStatus = 'UNPAID' | 'PAID'

export type DriverOffenceListRow = {
  id: string
  offenceDate: string
  offence: string
  amount: number
  status: DriverOffenceStatus
}

export type DriverOffenceDetail = {
  id: string
  driverName: string
  employeeId: string
  licenseNumber: string
  agency: string
  vehicleNumber: string
  vehicleType: string
  offenceDateTime: string
  offenceLocation: string
  offenceDetails: string
  fineAmount: number
  status: DriverOffenceStatus
  source: string
}
