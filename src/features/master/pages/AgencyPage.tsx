// Agency list — entry point for the Agency → Department → Division → Sub-Division hierarchy.
import { useEffect, useMemo, useState } from 'react'
import { Plus, RefreshCw, Search } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

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
import {
  agencyListPath,
  buildHierarchyPayload,
  buildHierarchyStatusPayload,
  emptyHierarchyFormValues,
  extractHierarchyList,
  hierarchyBasePath,
  mapAgencyRows,
  syncAgencyHierarchy,
  type HierarchyFieldConfig,
  type HierarchyFormValues,
  type HierarchyTableRow,
  toText,
} from '@/features/master/lib/agency-hierarchy-api'
import { buildDepartmentNavigationTarget } from '@/features/master/lib/agency-hierarchy-navigation'
import { apiDelete, apiGet, apiPost, apiPut } from '@/services/apiClient'
import { DeleteDialog } from '@/shared/components/DeleteDialog'
import { PageHeader } from '@/shared/components/PageHeader'
import {
  DeleteRowActionButton,
  DetailRowActionButton,
  EditRowActionButton,
  rowActionsContainerClassName,
} from '@/shared/components/TableRowActionButtons'
import { TablePagination } from '@/shared/components/TablePagination'
import { useAgencyHierarchyPermissions } from '@/shared/hooks/useAgencyHierarchyPermissions'
import { applyPagination } from '@/shared/utils/pagination'
import { cn } from '@/lib/utils'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

const AGENCY_FORM_FIELDS: HierarchyFieldConfig[] = [
  { key: 'code', label: 'Agency Code', type: 'text', placeholder: 'Enter agency code' },
  { key: 'name', label: 'Agency Name', type: 'text', placeholder: 'Enter agency name' },
  {
    key: 'description',
    label: 'Description',
    type: 'textarea',
    placeholder: 'Enter description for this agency',
  },
]

const TABLE_COLUMNS = ['Sl.No', 'Agency Name', 'Code',  'Status'] as const
const TABLE_KEYS = ['serialNo', 'agencyName', 'code'] as const

export function AgencyPage() {
  const navigate = useNavigate()
  const { canRead, canCreate, canUpdate, canDelete, isResolved } =
    useAgencyHierarchyPermissions('Agency')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingCode, setEditingCode] = useState<string | null>(null)
  const [selectedDeleteCode, setSelectedDeleteCode] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { register, handleSubmit, reset, formState } = useForm<HierarchyFormValues>({
    defaultValues: emptyHierarchyFormValues(AGENCY_FORM_FIELDS),
  })

  const listQuery = useQuery({
    queryKey: ['master-agencies', search, page, pageSize],
    queryFn: async () => {
      const payload = await apiGet<unknown>(agencyListPath(search, page, pageSize))
      const records = extractHierarchyList(payload)
      const paged = applyPagination(payload, records, page, pageSize, {
        page,
        pageSize,
        pageLength: records.length,
      })
      const rows = mapAgencyRows(paged.rows, paged.serialBase)
      return {
        rows,
        totalCount: paged.totalCount,
        totalPages: paged.totalPages,
        effectivePageSize: paged.effectivePageSize,
      }
    },
  })

  const normalizedRows = useMemo(
    () =>
      (listQuery.data?.rows ?? []).map((row) => {
        const normalized: HierarchyTableRow = {}
        TABLE_KEYS.forEach((key) => {
          normalized[key] = row[key] ?? '-'
        })
        normalized.code = row.code ?? ''
        normalized.name = row.name ?? ''
        normalized.id = row.id ?? ''
        normalized.active = row.active ?? true
        return normalized
      }),
    [listQuery.data?.rows],
  )

  const totalCount = listQuery.data?.totalCount ?? normalizedRows.length
  const effectivePageSize = listQuery.data?.effectivePageSize ?? pageSize
  const totalPages =
    listQuery.data?.totalPages ?? Math.max(1, Math.ceil(totalCount / effectivePageSize))

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, string | number | boolean>) =>
      apiPost<unknown, Record<string, string | number | boolean>>(
        hierarchyBasePath('Agency'),
        payload,
      ),
    onSuccess: () => {
      showSuccessToast('Agency created successfully')
      queryClient.invalidateQueries({ queryKey: ['master-agencies'] })
    },
    onError: (error) => {
      showErrorToast(error instanceof Error ? error.message : 'Failed to create agency')
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
        `${hierarchyBasePath('Agency')}/${encodeURIComponent(code)}`,
        payload,
      ),
    onSuccess: () => {
      showSuccessToast('Agency updated successfully')
      queryClient.invalidateQueries({ queryKey: ['master-agencies'] })
    },
    onError: (error) => {
      showErrorToast(error instanceof Error ? error.message : 'Failed to update agency')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (code: string) =>
      apiDelete<unknown>(`${hierarchyBasePath('Agency')}/${encodeURIComponent(code)}`),
    onSuccess: () => {
      showSuccessToast('Agency deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['master-agencies'] })
    },
    onError: (error) => {
      showErrorToast(error instanceof Error ? error.message : 'Failed to delete agency')
    },
  })

  const syncMutation = useMutation({
    mutationFn: syncAgencyHierarchy,
    onSuccess: async () => {
      showSuccessToast('Agency hierarchy synced successfully.')
      await queryClient.invalidateQueries({ queryKey: ['master-agencies'] })
    },
    onError: (error) => {
      showErrorToast(
        error instanceof Error ? error.message : 'Failed to sync agency hierarchy.',
      )
    },
  })

  useEffect(() => {
    if (!listQuery.isError) return
    showErrorToast(
      listQuery.error instanceof Error ? listQuery.error.message : 'Failed to load agency list',
    )
  }, [listQuery.error, listQuery.isError])

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingCode(null)
    reset(emptyHierarchyFormValues(AGENCY_FORM_FIELDS))
  }

  const onCreateOpen = () => {
    if (!canCreate) return
    setEditingCode(null)
    reset(emptyHierarchyFormValues(AGENCY_FORM_FIELDS))
    setDialogOpen(true)
  }

  const onEdit = (row: HierarchyTableRow) => {
    if (!canUpdate) return
    const code = toText(row.code)
    if (!code) {
      showErrorToast('Missing code for agency update')
      return
    }
    setEditingCode(code)
    const values = emptyHierarchyFormValues(AGENCY_FORM_FIELDS)
    values.code = toText(row.code)
    values.name = toText(row.name)
    values.description = toText(row.description === '-' ? '' : row.description)
    reset(values)
    setDialogOpen(true)
  }

  const onDeleteRequest = (row: HierarchyTableRow) => {
    if (!canDelete) return
    const code = toText(row.code)
    if (!code) {
      showErrorToast('Missing code for agency delete')
      return
    }
    setSelectedDeleteCode(code)
    setDeleteOpen(true)
  }

  const onConfirmDelete = () => {
    if (!selectedDeleteCode) return
    deleteMutation.mutate(selectedDeleteCode)
    setSelectedDeleteCode(null)
  }

  const onSubmit = (raw: HierarchyFormValues) => {
    const hasEmptyField = AGENCY_FORM_FIELDS.some(
      (field) => String(raw[field.key] ?? '').trim() === '',
    )
    if (hasEmptyField) return
    if (editingCode && !canUpdate) return
    if (!editingCode && !canCreate) return

    const payload = buildHierarchyPayload(raw)
    if (editingCode) {
      updateMutation.mutate({ code: editingCode, payload })
    } else {
      createMutation.mutate(payload)
    }
    closeDialog()
  }

  const onToggleStatus = (row: HierarchyTableRow, checked: boolean) => {
    if (!canUpdate) return
    const code = toText(row.code)
    if (!code) {
      showErrorToast('Missing code for agency status update')
      return
    }
    updateMutation.mutate({
      code,
      payload: buildHierarchyStatusPayload(row, checked),
    })
  }

  const goToDepartments = (row: HierarchyTableRow) => {
    if (!canRead) return
    const target = buildDepartmentNavigationTarget(row)
    if (!target.pathname) return
    navigate(target.pathname, { state: target.state })
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  return (
    <section className="min-w-0 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Agency"
          subtitle="Manage agency records and configurations"
        />
        {(canUpdate || canCreate) ? (
          <div className="flex w-full flex-col gap-4 sm:w-auto">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={syncMutation.isPending}
              onClick={() => syncMutation.mutate()}
            >
              <RefreshCw
                className={cn('mr-1 h-4 w-4', syncMutation.isPending && 'animate-spin')}
              />
              {syncMutation.isPending ? 'Syncing…' : 'Sync Data'}
            </Button>
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
        ) : null}
      </div>

      <Card className="min-w-0 rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="min-w-0 space-y-4 p-0">
          <div className="flex justify-end">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--fms-text-subheading)]" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder="Search agency..."
                className="pl-9"
              />
            </div>
          </div>

          <div className="w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--fms-strokes)]">
            <table className="w-max min-w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  {TABLE_COLUMNS.map((column) => (
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
                      colSpan={TABLE_COLUMNS.length + 1}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      Loading records...
                    </td>
                  </tr>
                ) : isResolved && !canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMNS.length + 1}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      You do not have permission to view this data.
                    </td>
                  </tr>
                ) : normalizedRows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMNS.length + 1}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      No records found.
                    </td>
                  </tr>
                ) : (
                  normalizedRows.map((row, rowIndex) => (
                    <tr key={`row-${rowIndex}`} className="border-t border-[var(--fms-strokes)]">
                      {TABLE_KEYS.map((key) => (
                        <td
                          key={key}
                          className="px-4 py-3 text-[var(--fms-text-subheading)]"
                        >
                          {String(row[key])}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="inline-flex items-center gap-2">
                          <Switch
                            checked={Boolean(row.active)}
                            onCheckedChange={(checked) => onToggleStatus(row, checked)}
                            disabled={!canUpdate || updateMutation.isPending}
                          />
                          <span className="text-xs text-[var(--fms-text-subheading)]">
                            {Boolean(row.active) ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className={rowActionsContainerClassName}>
                          <DetailRowActionButton
                            type="button"
                            disabled={!canRead}
                            tooltip="View Departments"
                            onClick={() => goToDepartments(row)}
                          />
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

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCode ? 'Update Agency' : 'Add New Agency'}</DialogTitle>
            <p className="text-sm text-[var(--fms-text-subheading)]">
              {editingCode
                ? 'Update the selected agency record'
                : 'Create a new agency record in the system'}
            </p>
          </DialogHeader>

          <form className="space-y-3 py-1" onSubmit={handleSubmit(onSubmit)} noValidate>
            {AGENCY_FORM_FIELDS.map((field) => {
              const rules = {
                required: `${field.label} is required`,
                validate: (v: string | undefined) =>
                  String(v ?? '').trim() !== '' || `${field.label} cannot be empty`,
              }
              const err = formState.errors[field.key]?.message as string | undefined

              return (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key}>
                    {field.label} <span className="text-[var(--fms-delete)]">*</span>
                  </Label>
                  {field.type === 'textarea' ? (
                    <textarea
                      id={field.key}
                      {...register(field.key, rules)}
                      placeholder={field.placeholder}
                      className="min-h-20 w-full rounded-md border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--fms-info-border)]"
                    />
                  ) : (
                    <Input
                      id={field.key}
                      {...register(field.key, rules)}
                      placeholder={field.placeholder}
                      aria-invalid={err ? true : undefined}
                    />
                  )}
                  {err ? <p className="text-xs text-[var(--fms-delete)]">{err}</p> : null}
                </div>
              )
            })}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || (editingCode ? !canUpdate : !canCreate)}
              >
                {editingCode ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={onConfirmDelete}
        title="Delete Record"
        description="Are you sure you want to delete this record? This action cannot be undone."
      />
    </section>
  )
}
