import { useEffect, useMemo } from 'react'
import { Check } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { fetchApprovalHeadsPage } from '@/features/settings/lib/approval-head-api'
import {
  APPROVABLE_TYPES_QUERY_KEY,
  APPROVAL_HEADS_TABS_QUERY_KEY,
  DEFINITIONS_QUERY_KEY,
  emptyApprovalRuleFormValues,
  useApprovableTypeMaps,
  type ApprovalRuleFormValues,
} from '@/features/settings/lib/approval-rule-shared'
import {
  createWorkflowDefinition,
  fetchApprovableTypes,
  fetchWorkflowDefinitionById,
  toWorkflowDefinitionPayload,
  updateWorkflowDefinition,
} from '@/features/settings/lib/approval-rules-api'
import { PageHeader } from '@/shared/components/PageHeader'
import { SearchableAutocomplete } from '@/shared/components/SearchableAutocomplete'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

function ApprovalDefinationFormPage() {
  const { definitionId = '' } = useParams<{ definitionId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const isEdit = Boolean(definitionId.trim())
  const initialHeadId = searchParams.get('approvalHeadId')?.trim() ?? ''

  const crud = useRouteCrudPermissions('/settings/approval-rules')
  const canCreate = !crud.isResolved || crud.canCreate
  const canUpdate = !crud.isResolved || crud.canUpdate
  const canRead = !crud.isResolved || crud.canRead

  const { register, handleSubmit, reset, control, watch, formState } =
    useForm<ApprovalRuleFormValues>({
      defaultValues: emptyApprovalRuleFormValues(initialHeadId),
    })

  const selectedModule = watch("workflow_module_id");
  const selectedHeadId = watch('workflow_approval_head_id')

  const headsQuery = useQuery({
    queryKey: [APPROVAL_HEADS_TABS_QUERY_KEY],
    queryFn: () => fetchApprovalHeadsPage('', 1, 100),
    enabled: canRead,
  })

  const approvalHeads = useMemo(() => headsQuery.data?.rows ?? [], [headsQuery.data?.rows])

  const detailQuery = useQuery({
    queryKey: ['workflows/definition', definitionId],
    queryFn: () => fetchWorkflowDefinitionById(definitionId),
    enabled: isEdit && canRead,
  })

  const approvableTypesQuery = useQuery({
    queryKey: [APPROVABLE_TYPES_QUERY_KEY],
    queryFn: fetchApprovableTypes,
    staleTime: 60_000,
    enabled: canRead,
  })

  const { typeOptionsByModule } = useApprovableTypeMaps(approvableTypesQuery.data)

  const moduleAutocompleteOptions = useMemo(
    () =>
      (approvableTypesQuery.data ?? []).map((item) => ({
        value: item.id,
        label: item.label,
        searchText: item.value,
      })),
    [approvableTypesQuery.data],
  )

  const typeAutocompleteOptions = useMemo(() => {
    const moduleKey = selectedModule.trim()
    const nested = moduleKey ? typeOptionsByModule[moduleKey] : undefined
    if (nested?.length) {
      return nested.map((item) => ({
        value: item.id,
        label: item.label,
        searchText: item.value,
      }))
    }
    return moduleAutocompleteOptions
  }, [moduleAutocompleteOptions, selectedModule, typeOptionsByModule])

  const approvalHeadOptions = useMemo(
    () =>
      approvalHeads.map((head) => ({
        value: head.id,
        label: head.name,
        searchText: head.name,
      })),
    [approvalHeads],
  )

  useEffect(() => {
    if (!isEdit) {
      if (initialHeadId) {
        reset(emptyApprovalRuleFormValues(initialHeadId))
      }
      return
    }
    if (!detailQuery.data) return
    reset({
      workflow_approval_head_id: detailQuery.data.workflow_approval_head_id,
      workflow_module_id: detailQuery.data.workflow_module_id,
      name: detailQuery.data.name,
      description: detailQuery.data.description,
      start_date: detailQuery.data.start_date,
      end_date: detailQuery.data.end_date,
      is_active: detailQuery.data.is_active ? "true" : "false",
    });
  }, [detailQuery.data, initialHeadId, isEdit, reset])

  const createMutation = useMutation({
    mutationFn: createWorkflowDefinition,
    onSuccess: () => {
      showSuccessToast('Approval rule created successfully')
      queryClient.invalidateQueries({ queryKey: [DEFINITIONS_QUERY_KEY] })
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : 'Failed to create approval rule'
      showErrorToast(message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ReturnType<typeof toWorkflowDefinitionPayload> }) =>
      updateWorkflowDefinition(id, body),
    onSuccess: () => {
      showSuccessToast('Approval rule updated successfully')
      queryClient.invalidateQueries({ queryKey: [DEFINITIONS_QUERY_KEY] })
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : 'Failed to update approval rule'
      showErrorToast(message)
    },
  })

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  const onSubmit = (raw: ApprovalRuleFormValues) => {
    const headId = raw.workflow_approval_head_id.trim()
    if (!headId || !raw.workflow_module_id.trim() || !raw.name.trim()) return
    if (isEdit && !canUpdate) return
    if (!isEdit && !canCreate) return

    const body = toWorkflowDefinitionPayload({
      workflow_module_id: raw.workflow_module_id,
      name: raw.name,
      description: '',
      workflow_approval_head_id: headId,
      is_active: raw.is_active === 'true' ? true : false,
      start_date: raw.start_date,
      end_date: raw.end_date,
    })

    const listPath = headId
      ? `/settings/approval-rules?approvalHeadId=${encodeURIComponent(headId)}`
      : '/settings/approval-rules'

    if (isEdit) {
      updateMutation.mutate(
        { id: definitionId, body },
        { onSuccess: () => navigate(listPath) },
      )
    } else {
      createMutation.mutate(body, {
        onSuccess: () => navigate(listPath),
      })
    }
  }

  const detailError = detailQuery.isError
    ? detailQuery.error instanceof Error
      ? detailQuery.error.message
      : 'Failed to load approval rule'
    : null

  if (isEdit && detailQuery.isLoading) {
    return (
      <section className="space-y-5">
        <PageHeader title="Update Approval Rule" subtitle="Loading…" />
        <p className="text-sm text-[var(--fms-text-subheading)]">Loading approval rule details…</p>
      </section>
    )
  }

  if (isEdit && detailError) {
    return (
      <section className="space-y-5">
        <PageHeader title="Update Approval Rule" />
        <p className="text-sm text-[var(--fms-delete)]">{detailError}</p>
        <Button variant="outline" asChild>
          <Link to="/settings/approval-rules">Back to list</Link>
        </Button>
      </section>
    )
  }

  const listBackHref = selectedHeadId
    ? `/settings/approval-rules?approvalHeadId=${encodeURIComponent(selectedHeadId)}`
    : '/settings/approval-rules'

  return (
    <section className="space-y-5">
      <PageHeader
        title={isEdit ? 'Update Approval Rule' : 'Add Approval Rule'}
        subtitle={
          isEdit
            ? 'Update workflow definition details and save.'
            : 'Create a workflow definition for an approval head.'
        }
      />

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white">
        <CardContent className="space-y-5 p-4 sm:p-6">
          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-2">
                <Label>
                  For <span className="text-[var(--fms-delete)]">*</span>
                </Label>
                <Controller
                  name="workflow_approval_head_id"
                  control={control}
                  rules={{
                    required: 'Approval head is required',
                    validate: (value) => value.trim() !== '' || 'Approval head is required',
                  }}
                  render={({ field }) => (
                    <SearchableAutocomplete
                      value={field.value}
                      onChange={field.onChange}
                      options={approvalHeadOptions}
                      loading={headsQuery.isLoading}
                      disabled={headsQuery.isError || isEdit}
                      error={!!formState.errors.workflow_approval_head_id}
                      placeholder="Select approval head"
                      searchPlaceholder="Search approval heads..."
                      emptyMessage="No approval heads found."
                      loadingMessage="Loading approval heads..."
                    />
                  )}
                />
                {headsQuery.isError ? (
                  <p className="text-xs text-[var(--fms-delete)]">Failed to load approval heads.</p>
                ) : null}
                {formState.errors.workflow_approval_head_id?.message ? (
                  <p className="text-xs text-[var(--fms-delete)]">
                    {formState.errors.workflow_approval_head_id.message}
                  </p>
                ) : null}
              </div>

              

              <div className="space-y-2">
                <Label>
                  Type <span className="text-[var(--fms-delete)]">*</span>
                </Label>
                <Controller
                  name="workflow_module_id"
                  control={control}
                  rules={{
                    required: 'Module is required',
                    validate: (value) => value.trim() !== '' || 'Module is required',
                  }}
                  render={({ field }) => (
                    <SearchableAutocomplete
                      value={field.value}
                      onChange={field.onChange}
                      options={typeAutocompleteOptions}
                      loading={approvableTypesQuery.isLoading}
                      //disabled={approvableTypesQuery.isError || !selectedModule.trim()}
                      error={!!formState.errors.workflow_module_id}
                      placeholder="Select your option"
                      searchPlaceholder="Search modules..."
                      emptyMessage="No modules found."
                      loadingMessage="Loading modules..."
                    />
                  )}
                />
                {formState.errors.workflow_module_id?.message ? (
                  <p className="text-xs text-[var(--fms-delete)]">{formState.errors.workflow_module_id.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="approval-rule-name">Rule Name</Label>
                <Input
                  id="approval-rule-name"
                  {...register('name', {
                    required: 'Rule name is required',
                    validate: (value) => value.trim() !== '' || 'Rule name is required',
                  })}
                  placeholder="Enter rule name"
                  aria-invalid={formState.errors.name ? true : undefined}
                />
                {formState.errors.name?.message ? (
                  <p className="text-xs text-[var(--fms-delete)]">{formState.errors.name.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="approval-rule-start-date">Start Date</Label>
                <Input id="approval-rule-start-date" type="date" {...register('start_date')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="approval-rule-end-date">End Date</Label>
                <Input id="approval-rule-end-date" type="date" {...register('end_date')} />
              </div>

              <div className="space-y-2">
                <Label>
                  Status <span className="text-[var(--fms-delete)]">*</span>
                </Label>
                <Controller
                  name="is_active"
                  control={control}
                  rules={{ required: 'Status is required' }}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Active</SelectItem>
                        <SelectItem value="false">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--fms-strokes)] pt-4">
              <Button
                type="submit"
                className="bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)]"
                disabled={isSubmitting || (isEdit ? !canUpdate : !canCreate)}
              >
                <Check className="mr-2 h-4 w-4" />
                {isSubmitting ? 'Saving...' : 'Save'}
              </Button>
              <Button type="button" variant="destructive" asChild disabled={isSubmitting}>
                <Link to={listBackHref}>CANCEL</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  )
}

export default ApprovalDefinationFormPage
