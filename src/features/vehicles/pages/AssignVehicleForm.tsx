import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ASSIGNMENT_PRIORITY_OPTIONS,
  createDriverVehicleAssignment,
  fetchDriverVehicleAssignmentById,
  priorityLabelFromValue,
  updateDriverVehicleAssignment,
  type CreateDriverVehicleAssignmentBody,
} from '@/features/vehicles/lib/driver-vehicle-assignments-api'
import {
  fetchUserById,
  mapUserDetailFields,
  searchUserDetailByCid,
} from '@/features/user/lib/users-api'
import { PageHeader } from '@/shared/components/PageHeader'
import { isUuidLike } from '@/shared/lib/organogram-master-lookup'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

const formSections = [
  {
    title: 'Personal Details',
    subtitle: 'Basic information about the driver.',
    fields: [
      { key: 'citizenId', label: 'Citizen ID', placeholder: 'Enter citizen ID' },
      { key: 'fullName', label: 'Full Name', placeholder: 'Auto Fetch' },
      { key: 'employeeId', label: 'Employee ID', placeholder: 'Auto Fetch' },
      { key: 'contactNumber', label: 'Contact Number', placeholder: 'Auto Fetch' },
    ],
  },
  {
    title: 'License Information',
    subtitle: 'Driver license and certification details.',
    fields: [
      { key: 'licenseNumber', label: 'License Number', placeholder: 'Enter license number' },
      { key: 'licenseExpiryDate', label: 'License Expiry Date', placeholder: 'mm/dd/yyyy' },
    ],
  },
] as const

type DriverLookup = {
  userId: string
  fullName: string
  employeeId: string
  contactNumber: string
  citizenId: string
}

function mapUserDetailToDriverLookup(
  record: Record<string, unknown>,
): DriverLookup | null {
  const detail = mapUserDetailFields(record)
  const userId = detail.id !== '-' ? detail.id : ''
  const citizenId = detail.cid !== '-' ? detail.cid : ''
  if (!userId) return null
  return {
    userId,
    citizenId,
    fullName: detail.name !== '-' ? detail.name : '',
    employeeId: detail.employeeId !== '-' ? detail.employeeId : '',
    contactNumber: detail.contact !== '-' ? detail.contact : '',
  }
}

async function fetchDriverByCid(cid: string): Promise<DriverLookup | null> {
  const result = await searchUserDetailByCid(cid)
  if (!result) return null
  return {
    userId: result.userId,
    citizenId: result.citizenId,
    fullName: result.fullName,
    employeeId: result.employeeId,
    contactNumber: result.contactNumber,
  }
}

async function fetchDriverById(driverId: string): Promise<DriverLookup | null> {
  const trimmedId = driverId.trim()
  if (!trimmedId || trimmedId === '—') return null
  const record = await fetchUserById(trimmedId)
  return mapUserDetailToDriverLookup(record)
}

type AssignVehicleFormProps = {
  mode: 'create' | 'edit'
  assignmentId?: string
}

type AssignVehicleLocationState = {
  vehicleId?: string
}

export function AssignVehicleForm({ mode, assignmentId }: AssignVehicleFormProps) {
  const { vehicleId: routeVehicleId = '' } = useParams<{ vehicleId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const locationState = (location.state as AssignVehicleLocationState | null) ?? null
  const contextVehicleId = routeVehicleId.trim() || locationState?.vehicleId?.trim() || ''
  const isVehicleAssign = Boolean(contextVehicleId)
  const vehicleCrud = useRouteCrudPermissions('/vehicle/list')
  const assignCrud = useRouteCrudPermissions('/assign-driver')
  const isEdit = mode === 'edit'
  const crud =
    isVehicleAssign || isEdit
      ? vehicleCrud.isResolved
        ? vehicleCrud
        : assignCrud
      : assignCrud.isResolved
        ? assignCrud
        : vehicleCrud

  const [formValues, setFormValues] = useState<Record<string, string>>({
    citizenId: '',
    fullName: '',
    employeeId: '',
    contactNumber: '',
    licenseNumber: '',
    licenseExpiryDate: '',
    priority: '',
  })
  const [resolvedDriverId, setResolvedDriverId] = useState('')
  const [cidSearchTriggered, setCidSearchTriggered] = useState(false)
  const [cidLocked, setCidLocked] = useState(false)
  const [driverLookup, setDriverLookup] = useState<DriverLookup | null>(null)
  const [formInitialized, setFormInitialized] = useState(!isEdit)

  const trimmedCitizenId = formValues.citizenId.trim()

  const assignmentQuery = useQuery({
    queryKey: ['driver-vehicle-assignments', 'detail', assignmentId],
    queryFn: () => fetchDriverVehicleAssignmentById(assignmentId ?? ''),
    enabled: isEdit && Boolean(assignmentId) && crud.canRead,
    staleTime: 30_000,
  })

  const editDriverQuery = useQuery({
    queryKey: ['assign-driver', 'edit-driver', assignmentQuery.data?.driverId],
    queryFn: () => fetchDriverById(assignmentQuery.data?.driverId ?? ''),
    enabled: isEdit && Boolean(assignmentQuery.data?.driverId) && crud.canRead,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!isEdit || !assignmentQuery.data || formInitialized) return
    const assignment = assignmentQuery.data
    const driver = editDriverQuery.data
    setResolvedDriverId(assignment.driverId !== '—' ? assignment.driverId : driver?.userId ?? '')
    setFormValues({
      citizenId: driver?.citizenId || assignment.cid || '',
      fullName: driver?.fullName || assignment.name || '',
      employeeId: driver?.employeeId || '',
      contactNumber: driver?.contactNumber || '',
      licenseNumber: assignment.license !== '—' ? assignment.license : '',
      licenseExpiryDate: assignment.expiry !== '—' ? assignment.expiry : '',
      priority:
        assignment.priority !== '—'
          ? priorityLabelFromValue(assignment.priority)
          : '',
    })
    if (driver?.citizenId || assignment.cid) {
      setCidLocked(true)
      setCidSearchTriggered(true)
    }
    const needsDriverFetch = Boolean(assignment.driverId && assignment.driverId !== '—')
    const driverReady = !needsDriverFetch || editDriverQuery.isFetched
    if (driverReady) {
      setFormInitialized(true)
    }
  }, [
    assignmentQuery.data,
    editDriverQuery.data,
    editDriverQuery.isFetched,
    formInitialized,
    isEdit,
  ])

  const driverLookupMutation = useMutation({
    mutationFn: (cid: string) => fetchDriverByCid(cid),
    onSuccess: (result) => {
      if (!result) {
        setResolvedDriverId('')
        setDriverLookup(null)
        setFormValues((prev) => ({
          ...prev,
          fullName: '',
          employeeId: '',
          contactNumber: '',
        }))
        setCidLocked(false)
        return
      }
      setResolvedDriverId(result.userId)
      setDriverLookup(result)
      setFormValues((prev) => ({
        ...prev,
        fullName: result.fullName,
        employeeId: result.employeeId,
        contactNumber: result.contactNumber,
      }))
      setCidLocked(true)
    },
    onError: (error) => {
      setResolvedDriverId('')
      setDriverLookup(null)
      setFormValues((prev) => ({
        ...prev,
        fullName: '',
        employeeId: '',
        contactNumber: '',
      }))
      setCidLocked(false)
      showErrorToast(error, 'Failed to find driver by CID')
    },
  })

  const handleCitizenIdSearch = () => {
    if (!trimmedCitizenId || cidLocked || isEdit || driverLookupMutation.isPending) return
    setCidSearchTriggered(true)
    setDriverLookup(null)
    driverLookupMutation.mutate(trimmedCitizenId)
  }

  const driversListPath = contextVehicleId
    ? `/vehicle/list/${encodeURIComponent(contextVehicleId)}/drivers`
    : '/assign-driver'

  const saveMutation = useMutation({
    mutationFn: async () => {
      const driverId = isEdit
        ? resolvedDriverId || editDriverQuery.data?.userId || assignmentQuery.data?.driverId || ''
        : driverLookup?.userId ?? resolvedDriverId
      const vehicleId = isEdit
        ? assignmentQuery.data?.vehicleId !== '—'
          ? assignmentQuery.data?.vehicleId ?? ''
          : contextVehicleId
        : contextVehicleId
      if (!isUuidLike(vehicleId)) {
        throw new Error('A valid vehicle is required.')
      }
      const payload: CreateDriverVehicleAssignmentBody = {
        vehicle_id: vehicleId,
        driver_id: driverId,
        priority: formValues.priority.trim(),
        license: {
          license_number: formValues.licenseNumber.trim(),
        },
      }
      if (isEdit && assignmentId) {
        return updateDriverVehicleAssignment(assignmentId, payload)
      }
      return createDriverVehicleAssignment(payload)
    },
    onSuccess: async () => {
      showSuccessToast(isEdit ? 'Vehicle assignment updated' : 'Vehicle assignment saved')
      await queryClient.invalidateQueries({ queryKey: ['driver-vehicle-assignments'] })
      if (isEdit && assignmentId) {
        navigate(`/assign-driver/${encodeURIComponent(assignmentId)}`, {
          state: contextVehicleId ? { vehicleId: contextVehicleId } : undefined,
        })
        return
      }
      navigate(driversListPath)
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to save assignment')
    },
  })

  const canSave =
    Boolean(formValues.citizenId.trim()) &&
    Boolean(formValues.licenseNumber.trim()) &&
    Boolean(formValues.licenseExpiryDate.trim()) &&
    Boolean(formValues.priority.trim()) &&
    (isEdit || Boolean(contextVehicleId)) &&
    !saveMutation.isPending &&
    (isEdit ? formInitialized : true)

  const permissionDenied =
    crud.isResolved && (isEdit ? !crud.canUpdate : !crud.canCreate)

  const isLoadingEdit = isEdit && (assignmentQuery.isLoading || !formInitialized)

  if (permissionDenied) {
    return (
      <section className="space-y-5">
        <PageHeader
          title={isEdit ? 'Edit Assignment' : 'Assign Driver'}
          subtitle={isEdit ? 'Update driver assignment.' : 'Enter the details of the new driver.'}
        />
        <p className="text-sm text-[var(--fms-text-subheading)]">
          You do not have permission to {isEdit ? 'update' : 'create'} assignments.
        </p>
      </section>
    )
  }

  if (isEdit && (assignmentQuery.isError || (assignmentQuery.isSuccess && !assignmentQuery.data))) {
    return (
      <section className="space-y-5">
        <PageHeader title="Edit Assignment" subtitle="Update driver vehicle assignment." />
        <p className="text-sm text-[var(--fms-delete)]">Failed to load assignment.</p>
        <Button variant="outline" asChild>
          <Link to={driversListPath}>Back to list</Link>
        </Button>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <PageHeader
        title={isEdit ? 'Edit Assignment' : 'Assign Driver'}
        subtitle={isEdit ? 'Update driver vehicle assignment.' : 'Enter the details of the new driver.'}
      />

      {isLoadingEdit ? (
        <div className="space-y-4 rounded-xl border border-[var(--fms-strokes)] bg-white p-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="space-y-5 rounded-xl border border-[var(--fms-strokes)] bg-white p-4">
          {formSections.map((section) => (
            <Card key={section.title} className="border border-[var(--fms-strokes)] bg-white">
              <CardContent className="space-y-4 pt-5">
                <div>
                  <p className="text-base font-semibold text-[var(--fms-text-header)]">{section.title}</p>
                  <p className="text-xs text-[var(--fms-text-subheading)]">{section.subtitle}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {section.fields.map((field) => {
                    const isReadonlyField =
                      field.key === 'fullName' || field.key === 'employeeId' || field.key === 'contactNumber'
                    if (field.key === 'citizenId') {
                      return (
                        <div key={field.key} className="space-y-2">
                          <Label htmlFor={field.key}>
                            {field.label} <span className="text-[var(--fms-delete)]">*</span>
                          </Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id={field.key}
                              value={formValues[field.key] ?? ''}
                              onChange={(event) => {
                                if (isEdit) return
                                const nextCid = event.target.value
                                setFormValues((prev) => ({
                                  ...prev,
                                  citizenId: nextCid,
                                  fullName: '',
                                  employeeId: '',
                                  contactNumber: '',
                                }))
                                setCidSearchTriggered(false)
                                setDriverLookup(null)
                                setCidLocked(false)
                                setResolvedDriverId('')
                              }}
                              placeholder={field.placeholder}
                              readOnly={isEdit}
                            />
                            {!isEdit ? (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleCitizenIdSearch}
                                disabled={
                                  !trimmedCitizenId || cidLocked || driverLookupMutation.isPending
                                }
                              >
                                Search
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      )
                    }

                    return (
                      <div key={field.key} className="space-y-2">
                        <Label htmlFor={field.key}>
                          {field.label} <span className="text-[var(--fms-delete)]">{field.label === 'Employee ID' ? '' : '*'}</span>
                        </Label>
                        <Input
                          id={field.key}
                          value={formValues[field.key] ?? ''}
                          onChange={(event) =>
                            setFormValues((prev) => ({ ...prev, [field.key]: event.target.value }))
                          }
                          placeholder={field.placeholder}
                          readOnly={isReadonlyField}
                        />
                      </div>
                    )
                  })}
                  {section.title === 'License Information' ? (
                    <div className="space-y-2">
                      <Label htmlFor="priority">
                        Priority <span className="text-[var(--fms-delete)]">*</span>
                      </Label>
                      <Select
                        value={formValues.priority}
                        onValueChange={(value) => setFormValues((prev) => ({ ...prev, priority: value }))}
                      >
                        <SelectTrigger id="priority">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          {ASSIGNMENT_PRIORITY_OPTIONS.map((priority) => (
                            <SelectItem key={priority.label} value={priority.label}>
                              {priority.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>

                {section.title === 'Personal Details' && cidSearchTriggered && !isEdit ? (
                  <p
                    className={`text-xs ${!driverLookupMutation.isPending && !driverLookup
                        ? 'text-[var(--fms-delete)]'
                        : 'text-[var(--fms-text-subheading)]'
                      }`}
                  >
                    {driverLookupMutation.isPending
                      ? 'Fetching user details by CID...'
                      : driverLookup
                        ? 'User details auto-filled from user list.'
                        : 'No driver found for this CID in the system, or the user CID is not part of the same agency.'}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}

          <div className="flex items-center gap-3">
            <Button variant="destructive" asChild>
              <Link to={isEdit && assignmentId ? `/assign-driver/${encodeURIComponent(assignmentId)}` : driversListPath}>
                Close
              </Link>
            </Button>
            <Button type="button" onClick={() => saveMutation.mutate()} disabled={!canSave}>
              {saveMutation.isPending ? 'Saving...' : isEdit ? 'Update' : 'Save'}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
