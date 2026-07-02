import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ParkingClaimStatusCell } from '@/features/parking/components/ParkingClaimStatusCell'
import { ParkingLogStatusCell } from '@/features/parking/components/ParkingLogStatusCell'
import {
  approveParkingClaimLineItem,
  decideParkingClaim,
  fetchParkingClaimById,
  returnParkingClaimLineItem,
  type ParkingClaimDecideAction,
} from '@/features/parking/lib/parking-logs-api'
import {
  formatParkingLogDate,
  type ParkingLogListRow,
} from '@/features/parking/lib/parking-logs-mock-data'
import {
  ListPanelMessage,
  MobileListCard,
  MobileListField,
} from '@/shared/components/MobileListCard'
import {
  ApproveLineItemActionButton,
  ReturnLineItemActionButton,
  rowActionsContainerClassName,
} from '@/shared/components/TableRowActionButtons'
import { TablePagination } from '@/shared/components/TablePagination'
import { useAccessControl } from '@/shared/hooks/useAccessControl'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'
import { cn } from '@/lib/utils'

const DETAIL_COLUMNS = ['Date', 'Vehicle', 'Location', 'Amount', 'Receipt', 'Status'] as const
const TABLE_COLUMN_COUNT = DETAIL_COLUMNS.length + 1

function formatCurrency(amount: number): string {
  return `Nu. ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

function resolveClaimReviewerRole(role: string): 'mto' | 'finance' | 'accountant' | null {
  const normalized = role.toLowerCase()
  if (normalized.includes('accountant')) return 'accountant'
  if (
    normalized.includes('finance-officer') ||
    normalized.includes('finance_officer') ||
    normalized.includes('finance officer')
  ) {
    return 'finance'
  }
  if (normalized.includes('mto')) return 'mto'
  return null
}

function resolveExpectedReviewerRoleFromCurrentLevel(
  levelName: string | undefined,
): 'mto' | 'finance' | 'accountant' | null {
  const normalized = (levelName ?? '').trim().toLowerCase()
  if (!normalized) return null
  if (normalized.includes('accountant')) return 'accountant'
  if (normalized.includes('finance')) return 'finance'
  if (normalized.includes('mto')) return 'mto'
  return null
}

function ClaimInfoField({ label, value }: { label: string; value?: string }) {
  if (!value?.trim()) return null
  return (
    <div className="min-w-0 rounded-md border border-[var(--fms-strokes)]/70 bg-[#fafafa] px-2.5 py-1.5">
      <p className="text-[12px] text-[var(--fms-text-subheading)]">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-[var(--fms-text-header)]">{value}</p>
    </div>
  )
}

function ViewReceiptButton({ log }: { log: ParkingLogListRow }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 gap-1.5 border-[var(--fms-strokes)] text-[var(--fms-primary)]"
      disabled={!log.receiptUrl?.trim()}
      onClick={() => {
        try {
          const target = log.receiptUrl?.trim()
          if (!target) throw new Error('Receipt URL is missing for this log.')
          window.open(target, '_blank', 'noopener,noreferrer')
        } catch (error) {
          showErrorToast(
            error instanceof Error ? error.message : 'Could not open receipt file.',
          )
        }
      }}
    >
      <Eye className="h-3.5 w-3.5" />
      {log.receiptFileName || 'View'}
    </Button>
  )
}

export default function ReimbursementClaimDetailPage() {
  const { claimId = '' } = useParams<{ claimId: string }>()
  const resolvedClaimId = decodeURIComponent(claimId)
  const queryClient = useQueryClient()
  const crud = useRouteCrudPermissions('/parking/reimbursement-claims')
  const { role } = useAccessControl()
  const reviewerRole = resolveClaimReviewerRole(role)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [decideDialogOpen, setDecideDialogOpen] = useState(false)
  const [decideAction, setDecideAction] = useState<ParkingClaimDecideAction>('APPROVE')
  const [decideRemarks, setDecideRemarks] = useState('')
  const [returnDialogOpen, setReturnDialogOpen] = useState(false)
  const [returnLineItemId, setReturnLineItemId] = useState('')
  const [returnRemarks, setReturnRemarks] = useState('')

  const claimQuery = useQuery({
    queryKey: ['parking-reimbursement-claim-detail', resolvedClaimId],
    queryFn: () => fetchParkingClaimById(resolvedClaimId),
    enabled: resolvedClaimId.trim().length > 0,
    staleTime: 30_000,
  })

  const selectedClaim = claimQuery.data ?? null

  const detailRows = useMemo(
    () => [...(selectedClaim?.logs ?? [])].sort((a, b) => b.date.localeCompare(a.date)),
    [selectedClaim?.logs],
  )

  const totalAmount = selectedClaim?.amount ?? detailRows.reduce((sum, row) => sum + row.amount, 0)
  const claimStatus = selectedClaim?.status ?? 'PENDING_APPROVAL'
  const totalCount = detailRows.length
  const totalPages = Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize)))
  const pageStart = Math.max(0, (page - 1) * pageSize)
  const pageRows = detailRows.slice(pageStart, pageStart + pageSize)
  const hasDriverContext = Boolean(
    selectedClaim?.driverName ||
    selectedClaim?.agencyName ||
    selectedClaim?.departmentName ||
    selectedClaim?.divisionName ||
    selectedClaim?.subDivisionName,
  )

  const canApproveLineItems = crud.isResolved && crud.canApprove
  const canPayClaim = crud.isResolved && crud.hasAction('pay')
  const isMtoCurrentLevel = selectedClaim?.currentLevelCode?.trim().toUpperCase() === 'MTO'
  const hasLineItems = detailRows.length > 0
  const allLineItemsApproved =
    hasLineItems && detailRows.every((lineItem) => lineItem.status === 'LINE_APPROVED')
  const currentLevelReviewer = resolveExpectedReviewerRoleFromCurrentLevel(
    selectedClaim?.currentLevelName,
  )
  const canActAtCurrentLevel =
    reviewerRole !== null &&
    currentLevelReviewer !== null &&
    reviewerRole === currentLevelReviewer
  const showMtoApprove =
    canActAtCurrentLevel &&
    reviewerRole === 'mto' &&
    crud.isResolved &&
    crud.canApprove &&
    isMtoCurrentLevel &&
    allLineItemsApproved
  const showMtoReject =
    canActAtCurrentLevel && reviewerRole === 'mto' && crud.isResolved && crud.canReject
  const showFinanceForward =
    canActAtCurrentLevel && reviewerRole === 'finance' && crud.isResolved && crud.canApprove
  const showFinanceReject =
    canActAtCurrentLevel && reviewerRole === 'finance' && crud.isResolved && crud.canReject
  const showAccountantPay = canActAtCurrentLevel && reviewerRole === 'accountant' && canPayClaim
  const showClaimDecisionActions =
    showMtoApprove ||
    showMtoReject ||
    showFinanceForward ||
    showFinanceReject ||
    showAccountantPay

  const decideDialogTitle =
    decideAction === 'REJECT'
      ? 'Reject Claim'
      : reviewerRole === 'finance'
        ? 'Forward to Accountant'
        : reviewerRole === 'accountant'
          ? 'Pay Claim'
          : 'Approve Claim'

  const openDecideDialog = (action: ParkingClaimDecideAction) => {
    setDecideAction(action)
    setDecideRemarks('')
    setDecideDialogOpen(true)
  }

  const decideMutation = useMutation({
    mutationFn: () =>
      decideParkingClaim(resolvedClaimId, {
        action: decideAction,
        remarks: decideRemarks.trim(),
      }),
    onSuccess: async () => {
      const successMessage =
        decideAction === 'REJECT'
          ? 'Claim rejected.'
          : reviewerRole === 'finance'
            ? 'Claim forwarded to Accountant.'
            : reviewerRole === 'accountant'
              ? 'Claim marked as paid.'
              : 'Claim approved.'
      showSuccessToast(successMessage)
      setDecideDialogOpen(false)
      setDecideRemarks('')
      await queryClient.invalidateQueries({
        queryKey: ['parking-reimbursement-claim-detail', resolvedClaimId],
      })
      await queryClient.invalidateQueries({ queryKey: ['parking-reimbursement-claims-source'] })
    },
    onError: (error) => {
      showErrorToast(error, 'Could not update claim status.')
    },
  })

  const approveLineMutation = useMutation({
    mutationFn: (lineItemId: string) =>
      approveParkingClaimLineItem(resolvedClaimId, lineItemId),
    onSuccess: async () => {
      showSuccessToast('Line item approved.')
      await queryClient.invalidateQueries({
        queryKey: ['parking-reimbursement-claim-detail', resolvedClaimId],
      })
    },
    onError: (error) => {
      showErrorToast(error, 'Could not approve line item.')
    },
  })

  const returnLineMutation = useMutation({
    mutationFn: ({ lineItemId, remarks }: { lineItemId: string; remarks: string }) =>
      returnParkingClaimLineItem(resolvedClaimId, lineItemId, { remarks }),
    onSuccess: async () => {
      showSuccessToast('Line item returned.')
      setReturnDialogOpen(false)
      setReturnLineItemId('')
      setReturnRemarks('')
      await queryClient.invalidateQueries({
        queryKey: ['parking-reimbursement-claim-detail', resolvedClaimId],
      })
    },
    onError: (error) => {
      showErrorToast(error, 'Could not return line item.')
    },
  })

  const lineItemActionPending =
    approveLineMutation.isPending || returnLineMutation.isPending
  const pendingLineItemId =
    (approveLineMutation.isPending && approveLineMutation.variables) ||
    (returnLineMutation.isPending && returnLineMutation.variables?.lineItemId) ||
    null

  const openReturnDialog = (lineItemId: string) => {
    setReturnLineItemId(lineItemId)
    setReturnRemarks('')
    setReturnDialogOpen(true)
  }

  const closeReturnDialog = () => {
    if (returnLineMutation.isPending) return
    setReturnDialogOpen(false)
    setReturnLineItemId('')
    setReturnRemarks('')
  }

  const confirmReturnLineItem = () => {
    const remarks = returnRemarks.trim()
    if (!returnLineItemId || !remarks) return
    returnLineMutation.mutate({ lineItemId: returnLineItemId, remarks })
  }

  useEffect(() => {
    setPage(1)
  }, [pageSize, resolvedClaimId])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const renderLineItemActions = (row: ParkingLogListRow) => {
    if (!canApproveLineItems) return null

    const isConsolidated = row.status === 'CONSOLIDATED'
    const isResubmitted = row.status === 'RESUBMITTED'
    const isLineApproved = row.status === 'LINE_APPROVED'
    if (!isConsolidated && !isLineApproved && !isResubmitted) return null

    const isPending = lineItemActionPending && pendingLineItemId === row.id
    return (
      <div className={rowActionsContainerClassName}>
        <ApproveLineItemActionButton
          type="button"
          tooltip={isLineApproved ? 'Line item approved' : 'Approve line item'}
          disabled={isLineApproved || lineItemActionPending}
          className={cn(
            isLineApproved &&
              'border-[var(--fms-success-border)] bg-[var(--fms-success-fill)] text-[var(--fms-success-text)] disabled:opacity-100 hover:brightness-100',
          )}
          onClick={() => approveLineMutation.mutate(row.id)}
        />
        {isConsolidated || isResubmitted ? (
          <ReturnLineItemActionButton
            type="button"
            tooltip="Return line item"
            disabled={lineItemActionPending}
            onClick={() => openReturnDialog(row.id)}
          />
        ) : null}
        {isPending ? (
          <span className="text-xs text-[var(--fms-text-subheading)]">Saving…</span>
        ) : null}
      </div>
    )
  }

  return (
    <section className="space-y-5">
      <Button type="button" variant="outline" asChild>
        <Link to="/parking/reimbursement-claims">Back to claims</Link>
      </Button>

      <Card className="min-w-0 rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="min-w-0 space-y-4 p-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-[var(--fms-text-header)] sm:text-2xl">
                {selectedClaim?.monthLabel
                  ? `${selectedClaim.monthLabel} Claim Details`
                  : 'Claim Details'}
              </h1>
              {selectedClaim?.referenceNo ? (
                <p className="mt-1 text-sm text-[var(--fms-text-subheading)]">
                  Reference No.:{' '}
                  <span className="font-medium text-[var(--fms-text-header)]">
                    {selectedClaim.referenceNo}
                  </span>
                </p>
              ) : null}
            </div>
            <ParkingClaimStatusCell status={claimStatus} />
          </div>

          {hasDriverContext ? (
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
              <ClaimInfoField label="Driver" value={selectedClaim?.driverName} />
              <ClaimInfoField label="Agency" value={selectedClaim?.agencyName} />
              <ClaimInfoField label="Department" value={selectedClaim?.departmentName} />
              <ClaimInfoField label="Division" value={selectedClaim?.divisionName} />
              <ClaimInfoField label="Sub Division" value={selectedClaim?.subDivisionName} />
            </div>
          ) : null}

          <div className="hidden w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
            <table className="w-max min-w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  {DETAIL_COLUMNS.map((column) => (
                    <th key={column} className="px-4 py-3 text-left font-semibold">
                      {column}
                    </th>
                  ))}
                  {canApproveLineItems ? (
                    <th className="px-4 py-3 text-center font-semibold">Action</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {claimQuery.isLoading ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={canApproveLineItems ? TABLE_COLUMN_COUNT : DETAIL_COLUMNS.length}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      Loading claim details...
                    </td>
                  </tr>
                ) : claimQuery.isError ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={canApproveLineItems ? TABLE_COLUMN_COUNT : DETAIL_COLUMNS.length}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      {claimQuery.error instanceof Error
                        ? claimQuery.error.message
                        : 'Could not load claim details.'}
                    </td>
                  </tr>
                ) : !selectedClaim ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={canApproveLineItems ? TABLE_COLUMN_COUNT : DETAIL_COLUMNS.length}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      Claim details were not found.
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={canApproveLineItems ? TABLE_COLUMN_COUNT : DETAIL_COLUMNS.length}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      No parking logs found for this claim.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row) => (
                    <tr key={row.id} className="border-t border-[var(--fms-strokes)]">
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {formatParkingLogDate(row.date)}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">
                        {row.vehicleRegistrationNumber || '—'}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">{row.location}</td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {formatCurrency(row.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <ViewReceiptButton log={row} />
                      </td>
                      <td className="px-4 py-3">
                        <ParkingLogStatusCell status={row.status} />
                      </td>
                      {canApproveLineItems ? (
                        <td className="px-4 py-3">{renderLineItemActions(row)}</td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {claimQuery.isLoading ? (
              <ListPanelMessage>Loading claim details...</ListPanelMessage>
            ) : claimQuery.isError ? (
              <ListPanelMessage tone="error">
                {claimQuery.error instanceof Error
                  ? claimQuery.error.message
                  : 'Could not load claim details.'}
              </ListPanelMessage>
            ) : !selectedClaim ? (
              <ListPanelMessage>Claim details were not found.</ListPanelMessage>
            ) : pageRows.length === 0 ? (
              <ListPanelMessage>No parking logs found for this claim.</ListPanelMessage>
            ) : (
              pageRows.map((row) => (
                <MobileListCard key={row.id}>
                  <MobileListField label="Date">{formatParkingLogDate(row.date)}</MobileListField>
                  <MobileListField label="Vehicle">
                    {row.vehicleRegistrationNumber || '—'}
                  </MobileListField>
                  <MobileListField label="Location">{row.location}</MobileListField>
                  <MobileListField label="Amount">{formatCurrency(row.amount)}</MobileListField>
                  <MobileListField label="Receipt">
                    <ViewReceiptButton log={row} />
                  </MobileListField>
                  <MobileListField label="Status">
                    <ParkingLogStatusCell status={row.status} />
                  </MobileListField>
                  {canApproveLineItems ? (
                    <MobileListField label="Action">{renderLineItemActions(row)}</MobileListField>
                  ) : null}
                </MobileListCard>
              ))
            )}
          </div>

          <TablePagination
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={(nextPage) => setPage(Math.max(1, Math.min(nextPage, totalPages)))}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize)
              setPage(1)
            }}
          />

          <Card className="rounded-xl border border-[#a6c7ff] bg-[#edf4ff]">
            <CardContent className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[var(--fms-text-subheading)]">Total Claim Amount</p>
              <p className="text-2xl font-semibold text-[var(--fms-primary)]">
                {formatCurrency(totalAmount)}
              </p>
            </CardContent>
          </Card>

          {showClaimDecisionActions ? (
            <div className="flex flex-col justify-start gap-2 sm:flex-row sm:flex-wrap">
              {showMtoApprove ? (
                <Button type="button" onClick={() => openDecideDialog('APPROVE')}>
                  Approve & Forward to Finance
                </Button>
              ) : null}
              {showFinanceForward ? (
                <Button type="button" onClick={() => openDecideDialog('APPROVE')}>
                  Approve & Forward to Accountant
                </Button>
              ) : null}
              {showAccountantPay ? (
                <Button type="button" onClick={() => openDecideDialog('APPROVE')}>
                  Paid
                </Button>
              ) : null}
              {/* {showMtoReject || showFinanceReject ? (
                <Button
                  type="button"
                  variant="outline"
                  className="border-[var(--fms-error-border)] text-[var(--fms-error-text)]"
                  onClick={() => openDecideDialog('REJECT')}
                >
                  Reject
                </Button>
              ) : null} */}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={decideDialogOpen} onOpenChange={setDecideDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{decideDialogTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="claim-decide-remarks">
              Remarks <span className="text-[var(--fms-delete)]">*</span>
            </Label>
            <textarea
              id="claim-decide-remarks"
              value={decideRemarks}
              onChange={(event) => setDecideRemarks(event.target.value)}
              placeholder="Enter remarks for this action."
              className="min-h-[88px] w-full rounded-lg border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={decideMutation.isPending}
              onClick={() => setDecideDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={
                decideAction === 'REJECT'
                  ? 'bg-[#c53030] text-white hover:bg-[#b83232]'
                  : undefined
              }
              disabled={!decideRemarks.trim() || decideMutation.isPending}
              onClick={() => decideMutation.mutate()}
            >
              {decideMutation.isPending ? 'Saving…' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={returnDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setReturnDialogOpen(true)
            return
          }
          closeReturnDialog()
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Return Line Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="line-item-return-remarks">
              Remarks <span className="text-[var(--fms-delete)]">*</span>
            </Label>
            <textarea
              id="line-item-return-remarks"
              value={returnRemarks}
              onChange={(event) => setReturnRemarks(event.target.value)}
              placeholder="Enter remarks for returning this line item."
              className="min-h-[88px] w-full rounded-lg border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={returnLineMutation.isPending}
              onClick={closeReturnDialog}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!returnRemarks.trim() || returnLineMutation.isPending}
              onClick={confirmReturnLineItem}
            >
              {returnLineMutation.isPending ? 'Saving…' : 'Confirm Return'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
