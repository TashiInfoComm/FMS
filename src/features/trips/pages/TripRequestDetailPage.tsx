import { ArrowLeft, Car, CarFront, Pencil, User, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableAutocomplete } from '@/shared/components/SearchableAutocomplete'
import {
  getTripRequestById,
  TRIP_OVERRIDE_DRIVERS,
  TRIP_OVERRIDE_VEHICLE_CATEGORIES,
  TRIP_OVERRIDE_VEHICLES,
  TRIP_OVERRIDE_VEHICLE_TYPES,
  type TripRequestDetail,
  type TripRequestPriority,
} from '@/features/trips/lib/trip-request-mock-data'
import { isLocalOrPickDropTrip, isLongTrip } from '@/features/trips/lib/trip-form-utils'
import { PageHeader } from '@/shared/components/PageHeader'
import { useAccessControl } from '@/shared/hooks/useAccessControl'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showSuccessToast } from '@/shared/lib/toast'
import { cn } from '@/lib/utils'

function RequiredMark() {
  return <span className="text-[var(--fms-delete)]">*</span>
}

function priorityBadgeClass(priority: TripRequestPriority) {
  switch (priority) {
    case 'High':
      return 'border-transparent bg-[#fde8e8] text-[#c53030] hover:bg-[#fde8e8]'
    case 'Low':
      return 'border-transparent bg-[#edf2f7] text-[#4a5568] hover:bg-[#edf2f7]'
    default:
      return 'border-transparent bg-[#edf2f7] text-[#2d3748] hover:bg-[#edf2f7]'
  }
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

function SuggestionCard({
  kind,
  title,
  primary,
  secondary,
  tertiary,
}: {
  kind: 'vehicle' | 'driver'
  title: string
  primary: string
  secondary: string
  tertiary?: string
}) {
  const Icon = kind === 'vehicle' ? CarFront : User
  return (
    <div className="rounded-lg border border-[#b8e6cf] bg-[#f0faf4] p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#0f8e5c]">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <p className="font-semibold text-[var(--fms-text-header)]">{primary}</p>
      <p className="text-sm text-[var(--fms-text-subheading)]">{secondary}</p>
      {tertiary ? (
        <p className="text-sm text-[var(--fms-text-subheading)]">{tertiary}</p>
      ) : null}
    </div>
  )
}

type OverrideFormState = {
  vehicleType: string
  vehicleCategory: string
  vehicleNumber: string
  driver: string
  remarks: string
}

const emptyOverrideForm = (): OverrideFormState => ({
  vehicleType: '',
  vehicleCategory: '',
  vehicleNumber: '',
  driver: '',
  remarks: '',
})

function TripRequestDetailContent({ trip }: { trip: TripRequestDetail }) {
  const navigate = useNavigate()
  const crud = useRouteCrudPermissions('/trip/request')
  const { role } = useAccessControl()
  const isMto = role === 'fms-mto'

  const [overrideOpen, setOverrideOpen] = useState(false)
  const [overrideForm, setOverrideForm] = useState<OverrideFormState>(emptyOverrideForm)

  const showLocalFields = isLocalOrPickDropTrip(trip.tripType)
  const showLongFields = isLongTrip(trip.tripType)

  const canReview = isMto && crud.isResolved && crud.canRead

  const handleApprove = () => {
    if (overrideOpen) {
      if (
        !overrideForm.vehicleType ||
        !overrideForm.vehicleCategory ||
        !overrideForm.vehicleNumber ||
        !overrideForm.driver
      ) {
        return
      }
      showSuccessToast('Trip approved with manual assignment override.')
    } else {
      showSuccessToast('Trip approved with suggested assignment.')
    }
    navigate('/trip/request')
  }

  const handleReject = () => {
    showSuccessToast('Trip request rejected.')
    navigate('/trip/request')
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="icon" className="shrink-0" asChild>
            <Link to="/trip/request" aria-label="Back to trip requests">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <PageHeader
            title={trip.requestId}
            subtitle={`${trip.applicantName} · ${trip.status}`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border-transparent bg-[#e8f0ff] text-[var(--fms-primary)] hover:bg-[#e8f0ff]">
            {trip.tripType}
          </Badge>
          <Badge className={priorityBadgeClass(trip.priority)}>{trip.priority}</Badge>
        </div>
      </div>

      <Card className="border border-[var(--fms-strokes)] bg-white">
        <CardContent className="space-y-4 pt-5">
          <SectionHeader
            icon={User}
            title="Applicant Information"
            subtitle="Basic personal and organizational details of the applicant."
          />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <FieldReadOnly label="Employee ID" value={trip.employeeId} />
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
            {showLongFields && trip.tripDurationDays != null ? (
              <FieldReadOnly
                label="Trip Duration"
                value={`${trip.tripDurationDays} day${trip.tripDurationDays === 1 ? '' : 's'}`}
              />
            ) : null}
            {showLocalFields ? (
              <FieldReadOnly
                label="Pickup Required"
                value={trip.pickupRequired ? 'Yes' : 'No'}
              />
            ) : null}
          </div>
          <FieldReadOnly
            label={showLongFields ? 'Trip details justification' : 'Remarks'}
            value={showLongFields ? trip.tripDetailsJustification : trip.remarks}
            className="w-full"
          />
          {showLongFields && trip.movementOrderFileName ? (
            <div className="space-y-2">
              <Label>Movement Order</Label>
              <Input
                readOnly
                value={trip.movementOrderFileName}
                className="bg-[#f8f8f9] text-[var(--fms-primary)]"
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
                      key={official.employeeCid}
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

      <Card className="border border-[var(--fms-strokes)] bg-white">
        <CardContent className="space-y-4 pt-5">
          <SectionHeader
            icon={CarFront}
            title="Vehicle & Driver"
            subtitle="Suggestions and assignments for the trip."
            action={
              isMto && canReview ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setOverrideOpen((open) => !open)
                    if (overrideOpen) setOverrideForm(emptyOverrideForm())
                  }}
                >
                  <Pencil className="mr-1 h-4 w-4" />
                  Manual Override
                </Button>
              ) : null
            }
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <SuggestionCard
              kind="vehicle"
              title="Suggested Vehicle"
              primary={trip.suggestedVehicle.plateNumber}
              secondary={trip.suggestedVehicle.model}
              tertiary={trip.suggestedVehicle.color}
            />
            <SuggestionCard
              kind="driver"
              title="Suggested Driver"
              primary={trip.suggestedDriver.name}
              secondary={trip.suggestedDriver.contact}
              tertiary={`Rating ${trip.suggestedDriver.rating}/5`}
            />
          </div>

          {isMto && overrideOpen ? (
            <div className="space-y-4 rounded-xl border border-[var(--fms-strokes)] bg-[#fafafa] p-4">
              <SectionHeader
                icon={CarFront}
                title="Override Assignment"
                subtitle="Assignments for the trip."
              />
              <div className="grid gap-4 md:grid-cols-2">
                <OverrideSelect
                  label="Vehicle Type"
                  required
                  value={overrideForm.vehicleType}
                  placeholder="Select vehicle type"
                  options={[...TRIP_OVERRIDE_VEHICLE_TYPES]}
                  onChange={(value) =>
                    setOverrideForm((prev) => ({ ...prev, vehicleType: value }))
                  }
                />
                <OverrideSelect
                  label="Vehicle category"
                  required
                  value={overrideForm.vehicleCategory}
                  placeholder="Select vehicle category"
                  options={[...TRIP_OVERRIDE_VEHICLE_CATEGORIES]}
                  onChange={(value) =>
                    setOverrideForm((prev) => ({ ...prev, vehicleCategory: value }))
                  }
                />
                <OverrideSelect
                  label="Vehicle Number"
                  required
                  value={overrideForm.vehicleNumber}
                  placeholder="Select vehicle number"
                  options={[...TRIP_OVERRIDE_VEHICLES]}
                  onChange={(value) =>
                    setOverrideForm((prev) => ({ ...prev, vehicleNumber: value }))
                  }
                />
                <OverrideSelect
                  label="Driver"
                  required
                  value={overrideForm.driver}
                  placeholder="Select driver"
                  options={[...TRIP_OVERRIDE_DRIVERS]}
                  onChange={(value) =>
                    setOverrideForm((prev) => ({ ...prev, driver: value }))
                  }
                />
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="override-remarks">Remarks</Label>
                  <textarea
                    id="override-remarks"
                    value={overrideForm.remarks}
                    onChange={(event) =>
                      setOverrideForm((prev) => ({
                        ...prev,
                        remarks: event.target.value,
                      }))
                    }
                    placeholder="Enter remark"
                    className="min-h-[88px] w-full rounded-lg border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {canReview ? (
        <div className="flex flex-wrap gap-3 border-t border-[var(--fms-strokes)] pt-2">
          <Button type="button" onClick={handleApprove}>
            {overrideOpen ? 'Save & Approve' : 'Confirm & Approve'}
          </Button>
          <Button type="button" variant="outline" className="border-[#ed8936] text-[#c05621]" onClick={handleReject}>
            Reject
          </Button>
          <Button type="button" variant="destructive" asChild>
            <Link to="/trip/request">Close</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3 pt-2">
          <Button type="button" variant="outline" asChild>
            <Link to="/trip/request">Back to list</Link>
          </Button>
        </div>
      )}
    </section>
  )
}

function OverrideSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder: string
  required?: boolean
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
        placeholder={placeholder}
        searchPlaceholder="Type to search…"
        className="[&_button]:bg-white"
      />
    </div>
  )
}

export default function TripRequestDetailPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const crud = useRouteCrudPermissions('/trip/request')

  const trip = useMemo(
    () => (requestId ? getTripRequestById(requestId) : undefined),
    [requestId],
  )

  if (crud.isResolved && !crud.canRead) {
    return (
      <section className="space-y-5">
        <PageHeader title="Trip Request" subtitle="Trip request detail" />
        <p className="text-sm text-[var(--fms-text-subheading)]">
          You do not have permission to view this trip request.
        </p>
      </section>
    )
  }

  if (!trip) {
    return (
      <section className="space-y-5">
        <Button variant="outline" size="icon" asChild>
          <Link to="/trip/request" aria-label="Back to trip requests">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader title="Trip Request" subtitle="Request not found" />
        <p className="text-sm text-[var(--fms-text-subheading)]">
          No trip request matches &ldquo;{requestId}&rdquo;. Return to the list and try again.
        </p>
        <Button variant="outline" asChild>
          <Link to="/trip/request">Back to Trip Requests</Link>
        </Button>
      </section>
    )
  }

  return <TripRequestDetailContent trip={trip} />
}
