import {
  Calendar,
  Car,
  CarFront,
  CheckCircle2,
  CloudUpload,
  MapPin,
  Plus,
  Target,
  Trash2,
  User,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableAutocomplete } from '@/shared/components/SearchableAutocomplete'
import { Switch } from '@/components/ui/switch'
import {
  createTripRequisition,
  type CreateTripRequisitionResult,
} from '@/features/trips/lib/trips-api'
import {
  isLocalOrPickDropTrip,
  isLongTrip,
} from '@/features/trips/lib/trip-form-utils'
import {
  fetchTripRequisitionMasterLists,
  labelForMasterOption,
} from '@/features/trips/lib/trip-requisition-masters'
import {
  fetchEmployeeByCid,
  fetchUserOrganogramDisplayNames,
  mapUserDetailFields,
  pickUserDetailOrganogramIds,
} from '@/features/user/lib/users-api'
import type { ApiRecord } from '@/features/user/lib/roles-api'
import { useUserStore } from '@/services/user-store'
import { PageHeader } from '@/shared/components/PageHeader'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'
import { cn } from '@/lib/utils'

type OfficialRow = {
  key: string
  employeeCid: string
  fullName: string
}

type TripFormState = {
  tripType: string
  purposeOfJourney: string
  preferredVehicleType: string
  origin: string
  finalDestination: string
  dateOfJourney: string
  timeOfJourney: string
  dateOfReturn: string
  tripDurationDays: string
  pickupRequired: boolean
  remarks: string
  tripDetailsJustification: string
}

const emptyTripForm = (): TripFormState => ({
  tripType: '',
  purposeOfJourney: '',
  preferredVehicleType: '',
  origin: '',
  finalDestination: '',
  dateOfJourney: '',
  timeOfJourney: '',
  dateOfReturn: '',
  tripDurationDays: '',
  pickupRequired: false,
  remarks: '',
  tripDetailsJustification: '',
})

function asRecord(user: unknown): ApiRecord | null {
  if (user && typeof user === 'object' && !Array.isArray(user)) {
    return user as ApiRecord
  }
  return null
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: typeof User
  title: string
  subtitle: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e8f0ff] text-[var(--fms-primary)]">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-base font-semibold text-[var(--fms-text-header)]">{title}</p>
          <p className="text-xs text-[var(--fms-text-subheading)]">{subtitle}</p>
        </div>
      </div>
      {action}
    </div>
  )
}

function RequiredMark() {
  return <span className="text-[var(--fms-delete)]">*</span>
}

function TripApprovedDialog({
  open,
  result,
  onClose,
}: {
  open: boolean
  result: CreateTripRequisitionResult | null
  onClose: () => void
}) {
  if (!result) return null

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-xl">
        <DialogHeader className="items-center text-center sm:text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-[var(--fms-success-text)]" />
          <DialogTitle className="text-xl">Trip Approved</DialogTitle>
          <p className="text-sm text-[var(--fms-text-subheading)]">
            Your trip request has been automatically approved. A vehicle and driver have
            been assigned to you.
          </p>
        </DialogHeader>

        <div className="space-y-4 rounded-xl border-2 border-[#3b82f6] bg-[#f8fbff] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--fms-text-header)]">
              Trip ID: {result.tripId}
            </p>
            <Badge className="border-transparent bg-[#d7f8e8] text-[#0f8e5c] hover:bg-[#d7f8e8]">
              {result.tripTypeLabel}
            </Badge>
          </div>
          <ul className="space-y-2 text-sm text-[var(--fms-text-header)]">
            <li className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[var(--fms-primary)]" />
              <span className="text-[var(--fms-text-subheading)]">Date of Journey:</span>
              {result.dateOfJourney}
            </li>
            <li className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[var(--fms-primary)]" />
              <span className="text-[var(--fms-text-subheading)]">Time of Journey:</span>
              {result.timeOfJourney}
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[var(--fms-primary)]" />
              <span className="text-[var(--fms-text-subheading)]">Origin:</span>
              {result.origin}
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[var(--fms-primary)]" />
              <span className="text-[var(--fms-text-subheading)]">Destination:</span>
              {result.destination}
            </li>
            <li className="flex items-center gap-2">
              <Target className="h-4 w-4 text-[var(--fms-primary)]" />
              <span className="text-[var(--fms-text-subheading)]">Purpose of Journey:</span>
              {result.purposeOfJourney}
            </li>
          </ul>
        </div>

        {(result.vehicle || result.driver) && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-[var(--fms-text-header)]">
              Assigned Vehicle &amp; Driver
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {result.vehicle ? (
                <div className="rounded-lg border border-[#b8e6cf] bg-[#f0faf4] p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <CarFront className="h-4 w-4 text-[#0f8e5c]" />
                    Vehicle
                  </div>
                  <p className="font-semibold">{result.vehicle.plateNumber}</p>
                  <p className="text-sm text-[var(--fms-text-subheading)]">
                    {result.vehicle.model}
                  </p>
                  <p className="text-sm text-[var(--fms-text-subheading)]">
                    {result.vehicle.color}
                  </p>
                </div>
              ) : null}
              {result.driver ? (
                <div className="rounded-lg border border-[#b8e6cf] bg-[#f0faf4] p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <User className="h-4 w-4 text-[#0f8e5c]" />
                    Driver
                  </div>
                  <p className="font-semibold">{result.driver.name}</p>
                  <p className="text-sm text-[var(--fms-text-subheading)]">
                    {result.driver.contact}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        )}

        <DialogFooter className="sm:justify-start">
          <Button variant="destructive" type="button" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateTripRequisition() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  // Create URL is not a sidebar sub-menu route; permissions match the list page entry.
  const crud = useRouteCrudPermissions('/trip/requisition')
  const user = useUserStore((state) => state.user)
  const record = asRecord(user)

  const [tripForm, setTripForm] = useState<TripFormState>(emptyTripForm)
  const [officials, setOfficials] = useState<OfficialRow[]>([])
  const [movementOrderFile, setMovementOrderFile] = useState<File | null>(null)
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false)
  const [approvalResult, setApprovalResult] = useState<CreateTripRequisitionResult | null>(
    null,
  )
  const fileInputRef = useRef<HTMLInputElement>(null)
  const officialLookupTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const organogramIds = useMemo(
    () => (record ? pickUserDetailOrganogramIds(record) : null),
    [record],
  )

  const organogramNamesQuery = useQuery({
    queryKey: [
      'user-organogram-display-names',
      organogramIds?.agencyId,
      organogramIds?.departmentId,
      organogramIds?.divisionId,
      organogramIds?.subDivisionId,
    ],
    enabled: Boolean(record),
    queryFn: () => fetchUserOrganogramDisplayNames(record!),
    staleTime: 60_000,
  })

  const mastersQuery = useQuery({
    queryKey: ['trips', 'requisition', 'masters'],
    queryFn: fetchTripRequisitionMasterLists,
    staleTime: 60_000,
  })

  const applicant = useMemo(() => {
    if (!record) return null
    const base = mapUserDetailFields(record)
    const org = organogramNamesQuery.data
    if (!org) return base
    return {
      ...base,
      agency: org.agency,
      department: org.department,
      division: org.division,
      subDivision: org.subDivision,
    }
  }, [record, organogramNamesQuery.data])

  const organogramLoading = organogramNamesQuery.isLoading

  const selectedTripTypeLabel = useMemo(
    () => labelForMasterOption(mastersQuery.data?.tripTypes ?? [], tripForm.tripType),
    [mastersQuery.data?.tripTypes, tripForm.tripType],
  )

  const showLocalFields = isLocalOrPickDropTrip(
    selectedTripTypeLabel,
    tripForm.tripType,
  )
  const showLongFields = isLongTrip(selectedTripTypeLabel, tripForm.tripType)

  useEffect(() => {
    if (!showLocalFields && tripForm.pickupRequired) {
      setTripForm((prev) => ({ ...prev, pickupRequired: false }))
    }
  }, [showLocalFields, tripForm.pickupRequired])

  useEffect(() => {
    if (!showLongFields && movementOrderFile) {
      setMovementOrderFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [showLongFields, movementOrderFile])

  useEffect(() => {
    return () => {
      Object.values(officialLookupTimers.current).forEach(clearTimeout)
    }
  }, [])

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!applicant) throw new Error('Applicant profile is not available.')
      const purposeLabel = labelForMasterOption(
        mastersQuery.data?.journeyPurposes ?? [],
        tripForm.purposeOfJourney,
      )
      return createTripRequisition({
        employeeId: applicant.employeeId === '-' ? '' : applicant.employeeId,
        applicantName: applicant.name === '-' ? '' : applicant.name,
        designation: applicant.designation === '-' ? '' : applicant.designation,
        agency: applicant.agency === '-' ? '' : applicant.agency,
        department: applicant.department === '-' ? '' : applicant.department,
        contactNumber: applicant.contact === '-' ? '' : applicant.contact,
        email: applicant.email === '-' ? '' : applicant.email,
        tripType: tripForm.tripType,
        purposeOfJourney: tripForm.purposeOfJourney,
        preferredVehicleType: tripForm.preferredVehicleType,
        origin: tripForm.origin.trim(),
        finalDestination: tripForm.finalDestination.trim(),
        dateOfJourney: tripForm.dateOfJourney,
        timeOfJourney: showLocalFields ? tripForm.timeOfJourney : undefined,
        dateOfReturn: showLongFields ? tripForm.dateOfReturn : undefined,
        tripDurationDays: showLongFields
          ? Number.parseInt(tripForm.tripDurationDays, 10) || undefined
          : undefined,
        pickupRequired: showLocalFields ? tripForm.pickupRequired : undefined,
        remarks: tripForm.remarks.trim() || undefined,
        tripDetailsJustification: showLongFields
          ? tripForm.tripDetailsJustification.trim() || undefined
          : undefined,
        accompanyingOfficials: officials
          .filter((row) => row.employeeCid.trim() || row.fullName.trim())
          .map((row) => ({
            employeeCid: row.employeeCid.trim(),
            fullName: row.fullName.trim(),
          })),
        movementOrderFile: showLongFields ? movementOrderFile : null,
      }).then((result) => ({
        ...result,
        tripTypeLabel: result.tripTypeLabel || selectedTripTypeLabel,
        purposeOfJourney: result.purposeOfJourney || purposeLabel,
        timeOfJourney: result.timeOfJourney || tripForm.timeOfJourney,
      }))
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['trips', 'requisitions'] })
      if (showLocalFields) {
        setApprovalResult(result)
        setApprovalDialogOpen(true)
        showSuccessToast('Trip request submitted and approved.')
      } else {
        showSuccessToast('Trip request submitted successfully.')
        navigate('/trip/requisition')
      }
    },
    onError: (err) => {
      showErrorToast(err instanceof Error ? err.message : 'Submit failed')
    },
  })

  const validate = (): string | null => {
    if (!tripForm.tripType) return 'Trip type is required.'
    if (!tripForm.purposeOfJourney) return 'Purpose of journey is required.'
    if (!tripForm.preferredVehicleType) return 'Preferred vehicle type is required.'
    if (!tripForm.dateOfJourney) return 'Date of journey is required.'
    if (showLocalFields && !tripForm.timeOfJourney) return 'Time of journey is required.'
    if (showLongFields) {
      if (!tripForm.dateOfReturn) return 'Date of return is required.'
      if (!tripForm.tripDurationDays.trim()) return 'Trip duration is required.'
      if (!movementOrderFile) return 'Movement order upload is required for long trips.'
    }
    for (const row of officials) {
      if (row.employeeCid.trim() && !row.fullName.trim()) {
        return 'Full name is required for each accompanying official.'
      }
      if (!row.employeeCid.trim() && row.fullName.trim()) {
        return 'Employee CID is required for each accompanying official.'
      }
    }
    const maxBytes = 5 * 1024 * 1024
    if (movementOrderFile && movementOrderFile.size > maxBytes) {
      return 'Movement order must be 5MB or smaller.'
    }
    return null
  }

  const handleSubmit = () => {
    const message = validate()
    if (message) {
      showErrorToast(message)
      return
    }
    submitMutation.mutate()
  }

  const addOfficialRow = () => {
    setOfficials((prev) => [
      ...prev,
      { key: `official-${Date.now()}-${prev.length}`, employeeCid: '', fullName: '' },
    ])
  }

  const updateOfficialRow = (key: string, patch: Partial<OfficialRow>) => {
    setOfficials((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    )
  }

  const removeOfficialRow = (key: string) => {
    if (officialLookupTimers.current[key]) {
      clearTimeout(officialLookupTimers.current[key])
      delete officialLookupTimers.current[key]
    }
    setOfficials((prev) => prev.filter((row) => row.key !== key))
  }

  const scheduleOfficialLookup = (key: string, cid: string) => {
    if (officialLookupTimers.current[key]) {
      clearTimeout(officialLookupTimers.current[key])
    }
    const trimmed = cid.trim()
    if (trimmed.length < 5) return
    officialLookupTimers.current[key] = setTimeout(() => {
      void fetchEmployeeByCid(trimmed)
        .then((person) => {
          updateOfficialRow(key, { fullName: person.name || '' })
        })
        .catch(() => {
          /* user may type name manually */
        })
    }, 400)
  }

  if (crud.isResolved && !crud.canCreate) {
    return (
      <section className="space-y-5">
        <PageHeader
          title="Travel Request Form"
          subtitle="Submit your travel authorization request for approval."
        />
        <p className="text-sm text-[var(--fms-text-subheading)]">
          You do not have permission to create trip requests.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <PageHeader
        title="Travel Request Form"
        subtitle="Submit your travel authorization request for approval."
      />

      <div className="space-y-5">
        <Card className="border border-[var(--fms-strokes)] bg-white">
          <CardContent className="space-y-4 pt-5">
            <SectionHeader
              icon={User}
              title="Applicant Information"
              subtitle="Basic personal and organizational details of the applicant."
            />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <FieldReadOnly
                label="Employee ID"
                value={applicant?.employeeId}
              />
              <FieldReadOnly label="Applicant Name" value={applicant?.name} />
              <FieldReadOnly
                label="Designation"
                value={applicant?.designation}
              />
              <FieldReadOnly
                label="Agency"
                value={organogramLoading ? 'Loading…' : applicant?.agency}
              />
              <FieldReadOnly
                label="Department"
                value={organogramLoading ? 'Loading…' : applicant?.department}
              />
              <FieldReadOnly
                label="Division"
                value={organogramLoading ? 'Loading…' : applicant?.division}
              />
              <FieldReadOnly
                label="Sub Division"
                value={organogramLoading ? 'Loading…' : applicant?.subDivision}
              />

              <FieldReadOnly
                label="Contact Number"
                value={applicant?.contact}
              />
              <FieldReadOnly
                label="Email"
                value={applicant?.email}
                //className="lg:col-span-3"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-[var(--fms-strokes)] bg-white">
          <CardContent className="space-y-4 pt-5">
            <SectionHeader
              icon={Car}
              title="Trip Details"
              subtitle="Basic information about the trip request."
            />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <FormSelect
                label="Trip Type"
                required
                loading={mastersQuery.isLoading}
                value={tripForm.tripType}
                placeholder="Select trip type"
                options={mastersQuery.data?.tripTypes ?? []}
                onChange={(value) =>
                  setTripForm((prev) => ({ ...prev, tripType: value }))
                }
              />
              <FormSelect
                label="Purpose of Journey"
                required
                loading={mastersQuery.isLoading}
                value={tripForm.purposeOfJourney}
                placeholder="Select purpose"
                options={mastersQuery.data?.journeyPurposes ?? []}
                onChange={(value) =>
                  setTripForm((prev) => ({ ...prev, purposeOfJourney: value }))
                }
              />
              <FormSelect
                label="Preferred Vehicle Type"
                required
                loading={mastersQuery.isLoading}
                value={tripForm.preferredVehicleType}
                placeholder="Select vehicle"
                options={mastersQuery.data?.vehicleTypes ?? []}
                onChange={(value) =>
                  setTripForm((prev) => ({
                    ...prev,
                    preferredVehicleType: value,
                  }))
                }
              />
              <FormInput
                label="Origin"
                value={tripForm.origin}
                onChange={(value) =>
                  setTripForm((prev) => ({ ...prev, origin: value }))
                }
              />
              <FormInput
                label="Final Destination"
                value={tripForm.finalDestination}
                onChange={(value) =>
                  setTripForm((prev) => ({ ...prev, finalDestination: value }))
                }
              />
              <FormInput
                label="Date of Journey"
                required
                type="date"
                value={tripForm.dateOfJourney}
                onChange={(value) =>
                  setTripForm((prev) => ({ ...prev, dateOfJourney: value }))
                }
              />

              {showLocalFields ? (
                <FormInput
                  label="Time of Journey"
                  required
                  type="time"
                  value={tripForm.timeOfJourney}
                  onChange={(value) =>
                    setTripForm((prev) => ({ ...prev, timeOfJourney: value }))
                  }
                />
              ) : null}

              {showLongFields ? (
                <>
                  <FormInput
                    label="Date of Return"
                    required
                    type="date"
                    value={tripForm.dateOfReturn}
                    onChange={(value) =>
                      setTripForm((prev) => ({ ...prev, dateOfReturn: value }))
                    }
                  />
                  <FormInput
                    label="Trip Duration"
                    required
                    type="number"
                    min={1}
                    value={tripForm.tripDurationDays}
                    placeholder="Days"
                    onChange={(value) =>
                      setTripForm((prev) => ({
                        ...prev,
                        tripDurationDays: value,
                      }))
                    }
                  />
                </>
              ) : null}

              {showLocalFields ? (
                <div className="space-y-2">
                  <Label>
                    Pickup Required <RequiredMark />
                  </Label>
                  <div className="flex h-10 items-center gap-3 rounded-lg border border-[var(--fms-strokes)] px-3">
                    <Switch
                      checked={tripForm.pickupRequired}
                      onCheckedChange={(checked) =>
                        setTripForm((prev) => ({
                          ...prev,
                          pickupRequired: checked,
                        }))
                      }
                      aria-label="Pickup required"
                    />
                    <span className="text-sm text-[var(--fms-text-header)]">
                      {tripForm.pickupRequired ? "Yes" : "No"}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="remarks">
                {showLongFields ? "Trip details justification" : "Remarks"}
              </Label>
              <textarea
                id="remarks"
                value={
                  showLongFields
                    ? tripForm.tripDetailsJustification
                    : tripForm.remarks
                }
                onChange={(event) => {
                  const value = event.target.value;
                  setTripForm((prev) =>
                    showLongFields
                      ? { ...prev, tripDetailsJustification: value }
                      : { ...prev, remarks: value },
                  );
                }}
                placeholder="Provide additional details or justification for the trip"
                className="min-h-[88px] w-full rounded-lg border border-[var(--fms-strokes)] bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>

            {showLongFields ? (
              <div className="space-y-2">
                <Label>
                  Upload Movement Order <RequiredMark />
                </Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setMovementOrderFile(file);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--fms-strokes)] bg-[#fafafa] px-4 py-8 text-center transition-colors hover:bg-[#f3f4f6]",
                    movementOrderFile &&
                      "border-[var(--fms-primary)] bg-[#f8fbff]",
                  )}
                >
                  <CloudUpload className="h-8 w-8 text-[var(--fms-text-subheading)]" />
                  <span className="text-sm font-medium text-[var(--fms-text-header)]">
                    {movementOrderFile
                      ? movementOrderFile.name
                      : "Click to upload or drag and drop"}
                  </span>
                  <span className="text-xs text-[var(--fms-text-subheading)]">
                    PDF, DOC, DOCX, JPG or PNG (max 5MB)
                  </span>
                </button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border border-[var(--fms-strokes)] bg-white">
          <CardContent className="space-y-4 pt-5">
            <SectionHeader
              icon={Users}
              title="Accompanying Officials"
              subtitle="Add employees travelling with you on this trip."
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addOfficialRow}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add Another Official
                </Button>
              }
            />

            {officials.length === 0 ? (
              <p className="text-sm text-[var(--fms-text-subheading)]">
                No accompanying officials added.
              </p>
            ) : (
              <div className="space-y-3">
                {officials.map((row) => (
                  <div
                    key={row.key}
                    className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end"
                  >
                    <div className="space-y-2">
                      <Label>
                        Employee CID <RequiredMark />
                      </Label>
                      <Input
                        value={row.employeeCid}
                        placeholder="Enter employee ID"
                        onChange={(event) => {
                          const value = event.target.value;
                          updateOfficialRow(row.key, { employeeCid: value });
                          scheduleOfficialLookup(row.key, value);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>
                        Full Name <RequiredMark />
                      </Label>
                      <Input
                        value={row.fullName}
                        placeholder="Auto fetch"
                        onChange={(event) =>
                          updateOfficialRow(row.key, {
                            fullName: event.target.value,
                          })
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-[var(--fms-delete)]"
                      aria-label="Remove official"
                      onClick={() => removeOfficialRow(row.key)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button variant="destructive" asChild>
            <Link to="/trip/requisition">Close</Link>
          </Button>
          <Button
            type="button"
            disabled={submitMutation.isPending || !crud.canCreate}
            onClick={handleSubmit}
          >
            Submit Request
          </Button>
        </div>
      </div>

      <TripApprovedDialog
        open={approvalDialogOpen}
        result={approvalResult}
        onClose={() => {
          setApprovalDialogOpen(false);
          setApprovalResult(null);
          navigate('/trip/requisition')
        }}
      />
    </section>
  );
}

function FieldReadOnly({
  label,
  value,
  className,
}: {
  label: string
  value?: string
  className?: string
}) {
  const display = value && value !== '-' ? value : ''
  return (
    <div className={cn('space-y-2', className)}>
      <Label>{label}</Label>
      <Input
        readOnly
        value={display}
        placeholder="Auto-populate"
        className="bg-[#f8f8f9] text-[var(--fms-text-header)]"
      />
    </div>
  )
}

function FormInput({
  label,
  value,
  onChange,
  required,
  type = 'text',
  placeholder,
  min,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  type?: string
  placeholder?: string
  min?: number
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label} {required ? <RequiredMark /> : null}
      </Label>
      <Input
        type={type}
        min={min}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

function FormSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
  loading,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder: string
  required?: boolean
  loading?: boolean
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label} {required ? <RequiredMark /> : null}
      </Label>
      <SearchableAutocomplete
        value={value}
        onChange={onChange}
        options={options}
        loading={loading}
        disabled={!loading && options.length === 0}
        placeholder={placeholder}
        searchPlaceholder="Type to search…"
      />
    </div>
  )
}

export default CreateTripRequisition
