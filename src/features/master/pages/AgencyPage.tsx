// Manages agency hierarchy master data from API-backed CRUD endpoints.
import { useEffect, useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { apiDelete, apiGet, apiPost, apiPut } from '@/services/apiClient'
import { DeleteDialog } from '@/shared/components/DeleteDialog'
import { PageHeader } from '@/shared/components/PageHeader'
import {
  DeleteRowActionButton,
  EditRowActionButton,
  rowActionsContainerClassName,
} from '@/shared/components/TableRowActionButtons'
import { TablePagination } from '@/shared/components/TablePagination'
import { useAgencyHierarchyPermissions } from '@/shared/hooks/useAgencyHierarchyPermissions'
import { applyPagination } from '@/shared/utils/pagination'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

const tabs = ['Agency', 'Department', 'Division', 'Sub-Division'] as const
type AgencyTab = (typeof tabs)[number]

type ApiRecord = Record<string, unknown>
type TableRow = Record<string, string | number | boolean>
type FormValues = Record<string, string>
type SelectOption = { value: string; label: string }

type FieldConfig = {
  key: string
  label: string
  type: 'text' | 'textarea' | 'select'
  placeholder?: string
}

type TabConfig = {
  title: string
  subtitle: string
  columns: string[]
  tableKeys: string[]
  formFields: FieldConfig[]
}

const tabConfig: Record<AgencyTab, TabConfig> = {
  Agency: {
    title: 'Agency',
    subtitle: 'Manage agency records and configurations',
    columns: ['Sl.No', 'Agency Name', 'Short Name', 'Description', 'Status', ],
    tableKeys: ['serialNo', 'agencyName', 'shortName', 'description'],
    formFields: [
      { key: 'code', label: 'Short Name', type: 'text', placeholder: 'Enter short name' },
      { key: 'name', label: 'Agency Name', type: 'text', placeholder: 'Enter agency name' },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Enter description for this agency' },
    ],
  },
  Department: {
    title: 'Department',
    subtitle: 'Manage department records and configurations',
    columns: ['Sl.No', 'Department Name', 'Agency', 'Description', 'Status', ],
    tableKeys: ['serialNo', 'departmentName', 'agency', 'description'],
    formFields: [
      { key: 'code', label: 'Department Code', type: 'text', placeholder: 'Enter department code' },
      { key: 'name', label: 'Department Name', type: 'text', placeholder: 'Enter department name' },
      { key: 'agencyId', label: 'Agency', type: 'select', placeholder: 'Select agency' },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Enter description for this department' },
    ],
  },
  Division: {
    title: 'Division',
    subtitle: 'Manage division records and configurations',
    columns: ['Sl.No', 'Division', 'Department', 'Agency', 'Description', 'Status', ],
    tableKeys: ['serialNo', 'division', 'department', 'agency', 'description'],
    formFields: [
      { key: 'code', label: 'Division Code', type: 'text', placeholder: 'Enter division code' },
      { key: 'name', label: 'Division Name', type: 'text', placeholder: 'Enter division name' },
      { key: 'departmentId', label: 'Department', type: 'select', placeholder: 'Select department' },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Enter description for this division' },
    ],
  },
  'Sub-Division': {
    title: 'Sub-Division',
    subtitle: 'Manage sub-division records and configurations',
    columns: ['Sl.No', 'Sub-Division', 'Division', 'Department', 'Agency', 'Description', 'Status', ],
    tableKeys: ['serialNo', 'subDivision', 'division', 'department', 'agency', 'description'],
    formFields: [
      { key: 'code', label: 'Sub-Division Code', type: 'text', placeholder: 'Enter sub-division code' },
      { key: 'name', label: 'Sub-Division Name', type: 'text', placeholder: 'Enter sub-division name' },
      { key: 'divisionId', label: 'Division', type: 'select', placeholder: 'Select division' },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Enter description for this sub-division' },
    ],
  },
}

function emptyFormValues(fields: FieldConfig[]) {
  return Object.fromEntries(fields.map((field) => [field.key, '']))
}

function toText(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function toId(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return ''
}

function toObject(value: unknown): ApiRecord | undefined {
  return value && typeof value === 'object' ? (value as ApiRecord) : undefined
}

function readName(source: unknown) {
  const obj = toObject(source)
  if (!obj) return '-'
  const name = toText(obj.name).trim()
  if (name) return name
  const label = toText(obj.label).trim()
  if (label) return label
  return '-'
}

function readId(source: unknown) {
  const obj = toObject(source)
  if (!obj) return ''
  return toId(obj.id)
}

function extractList(payload: unknown): ApiRecord[] {
  if (Array.isArray(payload)) return payload.filter((item): item is ApiRecord => !!item && typeof item === 'object')
  if (!payload || typeof payload !== 'object') return []
  const root = payload as Record<string, unknown>
  const candidates = [
    root.items,
    root.results,
    root.data,
    (root.data as Record<string, unknown> | undefined)?.items,
    (root.data as Record<string, unknown> | undefined)?.results,
    (root.data as Record<string, unknown> | undefined)?.records,
  ]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is ApiRecord => !!item && typeof item === 'object')
    }
  }
  return []
}

function getListPath(tab: AgencyTab, search: string, page: number, pageSize: number) {
  const q = encodeURIComponent(search.trim())
  if (tab === 'Agency') return `/master/agencies?page=${page}&page_size=${pageSize}&search=${q}`
  if (tab === 'Department') return `/master/departments?page=${page}&page_size=${pageSize}&code=&search=${q}`
  if (tab === 'Division') return `/master/divisions?page=${page}&page_size=${pageSize}&search=${q}`
  return `/master/sub-divisions?page=${page}&page_size=${pageSize}&search=${q}`
}

function getBasePath(tab: AgencyTab) {
  if (tab === 'Agency') return '/master/agencies'
  if (tab === 'Department') return '/master/departments'
  if (tab === 'Division') return '/master/divisions'
  return '/master/sub-divisions'
}

function mapApiRows(tab: AgencyTab, records: ApiRecord[], serialStart: number): TableRow[] {
  return records.map((item, index) => {
    const serialNo = serialStart + index + 1
    const id = toId(item.id) || String(index + 1)
    const code = toText(item.code)
    const name = toText(item.name)
    const description = toText(item.description)
    const active = typeof item.active === 'boolean' ? item.active : item.active === 1 || item.active === '1'

    if (tab === 'Agency') {
      return {
        serialNo,
        id,
        code,
        name,
        agencyName: name || '-',
        shortName: code || '-',
        description: description || '-',
        active,
      } as TableRow
    }

    if (tab === 'Department') {
      const agencyObj = toObject(item.agency) ?? toObject(item.parent_agency)
      const agencyId = toId(item.agency_id) || readId(agencyObj)
      const agencyName = toText(item.agency_name) || readName(agencyObj)
      return {
        serialNo,
        id,
        code,
        name,
        agencyId,
        departmentName: name || '-',
        agency: agencyName,
        description: description || '-',
        active,
      } as TableRow
    }

    if (tab === 'Division') {
      const departmentObj = toObject(item.department) ?? toObject(item.parent_department)
      const agencyObj = toObject(item.agency) ?? toObject(departmentObj?.agency)
      const departmentId = toId(item.department_id) || readId(departmentObj)
      const departmentName = toText(item.department_name) || readName(departmentObj)
      const agencyName = toText(item.agency_name) || readName(agencyObj)
      return {
        serialNo,
        id,
        code,
        name,
        departmentId,
        division: name || '-',
        department: departmentName,
        agency: agencyName,
        description: description || '-',
        active,
      } as TableRow
    }

    const divisionObj = toObject(item.division) ?? toObject(item.parent_division)
    const departmentObj = toObject(item.department) ?? toObject(divisionObj?.department)
    const agencyObj = toObject(item.agency) ?? toObject(departmentObj?.agency)
    const divisionId = toId(item.division_id) || readId(divisionObj)
    const divisionName = toText(item.division_name) || readName(divisionObj)
    const departmentName = toText(item.department_name) || readName(departmentObj)
    const agencyName = toText(item.agency_name) || readName(agencyObj)

    return {
      serialNo,
      id,
      code,
      name,
      divisionId,
      subDivision: name || '-',
      division: divisionName,
      department: departmentName,
      agency: agencyName,
      description: description || '-',
      active,
    } as TableRow
  })
}

function toSelectOptions(records: ApiRecord[]): SelectOption[] {
  return records
    .map((item) => {
      const value = toId(item.id)
      const label = toText(item.name).trim()
      return { value, label }
    })
    .filter((option) => option.value && option.label)
}

function buildPayload(tab: AgencyTab, form: FormValues) {
  const common = {
    code: form.code.trim(),
    name: form.name.trim(),
    description: form.description.trim(),
    display_order: 1,
    active: true,
  }
  if (tab === 'Agency') return common
  if (tab === 'Department') return { ...common, agency_id: form.agencyId }
  if (tab === 'Division') return { ...common, department_id: form.departmentId }
  return { ...common, division_id: form.divisionId }
}

function buildStatusUpdatePayload(tab: AgencyTab, row: TableRow, active: boolean) {
  const common = {
    code: toText(row.code).trim(),
    name: toText(row.name).trim(),
    description: toText(row.description === '-' ? '' : row.description).trim(),
    display_order: 1,
    active,
  }
  if (tab === 'Agency') return common
  if (tab === 'Department') return { ...common, agency_id: toText(row.agencyId) }
  if (tab === 'Division') return { ...common, department_id: toText(row.departmentId) }
  return { ...common, division_id: toText(row.divisionId) }
}

/**
 * Hierarchical master data: Agency → Department → Division → Sub-Division tabs share one page,
 * switching list endpoints and form fields via `tabConfig` while reusing the same dialog/delete flow.
 */
export function AgencyPage() {
  const [activeTab, setActiveTab] = useState<AgencyTab>('Agency')
  const { canRead, canCreate, canUpdate, canDelete, isResolved } = useAgencyHierarchyPermissions(activeTab)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingCode, setEditingCode] = useState<string | null>(null)
  const [selectedDeleteCode, setSelectedDeleteCode] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const config = tabConfig[activeTab]
  const isWideHierarchyTab = activeTab
  const { register, handleSubmit, reset, formState } = useForm<FormValues>({
    defaultValues: emptyFormValues(config.formFields),
  })

  useEffect(() => {
    reset(emptyFormValues(config.formFields))
    setEditingCode(null)
    setPage(1)
  }, [activeTab, config.formFields, reset])

  const listQuery = useQuery({
    queryKey: ['master-agency-page', activeTab, search, page, pageSize],
    queryFn: async () => {
      const payload = await apiGet<unknown>(getListPath(activeTab, search, page, pageSize))
      const records = extractList(payload)
      const paged = applyPagination(payload, records, page, pageSize, { page, pageSize, pageLength: records.length })
      const rows = mapApiRows(activeTab, paged.rows, paged.serialBase)
      return {
        rows,
        totalCount: paged.totalCount,
        totalPages: paged.totalPages,
        effectivePageSize: paged.effectivePageSize,
      }
    },
  })

  const agenciesQuery = useQuery({
    queryKey: ['master-agency-options', 'agency'],
    queryFn: async () => {
      const payload = await apiGet<unknown>('/master/agencies?active=true')
      return toSelectOptions(extractList(payload))
    },
  })

  const departmentsQuery = useQuery({
    queryKey: ['master-agency-options', 'department'],
    queryFn: async () => {
      const payload = await apiGet<unknown>('/master/departments?active=true&page=1&page_size=200')
      return toSelectOptions(extractList(payload))
    },
  })

  const divisionsQuery = useQuery({
    queryKey: ['master-agency-options', 'division'],
    queryFn: async () => {
      const payload = await apiGet<unknown>('/master/divisions?active=true')
      return toSelectOptions(extractList(payload))
    },
  })

  const selectOptionsByField = useMemo<Record<string, SelectOption[]>>(
    () => ({
      agencyId: agenciesQuery.data ?? [],
      departmentId: departmentsQuery.data ?? [],
      divisionId: divisionsQuery.data ?? [],
    }),
    [agenciesQuery.data, departmentsQuery.data, divisionsQuery.data],
  )

  const normalizedRows = useMemo(
    () =>
      (listQuery.data?.rows ?? []).map((row) => {
        const normalized: TableRow = {}
        config.tableKeys.forEach((key) => {
          normalized[key] = row[key] ?? '-'
        })
        normalized.code = row.code ?? ''
        normalized.name = row.name ?? ''
        normalized.agencyId = row.agencyId ?? ''
        normalized.departmentId = row.departmentId ?? ''
        normalized.divisionId = row.divisionId ?? ''
        normalized.active = row.active ?? true
        return normalized
      }),
    [config.tableKeys, listQuery.data?.rows],
  )
  const totalCount = listQuery.data?.totalCount ?? normalizedRows.length
  const effectivePageSize = listQuery.data?.effectivePageSize ?? pageSize
  const totalPages = listQuery.data?.totalPages ?? Math.max(1, Math.ceil(totalCount / effectivePageSize))

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, string | number | boolean>) =>
      apiPost<unknown, Record<string, string | number | boolean>>(getBasePath(activeTab), payload),
    onSuccess: () => {
      showSuccessToast(`${activeTab} created successfully`)
      queryClient.invalidateQueries({ queryKey: ['master-agency-page', activeTab] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : `Failed to create ${activeTab.toLowerCase()}`
      showErrorToast(message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ code, payload }: { code: string; payload: Record<string, string | number | boolean> }) =>
      apiPut<unknown, Record<string, string | number | boolean>>(
        `${getBasePath(activeTab)}/${encodeURIComponent(code)}`,
        payload,
      ),
    onSuccess: () => {
      showSuccessToast(`${activeTab} updated successfully`)
      queryClient.invalidateQueries({ queryKey: ['master-agency-page', activeTab] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : `Failed to update ${activeTab.toLowerCase()}`
      showErrorToast(message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (code: string) => apiDelete<unknown>(`${getBasePath(activeTab)}/${encodeURIComponent(code)}`),
    onSuccess: () => {
      showSuccessToast(`${activeTab} deleted successfully`)
      queryClient.invalidateQueries({ queryKey: ['master-agency-page', activeTab] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : `Failed to delete ${activeTab.toLowerCase()}`
      showErrorToast(message)
    },
  })

  useEffect(() => {
    if (!listQuery.isError) return
    const message = listQuery.error instanceof Error ? listQuery.error.message : `Failed to load ${activeTab.toLowerCase()} list`
    showErrorToast(message)
  }, [activeTab, listQuery.error, listQuery.isError])

  const onCreateOpen = () => {
    if (!canCreate) return
    setEditingCode(null)
    reset(emptyFormValues(config.formFields))
    setDialogOpen(true)
  }

  const onEdit = (row: TableRow) => {
    if (!canUpdate) return
    const code = toText(row.code)
    if (!code) {
      showErrorToast(`Missing code for ${activeTab.toLowerCase()} update`)
      return
    }
    setEditingCode(code)
    const values = emptyFormValues(config.formFields)
    values.code = toText(row.code)
    values.name = toText(row.name)
    values.description = toText(row.description === '-' ? '' : row.description)
    values.agencyId = toText(row.agencyId)
    values.departmentId = toText(row.departmentId)
    values.divisionId = toText(row.divisionId)
    reset(values)
    setDialogOpen(true)
  }

  const onDeleteRequest = (row: TableRow) => {
    if (!canDelete) return
    const code = toText(row.code)
    if (!code) {
      showErrorToast(`Missing code for ${activeTab.toLowerCase()} delete`)
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

  const onSubmit = (raw: FormValues) => {
    const hasEmptyField = config.formFields.some((field) => String(raw[field.key] ?? '').trim() === '')
    if (hasEmptyField) return
    if (editingCode && !canUpdate) return
    if (!editingCode && !canCreate) return

    const payload = buildPayload(activeTab, raw)
    if (editingCode) {
      updateMutation.mutate({ code: editingCode, payload })
    } else {
      createMutation.mutate(payload)
    }
    setDialogOpen(false)
    setEditingCode(null)
    reset(emptyFormValues(config.formFields))
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  const onToggleStatus = (row: TableRow, checked: boolean) => {
    if (!canUpdate) return
    const code = toText(row.code)
    if (!code) {
      showErrorToast(`Missing code for ${activeTab.toLowerCase()} status update`)
      return
    }
    updateMutation.mutate({ code, payload: buildStatusUpdatePayload(activeTab, row, checked) })
  }

  return (
    <section className="min-w-0 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title={config.title} subtitle={config.subtitle} />
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingCode(null);
              reset(emptyFormValues(config.formFields));
            }
          }}
        >
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
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="flex items-start justify-between">
                <div>
                  <DialogTitle>
                    {editingCode
                      ? `Update ${activeTab}`
                      : `Add New ${activeTab}`}
                  </DialogTitle>
                  <p className="mt-1 text-sm text-[var(--fms-text-subheading)]">
                    {editingCode
                      ? `Update the selected ${activeTab.toLowerCase()} record`
                      : `Create a new ${activeTab.toLowerCase()} record in the system`}
                  </p>
                </div>
              </div>
            </DialogHeader>

            <form
              className="space-y-3 py-1"
              onSubmit={handleSubmit(onSubmit)}
              noValidate
            >
              {config.formFields.map((field) => {
                const rules = {
                  required: `${field.label} is required`,
                  validate: (v: string | undefined) =>
                    String(v ?? "").trim() !== "" ||
                    `${field.label} cannot be empty`,
                };
                const err = formState.errors[field.key]?.message as
                  | string
                  | undefined;
                const options = selectOptionsByField[field.key] ?? [];
                return (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={field.key}>
                      {field.label}{" "}
                      <span className="text-[var(--fms-delete)]">*</span>
                    </Label>
                    {field.type === "select" ? (
                      <select
                        id={field.key}
                        {...register(field.key, rules)}
                        className="h-10 w-full rounded-md border border-[var(--fms-strokes)] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--fms-info-border)] aria-invalid:border-[var(--fms-delete)]"
                        aria-invalid={err ? true : undefined}
                      >
                        <option value="">
                          {field.placeholder ??
                            `Select ${field.label.toLowerCase()}`}
                        </option>
                        {options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : field.type === "textarea" ? (
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
                    {err ? (
                      <p className="text-xs text-[var(--fms-delete)]">{err}</p>
                    ) : null}
                  </div>
                );
              })}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    reset(emptyFormValues(config.formFields));
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    isSubmitting || (editingCode ? !canUpdate : !canCreate)
                  }
                >
                  {editingCode ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="inline-flex w-full max-w-full overflow-x-auto rounded-md bg-[#e8ebf0] p-1 sm:w-auto">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={
              tab === activeTab
                ? "whitespace-nowrap rounded-sm bg-white px-3 py-1.5 text-sm text-[var(--fms-text-header)] shadow-xs"
                : "whitespace-nowrap rounded-sm px-3 py-1.5 text-sm text-[var(--fms-text-subheading)]"
            }
          >
            {tab}
          </button>
        ))}
      </div>

      <Card className="min-w-0 rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="min-w-0 space-y-4 p-0">
          <div className="flex justify-end">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--fms-text-subheading)]" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder={`Search ${activeTab.toLowerCase()}...`}
                className="pl-9"
              />
            </div>
          </div>

          <div className="hidden w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
            <table
              className={cn(
                "text-sm",
                isWideHierarchyTab ? "w-max min-w-full" : "min-w-full",
              )}
            >
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  {config.columns.map((column) => (
                    <th
                      key={column}
                      className="px-4 py-3 text-left font-semibold"
                    >
                      {column}
                    </th>
                  ))}
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
                      colSpan={config.columns.length}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      Loading records...
                    </td>
                  </tr>
                ) : isResolved && !canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={config.columns.length}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      You do not have permission to view this data.
                    </td>
                  </tr>
                ) : normalizedRows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={config.columns.length}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      No records found.
                    </td>
                  </tr>
                ) : (
                  normalizedRows.map((row, rowIndex) => (
                    <tr
                      key={`row-${rowIndex}`}
                      className="border-t border-[var(--fms-strokes)]"
                    >
                      {config.tableKeys.map((key) => (
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
                            onCheckedChange={(checked) =>
                              onToggleStatus(row, checked)
                            }
                            disabled={!canUpdate || updateMutation.isPending}
                          />
                          <span className="text-xs text-[var(--fms-text-subheading)]">
                            {Boolean(row.active) ? "Active" : "Inactive"}
                          </span>
                        </div>
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
                  {config.tableKeys.map((key) => (
                    <p
                      key={key}
                      className="text-sm text-[var(--fms-text-subheading)]"
                    >
                      <span className="font-medium text-[var(--fms-text-header)]">
                        {key}:
                      </span>{" "}
                      {String(row[key])}
                    </p>
                  ))}
                  <div className="mt-2 inline-flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--fms-text-header)]">
                      Status:
                    </span>
                    <Switch
                      checked={Boolean(row.active)}
                      onCheckedChange={(checked) =>
                        onToggleStatus(row, checked)
                      }
                      disabled={!canUpdate || updateMutation.isPending}
                    />
                    <span className="text-sm text-[var(--fms-text-subheading)]">
                      {Boolean(row.active) ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className={`mt-3 ${rowActionsContainerClassName}`}>
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
        title="Delete Record"
        description="Are you sure you want to delete this record? This action cannot be undone."
      />
    </section>
  );
}
