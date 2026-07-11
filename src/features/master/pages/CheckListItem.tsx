// Manages checklist item master data from `/master/item-names` CRUD endpoints.
import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { apiDelete, apiGet, apiPost, apiPut } from '@/services/apiClient'
import { DeleteDialog } from '@/shared/components/DeleteDialog'
import { PageHeader } from '@/shared/components/PageHeader'
import {
  DeleteRowActionButton,
  EditRowActionButton,
  rowActionsContainerClassName,
} from '@/shared/components/TableRowActionButtons'
import { TablePagination } from '@/shared/components/TablePagination'
import { applyPagination } from '@/shared/utils/pagination'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

type ApiRecord = Record<string, unknown>
type FormValues = {
  code: string
  name: string
  description: string
}
type CheckListItemRow = {
  serialNo: number
  code: string
  name: string
  description: string
  displayOrder: number
  active: boolean
}

function toText(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toArray(payload: unknown): ApiRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is ApiRecord => !!item && typeof item === 'object')
  }
  if (!payload || typeof payload !== 'object') return []
  const root = payload as Record<string, unknown>
  const candidates = [
    root.items,
    root.results,
    root.data,
    (root.data as Record<string, unknown> | undefined)?.items,
  ]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is ApiRecord => !!item && typeof item === 'object')
    }
  }
  return []
}

function mapRows(records: ApiRecord[], serialStart: number): CheckListItemRow[] {
  return records.map((record, index) => ({
    serialNo: serialStart + index + 1,
    code: toText(record.code),
    name: toText(record.name),
    description: toText(record.description) || '-',
    displayOrder: toNumber(record.display_order ?? record.displayOrder, 0),
    active:
      typeof record.active === 'boolean'
        ? record.active
        : record.active === 1 || record.active === '1',
  }))
}

function emptyValues(): FormValues {
  return { code: '', name: '', description: '' }
}

function buildStatusPayload(row: CheckListItemRow, active: boolean) {
  return {
    code: row.code.trim(),
    name: row.name.trim(),
    description: (row.description === '-' ? '' : row.description).trim(),
    display_order: row.displayOrder,
    active,
  }
}

function listPath(search: string, page: number, pageSize: number) {
  const q = encodeURIComponent(search.trim())
  return `/master/item-names?page=${page}&page_size=${pageSize}&code=&search=${q}`
}

/** Paginated CRUD for checklist items (`/master/item-names`). */
function CheckListItem() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingCode, setEditingCode] = useState<string | null>(null)
  const [selectedDeleteCode, setSelectedDeleteCode] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const { register, handleSubmit, reset, formState } = useForm<FormValues>({
    defaultValues: emptyValues(),
  })

  const crud = useRouteCrudPermissions('/master/checklist-items')

  const listQuery = useQuery({
    queryKey: ['master-item-names', search, page, pageSize],
    queryFn: async () => {
      const payload = await apiGet<unknown>(listPath(search, page, pageSize))
      const records = toArray(payload)
      const paged = applyPagination(payload, records, page, pageSize, {
        page,
        pageSize,
        pageLength: records.length,
      })
      const rows = mapRows(paged.rows, paged.serialBase)
      return {
        rows,
        totalCount: paged.totalCount,
        totalPages: paged.totalPages,
        effectivePageSize: paged.effectivePageSize,
      }
    },
  })

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, string | number | boolean>) =>
      apiPost<unknown, Record<string, string | number | boolean>>(
        '/master/item-names',
        payload,
      ),
    onSuccess: () => {
      showSuccessToast('Checklist item created successfully')
      queryClient.invalidateQueries({ queryKey: ['master-item-names'] })
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : 'Failed to create checklist item'
      showErrorToast(message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({
      code,
      payload,
    }: {
      code: string
      payload: Record<string, string | number | boolean>
    }) =>
      apiPut<unknown, Record<string, string | number | boolean>>(
        `/master/item-names/${encodeURIComponent(code)}`,
        payload,
      ),
    onSuccess: () => {
      showSuccessToast('Checklist item updated successfully')
      queryClient.invalidateQueries({ queryKey: ['master-item-names'] })
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : 'Failed to update checklist item'
      showErrorToast(message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (code: string) =>
      apiDelete<unknown>(`/master/item-names/${encodeURIComponent(code)}`),
    onSuccess: () => {
      showSuccessToast('Checklist item deactivated successfully')
      queryClient.invalidateQueries({ queryKey: ['master-item-names'] })
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : 'Failed to deactivate checklist item'
      showErrorToast(message)
    },
  })

  const rows = useMemo(() => listQuery.data?.rows ?? [], [listQuery.data?.rows])
  const totalCount = listQuery.data?.totalCount ?? rows.length
  const effectivePageSize = listQuery.data?.effectivePageSize ?? pageSize
  const totalPages =
    listQuery.data?.totalPages ?? Math.max(1, Math.ceil(totalCount / effectivePageSize))
  const isSubmitting = createMutation.isPending || updateMutation.isPending

  const onCreateOpen = () => {
    if (!crud.canCreate) return
    setEditingCode(null)
    reset(emptyValues())
    setDialogOpen(true)
  }

  const onEdit = (row: CheckListItemRow) => {
    if (!crud.canUpdate) return
    if (!row.code) {
      showErrorToast('Missing code for checklist item update')
      return
    }
    setEditingCode(row.code)
    reset({
      code: row.code,
      name: row.name,
      description: row.description === '-' ? '' : row.description,
    })
    setDialogOpen(true)
  }

  const onDeleteRequest = (row: CheckListItemRow) => {
    if (!crud.canDelete) return
    if (!row.code) {
      showErrorToast('Missing code for checklist item delete')
      return
    }
    setSelectedDeleteCode(row.code)
    setDeleteOpen(true)
  }

  const onConfirmDelete = () => {
    if (!crud.canDelete) return
    if (!selectedDeleteCode) return
    deleteMutation.mutate(selectedDeleteCode)
    setSelectedDeleteCode(null)
  }

  const onSubmit = (raw: FormValues) => {
    if (!raw.code.trim() || !raw.name.trim() || !raw.description.trim()) return

    if (editingCode && !crud.canUpdate) return
    if (!editingCode && !crud.canCreate) return

    const existingRow = editingCode
      ? rows.find((row) => row.code === editingCode)
      : undefined
    const payload = {
      code: raw.code.trim(),
      name: raw.name.trim(),
      description: raw.description.trim(),
      display_order: existingRow?.displayOrder ?? 1,
      active: existingRow?.active ?? true,
    }

    if (editingCode) {
      updateMutation.mutate({ code: editingCode, payload })
    } else {
      createMutation.mutate(payload)
    }
    setDialogOpen(false)
    setEditingCode(null)
    reset(emptyValues())
  }

  const onToggleStatus = (row: CheckListItemRow, checked: boolean) => {
    if (!crud.canUpdate) return
    if (!row.code) {
      showErrorToast('Missing code for checklist item status update')
      return
    }
    updateMutation.mutate({
      code: row.code,
      payload: buildStatusPayload(row, checked),
    })
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Checklist Items"
          subtitle="Manage checklist item records and configurations"
        />
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) {
              setEditingCode(null)
              reset(emptyValues())
            }
          }}
        >
          {crud.canCreate ? (
            <Button
              type="button"
              className="w-full bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)] sm:w-auto"
              onClick={onCreateOpen}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add New
            </Button>
          ) : null}
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingCode ? 'Update Checklist Item' : 'Add New Checklist Item'}
              </DialogTitle>
            </DialogHeader>

            <form className="space-y-3 py-1" onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="space-y-2">
                <Label htmlFor="code">
                  Code <span className="text-[var(--fms-delete)]">*</span>
                </Label>
                <Input
                  id="code"
                  {...register('code', {
                    required: 'Code is required',
                    validate: (value) => value.trim() !== '' || 'Code cannot be empty',
                  })}
                  placeholder="Enter code"
                  disabled={Boolean(editingCode)}
                  aria-invalid={formState.errors.code ? true : undefined}
                />
                {formState.errors.code?.message ? (
                  <p className="text-xs text-[var(--fms-delete)]">
                    {formState.errors.code.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">
                  Name <span className="text-[var(--fms-delete)]">*</span>
                </Label>
                <Input
                  id="name"
                  {...register('name', {
                    required: 'Name is required',
                    validate: (value) => value.trim() !== '' || 'Name cannot be empty',
                  })}
                  placeholder="Enter name"
                  aria-invalid={formState.errors.name ? true : undefined}
                />
                {formState.errors.name?.message ? (
                  <p className="text-xs text-[var(--fms-delete)]">
                    {formState.errors.name.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">
                  Description <span className="text-[var(--fms-delete)]">*</span>
                </Label>
                <textarea
                  id="description"
                  {...register('description', {
                    required: 'Description is required',
                    validate: (value) =>
                      value.trim() !== '' || 'Description cannot be empty',
                  })}
                  placeholder="Enter description"
                  className="min-h-20 w-full rounded-md border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--fms-info-border)] aria-invalid:border-[var(--fms-delete)]"
                  aria-invalid={formState.errors.description ? true : undefined}
                />
                {formState.errors.description?.message ? (
                  <p className="text-xs text-[var(--fms-delete)]">
                    {formState.errors.description.message}
                  </p>
                ) : null}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    isSubmitting || (editingCode ? !crud.canUpdate : !crud.canCreate)
                  }
                >
                  {editingCode ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
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
                placeholder="Search checklist items..."
                className="pl-9"
              />
            </div>
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  {['Sl.No', 'Code', 'Name', 'Description', 'Status'].map((column) => (
                    <th key={column} className="px-4 py-3 text-left font-semibold">
                      {column}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {listQuery.isLoading ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      Loading records...
                    </td>
                  </tr>
                ) : crud.isResolved && !crud.canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      You do not have permission to view this data.
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      No records found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr
                      key={`checklist-item-${row.code || index}`}
                      className="border-t border-[var(--fms-strokes)]"
                    >
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.serialNo}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.code || '-'}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.description}
                      </td>
                      <td className="px-4 py-3">
                        <div className="inline-flex items-center gap-2">
                          <Switch
                            checked={row.active}
                            onCheckedChange={(checked) => onToggleStatus(row, checked)}
                            disabled={!crud.canUpdate || updateMutation.isPending}
                          />
                          <span className="text-xs text-[var(--fms-text-subheading)]">
                            {row.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className={rowActionsContainerClassName}>
                          <EditRowActionButton
                            type="button"
                            disabled={!crud.canUpdate}
                            onClick={() => onEdit(row)}
                          />
                          <DeleteRowActionButton
                            type="button"
                            disabled={!crud.canDelete}
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

          <div className="space-y-3 md:hidden">
            {listQuery.isLoading ? (
              <p className="px-2 py-4 text-center text-sm text-[var(--fms-text-subheading)]">
                Loading records...
              </p>
            ) : crud.isResolved && !crud.canRead ? (
              <p className="px-2 py-4 text-center text-sm text-[var(--fms-text-subheading)]">
                You do not have permission to view this data.
              </p>
            ) : rows.length === 0 ? (
              <p className="px-2 py-4 text-center text-sm text-[var(--fms-text-subheading)]">
                No records found.
              </p>
            ) : (
              rows.map((row, index) => (
                <div
                  key={`checklist-item-mobile-${row.code || index}`}
                  className="space-y-3 rounded-lg border border-[var(--fms-strokes)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--fms-text-header)]">
                        {row.name || '-'}
                      </p>
                      <p className="text-xs text-[var(--fms-text-subheading)]">
                        {row.code || '-'}
                      </p>
                    </div>
                    <div className={rowActionsContainerClassName}>
                      <EditRowActionButton
                        type="button"
                        disabled={!crud.canUpdate}
                        onClick={() => onEdit(row)}
                      />
                      <DeleteRowActionButton
                        type="button"
                        disabled={!crud.canDelete}
                        onClick={() => onDeleteRequest(row)}
                      />
                    </div>
                  </div>
                  <p className="text-sm text-[var(--fms-text-subheading)]">{row.description}</p>
                  <div className="flex items-center justify-end gap-3">
                    <div className="inline-flex items-center gap-2">
                      <Switch
                        checked={row.active}
                        onCheckedChange={(checked) => onToggleStatus(row, checked)}
                        disabled={!crud.canUpdate || updateMutation.isPending}
                      />
                      <span className="text-xs text-[var(--fms-text-subheading)]">
                        {row.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <TablePagination
            page={page}
            totalPages={totalPages}
            pageSize={effectivePageSize}
            totalCount={totalCount}
            onPageChange={(nextPage) =>
              setPage(Math.max(1, Math.min(nextPage, totalPages)))
            }
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize)
              setPage(1)
            }}
          />
        </CardContent>
      </Card>

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={onConfirmDelete}
        title="Deactivate Checklist Item"
        description="Are you sure you want to deactivate this checklist item? This action cannot be undone."
      />
    </section>
  )
}

export default CheckListItem
