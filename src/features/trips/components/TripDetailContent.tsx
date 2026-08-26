import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Car, CarFront, CloudUpload, Pencil, User, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatSuggestedVehicleMakeModel } from '@/features/trips/lib/trip-request-mock-data'
import {
  isLocalOrPickDropTrip,
  isLongTrip,
  isTripPlanned,
  resolveTripDurationDisplay,
  tripStatusBadgeClass,
} from '@/features/trips/lib/trip-form-utils'
import type {
  TripSuggestedDriver,
  TripSuggestedVehicle,
} from '@/features/trips/lib/trip-request-mock-data'
import { TripFeedbackSections } from '@/features/trips/components/TripFeedbackSections'
import {
  approveTripAssign,
  callTripPickup,
  fetchTripFeedback,
  filterTripFeedbackByPickup,
  filterTripFeedbackForCurrentUser,
  openTripGeneratedMovementOrder,
  openTripNoteSheet,
  overrideTripAssignment,
  rejectTrip,
  type TripDetail,
  type TripNoteSheetFile,
} from '@/features/trips/lib/trips-api'
import { fetchUserById } from '@/features/user/lib/users-api'
import { fetchDriverVehicleAssignments } from '@/features/vehicles/lib/driver-vehicle-assignments-api'
import { fetchVehicles } from '@/features/vehicles/lib/vehicles-api'
import { useUserStore } from '@/services/user-store'
import { SearchableAutocomplete } from '@/shared/components/SearchableAutocomplete'
import { BackToListButton } from '@/shared/components/BackToListButton'
import { PageHeader } from '@/shared/components/PageHeader'
import { useAccessControl } from '@/shared/hooks/useAccessControl'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'
import { preOpenBrowserTab } from '@/shared/lib/open-in-new-tab'
import { cn } from '@/lib/utils'

function RequiredMark() {
  return <span className="text-[var(--fms-delete)]">*</span>
}

type ApiRecord = Record<string, unknown>

function toText(value: unknown): string {
  return typeof value === 'string'
    ? value.trim()
    : typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : ''
}

function pickUserDisplayName(record: ApiRecord): string {
  const firstName = toText(record.first_name) || toText(record.firstName)
  const middleName = toText(record.middle_name) || toText(record.middleName)
  const lastName = toText(record.last_name) || toText(record.lastName)
  return (
    toText(record.name) ||
    toText(record.full_name) ||
    [firstName, middleName, lastName].filter(Boolean).join(' ').trim()
  )
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

function FieldReadOnly({
  label,
  value,
  className,
}: {
  label: string
  value?: string
  className?: string
}) {
  const display = value && value !== '—' ? value : ''
  return (
    <div className={cn('space-y-2', className)}>
      <Label>{label}</Label>
      <Input
        readOnly
        value={display}
        placeholder="—"
        className="bg-[#f8f8f9] text-[var(--fms-text-header)]"
      />
    </div>
  )
}

function DetailLine({ value }: { value?: string }) {
  if (!value || value === '—') return null
  return <p className="text-sm text-[var(--fms-text-subheading)]">{value}</p>
}

function TripAttachmentChip({
  file,
  loading = false,
  openingLabel = 'Opening attachment…',
  onClick,
}: {
  file: TripNoteSheetFile
  loading?: boolean
  openingLabel?: string
  onClick?: () => void
}) {
  const chipClassName = cn(
    'inline-flex items-center gap-2 rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2 text-sm text-[var(--fms-primary)]',
    onClick && !loading && 'cursor-pointer transition-colors hover:bg-[#dbeafe]',
    loading && 'cursor-wait opacity-70',
  )

  const content = (
    <>
      <CloudUpload className="h-4 w-4 shrink-0" />
      <span className={cn('font-medium', onClick && 'underline-offset-2 hover:underline')}>
        {loading ? openingLabel : file.name}
      </span>
      {file.sizeLabel ? (
        <span className="text-[var(--fms-text-subheading)]">{file.sizeLabel}</span>
      ) : null}
    </>
  )

  if (onClick) {
    return (
      <button type="button" disabled={loading} onClick={onClick} className={chipClassName}>
        {content}
      </button>
    )
  }

  if (file.url) {
    return (
      <a
        href={file.url}
        target="_blank"
        rel="noreferrer"
        className={chipClassName}
      >
        {content}
      </a>
    )
  }

  return <div className={chipClassName}>{content}</div>
}

function SuggestedVehicleCard({
  vehicle,
  title = 'Suggested Vehicle',
}: {
  vehicle: TripSuggestedVehicle
  title?: string
}) {
  const makeModel = formatSuggestedVehicleMakeModel(vehicle)

  return (
    <div className="rounded-lg border border-[#b8e6cf] bg-[#f0faf4] p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#0f8e5c]">
        <CarFront className="h-4 w-4" />
        {title}
      </div>
      <p className="font-semibold text-[var(--fms-text-header)]">
        {vehicle.plateNumber !== '—' ? vehicle.plateNumber : '—'}
      </p>
      <DetailLine value={makeModel !== '—' ? makeModel : undefined} />
      <DetailLine value={vehicle.color} />
      <DetailLine value={vehicle.fuelEfficiency} />
    </div>
  )
}

function SuggestedDriverCard({
  driver,
  title = 'Suggested Driver',
}: {
  driver: TripSuggestedDriver
  title?: string
}) {
  return (
    <div className="rounded-lg border border-[#b8e6cf] bg-[#f0faf4] p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#0f8e5c]">
        <User className="h-4 w-4" />
        {title}
      </div>
      <p className="font-semibold text-[var(--fms-text-header)]">
        {driver.name !== '—' ? driver.name : '—'}
      </p>
      <DetailLine
        value={driver.contact !== '—' ? `Contact No. ${driver.contact}` : undefined}
      />
      <DetailLine
        value={driver.licenseNumber ? `License No. ${driver.licenseNumber}` : undefined}
      />
      <DetailLine value={driver.rating > 0 ? `Rating ${driver.rating}/5` : undefined} />
    </div>
  )
}

type OverrideFormState = {
  vehicleId: string
  driverId: string
  remarks: string
}

const emptyOverrideForm = (): OverrideFormState => ({
  vehicleId: '',
  driverId: '',
  remarks: '',
})

type TripDetailLocationState = {
  hasFeedback?: boolean
}

export type TripDetailContentProps = {
  trip: TripDetail
  mode: 'requisition' | 'request'
  backPath: string
}

export function TripDetailContent({ trip, mode, backPath }: TripDetailContentProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const crud = useRouteCrudPermissions('/trip/request')
  const locationState = (location.state as TripDetailLocationState | null) ?? null

  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false)
  const [overrideForm, setOverrideForm] = useState<OverrideFormState>(emptyOverrideForm)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectRemarks, setRejectRemarks] = useState('')
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false)

  const showDriverRatingButton =
    trip.hasFeedback || locationState?.hasFeedback === true

  const feedbackQuery = useQuery({
    queryKey: ['trips', 'feedback', trip.id],
    queryFn: () => fetchTripFeedback(trip.id),
    enabled: feedbackDialogOpen && showDriverRatingButton,
    staleTime: 30_000,
    retry: false,
  })

  const { role } = useAccessControl()
  const user = useUserStore((state) => state.user)
  const currentUserId = useMemo(() => {
    if (!user || typeof user !== 'object' || Array.isArray(user)) return ''
    const profile = user as ApiRecord
    return toText(profile.id) || toText(profile.user_id) || toText(profile.userId) || toText(profile.uuid)
  }, [user])
  const isDriverRole = role === 'fms-driver'

  const visibleTripFeedback = useMemo(() => {
    const source = feedbackQuery.data ?? []
    const scoped = isDriverRole
      ? filterTripFeedbackForCurrentUser(source, currentUserId)
      : source
    return filterTripFeedbackByPickup(scoped, trip.pickupRequired)
  }, [feedbackQuery.data, isDriverRole, currentUserId, trip.pickupRequired])

  const showLocalFields = isLocalOrPickDropTrip(trip.tripType)
  const showLongFields = isLongTrip(trip.tripType)
  const tripDurationDisplay = useMemo(
    () =>
      resolveTripDurationDisplay({
        journeyStartDatetime: trip.journeyStartDatetime,
        journeyEndDatetime: trip.journeyEndDatetime,
        tripDurationDays: trip.tripDurationDays,
      }),
    [trip.journeyEndDatetime, trip.journeyStartDatetime, trip.tripDurationDays],
  )
  const isPlanned = isTripPlanned(trip.statusCode || trip.status)
  const canReviewPlannedTrip =
    mode === 'request' && crud.isResolved && isPlanned
  const showApproveButton = canReviewPlannedTrip && crud.canApprove
  const showRejectButton = canReviewPlannedTrip && crud.canReject
  const showOverrideButton =
    canReviewPlannedTrip &&
    (crud.canApprove || crud.canAssign || crud.canUpdate)
  const canApproveTrip = showApproveButton
  const canRejectTrip = showRejectButton
  const showReviewActions = showApproveButton || showRejectButton
  const showCallForPickupButton =
    mode === 'requisition' &&
    trip.pickupRequired === true &&
    trip.status === 'DROPPED_OFF'

  const noteSheetMutation = useMutation({
    mutationFn: (targetWindow: Window | null) =>
      openTripNoteSheet(trip.id, trip.noteSheetFile?.name || '', targetWindow),
    onError: (error, targetWindow) => {
      if (targetWindow && !targetWindow.closed) targetWindow.close()
      showErrorToast(error, 'Could not open note sheet')
    },
  })

  const handleNoteSheetClick = () => {
    noteSheetMutation.mutate(preOpenBrowserTab())
  }

  const generatedMovementOrderMutation = useMutation({
    mutationFn: (targetWindow: Window | null) =>
      openTripGeneratedMovementOrder(
        trip.id,
        trip.generatedMovementOrderFile?.name || '',
        targetWindow,
      ),
    onError: (error, targetWindow) => {
      if (targetWindow && !targetWindow.closed) targetWindow.close()
      showErrorToast(error, 'Could not open generated movement order')
    },
  })

  const handleGeneratedMovementOrderClick = () => {
    generatedMovementOrderMutation.mutate(preOpenBrowserTab())
  }

  const selectedOverrideVehicleId = overrideForm.vehicleId.trim()

  const vehiclesQuery = useQuery({
    queryKey: ['trips', 'override', 'vehicles'],
    queryFn: fetchVehicles,
    enabled: overrideDialogOpen && showOverrideButton,
    staleTime: 30_000,
  })

  const driversQuery = useQuery({
    queryKey: ['trips', 'override', 'vehicle-drivers', selectedOverrideVehicleId],
    queryFn: () => fetchDriverVehicleAssignments(selectedOverrideVehicleId),
    enabled: overrideDialogOpen && showOverrideButton && Boolean(selectedOverrideVehicleId),
    staleTime: 30_000,
  })

  const assignmentDriverIdsNeedingNames = useMemo(
    () =>
      Array.from(
        new Set(
          (driversQuery.data ?? [])
            .filter(
              (assignment) =>
                assignment.driverId &&
                assignment.driverId !== '—' &&
                (!assignment.name || assignment.name === '—'),
            )
            .map((assignment) => assignment.driverId),
        ),
      ),
    [driversQuery.data],
  )

  const driverNameQueries = useQueries({
    queries: assignmentDriverIdsNeedingNames.map((driverId) => ({
      queryKey: ['trips', 'override', 'driver-name', driverId],
      queryFn: async () => {
        const record = await fetchUserById(driverId)
        return pickUserDisplayName(record)
      },
      enabled: overrideDialogOpen && Boolean(driverId),
      staleTime: 30_000,
      retry: false,
    })),
  })

  const driverNameById = useMemo(() => {
    const map = new Map<string, string>()
    assignmentDriverIdsNeedingNames.forEach((driverId, index) => {
      const name = driverNameQueries[index]?.data
      if (name) map.set(driverId, name)
    })
    return map
  }, [assignmentDriverIdsNeedingNames, driverNameQueries])

  const vehicleOptions = useMemo(
    () =>
      (vehiclesQuery.data ?? []).map((vehicle) => ({
        value: vehicle.id,
        label: vehicle.registration_number,
        description: `${vehicle.makeModel} · ${vehicle.status}`,
        searchText: `${vehicle.registration_number} ${vehicle.makeModel} ${vehicle.status}`,
      })),
    [vehiclesQuery.data],
  )

  const driverOptions = useMemo(
    () =>
      (driversQuery.data ?? [])
        .filter((assignment) => assignment.driverId && assignment.driverId !== '—')
        .map((assignment) => {
          const resolvedName =
            (assignment.name !== '—' ? assignment.name : '') ||
            driverNameById.get(assignment.driverId) ||
            ''
          return {
            value: assignment.driverId,
            label: resolvedName || assignment.driverId,
            description: assignment.priority !== '—' ? assignment.priority : undefined,
            searchText: `${resolvedName} ${assignment.cid} ${assignment.license}`,
          }
        }),
    [driversQuery.data, driverNameById],
  )

  const driversQueryLoading = driversQuery.isLoading

  const approveMutation = useMutation({
    mutationFn: () => approveTripAssign(trip.id),
    onSuccess: async () => {
      showSuccessToast('Trip approved and assigned.')
      await queryClient.invalidateQueries({ queryKey: ['trips'] })
      navigate('/trip/request')
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to approve trip.')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (remarks: string) => rejectTrip(trip.id, remarks),
    onSuccess: async () => {
      showSuccessToast('Trip request rejected.')
      setRejectDialogOpen(false)
      setRejectRemarks('')
      await queryClient.invalidateQueries({ queryKey: ['trips'] })
      navigate('/trip/request')
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to reject trip.')
    },
  })

  const overrideMutation = useMutation({
    mutationFn: () =>
      overrideTripAssignment(trip.id, {
        vehicleId: overrideForm.vehicleId,
        driverId: overrideForm.driverId,
        remarks: overrideForm.remarks,
      }),
    onSuccess: async () => {
      showSuccessToast('Trip assignment overridden.')
      setOverrideDialogOpen(false)
      setOverrideForm(emptyOverrideForm())
      await queryClient.invalidateQueries({ queryKey: ['trips'] })
      await queryClient.invalidateQueries({ queryKey: ['trips', 'detail', trip.id] })
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to override assignment.')
    },
  })

  const pickupMutation = useMutation({
    mutationFn: () => callTripPickup(trip.id, trip.employeeId),
    onSuccess: async () => {
      showSuccessToast('Pickup request sent successfully.')
      await queryClient.invalidateQueries({ queryKey: ['trips'] })
      await queryClient.invalidateQueries({ queryKey: ['trips', 'detail', trip.id] })
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to call for pickup')
    },
  })

  const hasSuggestedAssignment = Boolean(
    trip.systemSuggestedDriverId || trip.systemSuggestedVehicleId || trip.assignedVehicleId || trip.assignedDriverId,
  )

  const hasSuggestedVehicleData = !(
    trip.suggestedVehicle.plateNumber === '—' &&
    trip.suggestedVehicle.model === '—' &&
    trip.suggestedVehicle.make === '—'
  )
  const hasSuggestedDriverData = trip.suggestedDriver.name !== '—'
  const hasAssignedVehicleData = !(
    trip.assignedVehicle.plateNumber === '—' &&
    trip.assignedVehicle.model === '—' &&
    trip.assignedVehicle.make === '—'
  )
  const hasAssignedDriverData = trip.assignedDriver.name !== '—'

  const showRequisitionVehicleDriver =
    mode === 'requisition' &&
    ( hasSuggestedVehicleData ||
      hasSuggestedDriverData ||
      Boolean(trip.systemSuggestedVehicleId || trip.systemSuggestedDriverId)
      || hasAssignedVehicleData ||
      hasAssignedDriverData ||
      Boolean(trip.assignedVehicleId || trip.assignedDriverId))

  // The assignment wins once it carries data; otherwise the system suggestion is shown.
  const displayVehicle = hasAssignedVehicleData ? trip.assignedVehicle : trip.suggestedVehicle
  const displayDriver = hasAssignedDriverData ? trip.assignedDriver : trip.suggestedDriver
  const vehicleCardTitle = hasAssignedVehicleData ? 'Assigned vehicle' : 'Suggested Vehicle'
  const driverCardTitle = hasAssignedDriverData ? 'Assigned Driver' : 'Suggested Driver'
  const showVehicleCard =
    mode === 'requisition' && (
       hasAssignedVehicleData || Boolean(trip.assignedVehicleId)
      || hasSuggestedVehicleData || Boolean(trip.systemSuggestedVehicleId))
  const showDriverCard =
    mode === 'requisition' && 
      (hasAssignedDriverData || Boolean(trip.assignedDriverId)
      || hasSuggestedDriverData || Boolean(trip.systemSuggestedDriverId))

  const showVehicleDriverSection =
    mode === 'requisition' && (showRequisitionVehicleDriver  || hasSuggestedAssignment || showReviewActions)

  const handleApprove = () => {
    if (!canApproveTrip || approveMutation.isPending) return
    approveMutation.mutate()
  }

  const openRejectDialog = () => {
    if (!canRejectTrip || rejectMutation.isPending) return
    setRejectRemarks('')
    setRejectDialogOpen(true)
  }

  const closeRejectDialog = () => {
    if (rejectMutation.isPending) return
    setRejectDialogOpen(false)
    setRejectRemarks('')
  }

  const confirmReject = () => {
    const remarks = rejectRemarks.trim()
    if (!remarks) {
      showErrorToast('Rejection remarks are required.')
      return
    }
    rejectMutation.mutate(remarks)
  }

  const openOverrideDialog = () => {
    setOverrideForm({
      vehicleId: trip.systemSuggestedVehicleId ?? trip.assignedVehicleId ?? '',
      driverId: trip.systemSuggestedDriverId ?? trip.assignedDriverId ?? '',
      remarks: '',
    })
    setOverrideDialogOpen(true)
  }

  const closeOverrideDialog = () => {
    if (overrideMutation.isPending) return
    setOverrideDialogOpen(false)
    setOverrideForm(emptyOverrideForm())
  }

  const confirmOverride = () => {
    if (!overrideForm.vehicleId.trim()) {
      showErrorToast('Select a vehicle.')
      return
    }
    if (!overrideForm.driverId.trim()) {
      showErrorToast('Select a driver.')
      return
    }
    overrideMutation.mutate()
  }

  const handleCallForPickup = () => {
    const employeeId = trip.employeeId.trim()
    if (!employeeId || employeeId === '—') {
      showErrorToast('Applicant employee ID is not available for this trip.')
      return
    }
    pickupMutation.mutate()
  }

  const reviewActionBusy =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    overrideMutation.isPending ||
    pickupMutation.isPending

  return (
    <section className="space-y-5">
      <BackToListButton to={backPath} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title={trip.requestId}
          subtitle={
            <span className="inline-flex flex-wrap items-center gap-2">
              <span>{trip.applicantName}</span>
              <Badge className={tripStatusBadgeClass(trip.statusCode || trip.status)}>
                {trip.status}
              </Badge>
            </span>
          }
        />
        {showDriverRatingButton ? (
          <Button
            type="button"
            className="w-full bg-[var(--fms-success-border)] text-white hover:bg-[var(--fms-success-text)] sm:w-auto"
            onClick={() => setFeedbackDialogOpen(true)}
          >
            View the driver rating
          </Button>
        ) : null}
      </div>
      <Card className="border border-[var(--fms-strokes)] bg-white">
        <CardContent className="space-y-4 pt-5">
          <SectionHeader
            icon={User}
            title="Applicant Information"
            subtitle="Basic personal and organizational details of the applicant."
          />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <FieldReadOnly label="Employee Number" value={trip.employeeId} />
            <FieldReadOnly label="Applicant Name" value={trip.applicantName} />
            <FieldReadOnly label="Designation" value={trip.designation} />
            <FieldReadOnly label="Agency" value={trip.agency} />
            <FieldReadOnly label="Department" value={trip.department} />
            <FieldReadOnly label="Division" value={trip.division} />
            <FieldReadOnly label="Sub Division" value={trip.subDivision} />
            <FieldReadOnly label="Contact Number" value={trip.contactNumber} />
            <FieldReadOnly label="Email" value={trip.email} />
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
            <FieldReadOnly label="Trip Type" value={trip.tripType} />
            <FieldReadOnly label="Purpose of Journey" value={trip.purposeOfJourney} />
            <FieldReadOnly label="Preferred Vehicle Category" value={trip.preferredVehicleType} />
            <FieldReadOnly label="Origin" value={trip.origin} />
            <FieldReadOnly label="Final Destination" value={trip.destination} />
            <FieldReadOnly label="Date of Journey" value={trip.dateOfJourney} />
            {showLocalFields || !showLongFields ? (
              <FieldReadOnly label="Time of Journey" value={trip.timeOfJourney} />
            ) : null}
            {showLongFields && trip.dateOfReturn ? (
              <FieldReadOnly label="Date of Return" value={trip.dateOfReturn} />
            ) : null}
            {tripDurationDisplay ? (
              <FieldReadOnly label="Trip Duration" value={tripDurationDisplay} />
            ) : null}
            {showLocalFields && trip.pickupRequired != null ? (
              <FieldReadOnly
                label="Pickup Required"
                value={trip.pickupRequired ? 'Yes' : 'No'}
              />
            ) : null}
            {trip.startOdometer != null ? (
              <FieldReadOnly
                label="Start Odometer"
                value={String(trip.startOdometer)}
              />
            ) : null}
            {trip.endOdometer != null ? (
              <FieldReadOnly label="End Odometer" value={String(trip.endOdometer)} />
            ) : null}
          </div>
          <FieldReadOnly
            label={showLongFields ? 'Trip details justification' : 'Remarks'}
            value={showLongFields ? trip.tripDetailsJustification : trip.remarks}
            className="w-full"
          />
          {(showLongFields && trip.noteSheetFile) || trip.generatedMovementOrderFile ? (
            <div className="flex flex-wrap gap-6">
              {showLongFields && trip.noteSheetFile ? (
                <div className="space-y-2">
                  <Label>Approval Note sheet</Label>
                  <TripAttachmentChip
                    file={trip.noteSheetFile}
                    loading={noteSheetMutation.isPending}
                    openingLabel="Opening note sheet…"
                    onClick={handleNoteSheetClick}
                  />
                </div>
              ) : null}
              {trip.generatedMovementOrderFile ? (
                <div className="space-y-2">
                  <Label>Generated movement order</Label>
                  <TripAttachmentChip
                    file={trip.generatedMovementOrderFile}
                    loading={generatedMovementOrderMutation.isPending}
                    openingLabel="Opening generated movement order…"
                    onClick={handleGeneratedMovementOrderClick}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border border-[var(--fms-strokes)] bg-white">
        <CardContent className="space-y-4 pt-5">
          <SectionHeader
            icon={Users}
            title="Accompanying Officials"
            subtitle="Employees travelling with the applicant on this trip."
          />
          {trip.accompanyingOfficials.length === 0 ? (
            <p className="text-sm text-[var(--fms-text-subheading)]">
              No accompanying officials on this request.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-[var(--fms-strokes)]">
              <table className="w-full text-sm">
                <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                  <tr>
                    <th className="w-16 px-4 py-3 text-left font-semibold">Sl.No</th>
                    <th className="px-4 py-3 text-left font-semibold">Employee CID</th>
                    <th className="px-4 py-3 text-left font-semibold">Full Name</th>
                  </tr>
                </thead>
                <tbody>
                  {trip.accompanyingOfficials.map((official, index) => (
                    <tr
                      key={`${official.employeeCid}-${index}`}
                      className="border-t border-[var(--fms-strokes)]"
                    >
                      <td className="px-4 py-3 tabular-nums text-[var(--fms-text-subheading)]">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3">{official.employeeCid}</td>
                      <td className="px-4 py-3">{official.fullName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {showVehicleDriverSection ? (
        <Card className="border border-[var(--fms-strokes)] bg-white">
          <CardContent className="space-y-4 pt-5">
            <SectionHeader
              icon={CarFront}
              title="Vehicle & Driver"
              subtitle="Suggestions and assignments for the trip."
              action={
                showOverrideButton ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openOverrideDialog}
                  >
                    <Pencil className="mr-1 h-4 w-4" />
                    Manual Override
                  </Button>
                ) : null
              }
            />

            {showVehicleCard || showDriverCard ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {showVehicleCard ? (
                  <SuggestedVehicleCard vehicle={displayVehicle} title={vehicleCardTitle} />
                ) : null}
                {showDriverCard ? (
                  <SuggestedDriverCard driver={displayDriver} title={driverCardTitle} />
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-[var(--fms-text-subheading)]">
                No vehicle or driver assignment yet.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {showReviewActions ? (
        <div className="flex flex-wrap gap-3 border-t border-[var(--fms-strokes)] pt-2">
          {showApproveButton ? (
            <Button
              type="button"
              className="bg-[var(--fms-success-text)] text-white hover:bg-[var(--fms-success-text)]/90"
              disabled={!canApproveTrip || reviewActionBusy}
              onClick={handleApprove}
            >
              {approveMutation.isPending ? 'Approving…' : 'Approve'}
            </Button>
          ) : null}
          {showRejectButton ? (
            <Button
              type="button"
              variant="outline"
              className="border-[#ed8936] text-[#c05621]"
              disabled={!canRejectTrip || reviewActionBusy}
              onClick={openRejectDialog}
            >
              Reject
            </Button>
          ) : null}
        </div>
      ) : showCallForPickupButton ? (
        <div className="flex flex-wrap gap-3 pt-2">
          <Button
            type="button"
            className="bg-[var(--fms-button)] text-white hover:bg-[var(--fms-button-hover)]"
            disabled={pickupMutation.isPending}
            onClick={handleCallForPickup}
          >
            {pickupMutation.isPending ? 'Calling…' : 'Call for Pickup'}
          </Button>
        </div>
      ) : null}

      <Dialog open={rejectDialogOpen} onOpenChange={(open) => !open && closeRejectDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader className="items-center text-center">
            <div className="mb-2 rounded-full bg-[var(--fms-error-fill)] p-2.5">
              <AlertTriangle className="h-5 w-5 text-[var(--fms-delete)]" />
            </div>
            <DialogTitle>Reject Trip Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to reject this trip request for {trip.applicantName}? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="trip-reject-remarks">
              Remarks <span className="text-[var(--fms-delete)]">*</span>
            </Label>
            <textarea
              id="trip-reject-remarks"
              value={rejectRemarks}
              onChange={(event) => setRejectRemarks(event.target.value)}
              placeholder="Provide a reason for rejecting this trip request"
              rows={4}
              disabled={rejectMutation.isPending}
              className="min-h-[96px] w-full rounded-lg border border-[var(--fms-strokes)] bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <DialogFooter className="justify-center gap-2 sm:justify-center">
            <Button
              type="button"
              variant="outline"
              disabled={rejectMutation.isPending}
              onClick={closeRejectDialog}
            >
              Close
            </Button>
            <Button
              type="button"
              className="bg-[var(--fms-delete)] text-white hover:bg-[#c70009]"
              disabled={rejectMutation.isPending}
              onClick={confirmReject}
            >
              {rejectMutation.isPending ? 'Rejecting…' : 'Confirm Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={overrideDialogOpen} onOpenChange={(open) => !open && closeOverrideDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manual Override</DialogTitle>
            <DialogDescription>
              Assign a different vehicle and driver for this trip.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                Vehicle <RequiredMark />
              </Label>
              <SearchableAutocomplete
                value={overrideForm.vehicleId}
                onChange={(value) =>
                  setOverrideForm((prev) => ({
                    ...prev,
                    vehicleId: value,
                    driverId: '',
                  }))
                }
                options={vehicleOptions}
                loading={vehiclesQuery.isLoading}
                disabled={overrideMutation.isPending}
                placeholder="Select vehicle"
                searchPlaceholder="Search by plate or model…"
                emptyMessage="No vehicles found."
                loadingMessage="Loading vehicles…"
                side="top"
                className="[&_button]:bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label>
                Driver <RequiredMark />
              </Label>
              <SearchableAutocomplete
                value={overrideForm.driverId}
                onChange={(value) =>
                  setOverrideForm((prev) => ({ ...prev, driverId: value }))
                }
                options={driverOptions}
                loading={driversQueryLoading}
                disabled={overrideMutation.isPending || !selectedOverrideVehicleId}
                placeholder={selectedOverrideVehicleId ? 'Select driver' : 'Select a vehicle first'}
                searchPlaceholder="Search by name or CID…"
                emptyMessage="No assigned drivers found for this vehicle."
                loadingMessage="Loading assigned drivers…"
                side="top"
                className="[&_button]:bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="override-remarks">Remarks</Label>
              <textarea
                id="override-remarks"
                value={overrideForm.remarks}
                onChange={(event) =>
                  setOverrideForm((prev) => ({ ...prev, remarks: event.target.value }))
                }
                placeholder="Enter remarks (optional)"
                rows={3}
                disabled={overrideMutation.isPending}
                className="min-h-[72px] w-full rounded-lg border border-[var(--fms-strokes)] bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={overrideMutation.isPending}
              onClick={closeOverrideDialog}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={overrideMutation.isPending || vehiclesQuery.isLoading || driversQueryLoading}
              onClick={confirmOverride}
            >
              {overrideMutation.isPending ? 'Saving…' : 'Save Override'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent
          className={cn(
            visibleTripFeedback.length > 1
              ? 'w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)]'
              : 'max-w-md sm:max-w-md',
          )}
        >
          <DialogHeader>
            <DialogTitle>Driver Rating</DialogTitle>
            <DialogDescription>
              Feedback submitted for trip {trip.requestId}.
            </DialogDescription>
          </DialogHeader>
          {feedbackQuery.isLoading ? (
            <p className="text-sm text-[var(--fms-text-subheading)]">Loading feedback…</p>
          ) : feedbackQuery.isError ? (
            <p className="text-sm text-[var(--fms-text-subheading)]">
              {feedbackQuery.error instanceof Error
                ? feedbackQuery.error.message
                : 'Could not load driver rating.'}
            </p>
          ) : visibleTripFeedback.length > 0 ? (
            <TripFeedbackSections
              items={visibleTripFeedback}
              pickupRequired={trip.pickupRequired}
              layout={visibleTripFeedback.length > 1 ? 'horizontal' : 'auto'}
            />
          ) : (
            <p className="text-sm text-[var(--fms-text-subheading)]">No feedback found.</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFeedbackDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
