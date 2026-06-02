import { useEffect, useMemo, useState } from 'react'
import { Check, Plus, RotateCcw, X } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { fetchHierarchyById } from '@/features/settings/lib/hierarchy-api'
import {
  createHierarchyLevel,
  fetchHierarchyLevelById,
  fetchUserSelectOptions,
  toHierarchyLevelPayload,
  updateHierarchyLevel,
} from '@/features/settings/lib/hierarchy-level-api'
import { fetchApprovingAuthoritiesPage } from '@/features/settings/lib/approving-authority-api'
import { PageHeader } from '@/shared/components/PageHeader'
import { SearchableAutocomplete } from '@/shared/components/SearchableAutocomplete'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

const LIST_QUERY_KEY = 'workflows/hierarchy-levels'

const HIERARCHY_LEVEL_OPTIONS = [
  { name: 'Level 1', value: 'Level 1' },
  { name: 'Level 2', value: 'Level 2' },
  { name: 'Level 3', value: 'Level 3' },
] as const

type LevelFormRow = {
  key: string
  level: string
  approvingAuthorityId: string
  userId: string
  startDate: string
  endDate: string
  sequence: number
  isActive: boolean
}

function newRowKey() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `row-${Date.now()}-${Math.random()}`
}

function emptyRow(sequence: number): LevelFormRow {
  return {
    key: newRowKey(),
    level: '',
    approvingAuthorityId: '',
    userId: '',
    startDate: '',
    endDate: '',
    sequence,
    isActive: true,
  }
}

function recordToRow(record: {
  level: string
  approvingAuthorityId: string
  userId: string
  startDate: string
  endDate: string
  sequence: number
  isActive: boolean
}): LevelFormRow {
  return {
    key: newRowKey(),
    level: record.level,
    approvingAuthorityId: record.approvingAuthorityId,
    userId: record.userId,
    startDate: record.startDate,
    endDate: record.endDate,
    sequence: record.sequence,
    isActive: record.isActive,
  }
}

function validateRows(rows: LevelFormRow[]) {
  for (const row of rows) {
    if (!row.level.trim()) return 'Level is required for each row'
    if (!row.approvingAuthorityId.trim()) return 'Approver is required for each row'
    if (!row.startDate.trim()) return 'Start date is required for each row'
    if (!Number.isFinite(row.sequence)) return 'Sequence must be a valid number'
  }
  return null
}

function HierarchyLevelFormPage() {
  const { hierarchyId: routeHierarchyId = '', levelId: routeLevelId = '' } = useParams<{
    hierarchyId: string
    levelId: string
  }>()
  const hierarchyId = routeHierarchyId.trim()
  const levelId = routeLevelId.trim()
  const isEdit = Boolean(levelId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const crud = useRouteCrudPermissions('/settings/hierarchy')
  const canCreate = !crud.isResolved || crud.canCreate
  const canUpdate = !crud.isResolved || crud.canUpdate
  const canRead = !crud.isResolved || crud.canRead
  const freezeEditing = crud.isResolved && !(isEdit ? canUpdate : canCreate)

  const levelsListPath = `/settings/hierarchy/${encodeURIComponent(hierarchyId)}/levels`

  const [rows, setRows] = useState<LevelFormRow[]>(() => [emptyRow(1)])

  const hierarchyQuery = useQuery({
    queryKey: ['workflows/hierarchy-lookup', hierarchyId],
    queryFn: () => fetchHierarchyById(hierarchyId),
    enabled: canRead && Boolean(hierarchyId),
  })

  const detailQuery = useQuery({
    queryKey: ['workflows/hierarchy-level', hierarchyId, levelId],
    queryFn: () => fetchHierarchyLevelById(hierarchyId, levelId),
    enabled: isEdit && canRead && Boolean(hierarchyId) && Boolean(levelId),
  })

  const authoritiesQuery = useQuery({
    queryKey: ['workflows/approving-authorities-options'],
    queryFn: () => fetchApprovingAuthoritiesPage('', 1, 100),
    staleTime: 60_000,
    enabled: canRead,
  })

  const usersQuery = useQuery({
    queryKey: ['admin-users-select-options'],
    queryFn: () => fetchUserSelectOptions(),
    staleTime: 60_000,
    enabled: canRead,
  })

  const authorityOptions = useMemo(
    () =>
      (authoritiesQuery.data?.rows ?? []).map((row) => ({
        value: row.id,
        label: row.name,
        searchText: row.name,
      })),
    [authoritiesQuery.data?.rows],
  )

  const authorityById = useMemo(() => {
    const map = new Map<string, { hasEmployeeField: boolean }>()
    for (const row of authoritiesQuery.data?.rows ?? []) {
      map.set(row.id, { hasEmployeeField: row.hasEmployeeField })
    }
    return map
  }, [authoritiesQuery.data?.rows])

  const rowRequiresEmployee = (approvingAuthorityId: string) => {
    const id = approvingAuthorityId.trim()
    if (!id) return false
    return authorityById.get(id)?.hasEmployeeField ?? false
  }

  const userOptions = useMemo(() => usersQuery.data ?? [], [usersQuery.data])

  useEffect(() => {
    if (!isEdit || !detailQuery.data) return
    setRows([recordToRow(detailQuery.data)])
  }, [isEdit, detailQuery.data])

  const saveMutation = useMutation({
    mutationFn: async (formRows: LevelFormRow[]) => {
      if (isEdit) {
        const row = formRows[0]
        return updateHierarchyLevel(
          hierarchyId,
          levelId,
          toHierarchyLevelPayload({
            approvingAuthorityId: row.approvingAuthorityId,
            level: row.level,
            sequence: row.sequence,
            startDate: row.startDate,
            userId: row.userId,
            endDate: row.endDate,
            isActive: row.isActive,
          }),
        )
      }

      for (const row of formRows) {
        await createHierarchyLevel(
          hierarchyId,
          toHierarchyLevelPayload({
            approvingAuthorityId: row.approvingAuthorityId,
            level: row.level,
            sequence: row.sequence,
            startDate: row.startDate,
            userId: row.userId,
            endDate: row.endDate,
            isActive: row.isActive,
          }),
        )
      }
    },
    onSuccess: () => {
      showSuccessToast(
        isEdit ? 'Hierarchy level updated successfully' : 'Hierarchy level(s) created successfully',
      )
      queryClient.invalidateQueries({ queryKey: [LIST_QUERY_KEY, hierarchyId] })
      navigate(levelsListPath)
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : 'Failed to save hierarchy level'
      showErrorToast(message)
    },
  })

  const addRow = () => {
    setRows((prev) => [...prev, emptyRow(prev.length + 1)])
  }

  const removeRow = (key: string) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((row) => row.key !== key)
    })
  }

  const updateRow = (key: string, patch: Partial<LevelFormRow>) => {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  const onSave = () => {
    if (freezeEditing) return
    const validationError = validateRows(rows)
    if (validationError) {
      showErrorToast(validationError)
      return
    }
    saveMutation.mutate(rows)
  }

  const hierarchyName = hierarchyQuery.data?.name || 'Hierarchy'

  if (!hierarchyId) {
    return (
      <section className="space-y-5">
        <PageHeader title="Hierarchy Level" subtitle="Invalid hierarchy." />
        <Button variant="outline" asChild>
          <Link to="/settings/hierarchy">Back to Hierarchy</Link>
        </Button>
      </section>
    )
  }

  if (isEdit && detailQuery.isLoading) {
    return (
      <section className="space-y-5">
        <PageHeader title="Update Hierarchy Level" subtitle="Loading…" />
        <p className="text-sm text-[var(--fms-text-subheading)]">Loading level details…</p>
      </section>
    )
  }

  if (isEdit && detailQuery.isError) {
    return (
      <section className="space-y-5">
        <PageHeader title="Update Hierarchy Level" />
        <p className="text-sm text-[var(--fms-delete)]">Failed to load hierarchy level.</p>
        <Button variant="outline" asChild>
          <Link to={levelsListPath}>Back to levels</Link>
        </Button>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <PageHeader
        title={isEdit ? 'Update Hierarchy Level' : 'Add Hierarchy Levels'}
        subtitle={`${isEdit ? 'Edit' : 'Configure'} approval levels for ${hierarchyName}`}
      />

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white">
        <CardContent className="space-y-4 pt-5">
          <div className="overflow-x-auto rounded-lg border border-[var(--fms-strokes)]">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  <th className="w-12 px-2 py-2 text-center font-semibold">Sl.No</th>
                  <th className="w-10 px-2 py-2 text-center font-semibold" aria-label="Remove row" />
                  <th className="px-2 py-2 text-left font-semibold">
                    LEVEL <span className="text-[var(--fms-delete)]">*</span>
                  </th>
                  <th className="min-w-[10rem] px-2 py-2 text-left font-semibold">APPROVER</th>
                  <th className="min-w-[12rem] px-2 py-2 text-left font-semibold">EMPLOYEE</th>
                  <th className="min-w-[9rem] px-2 py-2 text-left font-semibold">START DATE</th>
                  <th className="min-w-[9rem] px-2 py-2 text-left font-semibold">END DATE</th>
                  <th className="w-24 px-2 py-2 text-left font-semibold">SEQUENCE</th>
                  <th className="min-w-[8rem] px-2 py-2 text-left font-semibold">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.key} className="border-t border-[var(--fms-strokes)]">
                    <td className="px-2 py-2 text-center align-middle tabular-nums text-[var(--fms-text-subheading)]">
                      {index + 1}
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon-xs"
                        className="shrink-0"
                        onClick={() => removeRow(row.key)}
                        aria-label="Remove row"
                        disabled={freezeEditing || (isEdit && rows.length === 1)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <Select
                        value={row.level || undefined}
                        onValueChange={(value) => updateRow(row.key, { level: value })}
                        disabled={freezeEditing}
                      >
                        <SelectTrigger className="w-full min-w-[120px]">
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                        <SelectContent>
                          {HIERARCHY_LEVEL_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <SearchableAutocomplete
                        value={row.approvingAuthorityId}
                        onChange={(value) => {
                          const requiresEmployee = rowRequiresEmployee(value)
                          updateRow(row.key, {
                            approvingAuthorityId: value,
                            ...(requiresEmployee ? {} : { userId: '' }),
                          })
                        }}
                        options={authorityOptions}
                        placeholder="Select approver"
                        loading={authoritiesQuery.isLoading}
                        disabled={freezeEditing || authoritiesQuery.isError}
                      />
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <SearchableAutocomplete
                        value={row.userId}
                        onChange={(value) => updateRow(row.key, { userId: value })}
                        options={userOptions}
                        placeholder={
                          rowRequiresEmployee(row.approvingAuthorityId)
                            ? 'Select employee'
                            : 'Not applicable'
                        }
                        loading={usersQuery.isLoading}
                        disabled={
                          freezeEditing ||
                          usersQuery.isError ||
                          !rowRequiresEmployee(row.approvingAuthorityId)
                        }
                      />
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <Input
                        type="date"
                        value={row.startDate}
                        onChange={(e) => updateRow(row.key, { startDate: e.target.value })}
                        disabled={freezeEditing}
                      />
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <Input
                        type="date"
                        value={row.endDate}
                        onChange={(e) => updateRow(row.key, { endDate: e.target.value })}
                        disabled={freezeEditing}
                      />
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <Input
                        type="number"
                        min={0}
                        value={Number.isFinite(row.sequence) ? row.sequence : ''}
                        onChange={(e) =>
                          updateRow(row.key, {
                            sequence: Number.parseInt(e.target.value, 10) || 0,
                          })
                        }
                        placeholder="Enter"
                        disabled={freezeEditing}
                      />
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <Select
                        value={row.isActive ? 'active' : 'inactive'}
                        onValueChange={(value) =>
                          updateRow(row.key, { isActive: value === 'active' })
                        }
                        disabled={freezeEditing}
                      >
                        <SelectTrigger className="w-full min-w-[7rem]">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!isEdit ? (
            <div className="flex justify-end bg-[#f0f4f8] px-3 py-3">
              <Button
                type="button"
                className="bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)]"
                onClick={addRow}
                disabled={freezeEditing}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add New Row
              </Button>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--fms-strokes)] pt-4">
            <Button
              type="button"
              className="bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)]"
              onClick={onSave}
              disabled={saveMutation.isPending || freezeEditing}
            >
              <Check className="mr-2 h-4 w-4" />
              {saveMutation.isPending ? 'Saving...' : 'SAVE'}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={saveMutation.isPending}
              onClick={() => navigate(levelsListPath)}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              CANCEL
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

export default HierarchyLevelFormPage
