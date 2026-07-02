import { ArrowLeft, Pencil } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DetailInlineValueSkeleton } from '@/shared/components/detail-loading'
import {
  fetchDriverVehicleAssignmentById,
  priorityLabelFromValue,
} from '@/features/vehicles/lib/driver-vehicle-assignments-api'
import { apiGet } from '@/services/apiClient'
import { PageHeader } from '@/shared/components/PageHeader'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'

type ApiRecord = Record<string, unknown>

function toText(value: unknown): string {
  return typeof value === 'string'
    ? value.trim()
    : typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : ''
}

function pickCid(record: ApiRecord): string {
  return (
    toText(record.cid) ||
    toText(record.citizen_id) ||
    toText(record.citizenId) ||
    toText(record.cid_no) ||
    toText(record.cidNumber) ||
    toText(record.cid_number) ||
    ''
  )
}

type DriverDetail = {
  name: string
  cid: string
  employeeId: string
  contactNumber: string
}

async function fetchDriverDetailById(driverId: string): Promise<DriverDetail> {
  const payload = await apiGet<unknown>(`/admin/users/${encodeURIComponent(driverId)}`)
  const record =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? ((payload as ApiRecord).data &&
          typeof (payload as ApiRecord).data === 'object' &&
          !Array.isArray((payload as ApiRecord).data)
          ? ((payload as ApiRecord).data as ApiRecord)
          : (payload as ApiRecord))
      : {}
  const firstName = toText(record.first_name) || toText(record.firstName)
  const middleName = toText(record.middle_name) || toText(record.middleName)
  const lastName = toText(record.last_name) || toText(record.lastName)
  const fullName =
    toText(record.name) || toText(record.full_name) || [firstName, middleName, lastName].filter(Boolean).join(' ').trim()
  return {
    name: fullName || '—',
    cid: pickCid(record) || '—',
    employeeId:
      toText(record.employee_id) || toText(record.emp_id) || toText(record.employeeId) || toText(record.username) || '—',
    contactNumber:
      toText(record.contact_no) ||
      toText(record.contact_number) ||
      toText(record.contact) ||
      toText(record.phone) ||
      toText(record.mobile) ||
      '—',
  }
}

async function fetchVehicleDetailById(vehicleId: string): Promise<string> {
  const payload = await apiGet<unknown>(`/vehicles/${encodeURIComponent(vehicleId)}`)
  const record =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? ((payload as ApiRecord).data &&
          typeof (payload as ApiRecord).data === 'object' &&
          !Array.isArray((payload as ApiRecord).data)
          ? ((payload as ApiRecord).data as ApiRecord)
          : (payload as ApiRecord))
      : {}
  const registration =
    toText(record.registration_number) || toText(record.vehicle_number) || toText(record.registrationNo)
  const makeModel =
    toText(record.makeModel) ||
    [toText(record.make), toText(record.model)].filter(Boolean).join(' ').trim() ||
    toText(record.model_name)

  if (registration && makeModel) return `${registration} (${makeModel})`
  return registration || makeModel || '—'
}

type DetailField = { label: string; value: string; loading?: boolean }

function DetailSection({ title, subtitle, fields }: { title: string; subtitle: string; fields: DetailField[] }) {
  return (
    <Card className="border border-[var(--fms-strokes)] bg-white">
      <CardContent className="space-y-4 pt-5">
        <div>
          <p className="text-base font-semibold text-[var(--fms-text-header)]">{title}</p>
          <p className="text-xs text-[var(--fms-text-subheading)]">{subtitle}</p>
        </div>
        <dl className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {fields.map((field) => (
            <div key={field.label} className="space-y-1">
              <dt className="text-xs font-medium text-[var(--fms-text-subheading)]">{field.label}</dt>
              <dd className="text-sm text-[var(--fms-text-header)]">
                {field.loading ? (
                  <DetailInlineValueSkeleton />
                ) : (
                  field.value || '—'
                )}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}

export function AssignVehicleDetailPage() {
  const { assignmentId = '' } = useParams()
  const location = useLocation()
  const locationState = (location.state as { vehicleId?: string } | null) ?? null
  const vehicleCrud = useRouteCrudPermissions('/vehicle/list')
  const assignCrud = useRouteCrudPermissions('/assign-driver')
  const crud = vehicleCrud.isResolved ? vehicleCrud : assignCrud

  const assignmentQuery = useQuery({
    queryKey: ['driver-vehicle-assignments', 'detail', assignmentId],
    queryFn: () => fetchDriverVehicleAssignmentById(assignmentId),
    enabled: Boolean(assignmentId) && crud.canRead,
    staleTime: 30_000,
  })

  const assignment = assignmentQuery.data
  const driverId = assignment?.driverId && assignment.driverId !== '—' ? assignment.driverId : ''
  const vehicleId =
    assignment?.vehicleId && assignment.vehicleId !== '—'
      ? assignment.vehicleId
      : locationState?.vehicleId?.trim() || ''
  const driversListPath = vehicleId
    ? `/vehicle/list/${encodeURIComponent(vehicleId)}/drivers`
    : '/assign-driver'

  const driverQuery = useQuery({
    queryKey: ['driver-vehicle-assignments', 'detail-driver', driverId],
    queryFn: () => fetchDriverDetailById(driverId),
    enabled: Boolean(driverId) && crud.canRead,
    staleTime: 30_000,
  })

  const vehicleQuery = useQuery({
    queryKey: ['driver-vehicle-assignments', 'detail-vehicle', vehicleId],
    queryFn: () => fetchVehicleDetailById(vehicleId),
    enabled: Boolean(vehicleId) && crud.canRead,
    staleTime: 30_000,
  })

  const driverName = driverQuery.data?.name || assignment?.name || '—'
  const driverCid = driverQuery.data?.cid || assignment?.cid || '—'
  const assignedVehicle =
    vehicleQuery.data || (assignment?.assignedVehicle !== '—' ? assignment?.assignedVehicle : '—') || '—'

  if (crud.isResolved && !crud.canRead) {
    return (
      <section className="space-y-5">
        <PageHeader title="Assignment Detail" subtitle="Driver vehicle assignment information." />
        <p className="text-sm text-[var(--fms-text-subheading)]">You do not have permission to view this data.</p>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title="Assignment Detail" subtitle="Driver vehicle assignment information." />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild className="w-full sm:w-auto">
            <Link to={driversListPath}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to list
            </Link>
          </Button>
          {crud.canUpdate && assignmentId ? (
            <Button asChild className="w-full sm:w-auto">
              <Link
                to={`/assign-driver/${encodeURIComponent(assignmentId)}/edit`}
                state={vehicleId ? { vehicleId } : undefined}
              >
                <Pencil className="mr-1 h-4 w-4" />
                Edit
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {assignmentQuery.isLoading ? (
        <div className="space-y-5 rounded-xl border border-[var(--fms-strokes)] bg-white p-4">
          <DetailSection
            title="Personal Details"
            subtitle="Basic information about the driver."
            fields={[
              { label: 'Citizen ID', value: '', loading: true },
              { label: 'Full Name', value: '', loading: true },
              { label: 'Employee ID', value: '', loading: true },
              { label: 'Contact Number', value: '', loading: true },
            ]}
          />
          <DetailSection
            title="License Information"
            subtitle="Driver license and certification details."
            fields={[
              { label: 'License Number', value: '', loading: true },
              { label: 'License Expiry Date', value: '', loading: true },
            ]}
          />
          <DetailSection
            title="Assignment & Priority"
            subtitle="Vehicle assignment and driver availability."
            fields={[
              { label: 'Assigned Vehicle', value: '', loading: true },
              { label: 'Priority', value: '', loading: true },
              { label: 'Assignment Status', value: '', loading: true },
              { label: 'Available Status', value: '', loading: true },
              { label: 'Rating', value: '', loading: true },
            ]}
          />
        </div>
      ) : assignmentQuery.isError || !assignment ? (
        <Card className="border border-[var(--fms-strokes)] bg-white">
          <CardContent className="py-8 text-center text-sm text-[var(--fms-delete)]">
            Failed to load assignment details.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5 rounded-xl border border-[var(--fms-strokes)] bg-white p-4">
          <DetailSection
            title="Personal Details"
            subtitle="Basic information about the driver."
            fields={[
              { label: 'Citizen ID', value: driverCid, loading: driverQuery.isLoading },
              { label: 'Full Name', value: driverName, loading: driverQuery.isLoading },
              {
                label: 'Employee ID',
                value: driverQuery.data?.employeeId ?? '—',
                loading: driverQuery.isLoading,
              },
              {
                label: 'Contact Number',
                value: driverQuery.data?.contactNumber ?? '—',
                loading: driverQuery.isLoading,
              },
            ]}
          />
          <DetailSection
            title="License Information"
            subtitle="Driver license and certification details."
            fields={[
              { label: 'License Number', value: assignment.license },
              { label: 'License Expiry Date', value: assignment.expiry },
            ]}
          />
          <DetailSection
            title="Assignment & Priority"
            subtitle="Vehicle assignment and driver availability."
            fields={[
              {
                label: 'Assigned Vehicle',
                value: assignedVehicle,
                loading: vehicleQuery.isLoading,
              },
              { label: 'Priority', value: priorityLabelFromValue(assignment.priority) },
              { label: 'Assignment Status', value: assignment.status },
              { label: 'Available Status', value: assignment.availability_status },
              { label: 'Rating', value: assignment.rating },
            ]}
          />
        </div>
      )}
    </section>
  )
}
