import { useParams } from 'react-router-dom'

import { AssignVehicleForm } from '@/features/vehicles/pages/AssignVehicleForm'

export function AssignVehicleEditPage() {
  const { assignmentId = '' } = useParams()
  return <AssignVehicleForm mode="edit" assignmentId={assignmentId} />
}
