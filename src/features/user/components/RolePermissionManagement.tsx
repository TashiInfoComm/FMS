/**
 * `/admin/roles` management: list (`ViewMode` list), inline read-only matrix (`detail`), or editable matrix (`edit`) with
 * `POST /admin/roles/bulk` and optional role delete. Shares menu grouping helpers with `roles-api`.
 */
import { ArrowLeft, Check, Search, X } from 'lucide-react'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { apiDelete, apiGet, apiPost } from '@/services/apiClient'
import {
  mapMenuRecord,
  menusToArray,
  type ApiRecord,
  type MenuRecord,
} from '@/features/modules/lib/menus-api'
import {
  assignedSetFromRoleActions,
  buildBulkPayload,
  collectMatrixColumnCodes,
  defaultActions,
  fetchRoleDetail,
  flatSubMenusFromGroups,
  groupMenusForPermissionMatrix,
  mapRoleListRecord,
  normalizeActionCode,
  resolveAvailableActionsForSubMenu,
  rolesToArray,
  type MenuPermissionGroup,
  type RoleListRow,
} from '@/features/user/lib/roles-api'
import { DeleteDialog } from '@/shared/components/DeleteDialog'
import { PageHeader } from '@/shared/components/PageHeader'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import {
  DeleteRowActionButton,
  DetailRowActionButton,
  EditRowActionButton,
  rowActionsContainerClassName,
} from '@/shared/components/TableRowActionButtons'
import { TablePagination } from '@/shared/components/TablePagination'
import { formatRealmRoleDisplayName } from '@/shared/lib/format-realm-role-display'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'
import { applyPagination } from '@/shared/utils/pagination'

type ViewMode = 'list' | 'detail' | 'edit'

const ROLE_LIST_SKELETON_CAP = 8

function RoleListTableSkeletonBody({ rowCount }: { rowCount: number }) {
  return (
    <>
      {Array.from({ length: rowCount }).map((_, i) => (
        <tr key={`role-rp-sk-${i}`} className="border-t border-[var(--fms-strokes)]">
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-8" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-[min(100%,14rem)]" />
          </td>
          <td className="px-4 py-3">
            <div className="flex justify-center gap-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-14" />
              <Skeleton className="h-8 w-8" />
            </div>
          </td>
        </tr>
      ))}
    </>
  )
}

function RoleListMobileSkeleton({ rowCount }: { rowCount: number }) {
  return (
    <>
      {Array.from({ length: rowCount }).map((_, i) => (
        <div
          key={`role-rp-m-sk-${i}`}
          className="space-y-2 rounded-lg border border-[var(--fms-strokes)] bg-white p-3"
        >
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-full max-w-xs" />
          <div className="flex flex-wrap gap-2 pt-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-14" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
      ))}
    </>
  )
}

/** URL for paginated role list; skips empty search. */
function listPath(search: string, page: number, pageSize: number) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('page_size', String(pageSize))
  const q = search.trim()
  if (q) params.set('search', q)
  return `/admin/roles?${params.toString()}`
}

/** Serial + `mapRoleListRecord` for Sl.No / name / description columns. */
function mapRows(records: ReturnType<typeof rolesToArray>, serialBase: number): RoleListRow[] {
  return records.map((record, index) => {
    const m = mapRoleListRecord(record)
    return {
      serialNo: serialBase + index + 1,
      roleName: m.roleName,
      description: m.description,
    }
  })
}

/** Global menu tree for grouping sub-menus in the permission matrix. */
async function fetchAllMenus(): Promise<MenuRecord[]> {
  const payload = await apiGet<unknown>('/admin/menus')
  const records = menusToArray(payload)
    .map((r, i) => mapMenuRecord(r as ApiRecord, i))
    .filter((m): m is MenuRecord => m !== null)
  return records.sort((a, b) => a.display_order - b.display_order)
}

/** Humanizes action code for tooltips / secondary labels (underscores → spaces). */
function actionDisplayLabel(code: string) {
  return normalizeActionCode(code).replace(/_/g, ' ')
}

/** Matrix column title: maps `read→View`, `update→Edit`, etc., for product wording. */
function columnHeaderLabel(code: string): string {
  const k = normalizeActionCode(code)
  if (k === 'read') return 'View'
  if (k === 'create') return 'Create'
  if (k === 'update') return 'Edit'
  if (k === 'delete') return 'Delete'
  return actionDisplayLabel(code)
}

/** Single read-only cell in the detail matrix (check vs X). */
function PermissionCell({ granted }: { granted: boolean }) {
  return (
    <td className="px-2 py-2 text-center align-middle">
      {granted ? (
        <Check className="mx-auto h-5 w-5 text-emerald-600" aria-label="Granted" />
      ) : (
        <X className="mx-auto h-5 w-5 text-red-500" aria-label="Not granted" />
      )}
    </td>
  )
}

/** Placeholder cell when an action column does not apply to a sub-menu row. */
function NotApplicableCell() {
  return (
    <td className="px-2 py-2 text-center align-middle text-xs text-[var(--fms-text-subheading)]" aria-label="N/A">
      —
    </td>
  )
}

/** Read-only permission grid grouped by main module; union of column codes across groups. */
function PermissionMatrixDetail({
  groups,
  permState,
  availableBySubMenu,
}: {
  groups: MenuPermissionGroup[]
  permState: Map<string, Set<string>>
  availableBySubMenu: Map<string, string[]>
}) {
  const columnCodes = useMemo(
    () => collectMatrixColumnCodes(groups, availableBySubMenu),
    [groups, availableBySubMenu],
  )

  if (groups.length === 0) {
    return (
      <p className="text-sm text-[var(--fms-text-subheading)]">
        No modules with sub-menus were returned. Configure modules under System Settings → Modules first.
      </p>
    )
  }

  return (
    <div className="max-h-[min(75vh,800px)] overflow-auto rounded-lg border border-[var(--fms-strokes)]">
      <table className="w-full min-w-[720px] text-sm">
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.mainModule}>
              <tr className="bg-[#e8eaf0] text-[var(--fms-text-header)]">
                <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide">Main module</th>
                <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide">Sub module</th>
                {columnCodes.map((code) => (
                  <th
                    key={code}
                    className="px-2 py-2 text-center text-xs font-bold uppercase tracking-wide"
                  >
                    {columnHeaderLabel(code)}
                  </th>
                ))}
              </tr>
              {group.items.map((item, idx) => {
                const assigned = permState.get(item.sub_menu_id) ?? new Set<string>()
                const availableList = resolveAvailableActionsForSubMenu(
                  item.sub_menu_id,
                  availableBySubMenu,
                  assigned,
                )
                const availableSet = new Set(availableList)
                return (
                  <tr key={item.sub_menu_id} className="border-t border-[var(--fms-strokes)]">
                    {idx === 0 ? (
                      <td
                        rowSpan={group.items.length}
                        className="bg-white px-3 py-2 align-top font-medium text-[var(--fms-text-header)]"
                      >
                        {group.mainModule}
                      </td>
                    ) : null}
                    <td className="px-3 py-2 text-[var(--fms-text-header)]">{item.subModule}</td>
                    {columnCodes.map((code) =>
                      availableSet.has(code) ? (
                        <PermissionCell key={code} granted={assigned.has(code)} />
                      ) : (
                        <NotApplicableCell key={code} />
                      ),
                    )}
                  </tr>
                )
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * One editable row: “select all” master checkbox (indeterminate when partial) plus per-action checkboxes
 * only for actions advertised as available for that sub-menu.
 */
function PermissionEditRow({
  item,
  mainModule,
  rowSpan,
  showMainCell,
  columnCodes,
  availableBySubMenu,
  permState,
  setPermState,
  editable = true,
}: {
  item: { sub_menu_id: string; subModule: string }
  mainModule: string
  rowSpan: number
  showMainCell: boolean
  columnCodes: string[]
  availableBySubMenu: Map<string, string[]>
  permState: Map<string, Set<string>>
  setPermState: Dispatch<SetStateAction<Map<string, Set<string>>>>
  editable?: boolean
}) {
  const assigned = permState.get(item.sub_menu_id) ?? new Set<string>()
  const availableList = resolveAvailableActionsForSubMenu(
    item.sub_menu_id,
    availableBySubMenu,
    assigned,
  )
  const availableSet = new Set(availableList)

  let grantedCount = 0
  for (const code of availableList) {
    if (assigned.has(code)) grantedCount += 1
  }
  const allOn = availableList.length > 0 && grantedCount === availableList.length
  const allSome = grantedCount > 0 && !allOn
  const allRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = allRef.current
    if (el) el.indeterminate = allSome
  }, [allSome, allOn])

  /** Replaces the entire assigned-set for this sub-menu (used by “All” toggle). */
  const setCodes = (nextSet: Set<string>) => {
    if (!editable) return
    setPermState((prev) => {
      const m = new Map(prev)
      m.set(item.sub_menu_id, nextSet)
      return m
    })
  }

  /** Toggles one normalized action code in the row’s assigned set. */
  const toggle = (code: string, checked: boolean) => {
    if (!editable) return
    const key = normalizeActionCode(code)
    if (!key) return
    setPermState((prev) => {
      const m = new Map(prev)
      const cur = new Set(m.get(item.sub_menu_id) ?? [])
      if (checked) cur.add(key)
      else cur.delete(key)
      m.set(item.sub_menu_id, cur)
      return m
    })
  }

  return (
    <tr className="border-t border-[var(--fms-strokes)]">
      {showMainCell ? (
        <td rowSpan={rowSpan} className="bg-white px-3 py-2 align-top font-medium text-[var(--fms-text-header)]">
          {mainModule}
        </td>
      ) : null}
      <td className="px-3 py-2 text-[var(--fms-text-header)]">{item.subModule}</td>
      <td className="px-2 py-2 text-center align-middle">
        <input
          ref={allRef}
          type="checkbox"
          className="h-4 w-4 rounded border-[var(--fms-strokes)] accent-[var(--fms-button)]"
          checked={allOn}
          disabled={!editable}
          onChange={(e) => {
            const on = e.target.checked
            if (on) setCodes(new Set(availableList))
            else setCodes(new Set())
          }}
          aria-label="Toggle all actions for this sub-module"
        />
      </td>
      {columnCodes.map((code) => {
        const applicable = availableSet.has(code)
        return (
          <td key={code} className="px-2 py-2 text-center align-middle">
            {applicable ? (
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-[var(--fms-strokes)] accent-[var(--fms-button)]"
                checked={assigned.has(code)}
                disabled={!editable}
                onChange={(e) => toggle(code, e.target.checked)}
                aria-label={columnHeaderLabel(code)}
              />
            ) : (
              <span className="text-xs text-[var(--fms-text-subheading)]">—</span>
            )}
          </td>
        )
      })}
    </tr>
  )
}

/** Editable matrix: header rows per main module + `PermissionEditRow` for each sub-menu. */
function PermissionMatrixEdit({
  groups,
  permState,
  setPermState,
  availableBySubMenu,
  editable = true,
}: {
  groups: MenuPermissionGroup[]
  permState: Map<string, Set<string>>
  setPermState: Dispatch<SetStateAction<Map<string, Set<string>>>>
  availableBySubMenu: Map<string, string[]>
  editable?: boolean
}) {
  const columnCodes = useMemo(
    () => collectMatrixColumnCodes(groups, availableBySubMenu),
    [groups, availableBySubMenu],
  )

  if (groups.length === 0) {
    return (
      <p className="text-sm text-[var(--fms-text-subheading)]">
        No modules with sub-menus were returned. Configure modules under System Settings → Modules first.
      </p>
    )
  }

  return (
    <div className="max-h-[min(75vh,800px)] overflow-auto rounded-lg border border-[var(--fms-strokes)]">
      <table className="w-full min-w-[860px] text-sm">
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.mainModule}>
              <tr className="bg-[#e8eaf0] text-[var(--fms-text-header)]">
                <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide">Main module</th>
                <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide">Sub module</th>
                <th className="px-2 py-2 text-center text-xs font-bold uppercase tracking-wide">All</th>
                {columnCodes.map((code) => (
                  <th
                    key={code}
                    className="px-2 py-2 text-center text-xs font-bold uppercase tracking-wide"
                  >
                    {columnHeaderLabel(code)}
                  </th>
                ))}
              </tr>
              {group.items.map((item, idx) => (
                <PermissionEditRow
                  key={item.sub_menu_id}
                  item={item}
                  mainModule={group.mainModule}
                  rowSpan={group.items.length}
                  showMainCell={idx === 0}
                  columnCodes={columnCodes}
                  availableBySubMenu={availableBySubMenu}
                  permState={permState}
                  setPermState={setPermState}
                  editable={editable}
                />
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Container for list/detail/edit modes, React Query orchestration, and save/delete mutations. */
export function RolePermissionManagement() {
  const [mode, setMode] = useState<ViewMode>('list')
  const [selectedRoleName, setSelectedRoleName] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [nameInput, setNameInput] = useState('')
  const [descriptionInput, setDescriptionInput] = useState('')
  const [permState, setPermState] = useState<Map<string, Set<string>>>(new Map())

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null)

  const queryClient = useQueryClient()
  const crud = useRouteCrudPermissions('/admin/role-permission')

  const listQuery = useQuery({
    queryKey: ['admin-roles', search, page, pageSize],
    queryFn: async () => {
      const payload = await apiGet<unknown>(listPath(search, page, pageSize))
      const records = rolesToArray(payload)
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
    enabled: mode === 'list' && crud.isResolved && crud.canRead,
  })

  const menusQuery = useQuery({
    queryKey: ['admin-menus-role-permission-matrix'],
    queryFn: fetchAllMenus,
    enabled: mode === 'detail' || mode === 'edit',
  })

  const groups = useMemo(
    () => (menusQuery.data ? groupMenusForPermissionMatrix(menusQuery.data) : []),
    [menusQuery.data],
  )

  const flatSubs = useMemo(() => flatSubMenusFromGroups(groups), [groups])

  const menusReady = !menusQuery.isLoading && !menusQuery.isError

  const detailQuery = useQuery({
    queryKey: ['admin-role-detail', selectedRoleName],
    queryFn: () => fetchRoleDetail(selectedRoleName),
    enabled:
      (mode === 'detail' || mode === 'edit') && selectedRoleName.length > 0 && menusReady,
  })

  useEffect(() => {
    if (mode !== 'edit' || !detailQuery.data) return
    setNameInput(detailQuery.data.role_name)
    setDescriptionInput(detailQuery.data.description)
  }, [mode, detailQuery.data])

  useEffect(() => {
    if (mode !== 'detail' && mode !== 'edit') return
    if (flatSubs.length === 0) return
    if (detailQuery.isLoading || !detailQuery.data) return
    const loadedName = detailQuery.data.role_name
    if (
      loadedName !== selectedRoleName &&
      loadedName.toLowerCase() !== selectedRoleName.toLowerCase()
    ) {
      return
    }

    setPermState(() => {
      const next = new Map<string, Set<string>>()
      const detail = detailQuery.data
      if (!detail) return next
      const apiAssigned = detail.assignedActionsBySubMenu
      const legacy = detail.permissionsBySubMenu
      for (const row of flatSubs) {
        if (apiAssigned.has(row.sub_menu_id)) {
          const list = apiAssigned.get(row.sub_menu_id) ?? []
          next.set(row.sub_menu_id, new Set(list.map(normalizeActionCode)))
        } else {
          next.set(
            row.sub_menu_id,
            assignedSetFromRoleActions(legacy.get(row.sub_menu_id) ?? defaultActions()),
          )
        }
      }
      return next
    })
  }, [mode, flatSubs, detailQuery.isLoading, detailQuery.data, selectedRoleName])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!crud.canUpdate) throw new Error('You do not have permission to update role permissions.')
      if (!nameInput.trim()) throw new Error('Role name is required.')
      if (flatSubs.length === 0) throw new Error('No sub-menus available to attach permissions.')
      const body = buildBulkPayload(
        nameInput,
        descriptionInput,
        flatSubs,
        permState,
        detailQuery.data?.availableActionsBySubMenu,
      )
      return apiPost<unknown, typeof body>('/admin/roles/bulk', body)
    },
    onSuccess: () => {
      showSuccessToast('Role permissions updated successfully')
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
      queryClient.invalidateQueries({ queryKey: ['admin-role-detail', selectedRoleName] })
      setMode('detail')
    },
    onError: (error) => {
      showErrorToast(error instanceof Error ? error.message : 'Could not save role')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (roleName: string) => {
      if (!crud.canDelete) {
        throw new Error('You do not have permission to delete roles.')
      }
      return apiDelete<unknown>(`/admin/roles/${encodeURIComponent(roleName)}`)
    },
    onSuccess: (_, deletedRoleName) => {
      showSuccessToast('Role deleted')
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
      setDeleteOpen(false)
      setRoleToDelete(null)
      if (selectedRoleName === deletedRoleName) {
        setMode('list')
        setSelectedRoleName('')
      }
    },
    onError: (error) => {
      showErrorToast(error instanceof Error ? error.message : 'Failed to delete role')
    },
  })

  const goList = useCallback(() => {
    setMode('list')
    setSelectedRoleName('')
    setPermState(new Map())
  }, [])

  const openDetail = (row: RoleListRow) => {
    if (!crud.canRead) return
    if (!row.roleName || row.roleName === '-') return
    setSelectedRoleName(row.roleName)
    setMode('detail')
  }

  const openEdit = (row: RoleListRow) => {
    if (!crud.canUpdate) return
    if (!row.roleName || row.roleName === '-') return
    setSelectedRoleName(row.roleName)
    setMode('edit')
  }

  const requestDelete = (row: RoleListRow) => {
    if (!crud.canDelete) return
    if (!row.roleName || row.roleName === '-') return
    setRoleToDelete(row.roleName)
    setDeleteOpen(true)
  }

  const rows = useMemo(() => listQuery.data?.rows ?? [], [listQuery.data?.rows])
  const totalCount = listQuery.data?.totalCount ?? rows.length
  const effectivePageSize = listQuery.data?.effectivePageSize ?? pageSize
  const totalPages =
    listQuery.data?.totalPages ?? Math.max(1, Math.ceil(totalCount / Math.max(1, effectivePageSize)))

  const listError = listQuery.isError
    ? listQuery.error instanceof Error
      ? listQuery.error.message
      : 'Failed to load roles'
    : null

  const menusError = menusQuery.isError
    ? menusQuery.error instanceof Error
      ? menusQuery.error.message
      : 'Failed to load modules'
    : null

  const detailError = detailQuery.isError
    ? detailQuery.error instanceof Error
      ? detailQuery.error.message
      : 'Failed to load role'
    : null

  const detailLoading =
    (mode === 'detail' || mode === 'edit') && (menusQuery.isLoading || detailQuery.isLoading)

  const displayName = mode === 'detail' || mode === 'edit' ? detailQuery.data?.role_name || selectedRoleName : ''

  const roleListSkeletonRows = Math.min(pageSize, ROLE_LIST_SKELETON_CAP)
  const showRoleListSkeleton =
    mode === 'list' && (!crud.isResolved || (crud.canRead && listQuery.isLoading))

  if (mode === 'list') {
    return (
      <section className="space-y-5">
        <PageHeader title="Role permission" subtitle="View role details or assign permissions per module" />

        <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
          <CardContent className="space-y-4 p-0">
            <div className="relative w-full max-w-sm sm:ml-auto">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--fms-text-subheading)]" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder="Search role name…"
                className="pl-9"
              />
            </div>

            <div className="hidden overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
              <table className="min-w-full text-sm">
                <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                  <tr>
                    {['Sl.No', 'Role',].map((column) => (
                      <th key={column} className="px-8 py-3 text-left text-xs font-bold uppercase tracking-wide">
                        {column}
                      </th>
                    ))}
                    <th className="px-8 py-3 text-center text-xs font-bold uppercase">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {showRoleListSkeleton ? (
                    <RoleListTableSkeletonBody rowCount={roleListSkeletonRows} />
                  ) : listError ? (
                    <tr className="border-t border-[var(--fms-strokes)]">
                      <td colSpan={3} className="px-4 py-6 text-center text-[var(--fms-delete)]">
                        {listError}
                      </td>
                    </tr>
                  ) : crud.isResolved && !crud.canRead ? (
                    <tr className="border-t border-[var(--fms-strokes)]">
                      <td colSpan={3} className="px-4 py-6 text-center text-[var(--fms-text-subheading)]">
                        You do not have permission to view this data.
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr className="border-t border-[var(--fms-strokes)]">
                      <td colSpan={3} className="px-4 py-6 text-center text-[var(--fms-text-subheading)]">
                        No roles found.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, index) => (
                      <tr key={row.roleName || `role-${index}`} className="border-t border-[var(--fms-strokes)]">
                        <td className="px-4 py-3 tabular-nums text-[var(--fms-text-subheading)]">{row.serialNo}</td>
                        <td className="px-4 py-3 font-medium text-[var(--fms-text-header)]">
                          {formatRealmRoleDisplayName(row.roleName)}
                        </td>
                        <td className="px-4 py-3">
                          <div className={rowActionsContainerClassName}>
                            <DetailRowActionButton type="button" disabled={!crud.canRead} onClick={() => openDetail(row)} />
                            <EditRowActionButton type="button" disabled={!crud.canUpdate} onClick={() => openEdit(row)} />
                            <DeleteRowActionButton type="button" disabled={!crud.canDelete} onClick={() => requestDelete(row)} />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {showRoleListSkeleton ? (
                <RoleListMobileSkeleton rowCount={roleListSkeletonRows} />
              ) : listError ? (
                <p className="py-6 text-center text-[var(--fms-delete)]">{listError}</p>
              ) : crud.isResolved && !crud.canRead ? (
                <p className="py-6 text-center text-[var(--fms-text-subheading)]">
                  You do not have permission to view this data.
                </p>
              ) : rows.length === 0 ? (
                <p className="py-6 text-center text-[var(--fms-text-subheading)]">No roles found.</p>
              ) : (
                rows.map((row, index) => (
                  <div
                    key={row.roleName || `role-m-${index}`}
                    className="rounded-lg border border-[var(--fms-strokes)] bg-white p-3"
                  >
                    <p className="text-sm text-[var(--fms-text-subheading)]">
                      <span className="font-medium text-[var(--fms-text-header)]">Sl.No:</span> {row.serialNo}
                    </p>
                    <p className="text-sm text-[var(--fms-text-subheading)]">
                      <span className="font-medium text-[var(--fms-text-header)]">Role:</span>{' '}
                      {formatRealmRoleDisplayName(row.roleName)}
                    </p>
                    <div className={`mt-3 ${rowActionsContainerClassName}`}>
                      <DetailRowActionButton type="button" disabled={!crud.canRead} onClick={() => openDetail(row)} />
                      <EditRowActionButton type="button" disabled={!crud.canUpdate} onClick={() => openEdit(row)} />
                      <DeleteRowActionButton type="button" disabled={!crud.canDelete} onClick={() => requestDelete(row)} />
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
          onConfirm={() => {
            if (!crud.canDelete) return
            if (roleToDelete) deleteMutation.mutate(roleToDelete)
          }}
          title="Delete role"
          description="Are you sure you want to delete this role? This cannot be undone."
        />
      </section>
    )
  }

  if (detailLoading) {
    return (
      <section className="space-y-5">
        <Button type="button" variant="ghost" size="sm" className="gap-1 text-[var(--fms-text-header)]" onClick={goList}>
          <ArrowLeft className="h-4 w-4" />
          Back to list
        </Button>
        <PageHeader title={mode === 'edit' ? 'Edit role' : 'Role detail'} subtitle="Loading…" />
        <p className="text-sm text-[var(--fms-text-subheading)]">Loading…</p>
      </section>
    )
  }

  if (menusError) {
    return (
      <section className="space-y-5">
        <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={goList}>
          <ArrowLeft className="h-4 w-4" />
          Back to list
        </Button>
        <p className="text-sm text-[var(--fms-delete)]">{menusError}</p>
      </section>
    )
  }

  if (detailError) {
    return (
      <section className="space-y-5">
        <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={goList}>
          <ArrowLeft className="h-4 w-4" />
          Back to list
        </Button>
        <p className="text-sm text-[var(--fms-delete)]">{detailError}</p>
      </section>
    )
  }

  if ((mode === 'detail' || mode === 'edit') && crud.isResolved && !crud.canRead) {
    return (
      <section className="space-y-5">
        <Button type="button" variant="ghost" size="sm" className="gap-1 text-[var(--fms-text-header)]" onClick={goList}>
          <ArrowLeft className="h-4 w-4" />
          Back to list
        </Button>
        <p className="text-sm text-[var(--fms-text-subheading)]">You do not have permission to view this role.</p>
      </section>
    )
  }

  if (mode === 'detail') {
    return (
      <section className="space-y-5">
        <Button type="button" variant="ghost" size="sm" className="gap-1 text-[var(--fms-text-header)]" onClick={goList}>
          <ArrowLeft className="h-4 w-4" />
          Back to list
        </Button>
        <PageHeader title="Role detail" />
        <p className="text-sm text-[var(--fms-text-subheading)]">
          Showing role details and permissions for{' '}
          <span className="font-semibold text-[var(--fms-success-text)]">
            {formatRealmRoleDisplayName(displayName)}
          </span>
        </p>
        <PermissionMatrixDetail
          groups={groups}
          permState={permState}
          availableBySubMenu={detailQuery.data?.availableActionsBySubMenu ?? new Map()}
        />
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <Button type="button" variant="ghost" size="sm" className="gap-1 text-[var(--fms-text-header)]" onClick={goList}>
        <ArrowLeft className="h-4 w-4" />
        Back to list
      </Button>
      <PageHeader title="Update role" subtitle="Edit the role and assign permissions for each sub-module" />

      <div className="grid gap-6 lg:grid-cols-[minmax(260px,320px)_1fr] lg:items-start">
        <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white">
          <CardContent className="space-y-4 pt-5">
            <h2 className="text-sm font-semibold text-[var(--fms-text-header)]">Update role</h2>
            <div className="space-y-2">
              <Label htmlFor="rp-role-name">
                Role name <span className="text-[var(--fms-delete)]">*</span>
              </Label>
              <Input
                id="rp-role-name"
                value={formatRealmRoleDisplayName(nameInput)}
                disabled
                className="bg-[#f6f6f7]"
                readOnly
              />
              <p className="text-xs text-[var(--fms-text-subheading)]">Role name cannot be changed here.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rp-role-desc">Role description</Label>
              <textarea
                id="rp-role-desc"
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                rows={4}
                placeholder="Describe this role"
                disabled={!crud.canUpdate}
                className="min-h-[5rem] w-full rounded-md border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--fms-info-border)]"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white">
          <CardContent className="space-y-3 pt-5">
            <h2 className="text-sm font-semibold text-[var(--fms-text-header)]">Add / edit permissions</h2>
            <PermissionMatrixEdit
              groups={groups}
              permState={permState}
              setPermState={setPermState}
              availableBySubMenu={detailQuery.data?.availableActionsBySubMenu ?? new Map()}
              editable={crud.canUpdate}
            />
            <div className="flex flex-wrap gap-2 border-t border-[var(--fms-strokes)] pt-4">
              <Button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !crud.canUpdate}
              >
                Save permissions
              </Button>
              <Button type="button" variant="outline" onClick={() => setMode('detail')} disabled={saveMutation.isPending}>
                View detail
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
