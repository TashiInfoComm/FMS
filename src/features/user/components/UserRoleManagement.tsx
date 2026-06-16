/**
 * Sidebar “Roles”: paginated `/admin/roles`, “Add role” posts `bulk` payload with zeroed permissions keyed by flattened sub-menus,
 * optionally loading menus when the create dialog opens.
 */
import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiGet, apiPost } from '@/services/apiClient'
import {
  mapMenuRecord,
  menusToArray,
  type ApiRecord as MenuApiRecord,
  type MenuRecord,
} from '@/features/modules/lib/menus-api'
import {
  mapRoleListRecord,
  rolesToArray,
  buildBulkPayload,
  flattenSubMenusForRoleMatrix,
  type RoleListRow,
} from '@/features/user/lib/roles-api'
import { PageHeader } from '@/shared/components/PageHeader'
import { TablePagination } from '@/shared/components/TablePagination'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { formatRealmRoleDisplayName } from '@/shared/lib/format-realm-role-display'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'
import { applyPagination } from '@/shared/utils/pagination'

/** menus → sorted `MenuRecord[]` for the create-role bulk matrix (same shape as Role form page). */
async function fetchMenusForRoleCreate(): Promise<MenuRecord[]> {
  const payload = await apiGet<unknown>('/admin/menus')
  const records = menusToArray(payload)
    .map((r, i) => mapMenuRecord(r as MenuApiRecord, i))
    .filter((m): m is MenuRecord => m !== null)
  return records.sort((a, b) => a.display_order - b.display_order)
}

/** Query string builder for `/admin/roles`; omits blank `search`. */
function listPath(search: string, page: number, pageSize: number) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('page_size', String(pageSize))
  const q = search.trim()
  if (q) params.set('search', q)
  return `/admin/roles?${params.toString()}`
}

const ROLE_LIST_SKELETON_CAP = 8

function RolesTableSkeletonBody({ rowCount }: { rowCount: number }) {
  return (
    <>
      {Array.from({ length: rowCount }).map((_, i) => (
        <tr key={`role-um-sk-${i}`} className="border-t border-[var(--fms-strokes)]">
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-8" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-[min(100%,14rem)]" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-full max-w-md" />
          </td>
        </tr>
      ))}
    </>
  )
}

function RolesMobileCardSkeleton({ rowCount }: { rowCount: number }) {
  return (
    <>
      {Array.from({ length: rowCount }).map((_, i) => (
        <div
          key={`role-um-m-sk-${i}`}
          className="space-y-2 rounded-lg border border-[var(--fms-strokes)] bg-white p-3"
        >
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-full max-w-xs" />
          <Skeleton className="h-4 w-full max-w-sm" />
        </div>
      ))}
    </>
  )
}

/** Applies `mapRoleListRecord` plus serial numbers for Sl.No column. */
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

/** React Query list + optional create modal that seeds `POST /admin/roles/bulk`. */
export function UserRoleManagement() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDescription, setCreateDescription] = useState('')

  const queryClient = useQueryClient()
  const crud = useRouteCrudPermissions('/admin/roles')

  const menusForCreateQuery = useQuery({
    queryKey: ['admin-menus-role-form'],
    queryFn: fetchMenusForRoleCreate,
    enabled: createOpen,
  })

  const createRoleMutation = useMutation({
    mutationFn: async () => {
      if (!crud.canCreate) throw new Error('You do not have permission to create roles.')
      if (!createName.trim()) throw new Error('Role name is required.')
      const menus = menusForCreateQuery.data ?? []
      const flatSubs = flattenSubMenusForRoleMatrix(menus)
      const assignedBySubMenu = new Map<string, Set<string>>()
      for (const row of flatSubs) {
        assignedBySubMenu.set(row.sub_menu_id, new Set())
      }
      const body = buildBulkPayload(createName, createDescription, flatSubs, assignedBySubMenu)
      return apiPost<unknown, typeof body>('/admin/roles/bulk', body)
    },
    onSuccess: () => {
      showSuccessToast('Role created successfully')
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
      setCreateOpen(false)
      setCreateName('')
      setCreateDescription('')
    },
    onError: (error) => {
      showErrorToast(error, 'Could not create role')
    },
  })

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
    enabled: crud.isResolved && crud.canRead,
  })

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

  const roleListSkeletonRows = Math.min(pageSize, ROLE_LIST_SKELETON_CAP)
  const showRoleListSkeleton = !crud.isResolved || (crud.canRead && listQuery.isLoading)

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Roles"
          subtitle="Roles available in the system"
        />
        {crud.canCreate ? (
          <Button
            type="button"
            className="w-full bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)] sm:w-auto"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Role
          </Button>
        ) : null}
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setCreateName("");
            setCreateDescription("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add role</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="create-role-name">
                Role name <span className="text-[var(--fms-delete)]">*</span>
              </Label>
              <Input
                id="create-role-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. fms-custom-role"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-role-description">Description</Label>
              <textarea
                id="create-role-description"
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                placeholder="Describe what this role is for"
                rows={3}
                className="min-h-[4.5rem] w-full rounded-md border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--fms-info-border)]"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={createRoleMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)]"
              disabled={
                createRoleMutation.isPending ||
                (createOpen && menusForCreateQuery.isLoading) ||
                !crud.canCreate
              }
              onClick={() => createRoleMutation.mutate()}
            >
              {createRoleMutation.isPending ? "Creating…" : "Create role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="space-y-4 p-0">
          <div className="relative w-full max-w-sm sm:ml-auto">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--fms-text-subheading)]" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search role name or description…"
              className="pl-9"
            />
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  {["Sl.No", "Role", " Name", "Description"].map((column) => (
                    <th
                      key={column}
                      className="px-4 py-3 text-left font-semibold"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {showRoleListSkeleton ? (
                  <RolesTableSkeletonBody rowCount={roleListSkeletonRows} />
                ) : listError ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={3}
                      className="px-4 py-6 text-center text-[var(--fms-delete)]"
                    >
                      {listError}
                    </td>
                  </tr>
                ) : crud.isResolved && !crud.canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={3}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      You do not have permission to view this data.
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={3}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      No roles found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr
                      key={row.roleName || `role-${index}`}
                      className="border-t border-[var(--fms-strokes)]"
                    >
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)] tabular-nums">
                        {row.serialNo}
                      </td>
                      <td className="px-4 py-3  text-[var(--fms-text-subheading)]">
                        {row.roleName}
                      </td>
                      <td className="px-4 py-3  text-[var(--fms-text-subheading)] capitalize">
                        {formatRealmRoleDisplayName(row.roleName)}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.description}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {showRoleListSkeleton ? (
              <RolesMobileCardSkeleton rowCount={roleListSkeletonRows} />
            ) : listError ? (
              <p className="py-6 text-center text-[var(--fms-delete)]">
                {listError}
              </p>
            ) : crud.isResolved && !crud.canRead ? (
              <p className="py-6 text-center text-[var(--fms-text-subheading)]">
                You do not have permission to view this data.
              </p>
            ) : rows.length === 0 ? (
              <p className="py-6 text-center text-[var(--fms-text-subheading)]">
                No roles found.
              </p>
            ) : (
              rows.map((row, index) => (
                <div
                  key={row.roleName || `role-m-${index}`}
                  className="rounded-lg border border-[var(--fms-strokes)] bg-white p-3"
                >
                  <p className="text-sm text-[var(--fms-text-subheading)]">
                    <span className="font-medium text-[var(--fms-text-header)]">
                      Sl.No:
                    </span>{" "}
                    {row.serialNo}
                  </p>
                  <p className="text-sm text-[var(--fms-text-subheading)]">
                    <span className="font-medium text-[var(--fms-text-header)]">
                      Role Name:
                    </span>{" "}
                    {formatRealmRoleDisplayName(row.roleName)}
                  </p>
                  <p className="text-sm text-[var(--fms-text-subheading)]">
                    <span className="font-medium text-[var(--fms-text-header)]">
                      Description:
                    </span>{" "}
                    {row.description}
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
    </section>
  );
}
