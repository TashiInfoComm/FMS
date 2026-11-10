import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CarFront,
  Clock3,
  CloudUpload,
  User,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

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
import { Skeleton } from '@/components/ui/skeleton'
import { ServicesPartsTable } from '@/features/maintenance/components/ServicesPartsTable'
import {
  getServicePartOptions,
  sumLineItems,
  type MaintenanceLineItem,
  type WorkOrderDetail as WorkOrderDetailData,
  type WorkOrderServiceRecord,
} from '@/features/maintenance/lib/maintenance-mock-data'
import { fetchMaintenanceTypes } from '@/features/maintenance/lib/maintenance-masters-api'
import {
  formatWorkOrderStatusLabel,
  resolveMaintenanceTypeKind,
  shouldEscalateWorkOrderMtoApproval,
  workOrderStatusBadgeClass,
} from '@/features/maintenance/lib/maintenance-ui'
import { formatFuelLogDate } from '@/features/fuel/lib/fuel-log-mock-data'
import { isSecretariatDesignationType } from '@/features/maintenance/lib/renewal-applications-api'
import {
  approveWorkOrder,
  assignWorkOrderDriver,
  completeWorkOrder,
  fetchWorkOrderById,
  financeVerifyWorkOrder,
  markWorkOrderPaid,
  reviewWorkOrderAsAgencyMto,
  type AgencyMtoReviewAction,
  openWorkOrderInvoice,
  rejectWorkOrder,
  updateWorkOrderServicesAndParts,
  verifyWorkOrder,
  type VerifyWorkOrderInput,
} from '@/features/maintenance/lib/work-orders-api'
import { fetchUsersForSelect } from '@/features/user/lib/users-api'
import { useUserStore } from '@/services/user-store'
import { BackToListButton } from '@/shared/components/BackToListButton'
import { PageHeader } from '@/shared/components/PageHeader'
import { SearchableAutocomplete } from '@/shared/components/SearchableAutocomplete'
import {
  DetailInlineValueSkeleton,
  DetailReadOnlyFieldSkeleton,
} from '@/shared/components/detail-loading'
import { useAccessControl } from '@/shared/hooks/useAccessControl'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import {
  canProceedRenewalApplication,
  canShowDesignatedWorkOrderCreate,
  canVerifyRenewalApplication,
  roleMatches,
  userHandlesDesignatedVehicles,
} from '@/shared/lib/designated-mto-access'
import { todayDateInputValue } from '@/shared/lib/date-input'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'
import { preOpenBrowserTab } from '@/shared/lib/open-in-new-tab'
import { cn } from '@/lib/utils'

/** Statuses on which an accountant can mark a work order paid, after finance verification. */
const ACCOUNTANT_PAID_STATUSES = new Set([
  'PENDING_PAYMENT',
  'PENDING_PAID',
  'VERIFIED',
  'FINANCE_VERIFIED',
  'FINANCE_APPROVED',
  'APPROVED_FOR_PAYMENT',
])

function needsMaintenanceTypeLookup(detail: WorkOrderDetailData): boolean {
  if (!detail.maintenanceTypeId?.trim()) return false
  const current = detail.maintenanceType.trim()
  return current === 'Minor' || current === 'Major' || current === '—' || current === ''
}

function basenameFromObjectKey(value: string): string {
  const trimmed = value.trim().split('?')[0]?.trim() ?? ''
  if (!trimmed) return ''
  const parts = trimmed.split(/[/\\]/).filter(Boolean)
  return parts[parts.length - 1] ?? trimmed
}

function hasServiceRecordDetailData(
  serviceRecord?: WorkOrderServiceRecord,
): boolean {
  if (!serviceRecord) return false
  const invoiceNumber = serviceRecord.invoiceNumber?.trim()
  const invoiceDate = serviceRecord.invoiceDate?.trim()
  const invoiceUrl = serviceRecord.invoiceUrl?.trim()
  return Boolean(
    (invoiceNumber && invoiceNumber !== '—') ||
      (invoiceDate && invoiceDate !== '—') ||
      invoiceUrl,
  )
}

function ServiceRecordDetailSection({
  serviceRecord,
  invoiceLoading,
  onInvoiceClick,
  embedded = false,
}: {
  serviceRecord?: WorkOrderServiceRecord
  invoiceLoading?: boolean
  onInvoiceClick?: () => void
  embedded?: boolean
}) {
  const invoiceUrl = serviceRecord?.invoiceUrl?.trim() ?? ''
  const invoiceFileName = invoiceUrl ? basenameFromObjectKey(invoiceUrl) : ''
  const invoiceDateDisplay =
    serviceRecord?.invoiceDate && serviceRecord.invoiceDate !== '—'
      ? formatFuelLogDate(serviceRecord.invoiceDate)
      : serviceRecord?.invoiceDate ?? '—'

  return (
    <div
      className={cn(
        'space-y-4',
        embedded && 'mt-6 border-t border-[var(--fms-strokes)] pt-5',
      )}
    >
      <div>
        <h3 className="text-base font-semibold text-[var(--fms-text-header)]">
          Service Record
        </h3>
        <p className="text-xs text-[var(--fms-text-subheading)]">
          Invoice details submitted during maintenance verification.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <FieldReadOnly
          label="Invoice Number"
          value={serviceRecord?.invoiceNumber}
        />
        <FieldReadOnly label="Invoice Date" value={invoiceDateDisplay} />
      </div>
      <div className="space-y-2">
        <Label>Invoice</Label>
        {invoiceUrl ? (
          <button
            type="button"
            disabled={invoiceLoading || !onInvoiceClick}
            onClick={onInvoiceClick}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2 text-sm text-[var(--fms-primary)]',
              invoiceLoading
                ? 'cursor-wait opacity-70'
                : onInvoiceClick
                  ? 'cursor-pointer transition-colors hover:bg-[#dbeafe]'
                  : 'cursor-default',
            )}
          >
            <CloudUpload className="h-4 w-4 shrink-0" />
            <span className="font-medium underline-offset-2 hover:underline">
              {invoiceLoading ? 'Opening invoice…' : invoiceFileName || 'View invoice'}
            </span>
          </button>
        ) : (
          <Input readOnly value="" placeholder="—" className="bg-[#f8f8f9]" />
        )}
      </div>
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  loading = false,
}: {
  icon: typeof User
  label: string
  value: string
  loading?: boolean
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--fms-strokes)] bg-[#f6f6f7] p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--fms-primary)]">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[var(--fms-text-subheading)]">{label}</p>
        {loading ? (
          <DetailInlineValueSkeleton className="mt-1" />
        ) : (
          <p className="mt-0.5 font-semibold text-[var(--fms-text-header)]">
            {value || '—'}
          </p>
        )}
      </div>
    </div>
  )
}

function FieldReadOnly({
  label,
  value,
  className,
  loading = false,
}: {
  label: string
  value?: string
  className?: string
  loading?: boolean
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label>{label}</Label>
      {loading ? (
        <Skeleton className="h-9 w-full rounded-md" />
      ) : (
        <Input
          readOnly
          value={value ?? ''}
          placeholder="—"
          className="bg-[#f8f8f9] text-[var(--fms-text-header)]"
        />
      )}
    </div>
  )
}

export default function WorkOrderDetail() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { workOrderId: workOrderIdParam, recordId } = useParams<{
    workOrderId?: string
    recordId?: string
  }>()
  const workOrderId = (workOrderIdParam ?? recordId ?? '').trim()
  const returnTo =
    (location.state as { returnTo?: string } | null)?.returnTo ??
    '/maintenance/work-orders'
  const { apiRoleName, role } = useAccessControl()
  const user = useUserStore((state) => state.user)
  const crud = useRouteCrudPermissions('/maintenance/work-orders')
  const normalizedRole = apiRoleName?.trim().toLowerCase() ?? ''
  const isDriverRole = normalizedRole.includes('driver')
  const isMtoRole = normalizedRole.includes('mto')
  const isAgencyAdminRole =
    normalizedRole.includes('agency-admin') ||
    normalizedRole.includes('agency_admin') ||
    normalizedRole.includes('agency admin')
  const canViewServicesParts =
    isMtoRole ||
    isAgencyAdminRole
  const canEditServicesParts = isMtoRole
  const canShowServicesPartsTable = canViewServicesParts || isDriverRole

  const servicePartOptions = useMemo(() => getServicePartOptions(), [])
  const [lineItems, setLineItems] = useState<MaintenanceLineItem[]>([])
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [finalOdometerKm, setFinalOdometerKm] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [verifyRemarks, setVerifyRemarks] = useState('')
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [assignDriverDialogOpen, setAssignDriverDialogOpen] = useState(false)
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [financeDialogMode, setFinanceDialogMode] = useState<'approve' | 'return' | null>(null)
  const [financeRemarks, setFinanceRemarks] = useState('')
  const [agencyMtoDialogMode, setAgencyMtoDialogMode] = useState<'forward' | 'return' | null>(
    null,
  )
  const [agencyMtoRemarks, setAgencyMtoRemarks] = useState('')
  const [paidDialogOpen, setPaidDialogOpen] = useState(false)
  const [paidRemarks, setPaidRemarks] = useState('')
  const invoiceFileInputRef = useRef<HTMLInputElement>(null)

  const detailQuery = useQuery({
    queryKey: ['maintenance-work-order', workOrderId],
    queryFn: () => fetchWorkOrderById(workOrderId),
    enabled: Boolean(workOrderId.trim()),
    staleTime: 30_000,
  })

  const workOrder = detailQuery.data
  const resolveMaintenanceType = workOrder ? needsMaintenanceTypeLookup(workOrder) : false

  const maintenanceTypeQuery = useQuery({
    queryKey: ['maintenance', 'maintenance-types'],
    queryFn: fetchMaintenanceTypes,
    enabled: Boolean(workOrder) && resolveMaintenanceType,
    staleTime: 60_000,
  })

  const driversQuery = useQuery({
    queryKey: ['admin-users', 'fms-driver', 100],
    queryFn: () => fetchUsersForSelect(100),
    enabled: assignDriverDialogOpen,
    staleTime: 60_000,
  })

  const displayMaintenanceType = useMemo(() => {
    if (!workOrder) return ''
    if (!resolveMaintenanceType) return workOrder.maintenanceType
    if (maintenanceTypeQuery.isLoading) return workOrder.maintenanceType
    const match = maintenanceTypeQuery.data?.find(
      (option) => option.value === workOrder.maintenanceTypeId,
    )
    return match?.label || workOrder.maintenanceType
  }, [workOrder, resolveMaintenanceType, maintenanceTypeQuery.data, maintenanceTypeQuery.isLoading])

  const displayDriverName = useMemo(() => {
    if (!workOrder) return ''
    const name = workOrder.driverName.trim()
    const missing = !name || name === '—' || name === '-'
    if (missing && isSecretariatDesignationType(workOrder.designationType)) return '----'
    return missing ? '—' : name
  }, [workOrder])

  const isMainLoading = detailQuery.isPending && !workOrder
  const isMaintenanceTypeLoading = resolveMaintenanceType && maintenanceTypeQuery.isLoading

  const approveMutation = useMutation({
    mutationFn: () => {
      const designatedSpecificMto =
        workOrder != null &&
        workOrder.estimatedCost == null &&
        workOrder.status.trim().toUpperCase().replace(/[\s-]+/g, '_') ===
          'PENDING_SPECIFIC_MTO' &&
        workOrder.designationType.trim().toUpperCase().replace(/[\s-]+/g, '_') ===
          'MINISTER' &&
        (canShowDesignatedWorkOrderCreate(apiRoleName, user) ||
          canShowDesignatedWorkOrderCreate(role, user))
      if (!designatedSpecificMto && !crud.canApprove && crud.isResolved) {
        throw new Error('You do not have permission to approve this work order.')
      }
      const servicesAndParts = lineItems
        .filter((row) => row.description.trim() !== '')
        .map((row) => ({
          name: row.description.trim(),
          unit_price: row.unitPrice,
          quantity: row.quantity,
          notes: (row.notes ?? '').trim(),
        }))

      return approveWorkOrder(workOrderId, {
        remarks,
        services_and_parts: servicesAndParts,
      })
    },
    onSuccess: () => {
      setApproveDialogOpen(false)
      setRemarks('')
      void queryClient.invalidateQueries({ queryKey: ['maintenance-work-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['maintenance-work-order'] })
      const maintenanceTypeCodeOnSubmit =
        maintenanceTypeQuery.data?.find(
          (option) => option.value === workOrder?.maintenanceTypeId,
        )?.code ?? workOrder?.maintenanceType ?? ''
      const statusOnSubmit = workOrder?.status.trim().toUpperCase() ?? ''
      const totalOnSubmit = sumLineItems(lineItems)
      const escalated =
        isMtoRole &&
        statusOnSubmit === 'PENDING_MTO_APPROVAL' &&
        shouldEscalateWorkOrderMtoApproval({
          maintenanceTypeLabel: displayMaintenanceType,
          maintenanceTypeCode: maintenanceTypeCodeOnSubmit,
          totalAmount: totalOnSubmit,
        })
      showSuccessToast(
        escalated
          ? 'Work order escalated successfully.'
          : 'Work order approved successfully.',
      )
      navigate('/maintenance/work-orders')
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to submit approval')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: () => {
      const designatedSpecificMto =
        workOrder != null &&
        workOrder.estimatedCost == null &&
        workOrder.status.trim().toUpperCase().replace(/[\s-]+/g, '_') ===
          'PENDING_SPECIFIC_MTO' &&
        workOrder.designationType.trim().toUpperCase().replace(/[\s-]+/g, '_') ===
          'MINISTER' &&
        (canShowDesignatedWorkOrderCreate(apiRoleName, user) ||
          canShowDesignatedWorkOrderCreate(role, user))
      if (!designatedSpecificMto && !crud.canReject && crud.isResolved) {
        throw new Error('You do not have permission to reject this work order.')
      }
      return rejectWorkOrder(workOrderId, { reason: rejectReason })
    },
    onSuccess: () => {
      setRejectDialogOpen(false)
      setRejectReason('')
      void queryClient.invalidateQueries({ queryKey: ['maintenance-work-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['maintenance-work-order'] })
      showSuccessToast('Work order rejected successfully.')
      navigate('/maintenance/work-orders')
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to reject work order')
    },
  })

  const completeMaintenanceMutation = useMutation({
    mutationFn: () =>
      completeWorkOrder(workOrderId, {
        final_odometer_km: Number.parseInt(finalOdometerKm, 10),
      }),
    onSuccess: () => {
      setCompleteDialogOpen(false)
      setFinalOdometerKm('')
      void queryClient.invalidateQueries({ queryKey: ['maintenance-work-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['maintenance-work-order'] })
      showSuccessToast('Maintenance completed successfully.')
      navigate('/maintenance/work-orders')
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to complete maintenance')
    },
  })

  const financeVerifyMutation = useMutation({
    mutationFn: (action: 'APPROVE' | 'REJECT') => {
      if (!showFinanceVerify) {
        throw new Error('You do not have permission to verify this work order.')
      }
      return financeVerifyWorkOrder(workOrderId, {
        action,
        remarks: financeRemarks,
      })
    },
    onSuccess: (_result, action) => {
      setFinanceDialogMode(null)
      setFinanceRemarks('')
      void queryClient.invalidateQueries({ queryKey: ['maintenance-work-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['maintenance-work-order', workOrderId] })
      showSuccessToast(
        action === 'REJECT' ? 'Work order returned.' : 'Work order verified.',
      )
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to verify work order')
    },
  })

  const agencyMtoReviewMutation = useMutation({
    mutationFn: (action: AgencyMtoReviewAction) => {
      if (!showMinisterAgencyMtoForward) {
        throw new Error('You do not have permission to review this work order.')
      }
      if (action === 'return' && !agencyMtoRemarks.trim()) {
        throw new Error('Enter remarks before returning this work order.')
      }
      return reviewWorkOrderAsAgencyMto(workOrderId, {
        action,
        remarks: agencyMtoRemarks,
      })
    },
    onSuccess: (_result, action) => {
      setAgencyMtoDialogMode(null)
      setAgencyMtoRemarks('')
      void queryClient.invalidateQueries({ queryKey: ['maintenance-work-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['maintenance-work-order', workOrderId] })
      showSuccessToast(
        action === 'return'
          ? 'Work order returned.'
          : 'Work order forwarded to DPP MTO.',
      )
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to review work order')
    },
  })

  const markPaidMutation = useMutation({
    mutationFn: () => {
      if (!showMarkPaid) {
        throw new Error('You do not have permission to mark this work order paid.')
      }
      return markWorkOrderPaid(workOrderId, { remarks: paidRemarks })
    },
    onSuccess: () => {
      setPaidDialogOpen(false)
      setPaidRemarks('')
      void queryClient.invalidateQueries({ queryKey: ['maintenance-work-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['maintenance-work-order', workOrderId] })
      showSuccessToast('Work order marked as paid.')
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to mark work order paid')
    },
  })

  const verifyMaintenanceMutation = useMutation({
    mutationFn: (input: VerifyWorkOrderInput) => {
      if (!crud.hasAction('verify') && crud.isResolved) {
        throw new Error('You do not have permission to verify this work order.')
      }
      return verifyWorkOrder(workOrderId, input)
    },
    onSuccess: () => {
      setVerifyDialogOpen(false)
      setInvoiceNumber('')
      setInvoiceDate('')
      setVerifyRemarks('')
      setInvoiceFile(null)
      if (invoiceFileInputRef.current) invoiceFileInputRef.current.value = ''
      void queryClient.invalidateQueries({ queryKey: ['maintenance-work-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['maintenance-work-order'] })
      showSuccessToast('Maintenance verified successfully.')
      navigate('/maintenance/work-orders')
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to verify maintenance')
    },
  })

  const updateServicesMutation = useMutation({
    mutationFn: (rows: MaintenanceLineItem[]) => {
      const newItems = rows
        .filter((row) => row.isNew && row.description.trim() !== '')
        .map((row) => ({
          name: row.description.trim(),
          unit_price: row.unitPrice,
          quantity: row.quantity,
          notes: (row.notes ?? '').trim(),
        }))
      return updateWorkOrderServicesAndParts(workOrderId, newItems)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['maintenance-work-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['maintenance-work-order'] })
      showSuccessToast('Services & parts updated successfully.')
      setLineItems((prev) => prev.map((row) => ({ ...row, isNew: false })))
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to update services & parts')
    },
  })

  useEffect(() => {
    if (!workOrder) {
      setLineItems([])
      return
    }
    setLineItems(
      workOrder.lineItems.map((row) => {
        if (row.servicePartId) return row
        const match = servicePartOptions.find((option) => option.label === row.description)
        return match
          ? { ...row, servicePartId: match.id, unitPrice: match.unitPrice, isNew: false }
          : { ...row, isNew: false }
      }),
    )
  }, [workOrder, servicePartOptions])

  const total = useMemo(() => sumLineItems(lineItems), [lineItems])
  const maintenanceTypeCode = useMemo(() => {
    if (!workOrder?.maintenanceTypeId?.trim()) return workOrder?.maintenanceType ?? ''
    const match = maintenanceTypeQuery.data?.find(
      (option) => option.value === workOrder.maintenanceTypeId,
    )
    return match?.code ?? workOrder.maintenanceType
  }, [workOrder?.maintenanceType, workOrder?.maintenanceTypeId, maintenanceTypeQuery.data])
  const maintenanceTypeKind = resolveMaintenanceTypeKind(
    displayMaintenanceType,
    maintenanceTypeCode,
  )
  const isMajorType = maintenanceTypeKind === 'major'
  const normalizedStatus = (workOrder?.status ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_')
  const isApprovedForService = normalizedStatus === 'APPROVED_FOR_SERVICE'
  const designatedMto =
    canShowDesignatedWorkOrderCreate(apiRoleName, user) ||
    canShowDesignatedWorkOrderCreate(role, user)
  const hasAssignedDriver = Boolean(workOrder?.assignedDriverId.trim())
  const canAssignSecretariatDriver = Boolean(
    workOrder &&
      isApprovedForService &&
      isSecretariatDesignationType(workOrder.designationType) &&
      !hasAssignedDriver &&
      designatedMto,
  )
  const driverOptions = useMemo(
    () =>
      (driversQuery.data ?? []).map((driver) => ({
        value: driver.id,
        label: driver.name,
        searchText: driver.name,
      })),
    [driversQuery.data],
  )
  const isInProgress = normalizedStatus === 'IN_PROGRESS'
  const isPendingMtoApproval = normalizedStatus === 'PENDING_MTO_APPROVAL'
  const isPendingAgencyApproval = normalizedStatus === 'PENDING_AGENCY_APPROVAL'
  const isPendingAgencyMtoReview = normalizedStatus === 'PENDING_AGENCY_MTO_REVIEW'
  const isMinisterDesignation =
    (workOrder?.designationType ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_') ===
    'MINISTER'
  const isFmsMtoRole = roleMatches(apiRoleName, 'fms-mto') || roleMatches(role, 'fms-mto')
  const showMinisterAgencyMtoForward =
    Boolean(workOrder) && isMinisterDesignation && isPendingAgencyMtoReview && isFmsMtoRole
  const isPendingSpecificMto = normalizedStatus === 'PENDING_SPECIFIC_MTO'
  const isPendingVerification = normalizedStatus === 'PENDING_VERIFICATION'
  const isPendingFinanceReview = normalizedStatus === 'PENDING_FINANCE_REVIEW'
  const isAccountantPaidStatus = ACCOUNTANT_PAID_STATUSES.has(normalizedStatus)
  const secretariatWorkOrder = Boolean(
    workOrder && isSecretariatDesignationType(workOrder.designationType),
  )
  const designatedRoleAllowed = !secretariatWorkOrder || userHandlesDesignatedVehicles(user)
  const isFinanceOfficer =
    canVerifyRenewalApplication(apiRoleName) || canVerifyRenewalApplication(role)
  const isAccountant =
    canProceedRenewalApplication(apiRoleName) || canProceedRenewalApplication(role)
  const showFinanceVerify =
    isPendingFinanceReview && isFinanceOfficer && designatedRoleAllowed
  const showMarkPaid = isAccountantPaidStatus && isAccountant && designatedRoleAllowed
  const isCompleted = normalizedStatus === 'COMPLETED'
  const isRejected = normalizedStatus === 'REJECTED'
  const isCancelled = normalizedStatus === 'CANCELLED'
  const canAddLineItems =
    canEditServicesParts && !isPendingVerification && !isCompleted && !isRejected && !isCancelled
  const restrictLineItemEdits = isPendingVerification || isCompleted
  const showMtoApproveRejectActions = isMtoRole && isPendingMtoApproval
  const shouldShowEscalate =
    showMtoApproveRejectActions &&
    shouldEscalateWorkOrderMtoApproval({
      maintenanceTypeLabel: displayMaintenanceType,
      maintenanceTypeCode,
      totalAmount: total,
    })
  const showAgencyApproveRejectActions =
    isAgencyAdminRole && isPendingAgencyApproval
  const showApproveRejectActions =
    showMtoApproveRejectActions || showAgencyApproveRejectActions
  const showVerifyMaintenance = isMtoRole && isPendingVerification
  const hasServiceParts = lineItems.some((row) => {
    const description = row.description.trim()
    return description !== '' && description !== '—'
  })
  const specificMtoThresholdAccepted =
    !isMajorType &&
    !shouldEscalateWorkOrderMtoApproval({
      maintenanceTypeLabel: displayMaintenanceType,
      maintenanceTypeCode,
      totalAmount: total,
    })
  const showSpecificMtoServices = Boolean(
    workOrder && isMinisterDesignation && isPendingSpecificMto && designatedMto,
  )
  const hideMinisterSpecificMtoServices = Boolean(
    workOrder &&
      isMinisterDesignation &&
      isPendingSpecificMto &&
      (isMtoRole || isFmsMtoRole) &&
      !designatedMto,
  )
  const showSpecificMtoDecision =
    showSpecificMtoServices &&
    workOrder?.estimatedCost == null &&
    hasServiceParts &&
    specificMtoThresholdAccepted
  const canShowApproveButton =
    showSpecificMtoDecision ||
    (hasServiceParts &&
      showApproveRejectActions &&
      crud.isResolved &&
      crud.canApprove)
  const canShowRejectButton =
    showSpecificMtoDecision ||
    (showApproveRejectActions &&
      crud.isResolved &&
      crud.canReject &&
      !shouldShowEscalate &&
      !isMajorType)
  const canShowVerifyButton =
    showVerifyMaintenance && crud.isResolved && crud.hasAction('verify')
  const showServiceRecordDetail = Boolean(
    workOrder && hasServiceRecordDetailData(workOrder.serviceRecord),
  )
  const serviceRecord = workOrder?.serviceRecord
      
  const invoiceMutation = useMutation({
    mutationFn: (targetWindow: Window | null) => {
      if (!workOrderId.trim()) throw new Error('Missing work order id')
      return openWorkOrderInvoice(
        workOrderId,
        serviceRecord?.invoiceUrl ? basenameFromObjectKey(serviceRecord.invoiceUrl) : '',
        targetWindow,
      )
    },
    onError: (error, targetWindow) => {
      if (targetWindow && !targetWindow.closed) targetWindow.close()
      showErrorToast(error, 'Could not open invoice')
    },
  })

  const handleInvoiceClick = () => {
    if (!serviceRecord?.invoiceUrl?.trim()) return
    invoiceMutation.mutate(preOpenBrowserTab())
  }

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: `line-item-${Date.now()}`,
        servicePartId: '',
        description: '',
        quantity: 1,
        unitPrice: 0,
        notes: '',
        isNew: true,
      },
    ])
  }

  const ensureInitialLineItem = () => {
    setLineItems((prev) =>
      prev.length > 0
        ? prev
        : [
          {
            id: `line-item-${Date.now()}`,
            servicePartId: '',
            description: '',
            quantity: 1,
            unitPrice: 0,
            notes: '',
            isNew: true,
          },
        ],
    )
  }

  const updateLineItem = (itemId: string, next: MaintenanceLineItem) => {
    setLineItems((prev) => prev.map((row) => (row.id === itemId ? next : row)))
  }

  const removeLineItem = (itemId: string) => {
    setLineItems((prev) => prev.filter((row) => row.id !== itemId))
  }

  const openApprovalDialog = () => {
    if (!hasServiceParts) {
      showErrorToast('Please add at least one service/part before continuing.')
      return
    }
    setApproveDialogOpen(true)
  }

  const onSubmitApproval = () => {
    const trimmedRemarks = remarks.trim()
    if (!trimmedRemarks) {
      showErrorToast('Remarks are required.')
      return
    }
    approveMutation.mutate()
  }

  const onSubmitReject = () => {
    const trimmedReason = rejectReason.trim()
    if (!trimmedReason) {
      showErrorToast('Reject reason is required.')
      return
    }
    rejectMutation.mutate()
  }

  const onSubmitUpdateServices = () => {
    const newRows = lineItems.filter((row) => row.isNew)
    const validNewRows = newRows.filter((row) => row.description.trim() !== '')
    if (newRows.length === 0) return
    if (validNewRows.length === 0) {
      showErrorToast('Please select at least one new service/part before update.')
      return
    }
    updateServicesMutation.mutate(validNewRows)
  }

  const onSubmitCompleteMaintenance = () => {
    const odometer = Number.parseInt(finalOdometerKm.trim(), 10)
    if (!Number.isFinite(odometer) || odometer < 0) {
      showErrorToast('Please enter a valid final odometer reading.')
      return
    }
    completeMaintenanceMutation.mutate()
  }

  const assignDriverMutation = useMutation({
    mutationFn: () => {
      if (!selectedDriverId.trim()) throw new Error('Driver is required')
      return assignWorkOrderDriver(workOrderId, selectedDriverId)
    },
    onSuccess: () => {
      setAssignDriverDialogOpen(false)
      setSelectedDriverId('')
      void queryClient.invalidateQueries({ queryKey: ['maintenance-work-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['maintenance-work-order', workOrderId] })
      showSuccessToast('Driver assigned successfully.')
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to assign driver')
    },
  })

  const openAssignDriverDialog = () => {
    setSelectedDriverId(workOrder?.assignedDriverId.trim() ?? '')
    setAssignDriverDialogOpen(true)
  }

  const closeAssignDriverDialog = () => {
    if (assignDriverMutation.isPending) return
    setAssignDriverDialogOpen(false)
  }

  const onSubmitAssignDriver = () => {
    if (!selectedDriverId.trim()) {
      showErrorToast('Please select a driver.')
      return
    }
    assignDriverMutation.mutate()
  }

  const openVerifyDialog = () => {
    setInvoiceNumber('')
    setInvoiceDate(todayDateInputValue())
    setVerifyRemarks('')
    setInvoiceFile(null)
    if (invoiceFileInputRef.current) invoiceFileInputRef.current.value = ''
    setVerifyDialogOpen(true)
  }

  const closeVerifyDialog = () => {
    if (verifyMaintenanceMutation.isPending) return
    setVerifyDialogOpen(false)
  }

  const onSubmitVerify = () => {
    if (!invoiceNumber.trim()) {
      showErrorToast('Invoice number is required.')
      return
    }
    if (!invoiceDate.trim()) {
      showErrorToast('Invoice date is required.')
      return
    }
    verifyMaintenanceMutation.mutate({
      invoice_number: invoiceNumber.trim(),
      invoice_date: invoiceDate.trim(),
      remarks: verifyRemarks.trim() || undefined,
      invoice_file: invoiceFile,
    })
  }

  useEffect(() => {
    if (canViewServicesParts && !isDriverRole) ensureInitialLineItem()
  }, [canViewServicesParts, isDriverRole])

  if (!isMainLoading && (detailQuery.isError || !workOrder)) {
    return (
      <section className="space-y-4">
        <BackToListButton to={returnTo} />
        <PageHeader
          title="Work Order Details"
          subtitle="This work order has been initiated by the driver."
        />
        <Card className="border border-[var(--fms-strokes)] bg-white">
          <CardContent className="py-8 text-center text-[var(--fms-text-subheading)]">
            {detailQuery.error instanceof Error
              ? detailQuery.error.message
              : 'Work order not found.'}
          </CardContent>
        </Card>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <BackToListButton to={returnTo} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <PageHeader
            title="Work Order Details"
            subtitle="This work order has been initiated by the driver."
          />
          {isMainLoading ? (
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-5 w-28 rounded-full" />
              <Skeleton className="h-4 w-36" />
            </div>
          ) : workOrder ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={workOrderStatusBadgeClass(workOrder.status)}>
                {formatWorkOrderStatusLabel(workOrder.status)}
              </Badge>
              <span className="text-sm text-[var(--fms-text-subheading)]">
                {workOrder.workOrderId}
              </span>
            </div>
          ) : null}
        </div>
        {!isMainLoading && canAssignSecretariatDriver ? (
          <Button
            type="button"
            className="w-full bg-[var(--fms-button)] text-white hover:bg-[var(--fms-button-hover)] sm:w-auto"
            onClick={openAssignDriverDialog}
          >
            Assign Driver
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard
          icon={User}
          label="Driver"
          value={displayDriverName}
          loading={isMainLoading}
        />
        <SummaryCard
          icon={CarFront}
          label="Vehicle"
          value={workOrder?.vehiclePlate ?? ''}
          loading={isMainLoading}
        />
        <SummaryCard
          icon={Clock3}
          label="Trigger Type"
          value={workOrder?.triggerType ?? ''}
          loading={isMainLoading}
        />
      </div>

      <Card className="border border-[var(--fms-strokes)] bg-white">
        <CardContent className="space-y-4 pt-5">
          <h2 className="text-base font-semibold text-[var(--fms-text-header)]">
            General Information
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <FieldReadOnly
              label="Vehicle Registration"
              value={workOrder?.vehiclePlate}
              loading={isMainLoading}
            />
            <FieldReadOnly
              label="Maintenance Type"
              value={displayMaintenanceType}
              loading={isMainLoading || isMaintenanceTypeLoading}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border border-[var(--fms-strokes)] bg-white">
        <CardContent className="space-y-4 pt-5">
          <h2 className="text-base font-semibold text-[var(--fms-text-header)]">
            Problem Reports
          </h2>
          {isMainLoading ? (
            <div className="space-y-3 rounded-xl border border-[var(--fms-strokes)] bg-[#fafafa] p-4">
              <Skeleton className="h-4 w-36" />
              <div className="grid gap-4 md:grid-cols-2">
                <DetailReadOnlyFieldSkeleton label="Problem Category" />
                <DetailReadOnlyFieldSkeleton label="Problem Description" />
              </div>
            </div>
          ) : workOrder && workOrder.problemReports.length === 0 ? (
            <p className="text-sm text-[var(--fms-text-subheading)]">
              No problem reports found.
            </p>
          ) : workOrder ? (
            <div className="space-y-3">
              {workOrder.problemReports.map((report, index) => (
                <div
                  key={report.id}
                  className="space-y-3 rounded-xl border border-[var(--fms-strokes)] bg-[#fafafa] p-4"
                >
                  <p className="text-sm font-semibold text-[var(--fms-text-header)]">
                    Problem report {index + 1}
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FieldReadOnly
                      label="Problem Category"
                      value={report.categoryName}
                    />
                    <FieldReadOnly
                      label="Problem Description"
                      value={report.description}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Proof Attachments</Label>
                    {report.proofAttachments.length === 0 ? (
                      <Input
                        readOnly
                        value=""
                        placeholder="—"
                        className="bg-[#f8f8f9]"
                      />
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {report.proofAttachments.map((attachment) => (
                          <div
                            key={attachment.id}
                            className="inline-flex items-center gap-2 rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2 text-sm text-[var(--fms-primary)]"
                          >
                            <CloudUpload className="h-4 w-4 shrink-0" />
                            {attachment.downloadUrl ? (
                              <a
                                href={attachment.downloadUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium hover:underline"
                              >
                                {attachment.fileName}
                              </a>
                            ) : (
                              <span className="font-medium">{attachment.fileName}</span>
                            )}
                            <span className="text-[var(--fms-text-subheading)]">
                              {attachment.sizeLabel}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {(canShowServicesPartsTable || showSpecificMtoServices) &&
      !showMinisterAgencyMtoForward &&
      !hideMinisterSpecificMtoServices ? (
        <Card className="border border-[var(--fms-strokes)] bg-white">
          <CardContent className="pt-5">
            {isMainLoading ? (
              <>
                <Skeleton className="mb-4 h-5 w-48" />
                <Skeleton className="h-32 w-full rounded-lg" />
              </>
            ) : workOrder ? (
              <>
            <ServicesPartsTable
              title="Services & Parts Required"
              items={lineItems}
              total={total}
              editable={canEditServicesParts || showSpecificMtoServices}
              servicePartOptions={servicePartOptions}
              onAdd={canAddLineItems || showSpecificMtoServices ? addLineItem : undefined}
              onItemChange={
                canEditServicesParts || showSpecificMtoServices ? updateLineItem : undefined
              }
              onDelete={
                canEditServicesParts || showSpecificMtoServices ? removeLineItem : undefined
              }
              isRowLocked={(row) => isApprovedForService && !row.isNew}
              isServicePartLocked={() => restrictLineItemEdits}
              isQuantityLocked={() => restrictLineItemEdits}
              isNotesLocked={() => restrictLineItemEdits}
              isDeleteHidden={() => restrictLineItemEdits}
            />
            {((canEditServicesParts && isApprovedForService) || showSpecificMtoServices) &&
            lineItems.some((row) => row.isNew) ? (
              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  className="bg-[var(--fms-button)] text-white hover:bg-[var(--fms-button-hover)]"
                  disabled={updateServicesMutation.isPending}
                  onClick={onSubmitUpdateServices}
                >
                  {updateServicesMutation.isPending ? 'Updating…' : 'Update'}
                </Button>
              </div>
            ) : null}
            {showServiceRecordDetail ? (
              <ServiceRecordDetailSection
                embedded
                serviceRecord={serviceRecord}
                invoiceLoading={invoiceMutation.isPending}
                onInvoiceClick={
                  serviceRecord?.invoiceUrl?.trim() ? handleInvoiceClick : undefined
                }
              />
            ) : null}
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : showServiceRecordDetail ? (
        <Card className="border border-[var(--fms-strokes)] bg-white">
          <CardContent className="pt-5">
            <ServiceRecordDetailSection
              serviceRecord={serviceRecord}
              invoiceLoading={invoiceMutation.isPending}
              onInvoiceClick={
                serviceRecord?.invoiceUrl?.trim() ? handleInvoiceClick : undefined
              }
            />
          </CardContent>
        </Card>
      ) : null}

      {!isMainLoading && workOrder && showMinisterAgencyMtoForward ? (
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            className="bg-[var(--fms-button)] text-white hover:bg-[var(--fms-button-hover)]"
            disabled={agencyMtoReviewMutation.isPending}
            onClick={() => {
              setAgencyMtoRemarks('')
              setAgencyMtoDialogMode('forward')
            }}
          >
            Forward
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-[var(--fms-error-border)] text-[var(--fms-error-text)]"
            disabled={agencyMtoReviewMutation.isPending}
            onClick={() => {
              setAgencyMtoRemarks('')
              setAgencyMtoDialogMode('return')
            }}
          >
            Return
          </Button>
        </div>
      ) : null}

      {!isMainLoading && workOrder && (canShowApproveButton || canShowRejectButton) ? (
        <div className="flex flex-wrap gap-3">
          {canShowApproveButton ? (
            <Button
              type="button"
              className="bg-[var(--fms-button)] text-white hover:bg-[var(--fms-button-hover)]"
              onClick={openApprovalDialog}
            >
              {shouldShowEscalate ? 'Escalate' : 'Approve'}
            </Button>
          ) : null}
          {canShowRejectButton ? (
            <Button
              type="button"
              variant="destructive"
              className="bg-[var(--fms-delete)] text-white hover:bg-[var(--fms-delete)]/90"
              onClick={() => setRejectDialogOpen(true)}
            >
              Reject
            </Button>
          ) : null}
        </div>
      ) : null}

      {!isMainLoading && workOrder && canShowVerifyButton ? (
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            className="bg-[var(--fms-button)] text-white hover:bg-[var(--fms-button-hover)]"
            disabled={verifyMaintenanceMutation.isPending}
            onClick={openVerifyDialog}
          >
            Verify Maintenance
          </Button>
        </div>
      ) : null}

      {!isMainLoading && workOrder && (showFinanceVerify || showMarkPaid) ? (
        <div className="flex flex-wrap gap-3">
          {showFinanceVerify ? (
            <>
              <Button
                type="button"
                className="bg-[var(--fms-button)] text-white hover:bg-[var(--fms-button-hover)]"
                disabled={financeVerifyMutation.isPending}
                onClick={() => {
                  setFinanceRemarks('')
                  setFinanceDialogMode('approve')
                }}
              >
                Verify
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-[var(--fms-error-border)] text-[var(--fms-error-text)]"
                disabled={financeVerifyMutation.isPending}
                onClick={() => {
                  setFinanceRemarks('')
                  setFinanceDialogMode('return')
                }}
              >
                Return
              </Button>
            </>
          ) : null}
          {showMarkPaid ? (
            <Button
              type="button"
              className="bg-[var(--fms-button)] text-white hover:bg-[var(--fms-button-hover)]"
              disabled={markPaidMutation.isPending}
              onClick={() => {
                setPaidRemarks('')
                setPaidDialogOpen(true)
              }}
            >
              Paid
            </Button>
          ) : null}
        </div>
      ) : null}

      {!isMainLoading && workOrder && isDriverRole && (isApprovedForService || isInProgress) ? (
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            className="bg-[var(--fms-button)] text-white hover:bg-[var(--fms-button-hover)]"
            onClick={() => setCompleteDialogOpen(true)}
          >
            Complete Maintenance
          </Button>
        </div>
      ) : null}

      <Dialog
        open={assignDriverDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeAssignDriverDialog()
          else setAssignDriverDialogOpen(true)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Driver</DialogTitle>
            <DialogDescription>
              Select a driver for this Secretariat vehicle
              {workOrder?.vehiclePlate ? ` (${workOrder.vehiclePlate})` : ''}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="assign-work-order-driver">
              Driver <span className="text-[var(--fms-delete)]">*</span>
            </Label>
            <SearchableAutocomplete
              id="assign-work-order-driver"
              value={selectedDriverId}
              onChange={setSelectedDriverId}
              options={driverOptions}
              loading={driversQuery.isLoading}
              disabled={assignDriverMutation.isPending || driversQuery.isLoading}
              placeholder={
                driversQuery.isError ? 'Could not load drivers' : 'Select driver'
              }
              searchPlaceholder="Search driver name…"
              emptyMessage={
                driversQuery.isError ? 'Could not load drivers.' : 'No drivers found.'
              }
              error={driversQuery.isError}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={assignDriverMutation.isPending}
              onClick={closeAssignDriverDialog}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[var(--fms-button)] text-white hover:bg-[var(--fms-button-hover)]"
              disabled={
                assignDriverMutation.isPending ||
                driversQuery.isLoading ||
                !selectedDriverId.trim()
              }
              onClick={onSubmitAssignDriver}
            >
              {assignDriverMutation.isPending ? 'Assigning…' : 'Assign Driver'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={agencyMtoDialogMode !== null}
        onOpenChange={(open) => {
          if (!open && agencyMtoReviewMutation.isPending) return
          if (!open) {
            setAgencyMtoDialogMode(null)
            setAgencyMtoRemarks('')
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {agencyMtoDialogMode === 'return' ? 'Return Work Order' : 'Forward Work Order'}
            </DialogTitle>
            <DialogDescription>
              {agencyMtoDialogMode === 'return'
                ? 'Send this work order back with a reason.'
                : 'Forward this work order to the DPP MTO.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="agency-mto-review-remarks">
              Remarks
              {agencyMtoDialogMode === 'return' ? (
                <span className="text-[var(--fms-delete)]"> *</span>
              ) : null}
            </Label>
            <textarea
              id="agency-mto-review-remarks"
              value={agencyMtoRemarks}
              onChange={(event) => setAgencyMtoRemarks(event.target.value)}
              placeholder="Enter remarks for this action."
              disabled={agencyMtoReviewMutation.isPending}
              className="min-h-[88px] w-full rounded-lg border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={agencyMtoReviewMutation.isPending}
              onClick={() => {
                setAgencyMtoDialogMode(null)
                setAgencyMtoRemarks('')
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={
                agencyMtoDialogMode === 'return'
                  ? 'bg-[#c53030] text-white hover:bg-[#b83232]'
                  : 'bg-[var(--fms-button)] text-white hover:bg-[var(--fms-button-hover)]'
              }
              disabled={
                agencyMtoReviewMutation.isPending ||
                (agencyMtoDialogMode === 'return' && !agencyMtoRemarks.trim())
              }
              onClick={() => {
                if (agencyMtoDialogMode === 'return' && !agencyMtoRemarks.trim()) {
                  showErrorToast('Enter remarks before returning this work order.')
                  return
                }
                agencyMtoReviewMutation.mutate(
                  agencyMtoDialogMode === 'return' ? 'return' : 'forward',
                )
              }}
            >
              {agencyMtoReviewMutation.isPending
                ? agencyMtoDialogMode === 'return'
                  ? 'Returning…'
                  : 'Forwarding…'
                : agencyMtoDialogMode === 'return'
                  ? 'Return'
                  : 'Forward'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={financeDialogMode !== null}
        onOpenChange={(open) => {
          if (!open && financeVerifyMutation.isPending) return
          if (!open) {
            setFinanceDialogMode(null)
            setFinanceRemarks('')
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {financeDialogMode === 'return' ? 'Return Work Order' : 'Verify Work Order'}
            </DialogTitle>
            <DialogDescription>
              {financeDialogMode === 'return'
                ? 'Send this work order back with a reason.'
                : 'Confirm this work order for finance review.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="finance-verify-remarks">
              Verification remarks
              {financeDialogMode === 'return' ? (
                <span className="text-[var(--fms-delete)]"> *</span>
              ) : null}
            </Label>
            <textarea
              id="finance-verify-remarks"
              value={financeRemarks}
              onChange={(event) => setFinanceRemarks(event.target.value)}
              placeholder="Enter remarks for this action."
              disabled={financeVerifyMutation.isPending}
              className="min-h-[88px] w-full rounded-lg border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={financeVerifyMutation.isPending}
              onClick={() => {
                setFinanceDialogMode(null)
                setFinanceRemarks('')
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={
                financeDialogMode === 'return'
                  ? 'bg-[#c53030] text-white hover:bg-[#b83232]'
                  : 'bg-[var(--fms-button)] text-white hover:bg-[var(--fms-button-hover)]'
              }
              disabled={
                financeVerifyMutation.isPending ||
                (financeDialogMode === 'return' && !financeRemarks.trim())
              }
              onClick={() => {
                if (financeDialogMode === 'return' && !financeRemarks.trim()) {
                  showErrorToast('Enter remarks before returning this work order.')
                  return
                }
                financeVerifyMutation.mutate(
                  financeDialogMode === 'return' ? 'REJECT' : 'APPROVE',
                )
              }}
            >
              {financeVerifyMutation.isPending
                ? financeDialogMode === 'return'
                  ? 'Returning…'
                  : 'Verifying…'
                : financeDialogMode === 'return'
                  ? 'Return'
                  : 'Verify'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={paidDialogOpen}
        onOpenChange={(open) => {
          if (!open && markPaidMutation.isPending) return
          setPaidDialogOpen(open)
          if (!open) setPaidRemarks('')
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark as Paid</DialogTitle>
            <DialogDescription>
              Record payment for this work order.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="mark-paid-remarks">Remarks</Label>
            <textarea
              id="mark-paid-remarks"
              value={paidRemarks}
              onChange={(event) => setPaidRemarks(event.target.value)}
              placeholder="Enter remarks for this action."
              disabled={markPaidMutation.isPending}
              className="min-h-[88px] w-full rounded-lg border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={markPaidMutation.isPending}
              onClick={() => {
                setPaidDialogOpen(false)
                setPaidRemarks('')
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[var(--fms-button)] text-white hover:bg-[var(--fms-button-hover)]"
              disabled={markPaidMutation.isPending}
              onClick={() => markPaidMutation.mutate()}
            >
              {markPaidMutation.isPending ? 'Saving…' : 'Paid'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {shouldShowEscalate ? 'Escalate Work Order' : 'Approve Work Order'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="work-order-remarks">Remarks</Label>
            <textarea
              id="work-order-remarks"
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              placeholder="Enter remarks"
              className="min-h-[110px] w-full rounded-lg border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[var(--fms-button)] text-white hover:bg-[var(--fms-button-hover)]"
              disabled={approveMutation.isPending}
              onClick={onSubmitApproval}
            >
              {approveMutation.isPending
                ? shouldShowEscalate
                  ? 'Escalating…'
                  : 'Approving…'
                : shouldShowEscalate
                  ? 'Escalate'
                  : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Work Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="work-order-reject-reason">Reason</Label>
            <textarea
              id="work-order-reject-reason"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Enter reject reason"
              className="min-h-[110px] w-full rounded-lg border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="bg-[var(--fms-delete)] text-white hover:bg-[var(--fms-delete)]/90"
              disabled={rejectMutation.isPending}
              onClick={onSubmitReject}
            >
              {rejectMutation.isPending ? 'Rejecting…' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Maintenance</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="final-odometer-km">Final Odometer (km)</Label>
            <Input
              id="final-odometer-km"
              type="number"
              min={0}
              value={finalOdometerKm}
              onChange={(event) => setFinalOdometerKm(event.target.value)}
              placeholder="Enter final odometer"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[var(--fms-button)] text-white hover:bg-[var(--fms-button-hover)]"
              disabled={completeMaintenanceMutation.isPending}
              onClick={onSubmitCompleteMaintenance}
            >
              {completeMaintenanceMutation.isPending ? 'Completing…' : 'Complete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={verifyDialogOpen} onOpenChange={(open) => !open && closeVerifyDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Verify Maintenance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="verify-invoice-number">
                Invoice Number <span className="text-[var(--fms-delete)]">*</span>
              </Label>
              <Input
                id="verify-invoice-number"
                value={invoiceNumber}
                onChange={(event) => setInvoiceNumber(event.target.value)}
                placeholder="Enter invoice number"
                disabled={verifyMaintenanceMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="verify-invoice-date">
                Invoice Date <span className="text-[var(--fms-delete)]">*</span>
              </Label>
              <Input
                id="verify-invoice-date"
                type="date"
                value={invoiceDate}
                max={todayDateInputValue()}
                onChange={(event) => setInvoiceDate(event.target.value)}
                disabled={verifyMaintenanceMutation.isPending}
              />
              <p className="text-xs text-[var(--fms-text-subheading)]">
                Invoice date in YYYY-MM-DD format
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="verify-remarks">Remarks</Label>
              <textarea
                id="verify-remarks"
                value={verifyRemarks}
                onChange={(event) => setVerifyRemarks(event.target.value)}
                placeholder="Enter remarks (optional)"
                disabled={verifyMaintenanceMutation.isPending}
                className="min-h-[88px] w-full rounded-lg border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="verify-invoice-file">Invoice File</Label>
              <Input
                id="verify-invoice-file"
                ref={invoiceFileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                disabled={verifyMaintenanceMutation.isPending}
                onChange={(event) => setInvoiceFile(event.target.files?.[0] ?? null)}
              />
              {invoiceFile ? (
                <p className="text-xs text-[var(--fms-text-subheading)]">{invoiceFile.name}</p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={verifyMaintenanceMutation.isPending}
              onClick={closeVerifyDialog}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[var(--fms-button)] text-white hover:bg-[var(--fms-button-hover)]"
              disabled={verifyMaintenanceMutation.isPending}
              onClick={onSubmitVerify}
            >
              {verifyMaintenanceMutation.isPending ? 'Verifying…' : 'Verify'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
