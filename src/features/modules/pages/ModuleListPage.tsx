// Lists admin menus (modules) from GET `/admin/menus`; navigates to create and edit flows.
import { Pencil, Plus } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { editRowActionButtonClassName } from '@/shared/components/TableRowActionButtons'
import { MenuLucideIcon } from '@/features/modules/components/MenuLucideIcon'
import { mapMenuRecord, menusToArray, type MenuRecord } from '@/features/modules/lib/menus-api'
import { apiGet } from '@/services/apiClient'
import { PageHeader } from '@/shared/components/PageHeader'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'

export function ModuleListPage() {
  const crud = useRouteCrudPermissions('/admin/modules')
  const listQuery = useQuery({
    queryKey: ['admin-menus'],
    queryFn: async () => {
      const payload = await apiGet<unknown>('/admin/menus')
      const records = menusToArray(payload)
        .map((r) => mapMenuRecord(r))
        .filter((m): m is MenuRecord => m !== null)
      return records.sort((a, b) => a.display_order - b.display_order)
    },
  })

  const rows = useMemo(() => listQuery.data ?? [], [listQuery.data])
  const listError = listQuery.isError
    ? listQuery.error instanceof Error
      ? listQuery.error.message
      : 'Failed to load modules'
    : null

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title="Module List" subtitle="Manage main modules and their navigation structure." />
        {crud.canCreate ? (
          <Button asChild className="w-full sm:w-auto">
            <Link to="/admin/modules/add">
              <Plus className="mr-1 h-4 w-4" />
              Add Module
            </Link>
          </Button>
        ) : null}
      </div>

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="space-y-4 p-0">
          <div className="hidden overflow-hidden rounded-lg border border-[var(--fms-strokes)] md:block">
            <table className="w-full text-sm">
              <thead className="bg-[#e8eef5] text-[var(--fms-text-header)]">
                <tr>
                  <th className="px-4 py-3 text-center font-semibold">#</th>
                  <th className="px-4 py-3 text-center font-semibold">ICON</th>
                  <th className="px-4 py-3 text-left font-semibold">MODULES</th>
                  <th className="px-4 py-3 text-center font-semibold">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {listQuery.isLoading ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td colSpan={4} className="px-4 py-6 text-center text-[var(--fms-text-subheading)]">
                      Loading modules...
                    </td>
                  </tr>
                ) : listError ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td colSpan={4} className="px-4 py-6 text-center text-[var(--fms-delete)]">
                      {listError}
                    </td>
                  </tr>
                ) : crud.isResolved && !crud.canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td colSpan={4} className="px-4 py-6 text-center text-[var(--fms-text-subheading)]">
                      You do not have permission to view this data.
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td colSpan={4} className="px-4 py-6 text-center text-[var(--fms-text-subheading)]">
                      No modules found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => {
                    return (
                      <tr key={row.id} className="border-t border-[var(--fms-strokes)]">
                        <td className="px-4 py-3 text-center tabular-nums">{index + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center">
                            <MenuLucideIcon
                              iconName={row.icon}
                              className="h-5 w-5"
                              style={{ color: row.icon_color }}
                              aria-hidden
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-[var(--fms-text-header)]">{row.name}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center">
                            {crud.canUpdate ? (
                              <Button variant="outline" size="sm" asChild className={cn(editRowActionButtonClassName, 'justify-center')}>
                                <Link to={`/admin/modules/${encodeURIComponent(row.id)}/edit`}>
                                  <Pencil className="shrink-0" aria-hidden />
                                  Edit
                                </Link>
                              </Button>
                            ) : (
                              <Button type="button" variant="outline" size="sm" className={editRowActionButtonClassName} disabled>
                                <Pencil className="shrink-0" aria-hidden />
                                Edit
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="space-y-2 md:hidden">
            {listQuery.isLoading ? (
              <p className="py-6 text-center text-sm text-[var(--fms-text-subheading)]">Loading modules...</p>
            ) : listError ? (
              <p className="py-6 text-center text-sm text-[var(--fms-delete)]">{listError}</p>
            ) : crud.isResolved && !crud.canRead ? (
              <p className="py-6 text-center text-sm text-[var(--fms-text-subheading)]">
                You do not have permission to view this data.
              </p>
            ) : rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--fms-text-subheading)]">No modules found.</p>
            ) : (
                    rows.map((row, index) => {
                return (
                  <div
                    key={row.id}
                    className="flex items-center gap-3 rounded-lg border border-[var(--fms-strokes)] bg-white p-3"
                  >
                    <span className="w-6 text-center text-sm tabular-nums text-[var(--fms-text-subheading)]">
                      {index + 1}
                    </span>
                    <MenuLucideIcon
                      iconName={row.icon}
                      className="h-5 w-5 shrink-0"
                      style={{ color: row.icon_color }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 font-medium text-[var(--fms-text-header)]">{row.name}</span>
                    {crud.canUpdate ? (
                      <Button variant="outline" size="sm" asChild className={cn(editRowActionButtonClassName, 'shrink-0 justify-center')}>
                        <Link to={`/admin/modules/${encodeURIComponent(row.id)}/edit`}>
                          <Pencil className="shrink-0" aria-hidden />
                          Edit
                        </Link>
                      </Button>
                    ) : (
                      <Button type="button" variant="outline" size="sm" className={cn(editRowActionButtonClassName, 'shrink-0')} disabled>
                        <Pencil className="shrink-0" aria-hidden />
                        Edit
                      </Button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
