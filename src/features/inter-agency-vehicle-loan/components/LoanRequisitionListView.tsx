import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { LoanRequisitionStatusCell } from '@/features/inter-agency-vehicle-loan/components/LoanRequisitionStatusCell'
import { cancelLoan, fetchLoansPage } from '@/features/inter-agency-vehicle-loan/lib/loan-requisition-api'
import type { LoanRequisitionListRow, LoanRequisitionStatus } from '@/features/inter-agency-vehicle-loan/lib/loan-requisition-types'
import {
  LOAN_REQUISITION_STATUS_OPTIONS,
  canBorrowerModifyLoan,
  formatLoanDate,
  formatLoanRequisitionStatusLabel,
} from '@/features/inter-agency-vehicle-loan/lib/loan-requisition-ui'
import { FuelTableListToolbar } from '@/features/fuel/components/FuelTableListToolbar'
import { SearchableAutocomplete } from '@/shared/components/SearchableAutocomplete'
import {
  ListPanelMessage,
  MobileListCard,
  MobileListField,
} from '@/shared/components/MobileListCard'
import {
  CancelRowActionButton,
  DetailRowActionButton,
  EditRowActionButton,
  rowActionsContainerClassName,
} from '@/shared/components/TableRowActionButtons'
import { TablePagination } from '@/shared/components/TablePagination'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

type CancelTarget = {
  id: string
  requestId: string
}

export type LoanRequisitionListViewProps = {
  asLending?: boolean
  /** When set, the list is locked to this status and the status filter is hidden. */
  fixedStatus?: LoanRequisitionStatus
  title: string
  permissionPath: string
  detailBackPath: string
  searchAriaLabel: string
  emptyMessage: string
  createPath?: string
  createLabel?: string
  enableBorrowerActions?: boolean
}

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  ...LOAN_REQUISITION_STATUS_OPTIONS.map((status) => ({
    value: status,
    label: formatLoanRequisitionStatusLabel(status),
  })),
]

export function LoanRequisitionListView({
  asLending,
  fixedStatus,
  title,
  permissionPath,
  detailBackPath,
  searchAriaLabel,
  emptyMessage,
  createPath,
  createLabel = 'New Requisition',
  enableBorrowerActions = false,
}: LoanRequisitionListViewProps) {
  const tableColumnCount = asLending ? 8 : 7
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const crud = useRouteCrudPermissions(permissionPath)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<LoanRequisitionStatus | ''>('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null)
  const [cancellationReason, setCancellationReason] = useState('')

  const effectiveStatus = fixedStatus ?? (statusFilter || undefined)

  const listQuery = useQuery({
    queryKey: ['vehicle-loan', 'requisitions', asLending, effectiveStatus, search, page, pageSize],
    queryFn: () => fetchLoansPage(search, page, pageSize, asLending, effectiveStatus),
    enabled: !crud.isResolved || crud.canRead,
    staleTime: 30_000,
  })

  const rows = useMemo(() => listQuery.data?.rows ?? [], [listQuery.data?.rows])
  const totalCount = listQuery.data?.totalCount ?? rows.length
  const effectivePageSize = listQuery.data?.effectivePageSize ?? pageSize
  const totalPages =
    listQuery.data?.totalPages ??
    Math.max(1, Math.ceil(totalCount / Math.max(1, effectivePageSize)))

  useEffect(() => {
    setPage(1)
  }, [search, effectiveStatus, pageSize])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const openDetail = (loanId: string) => {
    navigate(`/vehicle-loan/${encodeURIComponent(loanId)}`, {
      state: { backPath: detailBackPath },
    })
  }

  const openEdit = (loanId: string) => {
    navigate(`/vehicle-loan/requisition/${encodeURIComponent(loanId)}/edit`)
  }

  const cancelMutation = useMutation({
    mutationFn: async ({ loanId, reason }: { loanId: string; reason: string }) =>
      cancelLoan(loanId, reason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['vehicle-loan'] })
      showSuccessToast('Loan cancelled successfully.')
      setCancelTarget(null)
      setCancellationReason('')
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to cancel loan')
    },
  })

  const openCancelDialog = (target: CancelTarget) => {
    setCancelTarget(target)
    setCancellationReason('')
  }

  const closeCancelDialog = () => {
    if (cancelMutation.isPending) return
    setCancelTarget(null)
    setCancellationReason('')
  }

  const confirmCancelLoan = () => {
    if (!cancelTarget) return
    const reason = cancellationReason.trim()
    if (!reason) {
      showErrorToast('Cancellation reason is required.')
      return
    }
    cancelMutation.mutate({ loanId: cancelTarget.id, reason })
  }

  const canModifyRow = (row: LoanRequisitionListRow) =>
    enableBorrowerActions && canBorrowerModifyLoan(row.status)

  const renderRowActions = (row: LoanRequisitionListRow) => (
    <div className={rowActionsContainerClassName}>
      <DetailRowActionButton
        tooltip="View requisition details"
        onClick={() => openDetail(row.id)}
      />
      {canModifyRow(row) && crud.canUpdate ? (
        <EditRowActionButton
          tooltip="Edit requisition"
          onClick={() => openEdit(row.id)}
        />
      ) : null}
      {canModifyRow(row) && crud.canUpdate ? (
        <CancelRowActionButton
          tooltip="Cancel requisition"
          onClick={() => openCancelDialog({ id: row.id, requestId: row.requestId })}
        />
      ) : null}
    </div>
  )

  return (
    <section className="space-y-5">
      <Card className="min-w-0 overflow-visible rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="min-w-0 space-y-4 p-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-xl font-semibold text-[var(--fms-text-header)] sm:text-2xl">
              {title}
            </h1>
            {createPath && crud.canCreate ? (
              <Button asChild className="w-full sm:w-auto">
                <Link to={createPath}>
                  <Plus className="mr-1 h-4 w-4" />
                  {createLabel}
                </Link>
              </Button>
            ) : null}
          </div>

          <FuelTableListToolbar
            search={search}
            onSearchChange={(value) => {
              setSearch(value)
              setPage(1)
            }}
            searchPlaceholder="Search ..."
            searchAriaLabel={searchAriaLabel}
            leading={
              fixedStatus ? undefined : (
                <SearchableAutocomplete
                  value={statusFilter}
                  onChange={(value) => {
                    setStatusFilter(value as LoanRequisitionStatus | '')
                    setPage(1)
                  }}
                  options={STATUS_FILTER_OPTIONS}
                  placeholder="All Statuses"
                  searchPlaceholder="Search status…"
                  emptyMessage="No matching status."
                  className="w-full sm:w-56"
                />
              )
            }
          />

          <div className="hidden w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
            <table className="w-max min-w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Request ID</th>
                  <th className="px-4 py-3 text-left font-semibold">Borrowing Agency</th>
                  {asLending ? (
                    <th className="px-4 py-3 text-left font-semibold">Lending Agency</th>
                  ) : null}
                  <th className="px-4 py-3 text-left font-semibold">No. of Vehicle Requested</th>
                  <th className="px-4 py-3 text-left font-semibold">Start Date</th>
                  <th className="px-4 py-3 text-left font-semibold">End Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-center font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {crud.isResolved && !crud.canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={tableColumnCount}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      You do not have permission to view vehicle loan requisitions.
                    </td>
                  </tr>
                ) : listQuery.isLoading ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={tableColumnCount}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      Loading requisitions…
                    </td>
                  </tr>
                ) : listQuery.isError ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={tableColumnCount}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      {listQuery.error instanceof Error
                        ? listQuery.error.message
                        : 'Could not load requisitions.'}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={tableColumnCount}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      {search.trim() ? 'No requisitions match your search.' : emptyMessage}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className="cursor-pointer border-t border-[var(--fms-strokes)] hover:bg-[#fafafa]"
                      onClick={() => openDetail(row.id)}
                    >
                      <td className="px-4 py-3 font-medium text-[var(--fms-text-header)]">
                        {row.requestId}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">
                        {row.borrowingAgency}
                      </td>
                      {asLending ? (
                        <td className="px-4 py-3 text-[var(--fms-text-header)]">
                          {row.lendingAgency}
                        </td>
                      ) : null}
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">
                        {row.numberOfVehicles}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">
                        {formatLoanDate(row.startDate)}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">
                        {formatLoanDate(row.endDate)}
                      </td>
                      <td className="px-4 py-3">
                        <LoanRequisitionStatusCell status={row.status} />
                      </td>
                      <td
                        className="px-4 py-3 text-center"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {renderRowActions(row)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {crud.isResolved && !crud.canRead ? (
              <ListPanelMessage>
                You do not have permission to view vehicle loan requisitions.
              </ListPanelMessage>
            ) : listQuery.isLoading ? (
              <ListPanelMessage>Loading requisitions…</ListPanelMessage>
            ) : listQuery.isError ? (
              <ListPanelMessage tone="error">
                {listQuery.error instanceof Error
                  ? listQuery.error.message
                  : 'Could not load requisitions.'}
              </ListPanelMessage>
            ) : rows.length === 0 ? (
              <ListPanelMessage>
                {search.trim() ? 'No requisitions match your search.' : emptyMessage}
              </ListPanelMessage>
            ) : (
              rows.map((row) => (
                <MobileListCard key={row.id} onClick={() => openDetail(row.id)}>
                  <MobileListField label="Request ID">{row.requestId}</MobileListField>
                  <MobileListField label="Borrowing Agency">
                    {row.borrowingAgency}
                  </MobileListField>
                  {asLending ? (
                    <MobileListField label="Lending Agency">{row.lendingAgency}</MobileListField>
                  ) : null}
                  <MobileListField label="No. of Vehicle Requested">
                    {row.numberOfVehicles}
                  </MobileListField>
                  <MobileListField label="Start Date">
                    {formatLoanDate(row.startDate)}
                  </MobileListField>
                  <MobileListField label="End Date">
                    {formatLoanDate(row.endDate)}
                  </MobileListField>
                  <MobileListField label="Status">
                    <LoanRequisitionStatusCell status={row.status} />
                  </MobileListField>
                  <div
                    className={`mt-3 ${rowActionsContainerClassName}`}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    {renderRowActions(row)}
                  </div>
                </MobileListCard>
              ))
            )}
          </div>

          {rows.length > 0 ? (
            <TablePagination
              page={page}
              totalPages={totalPages}
              pageSize={effectivePageSize}
              totalCount={totalCount}
              onPageChange={setPage}
              onPageSizeChange={(next) => {
                setPageSize(next)
                setPage(1)
              }}
            />
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={cancelTarget !== null} onOpenChange={(open) => !open && closeCancelDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader className="items-center text-center">
            <div className="mb-2 rounded-full bg-[var(--fms-error-fill)] p-2.5">
              <AlertTriangle className="h-5 w-5 text-[var(--fms-delete)]" />
            </div>
            <DialogTitle>Cancel Loan Requisition</DialogTitle>
            <DialogDescription>
              {cancelTarget
                ? `Are you sure you want to cancel ${cancelTarget.requestId}? This action cannot be undone.`
                : 'Are you sure you want to cancel this loan requisition?'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="loan-cancellation-reason">
              Cancellation Reason <span className="text-[var(--fms-delete)]">*</span>
            </Label>
            <textarea
              id="loan-cancellation-reason"
              value={cancellationReason}
              onChange={(event) => setCancellationReason(event.target.value)}
              placeholder="Provide a reason for cancelling this loan requisition"
              rows={4}
              className="min-h-[96px] w-full rounded-lg border border-[var(--fms-strokes)] bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <DialogFooter className="justify-center gap-2 sm:justify-center">
            <Button
              type="button"
              variant="outline"
              disabled={cancelMutation.isPending}
              onClick={closeCancelDialog}
            >
              Close
            </Button>
            <Button
              type="button"
              className="bg-[var(--fms-delete)] text-white hover:bg-[#c70009]"
              disabled={cancelMutation.isPending}
              onClick={confirmCancelLoan}
            >
              {cancelMutation.isPending ? 'Cancelling…' : 'Confirm Cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
