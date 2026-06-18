import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  formatNuDisplay,
} from '@/features/fuel/lib/quota-request-mock-data'
import {
  fetchQuotaRequestById,
  formatQuotaRequestSource,
  resubmitQuotaRequestMto,
  reviewQuotaRequestFinance,
  reviewQuotaRequestMto,
  type QuotaRequestListRow,
} from '@/features/fuel/lib/quota-requests-api'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/shared/components/PageHeader'
import { DetailFieldBoxSkeleton } from '@/shared/components/detail-loading'
import { useAccessControl } from '@/shared/hooks/useAccessControl'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

function RequiredMark() {
  return <span className="text-[var(--fms-delete)]">*</span>
}

function DetailFieldBox({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--fms-strokes)] bg-[#f8f8f9] px-4 py-3',
        className,
      )}
    >
      <p className="text-sm text-[var(--fms-text-subheading)]">
        {label} <RequiredMark />
      </p>
      <p className="mt-1 text-base font-semibold text-[var(--fms-text-header)]">
        {value || '—'}
      </p>
    </div>
  )
}

function resolvePrepaymentAmount(request: QuotaRequestListRow): number {
  return (
    request.financeApprovedAmount ??
    request.mtoApprovedAmount ??
    request.recommendedAmount ??
    0
  )
}

type QuotaRequestDetailContentProps = {
  request: QuotaRequestListRow
  replenishMode: boolean
  canActAsMto: boolean
  canActAsFinanceOfficer: boolean
  canResubmitAsMto: boolean
}

function QuotaRequestDetailContent({
  request,
  replenishMode,
  canActAsMto,
  canActAsFinanceOfficer,
  canResubmitAsMto,
}: QuotaRequestDetailContentProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const crud = useRouteCrudPermissions('/fuel/quota-request-list')

  const [prepaymentAmount, setPrepaymentAmount] = useState(
    String(resolvePrepaymentAmount(request)),
  )
  const [remarks, setRemarks] = useState(request.remarks)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectRemarks, setRejectRemarks] = useState('')

  useEffect(() => {
    setPrepaymentAmount(String(resolvePrepaymentAmount(request)))
    setRemarks(request.remarks)
    setRejectRemarks(request.remarks)
  }, [request.id, request.financeApprovedAmount, request.mtoApprovedAmount, request.recommendedAmount, request.remarks])

  const currentQuota = formatNuDisplay(request.balanceAtRequest)
  const recommendedAmount = formatNuDisplay(request.recommendedAmount)

  const parsedPrepayment = Number(prepaymentAmount)
  const canSubmit =
    replenishMode &&
    Number.isFinite(parsedPrepayment) &&
    parsedPrepayment > 0 &&
    remarks.trim().length > 0
  const canRejectSubmit =
    Number.isFinite(parsedPrepayment) &&
    parsedPrepayment > 0 &&
    rejectRemarks.trim().length > 0

  const reviewMutation = useMutation({
    mutationFn: async ({
      action,
      overrideRemarks,
    }: {
      action: 'forward' | 'approve' | 'reject'
      overrideRemarks?: string
    }) => {
      if (!crud.canUpdate && crud.isResolved) {
        throw new Error('You do not have permission to review this request')
      }
      const effectiveRemarks = (overrideRemarks ?? remarks).trim()
      if (!Number.isFinite(parsedPrepayment) || parsedPrepayment <= 0) {
        throw new Error('Enter approved amount before submitting')
      }
      if (!effectiveRemarks) throw new Error('Remarks are required')
      if (canActAsMto && (action === 'forward' || action === 'reject')) {
        await reviewQuotaRequestMto(request.id, action, parsedPrepayment, effectiveRemarks)
        return
      }
      if (canActAsFinanceOfficer && (action === 'approve' || action === 'reject')) {
        await reviewQuotaRequestFinance(request.id, action, parsedPrepayment, effectiveRemarks)
        return
      }
      throw new Error('Your role cannot review this request')
    },
    onSuccess: async (_, variables) => {
      const successLabel =
        variables.action === 'forward'
          ? 'forwarded to Finance Officer'
          : variables.action === 'approve'
            ? 'approved'
            : 'rejected'
      showSuccessToast(`Fuel request ${successLabel}`)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['fuel-quota-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['fuel-quota-request', request.id] }),
      ])
      navigate('/fuel/quota-request-list')
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to review fuel request')
    },
  })

  const resubmitMutation = useMutation({
    mutationFn: async () => {
      if (!crud.canUpdate && crud.isResolved) {
        throw new Error('You do not have permission to resubmit this request')
      }
      if (!canResubmitAsMto) {
        throw new Error('Only MTO can resubmit finance rejected requests')
      }
      if (!canSubmit) {
        throw new Error('Enter approved amount and remarks before resubmitting')
      }
      await resubmitQuotaRequestMto(request.id, parsedPrepayment, remarks)
    },
    onSuccess: async () => {
      showSuccessToast('Fuel request resubmitted')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['fuel-quota-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['fuel-quota-request', request.id] }),
      ])
      navigate('/fuel/quota-request-list')
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to resubmit fuel request')
    },
  })

  const handleAction = (action: 'forward' | 'approve' | 'reject') => {
    if (action === 'reject') {
      setRejectDialogOpen(true)
      return
    }
    if (!canSubmit) {
      showErrorToast('Enter approved amount and remarks before submitting')
      return
    }
    reviewMutation.mutate({ action })
  }

  const handleConfirmReject = () => {
    if (!canRejectSubmit) {
      showErrorToast('Enter approved amount and remarks before rejecting')
      return
    }
    reviewMutation.mutate(
      { action: 'reject', overrideRemarks: rejectRemarks },
      {
        onSuccess: () => {
          setRejectDialogOpen(false)
          setRemarks(rejectRemarks.trim())
        },
      },
    )
  }

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" asChild>
          <Link
            to="/fuel/quota-request-list"
            aria-label="Back to quota requests"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader title="Fuel Request Details" />
      </div>

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white">
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailFieldBox label="Driver Name" value={request.driverName} />
            <DetailFieldBox label="Vehicle Number" value={request.vehicle} />
            <DetailFieldBox label="Contact Number" value={request.contactNumber} />
            <DetailFieldBox
              label="Request Source"
              value={formatQuotaRequestSource(request.requestSource)}
            />
            <DetailFieldBox label="Current Quota" value={currentQuota} />
            <DetailFieldBox
              label="Recommended Amount"
              value={recommendedAmount}
            />

            {replenishMode ? (
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="prepayment-amount">
                  Prepayment Amount <RequiredMark />
                </Label>
                <Input
                  id="prepayment-amount"
                  type="number"
                  min={0}
                  value={prepaymentAmount}
                  onChange={(event) => setPrepaymentAmount(event.target.value)}
                  className="font-semibold text-[var(--fms-text-header)]"
                />
              </div>
            ) : (
              <DetailFieldBox
                label="Prepayment Amount"
                value={formatNuDisplay(resolvePrepaymentAmount(request))}
              />
            )}

            {replenishMode ? (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="finance-remarks">
                  Remarks <RequiredMark />
                </Label>
                <textarea
                  id="finance-remarks"
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  placeholder="Enter remarks for the Finance Officer."
                  className="min-h-[88px] w-full rounded-lg border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>
            ) : (
              <DetailFieldBox
                label="Remarks"
                value={request.remarks || '—'}
                className="sm:col-span-2"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {replenishMode && (canActAsMto || canActAsFinanceOfficer || canResubmitAsMto) ? (
        <div className="flex flex-wrap gap-3">
          {canActAsMto ? (
            <Button
              type="button"
              className="bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)]"
              disabled={!canSubmit || (!crud.canUpdate && crud.isResolved) || reviewMutation.isPending}
              onClick={() => handleAction('forward')}
            >
              Forward to Finance Officer
            </Button>
          ) : null}
          {canActAsFinanceOfficer ? (
            <Button
              type="button"
              className="bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)]"
              disabled={!canSubmit || (!crud.canUpdate && crud.isResolved) || reviewMutation.isPending}
              onClick={() => handleAction('approve')}
            >
              Approve
            </Button>
          ) : null}
          {canResubmitAsMto ? (
            <Button
              type="button"
              className="bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)]"
              disabled={!canSubmit || (!crud.canUpdate && crud.isResolved) || resubmitMutation.isPending}
              onClick={() => resubmitMutation.mutate()}
            >
              Resubmit
            </Button>
          ) : null}
          {(canActAsMto || canActAsFinanceOfficer) ? (
            <Button
              type="button"
              variant="outline"
              className="border-[#f5c6cb] bg-[#fde8e8] text-[#c53030] hover:bg-[#fde8e8]"
              disabled={(!crud.canUpdate && crud.isResolved) || reviewMutation.isPending}
              onClick={() => handleAction('reject')}
            >
              Reject
            </Button>
          ) : null}
        </div>
      ) : (
        <Button type="button" variant="outline" asChild>
          <Link to="/fuel/quota-request-list">Back to list</Link>
        </Button>
      )}

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Fuel Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-remarks">
              Remarks <RequiredMark />
            </Label>
            <textarea
              id="reject-remarks"
              value={rejectRemarks}
              onChange={(event) => setRejectRemarks(event.target.value)}
              placeholder="Enter reason for rejection."
              className="min-h-[88px] w-full rounded-lg border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={reviewMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#c53030] text-white hover:bg-[#b83232]"
              onClick={handleConfirmReject}
              disabled={!canRejectSubmit || reviewMutation.isPending}
            >
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

export default function QuotaRequestDetailPage() {
  const { requestId = '' } = useParams<{ requestId: string }>()
  const { pathname } = useLocation()
  const replenishMode = pathname.endsWith('/replenish')
  const crud = useRouteCrudPermissions('/fuel/quota-request-list')
  const { apiRoleName } = useAccessControl()

  const detailQuery = useQuery({
    queryKey: ['fuel-quota-request', requestId],
    queryFn: () => fetchQuotaRequestById(requestId),
    enabled: Boolean(requestId.trim()) && (!crud.isResolved || crud.canRead),
    staleTime: 30_000,
  })

  const request = detailQuery.data
  const normalizedRole = apiRoleName?.trim().toLowerCase() ?? ''
  const canReviewAsMto = normalizedRole.includes('mto')
  const canReviewAsFinanceOfficer =
    normalizedRole.includes('finance-officer') ||
    normalizedRole.includes('finance_officer') ||
    normalizedRole.includes('finance officer')
  const canActAsMto = canReviewAsMto && request?.status === 'PENDING'
  const canActAsFinanceOfficer = canReviewAsFinanceOfficer && request?.status === 'FORWARDED'
  const canResubmitAsMto = canReviewAsMto && request?.status === 'FINANCE_REJECTED'

  if (crud.isResolved && !crud.canRead) {
    return (
      <section className="space-y-5">
        <PageHeader title="Fuel Request Details" />
        <p className="text-sm text-[var(--fms-text-subheading)]">
          You do not have permission to view this request.
        </p>
      </section>
    )
  }

  if (detailQuery.isLoading) {
    return (
      <section className="space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild>
            <Link
              to="/fuel/quota-request-list"
              aria-label="Back to quota requests"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <PageHeader title="Fuel Request Details" />
        </div>

        <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white">
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailFieldBoxSkeleton label="Driver Name" />
              <DetailFieldBoxSkeleton label="Vehicle Number" />
              <DetailFieldBoxSkeleton label="Contact Number" />
              <DetailFieldBoxSkeleton label="Request Source" />
              <DetailFieldBoxSkeleton label="Current Quota" />
              <DetailFieldBoxSkeleton label="Recommended Amount" />
              <DetailFieldBoxSkeleton label="Prepayment Amount" />
            </div>
          </CardContent>
        </Card>
      </section>
    )
  }

  if (detailQuery.isError || !request) {
    return (
      <section className="space-y-5">
        <Button variant="outline" size="icon" asChild>
          <Link to="/fuel/quota-request-list" aria-label="Back to quota requests">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader title="Fuel Request Details" subtitle="Request not found" />
        <p className="text-sm text-[var(--fms-text-subheading)]">
          {detailQuery.error instanceof Error
            ? detailQuery.error.message
            : `No quota request matches "${requestId}".`}
        </p>
        <Button variant="outline" asChild>
          <Link to="/fuel/quota-request-list">Back to Quota Requests</Link>
        </Button>
      </section>
    )
  }

  if (
    request.status !== 'PENDING' &&
    request.status !== 'FORWARDED' &&
    request.status !== 'FINANCE_REJECTED' &&
    replenishMode
  ) {
    return (
      <section className="space-y-5">
        <PageHeader title="Fuel Request Details" />
        <p className="text-sm text-[var(--fms-text-subheading)]">
          This request is no longer pending and cannot be replenished.
        </p>
        <Button variant="outline" asChild>
          <Link to={`/fuel/quota-request-list/${encodeURIComponent(request.id)}`}>
            View details
          </Link>
        </Button>
      </section>
    )
  }

  return (
    <QuotaRequestDetailContent
      request={request}
      replenishMode={replenishMode}
      canActAsMto={canActAsMto}
      canActAsFinanceOfficer={canActAsFinanceOfficer}
      canResubmitAsMto={canResubmitAsMto}
    />
  )
}
