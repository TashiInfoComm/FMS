import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  CarFront,
  Clock3,
  CloudUpload,
  User,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
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
import {
  approveWorkOrder,
  completeWorkOrder,
  fetchWorkOrderById,
  openWorkOrderInvoice,
  rejectWorkOrder,
  updateWorkOrderServicesAndParts,
  verifyWorkOrder,
  type VerifyWorkOrderInput,
} from '@/features/maintenance/lib/work-orders-api'
import { fetchUserById, mapUserDetailFields } from '@/features/user/lib/users-api'
import { PageHeader } from '@/shared/components/PageHeader'
import {
  DetailInlineValueSkeleton,
  DetailReadOnlyFieldSkeleton,
} from '@/shared/components/detail-loading'
import { useAccessControl } from '@/shared/hooks/useAccessControl'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'
import { preOpenBrowserTab } from '@/shared/lib/open-in-new-tab'
import { cn } from '@/lib/utils'

function needsMaintenanceTypeLookup(detail: WorkOrderDetailData): boolean {
  if (!detail.maintenanceTypeId?.trim()) return false
  const current = detail.maintenanceType.trim()
  return current === 'Minor' || current === 'Major' || current === '—' || current === ''
}

function needsDriverLookup(detail: WorkOrderDetailData): boolean {
  const reportedById = detail.reportedById.trim()
  if (!reportedById) return false
  const current = detail.driverName.trim()
  return !current || current === '—'
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
  const returnLabel =
    returnTo === '/maintenance/records'
      ? 'Back to Vehicle Service'
      : 'Back to Work Orders'
  const { apiRoleName } = useAccessControl()
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
  const invoiceFileInputRef = useRef<HTMLInputElement>(null)

  const detailQuery = useQuery({
    queryKey: ['maintenance-work-order', workOrderId],
    queryFn: () => fetchWorkOrderById(workOrderId),
    enabled: Boolean(workOrderId.trim()),
    staleTime: 30_000,
  })

  const workOrder = detailQuery.data
  const resolveMaintenanceType = workOrder ? needsMaintenanceTypeLookup(workOrder) : false
  const resolveDriver = workOrder ? needsDriverLookup(workOrder) : false

  const maintenanceTypeQuery = useQuery({
    queryKey: ['maintenance', 'maintenance-types'],
    queryFn: fetchMaintenanceTypes,
    enabled: Boolean(workOrder) && resolveMaintenanceType,
    staleTime: 60_000,
  })

  const driverQuery = useQuery({
    queryKey: ['admin-user-detail', workOrder?.reportedById],
    queryFn: async () => {
      const id = workOrder?.reportedById.trim()
      if (!id) throw new Error('Missing driver id')
      return fetchUserById(id)
    },
    enabled: Boolean(workOrder) && resolveDriver,
    staleTime: 30_000,
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
    if (!resolveDriver) return workOrder.driverName
    if (driverQuery.isLoading) return workOrder.driverName
    if (!driverQuery.data) return workOrder.driverName
    const profile = mapUserDetailFields(driverQuery.data)
    return profile.name && profile.name !== '-' ? profile.name : workOrder.driverName
  }, [workOrder, resolveDriver, driverQuery.data, driverQuery.isLoading])

  const isMainLoading = detailQuery.isPending && !workOrder
  const isMaintenanceTypeLoading = resolveMaintenanceType && maintenanceTypeQuery.isLoading
  const isDriverLoading = resolveDriver && driverQuery.isLoading

  const approveMutation = useMutation({
    mutationFn: () => {
      if (!crud.canApprove && crud.isResolved) {
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
      if (!crud.canReject && crud.isResolved) {
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
  const normalizedStatus = workOrder?.status.trim().toUpperCase() ?? ''
  const isApprovedForService = normalizedStatus === 'APPROVED_FOR_SERVICE'
  const isInProgress = normalizedStatus === 'IN_PROGRESS'
  const isPendingMtoApproval = normalizedStatus === 'PENDING_MTO_APPROVAL'
  const isPendingAgencyApproval = normalizedStatus === 'PENDING_AGENCY_APPROVAL'
  const isPendingVerification = normalizedStatus === 'PENDING_VERIFICATION'
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
  const hasServiceParts = lineItems.some((row) => row.description.trim() !== '')
  const canShowApproveButton =
    hasServiceParts &&
    showApproveRejectActions &&
    crud.isResolved &&
    crud.canApprove
  const canShowRejectButton =
    showApproveRejectActions && crud.isResolved && crud.canReject && !shouldShowEscalate && !isMajorType
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

  const openVerifyDialog = () => {
    setInvoiceNumber('')
    setInvoiceDate('')
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
        <Button asChild variant="outline">
          <Link to={returnTo}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            {returnLabel}
          </Link>
        </Button>
      </section>
    )
  }

  return (
    <section className="space-y-5">
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
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link to={returnTo}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard
          icon={User}
          label="Driver"
          value={displayDriverName}
          loading={isMainLoading || isDriverLoading}
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

      {canShowServicesPartsTable ? (
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
              editable={canEditServicesParts}
              servicePartOptions={servicePartOptions}
              onAdd={canAddLineItems ? addLineItem : undefined}
              onItemChange={canEditServicesParts ? updateLineItem : undefined}
              onDelete={canEditServicesParts ? removeLineItem : undefined}
              isRowLocked={(row) => isApprovedForService && !row.isNew}
              isServicePartLocked={() => restrictLineItemEdits}
              isQuantityLocked={() => restrictLineItemEdits}
              isNotesLocked={() => restrictLineItemEdits}
              isDeleteHidden={() => restrictLineItemEdits}
            />
            {canEditServicesParts && isApprovedForService && lineItems.some((row) => row.isNew) ? (
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
