import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Search, Truck, Undo2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { LoanAuditTimeline } from '@/features/inter-agency-vehicle-loan/components/LoanAuditTimeline'
import { LoanChecklistPlaceholderCard } from '@/features/inter-agency-vehicle-loan/components/LoanChecklistPlaceholderCard'
import { LoanDetailField } from '@/features/inter-agency-vehicle-loan/components/LoanDetailField'
import { LoanRequisitionStatusCell } from '@/features/inter-agency-vehicle-loan/components/LoanRequisitionStatusCell'
import { VehicleChecklistTableCard } from '@/features/inter-agency-vehicle-loan/components/VehicleChecklistTableCard'
import {
  buildLoanAuditTimeline,
  commitLoanVehicles,
  completeLoan,
  fetchLoanDetail,
  fetchLoanFleetSearch,
  fetchLoanTracker,
  flattenFleetSearchCommitVehicles,
  submitBorrowingHeadDecision,
  submitHighestAdminDecision,
  submitLendingHeadDecision,
} from '@/features/inter-agency-vehicle-loan/lib/loan-requisition-api'
import {
  formatFleetSearchRequirementsSummary,
  formatFuelingResponsibilityLabel,
  formatLoanDate,
} from '@/features/inter-agency-vehicle-loan/lib/loan-requisition-ui'
import { PageHeader } from '@/shared/components/PageHeader'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'
import { cn } from '@/lib/utils'

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
  const [selectedLendingAgencyId, setSelectedLendingAgencyId] = useState('')
  const [borrowingDecisionOpen, setBorrowingDecisionOpen] = useState<'approve' | 'reject' | null>(
    null,
  )
  const [borrowingDecisionRemarks, setBorrowingDecisionRemarks] = useState('')
  const [lendingDecisionOpen, setLendingDecisionOpen] = useState<'approve' | 'reject' | null>(null)
  const [lendingDecisionRemarks, setLendingDecisionRemarks] = useState('')
  const [commitVehicleSelections, setCommitVehicleSelections] = useState<
    Record<string, { selected: boolean; notes: string }>
  >({})

  const detailQuery = useQuery({
    queryKey: ['vehicle-loan', 'detail', loanId],
    queryFn: () => fetchLoanDetail(loanId!),
    enabled: Boolean(loanId?.trim()) && (!crud.isResolved || crud.canRead),
    staleTime: 30_000,
  })

  const detail = detailQuery.data

  const trackerQuery = useQuery({
    queryKey: ['vehicle-loan', 'tracker', loanId, detail?.status],
    queryFn: () => fetchLoanTracker(loanId!),
    enabled: Boolean(loanId?.trim()) && Boolean(detail) && (!crud.isResolved || crud.canRead),
    staleTime: 30_000,
  })

  const auditTimeline = useMemo(
    () =>
      buildLoanAuditTimeline(
        detail?.status ?? 'DRAFT',
        trackerQuery.isSuccess ? (trackerQuery.data ?? []) : [],
      ),
    [detail?.status, trackerQuery.data, trackerQuery.isSuccess],
  )

  const showFleetSearchAction =
    backPath === '/vehicle-loan/approval' && detail?.status === 'PENDING_HIGHEST_ADMIN'
  const showBorrowingHeadActions = detail?.status === 'PENDING_BORROWING_HEAD'
  const showLendingHeadActions =
    backPath === '/vehicle-loan/lending' && detail?.status === 'PENDING_LENDING_HEAD'
  const showMtoCommitActions =
    backPath === '/vehicle-loan/lending' && detail?.status === 'PENDING_MTO_COMMIT'
  const showDispatchAction =
    backPath === '/vehicle-loan/lending' && detail?.status === 'VEHICLE_COMMITTED'
  const showReturnAction =
    backPath === '/vehicle-loan/requisition' && detail?.status === 'ACTIVE'
  const showCompleteAction =
    backPath === '/vehicle-loan/lending' && detail?.status === 'RETURNED'

  const recommendedAgencyRows = useMemo(() => {
    if (!detail) return []
    return detail.recommendedAgencies.map((agency) => ({
      ...agency,
      displayName: agency.name || agency.id,
    }))
  }, [detail])

  const isRecommendedAgencySelected = useMemo(
    () =>
      Boolean(
        selectedLendingAgencyId &&
        recommendedAgencyRows.some((agency) => agency.id === selectedLendingAgencyId),
      ),
    [recommendedAgencyRows, selectedLendingAgencyId],
  )

  useEffect(() => {
    if (!showBorrowingHeadActions) {
      setSelectedLendingAgencyId('')
      return
    }

    setSelectedLendingAgencyId((current) => {
      if (current && recommendedAgencyRows.some((agency) => agency.id === current)) {
        return current
      }
      if (recommendedAgencyRows.length === 1) {
        return recommendedAgencyRows[0].id
      }
      return ''
    })
  }, [showBorrowingHeadActions, recommendedAgencyRows])

  const fleetSearchQuery = useQuery({
    queryKey: ['vehicle-loan', 'fleet-search', loanId],
    queryFn: () => fetchLoanFleetSearch(loanId!),
    enabled: fleetSearchOpen && Boolean(loanId?.trim()),
    staleTime: 30_000,
  })

  const mtoFleetSearchQuery = useQuery({
    queryKey: ['vehicle-loan', 'fleet-search', loanId, 'mto-commit'],
    queryFn: () => fetchLoanFleetSearch(loanId!),
    enabled: showMtoCommitActions && Boolean(loanId?.trim()),
    staleTime: 30_000,
  })

  const recommendedCommitVehicles = useMemo(
    () =>
      flattenFleetSearchCommitVehicles(
        mtoFleetSearchQuery.data ?? [],
        detail?.lendingAgencyId || undefined,
      ),
    [detail?.lendingAgencyId, mtoFleetSearchQuery.data],
  )

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

  useEffect(() => {
    if (!showMtoCommitActions) {
      setCommitVehicleSelections({})
      return
    }
    setCommitVehicleSelections((prev) => {
      const next = { ...prev }
      for (const vehicle of recommendedCommitVehicles) {
        if (!next[vehicle.vehicleId]) {
          next[vehicle.vehicleId] = { selected: false, notes: '' }
        }
      }
      return next
    })
  }, [recommendedCommitVehicles, showMtoCommitActions])

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

  const borrowingDecisionMutation = useMutation({
    mutationFn: async () => {
      if (!loanId?.trim()) throw new Error('Missing loan id')
      if (borrowingDecisionOpen === 'approve') {
        return submitBorrowingHeadDecision(loanId, {
          action: 'approve',
          lending_agency_id: selectedLendingAgencyId,
          remarks: borrowingDecisionRemarks,
        })
      }
      return submitBorrowingHeadDecision(loanId, {
        action: 'reject',
        remarks: borrowingDecisionRemarks,
      })
    },
    onSuccess: async () => {
      showSuccessToast(
        borrowingDecisionOpen === 'approve'
          ? 'Lending agency approved successfully.'
          : 'Loan requisition rejected successfully.',
      )
      setBorrowingDecisionOpen(null)
      setBorrowingDecisionRemarks('')
      setSelectedLendingAgencyId('')
      await queryClient.invalidateQueries({ queryKey: ['vehicle-loan'] })
      navigate(backPath)
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to submit borrowing head decision')
    },
  })

  const lendingDecisionMutation = useMutation({
    mutationFn: async () => {
      if (!loanId?.trim()) throw new Error('Missing loan id')
      if (!lendingDecisionOpen) throw new Error('Missing lending head decision action')
      return submitLendingHeadDecision(loanId, {
        action: lendingDecisionOpen,
        remarks: lendingDecisionRemarks,
      })
    },
    onSuccess: async () => {
      showSuccessToast(
        lendingDecisionOpen === 'approve'
          ? 'Loan requisition approved successfully.'
          : 'Loan requisition rejected successfully.',
      )
      setLendingDecisionOpen(null)
      setLendingDecisionRemarks('')
      await queryClient.invalidateQueries({ queryKey: ['vehicle-loan'] })
      navigate(backPath)
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to submit lending head decision')
    },
  })

  const commitVehiclesMutation = useMutation({
    mutationFn: async () => {
      if (!loanId?.trim()) throw new Error('Missing loan id')
      const vehicles = recommendedCommitVehicles
        .filter((vehicle) => commitVehicleSelections[vehicle.vehicleId]?.selected)
        .map((vehicle) => ({
          vehicle_id: vehicle.vehicleId,
          driver_id:
            vehicle.driverRequired && vehicle.primaryDriverId.trim()
              ? vehicle.primaryDriverId.trim()
              : null,
          notes: commitVehicleSelections[vehicle.vehicleId]?.notes ?? '',
        }))
      return commitLoanVehicles(loanId, { vehicles })
    },
    onSuccess: async () => {
      showSuccessToast('Vehicles committed successfully.')
      setCommitVehicleSelections({})
      await queryClient.invalidateQueries({ queryKey: ['vehicle-loan'] })
      navigate(backPath)
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to commit vehicles')
    },
  })

  const completeLoanMutation = useMutation({
    mutationFn: async () => {
      if (!loanId?.trim()) throw new Error('Missing loan id')
      return completeLoan(loanId)
    },
    onSuccess: async () => {
      showSuccessToast('Loan completed successfully.')
      await queryClient.invalidateQueries({ queryKey: ['vehicle-loan'] })
      navigate(backPath)
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to complete loan')
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

  const openBorrowingApproveDialog = () => {
    if (!isRecommendedAgencySelected) {
      showErrorToast('Select one recommended agency to approve.')
      return
    }
    setBorrowingDecisionRemarks('')
    setBorrowingDecisionOpen('approve')
  }

  const openBorrowingRejectDialog = () => {
    if (!isRecommendedAgencySelected) {
      showErrorToast('Select one recommended agency to continue.')
      return
    }
    setBorrowingDecisionRemarks('')
    setBorrowingDecisionOpen('reject')
  }

  const closeBorrowingDecisionDialog = () => {
    if (borrowingDecisionMutation.isPending) return
    setBorrowingDecisionOpen(null)
    setBorrowingDecisionRemarks('')
  }

  const confirmBorrowingDecision = () => {
    if (!borrowingDecisionRemarks.trim()) {
      showErrorToast('Remarks are required.')
      return
    }
    borrowingDecisionMutation.mutate()
  }

  const openLendingApproveDialog = () => {
    setLendingDecisionRemarks('')
    setLendingDecisionOpen('approve')
  }

  const openLendingRejectDialog = () => {
    setLendingDecisionRemarks('')
    setLendingDecisionOpen('reject')
  }

  const closeLendingDecisionDialog = () => {
    if (lendingDecisionMutation.isPending) return
    setLendingDecisionOpen(null)
    setLendingDecisionRemarks('')
  }

  const confirmLendingDecision = () => {
    if (!lendingDecisionRemarks.trim()) {
      showErrorToast('Remarks are required.')
      return
    }
    lendingDecisionMutation.mutate()
  }

  const toggleCommitVehicle = (vehicleId: string) => {
    const vehicle = recommendedCommitVehicles.find((row) => row.vehicleId === vehicleId)
    if (!vehicle) return

    const current = commitVehicleSelections[vehicleId] ?? { selected: false, notes: '' }
    const willSelect = !current.selected

    if (willSelect) {
      const selectedInRequirement = recommendedCommitVehicles.filter(
        (row) =>
          row.requirementKey === vehicle.requirementKey &&
          (commitVehicleSelections[row.vehicleId]?.selected ?? false),
      ).length

      if (selectedInRequirement >= vehicle.vehicleCountRequested) {
        showErrorToast(
          `You can only commit ${vehicle.vehicleCountRequested} vehicle(s) for ${vehicle.vehicleCategory || 'this requirement'}.`,
        )
        return
      }
    }

    setCommitVehicleSelections((prev) => ({
      ...prev,
      [vehicleId]: { ...current, selected: willSelect },
    }))
  }

  const updateCommitVehicleNotes = (vehicleId: string, notes: string) => {
    setCommitVehicleSelections((prev) => {
      const current = prev[vehicleId] ?? { selected: false, notes: '' }
      return {
        ...prev,
        [vehicleId]: { ...current, notes },
      }
    })
  }

  const confirmCommitVehicles = () => {
    const selectedVehicles = recommendedCommitVehicles.filter(
      (vehicle) => commitVehicleSelections[vehicle.vehicleId]?.selected,
    )
    if (selectedVehicles.length === 0) {
      showErrorToast('Select at least one vehicle to commit.')
      return
    }
    const missingPrimaryDriver = selectedVehicles.find(
      (vehicle) => vehicle.driverRequired && !vehicle.primaryDriverId.trim(),
    )
    if (missingPrimaryDriver) {
      showErrorToast(
        `Primary driver is required for ${missingPrimaryDriver.registrationNumber || missingPrimaryDriver.vehicleId}.`,
      )
      return
    }

    const requirementKeys = [...new Set(recommendedCommitVehicles.map((vehicle) => vehicle.requirementKey))]
    for (const requirementKey of requirementKeys) {
      const vehiclesInRequirement = recommendedCommitVehicles.filter(
        (vehicle) => vehicle.requirementKey === requirementKey,
      )
      const selectedInRequirement = vehiclesInRequirement.filter(
        (vehicle) => commitVehicleSelections[vehicle.vehicleId]?.selected,
      ).length
      const limit = vehiclesInRequirement[0]?.vehicleCountRequested ?? 0
      if (selectedInRequirement > limit) {
        showErrorToast(
          `You can only commit ${limit} vehicle(s) for ${vehiclesInRequirement[0]?.vehicleCategory || 'this requirement'}.`,
        )
        return
      }
    }

    commitVehiclesMutation.mutate()
  }

  const selectedCommitVehicleCount = recommendedCommitVehicles.filter(
    (vehicle) => commitVehicleSelections[vehicle.vehicleId]?.selected,
  ).length

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

  const dispatchedVehicles = detail.committedVehicles.filter(
    (vehicle) =>
      Boolean(vehicle.fuelLevelAtDispatch.trim()) && Boolean(vehicle.odometerAtDispatch.trim()),
  )
  const returnedVehicles = detail.committedVehicles.filter(
    (vehicle) =>
      Boolean(vehicle.fuelLevelAtReturn.trim()) && Boolean(vehicle.odometerAtReturn.trim()),
  )
  const showCommittedVehiclesSection =
    detail.status === 'VEHICLE_COMMITTED' ||
    (detail.status !== 'ACTIVE' &&
      detail.status !== 'RETURNED' &&
      detail.status !== 'COMPLETED' &&
      detail.committedVehicles.length > 0)
  const showDispatchedVehiclesCard =
    dispatchedVehicles.length > 0 ||
    detail.status === 'ACTIVE' ||
    detail.status === 'RETURNED' ||
    detail.status === 'COMPLETED' ||
    Boolean(detail.dispatchedAt)
  const showReturnedVehiclesCard =
    returnedVehicles.length > 0 ||
    detail.status === 'RETURNED' ||
    detail.status === 'COMPLETED' ||
    Boolean(detail.returnedAt)

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
                  Fleet Analysis
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
            {showLendingHeadActions ? (
              <>
                <Button
                  type="button"
                  disabled={lendingDecisionMutation.isPending}
                  onClick={openLendingApproveDialog}
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={lendingDecisionMutation.isPending}
                  onClick={openLendingRejectDialog}
                >
                  Reject
                </Button>
              </>
            ) : null}
            {showDispatchAction ? (
              <Button
                type="button"
                className="inline-flex items-center gap-2"
                asChild
              >
                <Link
                  to={`/vehicle-loan/${detail.id}/dispatch`}
                  state={{ backPath: '/vehicle-loan/lending' }}
                >
                  <Truck className="h-4 w-4" />
                  Dispatch Vehicle
                </Link>
              </Button>
            ) : null}
            {showReturnAction ? (
              <Button
                type="button"
                className="inline-flex items-center gap-2"
                asChild
              >
                <Link
                  to={`/vehicle-loan/${detail.id}/return`}
                  state={{ backPath: '/vehicle-loan/requisition' }}
                >
                  <Undo2 className="h-4 w-4" />
                  Return vehicle
                </Link>
              </Button>
            ) : null}
            {showCompleteAction ? (
              <Button
                type="button"
                disabled={completeLoanMutation.isPending}
                onClick={() => completeLoanMutation.mutate()}
              >
                {completeLoanMutation.isPending ? 'Completing…' : 'Complete'}
              </Button>
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
        <CardContent className="flex flex-col gap-4 pt-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <LoanDetailField label="Borrowing Agency" value={detail.borrowingAgency} />
            <LoanDetailField
              label="Lending Agency"
              value={detail.lendingAgency}
              className="md:text-center"
            />
            <LoanDetailField
              label="Fueling"
              value={formatFuelingResponsibilityLabel(detail.fuelingResponsibility)}
              className="md:text-right"
            />
          </div>

          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium text-[var(--fms-text-subheading)]">Reason</p>
            <p className="text-sm font-semibold text-[var(--fms-text-header)]">
              {detail.reason || '—'}
            </p>
          </div>
          {detail.highestAdminRemarks ? (
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-medium text-[var(--fms-text-subheading)]">
                Highest Admin Remarks
              </p>
              <p className="text-sm font-semibold text-[var(--fms-text-header)]">
                {detail.highestAdminRemarks}
              </p>
            </div>
          ) : null}
          {detail.borrowingHeadRemarks ? (
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-medium text-[var(--fms-text-subheading)]">
                Borrowing MTO Remarks
              </p>
              <p className="text-sm font-semibold text-[var(--fms-text-header)]">
                {detail.borrowingHeadRemarks}
              </p>
            </div>
          ) : null}
          {detail.lendingHeadRemarks ? (
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-medium text-[var(--fms-text-subheading)]">
                Lending MTO Remarks
              </p>
              <p className="text-sm font-semibold text-[var(--fms-text-header)]">
                {detail.lendingHeadRemarks}
              </p>
            </div>
          ) : null}
          {detail.status === 'REJECTED' ? (
            <div className="min-w-0 space-y-1">
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

      <div className="grid gap-5 lg:grid-cols-[minmax(0,4fr)_minmax(0,1fr)]">
        <div className="space-y-4">
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
                        <LoanDetailField
                          label="Vehicle Category"
                          value={requirement.vehicleCategoryLabel}
                        />
                        <LoanDetailField
                          label="No. of Vehicles"
                          value={String(requirement.numberOfVehicles)}
                        />
                        <LoanDetailField label="Start Date" value={formatLoanDate(requirement.startDate)} />
                        <LoanDetailField label="End Date" value={formatLoanDate(requirement.endDate)} />
                        <LoanDetailField
                          label="Driver Required"
                          value={requirement.driverRequired ? 'Yes' : 'No'}
                        />
                        <LoanDetailField label="Reason" value={requirement.reason} />
                      </div>
                    ))}
                  </div>
                </>
              )}

              {showBorrowingHeadActions ? (
                <div className="space-y-4 border-t border-[var(--fms-strokes)] pt-4">
                  <div>
                    <p className="text-base font-semibold text-[var(--fms-text-header)]">
                      Recommended Agency
                    </p>
                    <p className="text-xs text-[var(--fms-text-subheading)]">
                      Select one agency from the Highest Admin shortlist
                    </p>
                  </div>

                  {recommendedAgencyRows.length === 0 ? (
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
                            </tr>
                          </thead>
                          <tbody>
                            {recommendedAgencyRows.map((agency) => {
                              const checked = selectedLendingAgencyId === agency.id
                              return (
                                <tr
                                  key={agency.id}
                                  className={cn(
                                    'cursor-pointer border-t border-[var(--fms-strokes)] hover:bg-[#fafafa]',
                                    checked && 'bg-[var(--fms-info-fill)]',
                                  )}
                                  onClick={() => setSelectedLendingAgencyId(agency.id)}
                                >
                                  <td className="px-4 py-3">
                                    <input
                                      type="radio"
                                      name="recommended-lending-agency"
                                      className="h-4 w-4 accent-[var(--fms-button)]"
                                      checked={checked}
                                      onChange={() => setSelectedLendingAgencyId(agency.id)}
                                      onClick={(event) => event.stopPropagation()}
                                      aria-label={`Select ${agency.displayName}`}
                                    />
                                  </td>
                                  <td className="px-4 py-3 font-medium text-[var(--fms-text-header)]">
                                    {agency.displayName}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="space-y-3 md:hidden">
                        {recommendedAgencyRows.map((agency) => {
                          const checked = selectedLendingAgencyId === agency.id
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
                                type="radio"
                                name="recommended-lending-agency"
                                className="mt-1 h-4 w-4 accent-[var(--fms-button)]"
                                checked={checked}
                                onChange={() => setSelectedLendingAgencyId(agency.id)}
                              />
                              <div className="min-w-0 flex-1 space-y-2">
                                <LoanDetailField label="Agency" value={agency.displayName} />
                              </div>
                            </label>
                          )
                        })}
                      </div>

                      <div className="flex flex-wrap justify-end gap-3">
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={
                            borrowingDecisionMutation.isPending || !isRecommendedAgencySelected
                          }
                          onClick={openBorrowingRejectDialog}
                        >
                          Reject
                        </Button>
                        <Button
                          type="button"
                          disabled={
                            borrowingDecisionMutation.isPending || !isRecommendedAgencySelected
                          }
                          onClick={openBorrowingApproveDialog}
                        >
                          Approve
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ) : null}

              {showMtoCommitActions ? (
                <div className="space-y-4 border-t border-[var(--fms-strokes)] pt-4">
                  <div>
                    <p className="text-base font-semibold text-[var(--fms-text-header)]">
                      Recommended Vehicles
                    </p>
                    <p className="text-xs text-[var(--fms-text-subheading)]">
                      Select vehicles from fleet search and add notes before committing
                    </p>
                  </div>

                  {mtoFleetSearchQuery.isLoading ? (
                    <p className="text-sm text-[var(--fms-text-subheading)]">
                      Loading recommended vehicles…
                    </p>
                  ) : mtoFleetSearchQuery.isError ? (
                    <p className="text-sm text-[var(--fms-error-text)]">
                      {mtoFleetSearchQuery.error instanceof Error
                        ? mtoFleetSearchQuery.error.message
                        : 'Could not load fleet search results.'}
                    </p>
                  ) : recommendedCommitVehicles.length === 0 ? (
                    <p className="text-sm text-[var(--fms-text-subheading)]">
                      No recommended vehicles found.
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
                              <th className="px-4 py-3 text-left font-semibold">Registration No.</th>
                              <th className="px-4 py-3 text-left font-semibold">Make & Model</th>
                              <th className="px-4 py-3 text-left font-semibold">Driver Required</th>
                              <th className="px-4 py-3 text-left font-semibold">Driver</th>
                              <th className="px-4 py-3 text-left font-semibold">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recommendedCommitVehicles.map((vehicle) => {
                              const selection = commitVehicleSelections[vehicle.vehicleId] ?? {
                                selected: false,
                                notes: '',
                              }
                              const selectedInRequirement = recommendedCommitVehicles.filter(
                                (row) =>
                                  row.requirementKey === vehicle.requirementKey &&
                                  (commitVehicleSelections[row.vehicleId]?.selected ?? false),
                              ).length
                              const selectionLimitReached =
                                selectedInRequirement >= vehicle.vehicleCountRequested
                              const checkboxDisabled =
                                commitVehiclesMutation.isPending ||
                                vehicle.vehicleCountRequested <= 0 ||
                                (selectionLimitReached && !selection.selected)
                              return (
                                <tr
                                  key={vehicle.vehicleId}
                                  className="border-t border-[var(--fms-strokes)]"
                                >
                                  <td className="px-4 py-3">
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 accent-[var(--fms-button)]"
                                      checked={selection.selected}
                                      disabled={checkboxDisabled}
                                      onChange={() => toggleCommitVehicle(vehicle.vehicleId)}
                                      aria-label={`Select ${vehicle.registrationNumber || vehicle.vehicleId}`}
                                    />
                                  </td>
                                  <td className="px-4 py-3 font-medium text-[var(--fms-text-header)]">
                                    {vehicle.registrationNumber || vehicle.vehicleId}
                                  </td>
                                  <td className="px-4 py-3 text-[var(--fms-text-header)]">
                                    {vehicle.makeModelDisplay}
                                  </td>

                                  <td className="px-4 py-3 text-[var(--fms-text-header)]">
                                    {vehicle.driverRequired ? 'Yes' : 'No'}
                                  </td>
                                  <td className="px-4 py-3 text-[var(--fms-text-header)]">
                                    {vehicle.primaryDriverDisplay}
                                  </td>
                                  <td className="px-4 py-3">
                                    <Input
                                      value={selection.notes}
                                      onChange={(event) =>
                                        updateCommitVehicleNotes(vehicle.vehicleId, event.target.value)
                                      }
                                      placeholder="Add commit notes"
                                      disabled={commitVehiclesMutation.isPending}
                                    />
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="space-y-3 md:hidden">
                        {recommendedCommitVehicles.map((vehicle) => {
                          const selection = commitVehicleSelections[vehicle.vehicleId] ?? {
                            selected: false,
                            notes: '',
                          }
                          const selectedInRequirement = recommendedCommitVehicles.filter(
                            (row) =>
                              row.requirementKey === vehicle.requirementKey &&
                              (commitVehicleSelections[row.vehicleId]?.selected ?? false),
                          ).length
                          const selectionLimitReached =
                            selectedInRequirement >= vehicle.vehicleCountRequested
                          const checkboxDisabled =
                            commitVehiclesMutation.isPending ||
                            vehicle.vehicleCountRequested <= 0 ||
                            (selectionLimitReached && !selection.selected)
                          return (
                            <div
                              key={vehicle.vehicleId}
                              className="space-y-3 rounded-lg border border-[var(--fms-strokes)] p-4"
                            >
                              <label className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 accent-[var(--fms-button)]"
                                  checked={selection.selected}
                                  disabled={checkboxDisabled}
                                  onChange={() => toggleCommitVehicle(vehicle.vehicleId)}
                                />
                                <span className="text-sm font-medium text-[var(--fms-text-header)]">
                                  {vehicle.registrationNumber || vehicle.vehicleId}
                                </span>
                              </label>
                              <LoanDetailField label="Make & Model" value={vehicle.makeModelDisplay} />
                              <LoanDetailField label="Vehicle Category" value={vehicle.vehicleCategory} />
                              <LoanDetailField
                                label="Driver Required"
                                value={vehicle.driverRequired ? 'Yes' : 'No'}
                              />
                              <LoanDetailField label="Driver" value={vehicle.primaryDriverDisplay} />
                              <div className="space-y-2">
                                <Label htmlFor={`commit-notes-${vehicle.vehicleId}`}>Notes</Label>
                                <Input
                                  id={`commit-notes-${vehicle.vehicleId}`}
                                  value={selection.notes}
                                  onChange={(event) =>
                                    updateCommitVehicleNotes(vehicle.vehicleId, event.target.value)
                                  }
                                  placeholder="Add commit notes"
                                  disabled={commitVehiclesMutation.isPending}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      <div className="flex flex-wrap justify-end gap-3">
                        <Button
                          type="button"
                          disabled={
                            commitVehiclesMutation.isPending || selectedCommitVehicleCount === 0
                          }
                          onClick={confirmCommitVehicles}
                        >
                          {commitVehiclesMutation.isPending ? 'Committing…' : 'Commit'}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {showCommittedVehiclesSection ? (
            <Card className="border border-[var(--fms-strokes)] bg-white shadow-sm">
              <CardContent className="space-y-4 pt-5">
                <div>
                  <p className="text-base font-semibold text-[var(--fms-text-header)]">
                    Committed Vehicles
                  </p>
                  <p className="text-xs text-[var(--fms-text-subheading)]">
                    Vehicles assigned to this loan
                  </p>
                </div>

                {detail.committedVehicles.length === 0 ? (
                  <p className="text-sm text-[var(--fms-text-subheading)]">
                    No vehicles committed yet.
                  </p>
                ) : (
                  <>
                    <div className="hidden w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
                      <table className="w-max min-w-full text-sm">
                        <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold">Registration No.</th>
                            <th className="px-4 py-3 text-left font-semibold">Driver</th>
                            <th className="px-4 py-3 text-left font-semibold">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.committedVehicles.map((vehicle) => (
                            <tr
                              key={vehicle.vehicleId}
                              className="border-t border-[var(--fms-strokes)]"
                            >
                              <td className="px-4 py-3 font-medium text-[var(--fms-text-header)]">
                                {vehicle.registrationNumber || vehicle.vehicleId}
                              </td>
                              <td className="px-4 py-3 text-[var(--fms-text-header)]">
                                {vehicle.driverName || '—'}
                              </td>
                              <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                                {vehicle.notes || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="space-y-3 md:hidden">
                      {detail.committedVehicles.map((vehicle) => (
                        <div
                          key={vehicle.vehicleId}
                          className="space-y-2 rounded-lg border border-[var(--fms-strokes)] p-4"
                        >
                          <LoanDetailField
                            label="Registration No."
                            value={vehicle.registrationNumber || vehicle.vehicleId}
                          />
                          <LoanDetailField label="Driver" value={vehicle.driverName} />
                          <LoanDetailField label="Notes" value={vehicle.notes} />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}

          {showDispatchedVehiclesCard ? (
            <VehicleChecklistTableCard
              title="Dispatched Vehicle and Checklist"
              subtitle="Vehicles dispatched for this loan"
              timestampLabel="Dispatched at"
              timestampValue={detail.dispatchedAt || undefined}
              emptyMessage="No dispatched vehicles recorded yet."
              vehicles={dispatchedVehicles.map((vehicle) => ({
                vehicleId: vehicle.vehicleId,
                registrationNumber: vehicle.registrationNumber,
                driverName: vehicle.driverName,
                fuelLevel: vehicle.fuelLevelAtDispatch,
                odometer: vehicle.odometerAtDispatch,
                notes: vehicle.notes,
                checklist: vehicle.preDispatchChecklist,
              }))}
            />
          ) : (
            <LoanChecklistPlaceholderCard
              title="Dispatched Vehicle and Checklist"
              recorded={detail.handoverChecklistRecorded}
            />
          )}

          {showReturnedVehiclesCard ? (
            <VehicleChecklistTableCard
              title="Return Vehicle and Checklist"
              subtitle="Vehicles returned for this loan"
              timestampLabel="Returned at"
              timestampValue={detail.returnedAt || undefined}
              emptyMessage="No returned vehicles recorded yet."
              vehicles={returnedVehicles.map((vehicle) => ({
                vehicleId: vehicle.vehicleId,
                registrationNumber: vehicle.registrationNumber,
                driverName: vehicle.driverName,
                fuelLevel: vehicle.fuelLevelAtReturn,
                odometer: vehicle.odometerAtReturn,
                notes: vehicle.returnNotes || vehicle.notes,
                checklist: vehicle.postReturnChecklist,
              }))}
            />
          ) : (
            <LoanChecklistPlaceholderCard
              title="Return Vehicle and Checklist"
              recorded={detail.returnChecklistRecorded}
            />
          )}
        </div>

        <Card className="h-fit border border-[var(--fms-strokes)] bg-white shadow-sm lg:sticky lg:top-5">
          <CardContent className="pt-5">
            <LoanAuditTimeline
              entries={auditTimeline}
              isLoading={trackerQuery.isLoading && !trackerQuery.isSuccess}
            />
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={fleetSearchOpen}
        onOpenChange={(open) => {
          if (!open) closeFleetSearchDialog()
          else setFleetSearchOpen(true)
        }}
      >
        <DialogContent className="flex max-h-[90vh] w-full max-w-[calc(100%-2rem)] flex-col gap-4 overflow-hidden sm:max-w-6xl">
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
                        <th className="px-4 py-3 text-left font-semibold">Total Available</th>
                        <th className="px-4 py-3 text-left font-semibold">Requirements</th>
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
                                aria-label={`Select ${agency.agencyName || agency.id}`}
                              />
                            </td>
                            <td className="px-4 py-3 font-medium text-[var(--fms-text-header)]">
                              {agency.agencyName || agency.id}
                            </td>

                            <td className="px-4 py-3 text-[var(--fms-text-header)]">
                              {agency.totalAvailable}
                            </td>
                            <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                              {formatFleetSearchRequirementsSummary(agency.requirements)}
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
                          <LoanDetailField label="Agency" value={agency.agencyName || agency.id} />
                          <LoanDetailField
                            label="Fully Matches"
                            value={agency.fullyMatches ? 'Yes' : 'No'}
                          />
                          <LoanDetailField
                            label="Total Available"
                            value={String(agency.totalAvailable)}
                          />
                          <LoanDetailField
                            label="Requirements"
                            value={formatFleetSearchRequirementsSummary(agency.requirements)}
                          />
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

      <Dialog
        open={borrowingDecisionOpen !== null}
        onOpenChange={(open) => {
          if (!open) closeBorrowingDecisionDialog()
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {borrowingDecisionOpen === 'approve'
                ? 'Approve Lending Agency'
                : 'Reject Requisition'}
            </DialogTitle>
            <DialogDescription>
              {borrowingDecisionOpen === 'approve'
                ? 'Add remarks before sending the formal requisition to the selected lending agency.'
                : 'Provide a reason for rejecting this vehicle loan requisition.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="borrowing-head-decision-remarks">
              Remarks <span className="text-[var(--fms-delete)]">*</span>
            </Label>
            <textarea
              id="borrowing-head-decision-remarks"
              value={borrowingDecisionRemarks}
              onChange={(event) => setBorrowingDecisionRemarks(event.target.value)}
              placeholder={
                borrowingDecisionOpen === 'approve'
                  ? 'Agency fully meets all vehicle requirements. Sending formal requisition.'
                  : 'No agency has sufficient fleet capacity to meet this requirement during the requested period.'
              }
              rows={4}
              disabled={borrowingDecisionMutation.isPending}
              className="min-h-[96px] w-full rounded-lg border border-[var(--fms-strokes)] bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={borrowingDecisionMutation.isPending}
              onClick={closeBorrowingDecisionDialog}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={borrowingDecisionOpen === 'approve' ? 'default' : 'destructive'}
              disabled={borrowingDecisionMutation.isPending}
              onClick={confirmBorrowingDecision}
            >
              {borrowingDecisionMutation.isPending
                ? 'Submitting…'
                : borrowingDecisionOpen === 'approve'
                  ? 'Confirm Approve'
                  : 'Confirm Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={lendingDecisionOpen !== null}
        onOpenChange={(open) => {
          if (!open) closeLendingDecisionDialog()
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {lendingDecisionOpen === 'approve'
                ? 'Approve Lending Request'
                : 'Reject Lending Request'}
            </DialogTitle>
            <DialogDescription>
              {lendingDecisionOpen === 'approve'
                ? 'Add remarks before approving this vehicle loan requisition.'
                : 'Provide a reason for rejecting this vehicle loan requisition.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="lending-head-decision-remarks">
              Remarks <span className="text-[var(--fms-delete)]">*</span>
            </Label>
            <textarea
              id="lending-head-decision-remarks"
              value={lendingDecisionRemarks}
              onChange={(event) => setLendingDecisionRemarks(event.target.value)}
              placeholder={
                lendingDecisionOpen === 'approve'
                  ? 'Agency accepts the loan request and will proceed with vehicle commitment.'
                  : 'Unable to fulfill this loan request during the requested period.'
              }
              rows={4}
              disabled={lendingDecisionMutation.isPending}
              className="min-h-[96px] w-full rounded-lg border border-[var(--fms-strokes)] bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={lendingDecisionMutation.isPending}
              onClick={closeLendingDecisionDialog}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={lendingDecisionOpen === 'approve' ? 'default' : 'destructive'}
              disabled={lendingDecisionMutation.isPending}
              onClick={confirmLendingDecision}
            >
              {lendingDecisionMutation.isPending
                ? 'Submitting…'
                : lendingDecisionOpen === 'approve'
                  ? 'Confirm Approve'
                  : 'Confirm Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

export default LoanRequisitionDetail
