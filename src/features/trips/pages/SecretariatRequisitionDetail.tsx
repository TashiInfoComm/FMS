import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Car, ClipboardList, CloudUpload, Trash2, User, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SecretariatTripExtensionForm } from '@/features/trips/components/SecretariatTripExtensionForm'
import { fetchTripRequisitionMasterLists } from '@/features/trips/lib/trip-requisition-masters'
import { TripDetailSkeleton } from '@/features/trips/components/TripDetailSkeleton'
import { isPendingExtensionStatus, tripStatusBadgeClass } from '@/features/trips/lib/trip-form-utils'
import {
  acknowledgeSecretariatRequisition,
  completeSecretariatTrip,
  confirmSecretariatVehicle,
  decideSecretariatExtension,
  dispatchSecretariatRequisition,
  decideSecretariatHandover,
  handoverSecretariatRequisition,
  fetchSecretariatAvailableVehicles,
  fetchSecretariatChecklistItems,
  fetchSecretariatRequisitionDetail,
  openSecretariatMovementOrder,
  openSecretariatNoteSheet,
  startSecretariatTrip,
  verifySecretariatRequisition,
  type SecretariatChecklistItem,
} from '@/features/trips/lib/secretariat-requisitions-api'
import { fetchUsersForSelect } from '@/features/user/lib/users-api'
import { useUserStore } from '@/services/user-store'
import { BackToListButton } from '@/shared/components/BackToListButton'
import { PageHeader } from '@/shared/components/PageHeader'
import { SearchableAutocomplete } from '@/shared/components/SearchableAutocomplete'
import { useAccessControl } from '@/shared/hooks/useAccessControl'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { roleMatches, userHandlesDesignatedVehicles } from '@/shared/lib/designated-mto-access'
import { preOpenBrowserTab } from '@/shared/lib/open-in-new-tab'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'
import { cn } from '@/lib/utils'

const LIST_PATH = '/secretariat-requisitions'

const DISPATCH_CHECKLIST_STATUS_OPTIONS = [
  { value: 'OK', label: 'OK' },
  { value: 'DAMAGED', label: 'Damaged' },
] as const

type ChecklistFormRow = {
  key: string
  itemId: string
  name: string
  status: string
  remarks: string
}

type HandoverFormRow = {
  key: string
  itemId: string
  name: string
  dispatchedStatus: string
  dispatchedRemarks: string
  status: string
  remarks: string
}

function formatChecklistStatus(status: string): string {
  const code = status.trim().toUpperCase()
  if (code === 'OK') return 'OK'
  if (code === 'DAMAGED') return 'Damaged'
  return status.trim() || '—'
}

function checklistRowsFromMaster(items: SecretariatChecklistItem[]): ChecklistFormRow[] {
  return items.map((item) => ({
    key: item.id,
    itemId: item.id,
    name: item.name,
    status: 'OK',
    remarks: '',
  }))
}

function requisitionStatusCode(status: string): string {
  return status.trim().toUpperCase().replace(/[\s-]+/g, '_')
}

function isSecretariatDriverRole(role: string | null | undefined): boolean {
  return (
    roleMatches(role, 'fms-driver') ||
    roleMatches(role, 'fms-mto-driver') ||
    roleMatches(role, 'mto-driver')
  )
}

function parseOdometer(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof User
  title: string
  subtitle: string
}) {
  return (
    <div className="flex gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e8f0ff] text-[var(--fms-primary)]">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-base font-semibold text-[var(--fms-text-header)]">{title}</p>
        <p className="text-xs text-[var(--fms-text-subheading)]">{subtitle}</p>
      </div>
    </div>
  )
}

function FieldReadOnly({
  label,
  value,
  className,
}: {
  label: string
  value?: string
  className?: string
}) {
  const display = value && value !== '—' ? value : ''
  return (
    <div className={cn('space-y-2', className)}>
      <Label>{label}</Label>
      <Input readOnly value={display} placeholder="—" className="bg-[#f8f8f9] text-[var(--fms-text-header)]" />
    </div>
  )
}

type SecretariatDetailLocationState = {
  extendTrip?: boolean
}

export default function SecretariatRequisitionDetail() {
  const { requisitionId } = useParams<{ requisitionId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const crud = useRouteCrudPermissions(LIST_PATH)
  const { role } = useAccessControl()
  const currentUser = useUserStore((state) => state.user)
  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [vehicleId, setVehicleId] = useState('')
  const [remarks, setRemarks] = useState('')
  const [dispatchOpen, setDispatchOpen] = useState(false)
  const [checklistRows, setChecklistRows] = useState<ChecklistFormRow[]>([])
  const [handoverOpen, setHandoverOpen] = useState(false)
  const [handoverRows, setHandoverRows] = useState<HandoverFormRow[]>([])
  const [handoverDecision, setHandoverDecision] = useState<'accept' | 'reject' | null>(null)
  const [handoverDecisionRemarks, setHandoverDecisionRemarks] = useState('')
  const [acknowledgeOpen, setAcknowledgeOpen] = useState(false)
  const [acknowledge, setAcknowledge] = useState(true)
  const [driverId, setDriverId] = useState('')
  const [acknowledgeRemarks, setAcknowledgeRemarks] = useState('')
  const [startOpen, setStartOpen] = useState(false)
  const [startOdometer, setStartOdometer] = useState('')
  const [completeOpen, setCompleteOpen] = useState(false)
  const [endOdometer, setEndOdometer] = useState('')
  const [extensionReview, setExtensionReview] = useState<{
    extensionId: string
    approve: boolean
  } | null>(null)
  const [extensionRemarks, setExtensionRemarks] = useState('')

  const vehiclesQuery = useQuery({
    queryKey: ['secretariat-requisitions', 'vehicle-available', requisitionId],
    queryFn: () => fetchSecretariatAvailableVehicles(requisitionId!),
    enabled: assignOpen && Boolean(requisitionId?.trim()),
  })

  const detailQuery = useQuery({
    queryKey: ['secretariat-requisitions', 'detail', requisitionId],
    queryFn: () => fetchSecretariatRequisitionDetail(requisitionId!),
    enabled: Boolean(requisitionId?.trim()) && (!crud.isResolved || crud.canRead),
    staleTime: 30_000,
  })

  const purposeMastersQuery = useQuery({
    queryKey: ['trip-requisition-masters'],
    queryFn: fetchTripRequisitionMasterLists,
    staleTime: 60_000,
    enabled: Boolean(
      detailQuery.data?.extensions.some((extension) => extension.purposeId && !extension.purpose),
    ),
  })

  const driversQuery = useQuery({
    queryKey: ['admin-users', 'fms-driver', 100],
    queryFn: () => fetchUsersForSelect(100),
    enabled: acknowledgeOpen,
    staleTime: 60_000,
  })

  const driverOptions = useMemo(
    () =>
      (driversQuery.data ?? []).map((driver) => ({
        value: driver.id,
        label: driver.name,
        searchText: driver.name,
      })),
    [driversQuery.data],
  )

  const checklistQuery = useQuery({
    queryKey: ['master', 'item-names', 'secretariat-dispatch'],
    queryFn: fetchSecretariatChecklistItems,
    enabled: dispatchOpen,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (!dispatchOpen || checklistRows.length > 0 || !checklistQuery.data?.length) return
    setChecklistRows(checklistRowsFromMaster(checklistQuery.data))
  }, [checklistQuery.data, checklistRows.length, dispatchOpen])

  const noteSheetMutation = useMutation({
    mutationFn: (targetWindow: Window | null) => {
      const requisition = detailQuery.data
      if (!requisition) throw new Error('Requisition not found')
      return openSecretariatNoteSheet(
        requisition.id,
        requisition.noteSheet?.name ?? '',
        requisition.noteSheet?.url ?? '',
        targetWindow,
      )
    },
    onError: (error, targetWindow) => {
      if (targetWindow && !targetWindow.closed) targetWindow.close()
      showErrorToast(error, 'Could not open the approval note sheet')
    },
  })

  const movementOrderMutation = useMutation({
    mutationFn: (targetWindow: Window | null) => {
      const requisition = detailQuery.data
      if (!requisition) throw new Error('Requisition not found')
      return openSecretariatMovementOrder(
        requisition.id,
        requisition.generatedMovementOrder?.name ?? '',
        requisition.generatedMovementOrder?.url ?? '',
        targetWindow,
      )
    },
    onError: (error, targetWindow) => {
      if (targetWindow && !targetWindow.closed) targetWindow.close()
      showErrorToast(error, 'Could not open the generated movement order')
    },
  })

  const handoverDecisionMutation = useMutation({
    mutationFn: () => {
      if (!requisitionId || !handoverDecision) throw new Error('Handover decision is not available')
      if (handoverDecision === 'accept') {
        return decideSecretariatHandover(requisitionId, { acknowledge: true })
      }
      return decideSecretariatHandover(requisitionId, {
        acknowledge: false,
        remarks: handoverDecisionRemarks,
      })
    },
    onSuccess: async () => {
      const accepted = handoverDecision === 'accept'
      await queryClient.invalidateQueries({ queryKey: ['secretariat-requisitions'] })
      setHandoverDecision(null)
      setHandoverDecisionRemarks('')
      showSuccessToast(accepted ? 'Vehicle handover accepted.' : 'Vehicle handover rejected.')
    },
    onError: (error) => {
      showErrorToast(
        error,
        handoverDecision === 'accept'
          ? 'Failed to accept the vehicle handover'
          : 'Failed to reject the vehicle handover',
      )
    },
  })

  const handoverMutation = useMutation({
    mutationFn: () => {
      if (!requisitionId) throw new Error('Requisition ID is required')
      return handoverSecretariatRequisition(
        requisitionId,
        handoverRows.map((row) => ({
          item_id: row.itemId,
          status: row.status,
          remarks: row.remarks.trim() || undefined,
        })),
      )
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['secretariat-requisitions'] })
      setHandoverOpen(false)
      setHandoverRows([])
      showSuccessToast('Vehicle handed over.')
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to hand over the vehicle')
    },
  })

  const dispatchMutation = useMutation({
    mutationFn: () => {
      const requisition = detailQuery.data
      if (!requisition) throw new Error('Requisition not found')
      return dispatchSecretariatRequisition(requisition.id, {
        agency_id: requisition.agencyId,
        mto_name: requisition.requestedByName,
        checklist: checklistRows.map((row) => ({
          item_id: row.itemId,
          status: row.status,
          remarks: row.remarks.trim() || undefined,
        })),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['secretariat-requisitions'] })
      setDispatchOpen(false)
      setChecklistRows([])
      showSuccessToast('Secretariat trip requisition dispatched.')
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to dispatch secretariat trip requisition')
    },
  })

  const acknowledgeMutation = useMutation({
    mutationFn: () => {
      if (!requisitionId) throw new Error('Requisition ID is required')
      if (acknowledge) {
        return acknowledgeSecretariatRequisition(requisitionId, {
          acknowledge: true,
          driver_id: driverId,
        })
      }
      return acknowledgeSecretariatRequisition(requisitionId, {
        acknowledge: false,
        remarks: acknowledgeRemarks,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['secretariat-requisitions'] })
      setAcknowledgeOpen(false)
      setAcknowledge(true)
      setDriverId('')
      setAcknowledgeRemarks('')
      showSuccessToast(
        acknowledge
          ? 'Secretariat trip acknowledged and driver assigned.'
          : 'Secretariat trip acknowledgement declined.',
      )
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to acknowledge secretariat trip requisition')
    },
  })

  const extensionDecisionMutation = useMutation({
    mutationFn: () => {
      if (!requisitionId || !extensionReview) throw new Error('Extension is not available')
      return decideSecretariatExtension(
        requisitionId,
        extensionReview.extensionId,
        extensionReview.approve ? 'approve' : 'reject',
        extensionRemarks,
      )
    },
    onSuccess: async () => {
      const approved = extensionReview?.approve
      await queryClient.invalidateQueries({ queryKey: ['secretariat-requisitions'] })
      setExtensionReview(null)
      setExtensionRemarks('')
      showSuccessToast(approved ? 'Trip extension approved.' : 'Trip extension rejected.')
    },
    onError: (error) => {
      showErrorToast(
        error,
        extensionReview?.approve ? 'Failed to approve trip extension' : 'Failed to reject trip extension',
      )
    },
  })

  const startTripMutation = useMutation({
    mutationFn: (odometer: number) => {
      if (!requisitionId) throw new Error('Requisition ID is required')
      return startSecretariatTrip(requisitionId, odometer)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['secretariat-requisitions'] })
      setStartOpen(false)
      setStartOdometer('')
      showSuccessToast('Secretariat trip started.')
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to start secretariat trip')
    },
  })

  const completeTripMutation = useMutation({
    mutationFn: (odometer: number) => {
      if (!requisitionId) throw new Error('Requisition ID is required')
      return completeSecretariatTrip(requisitionId, odometer)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['secretariat-requisitions'] })
      setCompleteOpen(false)
      setEndOdometer('')
      showSuccessToast('Secretariat trip completed.')
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to complete secretariat trip')
    },
  })

  const confirmVehicleMutation = useMutation({
    mutationFn: () => {
      if (!requisitionId) throw new Error('Requisition ID is required')
      return confirmSecretariatVehicle(requisitionId, vehicleId)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['secretariat-requisitions'] })
      setAssignOpen(false)
      setVehicleId('')
      showSuccessToast('Vehicle assigned to the secretariat trip requisition.')
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to assign vehicle')
    },
  })

  const verifyMutation = useMutation({
    mutationFn: (input: { approve: boolean; remarks?: string }) => {
      if (!requisitionId) throw new Error('Requisition ID is required')
      return verifySecretariatRequisition(requisitionId, input)
    },
    onSuccess: async (_data, input) => {
      await queryClient.invalidateQueries({ queryKey: ['secretariat-requisitions'] })
      setApproveOpen(false)
      setRejectOpen(false)
      setRemarks('')
      showSuccessToast(
        input.approve
          ? 'Secretariat trip requisition approved.'
          : 'Secretariat trip requisition rejected.',
      )
    },
    onError: (error, input) => {
      showErrorToast(
        error,
        input.approve
          ? 'Failed to approve secretariat trip requisition'
          : 'Failed to reject secretariat trip requisition',
      )
    },
  })

  if (crud.isResolved && !crud.canRead) {
    return (
      <section className="space-y-5">
        <BackToListButton to={LIST_PATH} />
        <PageHeader title="Secretariat Trip Requisition" subtitle="Requisition detail" />
        <p className="text-sm text-[var(--fms-text-subheading)]">
          You do not have permission to view this requisition.
        </p>
      </section>
    )
  }

  if (detailQuery.isLoading) {
    return <TripDetailSkeleton title="Secretariat Trip Requisition" backPath={LIST_PATH} />
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <section className="space-y-5">
        <BackToListButton to={LIST_PATH} />
        <PageHeader title="Secretariat Trip Requisition" subtitle="Requisition not found" />
        <p className="text-sm text-[var(--fms-text-subheading)]">
          {detailQuery.error instanceof Error
            ? detailQuery.error.message
            : 'This secretariat requisition could not be loaded.'}
        </p>
      </section>
    )
  }

  const requisition = detailQuery.data
  const statusCode = requisitionStatusCode(requisition.statusCode || requisition.status)
  const isMto = roleMatches(role, 'fms-mto')
  const handlesDesignatedVehicles = userHandlesDesignatedVehicles(currentUser)
  const canVerify = isMto && handlesDesignatedVehicles && statusCode === 'SUBMITTED'
  const canAssignVehicle = isMto && handlesDesignatedVehicles && statusCode === 'APPROVED'
  const canDispatch =
    isMto && handlesDesignatedVehicles && statusCode === 'PLANNED' && !requisition.dispatchedAt
  const isDriver = isSecretariatDriverRole(role)
  const showMovementOrder = Boolean(requisition.generatedMovementOrder)
  const canAcknowledge =
    isMto && !handlesDesignatedVehicles && statusCode === 'DISPATCHED'
  const showExtensionForm =
    Boolean((location.state as SecretariatDetailLocationState | null)?.extendTrip) &&
    isMto &&
    !handlesDesignatedVehicles &&
    statusCode === 'IN_PROGRESS'
  const canStartTrip = isDriver && statusCode === 'ASSIGNED'
  const canCompleteTrip = isDriver && statusCode === 'IN_PROGRESS'
  const canReviewExtensions =
    isMto && handlesDesignatedVehicles && statusCode === 'IN_PROGRESS'
  const canResubmit = isMto && !handlesDesignatedVehicles && statusCode === 'REJECTED'
  const canHandover =
    isMto &&
    !handlesDesignatedVehicles &&
    (statusCode === 'COMPLETED' || statusCode === 'UNDER_MAINTENANCE')
  const canDecideHandover =
    isMto && handlesDesignatedVehicles && statusCode === 'HANDOVER_SUBMITTED'
  const rejectionRemarks =
    requisition.remarks && requisition.remarks !== '—' ? requisition.remarks : ''

  const closeDecisionDialog = () => {
    if (verifyMutation.isPending) return
    setApproveOpen(false)
    setRejectOpen(false)
    setRemarks('')
  }

  const closeAssignDialog = () => {
    if (confirmVehicleMutation.isPending) return
    setAssignOpen(false)
    setVehicleId('')
  }

  const closeDispatchDialog = () => {
    if (dispatchMutation.isPending) return
    setDispatchOpen(false)
    setChecklistRows([])
  }

  const closeHandoverDialog = () => {
    if (handoverMutation.isPending) return
    setHandoverOpen(false)
    setHandoverRows([])
  }

  const closeHandoverDecision = () => {
    if (handoverDecisionMutation.isPending) return
    setHandoverDecision(null)
    setHandoverDecisionRemarks('')
  }

  const closeAcknowledgeDialog = () => {
    if (acknowledgeMutation.isPending) return
    setAcknowledgeOpen(false)
    setAcknowledge(true)
    setDriverId('')
    setAcknowledgeRemarks('')
  }

  const closeStartDialog = () => {
    if (startTripMutation.isPending) return
    setStartOpen(false)
    setStartOdometer('')
  }

  const closeCompleteDialog = () => {
    if (completeTripMutation.isPending) return
    setCompleteOpen(false)
    setEndOdometer('')
  }

  const closeExtensionReview = () => {
    if (extensionDecisionMutation.isPending) return
    setExtensionReview(null)
    setExtensionRemarks('')
  }

  const openExtensionReview = (extensionId: string, approve: boolean) => {
    setExtensionRemarks('')
    setExtensionReview({ extensionId, approve })
  }

  const extensionCanBeReviewed = (status: string) =>
    canReviewExtensions &&
    (isPendingExtensionStatus(status) ||
      (!status.trim() && isPendingExtensionStatus(requisition.extensionStatus)))

  const extensionPurposeLabel = (purpose: string, purposeId: string) => {
    if (purpose) return purpose
    if (purposeId && purposeId === requisition.purposeId && requisition.purpose !== '—') {
      return requisition.purpose
    }
    return (
      purposeMastersQuery.data?.journeyPurposes.find((option) => option.value === purposeId)?.label ??
      ''
    )
  }

  const submitStartTrip = () => {
    const odometer = parseOdometer(startOdometer)
    if (odometer == null) {
      showErrorToast('Enter a valid start odometer reading.')
      return
    }
    startTripMutation.mutate(odometer)
  }

  const submitCompleteTrip = () => {
    const odometer = parseOdometer(endOdometer)
    if (odometer == null) {
      showErrorToast('Enter a valid end odometer reading.')
      return
    }
    completeTripMutation.mutate(odometer)
  }

  const submitAcknowledge = () => {
    if (acknowledge) {
      if (!driverId.trim()) {
        showErrorToast('Select a driver.')
        return
      }
    } else if (!acknowledgeRemarks.trim()) {
      showErrorToast('Remarks are required.')
      return
    }
    acknowledgeMutation.mutate()
  }

  const openHandoverDialog = () => {
    setHandoverRows(
      requisition.dispatchChecklist.map((item) => ({
        key: item.itemId,
        itemId: item.itemId,
        name: item.name,
        dispatchedStatus: item.status,
        dispatchedRemarks: item.remarks,
        status: 'OK',
        remarks: '',
      })),
    )
    setHandoverOpen(true)
  }

  const updateHandoverRow = (key: string, patch: Partial<HandoverFormRow>) => {
    setHandoverRows((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  const submitHandover = () => {
    if (handoverRows.length === 0) {
      showErrorToast('Checklist items are required.')
      return
    }
    for (const row of handoverRows) {
      if (!row.itemId.trim()) {
        showErrorToast(`Checklist item ${row.name} is missing.`)
        return
      }
      if (!row.status.trim()) {
        showErrorToast(`Select a return status for ${row.name}.`)
        return
      }
      if (row.status === 'DAMAGED' && !row.remarks.trim()) {
        showErrorToast(`Enter remarks for ${row.name}.`)
        return
      }
    }
    handoverMutation.mutate()
  }

  const updateChecklistRow = (key: string, patch: Partial<ChecklistFormRow>) => {
    setChecklistRows((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  const removeChecklistRow = (key: string) => {
    setChecklistRows((rows) => rows.filter((row) => row.key !== key))
  }

  const submitDispatch = () => {
    if (checklistRows.length === 0) {
      showErrorToast('Checklist items are required.')
      return
    }
    for (const [index, row] of checklistRows.entries()) {
      if (!row.itemId.trim()) {
        showErrorToast(`Checklist item ${index + 1} is missing.`)
        return
      }
      if (!row.status.trim()) {
        showErrorToast(`Select a status for ${row.name}.`)
        return
      }
      if (row.status === 'DAMAGED' && !row.remarks.trim()) {
        showErrorToast(`Enter remarks for ${row.name}.`)
        return
      }
    }
    if (!requisition.agencyId.trim()) {
      showErrorToast('Agency is required to dispatch.')
      return
    }
    if (!requisition.requestedByName.trim()) {
      showErrorToast('MTO name is required to dispatch.')
      return
    }
    dispatchMutation.mutate()
  }

  return (
    <section className="space-y-5">
      <BackToListButton to={LIST_PATH} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title={requisition.referenceNo}
          subtitle={
            <span className="inline-flex flex-wrap items-center gap-2">
              <span>{requisition.applicantName}</span>
              <Badge className={tripStatusBadgeClass(requisition.statusCode || requisition.status)}>
                {requisition.statusLabel || requisition.status}
              </Badge>
            </span>
          }
        />
      </div>

      {showExtensionForm ? (
        <SecretariatTripExtensionForm
          requisitionId={requisition.id}
          defaultOrigin={
            requisition.destination && requisition.destination !== '—'
              ? requisition.destination
              : requisition.origin
          }
          tripEndDatetime={requisition.endDatetimeIso}
          onCancel={() => navigate(LIST_PATH)}
          onSubmitted={() => navigate(LIST_PATH)}
        />
      ) : null}

      {statusCode === 'REJECTED' && rejectionRemarks ? (
        <Card className="border border-[#fde8e8] bg-[#fff8f8]">
          <CardContent className="space-y-1 pt-5">
            <p className="text-sm font-semibold text-[#c53030]">Rejection remarks</p>
            <p className="text-sm text-[var(--fms-text-header)]">{rejectionRemarks}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border border-[var(--fms-strokes)] bg-white">
        <CardContent className="space-y-4 pt-5">
          <SectionHeader
            icon={User}
            title="Applicant Information"
            subtitle="Secretariat employee this requisition was created for."
          />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <FieldReadOnly label="Employee ID" value={requisition.employeeId} />
            <FieldReadOnly label="Applicant Name" value={requisition.applicantName} />
            <FieldReadOnly label="Designation" value={requisition.designation} />
            <FieldReadOnly label="Agency" value={requisition.agency} />
            <FieldReadOnly label="Department" value={requisition.department} />
            <FieldReadOnly label="Division" value={requisition.division} />
            <FieldReadOnly label="Sub Division" value={requisition.subDivision} />
            <FieldReadOnly label="Contact Number" value={requisition.contactNumber} />
            <FieldReadOnly label="Email" value={requisition.email} />
          </div>
        </CardContent>
      </Card>

      <Card className="border border-[var(--fms-strokes)] bg-white">
        <CardContent className="space-y-4 pt-5">
          <SectionHeader
            icon={Car}
            title="Trip Details"
            subtitle="Journey requested for the secretariat."
          />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <FieldReadOnly label="Trip Type" value={requisition.tripType} />
            <FieldReadOnly label="Purpose of Journey" value={requisition.purpose} />
            <FieldReadOnly label="Preferred Vehicle Category" value={requisition.vehicleCategory} />
            <FieldReadOnly label="Origin" value={requisition.origin} />
            <FieldReadOnly label="Final Destination" value={requisition.destination} />
            <FieldReadOnly label="Journey Start" value={`${requisition.startDate} ${requisition.startTime}`} />
            <FieldReadOnly label="Journey End" value={`${requisition.endDate} ${requisition.endTime}`} />
            <FieldReadOnly label="Trip Duration" value={requisition.durationLabel} />
          </div>
          <FieldReadOnly
            label="Trip details justification"
            value={requisition.justification}
            className="w-full"
          />
          {requisition.noteSheet || showMovementOrder ? (
            <div className="flex flex-wrap gap-6">
              {requisition.noteSheet ? (
                <div className="space-y-2">
                  <Label>Approval Note sheet</Label>
                  <button
                    type="button"
                    disabled={noteSheetMutation.isPending}
                    onClick={() => noteSheetMutation.mutate(preOpenBrowserTab())}
                    className="inline-flex items-center gap-2 rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2 text-sm text-[var(--fms-primary)]"
                  >
                    <CloudUpload className="h-4 w-4 shrink-0" />
                    <span className="font-medium underline-offset-2 hover:underline">
                      {noteSheetMutation.isPending
                        ? 'Opening note sheet…'
                        : requisition.noteSheet.name}
                    </span>
                  </button>
                </div>
              ) : null}
              {showMovementOrder ? (
                <div className="space-y-2">
                  <Label>Generated movement order</Label>
                  <button
                    type="button"
                    disabled={movementOrderMutation.isPending}
                    onClick={() => movementOrderMutation.mutate(preOpenBrowserTab())}
                    className="inline-flex items-center gap-2 rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2 text-sm text-[var(--fms-primary)]"
                  >
                    <CloudUpload className="h-4 w-4 shrink-0" />
                    <span className="font-medium underline-offset-2 hover:underline">
                      {movementOrderMutation.isPending
                        ? 'Opening generated movement order…'
                        : (requisition.generatedMovementOrder?.name ?? 'Generated movement order')}
                    </span>
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {requisition.vehicle ? (
        <Card className="border border-[var(--fms-strokes)] bg-white">
          <CardContent className="space-y-4 pt-5">
            <SectionHeader
              icon={Car}
              title="Vehicle Details"
              subtitle="Vehicle assigned to this secretariat trip."
            />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {requisition.vehicle.registrationNumber ? (
                <FieldReadOnly
                  label="Registration Number"
                  value={requisition.vehicle.registrationNumber}
                />
              ) : null}
              {requisition.vehicle.make ? (
                <FieldReadOnly label="Make" value={requisition.vehicle.make} />
              ) : null}
              {requisition.vehicle.model ? (
                <FieldReadOnly label="Model" value={requisition.vehicle.model} />
              ) : null}
              {requisition.vehicle.year ? (
                <FieldReadOnly label="Manufacturing Year" value={requisition.vehicle.year} />
              ) : null}
              {requisition.vehicle.color ? (
                <FieldReadOnly label="Color" value={requisition.vehicle.color} />
              ) : null}
              {requisition.vehicle.vin ? (
                <FieldReadOnly label="VIN / Chassis" value={requisition.vehicle.vin} />
              ) : null}
              {requisition.vehicle.fuelType ? (
                <FieldReadOnly label="Fuel Type" value={requisition.vehicle.fuelType} />
              ) : null}
              {requisition.vehicle.category ? (
                <FieldReadOnly label="Vehicle Category" value={requisition.vehicle.category} />
              ) : null}
              {requisition.vehicle.seatingCapacity ? (
                <FieldReadOnly label="Seating Capacity" value={requisition.vehicle.seatingCapacity} />
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {requisition.driver ? (
        <Card className="border border-[var(--fms-strokes)] bg-white">
          <CardContent className="space-y-4 pt-5">
            <SectionHeader
              icon={User}
              title="Driver Details"
              subtitle="Driver assigned to this secretariat trip."
            />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {requisition.driver.name ? (
                <FieldReadOnly label="Driver Name" value={requisition.driver.name} />
              ) : null}
              {requisition.driver.cid ? (
                <FieldReadOnly label="CID" value={requisition.driver.cid} />
              ) : null}
              {requisition.driver.employeeId ? (
                <FieldReadOnly label="Employee ID" value={requisition.driver.employeeId} />
              ) : null}
              {requisition.driver.contact ? (
                <FieldReadOnly label="Contact Number" value={requisition.driver.contact} />
              ) : null}
              {requisition.driver.email ? (
                <FieldReadOnly label="Email" value={requisition.driver.email} />
              ) : null}
              {requisition.driver.licenseNumber ? (
                <FieldReadOnly label="License Number" value={requisition.driver.licenseNumber} />
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border border-[var(--fms-strokes)] bg-white">
        <CardContent className="space-y-4 pt-5">
          <SectionHeader
            icon={Users}
            title="Accompanying Officials"
            subtitle="Employees travelling with the secretariat on this trip."
          />
          {requisition.officials.length === 0 ? (
            <p className="text-sm text-[var(--fms-text-subheading)]">No accompanying officials added.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-[var(--fms-strokes)]">
              <table className="w-full text-sm">
                <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                  <tr>
                    <th className="w-16 px-4 py-3 text-left font-semibold">Sl.No</th>
                    <th className="px-4 py-3 text-left font-semibold">Employee CID</th>
                    <th className="px-4 py-3 text-left font-semibold">Full Name</th>
                  </tr>
                </thead>
                <tbody>
                  {requisition.officials.map((official, index) => (
                    <tr key={`${official.cid}-${index}`} className="border-t border-[var(--fms-strokes)]">
                      <td className="px-4 py-3 tabular-nums text-[var(--fms-text-subheading)]">{index + 1}</td>
                      <td className="px-4 py-3">{official.cid}</td>
                      <td className="px-4 py-3">{official.fullName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {requisition.extensions.map((extension, index) => (
        <Card key={extension.id} className="border border-[var(--fms-strokes)] bg-white">
          <CardContent className="space-y-4 pt-5">
            <SectionHeader
              icon={Car}
              title={
                requisition.extensions.length > 1 ? `Trip Extension ${index + 1}` : 'Trip Extension'
              }
              subtitle="Extension recorded for this secretariat trip."
            />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <FieldReadOnly label="Origin" value={extension.origin} />
              <FieldReadOnly label="Final Destination" value={extension.destination} />
              <FieldReadOnly label="Journey Start" value={extension.journeyStart} />
              <FieldReadOnly label="Journey End" value={extension.journeyEnd} />
              {extension.durationLabel ? (
                <FieldReadOnly label="Trip Duration" value={extension.durationLabel} />
              ) : null}
              {extension.previousDestination ? (
                <FieldReadOnly label="Previous Destination" value={extension.previousDestination} />
              ) : null}
              {extension.previousJourneyEnd ? (
                <FieldReadOnly label="Previous Journey End" value={extension.previousJourneyEnd} />
              ) : null}
              {extension.previousDurationLabel ? (
                <FieldReadOnly
                  label="Previous Trip Duration"
                  value={extension.previousDurationLabel}
                />
              ) : null}
              {extensionPurposeLabel(extension.purpose, extension.purposeId) ? (
                <FieldReadOnly
                  label="Purpose of Journey"
                  value={extensionPurposeLabel(extension.purpose, extension.purposeId)}
                />
              ) : null}
              <FieldReadOnly
                label="Status"
                value={extension.statusLabel || requisition.extensionStatusLabel}
              />
            </div>
            <FieldReadOnly
              label="Trip details justification"
              value={extension.justification}
              className="w-full"
            />
            {extension.decisionRemarks ? (
              <FieldReadOnly label="Decision Remarks" value={extension.decisionRemarks} />
            ) : null}
            {extension.noteSheetName ? (
              <FieldReadOnly label="Approval Note sheet" value={extension.noteSheetName} />
            ) : null}
            {extension.officials.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-[var(--fms-strokes)]">
                <table className="w-full text-sm">
                  <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                    <tr>
                      <th className="w-16 px-4 py-3 text-left font-semibold">Sl.No</th>
                      <th className="px-4 py-3 text-left font-semibold">Employee CID</th>
                      <th className="px-4 py-3 text-left font-semibold">Full Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extension.officials.map((official, officialIndex) => (
                      <tr
                        key={`${extension.id}-${official.cid}-${officialIndex}`}
                        className="border-t border-[var(--fms-strokes)]"
                      >
                        <td className="px-4 py-3 tabular-nums text-[var(--fms-text-subheading)]">
                          {officialIndex + 1}
                        </td>
                        <td className="px-4 py-3">{official.cid}</td>
                        <td className="px-4 py-3">{official.fullName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {extensionCanBeReviewed(extension.status) ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  disabled={extensionDecisionMutation.isPending}
                  onClick={() => openExtensionReview(extension.id, true)}
                >
                  Approve Extension
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="bg-[var(--fms-delete)] text-white hover:bg-[var(--fms-delete)]/90"
                  disabled={extensionDecisionMutation.isPending}
                  onClick={() => openExtensionReview(extension.id, false)}
                >
                  Reject Extension
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}

      {canDecideHandover ? (
        <Card className="border border-[var(--fms-strokes)] bg-white">
          <CardContent className="space-y-4 pt-5">
            <SectionHeader
              icon={ClipboardList}
              title="Handover Checklist"
              subtitle="Return checklist submitted for this vehicle."
            />
            {requisition.handoverChecklist.length === 0 ? (
              <p className="text-sm text-[var(--fms-text-subheading)]">
                No handover checklist items found.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[var(--fms-strokes)]">
                <table className="min-w-full text-sm">
                  <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Item</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                      <th className="px-4 py-3 text-left font-semibold">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requisition.handoverChecklist.map((item) => (
                      <tr key={item.itemId} className="border-t border-[var(--fms-strokes)]">
                        <td className="px-4 py-3 font-medium text-[var(--fms-text-header)]">
                          {item.name}
                        </td>
                        <td className="px-4 py-3 text-[var(--fms-text-header)]">
                          {formatChecklistStatus(item.status)}
                        </td>
                        <td className="px-4 py-3 text-[var(--fms-text-header)]">
                          {item.remarks || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {canDecideHandover ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  disabled={handoverDecisionMutation.isPending}
                  onClick={() => {
                    setHandoverDecisionRemarks('')
                    setHandoverDecision('accept')
                  }}
                >
                  Accept Handover
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="bg-[var(--fms-delete)] text-white hover:bg-[var(--fms-delete)]/90"
                  disabled={handoverDecisionMutation.isPending}
                  onClick={() => {
                    setHandoverDecisionRemarks('')
                    setHandoverDecision('reject')
                  }}
                >
                  Reject Handover
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {canVerify ||
      canAssignVehicle ||
      canDispatch ||
      canAcknowledge ||
      canStartTrip ||
      canCompleteTrip ||
      canHandover ||
      canResubmit ||
      requisition.noteSheet ||
      showMovementOrder ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {canAssignVehicle ? (
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={confirmVehicleMutation.isPending}
              onClick={() => {
                setVehicleId('')
                setAssignOpen(true)
              }}
            >
              Check Vehicle Availability and Assign
            </Button>
          ) : null}
          {canVerify ? (
            <>
              <Button
                type="button"
                className="w-full sm:w-auto"
                disabled={verifyMutation.isPending}
                onClick={() => {
                  setRemarks('')
                  setApproveOpen(true)
                }}
              >
                Approve
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="w-full bg-[var(--fms-delete)] text-white hover:bg-[var(--fms-delete)]/90 sm:w-auto"
                disabled={verifyMutation.isPending}
                onClick={() => {
                  setRemarks('')
                  setRejectOpen(true)
                }}
              >
                Reject
              </Button>
            </>
          ) : null}
          {canDispatch ? (
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={dispatchMutation.isPending}
              onClick={() => {
                setChecklistRows([])
                setDispatchOpen(true)
              }}
            >
              Dispatch
            </Button>
          ) : null}
          {canAcknowledge ? (
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={acknowledgeMutation.isPending}
              onClick={() => {
                setAcknowledge(true)
                setDriverId('')
                setAcknowledgeRemarks('')
                setAcknowledgeOpen(true)
              }}
            >
              Acknowledge and Assign Driver
            </Button>
          ) : null}
          {canStartTrip ? (
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={startTripMutation.isPending}
              onClick={() => {
                setStartOdometer('')
                setStartOpen(true)
              }}
            >
              Start Trip
            </Button>
          ) : null}
          {canCompleteTrip ? (
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={completeTripMutation.isPending}
              onClick={() => {
                setEndOdometer('')
                setCompleteOpen(true)
              }}
            >
              Complete Trip
            </Button>
          ) : null}
          {canHandover ? (
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={handoverMutation.isPending}
              onClick={openHandoverDialog}
            >
              Handover Vehicle
            </Button>
          ) : null}
          {canResubmit ? (
            <Button type="button" className="w-full sm:w-auto" asChild>
              <Link to={`${LIST_PATH}/${encodeURIComponent(requisition.id)}/edit`}>
                Edit and Resubmit
              </Link>
            </Button>
          ) : null}
          {requisition.noteSheet ? (
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={noteSheetMutation.isPending}
              onClick={() => noteSheetMutation.mutate(preOpenBrowserTab())}
            >
              <CloudUpload className="mr-1 h-4 w-4" />
              {noteSheetMutation.isPending ? 'Opening note sheet…' : 'View Note Sheet'}
            </Button>
          ) : null}
          {showMovementOrder ? (
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={movementOrderMutation.isPending}
              onClick={() => movementOrderMutation.mutate(preOpenBrowserTab())}
            >
              <CloudUpload className="mr-1 h-4 w-4" />
              {movementOrderMutation.isPending
                ? 'Opening movement order…'
                : 'View Movement Order'}
            </Button>
          ) : null}
        </div>
      ) : null}

      <Dialog open={assignOpen} onOpenChange={(open) => !open && closeAssignDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check Vehicle Availability</DialogTitle>
            <DialogDescription>
              Select an available vehicle to assign to this requisition.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Available Vehicle</Label>
            <SearchableAutocomplete
              value={vehicleId}
              onChange={setVehicleId}
              options={(vehiclesQuery.data ?? []).map((vehicle) => ({
                value: vehicle.id,
                label: vehicle.label,
              }))}
              loading={vehiclesQuery.isLoading}
              disabled={confirmVehicleMutation.isPending}
              placeholder="Select vehicle"
              searchPlaceholder="Search by plate or name…"
              emptyMessage={
                vehiclesQuery.isError
                  ? vehiclesQuery.error instanceof Error
                    ? vehiclesQuery.error.message
                    : 'Could not load available vehicles.'
                  : 'No vehicles are available.'
              }
              loadingMessage="Loading available vehicles…"
              side="top"
              className="[&_button]:bg-white"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={confirmVehicleMutation.isPending}
              onClick={closeAssignDialog}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[var(--fms-button)] text-white hover:bg-[var(--fms-button-hover)]"
              disabled={confirmVehicleMutation.isPending || !vehicleId || vehiclesQuery.isLoading}
              onClick={() => confirmVehicleMutation.mutate()}
            >
              {confirmVehicleMutation.isPending ? 'Confirming…' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={acknowledgeOpen} onOpenChange={(open) => !open && closeAcknowledgeDialog()}>
        <DialogContent className="flex max-h-[min(85vh,760px)] flex-col overflow-hidden sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Acknowledge and Assign Driver</DialogTitle>
            <DialogDescription>
              Review the dispatched checklist, then acknowledge this trip and assign a driver, or
              decline with remarks.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
            <div className="space-y-2">
              <Label>Dispatch Checklist</Label>
              {requisition.dispatchChecklist.length === 0 ? (
                <p className="text-sm text-[var(--fms-text-subheading)]">
                  No dispatched checklist items found.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-[var(--fms-strokes)]">
                  <table className="min-w-full text-sm">
                    <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Item</th>
                        <th className="px-4 py-3 text-left font-semibold">Dispatched Status</th>
                        <th className="px-4 py-3 text-left font-semibold">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requisition.dispatchChecklist.map((item) => (
                        <tr key={item.itemId} className="border-t border-[var(--fms-strokes)]">
                          <td className="px-4 py-3 font-medium text-[var(--fms-text-header)]">
                            {item.name}
                          </td>
                          <td className="px-4 py-3 text-[var(--fms-text-header)]">
                            {formatChecklistStatus(item.status)}
                          </td>
                          <td className="px-4 py-3 text-[var(--fms-text-header)]">
                            {item.remarks || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="secretariat-acknowledge">Acknowledge</Label>
              <div className="flex h-10 items-center gap-3 rounded-lg border border-[var(--fms-strokes)] px-3">
                <Switch
                  id="secretariat-acknowledge"
                  checked={acknowledge}
                  disabled={acknowledgeMutation.isPending}
                  onCheckedChange={(checked) => {
                    setAcknowledge(checked)
                    if (checked) setAcknowledgeRemarks('')
                    else setDriverId('')
                  }}
                  aria-label="Acknowledge"
                />
                <span className="text-sm text-[var(--fms-text-header)]">
                  {acknowledge ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
            {acknowledge ? (
              <div className="space-y-2">
                <Label>
                  Driver <span className="text-[var(--fms-delete)]">*</span>
                </Label>
                <SearchableAutocomplete
                  value={driverId}
                  onChange={setDriverId}
                  options={driverOptions}
                  loading={driversQuery.isLoading}
                  disabled={acknowledgeMutation.isPending}
                  placeholder={driversQuery.isError ? 'Could not load drivers' : 'Select driver'}
                  searchPlaceholder="Search driver name…"
                  emptyMessage={
                    driversQuery.isError ? 'Could not load drivers.' : 'No drivers found.'
                  }
                  loadingMessage="Loading drivers…"
                  error={driversQuery.isError}
                  side="top"
                  className="[&_button]:bg-white"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="secretariat-acknowledge-remarks">
                  Remarks <span className="text-[var(--fms-delete)]">*</span>
                </Label>
                <textarea
                  id="secretariat-acknowledge-remarks"
                  value={acknowledgeRemarks}
                  onChange={(event) => setAcknowledgeRemarks(event.target.value)}
                  placeholder="Enter remarks"
                  disabled={acknowledgeMutation.isPending}
                  className="min-h-[110px] w-full rounded-lg border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={acknowledgeMutation.isPending}
              onClick={closeAcknowledgeDialog}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[var(--fms-button)] text-white hover:bg-[var(--fms-button-hover)]"
              disabled={
                acknowledgeMutation.isPending ||
                (acknowledge
                  ? driversQuery.isLoading || !driverId.trim()
                  : !acknowledgeRemarks.trim())
              }
              onClick={submitAcknowledge}
            >
              {acknowledgeMutation.isPending ? 'Submitting…' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={startOpen} onOpenChange={(open) => !open && closeStartDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Trip</DialogTitle>
            <DialogDescription>Enter the starting odometer reading.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="secretariat-start-odometer">
              Start odometer <span className="text-[var(--fms-delete)]">*</span>
            </Label>
            <Input
              id="secretariat-start-odometer"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={startOdometer}
              disabled={startTripMutation.isPending}
              onChange={(event) => setStartOdometer(event.target.value)}
              placeholder="Enter odometer reading"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={startTripMutation.isPending}
              onClick={closeStartDialog}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[var(--fms-button)] text-white hover:bg-[var(--fms-button-hover)]"
              disabled={startTripMutation.isPending || !startOdometer.trim()}
              onClick={submitStartTrip}
            >
              {startTripMutation.isPending ? 'Starting…' : 'Start Trip'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={completeOpen} onOpenChange={(open) => !open && closeCompleteDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Trip</DialogTitle>
            <DialogDescription>Enter the ending odometer reading.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="secretariat-end-odometer">
              End odometer <span className="text-[var(--fms-delete)]">*</span>
            </Label>
            <Input
              id="secretariat-end-odometer"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={endOdometer}
              disabled={completeTripMutation.isPending}
              onChange={(event) => setEndOdometer(event.target.value)}
              placeholder="Enter odometer reading"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={completeTripMutation.isPending}
              onClick={closeCompleteDialog}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[var(--fms-button)] text-white hover:bg-[var(--fms-button-hover)]"
              disabled={completeTripMutation.isPending || !endOdometer.trim()}
              onClick={submitCompleteTrip}
            >
              {completeTripMutation.isPending ? 'Completing…' : 'Complete Trip'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dispatchOpen} onOpenChange={(open) => !open && closeDispatchDialog()}>
        <DialogContent className="flex max-h-[min(85vh,760px)] flex-col overflow-hidden sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Dispatch</DialogTitle>
            <DialogDescription>
              Review each checklist item and record its status before dispatch.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
            {checklistQuery.isLoading ? (
              <p className="text-sm text-[var(--fms-text-subheading)]">Loading checklist items…</p>
            ) : checklistQuery.isError ? (
              <p className="text-sm text-[var(--fms-error-text)]">
                {checklistQuery.error instanceof Error
                  ? checklistQuery.error.message
                  : 'Could not load checklist items.'}
              </p>
            ) : checklistRows.length === 0 ? (
              <p className="text-sm text-[var(--fms-text-subheading)]">No checklist items found.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[var(--fms-strokes)]">
                <table className="min-w-full text-sm">
                  <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Item</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                      <th className="px-4 py-3 text-left font-semibold">Remarks</th>
                      <th className="px-4 py-3 text-right font-semibold">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {checklistRows.map((item) => (
                      <tr key={item.key} className="border-t border-[var(--fms-strokes)]">
                        <td className="px-4 py-3 font-medium text-[var(--fms-text-header)]">
                          {item.name}
                        </td>
                        <td className="px-4 py-3">
                          <Select
                            value={item.status}
                            onValueChange={(value) => updateChecklistRow(item.key, { status: value })}
                            disabled={dispatchMutation.isPending}
                          >
                            <SelectTrigger className="w-full min-w-[140px]">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              {DISPATCH_CHECKLIST_STATUS_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            value={item.remarks}
                            onChange={(event) =>
                              updateChecklistRow(item.key, { remarks: event.target.value })
                            }
                            placeholder={
                              item.status === 'DAMAGED' ? 'Remarks required' : 'Optional remarks'
                            }
                            required={item.status === 'DAMAGED'}
                            disabled={dispatchMutation.isPending}
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-[var(--fms-error-text)]"
                            onClick={() => removeChecklistRow(item.key)}
                            disabled={dispatchMutation.isPending || checklistRows.length <= 1}
                            aria-label={`Remove ${item.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={dispatchMutation.isPending}
              onClick={closeDispatchDialog}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[var(--fms-button)] text-white hover:bg-[var(--fms-button-hover)]"
              disabled={
                dispatchMutation.isPending ||
                checklistQuery.isLoading ||
                checklistRows.length === 0
              }
              onClick={submitDispatch}
            >
              {dispatchMutation.isPending ? 'Dispatching…' : 'Dispatch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={handoverOpen} onOpenChange={(open) => !open && closeHandoverDialog()}>
        <DialogContent className="flex max-h-[min(85vh,760px)] flex-col overflow-hidden sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Handover Vehicle</DialogTitle>
            <DialogDescription>
              Review each dispatched checklist item and record its return status.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
            {handoverRows.length === 0 ? (
              <p className="text-sm text-[var(--fms-text-subheading)]">
                No dispatched checklist items found.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[var(--fms-strokes)]">
                <table className="min-w-full text-sm">
                  <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Item</th>
                      <th className="px-4 py-3 text-left font-semibold">Dispatched Status</th>
                      <th className="px-4 py-3 text-left font-semibold">Return Status</th>
                      <th className="px-4 py-3 text-left font-semibold">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {handoverRows.map((item) => (
                      <tr key={item.key} className="border-t border-[var(--fms-strokes)]">
                        <td className="px-4 py-3 font-medium text-[var(--fms-text-header)]">
                          {item.name}
                        </td>
                        <td className="px-4 py-3 text-[var(--fms-text-header)]">
                          <p>{formatChecklistStatus(item.dispatchedStatus)}</p>
                          {item.dispatchedRemarks ? (
                            <p className="mt-1 text-xs text-[var(--fms-text-subheading)]">
                              {item.dispatchedRemarks}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <Select
                            value={item.status}
                            onValueChange={(value) => updateHandoverRow(item.key, { status: value })}
                            disabled={handoverMutation.isPending}
                          >
                            <SelectTrigger className="w-full min-w-[140px]">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              {DISPATCH_CHECKLIST_STATUS_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            value={item.remarks}
                            onChange={(event) =>
                              updateHandoverRow(item.key, { remarks: event.target.value })
                            }
                            placeholder={
                              item.status === 'DAMAGED' ? 'Remarks required' : 'Optional remarks'
                            }
                            required={item.status === 'DAMAGED'}
                            disabled={handoverMutation.isPending}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={handoverMutation.isPending}
              onClick={closeHandoverDialog}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[var(--fms-button)] text-white hover:bg-[var(--fms-button-hover)]"
              disabled={handoverMutation.isPending || handoverRows.length === 0}
              onClick={submitHandover}
            >
              {handoverMutation.isPending ? 'Handing over…' : 'Handover Vehicle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={handoverDecision !== null}
        onOpenChange={(open) => !open && closeHandoverDecision()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {handoverDecision === 'reject' ? 'Reject Handover' : 'Accept Handover'}
            </DialogTitle>
            <DialogDescription>
              {handoverDecision === 'reject'
                ? 'Remarks are required before rejecting this handover.'
                : 'Accept the submitted vehicle handover.'}
            </DialogDescription>
          </DialogHeader>
          {handoverDecision === 'reject' ? (
            <div className="space-y-2">
              <Label htmlFor="secretariat-handover-decision-remarks">
                Remarks <span className="text-[var(--fms-delete)]">*</span>
              </Label>
              <textarea
                id="secretariat-handover-decision-remarks"
                value={handoverDecisionRemarks}
                onChange={(event) => setHandoverDecisionRemarks(event.target.value)}
                placeholder="Enter remarks"
                disabled={handoverDecisionMutation.isPending}
                className="min-h-[110px] w-full rounded-lg border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={handoverDecisionMutation.isPending}
              onClick={closeHandoverDecision}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={handoverDecision === 'reject' ? 'destructive' : 'default'}
              className={
                handoverDecision === 'reject'
                  ? 'bg-[var(--fms-delete)] text-white hover:bg-[var(--fms-delete)]/90'
                  : 'bg-[var(--fms-button)] text-white hover:bg-[var(--fms-button-hover)]'
              }
              disabled={
                handoverDecisionMutation.isPending ||
                (handoverDecision === 'reject' && !handoverDecisionRemarks.trim())
              }
              onClick={() => handoverDecisionMutation.mutate()}
            >
              {handoverDecisionMutation.isPending
                ? handoverDecision === 'reject'
                  ? 'Rejecting…'
                  : 'Accepting…'
                : handoverDecision === 'reject'
                  ? 'Reject Handover'
                  : 'Accept Handover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={extensionReview !== null} onOpenChange={(open) => !open && closeExtensionReview()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {extensionReview?.approve ? 'Approve Extension' : 'Reject Extension'}
            </DialogTitle>
            <DialogDescription>
              Remarks are required before{' '}
              {extensionReview?.approve ? 'approving' : 'rejecting'} this extension.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="secretariat-extension-remarks">
              Remarks <span className="text-[var(--fms-delete)]">*</span>
            </Label>
            <textarea
              id="secretariat-extension-remarks"
              value={extensionRemarks}
              onChange={(event) => setExtensionRemarks(event.target.value)}
              placeholder="Enter remarks"
              disabled={extensionDecisionMutation.isPending}
              className="min-h-[110px] w-full rounded-lg border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={extensionDecisionMutation.isPending}
              onClick={closeExtensionReview}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={extensionReview?.approve ? 'default' : 'destructive'}
              className={
                extensionReview?.approve
                  ? 'bg-[var(--fms-button)] text-white hover:bg-[var(--fms-button-hover)]'
                  : 'bg-[var(--fms-delete)] text-white hover:bg-[var(--fms-delete)]/90'
              }
              disabled={extensionDecisionMutation.isPending || !extensionRemarks.trim()}
              onClick={() => extensionDecisionMutation.mutate()}
            >
              {extensionDecisionMutation.isPending
                ? extensionReview?.approve
                  ? 'Approving…'
                  : 'Rejecting…'
                : extensionReview?.approve
                  ? 'Approve'
                  : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={approveOpen} onOpenChange={(open) => !open && closeDecisionDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Remark</DialogTitle>
            <DialogDescription>
              Add an optional remark before approving this requisition.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="secretariat-approve-remarks">Remarks</Label>
            <textarea
              id="secretariat-approve-remarks"
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              placeholder="Enter remarks (optional)"
              disabled={verifyMutation.isPending}
              className="min-h-[110px] w-full rounded-lg border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={verifyMutation.isPending}
              onClick={closeDecisionDialog}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[var(--fms-button)] text-white hover:bg-[var(--fms-button-hover)]"
              disabled={verifyMutation.isPending}
              onClick={() =>
                verifyMutation.mutate({ approve: true, remarks: remarks.trim() || undefined })
              }
            >
              {verifyMutation.isPending ? 'Approving…' : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={(open) => !open && closeDecisionDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Requisition</DialogTitle>
            <DialogDescription>
              Enter a remark explaining why this requisition is being rejected.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="secretariat-reject-remarks">
              Remarks <span className="text-[var(--fms-delete)]">*</span>
            </Label>
            <textarea
              id="secretariat-reject-remarks"
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              placeholder="Enter rejection remarks"
              disabled={verifyMutation.isPending}
              className="min-h-[110px] w-full rounded-lg border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={verifyMutation.isPending}
              onClick={closeDecisionDialog}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="bg-[var(--fms-delete)] text-white hover:bg-[var(--fms-delete)]/90"
              disabled={verifyMutation.isPending || !remarks.trim()}
              onClick={() => verifyMutation.mutate({ approve: false, remarks: remarks.trim() })}
            >
              {verifyMutation.isPending ? 'Rejecting…' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
