// Routes: `/vehicle/add` (POST `/vehicles`), `/vehicle/list/:vehicleId/edit` (PUT `/vehicles/{vehicle_id}`).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableAutocomplete } from '@/shared/components/SearchableAutocomplete'
import { Skeleton } from '@/components/ui/skeleton'
import { MasterDataSelect } from '@/features/vehicles/components/MasterDataSelect'
import {
  fetchVehicleCreateMasterLists,
  fetchVehicleTypesByCategoryCode,
  resolveVehicleCategoryCode,
  type VehicleCreateMasterLists,
} from '@/features/vehicles/lib/vehicle-create-master-data'
import {
  createVehicle,
  emptyVehicleFormState,
  fetchVehicleById,
  fetchVehicleInfoFromGims,
  mapGimsVehicleInfoToFormState,
  resolveAssetNameQueryParam,
  updateVehicle,
  vehicleFormStateToPayload,
  vehicleRecordToFormState,
  type VehicleFormStringState,
} from '@/features/vehicles/lib/vehicles-api'
import {
  getVehicleFormFieldErrors,
  isVehicleFormValid,
  VEHICLE_FORM_FIELD_KEYS,
  type VehicleFormFieldKey,
} from '@/features/vehicles/lib/vehicle-form-schema'
import { PageHeader } from '@/shared/components/PageHeader'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

const MASTER_OPTIONS_KEY: Record<string, keyof VehicleCreateMasterLists> = {
  vehicle_category_id: 'vehicleCategories',
  fuel_type_id: 'fuelTypes',
  insurance_provider_id: 'insuranceProviders',
  status_id: 'vehicleStatuses',
  movement_status_id: 'vehicleMovementStatuses',
  asset_name_id: 'vehicleAssetNames',
}

const GIMS_FETCHED_FIELDS = new Set<keyof VehicleFormStringState>([
  'chassis_number',
  'engine_number',
  'make',
  'model',
  'year',
  'color',
  'cost',
  'identification_code',
])

function isMasterSelectField(fieldKey: string): fieldKey is keyof typeof MASTER_OPTIONS_KEY {
  return fieldKey in MASTER_OPTIONS_KEY
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs font-normal text-[var(--fms-error-text)]">{message}</p>
}

function requiredLabel(label: string) {
  return (
    <>
      {label}
      <span className="text-[var(--fms-delete)]"> *</span>
    </>
  )
}

type FieldDef = {
  key: VehicleFormFieldKey
  label: string
  placeholder: string
  type?: 'text' | 'number' | 'date'
  step?: string
  optional?: boolean
}

const VEHICLE_FORM_SECTIONS: {
  section: string;
  subtitle: string;
  fields: FieldDef[];
}[] = [
  {
    section: "Vehicle information",
    subtitle:
      "Identification, classification, and technical details sent to the vehicles API.",
    fields: [
      {
        key: "registration_number",
        label: "Registration number",
        placeholder: "e.g. BP-11-1250",
      },
      {
        key: "asset_name_id",
        label: "Asset name",
        placeholder: "Select asset name",
      },
      {
        key: "chassis_number",
        label: "Chassis number",
        placeholder: "Chassis number",
      },
      {
        key: "engine_number",
        label: "Engine number",
        placeholder: "Engine number",
      },
      { key: "make", label: "Make", placeholder: "e.g. Maruti" },
      { key: "model", label: "Model", placeholder: "e.g. Land Cruiser" },
      { key: "year", label: "Year", placeholder: "e.g. 2026", type: "number" },
      { key: "color", label: "Color", placeholder: "e.g. Grey" },
      {
        key: "cost",
        label: "Cost",
        placeholder: "0.00",
        type: "number",
        step: "0.01",
      },
      {
        key: "identification_code",
        label: "Identification code",
        placeholder: "e.g. v1.gt.gstts",
      },
      {
        key: "vehicle_category_id",
        label: "Vehicle category",
        placeholder: "Select category",
      },
      {
        key: "vehicle_type_id",
        label: "Vehicle type",
        placeholder: "Select vehicle type",
      },
      {
        key: "fuel_type_id",
        label: "Fuel type",
        placeholder: "Select fuel type",
      },
      {
        key: "fuel_quota_balance",
        label: "Fuel quota balance",
        placeholder: "e.g. 500",
        type: "number",
        step: "0.01",
        optional: true,
      },
      {
        key: "status_id",
        label: "Vehicle Status",
        placeholder: "Select vehicle status",
      },
      {
        key: "movement_status_id",
        label: "Vehicle Movement Status",
        placeholder: "Select vehicle movement status",
      },
      {
        key: "engine_capacity_cc",
        label: "Engine capacity (cc)",
        placeholder: "e.g. 4500",
        type: "number",
      },
      {
        key: "seating_capacity",
        label: "Seating capacity",
        placeholder: "e.g. 7",
        type: "number",
      },
      {
        key: "registration_date",
        label: "Registration date",
        placeholder: "",
        type: "date",
      },
      {
        key: "registration_expiry",
        label: "Registration expiry",
        placeholder: "",
        type: "date",
      },
      {
        key: "insurance_provider_id",
        label: "Insurance Provider",
        placeholder: "Select Insurance Provider",
      },
      {
        key: "insurance_expiry",
        label: "Insurance expiry",
        placeholder: "",
        type: "date",
      },
      {
        key: "gps_device_imei",
        label: "GPS device IMEI",
        placeholder: "IMEI",
        optional: true,
      },
    ],
  },
];

function VehicleFormSkeleton() {
  return (
    <div className="space-y-5 rounded-xl border border-[var(--fms-strokes)] bg-white p-4">
      <Card className="border border-[var(--fms-strokes)] bg-white">
        <CardContent className="space-y-4 pt-5">
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-full max-w-md" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={`sk-${i}`} className="space-y-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function VehicleFormPage() {
  const { vehicleId } = useParams<{ vehicleId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const crud = useRouteCrudPermissions('/vehicle/list')
  const isEdit = Boolean(vehicleId?.trim())

  const [form, setForm] = useState<VehicleFormStringState>(() => emptyVehicleFormState())
  const [touched, setTouched] = useState<Partial<Record<VehicleFormFieldKey, boolean>>>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const hydratedFromServer = useRef(false)

  useEffect(() => {
    hydratedFromServer.current = false
    setForm(emptyVehicleFormState())
    setTouched({})
    setSubmitAttempted(false)
  }, [vehicleId])

  const fieldErrors = useMemo(() => getVehicleFormFieldErrors(form), [form])

  const visibleFieldErrors = useMemo(() => {
    if (submitAttempted) return fieldErrors
    const visible: Partial<Record<VehicleFormFieldKey, string>> = {}
    for (const key of VEHICLE_FORM_FIELD_KEYS) {
      if (touched[key] && fieldErrors[key]) visible[key] = fieldErrors[key]
    }
    return visible
  }, [fieldErrors, submitAttempted, touched])

  const touchField = (key: VehicleFormFieldKey) => {
    setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }))
  }

  const touchAllFields = () => {
    setTouched(Object.fromEntries(VEHICLE_FORM_FIELD_KEYS.map((key) => [key, true])))
  }

  const fieldError = (key: VehicleFormFieldKey) => visibleFieldErrors[key]

  const mastersQuery = useQuery({
    queryKey: ['vehicle-create', 'master-lists'],
    queryFn: fetchVehicleCreateMasterLists,
    staleTime: 60_000,
  })

  const selectedCategoryCode = useMemo(() => {
    const categories = mastersQuery.data?.vehicleCategories ?? []
    return resolveVehicleCategoryCode(form.vehicle_category_id, categories)
  }, [form.vehicle_category_id, mastersQuery.data?.vehicleCategories])

  const vehicleTypesQuery = useQuery({
    queryKey: ['vehicle-create', 'vehicle-types-by-category', selectedCategoryCode],
    queryFn: () => fetchVehicleTypesByCategoryCode(selectedCategoryCode),
    enabled: Boolean(selectedCategoryCode),
    staleTime: 60_000,
  })

  const vehicleQuery = useQuery({
    queryKey: ['vehicles', 'detail', vehicleId, 'edit-form'],
    queryFn: async () => {
      if (!vehicleId?.trim()) throw new Error('Missing vehicle id')
      return fetchVehicleById(vehicleId)
    },
    enabled: isEdit && crud.isResolved && crud.canRead,
    staleTime: 30_000,
  })

  useEffect(() => {
    const record = vehicleQuery.data
    if (!isEdit || !record || hydratedFromServer.current) return
    hydratedFromServer.current = true
    setForm(vehicleRecordToFormState(record))
  }, [isEdit, vehicleQuery.data])

  const gimsSearchMutation = useMutation({
    mutationFn: async () => {
      const masters = mastersQuery.data
      if (!masters) throw new Error('Master data is still loading.')
      const asset_name = resolveAssetNameQueryParam(
        form.asset_name_id,
        masters.vehicleAssetNames,
      )
      const payload = await fetchVehicleInfoFromGims({
        asset_name,
        vehicle_number: form.registration_number,
      })
      return mapGimsVehicleInfoToFormState(payload, masters)
    },
    onSuccess: (patch) => {
      setForm((prev) => ({
        ...patch,
        asset_name_id: prev.asset_name_id,
        registration_number: prev.registration_number,
      }))
      showSuccessToast('Vehicle details loaded from GIMS')
    },
    onError: (err) => {
      showErrorToast(err, 'GIMS search failed')
    },
  })

  const onGimsSearch = () => {
    if (!form.asset_name_id.trim()) {
      showErrorToast('Select an asset name before searching.')
      return
    }
    if (!form.registration_number.trim()) {
      showErrorToast('Enter a registration number before searching.')
      return
    }
    gimsSearchMutation.mutate()
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = vehicleFormStateToPayload(form)
      if (isEdit) {
        if (!vehicleId?.trim()) throw new Error('Missing vehicle id')
        return updateVehicle(vehicleId, body)
      }
      return createVehicle(body)
    },
    onSuccess: async () => {
      showSuccessToast(isEdit ? 'Vehicle updated' : 'Vehicle created')
      await queryClient.invalidateQueries({ queryKey: ['vehicles', 'list'] })
      if (isEdit && vehicleId?.trim()) {
        await queryClient.invalidateQueries({ queryKey: ['vehicles', 'detail', vehicleId] })
      }
      if (isEdit && vehicleId?.trim()) {
        navigate(`/vehicle/list/${encodeURIComponent(vehicleId)}`)
      } else {
        navigate('/vehicle/list')
      }
    },
    onError: (err) => {
      showErrorToast(err, 'Save failed')
    },
  })

  const canSubmit = isEdit ? crud.canUpdate : crud.canCreate
  const pageTitle = isEdit ? 'Edit vehicle' : 'Add new vehicle'
  const pageSubtitle = isEdit
    ? 'Update vehicle details. '
    : 'Enter vehicle details.'

  const onSave = () => {
    if (!canSubmit) return
    setSubmitAttempted(true)
    touchAllFields()
    if (!isVehicleFormValid(form)) return
    saveMutation.mutate()
  }

  if (crud.isLoading || !crud.isResolved) {
    return (
      <section className="space-y-5">
        <PageHeader title={pageTitle} subtitle="Loading permissions…" />
        <VehicleFormSkeleton />
      </section>
    )
  }

  if (!isEdit && crud.isResolved && !crud.canCreate) {
    return (
      <section className="space-y-5">
        <PageHeader title={pageTitle} subtitle={pageSubtitle} />
        <p className="text-sm text-[var(--fms-text-subheading)]">You do not have permission to create vehicles.</p>
      </section>
    )
  }

  if (isEdit && crud.isResolved && !crud.canRead) {
    return (
      <section className="space-y-5">
        <PageHeader title={pageTitle} subtitle={pageSubtitle} />
        <p className="text-sm text-[var(--fms-text-subheading)]">You do not have permission to view this vehicle.</p>
        <Button variant="outline" asChild>
          <Link to="/vehicle/list">Back to list</Link>
        </Button>
      </section>
    )
  }

  if (isEdit && crud.isResolved && crud.canRead && !crud.canUpdate) {
    return (
      <section className="space-y-5">
        <PageHeader title={pageTitle} subtitle={pageSubtitle} />
        <p className="text-sm text-[var(--fms-text-subheading)]">You do not have permission to edit vehicles.</p>
        <Button variant="outline" asChild>
          <Link to={vehicleId ? `/vehicle/list/${encodeURIComponent(vehicleId)}` : '/vehicle/list'}>
            Back to detail
          </Link>
        </Button>
      </section>
    )
  }

  const showFormLoading = isEdit && vehicleQuery.isLoading

  return (
    <section className="space-y-5">
      <PageHeader title={pageTitle} subtitle={pageSubtitle} />

      {showFormLoading ? (
        <VehicleFormSkeleton />
      ) : isEdit && vehicleQuery.isError ? (
        <p className="text-sm text-[var(--fms-error-text)]">
          {vehicleQuery.error instanceof Error ? vehicleQuery.error.message : 'Could not load vehicle.'}
        </p>
      ) : (
        <div className="space-y-5 rounded-xl border border-[var(--fms-strokes)] bg-white p-4">
          {VEHICLE_FORM_SECTIONS.map((group) => (
            <Card key={group.section} className="border border-[var(--fms-strokes)] bg-white">
              <CardContent className="space-y-4 pt-5">
                <div>
                  <p className="text-base font-semibold text-[var(--fms-text-header)]">{group.section}</p>
                  <p className="text-xs text-[var(--fms-text-subheading)]">{group.subtitle}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {group.fields
                    .filter(
                      (field) => isEdit || field.key !== 'fuel_quota_balance',
                    )
                    .map((field) =>
                    field.key === 'asset_name_id' && !isEdit ? (
                      <div key={field.key} className="space-y-2">
                        <Label htmlFor={field.key}>{requiredLabel(field.label)}</Label>
                        <div className="flex gap-2">
                          <SearchableAutocomplete
                            id={field.key}
                            className="min-w-0 flex-1"
                            value={form.asset_name_id}
                            onChange={(next) => {
                              setForm((prev) => ({ ...prev, asset_name_id: next }))
                              touchField('asset_name_id')
                            }}
                            options={mastersQuery.data?.vehicleAssetNames ?? []}
                            loading={mastersQuery.isLoading}
                            placeholder={field.placeholder}
                            searchPlaceholder="Type to search asset names…"
                            error={Boolean(fieldError('asset_name_id'))}
                          />
                          <Button
                            type="button"
                            className="shrink-0 gap-1.5 bg-[var(--fms-button)] text-white hover:bg-[var(--fms-button-hover)]"
                            onClick={onGimsSearch}
                            disabled={
                              gimsSearchMutation.isPending ||
                              mastersQuery.isLoading ||
                              !form.asset_name_id.trim() ||
                              !form.registration_number.trim()
                            }
                            title="Search GIMS using asset name and registration number"
                          >
                            {gimsSearchMutation.isPending ? (
                              <Spinner className="size-4" />
                            ) : (
                              <Search className="size-4" aria-hidden />
                            )}
                            Search
                          </Button>
                        </div>
                        <FieldError message={fieldError('asset_name_id')} />
                        <p className="text-xs text-[var(--fms-text-subheading)]">
                          Loads vehicle details from GIMS using the selected asset name and
                          registration number.
                        </p>
                      </div>
                    ) : field.key === 'vehicle_type_id' ? (
                      <MasterDataSelect
                        key={field.key}
                        id={field.key}
                        label={requiredLabel(field.label)}
                        placeholder={
                          !form.vehicle_category_id.trim()
                            ? 'Select a vehicle category first'
                            : field.placeholder
                        }
                        options={vehicleTypesQuery.data ?? []}
                        value={form.vehicle_type_id}
                        loading={vehicleTypesQuery.isLoading}
                        disabled={!form.vehicle_category_id.trim()}
                        error={Boolean(fieldError('vehicle_type_id'))}
                        errorMessage={fieldError('vehicle_type_id')}
                        onValueChange={(next) => {
                          setForm((prev) => ({ ...prev, vehicle_type_id: next }))
                          touchField('vehicle_type_id')
                        }}
                      />
                    ) : isMasterSelectField(field.key) ? (
                      <MasterDataSelect
                        key={field.key}
                        id={field.key}
                        label={requiredLabel(field.label)}
                        placeholder={field.placeholder}
                        options={mastersQuery.data ? mastersQuery.data[MASTER_OPTIONS_KEY[field.key]] ?? [] : []}
                        value={form[field.key]}
                        loading={mastersQuery.isLoading}
                        disabled={!isEdit && GIMS_FETCHED_FIELDS.has(field.key)}
                        error={Boolean(fieldError(field.key))}
                        errorMessage={fieldError(field.key)}
                        onValueChange={(next) => {
                          setForm((prev) => {
                            const patch: Partial<VehicleFormStringState> = { [field.key]: next }
                            if (field.key === 'vehicle_category_id') {
                              patch.vehicle_type_id = ''
                            }
                            return { ...prev, ...patch }
                          })
                          touchField(field.key)
                          if (field.key === 'vehicle_category_id') {
                            setTouched((prev) => ({ ...prev, vehicle_type_id: false }))
                          }
                        }}
                      />
                    ) : (
                      <div key={field.key} className="space-y-2">
                        <Label htmlFor={field.key}>
                          {field.optional ? field.label : requiredLabel(field.label)}
                        </Label>
                        <Input
                          id={field.key}
                          type={field.type ?? 'text'}
                          step={field.step}
                          value={form[field.key]}
                          onChange={(event) =>
                            setForm((prev) => ({ ...prev, [field.key]: event.target.value }))
                          }
                          onBlur={() => touchField(field.key)}
                          placeholder={field.placeholder}
                          disabled={!isEdit && GIMS_FETCHED_FIELDS.has(field.key)}
                          aria-invalid={fieldError(field.key) ? true : undefined}
                        />
                        <FieldError message={fieldError(field.key)} />
                      </div>
                    ),
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="destructive" asChild>
              <Link to="/vehicle/list">Close</Link>
            </Button>
            <Button type="button" onClick={onSave} disabled={!canSubmit || saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Save vehicle'}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

