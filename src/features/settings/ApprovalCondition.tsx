import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CloudUpload, Plus, RotateCcw, Search } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  createApprovalCondition,
  deleteApprovalCondition,
  fetchApprovalConditionsPage,
  toApprovalConditionPayload,
  updateApprovalCondition,
  type ApprovalConditionTableRow,
} from '@/features/settings/lib/approval-condition-api'
import { fetchApprovalHeadNameById } from '@/features/settings/lib/approval-head-api'
import { DeleteDialog } from '@/shared/components/DeleteDialog'
import { PageHeader } from '@/shared/components/PageHeader'
import {
  DeleteRowActionButton,
  EditRowActionButton,
  rowActionsContainerClassName,
} from '@/shared/components/TableRowActionButtons'
import { TablePagination } from '@/shared/components/TablePagination'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

type FormValues = {
  name: string
  label: string
  hasEmployeeField: boolean
}

const LIST_QUERY_KEY = 'workflows/approval-conditions'
const HEAD_NAME_LOOKUP_QUERY_KEY = 'workflowapproval-head-name-lookup'


function emptyValues(): FormValues {
  return {
    name: '',
    label: '',
    hasEmployeeField: false,
  }
}

function formatYesNo(value: boolean) {
  return value ? 'Yes' : 'No'
}

function ApprovalCondition() {
  const { approvalHeadId: routeApprovalHeadId = '' } = useParams<{ approvalHeadId: string }>()
  const approvalHeadId = routeApprovalHeadId.trim()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedDeleteId, setSelectedDeleteId] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const crud = useRouteCrudPermissions('/settings/approval-head')
  const canCreate = !crud.isResolved || crud.canCreate
  const canUpdate = !crud.isResolved || crud.canUpdate
  const canDelete = !crud.isResolved || crud.canDelete
  const canRead = !crud.isResolved || crud.canRead

  const { register, handleSubmit, reset, watch, setValue, formState } = useForm<FormValues>({
    defaultValues: emptyValues(),
  })

  const hasEmployeeFieldValue = watch('hasEmployeeField')

  const listQuery = useQuery({
    queryKey: [LIST_QUERY_KEY, approvalHeadId, search, page, pageSize],
    queryFn: () => fetchApprovalConditionsPage(approvalHeadId, search, page, pageSize),
    enabled: canRead && Boolean(approvalHeadId),
  })

  const approvalHeadNamesQuery = useQuery({
    queryKey: [HEAD_NAME_LOOKUP_QUERY_KEY],
    queryFn: fetchApprovalHeadNameById,
    enabled: canRead,
  })

  const approvalHeadNameById = useMemo(
    () => approvalHeadNamesQuery.data ?? {},
    [approvalHeadNamesQuery.data],
  )

  const resolveApprovalHeadName = (row: ApprovalConditionTableRow) => {
    const headId = row.approvalHeadId.trim() || approvalHeadId
    return (headId && approvalHeadNameById[headId]) || row.approvalHeadName || '-'
  }



  const createMutation = useMutation({
    mutationFn: (body: ReturnType<typeof toApprovalConditionPayload>) =>
      createApprovalCondition(approvalHeadId, body),
    onSuccess: () => {
      showSuccessToast('Approval condition created successfully')
      queryClient.invalidateQueries({ queryKey: [LIST_QUERY_KEY] })
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : 'Failed to create approval condition'
      showErrorToast(message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ReturnType<typeof toApprovalConditionPayload> }) =>
      updateApprovalCondition(approvalHeadId, id, body),
    onSuccess: () => {
      showSuccessToast('Approval condition updated successfully')
      queryClient.invalidateQueries({ queryKey: [LIST_QUERY_KEY] })
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : 'Failed to update approval condition'
      showErrorToast(message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: ({ approvalHeadId: headId, id }: { approvalHeadId: string; id: string }) =>
      deleteApprovalCondition(headId, id),
    onSuccess: () => {
      showSuccessToast('Approval condition deleted successfully')
      queryClient.invalidateQueries({ queryKey: [LIST_QUERY_KEY] })
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : 'Failed to delete approval condition'
      showErrorToast(message)
    },
  })

  const rows = useMemo(() => listQuery.data?.rows ?? [], [listQuery.data?.rows])
  const totalCount = listQuery.data?.totalCount ?? rows.length
  const effectivePageSize = listQuery.data?.effectivePageSize ?? pageSize
  const totalPages =
    listQuery.data?.totalPages ?? Math.max(1, Math.ceil(totalCount / effectivePageSize))
  const isSubmitting = createMutation.isPending || updateMutation.isPending

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingId(null)
    reset(emptyValues())
  }

  const onCreateOpen = () => {
    if (!canCreate) return
    setEditingId(null)
    reset(emptyValues())
    setDialogOpen(true)
  }

  const onEdit = (row: ApprovalConditionTableRow) => {
    if (!canUpdate) return
    setEditingId(row.id)
    reset({
      name: row.name,
      label: row.label,
      hasEmployeeField: row.hasEmployeeField,
    })
    setDialogOpen(true)
  }

  const onDeleteRequest = (row: ApprovalConditionTableRow) => {
    if (!canDelete) return
    setSelectedDeleteId(row.id)
    setDeleteOpen(true)
  }

  const onConfirmDelete = () => {
    if (!canDelete || !selectedDeleteId || !approvalHeadId) return
    deleteMutation.mutate(
      { approvalHeadId, id: selectedDeleteId },
      {
        onSettled: () => {
          setSelectedDeleteId(null)
          setDeleteOpen(false)
        },
      },
    )
  }

  const onSubmit = (raw: FormValues) => {
    if (!approvalHeadId || !raw.name.trim() || !raw.label.trim()) return
    if (editingId && !canUpdate) return
    if (!editingId && !canCreate) return

    const body = toApprovalConditionPayload(raw)

    if (editingId) {
      updateMutation.mutate({ id: editingId, body }, { onSuccess: closeDialog })
    } else {
      createMutation.mutate(body, { onSuccess: closeDialog })
    }
  }

  const tableColumns = [
    "Sl.No",
    "Approval Head",
    "Field Name",
    "Field Label",
    "Has Employee Field",
  ] as const;

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Approval Condition Field"
          subtitle="Define condition fields used for each approval head in workflows"
        />
        {canCreate ? (
          <Button
            type="button"
            className="w-full bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)] sm:w-auto"
            onClick={onCreateOpen}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add New
          </Button>
        ) : null}
      </div>

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="space-y-4 p-0">
          <div className="flex justify-end">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--fms-text-subheading)]" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder="Search approval condition..."
                className="pl-9"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[var(--fms-strokes)]">
            <table className="min-w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  {tableColumns.map((column) => (
                    <th
                      key={column}
                      className={
                        column === 'Sl.No'
                          ? 'px-4 py-3 text-center font-semibold '
                          : 'px-4 py-3 text-left font-semibold'
                      }
                    >
                      {column}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center font-semibold capitalize">Action</th>
                </tr>
              </thead>
              <tbody>
                {crud.isResolved && !canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={tableColumns.length}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      You do not have permission to view this data.
                    </td>
                  </tr>
                ) : listQuery.isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={`ac-sk-${index}`} className="border-t border-[var(--fms-strokes)]">
                      {Array.from({ length: tableColumns.length }).map((__, cellIndex) => (
                        <td key={cellIndex} className="px-4 py-3">
                          <Skeleton className="h-4 w-full max-w-[8rem]" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : listQuery.isError ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={tableColumns.length}
                      className="px-4 py-6 text-center text-[var(--fms-delete)]"
                    >
                      Failed to load approval conditions.
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={tableColumns.length}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      No records found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-t border-[var(--fms-strokes)]">
                      <td className="px-4 py-3 text-center text-[var(--fms-text-subheading)]">
                        {row.serialNo}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {resolveApprovalHeadName(row)}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">{row.name}</td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">{row.label}</td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {formatYesNo(row.hasEmployeeField)}
                      </td>
                      <td className="px-4 py-3">
                        <div className={rowActionsContainerClassName}>
                          <EditRowActionButton
                            type="button"
                            disabled={!canUpdate}
                            onClick={() => onEdit(row)}
                          />
                          <DeleteRowActionButton
                            type="button"
                            disabled={!canDelete}
                            onClick={() => onDeleteRequest(row)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <TablePagination
            page={page}
            totalPages={totalPages}
            pageSize={effectivePageSize}
            totalCount={totalCount}
            onPageChange={(nextPage) => setPage(Math.max(1, Math.min(nextPage, totalPages)))}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize)
              setPage(1)
            }}
          />
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog()
          else setDialogOpen(true)
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Update Approval Condition' : 'Create Approval Condition'}
            </DialogTitle>
          </DialogHeader>

          <form className="space-y-5 py-1" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="grid gap-4">
              {/* <div className="space-y-2">
                <Label htmlFor="condition-approval-head">
                  Approval Head <span className="text-[var(--fms-delete)]">*</span>
                </Label>
                <select
                  id="condition-approval-head"
                  {...register('approvalHeadId', {
                    required: 'Approval head is required',
                    validate: (value) => value.trim() !== '' || 'Approval head is required',
                  })}
                  className={selectClassName}
                  aria-invalid={formState.errors.approvalHeadId ? true : undefined}
                  disabled={headsQuery.isLoading || headsQuery.isError}
                >
                  <option value="">-- Select Head --</option>
                  {headOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {headsQuery.isError ? (
                  <p className="text-xs text-[var(--fms-delete)]">Failed to load approval heads.</p>
                ) : null}
                {formState.errors.approvalHeadId?.message ? (
                  <p className="text-xs text-[var(--fms-delete)]">
                    {formState.errors.approvalHeadId.message}
                  </p>
                ) : null}
              </div> */}

              <div className="space-y-2">
                <Label htmlFor="condition-name">
                  Name <span className="text-[var(--fms-delete)]">*</span>
                </Label>
                <Input
                  id="condition-name"
                  {...register('name', {
                    required: 'Name is required',
                    validate: (value) => value.trim() !== '' || 'Name cannot be empty',
                  })}
                  placeholder="e.g. no_of_days"
                  aria-invalid={formState.errors.name ? true : undefined}
                />
                {formState.errors.name?.message ? (
                  <p className="text-xs text-[var(--fms-delete)]">
                    {formState.errors.name.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="condition-label">
                  Label <span className="text-[var(--fms-delete)]">*</span>
                </Label>
                <Input
                  id="condition-label"
                  {...register('label', {
                    required: 'Label is required',
                    validate: (value) => value.trim() !== '' || 'Label cannot be empty',
                  })}
                  placeholder="e.g. No of Days"
                  aria-invalid={formState.errors.label ? true : undefined}
                />
                {formState.errors.label?.message ? (
                  <p className="text-xs text-[var(--fms-delete)]">
                    {formState.errors.label.message}
                  </p>
                ) : null}
              </div>

              <div className="flex items-end pb-2">
                <label
                  htmlFor="condition-has-employee-field"
                  className="flex cursor-pointer items-center gap-2 text-sm text-[var(--fms-text-subheading)]"
                >
                  <input
                    id="condition-has-employee-field"
                    type="checkbox"
                    checked={hasEmployeeFieldValue}
                    onChange={(event) => setValue('hasEmployeeField', event.target.checked)}
                    className="h-4 w-4 rounded border-[var(--fms-strokes)] accent-[var(--fms-button)]"
                  />
                  Has Employee Field
                </label>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-2 border-t border-[var(--fms-strokes)] pt-4">
              <Button
                type="submit"
                className="bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)]"
                disabled={isSubmitting || (editingId ? !canUpdate : !canCreate)}
              >
                <CloudUpload className="mr-2 h-4 w-4" />
                {isSubmitting ? 'Saving...' : 'SAVE'}
              </Button>
              <Button type="button" variant="destructive" onClick={closeDialog} disabled={isSubmitting}>
                <RotateCcw className="mr-2 h-4 w-4" />
                CANCEL
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={onConfirmDelete}
        title="Delete Approval Condition"
        description="Are you sure you want to delete this approval condition? This action cannot be undone."
      />
    </section>
  )
}

export default ApprovalCondition
