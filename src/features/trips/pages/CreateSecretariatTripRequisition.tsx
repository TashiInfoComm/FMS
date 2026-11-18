import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Car, CloudUpload, Plus, Search, Trash2, User, Users } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  calculateTripDurationDays,
  formatTripDurationDisplay,
  toIsoDatetime,
} from '@/features/trips/lib/trip-form-utils'
import { TripDetailSkeleton } from '@/features/trips/components/TripDetailSkeleton'
import { fetchTripRequisitionMasterLists } from '@/features/trips/lib/trip-requisition-masters'
import type { TripMasterOption } from '@/features/trips/lib/trip-form-utils'
import {
  createSecretariatRequisition,
  fetchSecretariatRequisitionDetail,
  updateSecretariatRequisition,
} from '@/features/trips/lib/secretariat-requisitions-api'
import type { ApiRecord } from '@/features/user/lib/roles-api'
import { mapUserDetailFields, searchAgencyUserByCid, searchUserByCid } from '@/features/user/lib/users-api'
import { useUserStore } from '@/services/user-store'
import { BackToListButton } from '@/shared/components/BackToListButton'
import { PageHeader } from '@/shared/components/PageHeader'
import { SearchableAutocomplete } from '@/shared/components/SearchableAutocomplete'
import { useAccessControl } from '@/shared/hooks/useAccessControl'
import { roleMatches, userHandlesDesignatedVehicles } from '@/shared/lib/designated-mto-access'
import { nowDatetimeLocalValue } from '@/shared/lib/date-input'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'
import { cn } from '@/lib/utils'

const LIST_PATH = '/secretariat-requisitions'
const NOTE_SHEET_MAX_BYTES = 5 * 1024 * 1024

type ApplicantState = {
  employeeId: string
  name: string
  designation: string
  agency: string
  department: string
  division: string
  subDivision: string
  contact: string
  email: string
}

type OfficialRow = {
  key: string
  cid: string
  fullName: string
  lookupLoading?: boolean
}

type TripFormState = {
  purposeOfJourney: string
  vehicleCategoryId: string
  origin: string
  finalDestination: string
  startDatetime: string
  endDatetime: string
  justification: string
}

const emptyTripForm = (): TripFormState => ({
  purposeOfJourney: '',
  vehicleCategoryId: '',
  origin: '',
  finalDestination: '',
  startDatetime: '',
  endDatetime: '',
  justification: '',
})

function directoryValue(value: string | undefined): string {
  const trimmed = value?.trim() ?? ''
  if (!trimmed || trimmed === '-' || trimmed === '—') return ''
  return trimmed
}

function requisitionStatusCode(status: string): string {
  return status.trim().toUpperCase().replace(/[\s-]+/g, '_')
}

function toDatetimeLocalValue(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return nowDatetimeLocalValue(parsed)
}

function resolveMasterValue(options: TripMasterOption[], id: string, label: string): string {
  const trimmedId = directoryValue(id)
  if (trimmedId && options.some((option) => option.value === trimmedId)) return trimmedId
  const needle = directoryValue(label).toLowerCase()
  if (!needle) return trimmedId
  const match = options.find(
    (option) =>
      option.label.trim().toLowerCase() === needle ||
      option.value.trim().toLowerCase() === needle,
  )
  return match?.value || trimmedId
}

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
  action?: ReactNode
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

function FieldReadOnly({ label, value }: { label: string; value?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        readOnly
        value={directoryValue(value)}
        placeholder="Auto-populate"
        className="bg-[#f8f8f9] text-[var(--fms-text-header)]"
      />
    </div>
  )
}

export default function CreateSecretariatTripRequisition() {
  const navigate = useNavigate()
  const { requisitionId } = useParams<{ requisitionId: string }>()
  const isEdit = Boolean(requisitionId?.trim())
  const queryClient = useQueryClient()
  const { role } = useAccessControl()
  const currentUser = useUserStore((state) => state.user)
  const currentUserAgency = useMemo(() => {
    if (!currentUser || typeof currentUser !== 'object' || Array.isArray(currentUser)) return ''
    return directoryValue(mapUserDetailFields(currentUser as ApiRecord).agency)
  }, [currentUser])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [cidInput, setCidInput] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [applicant, setApplicant] = useState<ApplicantState | null>(null)
  const [tripForm, setTripForm] = useState<TripFormState>(emptyTripForm)
  const [officials, setOfficials] = useState<OfficialRow[]>([])
  const [noteSheetFile, setNoteSheetFile] = useState<File | null>(null)
  const [existingNoteSheetName, setExistingNoteSheetName] = useState('')
  const [version, setVersion] = useState('')
  const [hydrated, setHydrated] = useState(!isEdit)

  const isMto = roleMatches(role, 'fms-mto')

  const mastersQuery = useQuery({
    queryKey: ['trips', 'requisition-masters'],
    queryFn: fetchTripRequisitionMasterLists,
    staleTime: 5 * 60_000,
    enabled: isMto,
  })

  const detailQuery = useQuery({
    queryKey: ['secretariat-requisitions', 'detail', requisitionId],
    queryFn: () => fetchSecretariatRequisitionDetail(requisitionId!),
    enabled: isEdit && isMto,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!isEdit || hydrated || !detailQuery.data) return
    const detail = detailQuery.data
    setApplicant({
      employeeId: directoryValue(detail.employeeId),
      name: directoryValue(detail.applicantName),
      designation: directoryValue(detail.designation),
      agency: directoryValue(detail.agency) || currentUserAgency,
      department: directoryValue(detail.department),
      division: directoryValue(detail.division),
      subDivision: directoryValue(detail.subDivision),
      contact: directoryValue(detail.contactNumber),
      email: directoryValue(detail.email),
    })
    setTripForm({
      purposeOfJourney: detail.purposeId,
      vehicleCategoryId: detail.vehicleCategoryId,
      origin: directoryValue(detail.origin),
      finalDestination: directoryValue(detail.destination),
      startDatetime: toDatetimeLocalValue(detail.startDatetimeIso),
      endDatetime: toDatetimeLocalValue(detail.endDatetimeIso),
      justification: directoryValue(detail.justification),
    })
    setOfficials(
      detail.officials
        .filter((official) => directoryValue(official.cid) || directoryValue(official.fullName))
        .map((official, index) => ({
          key: `official-${official.cid}-${index}`,
          cid: directoryValue(official.cid),
          fullName: directoryValue(official.fullName),
        })),
    )
    setExistingNoteSheetName(detail.noteSheet?.name ?? '')
    setVersion(detail.version)
    setHydrated(true)
  }, [currentUserAgency, detailQuery.data, hydrated, isEdit])

  useEffect(() => {
    if (!isEdit || !detailQuery.data || !mastersQuery.data) return
    const detail = detailQuery.data
    setTripForm((prev) => ({
      ...prev,
      purposeOfJourney: resolveMasterValue(
        mastersQuery.data.journeyPurposes,
        detail.purposeId || prev.purposeOfJourney,
        detail.purpose,
      ),
      vehicleCategoryId: resolveMasterValue(
        mastersQuery.data.vehicleTypes,
        detail.vehicleCategoryId || prev.vehicleCategoryId,
        detail.vehicleCategory,
      ),
    }))
  }, [detailQuery.data, isEdit, mastersQuery.data])

  const durationDays = useMemo(
    () => calculateTripDurationDays(tripForm.startDatetime, tripForm.endDatetime),
    [tripForm.startDatetime, tripForm.endDatetime],
  )
  const durationDisplay = useMemo(
    () => formatTripDurationDisplay(tripForm.startDatetime, tripForm.endDatetime),
    [tripForm.startDatetime, tripForm.endDatetime],
  )

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!applicant) throw new Error('Look up the secretariat employee before submitting.')
      if (!isEdit && !noteSheetFile) {
        throw new Error('Applicant and approval note sheet are required.')
      }
      const payload = {
        employeeId: applicant.employeeId,
        applicantName: applicant.name,
        designation: applicant.designation,
        agency: applicant.agency || currentUserAgency,
        department: applicant.department,
        division: applicant.division,
        subDivision: applicant.subDivision,
        contactNumber: applicant.contact,
        email: applicant.email,
        purposeId: tripForm.purposeOfJourney,
        vehicleCategoryId: tripForm.vehicleCategoryId,
        origin: tripForm.origin.trim(),
        finalDestination: tripForm.finalDestination.trim(),
        startDatetime: toIsoDatetime(tripForm.startDatetime),
        endDatetime: toIsoDatetime(tripForm.endDatetime),
        tripDurationDays: Number.parseInt(durationDays, 10),
        tripDetailsJustification: tripForm.justification.trim(),
        accompanyingOfficials: officials.map((row) => ({
          cid: row.cid.trim(),
          fullName: row.fullName.trim(),
        })),
      }
      if (isEdit) {
        return updateSecretariatRequisition(requisitionId!, {
          ...payload,
          noteSheetFile,
          version,
        })
      }
      return createSecretariatRequisition({
        ...payload,
        noteSheetFile: noteSheetFile!,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['secretariat-requisitions'] })
      showSuccessToast(
        isEdit
          ? 'Secretariat trip requisition resubmitted.'
          : 'Secretariat trip requisition submitted.',
      )
      navigate(isEdit ? `${LIST_PATH}/${encodeURIComponent(requisitionId!)}` : LIST_PATH)
    },
    onError: (error) => {
      showErrorToast(
        error,
        isEdit
          ? 'Failed to resubmit secretariat trip requisition'
          : 'Failed to submit secretariat trip requisition',
      )
    },
  })

  const lookupEmployee = async () => {
    const cid = cidInput.trim()
    if (!cid) {
      showErrorToast('Enter the secretariat CID.')
      return
    }
    setLookupLoading(true)
    try {
      const person = await searchAgencyUserByCid(cid)
      setApplicant({
        employeeId: directoryValue(person.employeeId),
        name: directoryValue(person.name),
        designation: directoryValue(person.designation),
        agency: currentUserAgency,
        department: directoryValue(person.department),
        division: directoryValue(person.division),
        subDivision: directoryValue(person.subDivision),
        contact: directoryValue(person.contact),
        email: directoryValue(person.email),
      })
    } catch (error) {
      setApplicant(null)
      showErrorToast(error, 'Could not find this secretariat user')
    } finally {
      setLookupLoading(false)
    }
  }

  const validate = (): string | null => {
    if (lookupLoading) return 'Please wait for the employee lookup to finish.'
    if (!applicant?.employeeId || !applicant.name) {
      return 'Look up the secretariat employee before submitting.'
    }
    if (!tripForm.purposeOfJourney) return 'Purpose of journey is required.'
    if (!tripForm.vehicleCategoryId) return 'Preferred vehicle category is required.'
    if (!tripForm.origin.trim()) return 'Origin is required.'
    if (!tripForm.finalDestination.trim()) return 'Final destination is required.'
    if (!tripForm.startDatetime) return 'Journey start date and time is required.'
    if (!tripForm.endDatetime) return 'Journey end date and time is required.'
    if (new Date(tripForm.endDatetime).getTime() < new Date(tripForm.startDatetime).getTime()) {
      return 'Journey end must be after journey start.'
    }
    if (!durationDays) return 'Trip duration could not be calculated from the selected dates.'
    if (!isEdit && !noteSheetFile) return 'Approval note sheet upload is required.'
    if (noteSheetFile && noteSheetFile.size > NOTE_SHEET_MAX_BYTES) {
      return 'Approval note sheet must be 5MB or smaller.'
    }
    for (const row of officials) {
      if (row.lookupLoading) return 'Please wait for accompanying official lookup to finish.'
      if (row.cid.trim() && !row.fullName.trim()) {
        return 'Full name is required for each accompanying official.'
      }
      if (!row.cid.trim() && row.fullName.trim()) {
        return 'CID is required for each accompanying official.'
      }
    }
    return null
  }

  const addOfficialRow = () => {
    setOfficials((prev) => [
      ...prev,
      { key: `official-${Date.now()}-${prev.length}`, cid: '', fullName: '' },
    ])
  }

  const updateOfficialRow = (key: string, patch: Partial<OfficialRow>) => {
    setOfficials((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  const searchOfficialByCid = async (key: string) => {
    const row = officials.find((item) => item.key === key)
    const cid = row?.cid.trim() ?? ''
    if (!cid) {
      showErrorToast('Enter a CID to search.')
      return
    }
    updateOfficialRow(key, { lookupLoading: true, fullName: '' })
    try {
      const user = await searchUserByCid(cid)
      if (!user) throw new Error('No user found for this CID.')
      updateOfficialRow(key, { cid: user.cid, fullName: user.fullName, lookupLoading: false })
    } catch (error) {
      updateOfficialRow(key, { lookupLoading: false, fullName: '' })
      showErrorToast(error, 'Failed to find user by CID.')
    }
  }

  const backPath =
    isEdit && requisitionId ? `${LIST_PATH}/${encodeURIComponent(requisitionId)}` : LIST_PATH
  const editStatusCode = requisitionStatusCode(
    detailQuery.data?.statusCode || detailQuery.data?.status || '',
  )

  if (!isMto) {
    return (
      <section className="space-y-5">
        <BackToListButton to={LIST_PATH} />
        <PageHeader
          title="Secretariat Trip Requisition"
          subtitle={
            isEdit
              ? 'Edit and resubmit a rejected requisition.'
              : 'Create a requisition on behalf of a secretariat employee.'
          }
        />
        <p className="text-sm text-[var(--fms-text-subheading)]">
          {isEdit
            ? 'Only the MTO role can edit and resubmit a secretariat trip requisition.'
            : 'Only the MTO role can create a secretariat trip requisition.'}
        </p>
      </section>
    )
  }

  if (isEdit && userHandlesDesignatedVehicles(currentUser)) {
    return (
      <section className="space-y-5">
        <BackToListButton to={backPath} />
        <PageHeader title="Edit and Resubmit" subtitle="Requisition was rejected" />
        <p className="text-sm text-[var(--fms-text-subheading)]">
          An MTO who handles designated vehicles cannot edit and resubmit a secretariat trip
          requisition.
        </p>
      </section>
    )
  }

  if (isEdit && detailQuery.isLoading) {
    return <TripDetailSkeleton title="Edit and Resubmit" backPath={backPath} />
  }

  if (isEdit && (detailQuery.isError || !detailQuery.data)) {
    return (
      <section className="space-y-5">
        <BackToListButton to={LIST_PATH} />
        <PageHeader title="Edit and Resubmit" subtitle="Requisition not found" />
        <p className="text-sm text-[var(--fms-text-subheading)]">
          {detailQuery.error instanceof Error
            ? detailQuery.error.message
            : 'This secretariat requisition could not be loaded.'}
        </p>
      </section>
    )
  }

  if (isEdit && editStatusCode !== 'REJECTED') {
    return (
      <section className="space-y-5">
        <BackToListButton to={backPath} />
        <PageHeader title="Edit and Resubmit" subtitle="Requisition is not rejected" />
        <p className="text-sm text-[var(--fms-text-subheading)]">
          Edit and resubmit is available only after a secretariat trip requisition is rejected.
        </p>
      </section>
    )
  }

  if (isEdit && !hydrated) {
    return <TripDetailSkeleton title="Edit and Resubmit" backPath={backPath} />
  }

  return (
    <section className="space-y-5">
      <BackToListButton to={backPath} />
      <PageHeader
        title={isEdit ? 'Edit and Resubmit' : 'Travel Request Form'}
        subtitle={
          isEdit
            ? 'Update this rejected secretariat trip requisition and send it back for review.'
            : 'Create a secretariat trip requisition on behalf of a secretariat employee.'
        }
      />

      <Card className="border border-[var(--fms-strokes)] bg-white">
        <CardContent className="space-y-4 pt-5">
          <SectionHeader
            icon={User}
            title="Applicant Information"
            subtitle="Search the secretariat by CID from your agency user list."
          />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>
                CID <RequiredMark />
              </Label>
              <div className="flex gap-2">
                <Input
                  value={cidInput}
                  placeholder="Enter secretariat CID"
                  onChange={(event) => {
                    setCidInput(event.target.value)
                    setApplicant(null)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void lookupEmployee()
                    }
                  }}
                />
                <Button
                  type="button"
                  className="shrink-0 gap-1.5 bg-[var(--fms-info-text)] text-white hover:bg-[var(--fms-info-text)]/90"
                  disabled={lookupLoading || !cidInput.trim()}
                  onClick={() => void lookupEmployee()}
                >
                  <Search className="h-4 w-4" />
                  {lookupLoading ? 'Searching…' : 'Search'}
                </Button>
              </div>
            </div>
            <FieldReadOnly label="Employee ID" value={applicant?.employeeId} />
            <FieldReadOnly label="Applicant Name" value={applicant?.name} />
            <FieldReadOnly label="Designation" value={applicant?.designation} />
            <FieldReadOnly label="Agency" value={currentUserAgency} />
            <FieldReadOnly label="Department" value={applicant?.department} />
            <FieldReadOnly label="Division" value={applicant?.division} />
            <FieldReadOnly label="Sub Division" value={applicant?.subDivision} />
            <FieldReadOnly label="Contact Number" value={applicant?.contact} />
            <FieldReadOnly label="Email" value={applicant?.email} />
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
            <FieldReadOnly label="Trip Type" value="Long Trip" />
            <div className="space-y-2">
              <Label>
                Purpose of Journey <RequiredMark />
              </Label>
              <SearchableAutocomplete
                value={tripForm.purposeOfJourney}
                onChange={(value) => setTripForm((prev) => ({ ...prev, purposeOfJourney: value }))}
                options={mastersQuery.data?.journeyPurposes ?? []}
                loading={mastersQuery.isLoading}
                placeholder="Select purpose"
                searchPlaceholder="Type to search…"
              />
            </div>
            <div className="space-y-2">
              <Label>
                Preferred Vehicle Category <RequiredMark />
              </Label>
              <SearchableAutocomplete
                value={tripForm.vehicleCategoryId}
                onChange={(value) => setTripForm((prev) => ({ ...prev, vehicleCategoryId: value }))}
                options={mastersQuery.data?.vehicleTypes ?? []}
                loading={mastersQuery.isLoading}
                placeholder="Select vehicle category"
                searchPlaceholder="Type to search…"
              />
            </div>
            <div className="space-y-2">
              <Label>Origin</Label>
              <Input
                value={tripForm.origin}
                onChange={(event) => setTripForm((prev) => ({ ...prev, origin: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Final Destination</Label>
              <Input
                value={tripForm.finalDestination}
                onChange={(event) =>
                  setTripForm((prev) => ({ ...prev, finalDestination: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>
                Journey Start Date & Time <RequiredMark />
              </Label>
              <Input
                type="datetime-local"
                min={nowDatetimeLocalValue()}
                value={tripForm.startDatetime}
                onChange={(event) =>
                  setTripForm((prev) => ({ ...prev, startDatetime: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>
                Journey End Date & Time <RequiredMark />
              </Label>
              <Input
                type="datetime-local"
                min={tripForm.startDatetime || nowDatetimeLocalValue()}
                value={tripForm.endDatetime}
                onChange={(event) =>
                  setTripForm((prev) => ({ ...prev, endDatetime: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Trip Duration (Days)</Label>
              <Input readOnly value={durationDisplay} placeholder="Auto-calculated" className="bg-[#f8f8f9]" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="secretariat-justification">Trip details justification</Label>
            <textarea
              id="secretariat-justification"
              value={tripForm.justification}
              onChange={(event) =>
                setTripForm((prev) => ({ ...prev, justification: event.target.value }))
              }
              placeholder="Provide additional details or justification for the trip"
              className="min-h-[88px] w-full rounded-lg border border-[var(--fms-strokes)] bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          <div className="space-y-2">
            <Label>
              Upload Approval Note sheet {isEdit ? null : <RequiredMark />}
            </Label>
            {isEdit && existingNoteSheetName && !noteSheetFile ? (
              <p className="text-xs text-[var(--fms-text-subheading)]">
                Current note sheet: {existingNoteSheetName}. Leave this empty to keep it.
              </p>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              className="sr-only"
              onChange={(event) => setNoteSheetFile(event.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--fms-strokes)] bg-[#fafafa] px-4 py-8 text-center transition-colors hover:bg-[#f3f4f6]',
                noteSheetFile && 'border-[var(--fms-primary)] bg-[#f8fbff]',
              )}
            >
              <CloudUpload className="h-8 w-8 text-[var(--fms-text-subheading)]" />
              <span className="text-sm font-medium text-[var(--fms-text-header)]">
                {noteSheetFile ? noteSheetFile.name : 'Click to upload or drag and drop'}
              </span>
              <span className="text-xs text-[var(--fms-text-subheading)]">
                PDF, DOC, DOCX, JPG or PNG (max 5MB)
              </span>
            </button>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-[var(--fms-strokes)] bg-white">
        <CardContent className="space-y-4 pt-5">
          <SectionHeader
            icon={Users}
            title="Accompanying Officials"
            subtitle="Add employees travelling with the secretariat on this trip."
            action={
              <Button type="button" variant="outline" size="sm" onClick={addOfficialRow}>
                <Plus className="mr-1 h-4 w-4" />
                Add Another Official
              </Button>
            }
          />
          {officials.length === 0 ? (
            <p className="text-sm text-[var(--fms-text-subheading)]">No accompanying officials added.</p>
          ) : (
            <div className="space-y-3">
              {officials.map((row) => (
                <div key={row.key} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                  <div className="space-y-2">
                    <Label>
                      CID <RequiredMark />
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={row.cid}
                        placeholder="Enter CID"
                        onChange={(event) =>
                          updateOfficialRow(row.key, { cid: event.target.value, fullName: '' })
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            void searchOfficialByCid(row.key)
                          }
                        }}
                      />
                      <Button
                        type="button"
                        className="shrink-0 gap-1.5 bg-[var(--fms-info-text)] text-white hover:bg-[var(--fms-info-text)]/90"
                        disabled={row.lookupLoading || !row.cid.trim()}
                        onClick={() => void searchOfficialByCid(row.key)}
                      >
                        <Search className="h-4 w-4" />
                        {row.lookupLoading ? 'Searching…' : 'Search'}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Full Name <RequiredMark />
                    </Label>
                    <Input
                      readOnly
                      value={row.lookupLoading ? 'Searching users…' : row.fullName}
                      placeholder="Auto Fetch"
                      className="bg-[#f8f8f9]"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-[var(--fms-delete)]"
                    aria-label="Remove official"
                    onClick={() => setOfficials((prev) => prev.filter((item) => item.key !== row.key))}
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
          <Link to={backPath}>Close</Link>
        </Button>
        <Button
          type="button"
          disabled={submitMutation.isPending || lookupLoading || (isEdit && !hydrated)}
          onClick={() => {
            const message = validate()
            if (message) {
              showErrorToast(message)
              return
            }
            submitMutation.mutate()
          }}
        >
          {submitMutation.isPending
            ? isEdit
              ? 'Resubmitting…'
              : 'Submitting…'
            : isEdit
              ? 'Resubmit'
              : 'Submit Request'}
        </Button>
      </div>
    </section>
  )
}
