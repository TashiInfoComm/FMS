import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CloudUpload, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  fetchMaintenanceTypes,
  fetchProblemCategoriesByMaintenanceTypeId,
  type MaintenanceMasterOption,
} from '@/features/maintenance/lib/maintenance-masters-api'
import {
  fetchDriverAssignedVehicles,
  submitWorkOrder,
} from '@/features/maintenance/lib/work-orders-api'
import type { ApiRecord } from '@/features/user/lib/roles-api'
import { mapUserDetailFields } from '@/features/user/lib/users-api'
import { useUserStore } from '@/services/user-store'
import { SearchableAutocomplete } from '@/shared/components/SearchableAutocomplete'
import { PageHeader } from '@/shared/components/PageHeader'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'
import { cn } from '@/lib/utils'

type MaintenanceItemDraft = {
  key: string
  problemCategory: string
  problemDescription: string
  proofFile: File | null
}

function RequiredMark() {
  return <span className="text-[var(--fms-delete)]">*</span>
}

function emptyItem(): MaintenanceItemDraft {
  return {
    key: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    problemCategory: '',
    problemDescription: '',
    proofFile: null,
  }
}

function MaintenanceItemCard({
  item,
  index,
  canRemove,
  problemCategoryOptions,
  problemCategoriesLoading,
  maintenanceTypeSelected,
  onChange,
  onRemove,
}: {
  item: MaintenanceItemDraft
  index: number
  canRemove: boolean
  problemCategoryOptions: MaintenanceMasterOption[]
  problemCategoriesLoading: boolean
  maintenanceTypeSelected: boolean
  onChange: (next: MaintenanceItemDraft) => void
  onRemove: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <Card className="border border-[var(--fms-strokes)] bg-[#fafafa] shadow-none">
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--fms-text-header)]">
            Maintenance item {index + 1}
          </p>
          {canRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-[var(--fms-delete)]"
              onClick={onRemove}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Remove
            </Button>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label>
            Problem Category <RequiredMark />
          </Label>
          <select
            value={item.problemCategory}
            onChange={(event) =>
              onChange({ ...item, problemCategory: event.target.value })
            }
            disabled={
              !maintenanceTypeSelected ||
              problemCategoriesLoading ||
              problemCategoryOptions.length === 0
            }
            className="flex h-8 w-full rounded-lg border border-[var(--fms-strokes)] bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">
              {!maintenanceTypeSelected
                ? 'Select maintenance type first'
                : problemCategoriesLoading
                  ? 'Loading categories…'
                  : problemCategoryOptions.length === 0
                    ? 'No categories available'
                    : 'Select category'}
            </option>
            {problemCategoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Problem Description</Label>
            <textarea
              value={item.problemDescription}
              onChange={(event) =>
                onChange({ ...item, problemDescription: event.target.value })
              }
              placeholder="Write description"
              className="h-20 w-full resize-none rounded-lg border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm align-top outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          <div className="space-y-2">
            <Label>Upload Proof</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null
                onChange({ ...item, proofFile: file })
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'flex h-20 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--fms-strokes)] bg-white px-3 text-center text-sm transition-colors hover:bg-[#f3f4f6]',
                item.proofFile && 'border-[var(--fms-primary)] bg-[#f8fbff]',
              )}
            >
              <CloudUpload className="h-4 w-4 shrink-0 text-[var(--fms-text-subheading)]" />
              <span className="truncate font-medium text-[var(--fms-text-header)]">
                {item.proofFile
                  ? item.proofFile.name
                  : 'Click to upload'}
              </span>
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function CreateWorkOrder() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useUserStore((state) => state.user)
  const [maintenanceTypeId, setMaintenanceTypeId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [items, setItems] = useState<MaintenanceItemDraft[]>([emptyItem()])

  const profileRecord = useMemo((): ApiRecord | null => {
    if (user && typeof user === 'object' && !Array.isArray(user)) {
      return user as ApiRecord
    }
    return null
  }, [user])

  const profile = useMemo(
    () => (profileRecord ? mapUserDetailFields(profileRecord) : null),
    [profileRecord],
  )

  const driverId = useMemo(() => {
    if (profile?.id && profile.id !== '-') return profile.id
    if (profileRecord) {
      const rawId = profileRecord.id ?? profileRecord.user_id ?? profileRecord.uuid
      if (typeof rawId === 'string' && rawId.trim()) return rawId.trim()
    }
    return ''
  }, [profile?.id, profileRecord])

  const vehiclesQuery = useQuery({
    queryKey: ['maintenance', 'driver-vehicles', driverId],
    queryFn: () => fetchDriverAssignedVehicles(driverId),
    enabled: Boolean(driverId),
    staleTime: 60_000,
  })

  const maintenanceTypesQuery = useQuery({
    queryKey: ['maintenance', 'maintenance-types'],
    queryFn: fetchMaintenanceTypes,
    staleTime: 60_000,
  })

  const maintenanceTypes = maintenanceTypesQuery.data ?? []

  const problemCategoriesQuery = useQuery({
    queryKey: ['maintenance', 'problem-categories', maintenanceTypeId],
    queryFn: () =>
      fetchProblemCategoriesByMaintenanceTypeId(maintenanceTypeId, maintenanceTypes),
    enabled: Boolean(maintenanceTypeId) && maintenanceTypes.length > 0,
    staleTime: 60_000,
  })

  const vehicleOptions = vehiclesQuery.data ?? []
  const problemCategoryOptions = problemCategoriesQuery.data ?? []

  useEffect(() => {
    if (vehicleId || vehiclesQuery.isLoading) return
    if (vehicleOptions.length === 1) {
      setVehicleId(vehicleOptions[0].value)
    }
  }, [vehicleId, vehicleOptions, vehiclesQuery.isLoading])

  useEffect(() => {
    setItems((prev) =>
      prev.map((row) => ({ ...row, problemCategory: '' })),
    )
  }, [maintenanceTypeId])

  const updateItem = (key: string, next: MaintenanceItemDraft) => {
    setItems((prev) => prev.map((row) => (row.key === key ? next : row)))
  }

  const addItem = () => {
    setItems((prev) => [...prev, emptyItem()])
  }

  const removeItem = (key: string) => {
    setItems((prev) =>
      prev.length <= 1 ? prev : prev.filter((row) => row.key !== key),
    )
  }

  const submitMutation = useMutation({
    mutationFn: submitWorkOrder,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['maintenance-work-orders'] })
      showSuccessToast('Maintenance requisition submitted successfully.')
      navigate('/maintenance/work-orders')
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to submit work order')
    },
  })

  const resolveCategoryName = (categoryId: string): string => {
    const match = problemCategoryOptions.find((option) => option.value === categoryId)
    return match?.label ?? categoryId
  }

  const handleSubmit = () => {
    if (!driverId) {
      showErrorToast('Driver profile is not available.')
      return
    }
    if (!vehicleId) {
      showErrorToast('Please select an assigned vehicle.')
      return
    }
    if (!maintenanceTypeId) {
      showErrorToast('Please select a maintenance type.')
      return
    }
    const invalid = items.some((row) => !row.problemCategory)
    if (invalid) {
      showErrorToast('Please complete required fields before submitting.')
      return
    }

    const problems = items.map((row) => ({
      description: row.problemDescription.trim(),
      category_name: resolveCategoryName(row.problemCategory),
    }))

    const proofFiles = items.flatMap((row, problemIndex) =>
      row.proofFile ? [{ file: row.proofFile, problemIndex }] : [],
    )

    submitMutation.mutate({
      vehicleId,
      maintenanceTypeId,
      problems,
      proofFiles,
    })
  }

  return (
    <section className="space-y-5">
      <PageHeader
        title="Maintenance Requisition"
        subtitle="Apply work order for vehicle maintenance"
      />

      <Card className="border border-[var(--fms-strokes)] bg-white">
        <CardContent className="space-y-3">
          <h2 className="text-base font-semibold text-[var(--fms-text-header)]">
            Maintenance Details
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>
                Assigned Vehicle <RequiredMark />
              </Label>
              {!driverId ? (
                <Input
                  readOnly
                  value=""
                  placeholder="Driver profile not available"
                  className="bg-[#f8f8f9] text-[var(--fms-text-header)]"
                />
              ) : vehiclesQuery.isLoading ? (
                <Input
                  readOnly
                  value=""
                  placeholder="Loading vehicles…"
                  className="bg-[#f8f8f9] text-[var(--fms-text-header)]"
                />
              ) : vehiclesQuery.isError ? (
                <Input
                  readOnly
                  value=""
                  placeholder="Could not load vehicles"
                  className="bg-[#f8f8f9] text-[var(--fms-text-header)]"
                />
              ) : vehicleOptions.length === 0 ? (
                <Input
                  readOnly
                  value=""
                  placeholder="No assigned vehicles found"
                  className="bg-[#f8f8f9] text-[var(--fms-text-header)]"
                />
              ) : (
                <SearchableAutocomplete
                  value={vehicleId}
                  onChange={setVehicleId}
                  options={vehicleOptions}
                  loading={vehiclesQuery.isLoading}
                  disabled={vehicleOptions.length === 0}
                  placeholder="Select vehicle"
                  searchPlaceholder="Search vehicle…"
                  emptyMessage="No vehicles found."
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>
                Maintenance Type <RequiredMark />
              </Label>
              <select
                value={maintenanceTypeId}
                onChange={(event) => setMaintenanceTypeId(event.target.value)}
                disabled={maintenanceTypesQuery.isLoading}
                className="flex h-8 w-full rounded-lg border border-[var(--fms-strokes)] bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">
                  {maintenanceTypesQuery.isLoading
                    ? 'Loading maintenance types…'
                    : maintenanceTypesQuery.isError
                      ? 'Could not load maintenance types'
                      : 'Select type'}
                </option>
                {maintenanceTypes.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            {items.map((item, index) => (
              <MaintenanceItemCard
                key={item.key}
                item={item}
                index={index}
                canRemove={items.length > 1}
                problemCategoryOptions={problemCategoryOptions}
                problemCategoriesLoading={problemCategoriesQuery.isLoading}
                maintenanceTypeSelected={Boolean(maintenanceTypeId)}
                onChange={(next) => updateItem(item.key, next)}
                onRemove={() => removeItem(item.key)}
              />
            ))}
          </div>

          <Button type="button" size="sm" onClick={addItem}>
            <Plus className="mr-1 h-4 w-4" />
            Add New
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="destructive"
          className="bg-[var(--fms-delete)] text-white hover:bg-[var(--fms-delete)]/90"
          asChild
        >
          <Link to="/maintenance/work-orders">Close</Link>
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={submitMutation.isPending}
        >
          {submitMutation.isPending ? 'Submitting…' : 'Submit Request'}
        </Button>
      </div>
    </section>
  )
}
