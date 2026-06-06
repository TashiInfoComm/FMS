/**
 * Dedicated route `/admin/roles/form` (+ optional `:roleName` for edit): full menu/sub-menu permission matrix via Switches,
 * persisted with `POST /admin/roles/bulk`. Edit mode hydrates from `fetchRoleDetail`.
 */
import { CloudUpload, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { apiGet, apiPost } from '@/services/apiClient'
import {
  mapMenuRecord,
  menusToArray,
  type ApiRecord,
  type MenuRecord,
} from '@/features/modules/lib/menus-api'
import { formatRealmRoleDisplayName } from '@/shared/lib/format-realm-role-display'
import {
  assignedSetFromRoleActions,
  buildBulkPayload,
  defaultActions,
  fetchRoleDetail,
  flattenSubMenusForRoleMatrix,
  type FlatSubMenuRow,
  type RoleActions,
} from '@/features/user/lib/roles-api'
import { PageHeader } from '@/shared/components/PageHeader'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

/** Table of sub-menus × read/create/update/delete with `Switch` controls bound to `permState`. */
function RolePermissionFields({
  flatSubs,
  permState,
  setPermState,
  disabled,
}: {
  flatSubs: FlatSubMenuRow[]
  permState: Map<string, RoleActions>
  setPermState: Dispatch<SetStateAction<Map<string, RoleActions>>>
  disabled?: boolean
}) {
  /** Curried updater: merges one CRUD flag for `subMenuId` into the shared `Map`. */
  const toggle =
    (subMenuId: string, key: keyof RoleActions) => (checked: boolean) => {
      setPermState((prev) => {
        const next = new Map(prev)
        const current = next.get(subMenuId) ?? defaultActions()
        next.set(subMenuId, { ...current, [key]: checked ? 1 : 0 })
        return next
      })
    }

  if (flatSubs.length === 0) {
    return (
      <p className="text-sm text-[var(--fms-text-subheading)]">
        No sub-menus with ids were returned from Modules. Add sub-modules under System Settings → Modules first.
      </p>
    )
  }

  return (
    <div className="max-h-[min(70vh,720px)] overflow-auto rounded-lg border border-[var(--fms-strokes)]">
      <table className="min-w-[640px] w-full text-sm">
        <thead className="sticky top-0 z-[1] bg-[#f6f6f7] text-[var(--fms-text-header)]">
          <tr>
            <th className="w-16 px-3 py-3 text-left font-semibold">Sl.No</th>
            <th className="px-3 py-3 text-left font-semibold">Sub-menu</th>
            {(['Read', 'Create', 'Update', 'Delete'] as const).map((h) => (
              <th key={h} className="px-2 py-3 text-center font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {flatSubs.map((row, index) => {
            const a = permState.get(row.sub_menu_id) ?? defaultActions()
            return (
              <tr key={row.sub_menu_id} className="border-t border-[var(--fms-strokes)]">
                <td className="px-3 py-2 align-middle tabular-nums text-[var(--fms-text-subheading)]">
                  {index + 1}
                </td>
                <td className="max-w-[280px] px-3 py-2 align-middle text-[var(--fms-text-header)]">{row.label}</td>
                <td className="px-2 py-2 text-center align-middle">
                  <div className="flex justify-center">
                    <Switch
                      checked={a.read === 1}
                      disabled={disabled}
                      onCheckedChange={toggle(row.sub_menu_id, 'read')}
                    />
                  </div>
                </td>
                <td className="px-2 py-2 text-center align-middle">
                  <div className="flex justify-center">
                    <Switch
                      checked={a.create === 1}
                      disabled={disabled}
                      onCheckedChange={toggle(row.sub_menu_id, 'create')}
                    />
                  </div>
                </td>
                <td className="px-2 py-2 text-center align-middle">
                  <div className="flex justify-center">
                    <Switch
                      checked={a.update === 1}
                      disabled={disabled}
                      onCheckedChange={toggle(row.sub_menu_id, 'update')}
                    />
                  </div>
                </td>
                <td className="px-2 py-2 text-center align-middle">
                  <div className="flex justify-center">
                    <Switch
                      checked={a.delete === 1}
                      disabled={disabled}
                      onCheckedChange={toggle(row.sub_menu_id, 'delete')}
                    />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Loads all menus for matrix expansion (flattened downstream). */
async function fetchAllMenus(): Promise<MenuRecord[]> {
  const payload = await apiGet<unknown>('/admin/menus')
  const records = menusToArray(payload)
    .map((r, i) => mapMenuRecord(r as ApiRecord, i))
    .filter((m): m is MenuRecord => m !== null)
  return records.sort((a, b) => a.display_order - b.display_order)
}

/** Create vs edit inferred from `:roleName` param; merges API detail into `permState` when menus load. */
export function RoleFormPage() {
  const { roleName: roleNameParam } = useParams<{ roleName?: string }>()
  const isEdit = roleNameParam !== undefined
  const decodedRoleName = roleNameParam ? decodeURIComponent(roleNameParam) : ''

  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const crud = useRouteCrudPermissions('/admin/roles')

  const [nameInput, setNameInput] = useState('')
  const [descriptionInput, setDescriptionInput] = useState('')
  const [permState, setPermState] = useState<Map<string, RoleActions>>(new Map())

  const menusQuery = useQuery({
    queryKey: ['admin-menus-role-form'],
    queryFn: fetchAllMenus,
  })

  const flatSubs = useMemo(
    () => (menusQuery.data ? flattenSubMenusForRoleMatrix(menusQuery.data) : []),
    [menusQuery.data],
  )

  const detailQuery = useQuery({
    queryKey: ['admin-role-detail', decodedRoleName],
    queryFn: () => fetchRoleDetail(decodedRoleName),
    enabled: isEdit && decodedRoleName.length > 0,
  })

  useEffect(() => {
    if (!isEdit || !detailQuery.data) return
    setNameInput(detailQuery.data.role_name)
    setDescriptionInput(detailQuery.data.description)
  }, [isEdit, detailQuery.data])

  useEffect(() => {
    if (flatSubs.length === 0) return
    if (isEdit && (detailQuery.isLoading || !detailQuery.data)) return

    setPermState((prev) => {
      const next = new Map<string, RoleActions>()
      const apiMap = detailQuery.data?.permissionsBySubMenu
      for (const row of flatSubs) {
        const merged =
          apiMap?.get(row.sub_menu_id) ?? prev.get(row.sub_menu_id) ?? defaultActions()
        next.set(row.sub_menu_id, merged)
      }
      return next
    })
  }, [flatSubs, isEdit, detailQuery.isLoading, detailQuery.data])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!crud.canUpdate) throw new Error('You do not have permission to update roles.')
      if (!nameInput.trim()) throw new Error('Role name is required.')
      if (flatSubs.length === 0) throw new Error('No sub-menus available to attach permissions.')

      const assignedBySubMenu = new Map<string, Set<string>>()
      for (const row of flatSubs) {
        assignedBySubMenu.set(
          row.sub_menu_id,
          assignedSetFromRoleActions(permState.get(row.sub_menu_id) ?? defaultActions()),
        )
      }
      const body = buildBulkPayload(nameInput, descriptionInput, flatSubs, assignedBySubMenu)
      return apiPost<unknown, typeof body>('/admin/roles/bulk', body)
    },
    onSuccess: () => {
      showSuccessToast(isEdit ? 'Role updated successfully' : 'Role created successfully')
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
      navigate('/admin/roles')
    },
    onError: (error) => {
      showErrorToast(error instanceof Error ? error.message : 'Could not save role')
    },
  })

  const detailError = detailQuery.isError
    ? detailQuery.error instanceof Error
      ? detailQuery.error.message
      : 'Failed to load role'
    : null

  const menusError = menusQuery.isError
    ? menusQuery.error instanceof Error
      ? menusQuery.error.message
      : 'Failed to load modules'
    : null

  const loadingBlocking =
    menusQuery.isLoading || (isEdit && decodedRoleName.length > 0 && detailQuery.isLoading)

  if (loadingBlocking) {
    return (
      <section className="space-y-5">
        <PageHeader title={isEdit ? 'Edit Role' : 'Add Role'} subtitle="Loading…" />
        <p className="text-sm text-[var(--fms-text-subheading)]">Loading…</p>
      </section>
    )
  }

  if (isEdit && detailError) {
    return (
      <section className="space-y-5">
        <PageHeader title="Edit Role" />
        <p className="text-sm text-[var(--fms-delete)]">{detailError}</p>
        <Button variant="outline" onClick={() => navigate('/admin/roles')}>
          Back to roles
        </Button>
      </section>
    )
  }

  if (isEdit && crud.isResolved && !crud.canRead) {
    return (
      <section className="space-y-5">
        <PageHeader title="Edit Role" />
        <p className="text-sm text-[var(--fms-text-subheading)]">You do not have permission to view this role.</p>
        <Button variant="outline" onClick={() => navigate('/admin/roles')}>
          Back to roles
        </Button>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <PageHeader
        title={isEdit ? 'Edit Role' : 'Add Role'}
        subtitle={
          isEdit
            ? 'Update the realm role name, description, and sub-menu permission toggles.'
            : 'Create a realm role and assign read/create/update/delete access per sub-menu.'
        }
      />

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white">
        <CardContent className="space-y-4 pt-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="role-name">
                Role name <span className="text-[var(--fms-delete)]">*</span>
              </Label>
              <Input
                id="role-name"
                value={isEdit ? formatRealmRoleDisplayName(nameInput) : nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. fms-custom-role"
                disabled={isEdit}
                autoComplete="off"
              />
              {isEdit ? (
                <p className="text-xs text-[var(--fms-text-subheading)]">Role name cannot be changed after creation.</p>
              ) : null}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="role-desc">Description</Label>
              <textarea
                id="role-desc"
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                placeholder="Describe what this role is for"
                rows={3}
                disabled={!crud.canUpdate}
                className="min-h-[4.5rem] w-full rounded-md border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--fms-info-border)]"
              />
            </div>
          </div>

          <div className="space-y-2 border-t border-[var(--fms-strokes)] pt-4">
            <h2 className="text-sm font-semibold text-[var(--fms-text-header)]">Sub-menu permissions</h2>
            {menusQuery.isLoading ? (
              <p className="text-sm text-[var(--fms-text-subheading)]">Loading modules…</p>
            ) : menusError ? (
              <p className="text-sm text-[var(--fms-delete)]">{menusError}</p>
            ) : (
              <RolePermissionFields
                flatSubs={flatSubs}
                permState={permState}
                setPermState={setPermState}
                disabled={!crud.canUpdate}
              />
            )}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-[var(--fms-strokes)] pt-4">
            <Button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !crud.canUpdate}
            >
              <CloudUpload className="mr-2 h-4 w-4" />
              {isEdit ? 'UPDATE ROLE' : 'CREATE ROLE'}
            </Button>
            <Button type="button" variant="destructive" disabled={saveMutation.isPending} onClick={() => navigate('/admin/roles')}>
              <RotateCcw className="mr-2 h-4 w-4" />
              CANCEL
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
