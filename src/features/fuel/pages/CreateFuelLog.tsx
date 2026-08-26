import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CloudUpload } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

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
import { FuelLogStatusCell } from '@/features/fuel/components/FuelLogStatusCell'
import {
  createFuelLog,
  fetchDriverVehicles,
  fetchFuelLogById,
  formatFuelLogVehicleDisplay,
  isFuelLogMtoReviewable,
  openFuelLogReceipt,
  resubmitFuelLog,
  reviewFuelLogMto,
  type DriverVehicleOption,
  type FuelLogMtoReviewAction,
} from '@/features/fuel/lib/fuel-logs-api'
import {
  formatFuelLogCost,
  formatFuelLogDate,
  formatFuelLogLiters,
  formatFuelLogOdometer,
  getFuelLogAutoDateIso,
} from '@/features/fuel/lib/fuel-log-mock-data'
import type { ApiRecord } from '@/features/user/lib/roles-api'
import { mapUserDetailFields } from '@/features/user/lib/users-api'
import { formatFileSizeLabel } from '@/features/trips/lib/trip-form-utils'
import { cn } from '@/lib/utils'
import { DetailInlineValueSkeleton } from '@/shared/components/detail-loading'
import { useUserStore } from '@/services/user-store'
import { SearchableAutocomplete } from '@/shared/components/SearchableAutocomplete'
import { BackToListButton } from '@/shared/components/BackToListButton'
import { PageHeader } from '@/shared/components/PageHeader'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'
import { preOpenBrowserTab } from '@/shared/lib/open-in-new-tab'

function DetailValueField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="rounded-full border border-[var(--fms-strokes)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--fms-text-header)]">
        {value}
      </div>
    </div>
  )
}

function SkeletonFieldValue() {
  return (
    <div className="rounded-full border border-[var(--fms-strokes)] bg-[#f8f8f9] px-4 py-2.5">
      <DetailInlineValueSkeleton />
    </div>
  )
}

function basenameFromObjectKey(value: string): string {
  const trimmed = value.trim().split('?')[0]?.trim() ?? ''
  if (!trimmed) return ''
  const parts = trimmed.split(/[/\\]/).filter(Boolean)
  return parts[parts.length - 1] ?? trimmed
}

type FuelLogQuotaSummary = {
  currentBalance?: number
  balanceAfterLog?: number
  maxQuota?: number
  threshold?: number
}

const QUOTA_SUMMARY_CARD_STYLES = {
  green: {
    card: 'bg-[#e8f7ee] border-[#b7e4c7]',
    label: 'text-[#2f855a]',
    value: 'text-[#1a4731]',
  },
  amber: {
    card: 'bg-[#fff8e6] border-[#f6e3a1]',
    label: 'text-[#b7791f]',
    value: 'text-[#744210]',
  },
  blue: {
    card: 'bg-[#ebf3ff] border-[#bfd7ff]',
    label: 'text-[#2b6cb0]',
    value: 'text-[#1a365d]',
  },
  red: {
    card: 'bg-[#fdeeee] border-[#f5c2c2]',
    label: 'text-[#c53030]',
    value: 'text-[#742a2a]',
  },
} as const

function FuelLogQuotaSummaryCards({
  summary,
  showBalanceAfterLog = false,
}: {
  summary: FuelLogQuotaSummary
  showBalanceAfterLog?: boolean
}) {
  const cards = [
    {
      key: 'current-balance',
      label: 'Current Balance',
      value: summary.currentBalance,
      tone: 'green' as const,
    },
    {
      key: 'balance-after-log',
      label: 'Balance after log',
      value: summary.balanceAfterLog,
      tone: 'amber' as const,
    },
    {
      key: 'max-quota',
      label: 'Max Quota',
      value: summary.maxQuota,
      tone: 'blue' as const,
    },
    {
      key: 'threshold',
      label: 'Threshold',
      value: summary.threshold,
      tone: 'red' as const,
    },
  ].filter(
    (card) =>
      (card.key !== 'balance-after-log' || showBalanceAfterLog) &&
      card.value !== undefined &&
      Number.isFinite(card.value),
  )

  if (cards.length === 0) return null

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const styles = QUOTA_SUMMARY_CARD_STYLES[card.tone]
        return (
          <div
            key={card.key}
            className={cn(
              'rounded-xl border px-4 py-3',
              styles.card,
            )}
          >
            <p className={cn('text-sm font-medium', styles.label)}>{card.label}</p>
            <p className={cn('mt-1 text-lg font-semibold', styles.value)}>
              {formatFuelLogCost(card.value!)}
            </p>
          </div>
        )
      })}
    </div>
  )
}

function ReceiptUploadField({
  readOnly,
  fileName,
  objectKey,
  fileSizeLabel,
  receiptLoading = false,
  onReceiptClick,
  onFileChange,
}: {
  readOnly?: boolean
  fileName: string
  objectKey?: string
  fileSizeLabel?: string
  receiptLoading?: boolean
  onReceiptClick?: () => void
  onFileChange?: (file: File | null) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (readOnly) {
    const displayName = fileName || (objectKey ? basenameFromObjectKey(objectKey) : '')
    const canOpenReceipt = Boolean(onReceiptClick && (displayName || objectKey))
    const receiptLabel = displayName || (objectKey ? 'View receipt' : '')
    return (
      <div className="space-y-2">
        <Label>{readOnly ? 'Uploaded Receipt' : 'Upload Receipt'}</Label>
        {receiptLabel || objectKey ? (
          <div className="space-y-2">
            {receiptLabel ? (
              canOpenReceipt ? (
                <button
                  type="button"
                  disabled={receiptLoading}
                  onClick={onReceiptClick}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2 text-sm text-[var(--fms-primary)] transition-colors',
                    receiptLoading
                      ? 'cursor-wait opacity-70'
                      : 'cursor-pointer hover:bg-[#dbeafe]',
                  )}
                >
                  <CloudUpload className="h-4 w-4 shrink-0" />
                  <span className="font-medium underline-offset-2 hover:underline">
                    {receiptLoading ? 'Opening receipt…' : receiptLabel}
                  </span>
                  {fileSizeLabel ? (
                    <span className="text-[var(--fms-text-subheading)]">{fileSizeLabel}</span>
                  ) : null}
                </button>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2 text-sm text-[var(--fms-primary)]">
                  <CloudUpload className="h-4 w-4 shrink-0" />
                  <span className="font-medium">{receiptLabel}</span>
                  {fileSizeLabel ? (
                    <span className="text-[var(--fms-text-subheading)]">{fileSizeLabel}</span>
                  ) : null}
                </div>
              )
            ) : null}
            {/* {objectKey ? (
              <p className="break-all rounded-lg border border-[var(--fms-strokes)] bg-[#f8f8f9] px-4 py-2.5 font-mono text-xs text-[var(--fms-text-subheading)]">
                {objectKey}
              </p>
            ) : null} */}
          </div>
        ) : (
          <div className="rounded-full border border-[var(--fms-strokes)] bg-[#f8f8f9] px-4 py-2.5 text-sm text-[var(--fms-text-subheading)]">
            —
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label>Upload Receipt</Label>
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.pdf"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null
          onFileChange?.(file)
        }}
      />
      {fileName ? (
        <div className="inline-flex items-center gap-2 rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2 text-sm text-[var(--fms-primary)]">
          <CloudUpload className="h-4 w-4 shrink-0" />
          <span className="font-medium">{fileName}</span>
          {fileSizeLabel ? (
            <span className="text-[var(--fms-text-subheading)]">{fileSizeLabel}</span>
          ) : null}
          <button
            type="button"
            className="ml-1 text-xs font-medium text-[var(--fms-primary)] underline"
            onClick={() => fileInputRef.current?.click()}
          >
            Change
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-full border border-[var(--fms-strokes)] px-4 py-2.5 text-sm transition-colors',
            'bg-[#f8fbff] text-[var(--fms-text-subheading)] hover:bg-[#eef6ff]',
          )}
        >
          <CloudUpload className="h-4 w-4 shrink-0" />
          Upload receipt in Jpg., png, pdf
        </button>
      )}
    </div>
  )
}

type FuelLogFormProps = {
  mode: 'create' | 'detail'
  vehicleNumber: string
  vehicleId?: string
  vehicleOptions?: DriverVehicleOption[]
  vehiclesLoading?: boolean
  onVehicleChange?: (value: string) => void
  logDate: string
  fuelLiters: string
  totalCost: string
  odometer: string
  location: string
  status?: string
  mtoRemarks?: string
  receiptFileName: string
  receiptObjectKey?: string
  receiptFileSizeLabel?: string
  receiptLoading?: boolean
  onReceiptClick?: () => void
  showQuotaSummary?: boolean
  showBalanceAfterLog?: boolean
  quotaSummary?: FuelLogQuotaSummary
  vehicleLoading?: boolean
  onLogDateChange?: (value: string) => void
  onFuelLitersChange?: (value: string) => void
  onTotalCostChange?: (value: string) => void
  onOdometerChange?: (value: string) => void
  onLocationChange?: (value: string) => void
  onReceiptChange?: (file: File | null) => void
  onSubmit?: (event: FormEvent) => void
  submitDisabled?: boolean
}

function FuelLogForm({
  mode,
  vehicleNumber,
  vehicleId = '',
  vehicleOptions = [],
  vehiclesLoading = false,
  onVehicleChange,
  logDate,
  fuelLiters,
  totalCost,
  odometer,
  location,
  status = '—',
  mtoRemarks,
  receiptFileName,
  receiptObjectKey,
  receiptFileSizeLabel,
  receiptLoading = false,
  onReceiptClick,
  showQuotaSummary = false,
  showBalanceAfterLog = false,
  quotaSummary,
  vehicleLoading = false,
  onLogDateChange,
  onFuelLitersChange,
  onTotalCostChange,
  onOdometerChange,
  onLocationChange,
  onReceiptChange,
  onSubmit,
  submitDisabled,
}: FuelLogFormProps) {
  const isDetail = mode === 'detail'

  const litersDisplay = isDetail
    ? formatFuelLogLiters(Number(fuelLiters) || 0)
    : fuelLiters
  const costDisplay = isDetail
    ? formatFuelLogCost(Number(totalCost) || 0)
    : totalCost
  const odometerDisplay = isDetail
    ? formatFuelLogOdometer(Number(odometer) || 0)
    : odometer
  const dateDisplay = isDetail ? formatFuelLogDate(logDate) : logDate

  return (
    <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white">
      <CardContent className="space-y-5 p-4 sm:p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-[var(--fms-text-header)]">
            {isDetail ? 'Fuel Log Details' : 'Add Fuel Log'}
          </h2>
          {!isDetail && (
            <p className="text-sm text-[var(--fms-text-subheading)]">Fuel Log Form</p>
          )}
        </div>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            if (isDetail) {
              event.preventDefault()
              return
            }
            onSubmit?.(event)
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {isDetail ? (
              <div className="space-y-2">
                <Label>Vehicle Number</Label>
                {vehicleLoading ? (
                  <SkeletonFieldValue />
                ) : (
                  <div className="rounded-full border border-[var(--fms-strokes)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--fms-text-header)]">
                    {vehicleNumber || '—'}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Vehicle Number</Label>
                <SearchableAutocomplete
                  value={vehicleId}
                  onChange={(value) => onVehicleChange?.(value)}
                  options={vehicleOptions}
                  loading={vehiclesLoading}
                  disabled={vehiclesLoading || vehicleOptions.length === 0}
                  placeholder="Select vehicle"
                  searchPlaceholder="Search vehicle number…"
                  emptyMessage="No assigned vehicles found."
                />
              </div>
            )}

            {isDetail ? (
              <DetailValueField label="Date" value={dateDisplay} />
            ) : (
              <div className="space-y-2">
                <Label htmlFor="log-date">Fuel Log Date</Label>
                <Input
                  id="log-date"
                  type="date"
                  value={logDate}
                  onChange={(event) => onLogDateChange?.(event.target.value)}
                  className="rounded-full"
                />
              </div>
            )}

            {isDetail ? (
              <DetailValueField label="Fuel Refill Liters" value={litersDisplay} />
            ) : (
              <div className="space-y-2">
                <Label htmlFor="fuel-liters">Fuel Refill Liters</Label>
                <Input
                  id="fuel-liters"
                  type="number"
                  min={0}
                  step="any"
                  value={fuelLiters}
                  onChange={(event) => onFuelLitersChange?.(event.target.value)}
                  placeholder="Fuel refill liters"
                  className="rounded-full"
                />
              </div>
            )}

            {isDetail ? (
              <DetailValueField label="Total Cost" value={costDisplay} />
            ) : (
              <div className="space-y-2">
                <Label htmlFor="total-cost">Total Cost</Label>
                <Input
                  id="total-cost"
                  type="number"
                  min={0}
                  value={totalCost}
                  onChange={(event) => onTotalCostChange?.(event.target.value)}
                  placeholder="Total Cost in Nu."
                  className="rounded-full"
                />
              </div>
            )}

            {isDetail ? (
              <DetailValueField label="Odometer" value={odometerDisplay} />
            ) : (
              <div className="space-y-2">
                <Label htmlFor="odometer">Odometer</Label>
                <Input
                  id="odometer"
                  type="number"
                  min={0}
                  value={odometer}
                  onChange={(event) => onOdometerChange?.(event.target.value)}
                  placeholder="Odometer reading in Km"
                  className="rounded-full"
                />
              </div>
            )}

            {isDetail ? (
              <DetailValueField label="Location" value={location} />
            ) : (
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(event) => onLocationChange?.(event.target.value)}
                  placeholder="Enter location"
                  className="rounded-full"
                />
              </div>
            )}

            {isDetail ? (
              <div className="space-y-2">
                <Label>Status</Label>
                <div className="rounded-full border border-[var(--fms-strokes)] bg-white px-4 py-2.5">
                  <FuelLogStatusCell status={status} />
                </div>
              </div>
            ) : null}

            {isDetail && mtoRemarks?.trim() ? (
              <div className="space-y-2 sm:col-span-2">
                <Label>MTO Remarks</Label>
                <div className="rounded-lg border border-[var(--fms-strokes)] bg-white px-4 py-2.5 text-sm whitespace-pre-wrap text-[var(--fms-text-header)]">
                  {mtoRemarks.trim()}
                </div>
              </div>
            ) : null}
          </div>

          <ReceiptUploadField
            readOnly={isDetail}
            fileName={receiptFileName}
            objectKey={receiptObjectKey}
            fileSizeLabel={receiptFileSizeLabel}
            receiptLoading={receiptLoading}
            onReceiptClick={onReceiptClick}
            onFileChange={onReceiptChange}
          />

          {isDetail && showQuotaSummary && quotaSummary ? (
            <FuelLogQuotaSummaryCards
              summary={quotaSummary}
              showBalanceAfterLog={showBalanceAfterLog}
            />
          ) : null}

          {!isDetail ? (
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={submitDisabled}
                className="min-w-[160px] rounded-full bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)]"
              >
                Save Fuel Log
              </Button>
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  )
}

function CreateFuelLogPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const crud = useRouteCrudPermissions('/fuel/create-fuel-log')
  const user = useUserStore((state) => state.user)

  const profileRecord = useMemo((): ApiRecord | null => {
    if (user && typeof user === 'object' && !Array.isArray(user)) {
      return user as ApiRecord
    }
    return null
  }, [user])

  const profile = useMemo(
    () => (profileRecord ? mapUserDetailFields(profileRecord) : null),
    [profileRecord],
  )

  const driverId = useMemo(() => {
    if (profile?.id && profile.id !== '-') return profile.id
    if (profileRecord) {
      const rawId = profileRecord.id ?? profileRecord.user_id ?? profileRecord.uuid
      if (typeof rawId === 'string' && rawId.trim()) return rawId.trim()
    }
    return ''
  }, [profile?.id, profileRecord])

  const vehiclesQuery = useQuery({
    queryKey: ['fuel-logs', 'driver-vehicles', driverId],
    queryFn: () => fetchDriverVehicles(driverId),
    enabled: Boolean(driverId) && (!crud.isResolved || crud.canCreate),
    staleTime: 60_000,
  })

  const vehicleOptions = vehiclesQuery.data ?? []

  const [vehicleId, setVehicleId] = useState('')
  const [logDate, setLogDate] = useState(getFuelLogAutoDateIso())
  const [fuelLiters, setFuelLiters] = useState('')
  const [totalCost, setTotalCost] = useState('')
  const [odometer, setOdometer] = useState('')
  const [location, setLocation] = useState('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)

  useEffect(() => {
    if (vehicleId || vehiclesQuery.isLoading) return
    if (vehicleOptions.length === 1) {
      setVehicleId(vehicleOptions[0].value)
    }
  }, [vehicleId, vehicleOptions, vehiclesQuery.isLoading])

  const selectedVehicleLabel =
    vehicleOptions.find((option) => option.value === vehicleId)?.label ?? ''

  const canSubmit =
    Boolean(vehicleId) &&
    logDate.trim() !== '' &&
    Number(fuelLiters) > 0 &&
    Number(totalCost) > 0 &&
    Number(odometer) > 0 &&
    location.trim() !== '' &&
    receiptFile !== null

  const createMutation = useMutation({
    mutationFn: () => {
      if (!receiptFile) throw new Error('Receipt is required.')
      return createFuelLog({
        vehicleId,
        logDate,
        fuelRefillLiters: Number(fuelLiters),
        totalCost: Number(totalCost),
        odometerReading: Number(odometer),
        location,
        receiptFile,
      })
    },
    onSuccess: async () => {
      showSuccessToast('Fuel log saved')
      await queryClient.invalidateQueries({ queryKey: ['fuel-logs'] })
      navigate('/fuel/logs')
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to save fuel log')
    },
  })

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!crud.canCreate && crud.isResolved) return
    if (!canSubmit) {
      showErrorToast('Fill in all required fuel log fields')
      return
    }
    createMutation.mutate()
  }

  if (crud.isResolved && !crud.canCreate) {
    return (
      <section className="space-y-5">
        <PageHeader title="Add Fuel Log" />
        <p className="text-sm text-[var(--fms-text-subheading)]">
          You do not have permission to create fuel logs.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <BackToListButton to="/fuel/logs" />
      <PageHeader title="Add Fuel Log" />

      {vehiclesQuery.isLoading ? (
        <p className="text-sm text-[var(--fms-text-subheading)]">Loading assigned vehicles…</p>
      ) : null}

      <FuelLogForm
        mode="create"
        vehicleNumber={selectedVehicleLabel}
        vehicleId={vehicleId}
        vehicleOptions={vehicleOptions}
        vehiclesLoading={vehiclesQuery.isLoading}
        onVehicleChange={setVehicleId}
        logDate={logDate}
        fuelLiters={fuelLiters}
        totalCost={totalCost}
        odometer={odometer}
        location={location}
        receiptFileName={receiptFile?.name ?? ''}
        receiptFileSizeLabel={
          receiptFile ? formatFileSizeLabel(receiptFile.size) : undefined
        }
        onLogDateChange={setLogDate}
        onFuelLitersChange={setFuelLiters}
        onTotalCostChange={setTotalCost}
        onOdometerChange={setOdometer}
        onLocationChange={setLocation}
        onReceiptChange={setReceiptFile}
        onSubmit={handleSubmit}
        submitDisabled={!canSubmit || createMutation.isPending || vehiclesQuery.isLoading}
      />
    </section>
  )
}

function FuelLogDetailPage() {
  const { logId = '' } = useParams<{ logId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const crud = useRouteCrudPermissions('/fuel/logs')
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
  const [reviewAction, setReviewAction] = useState<FuelLogMtoReviewAction | null>(null)
  const [reviewRemarks, setReviewRemarks] = useState('')
  const [resubmitDialogOpen, setResubmitDialogOpen] = useState(false)
  const [resubmitLogDate, setResubmitLogDate] = useState('')
  const [resubmitFuelLiters, setResubmitFuelLiters] = useState('')
  const [resubmitTotalCost, setResubmitTotalCost] = useState('')
  const [resubmitOdometer, setResubmitOdometer] = useState('')
  const [resubmitLocation, setResubmitLocation] = useState('')
  const [resubmitReceiptFile, setResubmitReceiptFile] = useState<File | null>(null)

  const detailQuery = useQuery({
    queryKey: ['fuel-logs', 'detail', logId],
    queryFn: () => fetchFuelLogById(logId),
    enabled: Boolean(logId.trim()) && (!crud.isResolved || crud.canRead),
    staleTime: 30_000,
  })

  const record = detailQuery.data
  const displayVehicleNumber = record ? formatFuelLogVehicleDisplay(record) : '—'

  const showBalanceAfterLog = record ? isFuelLogMtoReviewable(record.status) : false
  const showQuotaSummary = Boolean(record)
  const isMainLoading = detailQuery.isPending && !record

  const receiptMutation = useMutation({
    mutationFn: (targetWindow: Window | null) => {
      if (!logId.trim()) throw new Error('Missing fuel log id')
      return openFuelLogReceipt(
        logId,
        record?.receiptFileName || record?.receiptObjectKey || '',
        targetWindow,
      )
    },
    onError: (error, targetWindow) => {
      if (targetWindow && !targetWindow.closed) targetWindow.close()
      showErrorToast(error, 'Could not open receipt')
    },
  })

  const handleReceiptClick = () => {
    receiptMutation.mutate(preOpenBrowserTab())
  }

  // const isReviewable = record ? isFuelLogMtoReviewable(record.status) : false
  // const showApproveButton = isReviewable && crud.isResolved && crud.canApprove
  // const showRejectButton = isReviewable && crud.isResolved && crud.canReject
  // const showReviewActions = showApproveButton || showRejectButton
  // const normalizedStatus = record?.status.trim().toUpperCase() ?? ''
  // const isRejectedStatus =
  //   normalizedStatus === 'REJECTED' ||
  //   normalizedStatus === 'DECLINED' ||
  //   normalizedStatus === 'MTO_REJECTED' ||
  //   normalizedStatus === 'FINANCE_REJECTED'
  // const showResubmitButton = isDriverRole && isRejectedStatus && crud.isResolved && crud.canCreate

  const reviewMutation = useMutation({
    mutationFn: ({
      action,
      remarks,
    }: {
      action: FuelLogMtoReviewAction
      remarks: string
    }) => {
      if (!logId.trim()) throw new Error('Missing fuel log id')
      return reviewFuelLogMto(logId, action, remarks)
    },
    onSuccess: async (_data, variables) => {
      showSuccessToast(
        variables.action === 'approve' ? 'Fuel log approved' : 'Fuel log rejected',
      )
      setReviewDialogOpen(false)
      setReviewAction(null)
      setReviewRemarks('')
      await queryClient.invalidateQueries({ queryKey: ['fuel-logs'] })
      navigate('/fuel/logs')
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to review fuel log')
    },
  })

  // const openReviewDialog = (action: FuelLogMtoReviewAction) => {
  //   if (reviewMutation.isPending) return
  //   if (action === 'approve' && !showApproveButton) return
  //   if (action === 'reject' && !showRejectButton) return
  //   setReviewAction(action)
  //   setReviewRemarks('')
  //   setReviewDialogOpen(true)
  // }

  const closeReviewDialog = () => {
    if (reviewMutation.isPending) return
    setReviewDialogOpen(false)
    setReviewAction(null)
    setReviewRemarks('')
  }

  const confirmReview = () => {
    if (!reviewAction) return
    const remarks = reviewRemarks.trim()
    if (!remarks) {
      showErrorToast('Remarks are required.')
      return
    }
    reviewMutation.mutate({ action: reviewAction, remarks })
  }

  const reviewActionBusy = reviewMutation.isPending

  const resubmitMutation = useMutation({
    mutationFn: () => {
      return resubmitFuelLog(logId, {
        logDate: resubmitLogDate,
        fuelRefillLiters: Number(resubmitFuelLiters),
        totalCost: Number(resubmitTotalCost),
        odometerReading: Number(resubmitOdometer),
        location: resubmitLocation.trim(),
        receiptFile: resubmitReceiptFile,
      })
    },
    onSuccess: async () => {
      showSuccessToast('Fuel log resubmitted')
      setResubmitDialogOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['fuel-logs'] })
      await queryClient.invalidateQueries({ queryKey: ['fuel-logs', 'detail', logId] })
      navigate('/fuel/logs')
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to resubmit fuel log')
    },
  })

  // const openResubmitDialog = () => {
  //   if (!record || resubmitMutation.isPending) return
  //   setResubmitLogDate(record.date)
  //   setResubmitFuelLiters(String(record.liters))
  //   setResubmitTotalCost(String(record.totalCost))
  //   setResubmitOdometer(String(record.odometerKm))
  //   setResubmitLocation(record.location === '—' ? '' : record.location)
  //   setResubmitReceiptFile(null)
  //   setResubmitDialogOpen(true)
  // }

  const closeResubmitDialog = () => {
    if (resubmitMutation.isPending) return
    setResubmitDialogOpen(false)
  }

  if (crud.isResolved && !crud.canRead) {
    return (
      <section className="space-y-5">
        <PageHeader title="Fuel Log Details" />
        <p className="text-sm text-[var(--fms-text-subheading)]">
          You do not have permission to view this fuel log.
        </p>
      </section>
    )
  }

  if (isMainLoading) {
    return (
      <section className="space-y-5">
        <BackToListButton to="/fuel/logs" />
        <PageHeader title="Fuel Log Details" />
        <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white">
          <CardContent className="space-y-4 p-4 sm:p-6">
            <SkeletonFieldValue />
            <SkeletonFieldValue />
          </CardContent>
        </Card>
      </section>
    )
  }

  if (!isMainLoading && (detailQuery.isError || !record)) {
    return (
      <section className="space-y-5">
        <BackToListButton to="/fuel/logs" />
        <PageHeader title="Fuel Log Details" subtitle="Record not found" />
        <p className="text-sm text-[var(--fms-text-subheading)]">
          {detailQuery.error instanceof Error
            ? detailQuery.error.message
            : `No fuel log matches "${logId}".`}
        </p>
      </section>
    )
  }

  if (!record) {
    return null
  }

  return (
    <section className="space-y-5">
      <BackToListButton to="/fuel/logs" />
      <PageHeader title="Fuel Log Details" />

      <FuelLogForm
        mode="detail"
        vehicleNumber={displayVehicleNumber}
        logDate={record.date}
        fuelLiters={String(record.liters)}
        totalCost={String(record.totalCost)}
        odometer={String(record.odometerKm)}
        location={record.location}
        status={record.status}
        mtoRemarks={record.mtoRemarks}
        receiptFileName={record.receiptFileName}
        receiptObjectKey={record.receiptObjectKey}
        receiptFileSizeLabel={record.receiptFileSizeLabel}
        receiptLoading={receiptMutation.isPending}
        onReceiptClick={handleReceiptClick}
        showQuotaSummary={showQuotaSummary}
        showBalanceAfterLog={showBalanceAfterLog}
        quotaSummary={{
          currentBalance: record.currentBalance,
          balanceAfterLog: record.balanceAfterLog,
          maxQuota: record.maxQuota,
          threshold: record.threshold,
        }}
      />

      {/* {showReviewActions ? (
        <div className="flex flex-wrap gap-3">
          {showApproveButton ? (
            <Button
              type="button"
              className="bg-[var(--fms-success-text)] text-white hover:bg-[var(--fms-success-text)]/90"
              disabled={reviewActionBusy}
              onClick={() => openReviewDialog('approve')}
            >
              Approve
            </Button>
          ) : null}
          {showRejectButton ? (
            <Button
              type="button"
              variant="outline"
              className="border-[#ed8936] text-[#c05621]"
              disabled={reviewActionBusy}
              onClick={() => openReviewDialog('reject')}
            >
              Reject
            </Button>
          ) : null}
        </div>
      ) : null}

      {showResubmitButton ? (
        <Button
          type="button"
          className="bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)]"
          disabled={resubmitMutation.isPending}
          onClick={openResubmitDialog}
        >
          Resubmit
        </Button>
      ) : null} */}

      <Dialog open={reviewDialogOpen} onOpenChange={(open) => !open && closeReviewDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader className="items-center text-center">
            {reviewAction === 'reject' ? (
              <div className="mb-2 rounded-full bg-[var(--fms-error-fill)] p-2.5">
                <AlertTriangle className="h-5 w-5 text-[var(--fms-delete)]" />
              </div>
            ) : null}
            <DialogTitle>
              {reviewAction === 'approve' ? 'Approve Fuel Log' : 'Reject Fuel Log'}
            </DialogTitle>
            <DialogDescription>
              {reviewAction === 'approve'
                ? 'Enter remarks before approving this fuel log.'
                : 'Enter remarks before rejecting this fuel log.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="fuel-log-review-remarks">
              Remarks <span className="text-[var(--fms-delete)]">*</span>
            </Label>
            <textarea
              id="fuel-log-review-remarks"
              value={reviewRemarks}
              onChange={(event) => setReviewRemarks(event.target.value)}
              placeholder={
                reviewAction === 'approve'
                  ? 'Enter approval remarks'
                  : 'Provide a reason for rejecting this fuel log'
              }
              rows={4}
              disabled={reviewActionBusy}
              className="min-h-[96px] w-full rounded-lg border border-[var(--fms-strokes)] bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <DialogFooter className="justify-center gap-2 sm:justify-center">
            <Button
              type="button"
              variant="outline"
              disabled={reviewActionBusy}
              onClick={closeReviewDialog}
            >
              Close
            </Button>
            <Button
              type="button"
              className={
                reviewAction === 'approve'
                  ? 'bg-[var(--fms-success-text)] text-white hover:bg-[var(--fms-success-text)]/90'
                  : 'bg-[var(--fms-delete)] text-white hover:bg-[#c70009]'
              }
              disabled={reviewActionBusy}
              onClick={confirmReview}
            >
              {reviewActionBusy
                ? reviewAction === 'approve'
                  ? 'Approving…'
                  : 'Rejecting…'
                : reviewAction === 'approve'
                  ? 'Confirm Approve'
                  : 'Confirm Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resubmitDialogOpen} onOpenChange={(open) => !open && closeResubmitDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Resubmit Fuel Log</DialogTitle>
            <DialogDescription>
              Update required fields and upload a new receipt before resubmitting.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="resubmit-log-date">Fuel Log Date</Label>
              <Input
                id="resubmit-log-date"
                type="date"
                value={resubmitLogDate}
                onChange={(event) => setResubmitLogDate(event.target.value)}
                disabled={resubmitMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resubmit-fuel-liters">Fuel Refill Liters</Label>
              <Input
                id="resubmit-fuel-liters"
                type="number"
                min={0}
                step="any"
                value={resubmitFuelLiters}
                onChange={(event) => setResubmitFuelLiters(event.target.value)}
                disabled={resubmitMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resubmit-total-cost">Total Cost</Label>
              <Input
                id="resubmit-total-cost"
                type="number"
                min={0}
                value={resubmitTotalCost}
                onChange={(event) => setResubmitTotalCost(event.target.value)}
                disabled={resubmitMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resubmit-odometer">Odometer</Label>
              <Input
                id="resubmit-odometer"
                type="number"
                min={0}
                value={resubmitOdometer}
                onChange={(event) => setResubmitOdometer(event.target.value)}
                disabled={resubmitMutation.isPending}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="resubmit-location">Location</Label>
              <Input
                id="resubmit-location"
                value={resubmitLocation}
                onChange={(event) => setResubmitLocation(event.target.value)}
                disabled={resubmitMutation.isPending}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <ReceiptUploadField
                fileName={resubmitReceiptFile?.name ?? ''}
                fileSizeLabel={
                  resubmitReceiptFile ? formatFileSizeLabel(resubmitReceiptFile.size) : undefined
                }
                onFileChange={setResubmitReceiptFile}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={resubmitMutation.isPending}
              onClick={closeResubmitDialog}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)]"
              onClick={() => resubmitMutation.mutate()}
            >
              {resubmitMutation.isPending ? 'Resubmitting…' : 'Resubmit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

export default function CreateFuelLog() {
  const { logId } = useParams<{ logId?: string }>()
  if (logId) return <FuelLogDetailPage />
  return <CreateFuelLogPage />
}
