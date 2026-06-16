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
      row.applicantAgency,
      row.applicantDepartment,
      row.tripType,
      row.origin,
      row.destination,
      formatDriverRoute(row.origin, row.destination),
      row.vehiclePlate,
      row.journeyStartDate,
      row.journeyStartTime,
      row.status,
      row.statusCode,
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}
