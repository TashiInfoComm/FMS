export type DriverAssignmentListItem = {
  id: string
  requestId: string
  applicantName: string
  applicantAgency: string
  applicantDepartment: string
  tripType: string
  origin: string
  destination: string
  vehiclePlate: string
  journeyStartDate: string
  journeyStartTime: string
  status: string
  statusCode: string
  hasFeedback: boolean
}

export function formatDriverRoute(origin: string, destination: string): string {
  return `${origin} → ${destination}`
}
