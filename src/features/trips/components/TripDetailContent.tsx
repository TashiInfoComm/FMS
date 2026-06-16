import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, Car, CarFront, CloudUpload, Pencil, Star, User, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

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
import {
  approveTripAssign,
  fetchTripFeedback,
  openTripMovementOrder,
  overrideTripAssignment,
  rejectTrip,
  type TripDetail,
  type TripMovementOrderFile,
} from '@/features/trips/lib/trips-api'
import {
  feedbackRatingToStars,
  getFeedbackRatingLabel,
  getRatingLabel,
} from '@/features/trips/lib/trip-driver-feedback-mock-data'
import { fetchUsersForSelect } from '@/features/user/lib/users-api'
import { fetchVehicles } from '@/features/vehicles/lib/vehicles-api'
import { SearchableAutocomplete } from '@/shared/components/SearchableAutocomplete'
import { PageHeader } from '@/shared/components/PageHeader'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'
import { cn } from '@/lib/utils'

function RequiredMark() {
  return <span className="text-[var(--fms-delete)]">*</span>
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

function MovementOrderFileChip({
  file,
  loading = false,
  onClick,
}: {
  file: TripMovementOrderFile
  loading?: boolean
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
        {loading ? 'Opening movement order…' : file.name}
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
      <a href={file.url} className={chipClassName}>
        {content}
      </a>
    )
  }

  return <div className={chipClassName}>{content}</div>
}

function SuggestedVehicleCard({ vehicle }: { vehicle: TripSuggestedVehicle }) {
  const makeModel = formatSuggestedVehicleMakeModel(vehicle)

  return (
    <div className="rounded-lg border border-[#b8e6cf] bg-[#f0faf4] p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#0f8e5c]">
        <CarFront className="h-4 w-4" />
        Suggested Vehicle
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

function SuggestedDriverCard({ driver }: { driver: TripSuggestedDriver }) {
  return (
    <div className="rounded-lg border border-[#b8e6cf] bg-[#f0faf4] p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#0f8e5c]">
        <User className="h-4 w-4" />
        Suggested Driver
      </div>
      <p className="font-semibold text-[var(--fms-text-header)]">
        {driver.name !== '—' ? driver.name : '—'}
      </p>
      <DetailLine value={driver.contact} />
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

function FeedbackStars({ value, size = 'md' }: { value: number; size?: 'md' | 'sm' }) {
  const starClass = size === 'md' ? 'h-6 w-6' : 'h-4 w-4'
  return (
    <div className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, index) => {
        const starValue = index + 1
        const filled = starValue <= value
        return (
          <Star
            key={starValue}
            className={cn(
              starClass,
              filled ? 'fill-[#facc15] text-[#facc15]' : 'text-[#d1d5db]',
            )}
          />
        )
      })}
    </div>
  )
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

  const feedbackRatingStars = feedbackQuery.data
    ? feedbackRatingToStars(feedbackQuery.data.rating)
    : 0

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
  const showApproveButton =
    mode === 'request' && crud.isResolved && crud.canApprove && isPlanned
  const showRejectButton =
    mode === 'request' && crud.isResolved && crud.canReject && isPlanned
  const canApproveTrip = showApproveButton
  const canRejectTrip = showRejectButton
  const showReviewActions = showApproveButton || showRejectButton

  const movementOrderMutation = useMutation({
    mutationFn: () =>
      openTripMovementOrder(trip.id, trip.movementOrderFile?.name || ''),
    onError: (error) => {
      showErrorToast(error, 'Could not open movement order')
    },
  })

  const handleMovementOrderClick = () => {
    movementOrderMutation.mutate()
  }

  const vehiclesQuery = useQuery({
    queryKey: ['trips', 'override', 'vehicles'],
    queryFn: fetchVehicles,
    enabled: overrideDialogOpen && showApproveButton,
    staleTime: 30_000,
  })

  const usersQuery = useQuery({
    queryKey: ['trips', 'override', 'users'],
    queryFn: () => fetchUsersForSelect(),
    enabled: overrideDialogOpen && showApproveButton,
    staleTime: 30_000,
  })

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
      (usersQuery.data ?? []).map((user) => ({
        value: user.id,
        label: user.name,
        searchText: user.name,
      })),
    [usersQuery.data],
  )

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

  const hasSuggestedAssignment = Boolean(
    trip.systemSuggestedDriverId || trip.systemSuggestedVehicleId,
  )

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
    setOverrideForm(emptyOverrideForm())
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

  const reviewActionBusy =
    approveMutation.isPending || rejectMutation.isPending || overrideMutation.isPending

  const backLabel =
    mode === 'requisition' ? 'Back to my trips' : 'Back to trip requests'

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="icon" className="shrink-0" asChild>
            <Link to={backPath} aria-label={backLabel}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
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
        </div>
        {showDriverRatingButton ? (
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
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
            <FieldReadOnly label="Preferred Vehicle Type" value={trip.preferredVehicleType} />
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
          {showLongFields && trip.movementOrderFile ? (
            <div className="space-y-2">
              <Label>Movement Order</Label>
              <MovementOrderFileChip
                file={trip.movementOrderFile}
                loading={movementOrderMutation.isPending}
                onClick={handleMovementOrderClick}
              />
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

      {hasSuggestedAssignment || showReviewActions ? (
        <Card className="border border-[var(--fms-strokes)] bg-white">
          <CardContent className="space-y-4 pt-5">
            <SectionHeader
              icon={CarFront}
              title="Vehicle & Driver"
              subtitle="Suggestions and assignments for the trip."
              action={
                showApproveButton ? (
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

            {hasSuggestedAssignment ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {trip.systemSuggestedVehicleId ? (
                  <SuggestedVehicleCard vehicle={trip.suggestedVehicle} />
                ) : null}
                {trip.systemSuggestedDriverId ? (
                  <SuggestedDriverCard driver={trip.suggestedDriver} />
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
          {/* <Button type="button" variant="outline" asChild>
            <Link to={backPath}>{backLabel}</Link>
          </Button> */}
        </div>
      ) : (
        <div className="flex flex-wrap gap-3 pt-2">
          <Button type="button" variant="outline" asChild>
            <Link to={backPath}>{backLabel}</Link>
          </Button>
        </div>
      )}

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
                  setOverrideForm((prev) => ({ ...prev, vehicleId: value }))
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
                loading={usersQuery.isLoading}
                disabled={overrideMutation.isPending}
                placeholder="Select driver"
                searchPlaceholder="Search by name…"
                emptyMessage="No users found."
                loadingMessage="Loading users…"
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
              disabled={overrideMutation.isPending || vehiclesQuery.isLoading || usersQuery.isLoading}
              onClick={confirmOverride}
            >
              {overrideMutation.isPending ? 'Saving…' : 'Save Override'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent className="max-w-md">
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
          ) : feedbackQuery.data ? (
            <div className="space-y-4">
              <div className="space-y-2 rounded-lg border border-[var(--fms-strokes)] bg-[#f6f6f7] p-4">
                <Label>Rating</Label>
                <FeedbackStars value={feedbackRatingStars} />
                <p className="text-sm text-[var(--fms-text-header)]">
                  <span className="font-medium">{feedbackRatingStars} / 5 stars</span>
                  <span className="text-[var(--fms-text-subheading)]"> · </span>
                  <span>{getFeedbackRatingLabel(feedbackQuery.data.rating)}</span>
                  <span className="text-[var(--fms-text-subheading)]"> · </span>
                  <span>{getRatingLabel(feedbackRatingStars)}</span>
                </p>
              </div>
              <div className="space-y-2">
                <Label>Remarks</Label>
                <div className="min-h-[96px] rounded-lg border border-[var(--fms-strokes)] bg-[#f8f8f9] px-3 py-2.5 text-sm text-[var(--fms-text-header)]">
                  {feedbackQuery.data.reasonForRating.trim() || '—'}
                </div>
              </div>
            </div>
          ) : null}
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
