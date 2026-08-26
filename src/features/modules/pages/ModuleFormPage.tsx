// Create via POST `/admin/menus/bulk`; update via PUT `/admin/menus/{id}`.
import { CloudUpload, RotateCcw, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiGet, apiPost, apiPut } from '@/services/apiClient'
import {
  buildBulkPayload,
  mapMenuRecord,
  menusToArray,
  type ApiRecord,
  type MenuRecord,
} from '@/features/modules/lib/menus-api'
import { BackToListButton } from '@/shared/components/BackToListButton'
import { PageHeader } from '@/shared/components/PageHeader'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

type SubFormRow = {
  key: string
  id?: string
  name: string
  route: string
  permission_code?: string
  display_order: number
}

function newRowKey() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `row-${Date.now()}-${Math.random()}`
}

function emptySubRow(order: number): SubFormRow {
  return { key: newRowKey(), name: '', route: '', display_order: order }
}

function menuToSubRows(record: MenuRecord | undefined): SubFormRow[] {
  const subs = record?.sub_menus
  if (subs && subs.length > 0) {
    return subs.map((s, i) => ({
      key: s.id ? `sub-${s.id}` : newRowKey(),
      id: s.id,
      name: s.name,
      route: s.route.replace(/^\//, ''),
      permission_code: s.permission_code,
      display_order: s.display_order || i + 1,
    }))
  }
  return [emptySubRow(1)]
}

async function fetchMenuById(id: string): Promise<MenuRecord> {
  try {
    const one = await apiGet<unknown>(`/admin/menus/${encodeURIComponent(id)}`)
    if (one && typeof one === 'object') {
      const mapped = mapMenuRecord(one as ApiRecord)
      if (mapped) return mapped
    }
  } catch {
    /* try list */
  }
  const list = await apiGet<unknown>('/admin/menus')
  const records = menusToArray(list)
    .map((r) => mapMenuRecord(r))
    .filter((m): m is MenuRecord => m !== null)
  const found = records.find((m) => m.id === id)
  if (!found) throw new Error('Module not found')
  return found
}

type ModuleFormFieldsProps = {
  menuId: string | undefined
  isEdit: boolean
  initialRecord: MenuRecord | undefined
}

function ModuleFormFields({ menuId, isEdit, initialRecord }: ModuleFormFieldsProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const crud = useRouteCrudPermissions('/admin/modules')
  const freezeEditing = crud.isResolved && !(isEdit ? crud.canUpdate : crud.canCreate)

  const [name, setName] = useState(() => initialRecord?.name ?? '')
  const [icon, setIcon] = useState(() => initialRecord?.icon ?? '')
  const [iconColor, setIconColor] = useState(() => initialRecord?.icon_color ?? '#64748b')
  const [displayOrder, setDisplayOrder] = useState(() => initialRecord?.display_order ?? 1)
  const [subRows, setSubRows] = useState<SubFormRow[]>(() => menuToSubRows(initialRecord))

  const resetCreateDefaults = () => {
    setName('')
    setIcon('')
    setIconColor('#64748b')
    setDisplayOrder(1)
    setSubRows([emptySubRow(1)])
  }

  const addSubRow = () => {
    if (freezeEditing) return
    setSubRows((prev) => {
      const nextOrder = prev.length > 0 ? Math.max(...prev.map((r) => r.display_order)) + 1 : 1
      return [...prev, emptySubRow(nextOrder)]
    })
  }

  const removeSubRow = (key: string) => {
    if (freezeEditing) return
    setSubRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)))
  }

  const updateSubRow = (key: string, patch: Partial<Omit<SubFormRow, 'key'>>) => {
    if (freezeEditing) return
    setSubRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  const payload = useMemo(() => {
    const order = Number(displayOrder)
    return buildBulkPayload(
      isEdit ? menuId : undefined,
      name,
      icon,
      iconColor,
      Number.isFinite(order) ? order : 0,
      subRows.map((r) => ({
        id: r.id,
        name: r.name,
        route: r.route,
        permission_code: r.permission_code,
        display_order: r.display_order,
      })),
    )
  }, [displayOrder, icon, iconColor, isEdit, menuId, name, subRows])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const allowed =
        crud.isResolved && (isEdit ? crud.canUpdate : crud.canCreate)
      if (!allowed) {
        throw new Error('You do not have permission to save this module.')
      }
      if (!name.trim() || !icon.trim()) {
        throw new Error('Main module name and icon are required.')
      }
      if (!Number.isFinite(Number(displayOrder))) {
        throw new Error('Display order must be a number.')
      }
      const filledSubs = subRows.filter((r) => r.name.trim() && r.route.trim())
      if (filledSubs.length === 0) {
        throw new Error('Add at least one sub-module with name and route.')
      }
      if (isEdit) {
        if (!menuId) throw new Error('Missing module id.')
        const body = { ...payload }
        delete body.id
        return apiPut<unknown, typeof body>(
          `/admin/menus/${encodeURIComponent(menuId)}`,
          body,
        )
      }
      return apiPost<unknown, typeof payload>('/admin/menus/bulk', payload)
    },
    onSuccess: () => {
      showSuccessToast(isEdit ? 'Module updated successfully' : 'Module created successfully')
      queryClient.invalidateQueries({ queryKey: ['admin-menus'] })
      queryClient.invalidateQueries({ queryKey: ['admin-menu', menuId] })
      navigate('/admin/modules')
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Could not save module'
      showErrorToast(message)
    },
  })

  if (crud.isResolved && !crud.canRead) {
    return (
      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white">
        <CardContent className="pt-5">
          <p className="text-sm text-[var(--fms-text-subheading)]">
            You do not have permission to view this module.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white">
        <CardContent className="space-y-4 pt-5">
          <h2 className="text-sm font-semibold text-[var(--fms-text-header)]">
            {isEdit ? 'Update Module' : 'Add Module'}
          </h2>
          <div className="space-y-2">
            <Label htmlFor="main-name">
              Main Module Name <span className="text-[var(--fms-delete)]">*</span>
            </Label>
            <Input id="main-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. System Setting" disabled={freezeEditing} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="main-icon">
              Module Icon <span className="text-[var(--fms-delete)]">*</span>
            </Label>
            <Input
              id="main-icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="example: bar_chart or fa-cogs"
              disabled={freezeEditing}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="icon-color">Module Icon Color</Label>
            <div className="flex items-center gap-2">
              <Input
                id="icon-color"
                type="color"
                className="h-10 w-14 cursor-pointer border border-[var(--fms-strokes)] p-1"
                value={iconColor}
                onChange={(e) => setIconColor(e.target.value)}
                disabled={freezeEditing}
              />
              <Input
                className="flex-1 font-mono text-sm"
                value={iconColor}
                onChange={(e) => setIconColor(e.target.value)}
                placeholder="#3B82F6"
                disabled={freezeEditing}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="display-order">
              Display Order <span className="text-[var(--fms-delete)]">*</span>
            </Label>
            <Input
              id="display-order"
              type="number"
              min={0}
              value={Number.isFinite(displayOrder) ? displayOrder : ''}
              onChange={(e) => setDisplayOrder(Number.parseInt(e.target.value, 10) || 0)}
              disabled={freezeEditing}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white">
        <CardContent className="space-y-4 pt-5">
          <h2 className="text-sm font-semibold text-[var(--fms-text-header)]">Add Sub Modules</h2>
          <div className="overflow-x-auto rounded-lg border border-[var(--fms-strokes)]">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  <th className="w-12 px-2 py-2 text-center font-semibold">Sl.No</th>
                  <th className="w-10 px-2 py-2 text-center font-semibold" aria-label="Remove row" />
                  <th className="px-2 py-2 text-left font-semibold">
                    SUB MODULE NAME <span className="text-[var(--fms-delete)]">*</span>
                  </th>
                  <th className="px-2 py-2 text-left font-semibold">
                    ROUTE <span className="text-[var(--fms-delete)]">*</span>
                  </th>
                  <th className="w-24 px-2 py-2 text-left font-semibold">
                    ORDER <span className="text-[var(--fms-delete)]">*</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {subRows.map((row, index) => (
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
                        onClick={() => removeSubRow(row.key)}
                        aria-label="Remove row"
                        disabled={freezeEditing}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <Input
                        value={row.name}
                        onChange={(e) => updateSubRow(row.key, { name: e.target.value })}
                        placeholder="Sub-module name"
                        className="min-w-[140px]"
                        disabled={freezeEditing}
                      />
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <Input
                        value={row.route}
                        onChange={(e) => updateSubRow(row.key, { route: e.target.value })}
                        placeholder="path e.g. system-setting/users"
                        className="min-w-[160px] font-mono text-xs"
                        disabled={freezeEditing}
                      />
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <Input
                        type="number"
                        min={0}
                        value={row.display_order}
                        onChange={(e) =>
                          updateSubRow(row.key, {
                            display_order: Number.parseInt(e.target.value, 10) || 0,
                          })
                        }
                        className="w-full min-w-[4rem]"
                        disabled={freezeEditing}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="default" onClick={addSubRow} disabled={freezeEditing}>
              + Add New Row
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-[var(--fms-strokes)] pt-4">
            <Button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={
                saveMutation.isPending ||
                freezeEditing ||
                !crud.isResolved
              }
            >
              <CloudUpload className="h-4 w-4" />
              {isEdit ? 'UPDATE MODULE' : 'CREATE MODULE'}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={saveMutation.isPending}
              onClick={() => {
                if (!isEdit) resetCreateDefaults()
                navigate('/admin/modules')
              }}
            >
              <RotateCcw className="h-4 w-4" />
              CANCEL
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function ModuleFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)

  const detailQuery = useQuery({
    queryKey: ['admin-menu', id],
    queryFn: () => fetchMenuById(id!),
    enabled: isEdit,
  })

  const detailError = detailQuery.isError
    ? detailQuery.error instanceof Error
      ? detailQuery.error.message
      : 'Failed to load module'
    : null

  if (isEdit && detailQuery.isLoading) {
    return (
      <section className="space-y-5">
        <PageHeader title="Update Module" subtitle="Loading…" />
        <p className="text-sm text-[var(--fms-text-subheading)]">Loading module details…</p>
      </section>
    )
  }

  if (isEdit && detailError) {
    return (
      <section className="space-y-5">
        <BackToListButton to="/admin/modules" />
        <PageHeader title="Update Module" />
        <p className="text-sm text-[var(--fms-delete)]">{detailError}</p>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <BackToListButton to="/admin/modules" />
      <PageHeader
        title={isEdit ? 'Update Module' : 'Add Module'}
        subtitle={
          isEdit
            ? 'Change the main module and its sub-modules, then save.'
            : 'Define a main module and one or more sub-modules with routes.'
        }
      />

      {isEdit && detailQuery.data ? (
        <ModuleFormFields key={id} menuId={id} isEdit initialRecord={detailQuery.data} />
      ) : (
        <ModuleFormFields key="create" menuId={undefined} isEdit={false} initialRecord={undefined} />
      )}
    </section>
  )
}
