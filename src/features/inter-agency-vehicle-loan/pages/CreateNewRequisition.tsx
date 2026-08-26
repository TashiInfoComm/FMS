import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { MasterDataSelect } from '@/features/vehicles/components/MasterDataSelect'
import {
  createLoan,
  extractCreatedLoanId,
  fetchLoanForEdit,
  fetchLoanVehicleCategoryOptions,
  updateLoan,
} from '@/features/inter-agency-vehicle-loan/lib/loan-requisition-api'
import type { FuelingResponsibility } from '@/features/inter-agency-vehicle-loan/lib/loan-requisition-types'
import {
  formatLoanDurationDisplay,
  FUELING_RESPONSIBILITY_OPTIONS,
} from '@/features/inter-agency-vehicle-loan/lib/loan-requisition-ui'
import { BackToListButton } from '@/shared/components/BackToListButton'
import { PageHeader } from '@/shared/components/PageHeader'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'
import { cn } from '@/lib/utils'

type RequirementRow = {
  key: string
  vehicleCategoryId: string
  vehicleCount: string
  reason: string
  startDate: string
  endDate: string
  driverRequired: boolean
}

function RequiredMark() {
  return <span className="text-[var(--fms-delete)]"> *</span>
}

function emptyRequirementRow(): RequirementRow {
  return {
    key: crypto.randomUUID(),
    vehicleCategoryId: '',
    vehicleCount: '',
    reason: '',
    startDate: '',
    endDate: '',
    driverRequired: false,
  }
}

function mapRequirementToRow(
  requirement: {
    vehicle_category_id: string
    vehicle_count: number
    reason: string
    start_date: string
    end_date: string
    driver_required: boolean
  },
): RequirementRow {
  return {
    key: crypto.randomUUID(),
    vehicleCategoryId: requirement.vehicle_category_id,
    vehicleCount: String(requirement.vehicle_count),
    reason: requirement.reason,
    startDate: requirement.start_date,
    endDate: requirement.end_date,
    driverRequired: requirement.driver_required,
  }
}

function CreateNewRequisition() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { loanId } = useParams<{ loanId?: string }>()
  const isEditMode = Boolean(loanId?.trim())
  const crud = useRouteCrudPermissions('/vehicle-loan/requisition')

  const [fuelingResponsibility, setFuelingResponsibility] = useState<FuelingResponsibility | ''>('')
  const [remarks, setRemarks] = useState('')
  const [requirements, setRequirements] = useState<RequirementRow[]>([emptyRequirementRow()])
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [formInitialized, setFormInitialized] = useState(false)

  const categoriesQuery = useQuery({
    queryKey: ['vehicle-loan', 'vehicle-categories'],
    queryFn: fetchLoanVehicleCategoryOptions,
    staleTime: 60_000,
  })

  const editQuery = useQuery({
    queryKey: ['vehicle-loan', 'edit-form', loanId],
    queryFn: () => fetchLoanForEdit(loanId!),
    enabled: isEditMode && (!crud.isResolved || crud.canUpdate),
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!isEditMode || !editQuery.data || formInitialized) return
    const data = editQuery.data
    setFuelingResponsibility(data.fueling_responsibility)
    setRemarks(data.remarks)
    setRequirements(
      data.vehicle_requirements.length > 0
        ? data.vehicle_requirements.map(mapRequirementToRow)
        : [emptyRequirementRow()],
    )
    setFormInitialized(true)
  }, [editQuery.data, formInitialized, isEditMode])

  const categoryAutocompleteOptions = useMemo(
    () =>
      (categoriesQuery.data ?? []).map((option) => ({
        value: option.value,
        label: option.label,
        searchText: option.code,
      })),
    [categoriesQuery.data],
  )

  const createMutation = useMutation({
    mutationFn: createLoan,
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['vehicle-loan'] })
      showSuccessToast('Vehicle requirement submitted successfully.')
      const createdLoanId = extractCreatedLoanId(response)
      if (createdLoanId) {
        navigate(`/vehicle-loan/${encodeURIComponent(createdLoanId)}`)
      } else {
        navigate('/vehicle-loan/requisition')
      }
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to submit vehicle requirement')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (body: Parameters<typeof updateLoan>[1]) => updateLoan(loanId!, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['vehicle-loan'] })
      showSuccessToast('Vehicle requirement updated successfully.')
      navigate('/vehicle-loan/requisition')
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to update vehicle requirement')
    },
  })

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  const updateRequirement = (key: string, patch: Partial<RequirementRow>) => {
    setRequirements((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    )
  }

  const addRequirement = () => {
    setRequirements((current) => [...current, emptyRequirementRow()])
  }

  const removeRequirement = (key: string) => {
    setRequirements((current) =>
      current.length === 1 ? current : current.filter((row) => row.key !== key),
    )
  }

  const validationErrors = useMemo(() => {
    const errors: string[] = []
    if (!fuelingResponsibility) {
      errors.push('Fueling responsibility is required.')
    }
    requirements.forEach((row, index) => {
      const rowLabel = `requirement ${index + 1}`
      if (!row.vehicleCategoryId.trim()) {
        errors.push(`Vehicle category is required for ${rowLabel}.`)
      }
      if (!row.vehicleCount.trim() || Number(row.vehicleCount) <= 0) {
        errors.push(`Vehicle count is required for ${rowLabel}.`)
      }
      if (!row.reason.trim()) {
        errors.push(`Reason is required for ${rowLabel}.`)
      }
      if (!row.startDate.trim()) {
        errors.push(`Start date is required for ${rowLabel}.`)
      }
      if (!row.endDate.trim()) {
        errors.push(`End date is required for ${rowLabel}.`)
      }
      if (
        row.startDate.trim() &&
        row.endDate.trim() &&
        new Date(row.endDate) < new Date(row.startDate)
      ) {
        errors.push(`End date must be on or after start date for ${rowLabel}.`)
      }
    })
    return errors
  }, [fuelingResponsibility, requirements])

  const buildPayload = () => ({
    vehicle_requirements: requirements.map((row) => ({
      vehicle_category_id: row.vehicleCategoryId.trim(),
      vehicle_count: Number(row.vehicleCount),
      reason: row.reason.trim(),
      start_date: row.startDate,
      end_date: row.endDate,
      driver_required: row.driverRequired,
    })),
    fueling_responsibility: fuelingResponsibility as FuelingResponsibility,
    remarks: remarks.trim(),
    submit: true,
  })

  const onSubmit = () => {
    setSubmitAttempted(true)
    if (validationErrors.length > 0) {
      showErrorToast(validationErrors[0])
      return
    }

    const payload = buildPayload()
    if (isEditMode) {
      updateMutation.mutate(payload)
      return
    }
    createMutation.mutate(payload)
  }

  if (crud.isResolved && (isEditMode ? !crud.canUpdate : !crud.canCreate)) {
    return (
      <section className="space-y-5">
        <BackToListButton to="/vehicle-loan/requisition" />
        <PageHeader
          title={isEditMode ? 'Edit Vehicle Requisition' : 'New Vehicle Requisition'}
          subtitle="Submit to the Highest Admin for system-wide fleet analysis"
        />
        <p className="text-sm text-[var(--fms-text-subheading)]">
          You do not have permission to {isEditMode ? 'edit' : 'create'} vehicle loan requisitions.
        </p>
      </section>
    )
  }

  if (isEditMode && editQuery.isLoading) {
    return (
      <section className="space-y-5">
        <PageHeader
          title="Edit Vehicle Requisition"
          subtitle="Update vehicle loan requisition details"
        />
        <div className="h-48 animate-pulse rounded-xl border border-[var(--fms-strokes)] bg-white" />
      </section>
    )
  }

  if (isEditMode && editQuery.isError) {
    return (
      <section className="space-y-5">
        <BackToListButton to="/vehicle-loan/requisition" />
        <PageHeader
          title="Edit Vehicle Requisition"
          subtitle="Could not load requisition"
        />
        <p className="text-sm text-[var(--fms-text-subheading)]">
          {editQuery.error instanceof Error
            ? editQuery.error.message
            : 'Could not load this requisition for editing.'}
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <BackToListButton to="/vehicle-loan/requisition" />
      <PageHeader
        title={isEditMode ? 'Edit Vehicle Requisition' : 'New Vehicle Requisition'}
        subtitle={
          isEditMode
            ? 'Update vehicle loan requisition details'
            : 'Submit to the Highest Admin for system-wide fleet analysis'
        }
      />

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white">
        <CardContent className="space-y-6 pt-6">
          {requirements.map((row, index) => (
            <div
              key={row.key}
              className={cn(
                'space-y-4 rounded-xl border border-[var(--fms-strokes)] p-4',
                index > 0 && 'bg-[#fafafa]',
              )}
            >
              {requirements.length > 1 ? (
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[var(--fms-text-header)]">
                    Vehicle requirement {index + 1}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-[var(--fms-error-text)]"
                    onClick={() => removeRequirement(row.key)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Remove
                  </Button>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <MasterDataSelect
                  id={`vehicle-category-${row.key}`}
                  label={
                    <>
                      Vehicle Category Required
                      <RequiredMark />
                    </>
                  }
                  placeholder="Select vehicle category"
                  options={categoryAutocompleteOptions}
                  value={row.vehicleCategoryId}
                  loading={categoriesQuery.isLoading}
                  onValueChange={(value) =>
                    updateRequirement(row.key, { vehicleCategoryId: value })
                  }
                />

                <div className="space-y-2">
                  <Label htmlFor={`vehicle-count-${row.key}`}>
                    Number of Vehicles
                    <RequiredMark />
                  </Label>
                  <Input
                    id={`vehicle-count-${row.key}`}
                    type="number"
                    min={1}
                    placeholder="e.g 2"
                    value={row.vehicleCount}
                    onChange={(event) =>
                      updateRequirement(row.key, { vehicleCount: event.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`start-date-${row.key}`}>
                    Borrow Start Date
                    <RequiredMark />
                  </Label>
                  <Input
                    id={`start-date-${row.key}`}
                    type="date"
                    value={row.startDate}
                    onChange={(event) =>
                      updateRequirement(row.key, { startDate: event.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`end-date-${row.key}`}>
                    Borrow End Date
                    <RequiredMark />
                  </Label>
                  <Input
                    id={`end-date-${row.key}`}
                    type="date"
                    value={row.endDate}
                    onChange={(event) =>
                      updateRequirement(row.key, { endDate: event.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`duration-${row.key}`}>Duration</Label>
                  <Input
                    id={`duration-${row.key}`}
                    value={
                      formatLoanDurationDisplay(row.startDate, row.endDate) || 'Auto calculated'
                    }
                    readOnly
                    placeholder="Auto calculated"
                    className="bg-[#f6f6f7]"
                  />
                </div>

                <div className="space-y-2">
                  <div>
                    <Label htmlFor={`driver-required-${row.key}`}>
                      Driver Required
                      <RequiredMark />
                    </Label>
                    <p className="text-xs text-[var(--fms-text-subheading)]">
                      Toggle on if a driver is needed.
                    </p>
                  </div>
                  <Switch
                    id={`driver-required-${row.key}`}
                    checked={row.driverRequired}
                    onCheckedChange={(checked) =>
                      updateRequirement(row.key, { driverRequired: checked })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`reason-${row.key}`}>
                  Reason
                  <RequiredMark />
                </Label>
                <textarea
                  id={`reason-${row.key}`}
                  rows={3}
                  placeholder="State the reason for this vehicle category requirement"
                  value={row.reason}
                  onChange={(event) =>
                    updateRequirement(row.key, { reason: event.target.value })
                  }
                  className="flex min-h-[80px] w-full rounded-md border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>
          ))}

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              className="border-[var(--fms-strokes)] text-[var(--fms-text-header)]"
              onClick={addRequirement}
            >
              <Plus className="mr-1 h-4 w-4 text-[var(--fms-text-header)]" />
              Add new
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fueling-responsibility">
              Fueling Responsibility
              <RequiredMark />
            </Label>
            <select
              id="fueling-responsibility"
              value={fuelingResponsibility}
              onChange={(event) =>
                setFuelingResponsibility(event.target.value as FuelingResponsibility | '')
              }
              className="flex h-10 w-full rounded-md border border-[var(--fms-strokes)] bg-white px-3 text-sm"
            >
              <option value="">Select fueling responsibility</option>
              {FUELING_RESPONSIBILITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="remarks">Remarks</Label>
            <textarea
              id="remarks"
              rows={3}
              placeholder="Any additional notes or preferences"
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              className="flex min-h-[80px] w-full rounded-md border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm"
            />
          </div>

          {submitAttempted && validationErrors.length > 0 ? (
            <p className="text-sm text-[var(--fms-error-text)]">{validationErrors[0]}</p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--fms-strokes)] pt-4">
            <Button variant="outline" asChild>
              <Link to="/vehicle-loan/requisition">Cancel</Link>
            </Button>
            <Button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitting || categoriesQuery.isLoading}
            >
              {isSubmitting
                ? isEditMode
                  ? 'Updating…'
                  : 'Submitting…'
                : isEditMode
                  ? 'Update'
                  : 'Submit'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

export default CreateNewRequisition
