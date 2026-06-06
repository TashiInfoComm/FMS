import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { fetchApprovalHeadsPage } from '@/features/settings/lib/approval-head-api'
import {
  APPROVABLE_TYPES_QUERY_KEY,
  APPROVAL_HEADS_TABS_QUERY_KEY,
  DEFINITIONS_QUERY_KEY,
  formatModuleLabel,
  useApprovableTypeMaps,
} from '@/features/settings/lib/approval-rule-shared'
import {
  fetchApprovableTypes,
  fetchWorkflowDefinitionsPage,
  type WorkflowDefinitionTableRow,
} from '@/features/settings/lib/approval-rules-api'
import { PageHeader } from '@/shared/components/PageHeader'
import {
  DetailRowActionButton,
  EditRowActionButton,
  rowActionsContainerClassName,
} from '@/shared/components/TableRowActionButtons'
import { TablePagination } from '@/shared/components/TablePagination'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { cn } from '@/lib/utils'

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge
      className={cn(
        'rounded-full border-0 px-3 py-0.5 text-xs font-semibold text-white',
        active ? 'bg-[var(--fms-success-text)]' : 'bg-[var(--fms-text-subheading)]',
      )}
    >
      {active ? 'Active' : 'Inactive'}
    </Badge>
  )
}

function ApprovalDefinations() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [selectedHeadId, setSelectedHeadId] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [detailRow, setDetailRow] = useState<WorkflowDefinitionTableRow | null>(null)

  const crud = useRouteCrudPermissions('/settings/approval-rules')
  const canCreate = !crud.isResolved || crud.canCreate
  const canUpdate = !crud.isResolved || crud.canUpdate
  const canRead = !crud.isResolved || crud.canRead

  const headsQuery = useQuery({
    queryKey: [APPROVAL_HEADS_TABS_QUERY_KEY],
    queryFn: () => fetchApprovalHeadsPage('', 1, 100),
    enabled: canRead,
  })

  const approvalHeads = useMemo(() => headsQuery.data?.rows ?? [], [headsQuery.data?.rows])
  const headIdFromUrl = searchParams.get('approvalHeadId')?.trim() ?? ''

  useEffect(() => {
    if (!approvalHeads.length) return
    setSelectedHeadId((current) => {
      if (headIdFromUrl && approvalHeads.some((head) => head.id === headIdFromUrl)) {
        return headIdFromUrl
      }
      if (current && approvalHeads.some((head) => head.id === current)) return current
      return approvalHeads[0]?.id ?? ''
    })
  }, [approvalHeads, headIdFromUrl])

  const approvableTypesQuery = useQuery({
    queryKey: [APPROVABLE_TYPES_QUERY_KEY],
    queryFn: fetchApprovableTypes,
    staleTime: 60_000,
    enabled: canRead,
  })

  const { moduleLabelByValue } = useApprovableTypeMaps(
    approvableTypesQuery.data,
  )

  const listQuery = useQuery({
    queryKey: [DEFINITIONS_QUERY_KEY, selectedHeadId, page, pageSize],
    queryFn: () => fetchWorkflowDefinitionsPage(selectedHeadId, '', page, pageSize),
    enabled: canRead && Boolean(selectedHeadId),
  })

  const rows = useMemo(() => listQuery.data?.rows ?? [], [listQuery.data?.rows])
  const totalCount = listQuery.data?.totalCount ?? rows.length
  const effectivePageSize = listQuery.data?.effectivePageSize ?? pageSize
  const totalPages =
    listQuery.data?.totalPages ?? Math.max(1, Math.ceil(totalCount / effectivePageSize))

  const onEdit = (row: WorkflowDefinitionTableRow) => {
    if (!canUpdate) return
    navigate(`/settings/approval-definations/${encodeURIComponent(row.id)}/edit`)
  }

  const addHref = selectedHeadId
    ? `/settings/approval-definations/add?approvalHeadId=${encodeURIComponent(selectedHeadId)}`
    : '/settings/approval-definations/add'

  const selectedHeadName =
    approvalHeads.find((head) => head.id === selectedHeadId)?.name ?? ''

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Approval Rules"
          subtitle="Manage workflow definitions for each approval head"
        />
        {canCreate ? (
          selectedHeadId ? (
            <Button
              type="button"
              className="w-full bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)] sm:w-auto"
              asChild
            >
              <Link to={addHref}>
                <Plus className="mr-1 h-4 w-4" />
                Add New
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              className="w-full bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)] sm:w-auto"
              disabled
            >
              <Plus className="mr-1 h-4 w-4" />
              Add New
            </Button>
          )
        ) : null}
      </div>

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="space-y-4 p-0">
          {headsQuery.isLoading ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={`tab-sk-${index}`} className="h-9 w-24 rounded-lg" />
              ))}
            </div>
          ) : headsQuery.isError ? (
            <p className="text-sm text-[var(--fms-delete)]">Failed to load approval heads.</p>
          ) : approvalHeads.length === 0 ? (
            <p className="text-sm text-[var(--fms-text-subheading)]">
              No approval heads found. Create an approval head first.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {approvalHeads.map((head) => {
                const isActive = head.id === selectedHeadId
                return (
                  <button
                    key={head.id}
                    type="button"
                    onClick={() => {
                      setSelectedHeadId(head.id)
                      setPage(1)
                    }}
                    className={cn(
                      'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-[var(--fms-button)] text-white'
                        : 'text-[var(--fms-button)] hover:bg-[var(--fms-info-fill)]',
                    )}
                  >
                    {head.name}
                  </button>
                )
              })}
            </div>
          )}

          {selectedHeadName ? (
            <p className="text-sm text-[var(--fms-text-subheading)]">
              Showing rules for{' '}
              <span className="font-medium text-[var(--fms-text-header)]">{selectedHeadName}</span>
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-lg border border-[var(--fms-strokes)]">
            <table className="min-w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  {['Sl.No', 'Type', 'Rule Name', 'Start Date', 'End Date', 'Status'].map((column) => (
                    <th key={column} className="px-4 py-3 text-left font-semibold">
                      {column}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center font-semibold ">Action</th>
                </tr>
              </thead>
              <tbody>
                {crud.isResolved && !canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      You do not have permission to view this data.
                    </td>
                  </tr>
                ) : !selectedHeadId ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      Select an approval head to view rules.
                    </td>
                  </tr>
                ) : listQuery.isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={`rule-sk-${index}`} className="border-t border-[var(--fms-strokes)]">
                      {Array.from({ length: 7 }).map((__, cellIndex) => (
                        <td key={cellIndex} className="px-4 py-3">
                          <Skeleton className="h-4 w-full max-w-[8rem]" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : listQuery.isError ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td colSpan={7} className="px-4 py-6 text-center text-[var(--fms-delete)]">
                      Failed to load approval rules.
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      No records found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-t border-[var(--fms-strokes)]">
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">{row.serialNo}</td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                          {formatModuleLabel(row.workflow_module_id, moduleLabelByValue)}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">{row.name || '-'}</td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.start_date || '-'}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.end_date || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge active={row.is_active} />
                      </td>
                      <td className="px-4 py-3">
                        <div className={rowActionsContainerClassName}>
                          <DetailRowActionButton
                            type="button"
                            tooltip="Detail"
                            disabled={!canRead}
                            onClick={() => setDetailRow(row)}
                          />
                          <EditRowActionButton
                            type="button"
                            tooltip="EDIT"
                            disabled={!canUpdate}
                            onClick={() => onEdit(row)}
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
            onPageChange={(nextPage) => setPage(Math.max(1, Math.min(nextPage, totalPages)))}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize)
              setPage(1)
            }}
          />
        </CardContent>
      </Card>

      <Dialog open={!!detailRow} onOpenChange={(open) => !open && setDetailRow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Approval Rule Detail</DialogTitle>
          </DialogHeader>
          {detailRow ? (
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="font-medium text-[var(--fms-text-header)]">For</dt>
                <dd className="text-[var(--fms-text-subheading)]">
                  {formatModuleLabel(detailRow.workflow_module_id, moduleLabelByValue)}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-[var(--fms-text-header)]">Rule Name</dt>
                <dd className="text-[var(--fms-text-subheading)]">{detailRow.name || '-'}</dd>
              </div>
              <div>
                <dt className="font-medium text-[var(--fms-text-header)]">Start Date</dt>
                <dd className="text-[var(--fms-text-subheading)]">{detailRow.start_date || '-'}</dd>
              </div>
              <div>
                <dt className="font-medium text-[var(--fms-text-header)]">End Date</dt>
                <dd className="text-[var(--fms-text-subheading)]">{detailRow.end_date || '-'}</dd>
              </div>
              <div>
                <dt className="font-medium text-[var(--fms-text-header)]">Status</dt>
                <dd className="pt-1">
                  <StatusBadge active={detailRow.is_active} />
                </dd>
              </div>
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  )
}

export default ApprovalDefinations
