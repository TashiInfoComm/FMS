import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, X } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmergencyLocationMapPicker } from '@/features/emergency-vehicle/components/EmergencyLocationMapPicker'
import {
  buildCreateEmergencyIncidentPayload,
  createEmergencyIncident,
  fetchEmergencyAgencyOptions,
  fetchEmergencyVehicleTypeOptions,
} from '@/features/emergency-vehicle/lib/emergency-incidents-api'
import {
  createEmptyEmergencyIncidentForm,
  createEmptyEmergencyIncidentRow,
  formatLatLongDisplay,
  parseLatLongDisplay,
  type EmergencyIncidentFormValues,
  type EmergencyIncidentRow,
} from '@/features/emergency-vehicle/lib/emergency-broadcast-types'
import { cn } from '@/lib/utils'
import { BackToListButton } from '@/shared/components/BackToListButton'
import { PageHeader } from '@/shared/components/PageHeader'
import { SearchableMultiAutocomplete } from '@/shared/components/SearchableMultiAutocomplete'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

function RequiredMark() {
  return <span className="text-[var(--fms-delete)]"> *</span>
}

function SelectedChips({
  values,
  options,
  onRemove,
}: {
  values: string[]
  options: Array<{ value: string; label: string }>
  onRemove: (value: string) => void
}) {
  if (values.length === 0) return null
  return (
    <div className="max-h-24 overflow-x-auto overflow-y-auto overscroll-contain rounded-md border border-[var(--fms-strokes)] p-2">
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => {
          const label = options.find((option) => option.value === value)?.label ?? value
          return (
            <Badge key={value} variant="secondary" className="gap-1 pr-1 font-normal">
              {label}
              <button
                type="button"
                className="rounded-sm p-0.5 hover:bg-black/10"
                aria-label={`Remove ${label}`}
                onClick={() => onRemove(value)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )
        })}
      </div>
    </div>
  )
}

function CreateEmergencyBroadcast() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<EmergencyIncidentFormValues>(createEmptyEmergencyIncidentForm)
  /** Local text for the combined lat/long inputs (keyed by incident row). */
  const [latLongDrafts, setLatLongDrafts] = useState<Record<string, string>>({})

  const agenciesQuery = useQuery({
    queryKey: ['emergency', 'agencies'],
    queryFn: fetchEmergencyAgencyOptions,
    staleTime: 60_000,
  })

  const vehicleTypesQuery = useQuery({
    queryKey: ['emergency', 'vehicle-types'],
    queryFn: fetchEmergencyVehicleTypeOptions,
    staleTime: 60_000,
  })

  const agencyOptions = useMemo(
    () =>
      (agenciesQuery.data ?? []).map((option) => ({
        value: option.value,
        label: option.label,
        searchText: option.searchText,
      })),
    [agenciesQuery.data],
  )

  const vehicleTypeOptions = useMemo(
    () =>
      (vehicleTypesQuery.data ?? []).map((option) => ({
        value: option.value,
        label: option.label,
        searchText: option.searchText,
      })),
    [vehicleTypesQuery.data],
  )

  const createMutation = useMutation({
    mutationFn: createEmergencyIncident,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['emergency', 'incidents'] })
      showSuccessToast(
        form.broadcastImmediately
          ? 'Emergency incident broadcasted'
          : 'Emergency incident created',
      )
      navigate('/emergency/broadcast')
    },
    onError: (error) => {
      showErrorToast(error, 'Could not create emergency incident')
    },
  })

  const updateIncident = (
    key: string,
    patch: Partial<Omit<EmergencyIncidentRow, 'key'>>,
  ) => {
    setForm((prev) => ({
      ...prev,
      incidents: prev.incidents.map((incident) =>
        incident.key === key ? { ...incident, ...patch } : incident,
      ),
    }))
  }

  const addIncident = () => {
    const next = createEmptyEmergencyIncidentRow()
    setForm((prev) => ({
      ...prev,
      incidents: [...prev.incidents, next],
    }))
  }

  const removeIncident = (key: string) => {
    setForm((prev) => ({
      ...prev,
      incidents:
        prev.incidents.length <= 1
          ? prev.incidents
          : prev.incidents.filter((incident) => incident.key !== key),
    }))
    setLatLongDrafts((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const latLongValue = (incident: EmergencyIncidentRow) => {
    if (Object.prototype.hasOwnProperty.call(latLongDrafts, incident.key)) {
      return latLongDrafts[incident.key]
    }
    return formatLatLongDisplay(incident.latitude, incident.longitude)
  }

  const handleLatLongChange = (key: string, value: string) => {
    setLatLongDrafts((prev) => ({ ...prev, [key]: value }))
    const parsed = parseLatLongDisplay(value)
    if (parsed) {
      updateIncident(key, {
        latitude: parsed.latitude,
        longitude: parsed.longitude,
      })
      return
    }
    if (!value.trim()) {
      updateIncident(key, { latitude: null, longitude: null })
    }
  }

  const handleLatLongBlur = (incident: EmergencyIncidentRow) => {
    const draft = latLongDrafts[incident.key]
    if (draft === undefined) return
    const parsed = parseLatLongDisplay(draft)
    if (parsed) {
      updateIncident(incident.key, {
        latitude: parsed.latitude,
        longitude: parsed.longitude,
      })
      setLatLongDrafts((prev) => {
        const next = { ...prev }
        delete next[incident.key]
        return next
      })
      return
    }
    if (!draft.trim()) {
      updateIncident(incident.key, { latitude: null, longitude: null })
      setLatLongDrafts((prev) => {
        const next = { ...prev }
        delete next[incident.key]
        return next
      })
      return
    }
    showErrorToast('Enter coordinates as latitude, longitude (e.g. 27.47160, 89.63860).')
  }

  const validateIncidents = (): string | null => {
    for (let index = 0; index < form.incidents.length; index += 1) {
      const incident = form.incidents[index]
      const label = `Incident ${index + 1}`
      if (incident.agencyIds.length === 0) {
        return `${label}: select at least one agency.`
      }
      if (incident.vehicleTypeIds.length === 0) {
        return `${label}: select at least one vehicle type.`
      }
      if (!incident.location.trim()) {
        return `${label}: enter a location.`
      }
      if (incident.latitude == null || incident.longitude == null) {
        return `${label}: enter or select latitude and longitude.`
      }
      if (!incident.startDatetime.trim()) {
        return `${label}: enter a start date and time.`
      }
      if (incident.endDatetime.trim()) {
        const start = new Date(incident.startDatetime)
        const end = new Date(incident.endDatetime)
        if (
          !Number.isNaN(start.getTime()) &&
          !Number.isNaN(end.getTime()) &&
          end.getTime() < start.getTime()
        ) {
          return `${label}: end date and time must be after the start.`
        }
      }
      if (!incident.description.trim()) {
        return `${label}: write an incident description.`
      }
    }
    return null
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const validationError = validateIncidents()
    if (validationError) {
      showErrorToast(validationError)
      return
    }

    try {
      const payload = buildCreateEmergencyIncidentPayload(form)
      createMutation.mutate(payload)
    } catch (error) {
      showErrorToast(error, 'Could not prepare emergency incident')
    }
  }

  return (
    <section className="space-y-5">
      <BackToListButton to="/emergency/broadcast" />
      <PageHeader
        title="Emergency Assistance Request"
        subtitle="Create one or more incident requirements to broadcast."
      />

      <Card className="min-w-0 overflow-visible rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="min-w-0 p-0">
          <form onSubmit={handleSubmit} className="space-y-5">
            {form.incidents.map((incident, index) => (
              <div
                key={incident.key}
                className={cn(
                  'space-y-4 rounded-xl border border-[var(--fms-strokes)] p-4',
                  index > 0 && 'bg-[#fafafa]',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--fms-text-header)]">
                    Emergency Assistance Request {index + 1}
                  </p>
                  {form.incidents.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-[var(--fms-error-text)]"
                      onClick={() => removeIncident(incident.key)}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Remove
                    </Button>
                  ) : null}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-[var(--fms-text-header)]">
                      Agency
                      <RequiredMark />
                    </Label>
                    <SearchableMultiAutocomplete
                      id={`emergency-agency-${incident.key}`}
                      value={incident.agencyIds}
                      onChange={(agencyIds) => updateIncident(incident.key, { agencyIds })}
                      options={agencyOptions}
                      loading={agenciesQuery.isLoading}
                      disabled={agenciesQuery.isError}
                      placeholder="Select agencies"
                      searchPlaceholder="Type to search agencies…"
                      emptyMessage="No agencies found."
                      loadingMessage="Loading agencies…"
                    />
                    <SelectedChips
                      values={incident.agencyIds}
                      options={agencyOptions}
                      onRemove={(agencyId) =>
                        updateIncident(incident.key, {
                          agencyIds: incident.agencyIds.filter((id) => id !== agencyId),
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-[var(--fms-text-header)]">
                      Vehicle Type Required
                      <RequiredMark />
                    </Label>
                    <SearchableMultiAutocomplete
                      id={`emergency-vehicle-types-${incident.key}`}
                      value={incident.vehicleTypeIds}
                      onChange={(vehicleTypeIds) =>
                        updateIncident(incident.key, { vehicleTypeIds })
                      }
                      options={vehicleTypeOptions}
                      loading={vehicleTypesQuery.isLoading}
                      disabled={vehicleTypesQuery.isError}
                      placeholder="Select vehicle types"
                      searchPlaceholder="Type to search vehicle types…"
                      emptyMessage="No vehicle types found."
                      loadingMessage="Loading vehicle types…"
                    />
                    <SelectedChips
                      values={incident.vehicleTypeIds}
                      options={vehicleTypeOptions}
                      onRemove={(vehicleTypeId) =>
                        updateIncident(incident.key, {
                          vehicleTypeIds: incident.vehicleTypeIds.filter(
                            (id) => id !== vehicleTypeId,
                          ),
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-[var(--fms-text-header)]">
                      Location
                      <RequiredMark />
                    </Label>
                    <Input
                      value={incident.location}
                      onChange={(event) =>
                        updateIncident(incident.key, { location: event.target.value })
                      }
                      placeholder="Enter location"
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-[var(--fms-text-header)]">
                      Latitude, Longitude
                      <RequiredMark />
                    </Label>
                    <Input
                      value={latLongValue(incident)}
                      onChange={(event) =>
                        handleLatLongChange(incident.key, event.target.value)
                      }
                      disabled={true}
                      onBlur={() => handleLatLongBlur(incident)}
                      placeholder="mark the location on the map"
                      className="h-9"
                    />

                  </div>

                  <div className="sm:col-span-2">
                    <EmergencyLocationMapPicker
                      address={incident.location}
                      latitude={incident.latitude}
                      longitude={incident.longitude}
                      syncAddress={false}
                      onChange={({ latitude, longitude }) => {
                        updateIncident(incident.key, { latitude, longitude })
                        setLatLongDrafts((prev) => {
                          const next = { ...prev }
                          delete next[incident.key]
                          return next
                        })
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-[var(--fms-text-header)]">
                      Start Date and Time
                      <RequiredMark />
                    </Label>
                    <Input
                      type="datetime-local"
                      value={incident.startDatetime}
                      onChange={(event) =>
                        updateIncident(incident.key, { startDatetime: event.target.value })
                      }
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-[var(--fms-text-header)]">
                      End Date and Time
                    </Label>
                    <Input
                      type="datetime-local"
                      value={incident.endDatetime}
                      onChange={(event) =>
                        updateIncident(incident.key, { endDatetime: event.target.value })
                      }
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-sm font-medium text-[var(--fms-text-header)]">
                      Incident Description
                      <RequiredMark />
                    </Label>
                    <textarea
                      value={incident.description}
                      onChange={(event) =>
                        updateIncident(incident.key, { description: event.target.value })
                      }
                      placeholder="Write Incident Description"
                      rows={3}
                      className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                  </div>
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" onClick={addIncident}>
              <Plus className="mr-1 h-4 w-4" />
              Add another emergency assistance
            </Button>

            {(agenciesQuery.isError || vehicleTypesQuery.isError) && (
              <p className="text-xs text-[var(--fms-delete)]">
                {agenciesQuery.isError ? 'Failed to load agencies. ' : ''}
                {vehicleTypesQuery.isError ? 'Failed to load vehicle types.' : ''}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 border-t border-[var(--fms-strokes)] pt-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={createMutation.isPending}
                onClick={() => navigate('/emergency/broadcast')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-[var(--fms-button)] text-white hover:bg-[var(--fms-button-hover)]"
              >
                {createMutation.isPending ? 'Submitting…' : 'Broadcast'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  )
}

export default CreateEmergencyBroadcast
