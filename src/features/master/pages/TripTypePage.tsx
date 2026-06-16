// Manages trip type master data from API-backed CRUD endpoints.
import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
  requiresMtoApproval: boolean
}
type TripTypeRow = {
  serialNo: number
  code: string
  name: string
  description: string
  active: boolean
  requiresMtoApproval: boolean
}

function toText(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function toBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : value === 1 || value === '1'
}

function toArray(payload: unknown): ApiRecord[] {
  if (Array.isArray(payload)) return payload.filter((item): item is ApiRecord => !!item && typeof item === 'object')
  if (!payload || typeof payload !== 'object') return []
  const root = payload as Record<string, unknown>
  const candidates = [root.items, root.results, root.data, (root.data as Record<string, unknown> | undefined)?.items]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is ApiRecord => !!item && typeof item === 'object')
    }
  }
  return []
}

function mapRows(records: ApiRecord[], serialStart: number): TripTypeRow[] {
  return records.map((record, index) => ({
    serialNo: serialStart + index + 1,
    code: toText(record.code),
    name: toText(record.name),
    description: toText(record.description) || '-',
    active: toBoolean(record.active),
    requiresMtoApproval: toBoolean(record.requires_mto_approval),
  }))
}

function emptyValues(): FormValues {
  return { code: '', name: '', description: '', requiresMtoApproval: false }
}

function buildStatusPayload(row: TripTypeRow, active: boolean) {
  return {
    code: row.code.trim(),
    name: row.name.trim(),
    description: (row.description === '-' ? '' : row.description).trim(),
    display_order: 1,
    active,
    requires_mto_approval: row.requiresMtoApproval,
  }
}

function listPath(search: string, page: number, pageSize: number) {
  const q = encodeURIComponent(search.trim())
  return `/master/trip-types?page=${page}&page_size=${pageSize}&code=&search=${q}`
}

/** Paginated CRUD for trip types (`/master/trip-types`). */
export function TripTypePage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingCode, setEditingCode] = useState<string | null>(null)
  const [selectedDeleteCode, setSelectedDeleteCode] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const { register, handleSubmit, reset, formState, watch, setValue } = useForm<FormValues>({
    defaultValues: emptyValues(),
  })
  const requiresMtoApprovalValue = watch('requiresMtoApproval')

  const crud = useRouteCrudPermissions('/master/trip-type')

  const listQuery = useQuery({
    queryKey: ['master-trip-types', search, page, pageSize],
    queryFn: async () => {
      const payload = await apiGet<unknown>(listPath(search, page, pageSize))
      const records = toArray(payload)
      const paged = applyPagination(payload, records, page, pageSize, { page, pageSize, pageLength: records.length })
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
      apiPost<unknown, Record<string, string | number | boolean>>('/master/trip-types', payload),
    onSuccess: () => {
      showSuccessToast('Trip type created successfully')
      queryClient.invalidateQueries({ queryKey: ['master-trip-types'] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to create trip type'
      showErrorToast(message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ code, payload }: { code: string; payload: Record<string, string | number | boolean> }) =>
      apiPut<unknown, Record<string, string | number | boolean>>(
        `/master/trip-types/${encodeURIComponent(code)}`,
        payload,
      ),
    onSuccess: () => {
      showSuccessToast('Trip type updated successfully')
      queryClient.invalidateQueries({ queryKey: ['master-trip-types'] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to update trip type'
      showErrorToast(message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (code: string) =>
      apiDelete<unknown>(`/master/trip-types/${encodeURIComponent(code)}`),
    onSuccess: () => {
      showSuccessToast('Trip type deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['master-trip-types'] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to delete trip type'
      showErrorToast(message)
    },
  })

  const rows = useMemo(() => listQuery.data?.rows ?? [], [listQuery.data?.rows])
  const totalCount = listQuery.data?.totalCount ?? rows.length
  const effectivePageSize = listQuery.data?.effectivePageSize ?? pageSize
  const totalPages = listQuery.data?.totalPages ?? Math.max(1, Math.ceil(totalCount / effectivePageSize))
  const isSubmitting = createMutation.isPending || updateMutation.isPending

  const onCreateOpen = () => {
    if (!crud.canCreate) return
    setEditingCode(null)
    reset(emptyValues())
    setDialogOpen(true)
  }

  const onEdit = (row: TripTypeRow) => {
    if (!crud.canUpdate) return
    if (!row.code) {
      showErrorToast('Missing code for trip type update')
      return
    }
    setEditingCode(row.code)
    reset({
      code: row.code,
      name: row.name,
      description: row.description === '-' ? '' : row.description,
      requiresMtoApproval: row.requiresMtoApproval,
    })
    setDialogOpen(true)
  }

  const onDeleteRequest = (row: TripTypeRow) => {
    if (!crud.canDelete) return
    if (!row.code) {
      showErrorToast('Missing code for trip type delete')
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

    const payload = {
      code: raw.code.trim(),
      name: raw.name.trim(),
      description: raw.description.trim(),
      display_order: 1,
      active: true,
      requires_mto_approval: raw.requiresMtoApproval,
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

  const onToggleStatus = (row: TripTypeRow, checked: boolean) => {
    if (!crud.canUpdate) return
    if (!row.code) {
      showErrorToast('Missing code for trip type status update')
      return
    }
    updateMutation.mutate({ code: row.code, payload: buildStatusPayload(row, checked) })
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Trip Type"
          subtitle="Manage trip type records and configurations"
        />
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingCode(null);
              reset(emptyValues());
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
                {editingCode ? "Update Trip Type" : "Add New Trip Type"}
              </DialogTitle>
            </DialogHeader>

            <form
              className="space-y-3 py-1"
              onSubmit={handleSubmit(onSubmit)}
              noValidate
            >
              <div className="space-y-2">
                <Label htmlFor="code">
                  Code <span className="text-[var(--fms-delete)]">*</span>
                </Label>
                <Input
                  id="code"
                  {...register("code", {
                    required: "Code is required",
                    validate: (value) =>
                      value.trim() !== "" || "Code cannot be empty",
                  })}
                  placeholder="Enter code"
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
                  Trip Type <span className="text-[var(--fms-delete)]">*</span>
                </Label>
                <Input
                  id="name"
                  {...register("name", {
                    required: "Trip type is required",
                    validate: (value) =>
                      value.trim() !== "" || "Trip type cannot be empty",
                  })}
                  placeholder="Enter trip type"
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
                  Description{" "}
                  <span className="text-[var(--fms-delete)]">*</span>
                </Label>
                <textarea
                  id="description"
                  {...register("description", {
                    required: "Description is required",
                    validate: (value) =>
                      value.trim() !== "" || "Description cannot be empty",
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

              <div className="flex items-center gap-3">
                <Switch
                  id="requires-mto-approval"
                  checked={requiresMtoApprovalValue}
                  onCheckedChange={(checked) => setValue('requiresMtoApproval', checked)}
                />
                <Label
                  htmlFor="requires-mto-approval"
                  className="text-[var(--fms-text-subheading)]"
                >
                  Requires MTO Approval
                </Label>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    (editingCode ? !crud.canUpdate : !crud.canCreate)
                  }
                >
                  {editingCode ? "Update" : "Create"}
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
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search trip type..."
                className="pl-9"
              />
            </div>
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  {["Sl.No", "Code", "Trip Type", "Description", "MTO Approval", "Status"].map(
                    (column) => (
                      <th
                        key={column}
                        className="px-4 py-3 text-left font-semibold"
                      >
                        {column}
                      </th>
                    ),
                  )}
                  <th
                    key={"column"}
                    className="px-4 py-3  text-center font-semibold"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {listQuery.isLoading ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      Loading records...
                    </td>
                  </tr>
                ) : crud.isResolved && !crud.canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      You do not have permission to view this data.
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      No records found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr
                      key={`trip-${index}`}
                      className="border-t border-[var(--fms-strokes)]"
                    >
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.serialNo}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.code || "-"}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.name || "-"}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.description}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            row.requiresMtoApproval
                              ? ' text-[var(--fms-success-text)]'
                              : 'text-[var(--fms-error-text)]'
                          }
                        >
                          {row.requiresMtoApproval ? 'True' : 'False'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="inline-flex items-center gap-2">
                          <Switch
                            checked={row.active}
                            onCheckedChange={(checked) =>
                              onToggleStatus(row, checked)
                            }
                            disabled={
                              !crud.canUpdate || updateMutation.isPending
                            }
                          />
                          <span className="text-xs text-[var(--fms-text-subheading)]">
                            {row.active ? "Active" : "Inactive"}
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
          <TablePagination
            page={page}
            totalPages={totalPages}
            pageSize={effectivePageSize}
            totalCount={totalCount}
            onPageChange={(nextPage) =>
              setPage(Math.max(1, Math.min(nextPage, totalPages)))
            }
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize);
              setPage(1);
            }}
          />
        </CardContent>
      </Card>

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={onConfirmDelete}
        title="Delete Trip Type"
        description="Are you sure you want to delete this trip type? This action cannot be undone."
      />
    </section>
  );
}
