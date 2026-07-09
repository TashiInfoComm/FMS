import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

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
import {
  fetchLoanDetail,
  fetchLoanFleetSearch,
  submitHighestAdminDecision,
} from '@/features/inter-agency-vehicle-loan/lib/loan-requisition-api'
import {
  formatFuelingResponsibilityLabel,
  formatLoanAuditStepLabel,
  formatLoanDate,
} from '@/features/inter-agency-vehicle-loan/lib/loan-requisition-ui'
import { PageHeader } from '@/shared/components/PageHeader'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'
import { cn } from '@/lib/utils'

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs font-medium text-[var(--fms-text-subheading)]">{label}</p>
      <p className="text-sm font-semibold text-[var(--fms-text-header)]">{value || '—'}</p>
    </div>
  )
}

function ChecklistCard({
  title,
  recorded,
}: {
  title: string
  recorded: boolean
}) {
  return (
    <Card className="border border-[var(--fms-strokes)] bg-white shadow-sm">
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[var(--fms-text-header)]">{title}</p>
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-medium',
              recorded
                ? 'bg-[#d0fae5] text-[#007a55]'
                : 'bg-[#f1f5f9] text-[#64748b]',
            )}
          >
            {recorded ? 'Recorded' : 'Not Recorded'}
          </span>
        </div>
        <p className="text-sm text-[var(--fms-text-subheading)]">
          {recorded
            ? 'This checklist has been completed.'
            : 'This checklist has not been completed.'}
        </p>
      </CardContent>
    </Card>
  )
}

function LoanRequisitionDetail() {
  const { loanId } = useParams<{ loanId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const backPath =
    (location.state as { backPath?: string } | null)?.backPath ?? '/vehicle-loan/requisition'
  const crud = useRouteCrudPermissions('/vehicle-loan/requisition')
  const [fleetSearchOpen, setFleetSearchOpen] = useState(false)
  const [recommendOpen, setRecommendOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [selectedAgencyIds, setSelectedAgencyIds] = useState<Set<string>>(new Set())
  const [remarks, setRemarks] = useState('')
  const [rejectRemarks, setRejectRemarks] = useState('')

  const detailQuery = useQuery({
    queryKey: ['vehicle-loan', 'detail', loanId],
    queryFn: () => fetchLoanDetail(loanId!),
    enabled: Boolean(loanId?.trim()) && (!crud.isResolved || crud.canRead),
    staleTime: 30_000,
  })

  const detail = detailQuery.data
  const showFleetSearchAction =
    backPath === '/vehicle-loan/approval' && detail?.status === 'PENDING_HIGHEST_ADMIN'

  const fleetSearchQuery = useQuery({
    queryKey: ['vehicle-loan', 'fleet-search', loanId],
    queryFn: () => fetchLoanFleetSearch(loanId!),
    enabled: fleetSearchOpen && Boolean(loanId?.trim()),
    staleTime: 30_000,
  })

  const fleetSearchWasFetching = useRef(false)

  useEffect(() => {
    const finished = fleetSearchWasFetching.current && !fleetSearchQuery.isFetching
    fleetSearchWasFetching.current = fleetSearchQuery.isFetching

    if (!fleetSearchOpen || !finished || !fleetSearchQuery.isSuccess) return
    showSuccessToast('Fleet search completed successfully.')
  }, [fleetSearchOpen, fleetSearchQuery.isFetching, fleetSearchQuery.isSuccess])

  useEffect(() => {
    if (!fleetSearchOpen) {
      setSelectedAgencyIds(new Set())
      setRecommendOpen(false)
      setRemarks('')
    }
  }, [fleetSearchOpen])

  const recommendMutation = useMutation({
    mutationFn: async () => {
      if (!loanId?.trim()) throw new Error('Missing loan id')
      return submitHighestAdminDecision(loanId, {
        action: 'forward',
        recommended_agency_ids: [...selectedAgencyIds],
        remarks,
      })
    },
    onSuccess: async () => {
      showSuccessToast('Recommendation forwarded successfully.')
      setRecommendOpen(false)
      setFleetSearchOpen(false)
      setSelectedAgencyIds(new Set())
      setRemarks('')
      await queryClient.invalidateQueries({ queryKey: ['vehicle-loan'] })
      navigate(backPath)
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to submit recommendation')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!loanId?.trim()) throw new Error('Missing loan id')
      return submitHighestAdminDecision(loanId, {
        action: 'reject',
        remarks: rejectRemarks,
      })
    },
    onSuccess: async () => {
      showSuccessToast('Loan requisition rejected successfully.')
      setRejectOpen(false)
      setRejectRemarks('')
      await queryClient.invalidateQueries({ queryKey: ['vehicle-loan'] })
      navigate(backPath)
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to reject requisition')
    },
  })

  const agencies = fleetSearchQuery.data ?? []

  const toggleAgency = (agencyId: string) => {
    setSelectedAgencyIds((prev) => {
      const next = new Set(prev)
      if (next.has(agencyId)) next.delete(agencyId)
      else next.add(agencyId)
      return next
    })
  }

  const openRecommendDialog = () => {
    if (selectedAgencyIds.size === 0) {
      showErrorToast('Select at least one agency to recommend.')
      return
    }
    setRecommendOpen(true)
  }

  const closeFleetSearchDialog = () => {
    if (recommendMutation.isPending) return
    setFleetSearchOpen(false)
  }

  const closeRecommendDialog = () => {
    if (recommendMutation.isPending) return
    setRecommendOpen(false)
  }

  const closeRejectDialog = () => {
    if (rejectMutation.isPending) return
    setRejectOpen(false)
    setRejectRemarks('')
  }

  const confirmRecommend = () => {
    if (!remarks.trim()) {
      showErrorToast('Remarks are required.')
      return
    }
    recommendMutation.mutate()
  }

  const confirmReject = () => {
    if (!rejectRemarks.trim()) {
      showErrorToast('Remarks are required.')
      return
    }
    rejectMutation.mutate()
  }

  if (crud.isResolved && !crud.canRead) {
    return (
      <section className="space-y-5">
        <PageHeader title="Vehicle Loan Requisition" subtitle="Requisition detail" />
        <p className="text-sm text-[var(--fms-text-subheading)]">
          You do not have permission to view this requisition.
        </p>
      </section>
    )
  }

  if (detailQuery.isLoading) {
    return (
      <section className="space-y-5">
        <PageHeader title="Vehicle Loan Requisition" subtitle="Loading requisition…" />
        <div className="h-48 animate-pulse rounded-xl border border-[var(--fms-strokes)] bg-white" />
      </section>
    )
  }

  if (detailQuery.isError || !detail) {
    return (
      <section className="space-y-5">
        <Button variant="outline" size="icon" asChild>
          <Link to={backPath} aria-label="Back to requisitions">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader title="Vehicle Loan Requisition" subtitle="Requisition not found" />
        <p className="text-sm text-[var(--fms-text-subheading)]">
          {detailQuery.error instanceof Error
            ? detailQuery.error.message
            : `No requisition matches "${loanId}".`}
        </p>
        <Button variant="outline" asChild>
          <Link to={backPath}>Back to list</Link>
        </Button>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <PageHeader
            title={detail.requestId}
            subtitle="Inter-agency vehicle loan requisition detail"
          />
          <div className="flex flex-wrap items-center gap-3">
            {showFleetSearchAction ? (
              <>
                <Button
                  type="button"
                  className="inline-flex items-center gap-2"
                  onClick={() => setFleetSearchOpen(true)}
                >
                  <Search className="h-4 w-4" />
                  Fleet search
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setRejectRemarks('')
                    setRejectOpen(true)
                  }}
                >
                  Reject
                </Button>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" asChild>
            <Link to={backPath} className="inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to list
            </Link>
          </Button>
          <LoanRequisitionStatusCell status={detail.status} />
        </div>
      </div>

      <Card className="border border-[var(--fms-strokes)] bg-white shadow-sm">
        <CardContent className="grid gap-4 pt-5 md:grid-cols-2 lg:grid-cols-3">
          <DetailField label="Borrowing Agency" value={detail.borrowingAgency} />
          <DetailField label="Lending Agency" value={detail.lendingAgency} />
          <DetailField
            label="Fueling"
            value={formatFuelingResponsibilityLabel(detail.fuelingResponsibility)}
          />
          <div className="min-w-0 space-y-1 md:col-span-2 lg:col-span-3">
            <p className="text-xs font-medium text-[var(--fms-text-subheading)]">Remarks</p>
            <p className="text-sm font-semibold text-[var(--fms-text-header)]">
              {detail.reason || '—'}
            </p>
          </div>
          {detail.status === 'REJECTED' ? (
            <div className="min-w-0 space-y-1 md:col-span-2 lg:col-span-3">
              <p className="text-xs font-medium text-[var(--fms-text-subheading)]">
                Rejection Reason
              </p>
              <p className="text-sm font-semibold text-[var(--fms-delete)]">
                {detail.rejectionReason || '—'}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border border-[var(--fms-strokes)] bg-white shadow-sm">
        <CardContent className="space-y-4 pt-5">
          <div>
            <p className="text-base font-semibold text-[var(--fms-text-header)]">
              Vehicle Requirements
            </p>
            <p className="text-xs text-[var(--fms-text-subheading)]">
              Requested vehicle categories for this loan
            </p>
          </div>

          {detail.requirements.length === 0 ? (
            <p className="text-sm text-[var(--fms-text-subheading)]">
              No vehicle requirements recorded.
            </p>
          ) : (
            <>
              <div className="hidden w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
                <table className="w-max min-w-full text-sm">
                  <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Vehicle Category</th>
                      <th className="px-4 py-3 text-left font-semibold">No. of Vehicles</th>
                      <th className="px-4 py-3 text-left font-semibold">Start Date</th>
                      <th className="px-4 py-3 text-left font-semibold">End Date</th>
                      <th className="px-4 py-3 text-left font-semibold">Driver Required</th>
                      <th className="px-4 py-3 text-left font-semibold">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.requirements.map((requirement) => (
                      <tr
                        key={requirement.id}
                        className="border-t border-[var(--fms-strokes)]"
                      >
                        <td className="px-4 py-3 font-medium text-[var(--fms-text-header)]">
                          {requirement.vehicleCategoryLabel}
                        </td>
                        <td className="px-4 py-3 text-[var(--fms-text-header)]">
                          {requirement.numberOfVehicles}
                        </td>
                        <td className="px-4 py-3 text-[var(--fms-text-header)]">
                          {formatLoanDate(requirement.startDate)}
                        </td>
                        <td className="px-4 py-3 text-[var(--fms-text-header)]">
                          {formatLoanDate(requirement.endDate)}
                        </td>
                        <td className="px-4 py-3 text-[var(--fms-text-header)]">
                          {requirement.driverRequired ? 'Yes' : 'No'}
                        </td>
                        <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                          {requirement.reason || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {detail.requirements.map((requirement) => (
                  <div
                    key={requirement.id}
                    className="space-y-2 rounded-lg border border-[var(--fms-strokes)] p-4"
                  >
                    <DetailField
                      label="Vehicle Category"
                      value={requirement.vehicleCategoryLabel}
                    />
                    <DetailField
                      label="No. of Vehicles"
                      value={String(requirement.numberOfVehicles)}
                    />
                    <DetailField label="Start Date" value={formatLoanDate(requirement.startDate)} />
                    <DetailField label="End Date" value={formatLoanDate(requirement.endDate)} />
                    <DetailField
                      label="Driver Required"
                      value={requirement.driverRequired ? 'Yes' : 'No'}
                    />
                    <DetailField label="Reason" value={requirement.reason} />
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="border border-[var(--fms-strokes)] bg-white shadow-sm">
          <CardContent className="space-y-4 pt-5">
            <div>
              <p className="text-base font-semibold text-[var(--fms-text-header)]">
                Audit Timeline
              </p>
              <p className="text-xs text-[var(--fms-text-subheading)]">
                Lifecycle of the loan
              </p>
            </div>
            <ol className="space-y-0">
              {detail.auditTimeline.map((entry, index) => {
                const isLast = index === detail.auditTimeline.length - 1
                return (
                  <li key={entry.step} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                          entry.completed
                            ? 'border-[var(--fms-primary)] bg-[var(--fms-primary)] text-white'
                            : 'border-[var(--fms-strokes)] bg-white',
                        )}
                      >
                        {entry.completed ? (
                          <Check className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-[#cbd5e1]" />
                        )}
                      </span>
                      {!isLast ? (
                        <span className="my-1 w-px flex-1 bg-[var(--fms-strokes)]" />
                      ) : null}
                    </div>
                    <div className={cn('min-w-0 pb-5', isLast && 'pb-0')}>
                      <p
                        className={cn(
                          'text-sm font-medium',
                          entry.completed
                            ? 'text-[var(--fms-text-header)]'
                            : 'text-[var(--fms-text-subheading)]',
                        )}
                      >
                        {formatLoanAuditStepLabel(entry.step)}
                      </p>
                      {entry.date ? (
                        <p className="text-xs text-[var(--fms-text-subheading)]">{entry.date}</p>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ol>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border border-[var(--fms-strokes)] bg-white shadow-sm">
            <CardContent className="grid gap-4 pt-5 sm:grid-cols-2 lg:grid-cols-1">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#1d4ed8]" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fms-text-subheading)]">
                    Requested Vehicle
                  </p>
                </div>
                <p className="text-sm text-[var(--fms-text-header)]">
                  {detail.requestedVehicleSummary}
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#007a55]" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fms-text-subheading)]">
                    Committed Vehicle
                  </p>
                </div>
                <p className="text-sm text-[var(--fms-text-header)]">
                  {detail.committedVehicleSummary}
                </p>
              </div>
            </CardContent>
          </Card>

          <ChecklistCard
            title="Handover Checklist"
            recorded={detail.handoverChecklistRecorded}
          />
          <ChecklistCard
            title="Return Checklist"
            recorded={detail.returnChecklistRecorded}
          />
        </div>
      </div>

      <Dialog
        open={fleetSearchOpen}
        onOpenChange={(open) => {
          if (!open) closeFleetSearchDialog()
          else setFleetSearchOpen(true)
        }}
      >
        <DialogContent className="flex max-h-[90vh] w-full max-w-4xl flex-col gap-4 overflow-hidden">
          <DialogHeader>
            <DialogTitle>Fleet Search</DialogTitle>
            <DialogDescription>
              Recommended agencies from system-wide fleet analysis. Select one or more to
              forward.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
            {fleetSearchQuery.isLoading ? (
              <p className="text-sm text-[var(--fms-text-subheading)]">
                Searching recommended agencies…
              </p>
            ) : fleetSearchQuery.isError ? (
              <p className="text-sm text-[var(--fms-error-text)]">
                {fleetSearchQuery.error instanceof Error
                  ? fleetSearchQuery.error.message
                  : 'Could not load fleet search results.'}
              </p>
            ) : agencies.length === 0 ? (
              <p className="text-sm text-[var(--fms-text-subheading)]">
                No recommended agencies found.
              </p>
            ) : (
              <>
                <div className="hidden w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
                  <table className="w-max min-w-full text-sm">
                    <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                      <tr>
                        <th className="w-12 px-4 py-3 text-left font-semibold">
                          <span className="sr-only">Select</span>
                        </th>
                        <th className="px-4 py-3 text-left font-semibold">Agency</th>
                        <th className="px-4 py-3 text-left font-semibold">Code</th>
                        <th className="px-4 py-3 text-left font-semibold">Available Vehicles</th>
                        <th className="px-4 py-3 text-left font-semibold">Matching Categories</th>
                        <th className="px-4 py-3 text-left font-semibold">Capacity Summary</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agencies.map((agency) => {
                        const checked = selectedAgencyIds.has(agency.id)
                        return (
                          <tr
                            key={agency.id}
                            className="cursor-pointer border-t border-[var(--fms-strokes)] hover:bg-[#fafafa]"
                            onClick={() => toggleAgency(agency.id)}
                          >
                            <td
                              className="px-4 py-3"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-[var(--fms-button)]"
                                checked={checked}
                                onChange={() => toggleAgency(agency.id)}
                                aria-label={`Select ${agency.name || agency.id}`}
                              />
                            </td>
                            <td className="px-4 py-3 font-medium text-[var(--fms-text-header)]">
                              {agency.name || '—'}
                            </td>
                            <td className="px-4 py-3 text-[var(--fms-text-header)]">
                              {agency.code || '—'}
                            </td>
                            <td className="px-4 py-3 text-[var(--fms-text-header)]">
                              {agency.availableVehicles}
                            </td>
                            <td className="px-4 py-3 text-[var(--fms-text-header)]">
                              {agency.matchingCategories || '—'}
                            </td>
                            <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                              {agency.capacitySummary || '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-3 md:hidden">
                  {agencies.map((agency) => {
                    const checked = selectedAgencyIds.has(agency.id)
                    return (
                      <label
                        key={agency.id}
                        className={cn(
                          'flex cursor-pointer gap-3 rounded-lg border p-4',
                          checked
                            ? 'border-[var(--fms-button)] bg-[var(--fms-info-fill)]'
                            : 'border-[var(--fms-strokes)] bg-white',
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 accent-[var(--fms-button)]"
                          checked={checked}
                          onChange={() => toggleAgency(agency.id)}
                        />
                        <div className="min-w-0 flex-1 space-y-2">
                          <DetailField label="Agency" value={agency.name} />
                          <DetailField label="Code" value={agency.code} />
                          <DetailField
                            label="Available Vehicles"
                            value={String(agency.availableVehicles)}
                          />
                          <DetailField
                            label="Matching Categories"
                            value={agency.matchingCategories}
                          />
                          <DetailField label="Capacity Summary" value={agency.capacitySummary} />
                        </div>
                      </label>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={recommendMutation.isPending}
              onClick={closeFleetSearchDialog}
            >
              Close
            </Button>
            <Button
              type="button"
              disabled={
                recommendMutation.isPending ||
                fleetSearchQuery.isLoading ||
                fleetSearchQuery.isError ||
                agencies.length === 0 ||
                selectedAgencyIds.size === 0
              }
              onClick={openRecommendDialog}
            >
              Recommend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={recommendOpen}
        onOpenChange={(open) => {
          if (!open) closeRecommendDialog()
          else setRecommendOpen(true)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Recommend Agencies</DialogTitle>
            <DialogDescription>
              Add remarks before forwarding the selected shortlist to the Borrowing Head.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="highest-admin-remarks">
              Remarks <span className="text-[var(--fms-delete)]">*</span>
            </Label>
            <textarea
              id="highest-admin-remarks"
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              placeholder="Explain why these agencies are recommended"
              rows={4}
              disabled={recommendMutation.isPending}
              className="min-h-[96px] w-full rounded-lg border border-[var(--fms-strokes)] bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={recommendMutation.isPending}
              onClick={closeRecommendDialog}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={recommendMutation.isPending}
              onClick={confirmRecommend}
            >
              {recommendMutation.isPending ? 'Submitting…' : 'Confirm Recommend'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={rejectOpen}
        onOpenChange={(open) => {
          if (!open) closeRejectDialog()
          else setRejectOpen(true)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Requisition</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this vehicle loan requisition.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="highest-admin-reject-remarks">
              Remarks <span className="text-[var(--fms-delete)]">*</span>
            </Label>
            <textarea
              id="highest-admin-reject-remarks"
              value={rejectRemarks}
              onChange={(event) => setRejectRemarks(event.target.value)}
              placeholder="No agency has sufficient fleet capacity to meet this requirement during the requested period."
              rows={4}
              disabled={rejectMutation.isPending}
              className="min-h-[96px] w-full rounded-lg border border-[var(--fms-strokes)] bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={rejectMutation.isPending}
              onClick={closeRejectDialog}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={rejectMutation.isPending}
              onClick={confirmReject}
            >
              {rejectMutation.isPending ? 'Rejecting…' : 'Confirm Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

export default LoanRequisitionDetail
