import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
import { apiGet } from '@/services/apiClient'
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

type ApiRecord = Record<string, unknown>

function toText(value: unknown): string {
  return typeof value === 'string'
    ? value.trim()
    : typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : ''
}

function toArray(payload: unknown): ApiRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is ApiRecord => !!item && typeof item === 'object')
  }
  if (!payload || typeof payload !== 'object') return []
  const root = payload as ApiRecord
  const data = root.data
  const candidates = [
    root.items,
    root.results,
    root.rows,
    root.users,
    root.list,
    Array.isArray(data) ? data : undefined,
    data && typeof data === 'object' && !Array.isArray(data) ? (data as ApiRecord).items : undefined,
    data && typeof data === 'object' && !Array.isArray(data) ? (data as ApiRecord).users : undefined,
    data && typeof data === 'object' && !Array.isArray(data) ? (data as ApiRecord).results : undefined,
  ]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is ApiRecord => !!item && typeof item === 'object')
    }
  }
  return []
}

type DriverLookup = {
  userId: string
  fullName: string
  employeeId: string
  contactNumber: string
  citizenId: string
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

function mapUserToDriverLookup(row: ApiRecord): DriverLookup | null {
  const user = row.user && typeof row.user === 'object' && !Array.isArray(row.user) ? (row.user as ApiRecord) : {}
  const merged = { ...row, ...user }
  const userId = toText(merged.id) || toText(merged.user_id) || toText(merged.uuid)
  if (!userId) return null
  const firstName = toText(merged.first_name) || toText(merged.firstName)
  const middleName = toText(merged.middle_name) || toText(merged.middleName)
  const lastName = toText(merged.last_name) || toText(merged.lastName)
  const fullName =
    toText(merged.name) ||
    toText(merged.full_name) ||
    [firstName, middleName, lastName].filter(Boolean).join(' ').trim()
  const employeeId =
    toText(merged.employee_id) || toText(merged.emp_id) || toText(merged.employeeId) || toText(merged.username)
  const contactNumber =
    toText(merged.contact_no) ||
    toText(merged.contact_number) ||
    toText(merged.contact) ||
    toText(merged.phone) ||
    toText(merged.mobile)
  return {
    userId,
    fullName,
    employeeId,
    contactNumber,
    citizenId: pickCid(merged),
  }
}

async function fetchDriverByCid(cid: string): Promise<DriverLookup | null> {
  const trimmedCid = cid.trim()
  if (!trimmedCid) return null
  const params = new URLSearchParams()
  params.set('page', '1')
  params.set('page_size', '20')
  params.set('search', trimmedCid)
  const payload = await apiGet<unknown>(`/admin/users?${params.toString()}`)
  return (
    toArray(payload)
      .map(mapUserToDriverLookup)
      .find((row): row is DriverLookup => Boolean(row)) ?? null
  )
}

async function fetchDriverById(driverId: string): Promise<DriverLookup | null> {
  const trimmedId = driverId.trim()
  if (!trimmedId || trimmedId === '—') return null
  const payload = await apiGet<unknown>(`/admin/users/${encodeURIComponent(trimmedId)}`)
  const record =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? ((payload as ApiRecord).data &&
          typeof (payload as ApiRecord).data === 'object' &&
          !Array.isArray((payload as ApiRecord).data)
          ? ((payload as ApiRecord).data as ApiRecord)
          : (payload as ApiRecord))
      : {}
  return mapUserToDriverLookup(record)
}

type AssignVehicleFormProps = {
  mode: 'create' | 'edit'
  assignmentId?: string
}

export function AssignVehicleForm({ mode, assignmentId }: AssignVehicleFormProps) {
  const { vehicleId: routeVehicleId = '' } = useParams<{ vehicleId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const crud = useRouteCrudPermissions('/assign-driver')
  const isEdit = mode === 'edit'

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
  const [lookupCid, setLookupCid] = useState('')
  const [cidSearchTriggered, setCidSearchTriggered] = useState(false)
  const [cidLocked, setCidLocked] = useState(false)
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

  const driverLookupQuery = useQuery({
    queryKey: ['assign-driver', 'lookup-by-cid', lookupCid],
    queryFn: () => fetchDriverByCid(lookupCid),
    enabled: lookupCid.length > 0 && crud.canRead && !isEdit,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (isEdit) return
    if (driverLookupQuery.data) {
      setResolvedDriverId(driverLookupQuery.data.userId)
      setFormValues((prev) => ({
        ...prev,
        fullName: driverLookupQuery.data?.fullName ?? '',
        employeeId: driverLookupQuery.data?.employeeId ?? '',
        contactNumber: driverLookupQuery.data?.contactNumber ?? '',
      }))
      setCidLocked(true)
      return
    }

    if (cidSearchTriggered && !driverLookupQuery.isLoading) {
      setResolvedDriverId('')
      setFormValues((prev) => ({
        ...prev,
        fullName: '',
        employeeId: '',
        contactNumber: '',
      }))
      setCidLocked(false)
    }
  }, [cidSearchTriggered, driverLookupQuery.data, driverLookupQuery.isLoading, isEdit])

  const driversListPath = routeVehicleId.trim()
    ? `/vehicle/list/${encodeURIComponent(routeVehicleId.trim())}/drivers`
    : '/assign-driver'

  const handleCitizenIdSearch = () => {
    if (!trimmedCitizenId || cidLocked || isEdit) return
    setCidSearchTriggered(true)
    setLookupCid(trimmedCitizenId)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const driverId = isEdit
        ? resolvedDriverId || editDriverQuery.data?.userId || assignmentQuery.data?.driverId || ''
        : driverLookupQuery.data?.userId ?? resolvedDriverId
      const vehicleId = isEdit
        ? assignmentQuery.data?.vehicleId !== '—'
          ? assignmentQuery.data?.vehicleId ?? ''
          : routeVehicleId.trim()
        : routeVehicleId.trim()
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
        navigate(`/assign-driver/${encodeURIComponent(assignmentId)}`)
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
    (isEdit || Boolean(routeVehicleId.trim())) &&
    !saveMutation.isPending &&
    (isEdit ? formInitialized : true)

  const permissionDenied =
    crud.isResolved && (isEdit ? !crud.canUpdate : !crud.canCreate)

  const isLoadingEdit = isEdit && (assignmentQuery.isLoading || !formInitialized)

  if (permissionDenied) {
    return (
      <section className="space-y-5">
        <PageHeader
          title={isEdit ? 'Edit Assignment' : 'Assign Vehicle'}
          subtitle={isEdit ? 'Update driver vehicle assignment.' : 'Enter the details of the new driver.'}
        />
        <p className="text-sm text-[var(--fms-text-subheading)]">
          You do not have permission to {isEdit ? 'update' : 'create'} assignments.
        </p>
      </section>
    )
  }

  if (isEdit && assignmentQuery.isError) {
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
        title={isEdit ? 'Edit Assignment' : 'Assign Vehicle'}
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
                                setLookupCid('')
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
                                disabled={!trimmedCitizenId || cidLocked || driverLookupQuery.isLoading}
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
                          {field.label} <span className="text-[var(--fms-delete)]">*</span>
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
                    className={`text-xs ${
                      !driverLookupQuery.isLoading && !driverLookupQuery.data
                        ? 'text-[var(--fms-delete)]'
                        : 'text-[var(--fms-text-subheading)]'
                    }`}
                  >
                    {driverLookupQuery.isLoading
                      ? 'Fetching user details by CID...'
                      : driverLookupQuery.data
                        ? 'User details auto-filled from user list.'
                        : 'No Driver found for this CID in the system.'}
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
