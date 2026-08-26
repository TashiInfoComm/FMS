import { useEffect, useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
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
  buildHierarchyPayload,
  buildHierarchyStatusPayload,
  emptyHierarchyFormValues,
  extractHierarchyList,
  hierarchyBasePath,
  type HierarchyFieldConfig,
  type HierarchyFormValues,
  type HierarchyParentField,
  type HierarchyTableRow,
  toText,
} from '@/features/master/lib/agency-hierarchy-api'
import { apiDelete, apiGet, apiPost, apiPut } from '@/services/apiClient'
import { DeleteDialog } from '@/shared/components/DeleteDialog'
import { BackToListButton } from '@/shared/components/BackToListButton'
import { PageHeader } from '@/shared/components/PageHeader'
import {
  DeleteRowActionButton,
  DetailRowActionButton,
  EditRowActionButton,
  rowActionsContainerClassName,
} from '@/shared/components/TableRowActionButtons'
import { TablePagination } from '@/shared/components/TablePagination'
import { useAgencyHierarchyPermissions } from '@/shared/hooks/useAgencyHierarchyPermissions'
import type { AgencyHierarchyTab } from '@/shared/lib/agency-sub-menu-id'
import type { HierarchyNavigationTarget } from '@/features/master/lib/agency-hierarchy-navigation'
import { applyPagination } from '@/shared/utils/pagination'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

type AgencyHierarchyCrudSectionProps = {
  level: AgencyHierarchyTab
  title: string
  subtitle: string
  columns: string[]
  tableKeys: string[]
  formFields: HierarchyFieldConfig[]
  listQueryKey: string[]
  buildListPath: (search: string, page: number, pageSize: number) => string
  parentField?: HierarchyParentField
  parentId?: string
  backLink?: { to: string; label: string; state?: unknown }
  drillDown?: {
    detailTooltip: string
    getNavigation: (row: HierarchyTableRow) => HierarchyNavigationTarget
  }
  mapRows: (records: Record<string, unknown>[], serialStart: number) => HierarchyTableRow[]
  enabled?: boolean
  parentContextName?: string
}

export function AgencyHierarchyCrudSection({
  level,
  title,
  subtitle,
  columns,
  tableKeys,
  formFields,
  listQueryKey,
  buildListPath,
  parentField,
  parentId,
  backLink,
  drillDown,
  mapRows,
  enabled = true,
  parentContextName,
}: AgencyHierarchyCrudSectionProps) {
  const { canRead, canCreate, canUpdate, canDelete, isResolved } =
    useAgencyHierarchyPermissions(level)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingCode, setEditingCode] = useState<string | null>(null)
  const [selectedDeleteCode, setSelectedDeleteCode] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const basePath = hierarchyBasePath(level)

  const { register, handleSubmit, reset, formState } = useForm<HierarchyFormValues>({
    defaultValues: emptyHierarchyFormValues(formFields),
  })

  const listQuery = useQuery({
    queryKey: [...listQueryKey, search, page, pageSize],
    enabled,
    queryFn: async () => {
      const payload = await apiGet<unknown>(buildListPath(search, page, pageSize))
      const records = extractHierarchyList(payload)
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

  const normalizedRows = useMemo(
    () =>
      (listQuery.data?.rows ?? []).map((row) => {
        const normalized: HierarchyTableRow = {}
        tableKeys.forEach((key) => {
          normalized[key] = row[key] ?? '-'
        })
        normalized.code = row.code ?? ''
        normalized.name = row.name ?? ''
        normalized.id = row.id ?? ''
        normalized.active = row.active ?? true
        return normalized
      }),
    [listQuery.data?.rows, tableKeys],
  )

  const totalCount = listQuery.data?.totalCount ?? normalizedRows.length
  const effectivePageSize = listQuery.data?.effectivePageSize ?? pageSize
  const totalPages =
    listQuery.data?.totalPages ?? Math.max(1, Math.ceil(totalCount / effectivePageSize))

  const invalidateList = () => {
    queryClient.invalidateQueries({ queryKey: listQueryKey.slice(0, 1) })
  }

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, string | number | boolean>) =>
      apiPost<unknown, Record<string, string | number | boolean>>(basePath, payload),
    onSuccess: () => {
      showSuccessToast(`${level} created successfully`)
      invalidateList()
    },
    onError: (error) => {
      showErrorToast(
        error instanceof Error ? error.message : `Failed to create ${level.toLowerCase()}`,
      )
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
        `${basePath}/${encodeURIComponent(code)}`,
        payload,
      ),
    onSuccess: () => {
      showSuccessToast(`${level} updated successfully`)
      invalidateList()
    },
    onError: (error) => {
      showErrorToast(
        error instanceof Error ? error.message : `Failed to update ${level.toLowerCase()}`,
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (code: string) =>
      apiDelete<unknown>(`${basePath}/${encodeURIComponent(code)}`),
    onSuccess: () => {
      showSuccessToast(`${level} deleted successfully`)
      invalidateList()
    },
    onError: (error) => {
      showErrorToast(
        error instanceof Error ? error.message : `Failed to delete ${level.toLowerCase()}`,
      )
    },
  })

  useEffect(() => {
    if (!listQuery.isError) return
    showErrorToast(
      listQuery.error instanceof Error
        ? listQuery.error.message
        : `Failed to load ${level.toLowerCase()} list`,
    )
  }, [level, listQuery.error, listQuery.isError])

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingCode(null)
    reset(emptyHierarchyFormValues(formFields))
  }

  const onCreateOpen = () => {
    if (!canCreate) return
    setEditingCode(null)
    reset(emptyHierarchyFormValues(formFields))
    setDialogOpen(true)
  }

  const onEdit = (row: HierarchyTableRow) => {
    if (!canUpdate) return
    const code = toText(row.code)
    if (!code) {
      showErrorToast(`Missing code for ${level.toLowerCase()} update`)
      return
    }
    setEditingCode(code)
    const values = emptyHierarchyFormValues(formFields)
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
      showErrorToast(`Missing code for ${level.toLowerCase()} delete`)
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
    const hasEmptyField = formFields.some(
      (field) => String(raw[field.key] ?? '').trim() === '',
    )
    if (hasEmptyField) return
    if (editingCode && !canUpdate) return
    if (!editingCode && !canCreate) return

    const payload = buildHierarchyPayload(raw, parentField, parentId)
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
      showErrorToast(`Missing code for ${level.toLowerCase()} status update`)
      return
    }
    updateMutation.mutate({
      code,
      payload: buildHierarchyStatusPayload(row, checked, parentField, parentId),
    })
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  const formDialogDescription = editingCode
    ? parentContextName
      ? `Updating ${level.toLowerCase()} for ${parentContextName}`
      : `Update the selected ${level.toLowerCase()} record`
    : parentContextName
      ? `Adding ${level.toLowerCase()} for ${parentContextName}`
      : `Create a new ${level.toLowerCase()} record in the system`

  return (
    <section className="min-w-0 space-y-5">
      {backLink ? <BackToListButton to={backLink.to} state={backLink.state} /> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title={title} subtitle={subtitle} />
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
                placeholder={`Search ${level.toLowerCase()}...`}
                className="pl-9"
              />
            </div>
          </div>

          <div className="w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--fms-strokes)]">
            <table className="w-max min-w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  {columns.map((column) => (
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
                      colSpan={columns.length + 1}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      Loading records...
                    </td>
                  </tr>
                ) : isResolved && !canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={columns.length + 1}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      You do not have permission to view this data.
                    </td>
                  </tr>
                ) : normalizedRows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={columns.length + 1}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      No records found.
                    </td>
                  </tr>
                ) : (
                  normalizedRows.map((row, rowIndex) => (
                    <tr key={`row-${rowIndex}`} className="border-t border-[var(--fms-strokes)]">
                      {tableKeys.map((key) => (
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
                          {drillDown ? (
                            <DetailRowActionButton
                              type="button"
                              disabled={!canRead}
                              tooltip={drillDown.detailTooltip}
                              onClick={() => {
                                const target = drillDown.getNavigation(row)
                                navigate(target.pathname, { state: target.state })
                              }}
                            />
                          ) : null}
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

          <div className="space-y-3 md:hidden">
            {listQuery.isLoading ? (
              <p className="py-6 text-center text-[var(--fms-text-subheading)]">
                Loading records...
              </p>
            ) : isResolved && !canRead ? (
              <p className="py-6 text-center text-[var(--fms-text-subheading)]">
                You do not have permission to view this data.
              </p>
            ) : (
              normalizedRows.map((row, idx) => (
                <div
                  key={`mobile-${idx}`}
                  className="rounded-lg border border-[var(--fms-strokes)] bg-white p-3"
                >
                  {tableKeys.map((key) => (
                    <p key={key} className="text-sm text-[var(--fms-text-subheading)]">
                      <span className="font-medium text-[var(--fms-text-header)]">
                        {key}:
                      </span>{' '}
                      {String(row[key])}
                    </p>
                  ))}
                  <div className="mt-2 inline-flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--fms-text-header)]">
                      Status:
                    </span>
                    <Switch
                      checked={Boolean(row.active)}
                      onCheckedChange={(checked) => onToggleStatus(row, checked)}
                      disabled={!canUpdate || updateMutation.isPending}
                    />
                    <span className="text-sm text-[var(--fms-text-subheading)]">
                      {Boolean(row.active) ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className={`mt-3 ${rowActionsContainerClassName}`}>
                    {drillDown ? (
                      <DetailRowActionButton
                        type="button"
                        disabled={!canRead}
                        tooltip={drillDown.detailTooltip}
                        onClick={() => {
                          const target = drillDown.getNavigation(row)
                          navigate(target.pathname, { state: target.state })
                        }}
                      />
                    ) : null}
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

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCode ? `Update ${level}` : `Add New ${level}`}
            </DialogTitle>
            <p className="text-sm text-[var(--fms-text-subheading)]">
              {formDialogDescription}
            </p>
          </DialogHeader>

          <form className="space-y-3 py-1" onSubmit={handleSubmit(onSubmit)} noValidate>
            {formFields.map((field) => {
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
                      className="min-h-20 w-full rounded-md border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--fms-info-border)] aria-invalid:border-[var(--fms-delete)]"
                      aria-invalid={err ? true : undefined}
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
