import { ArrowLeft } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  formatNuDisplay,
  getQuotaRequestById,
  updateQuotaRequest,
  type QuotaRequestRecord,
} from '@/features/fuel/lib/quota-request-mock-data'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/shared/components/PageHeader'
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

type QuotaRequestDetailContentProps = {
  request: QuotaRequestRecord
  replenishMode: boolean
}

function QuotaRequestDetailContent({
  request,
  replenishMode,
}: QuotaRequestDetailContentProps) {
  const navigate = useNavigate()
  const crud = useRouteCrudPermissions('/fuel/quota-request-list')

  const [prepaymentAmount, setPrepaymentAmount] = useState(
    String(request.prepaymentAmount),
  )
  const [remarks, setRemarks] = useState(request.remarks)

  useEffect(() => {
    setPrepaymentAmount(String(request.prepaymentAmount))
    setRemarks(request.remarks)
  }, [request.id, request.prepaymentAmount, request.remarks])

  const driverName = request.name
  const vehicleNumber = request.vehicle
  const currentQuota = formatNuDisplay(request.quotaUsed)
  const recommendedAmount = formatNuDisplay(request.recommendedAmount)

  const parsedPrepayment = Number(prepaymentAmount)
  const canSubmit =
    replenishMode &&
    Number.isFinite(parsedPrepayment) &&
    parsedPrepayment > 0 &&
    remarks.trim().length > 0

  const handleApprove = () => {
    if (!crud.canUpdate && crud.isResolved) return
    if (!canSubmit) {
      showErrorToast('Enter prepayment amount and remarks before approving')
      return
    }
    updateQuotaRequest(request.id, {
      prepaymentAmount: parsedPrepayment,
      remarks: remarks.trim(),
      status: 'APPROVED',
    })
    showSuccessToast('Fuel request approved')
    navigate('/fuel/quota-request-list')
  }

  const handleReject = () => {
    if (!crud.canUpdate && crud.isResolved) return
    if (!canSubmit) {
      showErrorToast('Enter prepayment amount and remarks before rejecting')
      return
    }
    updateQuotaRequest(request.id, {
      prepaymentAmount: parsedPrepayment,
      remarks: remarks.trim(),
      status: 'REJECTED',
    })
    showSuccessToast('Fuel request rejected')
    navigate('/fuel/quota-request-list')
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
            <DetailFieldBox label="Driver Name" value={driverName} />
            <DetailFieldBox label="Vehicle Number" value={vehicleNumber} />
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
                value={formatNuDisplay(request.prepaymentAmount)}
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

      {replenishMode ? (
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            className="bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)]"
            disabled={!canSubmit || (!crud.canUpdate && crud.isResolved)}
            onClick={handleApprove}
          >
            Approve
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-[#f5c6cb] bg-[#fde8e8] text-[#c53030] hover:bg-[#fde8e8]"
            disabled={!canSubmit || (!crud.canUpdate && crud.isResolved)}
            onClick={handleReject}
          >
            Reject
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" asChild>
          <Link to="/fuel/quota-request-list">Back to list</Link>
        </Button>
      )}
    </section>
  )
}

export default function QuotaRequestDetailPage() {
  const { requestId = '' } = useParams<{ requestId: string }>()
  const { pathname } = useLocation()
  const replenishMode = pathname.endsWith('/replenish')
  const crud = useRouteCrudPermissions('/fuel/quota-request-list')

  const request = useMemo(
    () => (requestId ? getQuotaRequestById(requestId) : undefined),
    [requestId],
  )

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

  if (!request) {
    return (
      <section className="space-y-5">
        <Button variant="outline" size="icon" asChild>
          <Link to="/fuel/quota-request-list" aria-label="Back to quota requests">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader title="Fuel Request Details" subtitle="Request not found" />
        <p className="text-sm text-[var(--fms-text-subheading)]">
          No quota request matches &ldquo;{requestId}&rdquo;.
        </p>
        <Button variant="outline" asChild>
          <Link to="/fuel/quota-request-list">Back to Quota Requests</Link>
        </Button>
      </section>
    )
  }

  if (request.status !== 'PENDING' && replenishMode) {
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
    <QuotaRequestDetailContent request={request} replenishMode={replenishMode} />
  )
}
