import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Search } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { fetchHierarchyById } from '@/features/settings/lib/hierarchy-api'
import {
  deleteHierarchyLevel,
  fetchHierarchyLevelsPage,
  type HierarchyLevelTableRow,
} from '@/features/settings/lib/hierarchy-level-api'
import { DeleteDialog } from '@/shared/components/DeleteDialog'
import { PageHeader } from '@/shared/components/PageHeader'
import {
  DeleteRowActionButton,
  EditRowActionButton,
  rowActionsContainerClassName,
} from '@/shared/components/TableRowActionButtons'
import { TablePagination } from '@/shared/components/TablePagination'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { cn } from '@/lib/utils'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

const LIST_QUERY_KEY = 'workflows/hierarchy-levels'
const HIERARCHY_LOOKUP_KEY = 'workflows/hierarchy-lookup'
const TABLE_COL_COUNT = 9

function HierarchyLevel() {
  const { hierarchyId: routeHierarchyId = '' } = useParams<{ hierarchyId: string }>()
  const hierarchyId = routeHierarchyId.trim()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedDeleteId, setSelectedDeleteId] = useState<string | null>(null)

  const crud = useRouteCrudPermissions('/settings/hierarchy')
  const canCreate = !crud.isResolved || crud.canCreate
  const canUpdate = !crud.isResolved || crud.canUpdate
  const canDelete = !crud.isResolved || crud.canDelete
  const canRead = !crud.isResolved || crud.canRead

  const hierarchyQuery = useQuery({
    queryKey: [HIERARCHY_LOOKUP_KEY, hierarchyId],
    queryFn: () => fetchHierarchyById(hierarchyId),
    enabled: canRead && Boolean(hierarchyId),
  })

  const listQuery = useQuery({
    queryKey: [LIST_QUERY_KEY, hierarchyId, search, page, pageSize],
    queryFn: () => fetchHierarchyLevelsPage(hierarchyId, search, page, pageSize),
    enabled: canRead && Boolean(hierarchyId),
  })

  const deleteMutation = useMutation({
    mutationFn: (levelId: string) => deleteHierarchyLevel(hierarchyId, levelId),
    onSuccess: () => {
      showSuccessToast('Hierarchy level deleted successfully')
      queryClient.invalidateQueries({ queryKey: [LIST_QUERY_KEY, hierarchyId] })
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : 'Failed to delete hierarchy level'
      showErrorToast(message)
    },
  })

  const rows = useMemo(() => listQuery.data?.rows ?? [], [listQuery.data?.rows])
  const totalCount = listQuery.data?.totalCount ?? rows.length
  const effectivePageSize = listQuery.data?.effectivePageSize ?? pageSize
  const totalPages =
    listQuery.data?.totalPages ??
    Math.max(1, Math.ceil(totalCount / effectivePageSize))

  const hierarchyName = hierarchyQuery.data?.name || 'Hierarchy'

  const levelsBasePath = `/settings/hierarchy/${encodeURIComponent(hierarchyId)}/levels`

  const onEdit = (row: HierarchyLevelTableRow) => {
    if (!canUpdate) return
    navigate(`${levelsBasePath}/${encodeURIComponent(row.id)}/edit`)
  }

  const onDeleteRequest = (row: HierarchyLevelTableRow) => {
    if (!canDelete) return
    setSelectedDeleteId(row.id)
    setDeleteOpen(true)
  }

  const onConfirmDelete = () => {
    if (!canDelete || !selectedDeleteId) return
    deleteMutation.mutate(selectedDeleteId, {
      onSettled: () => {
        setSelectedDeleteId(null)
        setDeleteOpen(false)
      },
    })
  }

  if (!hierarchyId) {
    return (
      <section className="space-y-5">
        <PageHeader title="Hierarchy Levels" subtitle="Invalid hierarchy." />
        <Button variant="outline" asChild>
          <Link to="/settings/hierarchy">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Hierarchy
          </Link>
        </Button>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
            <Link to="/settings/hierarchy">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to Hierarchy
            </Link>
          </Button>
          <PageHeader
            title="Hierarchy Levels"
            subtitle={
              hierarchyQuery.isLoading ? (
                'Loading hierarchy…'
              ) : (
                <>
                  Configure approval levels for{' '}
                  <span className="font-semibold text-[var(--fms-text-header)]">
                    {hierarchyName}
                  </span>
                </>
              )
            }
          />
        </div>
        {canCreate ? (
          <Button
            type="button"
            className="w-full bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)] sm:w-auto"
            onClick={() => navigate(`${levelsBasePath}/add`)}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add New
          </Button>
        ) : null}
      </div>

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="space-y-4 p-0">
          <div className="flex justify-end">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--fms-text-subheading)]" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search levels..."
                className="pl-9"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[var(--fms-strokes)]">
            <table className="min-w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  {[
                    "Sl.No",
                    "Level",
                    "Approver",
                    "Employee",
                    "Start Date",
                    "End Date",
                    "Sequence",
                    "Status",
                  ].map((column) => (
                    <th
                      key={column}
                      className="px-4 py-3 text-left font-semibold  tracking-wide"
                    >
                      {column}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center font-semibold tracking-wide">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {crud.isResolved && !canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COL_COUNT}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      You do not have permission to view this data.
                    </td>
                  </tr>
                ) : listQuery.isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr
                      key={`level-sk-${index}`}
                      className="border-t border-[var(--fms-strokes)]"
                    >
                      {Array.from({ length: TABLE_COL_COUNT }).map(
                        (__, cellIndex) => (
                          <td key={cellIndex} className="px-4 py-3">
                            <Skeleton className="h-4 w-full max-w-[8rem]" />
                          </td>
                        ),
                      )}
                    </tr>
                  ))
                ) : listQuery.isError ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COL_COUNT}
                      className="px-4 py-6 text-center text-[var(--fms-delete)]"
                    >
                      Failed to load hierarchy levels.
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COL_COUNT}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      No records found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-[var(--fms-strokes)]"
                    >
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.serialNo}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.level || "-"}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.approvingAuthorityName || "-"}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.employeeDisplay || "-"}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.startDate || "-"}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.endDate || "-"}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.sequence}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "rounded-full border-0 px-3 py-1  font-normal text-white inline-block",
                            row.isActive
                              ? "text-[var(--fms-success-text)]"
                              : "text-[var(--fms-text-subheading)]",
                          )}
                        >
                          {row.isActive ? "Active" : "Inactive"}
                        </span>
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
        title="Delete Hierarchy Level"
        description="Are you sure you want to delete this hierarchy level? This action cannot be undone."
      />
    </section>
  );
}

export default HierarchyLevel
