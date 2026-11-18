import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CloudUpload, Plus, RefreshCw, Search, Trash2, Users } from 'lucide-react'
import { useMemo, useRef, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatTripDurationDisplay } from '@/features/trips/lib/trip-form-utils'
import { createTripExtension, type TripDetail } from '@/features/trips/lib/trips-api'
import { searchUserByCid } from '@/features/user/lib/users-api'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'
import { cn } from '@/lib/utils'

const RETURN_DATE_MESSAGE =
  'Return date not passed. The current return date must be today or later.'
const NEW_LEG_MESSAGE =
  'Valid new leg. The extension must start today or later, and the new return date must be later than the current one.'
const NOTE_SHEET_MAX_BYTES = 10 * 1024 * 1024

type OfficialRow = {
  key: string
  cid: string
  fullName: string
  lookupLoading?: boolean
  cidLocked?: boolean
}

function calendarKeyFromParts(year: number, monthIndex: number, day: number): number {
  return Date.UTC(year, monthIndex, day)
}

function calendarKey(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed || trimmed === '—') return null
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return calendarKeyFromParts(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  }
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  return calendarKeyFromParts(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
}

function todayKey(): number {
  const now = new Date()
  return calendarKeyFromParts(now.getFullYear(), now.getMonth(), now.getDate())
}

function formatKey(key: number): string {
  const date = new Date(key)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toBhutanDatetime(date: string, time: '09:00:00' | '18:00:00'): string {
  return `${date}T${time}+06:00`
}

function displayValue(value: string): string {
  const trimmed = value.trim()
  return trimmed && trimmed !== '—' ? trimmed : ''
}

function initialOfficials(trip: TripDetail): OfficialRow[] {
  return trip.accompanyingOfficials
    .filter((official) => official.employeeCid.trim() && official.employeeCid !== '—')
    .map((official, index) => ({
      key: `existing-${official.employeeCid}-${index}`,
      cid: official.employeeCid,
      fullName: official.fullName === '—' ? '' : official.fullName,
      cidLocked: true,
    }))
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

function RequiredMark() {
  return <span className="text-[var(--fms-delete)]">*</span>
}

export function TripExtensionForm({
  trip,
  onCancel,
  onSubmitted,
}: {
  trip: TripDetail
  onCancel: () => void
  onSubmitted: () => void
}) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const currentReturnKey = calendarKey(trip.journeyEndDatetime ?? '')
  const today = todayKey()
  const returnDatePassed = currentReturnKey == null || currentReturnKey < today

  const [origin, setOrigin] = useState(
    () => displayValue(trip.destination) || displayValue(trip.origin),
  )
  const [finalDestination, setFinalDestination] = useState('')
  const [journeyDate, setJourneyDate] = useState(() => {
    if (currentReturnKey == null) return formatKey(today)
    const nextDay = currentReturnKey + 86_400_000
    return formatKey(nextDay < today ? today : nextDay)
  })
  const [returnDate, setReturnDate] = useState('')
  const [justification, setJustification] = useState('')
  const [noteSheetFile, setNoteSheetFile] = useState<File | null>(null)
  const [officials, setOfficials] = useState<OfficialRow[]>(() => initialOfficials(trip))

  const tripDurationDisplay = useMemo(() => {
    if (!journeyDate || !returnDate) return ''
    return formatTripDurationDisplay(
      toBhutanDatetime(journeyDate, '09:00:00'),
      toBhutanDatetime(returnDate, '18:00:00'),
    )
  }, [journeyDate, returnDate])

  const minJourneyDate = formatKey(today)
  const minReturnDate = formatKey(
    Math.max(today, currentReturnKey ?? today, calendarKey(journeyDate) ?? today) + 86_400_000,
  )

  const extensionMutation = useMutation({
    mutationFn: () =>
      createTripExtension(trip.id, {
        origin: origin.trim(),
        finalDestination: finalDestination.trim(),
        journeyStartDatetime: toBhutanDatetime(journeyDate, '09:00:00'),
        journeyEndDatetime: toBhutanDatetime(returnDate, '18:00:00'),
        tripDetailsJustification: justification.trim(),
        accompanyingOfficials: officials
          .filter((official) => official.cid.trim())
          .map((official) => ({ cid: official.cid.trim() })),
        noteSheetFile: noteSheetFile as File,
      }),
    onSuccess: async () => {
      showSuccessToast('Trip extension submitted.')
      await queryClient.invalidateQueries({ queryKey: ['trips'] })
      onSubmitted()
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to submit trip extension.')
    },
  })

  const updateOfficial = (key: string, patch: Partial<OfficialRow>) => {
    setOfficials((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  const searchOfficial = async (key: string) => {
    const row = officials.find((item) => item.key === key)
    const cid = row?.cid.trim() ?? ''
    if (!cid) {
      showErrorToast('Enter a CID to search.')
      return
    }
    updateOfficial(key, { lookupLoading: true, fullName: '', cidLocked: false })
    try {
      const user = await searchUserByCid(cid)
      if (!user) throw new Error('No user found for this CID.')
      updateOfficial(key, {
        cid: user.cid,
        fullName: user.fullName,
        lookupLoading: false,
        cidLocked: true,
      })
    } catch (error) {
      updateOfficial(key, { lookupLoading: false, fullName: '', cidLocked: false })
      showErrorToast(error, 'Failed to find user by CID.')
    }
  }

  const validate = (): string | null => {
    if (returnDatePassed) return RETURN_DATE_MESSAGE
    if (!origin.trim()) return 'Origin is required.'
    if (!finalDestination.trim()) return 'Final destination is required.'
    if (!journeyDate) return 'Date of journey is required.'
    if (!returnDate) return 'Date of return is required.'

    const startKey = calendarKey(journeyDate)
    const endKey = calendarKey(returnDate)
    if (
      startKey == null ||
      endKey == null ||
      startKey < today ||
      (currentReturnKey != null && endKey <= currentReturnKey) ||
      endKey <= startKey
    ) {
      return NEW_LEG_MESSAGE
    }
    if (!justification.trim()) return 'Trip details justification is required.'
    if (!noteSheetFile) return 'Approval Note sheet upload is required.'
    if (noteSheetFile.size > NOTE_SHEET_MAX_BYTES) {
      return 'Approval Note sheet must be 10MB or smaller.'
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
            icon={RefreshCw}
            title="Change Trip Details"
            subtitle="New journey details for this trip extension."
          />
          {returnDatePassed ? (
            <p className="text-sm text-[var(--fms-delete)]">{RETURN_DATE_MESSAGE}</p>
          ) : null}
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
                Date of Journey <RequiredMark />
              </Label>
              <Input
                type="date"
                min={minJourneyDate}
                value={journeyDate}
                onChange={(event) => setJourneyDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>
                Date of Return <RequiredMark />
              </Label>
              <Input
                type="date"
                min={minReturnDate}
                value={returnDate}
                onChange={(event) => setReturnDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Trip Duration</Label>
              <Input
                readOnly
                value={tripDurationDisplay}
                placeholder="Auto-calculated"
                className="bg-[#f8f8f9] text-[var(--fms-text-header)]"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="extension-justification">
              Trip details justification <RequiredMark />
            </Label>
            <textarea
              id="extension-justification"
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
              rows={4}
              className="min-h-[96px] w-full rounded-lg border border-[var(--fms-strokes)] bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <div className="space-y-2">
            <Label>
              Approval Note sheet <RequiredMark />
            </Label>
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
              PDF, DOC, DOCX, JPG or PNG (max 10MB)
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-[var(--fms-strokes)] bg-white">
        <CardContent className="space-y-4 pt-5">
          <SectionHeader
            icon={Users}
            title="Accompanying Officials"
            subtitle="Employees travelling with the applicant on this trip."
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setOfficials((prev) => [
                    ...prev,
                    { key: `official-${Date.now()}-${prev.length}`, cid: '', fullName: '' },
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
            <div className="overflow-hidden rounded-lg border border-[var(--fms-strokes)]">
              <table className="w-full text-sm">
                <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                  <tr>
                    <th className="w-16 px-4 py-3 text-left font-semibold">Sl.No</th>
                    <th className="px-4 py-3 text-left font-semibold">Employee CID</th>
                    <th className="px-4 py-3 text-left font-semibold">Full Name</th>
                    <th className="w-28 px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {officials.map((official, index) => (
                    <tr key={official.key} className="border-t border-[var(--fms-strokes)]">
                      <td className="px-4 py-3 tabular-nums text-[var(--fms-text-subheading)]">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3">
                        {official.cidLocked ? (
                          official.cid
                        ) : (
                          <div className="flex gap-2">
                            <Input
                              value={official.cid}
                              placeholder="Enter CID"
                              onChange={(event) =>
                                updateOfficial(official.key, {
                                  cid: event.target.value,
                                  fullName: '',
                                  cidLocked: false,
                                })
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
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {official.lookupLoading ? 'Searching users…' : official.fullName || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-[var(--fms-delete)]"
                          aria-label="Remove official"
                          onClick={() =>
                            setOfficials((prev) => prev.filter((row) => row.key !== official.key))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
        <Button
          type="button"
          disabled={extensionMutation.isPending || returnDatePassed}
          onClick={handleSubmit}
        >
          {extensionMutation.isPending ? 'Submitting…' : 'Submit Extension'}
        </Button>
      </div>
    </>
  )
}
