/**
 * Admin screen at `/admin/permissions`: lists permission catalog (object rows or string-only action list from
 * `GET /admin/permissions/actions`), supports create/edit/delete when the API returns record shapes and CRUD flags allow.
 */
import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiDelete, apiGet, apiPost, apiPut } from '@/services/apiClient'
import {
  DeleteRowActionButton,
  EditRowActionButton,
  rowActionsContainerClassName,
} from '@/shared/components/TableRowActionButtons'
import { DeleteDialog } from '@/shared/components/DeleteDialog'
import { PageHeader } from '@/shared/components/PageHeader'
import { TablePagination } from '@/shared/components/TablePagination'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'
import { applyPagination } from '@/shared/utils/pagination'

type ApiRecord = Record<string, unknown>

type FormValues = {
  code: string
  module: string
  description: string
}

type PermissionRow = {
  serialNo: number
  code: string
  module: string
  description: string
}

/** Scalar → string for grid cells (mirrors other feature pages). */
function toText(value: unknown) {
  return typeof value === 'string' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

/** Normalizes list payloads: top-level array or common `items`/`results`/`data`/`actions` buckets. */
function toArray(payload: unknown): ApiRecord[] {
  if (Array.isArray(payload)) return payload.filter((item): item is ApiRecord => !!item && typeof item === 'object')
  if (!payload || typeof payload !== 'object') return []
  const root = payload as Record<string, unknown>
  const candidates = [root.items, root.results, root.data, root.actions, (root.data as Record<string, unknown> | undefined)?.items]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is ApiRecord => !!item && typeof item === 'object')
    }
  }
  return []
}

/** API returns `{ data: ["create", "read", ...] }` — list of action identifiers. */
function parseActionStringsFromPayload(payload: unknown): string[] | null {
  if (!payload || typeof payload !== 'object') return null
  const data = (payload as Record<string, unknown>).data
  if (!Array.isArray(data)) return null
  if (!data.every((item) => typeof item === 'string')) return null
  return data.map((s) => (s as string).trim()).filter(Boolean)
}

type ParsedList =
  | { kind: 'actions'; actions: string[] }
  | { kind: 'records'; records: ApiRecord[] }

/**
 * Decides whether the list API returned a catalog of action codes only vs full permission objects;
 * drives UI (string table vs CRUD dialog/delete).
 */
function parseListPayload(payload: unknown): ParsedList {
  const actions = parseActionStringsFromPayload(payload)
  if (actions) return { kind: 'actions', actions }

  if (payload && typeof payload === 'object') {
    const data = (payload as Record<string, unknown>).data
    if (Array.isArray(data) && data.every((item): item is ApiRecord => !!item && typeof item === 'object')) {
      return { kind: 'records', records: data }
    }
  }

  return { kind: 'records', records: toArray(payload) }
}

/** Maps API records to numbered table rows for server-paginated grids. */
function mapRows(records: ApiRecord[], serialBase: number): PermissionRow[] {
  return records.map((record, index) => ({
    serialNo: serialBase + index + 1,
    code:
      toText(record.code) ||
      toText(record.permission_code) ||
      toText(record.action) ||
      toText(record.name),
    module: toText(record.module) || '-',
    description: toText(record.description) || '-',
  }))
}

/** Default empty dialog form for create/edit permission entity. */
function emptyValues(): FormValues {
  return { code: '', module: '', description: '' }
}

const PERMISSION_ACTIONS_PATH = '/admin/permissions/actions'

/** Sidebar route for the Permission admin screen (`/admin/permissions`). */
const PERMISSION_PAGE_ROUTE = '/admin/permissions'

/** Fetches `/admin/permissions` or interprets `/admin/permissions/actions`; handles mutations and dialogs. */
export function PermissionManagement() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingCode, setEditingCode] = useState<string | null>(null)
  const [selectedDeleteCode, setSelectedDeleteCode] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const { register, handleSubmit, reset, formState } = useForm<FormValues>({ defaultValues: emptyValues() })

  const listQuery = useQuery({
    queryKey: ['admin-permissions-actions', search, page, pageSize],
    queryFn: async () => {
      const payload = await apiGet<unknown>(PERMISSION_ACTIONS_PATH)
      const parsed = parseListPayload(payload)

      if (parsed.kind === 'actions') {
        const q = search.trim().toLowerCase()
        let actions = parsed.actions
        if (q) actions = actions.filter((a) => a.toLowerCase().includes(q))
        const paged = applyPagination(payload, actions, page, pageSize, {
          page,
          pageSize,
          pageLength: actions.length,
        })
        const rows: PermissionRow[] = paged.rows.map((action, index) => ({
          serialNo: paged.serialBase + index + 1,
          code: action,
          module: '',
          description: '',
        }))
        return {
          listKind: 'actions' as const,
          rows,
          totalCount: paged.totalCount,
          totalPages: paged.totalPages,
          effectivePageSize: paged.effectivePageSize,
        }
      }

      const records = parsed.records
      const paged = applyPagination(payload, records, page, pageSize, {
        page,
        pageSize,
        pageLength: records.length,
      })
      const rows = mapRows(paged.rows, paged.serialBase)
      return {
        listKind: 'records' as const,
        rows,
        totalCount: paged.totalCount,
        totalPages: paged.totalPages,
        effectivePageSize: paged.effectivePageSize,
      }
    },
  })

  const createMutation = useMutation({
    mutationFn: (body: { code: string; description: string; module: string }) =>
      apiPost<unknown, typeof body>('/admin/permissions', body),
    onSuccess: () => {
      showSuccessToast('Permission created successfully')
      queryClient.invalidateQueries({ queryKey: ['admin-permissions-actions'] })
    },
    onError: (error) => {
      showErrorToast(error instanceof Error ? error.message : 'Failed to create permission')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ code, body }: { code: string; body: { code: string; description: string; module: string } }) =>
      apiPut<unknown, typeof body>(`/admin/permissions/${encodeURIComponent(code)}`, body),
    onSuccess: () => {
      showSuccessToast('Permission updated successfully')
      queryClient.invalidateQueries({ queryKey: ['admin-permissions-actions'] })
    },
    onError: (error) => {
      showErrorToast(error instanceof Error ? error.message : 'Failed to update permission')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (code: string) => apiDelete<unknown>(`/admin/permissions/${encodeURIComponent(code)}`),
    onSuccess: () => {
      showSuccessToast('Permission deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['admin-permissions-actions'] })
    },
    onError: (error) => {
      showErrorToast(error instanceof Error ? error.message : 'Failed to delete permission')
    },
  })

  const rows = useMemo(() => listQuery.data?.rows ?? [], [listQuery.data?.rows])
  const totalCount = listQuery.data?.totalCount ?? rows.length
  const effectivePageSize = listQuery.data?.effectivePageSize ?? pageSize
  const totalPages =
    listQuery.data?.totalPages ?? Math.max(1, Math.ceil(totalCount / Math.max(1, effectivePageSize)))

  const isSubmitting = createMutation.isPending || updateMutation.isPending
  const listError = listQuery.isError ? (listQuery.error instanceof Error ? listQuery.error.message : 'Failed to load permissions') : null

  const listKind = listQuery.data?.listKind
  const isRecordTable = listKind === 'records'

  const crud = useRouteCrudPermissions(PERMISSION_PAGE_ROUTE)

  const onCreateOpen = () => {
    if (!crud.canCreate) return
    setEditingCode(null)
    reset(emptyValues())
    setDialogOpen(true)
  }

  const onEdit = (row: PermissionRow) => {
    if (!crud.canUpdate) return
    if (!row.code) {
      showErrorToast('Missing permission code for update')
      return
    }
    setEditingCode(row.code)
    reset({
      code: row.code,
      module: row.module === '-' ? '' : row.module,
      description: row.description === '-' ? '' : row.description,
    })
    setDialogOpen(true)
  }

  const onDeleteRequest = (row: PermissionRow) => {
    if (!crud.canDelete) return
    if (!row.code) {
      showErrorToast('Missing permission code for delete')
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
    if (!raw.code.trim() || !raw.module.trim() || !raw.description.trim()) return
    if (editingCode && !crud.canUpdate) return
    if (!editingCode && !crud.canCreate) return

    const body = {
      code: raw.code.trim(),
      description: raw.description.trim(),
      module: raw.module.trim(),
    }

    if (editingCode) {
      updateMutation.mutate({ code: editingCode, body })
    } else {
      createMutation.mutate(body)
    }
    setDialogOpen(false)
    setEditingCode(null)
    reset(emptyValues())
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Permission"
          subtitle={
            isRecordTable
              ? 'Manage permission records and configurations'
              : 'Permission actions available for modules (e.g. create, read, update)'
          }
        />
        {isRecordTable ? (
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
            <DialogTrigger asChild onClick={onCreateOpen}>
              <Button className="w-full bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)] sm:w-auto">
                <Plus className="mr-1 h-4 w-4" />
                Add New
              </Button>
            </DialogTrigger>
          ) : null}
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingCode ? 'Update Permission' : 'Add New Permission'}</DialogTitle>
            </DialogHeader>

            <form className="space-y-3 py-1" onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="space-y-2">
                <Label htmlFor="perm-code">
                  Code <span className="text-[var(--fms-delete)]">*</span>
                </Label>
                <Input
                  id="perm-code"
                  {...register('code', {
                    required: 'Code is required',
                    validate: (value) => value.trim() !== '' || 'Code cannot be empty',
                  })}
                  placeholder="e.g. vehicle:read"
                  disabled={!!editingCode}
                  aria-invalid={formState.errors.code ? true : undefined}
                />
                {formState.errors.code?.message ? <p className="text-xs text-[var(--fms-delete)]">{formState.errors.code.message}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="perm-module">
                  Module <span className="text-[var(--fms-delete)]">*</span>
                </Label>
                <Input
                  id="perm-module"
                  {...register('module', {
                    required: 'Module is required',
                    validate: (value) => value.trim() !== '' || 'Module cannot be empty',
                  })}
                  placeholder="e.g. vehicle"
                  aria-invalid={formState.errors.module ? true : undefined}
                />
                {formState.errors.module?.message ? <p className="text-xs text-[var(--fms-delete)]">{formState.errors.module.message}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="perm-description">
                  Description <span className="text-[var(--fms-delete)]">*</span>
                </Label>
                <textarea
                  id="perm-description"
                  {...register('description', {
                    required: 'Description is required',
                    validate: (value) => value.trim() !== '' || 'Description cannot be empty',
                  })}
                  placeholder="Describe what this permission allows"
                  className="min-h-20 w-full rounded-md border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--fms-info-border)] aria-invalid:border-[var(--fms-delete)]"
                  aria-invalid={formState.errors.description ? true : undefined}
                />
                {formState.errors.description?.message ? (
                  <p className="text-xs text-[var(--fms-delete)]">{formState.errors.description.message}</p>
                ) : null}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || (editingCode ? !crud.canUpdate : !crud.canCreate)}>
                  {editingCode ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        ) : null}
      </div>

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="space-y-4 p-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-end">
            <div className="relative w-full max-w-sm sm:ml-auto">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--fms-text-subheading)]" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder={isRecordTable ? 'Search code, module, description...' : 'Search actions...'}
                className="pl-9"
              />
            </div>
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  {(isRecordTable ? ['Sl.No', 'Code', 'Module', 'Description', 'Actions'] : ['Sl.No', 'Action']).map((column) => (
                    <th key={column} className="px-4 py-3 text-left font-semibold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listQuery.isLoading ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td colSpan={isRecordTable ? 5 : 2} className="px-4 py-6 text-center text-[var(--fms-text-subheading)]">
                      Loading permissions...
                    </td>
                  </tr>
                ) : listError ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td colSpan={isRecordTable ? 5 : 2} className="px-4 py-6 text-center text-[var(--fms-delete)]">
                      {listError}
                    </td>
                  </tr>
                ) : crud.isResolved && !crud.canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td colSpan={isRecordTable ? 5 : 2} className="px-4 py-6 text-center text-[var(--fms-text-subheading)]">
                      You do not have permission to view this list.
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td colSpan={isRecordTable ? 5 : 2} className="px-4 py-6 text-center text-[var(--fms-text-subheading)]">
                      {isRecordTable ? 'No permissions found.' : 'No permission actions found.'}
                    </td>
                  </tr>
                ) : isRecordTable ? (
                  rows.map((row, index) => (
                    <tr key={row.code || `perm-${index}`} className="border-t border-[var(--fms-strokes)]">
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">{row.serialNo}</td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">{row.code || '-'}</td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">{row.module}</td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">{row.description}</td>
                      <td className="px-4 py-3">
                        <div className={rowActionsContainerClassName}>
                          <EditRowActionButton type="button" disabled={!crud.canUpdate} onClick={() => onEdit(row)} />
                          <DeleteRowActionButton type="button" disabled={!crud.canDelete} onClick={() => onDeleteRequest(row)} />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  rows.map((row, index) => (
                    <tr key={row.code || `action-${index}`} className="border-t border-[var(--fms-strokes)]">
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">{row.serialNo}</td>
                      <td className="px-4 py-3 font-medium text-[var(--fms-text-header)]">{row.code}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {listQuery.isLoading ? (
              <p className="py-6 text-center text-[var(--fms-text-subheading)]">Loading permissions...</p>
            ) : listError ? (
              <p className="py-6 text-center text-[var(--fms-delete)]">{listError}</p>
            ) : crud.isResolved && !crud.canRead ? (
              <p className="py-6 text-center text-[var(--fms-text-subheading)]">You do not have permission to view this list.</p>
            ) : rows.length === 0 ? (
              <p className="py-6 text-center text-[var(--fms-text-subheading)]">
                {isRecordTable ? 'No permissions found.' : 'No permission actions found.'}
              </p>
            ) : isRecordTable ? (
              rows.map((row, index) => (
                <div key={row.code || `perm-m-${index}`} className="rounded-lg border border-[var(--fms-strokes)] bg-white p-3">
                  <p className="text-sm text-[var(--fms-text-subheading)]">
                    <span className="font-medium text-[var(--fms-text-header)]">Sl.No:</span> {row.serialNo}
                  </p>
                  <p className="text-sm text-[var(--fms-text-subheading)]">
                    <span className="font-medium text-[var(--fms-text-header)]">Code:</span> {row.code}
                  </p>
                  <p className="text-sm text-[var(--fms-text-subheading)]">
                    <span className="font-medium text-[var(--fms-text-header)]">Module:</span> {row.module}
                  </p>
                  <p className="text-sm text-[var(--fms-text-subheading)]">
                    <span className="font-medium text-[var(--fms-text-header)]">Description:</span> {row.description}
                  </p>
                  <div className={`mt-3 ${rowActionsContainerClassName}`}>
                    <EditRowActionButton type="button" disabled={!crud.canUpdate} onClick={() => onEdit(row)} />
                    <DeleteRowActionButton type="button" disabled={!crud.canDelete} onClick={() => onDeleteRequest(row)} />
                  </div>
                </div>
              ))
            ) : (
              rows.map((row, index) => (
                <div key={row.code || `action-m-${index}`} className="rounded-lg border border-[var(--fms-strokes)] bg-white p-3">
                  <p className="text-sm text-[var(--fms-text-subheading)]">
                    <span className="font-medium text-[var(--fms-text-header)]">Sl.No:</span> {row.serialNo}
                  </p>
                  <p className="text-sm text-[var(--fms-text-subheading)]">
                    <span className="font-medium text-[var(--fms-text-header)]">Action:</span>{' '}
                    <span className="font-medium text-[var(--fms-text-header)]">{row.code}</span>
                  </p>
                </div>
              ))
            )}
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

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={onConfirmDelete}
        title="Delete Permission"
        description="Are you sure you want to delete this permission? This action cannot be undone."
      />
    </section>
  )
}
