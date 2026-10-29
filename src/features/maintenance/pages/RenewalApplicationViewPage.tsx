import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, CarFront, ClipboardList, CloudUpload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

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
import {
  fetchRenewalApplication,
  formatRenewalStatusLabel,
  isInsuranceDocumentType,
  isRenewalAccountantProceedStatus,
  isRenewalFinanceReviewStatus,
  isRenewalPaidStatus,
  isRenewalReceiptUploadStatus,
  isRenewalResubmitStatus,
  openRenewalDocumentReceipt,
  proceedRenewalApplication,
  receiptNameFromObjectKey,
  resubmitRenewalApplication,
  renewalStatusBadgeClass,
  uploadRenewalApplicationReceipts,
  verifyRenewalApplication,
  type RenewalApplicationItem,
  type RenewalVerificationAction,
} from '@/features/maintenance/lib/renewal-applications-api'
import { cn } from '@/lib/utils'
import { useUserStore } from '@/services/user-store'
import { preOpenBrowserTab } from '@/shared/lib/open-in-new-tab'
import { BackToListButton } from '@/shared/components/BackToListButton'
import {
  DetailFieldBoxSkeleton,
  DetailSummaryCardSkeleton,
} from '@/shared/components/detail-loading'
import { PageHeader } from '@/shared/components/PageHeader'
import {
  canDriverOrDesignatedMtoActOnRenewal,
  canProceedRenewalApplication,
  canShowMaintenanceRenewalMenu,
  canVerifyRenewalApplication,
} from '@/shared/lib/designated-mto-access'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'
import { useAccessControl } from '@/shared/hooks/useAccessControl'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'

const LIST_PATH = '/maintenance/renewal'

function displayDate(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return '—'
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed)
  const parsed = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return trimmed
  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ClipboardList
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--fms-strokes)] bg-[#f6f6f7] p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--fms-button)]">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[var(--fms-text-subheading)]">{label}</p>
        <p className="mt-0.5 truncate font-semibold text-[var(--fms-text-header)]">{value || '—'}</p>
      </div>
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--fms-strokes)] bg-[#f8f8f9] px-4 py-3">
      <p className="text-sm text-[var(--fms-text-subheading)]">{label}</p>
      <p className="mt-1 text-base font-semibold text-[var(--fms-text-header)]">{value || '—'}</p>
    </div>
  )
}

function textValue(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

function ReceiptField({
  item,
  loading = false,
  onOpen,
}: {
  item: RenewalApplicationItem
  loading?: boolean
  onOpen: (fileName: string) => void
}) {
  const objectKey = textValue(item.receiptObjectKey)
  const name = textValue(item.receiptFileName) || receiptNameFromObjectKey(objectKey)
  const hasReceipt = Boolean(objectKey || name || textValue(item.receiptUrl))

  return (
    <div className="space-y-2">
      <p className="text-sm text-[var(--fms-text-subheading)]">Receipt</p>
      {hasReceipt ? (
        <button
          type="button"
          disabled={loading}
          onClick={() => onOpen(name || 'receipt')}
          className={cn(
            'inline-flex max-w-full items-center gap-2 rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2 text-sm text-[var(--fms-primary)]',
            loading ? 'cursor-wait opacity-70' : 'cursor-pointer transition-colors hover:bg-[#dbeafe]',
          )}
        >
          <CloudUpload className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate font-medium underline-offset-2 hover:underline">
            {loading ? 'Opening receipt…' : name || 'View receipt'}
          </span>
        </button>
      ) : (
        <p className="text-base font-semibold text-[var(--fms-text-header)]">—</p>
      )}
    </div>
  )
}

function DocumentSection({
  item,
  index,
  showPaidDetails,
  receiptLoading = false,
  onOpenReceipt,
  upload,
}: {
  item: RenewalApplicationItem
  index: number
  showPaidDetails: boolean
  receiptLoading?: boolean
  onOpenReceipt?: (fileName: string) => void
  upload?: {
    documentNumber: string
    fileName: string
    onDocumentNumberChange: (value: string) => void
    onFileChange: (file: File | null) => void
  }
}) {
  const title = item.documentTypeName.trim() || `Document ${index + 1}`
  const insurance =
    isInsuranceDocumentType(item.documentTypeName, item.documentTypeCode) ||
    Boolean(item.company.trim())
  const inputId = `renewal-doc-${item.id || index + 1}`
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <section className="space-y-4 rounded-xl border border-[var(--fms-strokes)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--fms-text-header)]">{title}</h3>
        {item.status.trim() ? (
          <Badge className={renewalStatusBadgeClass(item.status)}>
            {formatRenewalStatusLabel(item.status)}
          </Badge>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <DetailField label="Current Expiry Date" value={displayDate(item.currentExpiryDate)} />
        {item.newExpiryDate.trim() ? (
          <DetailField label="New Expiry Date" value={displayDate(item.newExpiryDate)} />
        ) : null}
        <DetailField label="Number of Renewal Years" value="1 year" />
        {insurance ? (
          <DetailField label="Company" value={item.company.trim() || '—'} />
        ) : null}
        {upload ? (
          <>
            <div className="rounded-lg border border-[var(--fms-strokes)] bg-[#f8f8f9] px-4 py-3">
              <Label htmlFor={`${inputId}-number`} className="text-sm font-normal text-[var(--fms-text-subheading)]">
                New Document Number
              </Label>
              <Input
                id={`${inputId}-number`}
                value={upload.documentNumber}
                onChange={(event) => upload.onDocumentNumberChange(event.target.value)}
                placeholder="Enter document number"
                className="mt-1 h-9 border-[var(--fms-strokes)] bg-white text-base font-semibold"
              />
            </div>
            <div className="rounded-lg border border-[var(--fms-strokes)] bg-[#f8f8f9] px-4 py-3">
              <p className="text-sm text-[var(--fms-text-subheading)]">
                Receipt <span className="text-[var(--fms-delete)]">*</span>
              </p>
              <input
                ref={fileInputRef}
                id={`${inputId}-receipt`}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                className="hidden"
                onChange={(event) => upload.onFileChange(event.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-1 flex w-full items-center gap-2 text-left text-base font-semibold text-[var(--fms-text-header)]"
              >
                <CloudUpload className="h-4 w-4 shrink-0 text-[var(--fms-text-subheading)]" aria-hidden />
                <span className="truncate">
                  {upload.fileName || 'Upload JPG, PNG, or PDF'}
                </span>
              </button>
            </div>
          </>
        ) : null}
      </div>
      {showPaidDetails && onOpenReceipt ? (
        <ReceiptField item={item} loading={receiptLoading} onOpen={onOpenReceipt} />
      ) : null}
    </section>
  )
}

function ViewSkeleton() {
  return (
    <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white">
      <CardContent className="space-y-6 p-4 sm:p-6">
        <BackToListButton to={LIST_PATH} label="Back to Preventive Maintenance" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <DetailSummaryCardSkeleton label="Application ID" />
          <DetailSummaryCardSkeleton label="Vehicle" />
          <DetailSummaryCardSkeleton label="Raised" />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <DetailFieldBoxSkeleton label="Current Expiry Date" />
          <DetailFieldBoxSkeleton label="Number of Renewal Years" />
        </div>
      </CardContent>
    </Card>
  )
}

type DialogMode = 'approve' | 'return' | 'proceed' | 'resubmit'

const DIALOG_COPY: Record<
  DialogMode,
  { title: string; confirm: string; remarksLabel: string; success: string; required: boolean }
> = {
  approve: {
    title: 'Approve Renewal',
    confirm: 'Approve',
    remarksLabel: 'Verification remarks',
    success: 'Renewal application approved.',
    required: false,
  },
  return: {
    title: 'Return Renewal',
    confirm: 'Return',
    remarksLabel: 'Verification remarks',
    success: 'Renewal application returned.',
    required: true,
  },
  proceed: {
    title: 'Proceed for Renewal',
    confirm: 'Proceed for Renewal',
    remarksLabel: 'Accountant remarks',
    success: 'Renewal sent onward for renewal.',
    required: false,
  },
  resubmit: {
    title: 'Resubmit Renewal',
    confirm: 'Resubmit',
    remarksLabel: 'Submission remarks',
    success: 'Renewal application resubmitted.',
    required: false,
  },
}

type ReceiptDraft = {
  documentNumber: string
  file: File | null
}

export default function RenewalApplicationViewPage() {
  const { applicationId = '' } = useParams<{ applicationId: string }>()
  const queryClient = useQueryClient()
  const crud = useRouteCrudPermissions('/maintenance/renewal')
  const { role, apiRoleName } = useAccessControl()
  const user = useUserStore((state) => state.user)
  const designatedMtoRenewal = canShowMaintenanceRenewalMenu(apiRoleName)
  const canViewRenewal = designatedMtoRenewal || !crud.isResolved || crud.canRead
  const renewalViewDenied = crud.isResolved && !crud.canRead && !designatedMtoRenewal
  const canReviewAsFinance =
    canVerifyRenewalApplication(apiRoleName) || canVerifyRenewalApplication(role)
  const canProceedAsAccountant =
    canProceedRenewalApplication(apiRoleName) || canProceedRenewalApplication(role)
  const canActAsDriverOrDesignatedMto =
    canDriverOrDesignatedMtoActOnRenewal(apiRoleName, user) ||
    canDriverOrDesignatedMtoActOnRenewal(role, user)

  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null)
  const [remarks, setRemarks] = useState('')
  const [draftState, setDraftState] = useState<{
    applicationId: string
    drafts: Record<string, ReceiptDraft>
  }>({ applicationId: '', drafts: {} })

  const detailQuery = useQuery({
    queryKey: ['renewal-application', applicationId],
    queryFn: () => fetchRenewalApplication(applicationId),
    enabled: Boolean(applicationId.trim()) && canViewRenewal,
    staleTime: 30_000,
  })

  const application = detailQuery.data
  const typeSummary = application?.renewalTypeLabels.filter(Boolean).join(', ') || '—'
  const showPaidDetails = application ? isRenewalPaidStatus(application.status) : false
  const showFinanceActions = Boolean(
    application && isRenewalFinanceReviewStatus(application.status) && canReviewAsFinance,
  )
  const showProceed = Boolean(
    application && isRenewalAccountantProceedStatus(application.status) && canProceedAsAccountant,
  )
  const showReceiptUpload = Boolean(
    application && isRenewalReceiptUploadStatus(application.status) && canActAsDriverOrDesignatedMto,
  )
  const showResubmit = Boolean(
    application && isRenewalResubmitStatus(application.status) && canActAsDriverOrDesignatedMto,
  )
  const receiptDrafts =
    application && draftState.applicationId === application.id ? draftState.drafts : {}

  const updateReceiptDraft = (itemId: string, patch: Partial<ReceiptDraft>) => {
    if (!application) return
    setDraftState((current) => {
      const base = current.applicationId === application.id ? current.drafts : {}
      const previous = base[itemId] ?? { documentNumber: '', file: null }
      return {
        applicationId: application.id,
        drafts: {
          ...base,
          [itemId]: { ...previous, ...patch },
        },
      }
    })
  }

  const refreshRenewal = async () => {
    await queryClient.invalidateQueries({ queryKey: ['renewal-application', applicationId] })
    await queryClient.invalidateQueries({ queryKey: ['renewal-applications'] })
  }

  const actionMutation = useMutation({
    mutationFn: async (mode: DialogMode) => {
      if (mode === 'approve' || mode === 'return') {
        const action: RenewalVerificationAction = mode === 'approve' ? 'APPROVE' : 'REJECT'
        return verifyRenewalApplication(applicationId, {
          action,
          verificationRemarks: remarks,
        })
      }
      if (mode === 'proceed') {
        return proceedRenewalApplication(applicationId, { accountantRemarks: remarks })
      }
      return resubmitRenewalApplication(applicationId, { submissionRemarks: remarks })
    },
    onSuccess: async (_result, mode) => {
      showSuccessToast(DIALOG_COPY[mode].success)
      setDialogMode(null)
      setRemarks('')
      await refreshRenewal()
    },
    onError: (error) => {
      showErrorToast(error, 'Could not update this renewal application.')
    },
  })

  const openReceiptMutation = useMutation({
    mutationFn: (input: { documentId: string; fileName: string; targetWindow: Window | null }) =>
      openRenewalDocumentReceipt(
        applicationId,
        input.documentId,
        input.fileName,
        input.targetWindow,
      ),
    onError: (error) => {
      showErrorToast(error, 'Could not open receipt.')
    },
  })

  const uploadMutation = useMutation({
    mutationFn: () => {
      const items = application?.items ?? []
      return uploadRenewalApplicationReceipts(
        applicationId,
        items.map((item) => {
          const draft = receiptDrafts[item.id] ?? { documentNumber: '', file: null }
          return {
            documentTypeId: item.documentTypeId,
            newDocumentNumber: draft.documentNumber,
            receiptFile: draft.file as File,
          }
        }),
      )
    },
    onSuccess: async () => {
      showSuccessToast('Receipts uploaded.')
      setDraftState({ applicationId: application?.id ?? '', drafts: {} })
      await refreshRenewal()
    },
    onError: (error) => {
      showErrorToast(error, 'Could not upload the receipts.')
    },
  })

  const openDialog = (mode: DialogMode) => {
    setRemarks('')
    setDialogMode(mode)
  }

  const dialogCopy = dialogMode ? DIALOG_COPY[dialogMode] : null
  const remarksMissing = Boolean(dialogCopy?.required && !remarks.trim())

  return (
    <section className="space-y-5">
      <PageHeader
        title="Renewal Application Details"
        subtitle={application?.applicationNumber || 'Application record'}
      />

      {renewalViewDenied ? (
        <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white">
          <CardContent className="space-y-4 p-4 sm:p-6">
            <BackToListButton to={LIST_PATH} label="Back to Preventive Maintenance" />
            <p className="py-6 text-center text-sm text-[var(--fms-text-subheading)]">
              You do not have permission to view this renewal application.
            </p>
          </CardContent>
        </Card>
      ) : detailQuery.isLoading ? (
        <ViewSkeleton />
      ) : detailQuery.isError || !application ? (
        <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white">
          <CardContent className="space-y-4 p-4 sm:p-6">
            <BackToListButton to={LIST_PATH} label="Back to Preventive Maintenance" />
            <p className="py-6 text-center text-sm text-[var(--fms-text-subheading)]">
              {detailQuery.error instanceof Error
                ? detailQuery.error.message
                : 'Could not load this renewal application.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-visible rounded-xl border border-[var(--fms-strokes)] bg-white">
          <CardContent className="space-y-6 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <BackToListButton to={LIST_PATH} label="Back to Preventive Maintenance" />
              {application.status.trim() && application.status !== '—' ? (
                <Badge className={renewalStatusBadgeClass(application.status)}>
                  {formatRenewalStatusLabel(application.status)}
                </Badge>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <SummaryCard
                icon={ClipboardList}
                label="Application ID"
                value={application.applicationNumber}
              />
              <SummaryCard icon={CarFront} label="Vehicle" value={application.vehicleNumber} />
              {application.createdAt.trim() ? (
                <SummaryCard
                  icon={CalendarClock}
                  label="Raised"
                  value={displayDate(application.createdAt)}
                />
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <DetailField label="Renewal Type(s)" value={typeSummary} />
              {application.driverName.trim() ? (
                <DetailField label="Driver" value={application.driverName} />
              ) : null}
            </div>

            {application.remarks.trim() ? (
              <DetailField label="Remarks" value={application.remarks} />
            ) : null}

            <div className="space-y-3">
              <div>
                <h2 className="text-base font-semibold text-[var(--fms-text-header)]">
                  Renewal Documents
                </h2>
                <p className="text-xs text-[var(--fms-text-subheading)]">
                  Documents included on this application.
                </p>
              </div>
              {application.items.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[var(--fms-strokes)] px-4 py-6 text-center text-sm text-[var(--fms-text-subheading)]">
                  No renewal documents are recorded on this application.
                </p>
              ) : (
                application.items.map((item, index) => {
                  const draft = receiptDrafts[item.id] ?? { documentNumber: '', file: null }
                  return (
                    <DocumentSection
                      key={item.id || `renewal-doc-${index + 1}`}
                      item={item}
                      index={index}
                      showPaidDetails={showPaidDetails}
                      receiptLoading={
                        openReceiptMutation.isPending &&
                        openReceiptMutation.variables?.documentId === item.id
                      }
                      onOpenReceipt={(fileName) => {
                        openReceiptMutation.mutate({
                          documentId: item.id,
                          fileName,
                          targetWindow: preOpenBrowserTab(),
                        })
                      }}
                      upload={
                        showReceiptUpload
                          ? {
                              documentNumber: draft.documentNumber,
                              fileName: draft.file?.name ?? '',
                              onDocumentNumberChange: (value) => {
                                updateReceiptDraft(item.id, { documentNumber: value })
                              },
                              onFileChange: (file) => {
                                updateReceiptDraft(item.id, { file })
                              },
                            }
                          : undefined
                      }
                    />
                  )
                })
              )}
            </div>

            {showFinanceActions || showProceed || showResubmit || showReceiptUpload ? (
              <div className="flex flex-col justify-start gap-2 sm:flex-row sm:flex-wrap">
                {showFinanceActions ? (
                  <>
                    <Button type="button" onClick={() => openDialog('approve')}>
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-[var(--fms-error-border)] text-[var(--fms-error-text)]"
                      onClick={() => openDialog('return')}
                    >
                      Return 
                    </Button>
                  </>
                ) : null}
                {showProceed ? (
                  <Button type="button" onClick={() => openDialog('proceed')}>
                    Proceed for Renewal
                  </Button>
                ) : null}
                {showResubmit ? (
                  <Button type="button" onClick={() => openDialog('resubmit')}>
                    Resubmit
                  </Button>
                ) : null}
                {showReceiptUpload ? (
                  <Button
                    type="button"
                    disabled={uploadMutation.isPending || application.items.length === 0}
                    onClick={() => uploadMutation.mutate()}
                  >
                    {uploadMutation.isPending ? 'Uploading…' : 'Upload Receipt'}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Dialog
        open={dialogMode !== null}
        onOpenChange={(open) => {
          if (!open && !actionMutation.isPending) {
            setDialogMode(null)
            setRemarks('')
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogCopy?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="renewal-action-remarks">
              {dialogCopy?.remarksLabel}
              {dialogCopy?.required ? <span className="text-[var(--fms-delete)]"> *</span> : null}
            </Label>
            <textarea
              id="renewal-action-remarks"
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              placeholder="Enter remarks for this action."
              className="min-h-[88px] w-full rounded-lg border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={actionMutation.isPending}
              onClick={() => {
                setDialogMode(null)
                setRemarks('')
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={
                dialogMode === 'return' ? 'bg-[#c53030] text-white hover:bg-[#b83232]' : undefined
              }
              disabled={!dialogMode || remarksMissing || actionMutation.isPending}
              onClick={() => {
                if (dialogMode) actionMutation.mutate(dialogMode)
              }}
            >
              {actionMutation.isPending ? 'Saving…' : dialogCopy?.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
