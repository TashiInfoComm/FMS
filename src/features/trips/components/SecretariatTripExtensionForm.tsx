import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Car, CloudUpload, Plus, Search, Trash2, Users } from 'lucide-react'
import { useMemo, useRef, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createSecretariatRequisitionExtension } from '@/features/trips/lib/secretariat-requisitions-api'
import { fetchTripRequisitionMasterLists } from '@/features/trips/lib/trip-requisition-masters'
import {
  calculateTripDurationDays,
  formatTripDurationDisplay,
  toIsoDatetime,
} from '@/features/trips/lib/trip-form-utils'
import { searchUserByCid } from '@/features/user/lib/users-api'
import { SearchableAutocomplete } from '@/shared/components/SearchableAutocomplete'
import { nowDatetimeLocalValue } from '@/shared/lib/date-input'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'
import { cn } from '@/lib/utils'

const NOTE_SHEET_MAX_BYTES = 5 * 1024 * 1024

type OfficialRow = {
  key: string
  cid: string
  fullName: string
  lookupLoading?: boolean
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
  icon: typeof Users
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

function displayValue(value: string | undefined): string {
  const trimmed = value?.trim() ?? ''
  return trimmed && trimmed !== '—' ? trimmed : ''
}

function nextDayDatetimeLocal(value: string | undefined): string {
  const trimmed = displayValue(value)
  if (!trimmed) return ''
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return ''
  const next = new Date(parsed)
  next.setDate(next.getDate() + 1)
  return nowDatetimeLocalValue(next)
}

export function SecretariatTripExtensionForm({
  requisitionId,
  defaultOrigin,
  tripEndDatetime,
  onCancel,
  onSubmitted,
}: {
  requisitionId: string
  defaultOrigin?: string
  tripEndDatetime?: string
  onCancel: () => void
  onSubmitted: () => void
}) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mastersQuery = useQuery({
    queryKey: ['trip-requisition-masters'],
    queryFn: fetchTripRequisitionMasterLists,
    staleTime: 60_000,
  })
  const [origin, setOrigin] = useState(() => displayValue(defaultOrigin))
  const [finalDestination, setFinalDestination] = useState('')
  const [journeyStart, setJourneyStart] = useState(() => nextDayDatetimeLocal(tripEndDatetime))
  const [journeyEnd, setJourneyEnd] = useState('')
  const [purposeOfJourney, setPurposeOfJourney] = useState('')
  const [justification, setJustification] = useState('')
  const [noteSheetFile, setNoteSheetFile] = useState<File | null>(null)
  const [officials, setOfficials] = useState<OfficialRow[]>([])

  const durationDays = useMemo(
    () => calculateTripDurationDays(journeyStart, journeyEnd),
    [journeyStart, journeyEnd],
  )
  const durationDisplay = useMemo(
    () => formatTripDurationDisplay(journeyStart, journeyEnd),
    [journeyStart, journeyEnd],
  )

  const extensionMutation = useMutation({
    mutationFn: () =>
      createSecretariatRequisitionExtension(requisitionId, {
        origin,
        finalDestination,
        journeyStartDatetime: toIsoDatetime(journeyStart),
        journeyEndDatetime: toIsoDatetime(journeyEnd),
        tripDurationDays: Number.parseInt(durationDays, 10),
        purposeOfJourney,
        tripDetailsJustification: justification,
        accompanyingOfficials: officials
          .filter((official) => official.cid.trim() && official.fullName.trim())
          .map((official) => ({ cid: official.cid.trim(), fullName: official.fullName.trim() })),
        noteSheetFile,
      }),
    onSuccess: async () => {
      showSuccessToast('Trip extension submitted.')
      await queryClient.invalidateQueries({ queryKey: ['secretariat-requisitions'] })
      onSubmitted()
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to submit trip extension.')
    },
  })

  const updateOfficial = (key: string, patch: Partial<OfficialRow>) => {
    setOfficials((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  const searchOfficial = async (key: string) => {
    const row = officials.find((item) => item.key === key)
    const cid = row?.cid.trim() ?? ''
    if (!cid) {
      showErrorToast('Enter a CID to search.')
      return
    }
    updateOfficial(key, { lookupLoading: true, fullName: '' })
    try {
      const user = await searchUserByCid(cid)
      if (!user) throw new Error('No user found for this CID.')
      updateOfficial(key, { cid: user.cid, fullName: user.fullName, lookupLoading: false })
    } catch (error) {
      updateOfficial(key, { lookupLoading: false, fullName: '' })
      showErrorToast(error, 'Failed to find user by CID.')
    }
  }

  const validate = (): string | null => {
    if (!origin.trim()) return 'Origin is required.'
    if (!finalDestination.trim()) return 'Final destination is required.'
    if (!journeyStart) return 'Journey start date and time is required.'
    if (!journeyEnd) return 'Journey end date and time is required.'
    if (new Date(journeyEnd).getTime() < new Date(journeyStart).getTime()) {
      return 'Journey end must be later than the journey start.'
    }
    if (!justification.trim()) return 'Trip details justification is required.'
    if (noteSheetFile && noteSheetFile.size > NOTE_SHEET_MAX_BYTES) {
      return 'Approval note sheet must be 5MB or smaller.'
    }
    if (officials.some((official) => official.lookupLoading)) {
      return 'Please wait for accompanying official lookup to finish.'
    }
    if (officials.some((official) => official.cid.trim() && !official.fullName.trim())) {
      return 'Search each accompanying official by CID before submitting.'
    }
    return null
  }

  const handleSubmit = () => {
    if (extensionMutation.isPending) return
    const message = validate()
    if (message) {
      showErrorToast(message)
      return
    }
    extensionMutation.mutate()
  }

  return (
    <>
      <Card className="border border-[var(--fms-strokes)] bg-white">
        <CardContent className="space-y-4 pt-5">
          <SectionHeader
            icon={Car}
            title="Trip Extension"
            subtitle="New journey details for this secretariat trip."
          />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>
                Origin <RequiredMark />
              </Label>
              <Input value={origin} onChange={(event) => setOrigin(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>
                Final Destination <RequiredMark />
              </Label>
              <Input
                value={finalDestination}
                onChange={(event) => setFinalDestination(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>
                Journey Start Date & Time <RequiredMark />
              </Label>
              <Input
                type="datetime-local"
                value={journeyStart}
                onChange={(event) => setJourneyStart(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>
                Journey End Date & Time <RequiredMark />
              </Label>
              <Input
                type="datetime-local"
                min={journeyStart || undefined}
                value={journeyEnd}
                onChange={(event) => setJourneyEnd(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Trip Duration (Days)</Label>
              <Input
                readOnly
                value={durationDisplay}
                placeholder="Auto-calculated"
                className="bg-[#f8f8f9]"
              />
            </div>
            <div className="space-y-2">
              <Label>Purpose of Journey</Label>
              <SearchableAutocomplete
                value={purposeOfJourney}
                onChange={setPurposeOfJourney}
                options={mastersQuery.data?.journeyPurposes ?? []}
                loading={mastersQuery.isLoading}
                placeholder="Select purpose"
                searchPlaceholder="Type to search…"
                emptyMessage="No purposes found."
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="secretariat-extension-justification">
              Trip details justification <RequiredMark />
            </Label>
            <textarea
              id="secretariat-extension-justification"
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
              rows={4}
              className="min-h-[96px] w-full rounded-lg border border-[var(--fms-strokes)] bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <div className="space-y-2">
            <Label>Approval Note sheet</Label>
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
                'flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm',
                noteSheetFile
                  ? 'border-[#bfdbfe] bg-[#eff6ff] text-[var(--fms-primary)]'
                  : 'border-dashed border-[var(--fms-strokes)] bg-[#fafafa] text-[var(--fms-text-subheading)]',
              )}
            >
              <CloudUpload className="h-4 w-4 shrink-0" />
              <span className="font-medium">
                {noteSheetFile ? noteSheetFile.name : 'Click to upload Approval Note sheet'}
              </span>
            </button>
            <p className="text-xs text-[var(--fms-text-subheading)]">
              Optional. PDF, DOC, DOCX, JPG or PNG (max 5MB)
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-[var(--fms-strokes)] bg-white">
        <CardContent className="space-y-4 pt-5">
          <SectionHeader
            icon={Users}
            title="Accompanying Officials"
            subtitle="Employees travelling on this extension."
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setOfficials((rows) => [
                    ...rows,
                    { key: `official-${Date.now()}-${rows.length}`, cid: '', fullName: '' },
                  ])
                }
              >
                <Plus className="mr-1 h-4 w-4" />
                Add another Official
              </Button>
            }
          />
          {officials.length === 0 ? (
            <p className="text-sm text-[var(--fms-text-subheading)]">
              No accompanying officials on this extension.
            </p>
          ) : (
            <div className="space-y-3">
              {officials.map((official) => (
                <div
                  key={official.key}
                  className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end"
                >
                  <div className="space-y-2">
                    <Label>CID</Label>
                    <div className="flex gap-2">
                      <Input
                        value={official.cid}
                        placeholder="Enter CID"
                        onChange={(event) =>
                          updateOfficial(official.key, { cid: event.target.value, fullName: '' })
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            void searchOfficial(official.key)
                          }
                        }}
                      />
                      <Button
                        type="button"
                        className="shrink-0 gap-1.5 bg-[var(--fms-info-text)] text-white hover:bg-[var(--fms-info-text)]/90"
                        disabled={official.lookupLoading || !official.cid.trim()}
                        onClick={() => void searchOfficial(official.key)}
                      >
                        <Search className="h-4 w-4" />
                        {official.lookupLoading ? 'Searching…' : 'Search'}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input
                      readOnly
                      value={official.lookupLoading ? 'Searching users…' : official.fullName}
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
                    onClick={() =>
                      setOfficials((rows) => rows.filter((row) => row.key !== official.key))
                    }
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
        <Button
          type="button"
          variant="outline"
          disabled={extensionMutation.isPending}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="button" disabled={extensionMutation.isPending} onClick={handleSubmit}>
          {extensionMutation.isPending ? 'Submitting…' : 'Submit Extension'}
        </Button>
      </div>
    </>
  )
}
