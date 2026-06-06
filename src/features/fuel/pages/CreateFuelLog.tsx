import { ArrowLeft, CloudUpload } from 'lucide-react'
import { type FormEvent, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  createFuelLog,
  FUEL_LOG_AUTO_DRIVER,
  FUEL_LOG_AUTO_VEHICLE,
  FUEL_LOG_LOCATION_OPTIONS,
  formatFuelLogCost,
  formatFuelLogDate,
  formatFuelLogLiters,
  formatFuelLogOdometer,
  getFuelLogAutoDateIso,
  getFuelLogAutoDateLabel,
  getFuelLogById,
} from '@/features/fuel/lib/fuel-log-mock-data'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/shared/components/PageHeader'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

function AutoPopulateField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="rounded-full bg-[#f3f4f6] px-4 py-2.5 text-sm font-semibold text-[var(--fms-text-header)]">
        {value}
      </div>
    </div>
  )
}

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

function ReceiptUploadField({
  readOnly,
  fileName,
  onFileChange,
}: {
  readOnly?: boolean
  fileName: string
  onFileChange?: (name: string) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (readOnly) {
    return (
      <div className="space-y-2">
        <Label>Upload Receipt</Label>
        <div className="rounded-full bg-[#ddf2ff] px-4 py-2.5 text-sm font-medium text-[#0a72a5]">
          {fileName || '—'}
        </div>
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
          const file = event.target.files?.[0]
          onFileChange?.(file?.name ?? '')
        }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-full border border-[var(--fms-strokes)] px-4 py-2.5 text-sm transition-colors',
          fileName
            ? 'bg-[#ddf2ff] font-medium text-[#0a72a5]'
            : 'bg-[#f8fbff] text-[var(--fms-text-subheading)] hover:bg-[#eef6ff]',
        )}
      >
        <CloudUpload className="h-4 w-4 shrink-0" />
        {fileName || 'Upload receipt in Jpg.,png,......'}
      </button>
    </div>
  )
}

type FuelLogFormProps = {
  mode: 'create' | 'detail'
  driverName: string
  vehicleNumber: string
  dateLabel: string
  fuelLiters: string
  totalCost: string
  odometer: string
  location: string
  receiptFileName: string
  onFuelLitersChange?: (value: string) => void
  onTotalCostChange?: (value: string) => void
  onOdometerChange?: (value: string) => void
  onLocationChange?: (value: string) => void
  onReceiptChange?: (value: string) => void
  onSubmit?: (event: FormEvent) => void
  submitDisabled?: boolean
}

function FuelLogForm({
  mode,
  driverName,
  vehicleNumber,
  dateLabel,
  fuelLiters,
  totalCost,
  odometer,
  location,
  receiptFileName,
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

  return (
    <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white">
      <CardContent className="space-y-5 p-4 sm:p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-[var(--fms-text-header)]">
            Add Fuel Log
          </h2>
          <p className="text-sm text-[var(--fms-text-subheading)]">Fuel Log Form</p>
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
              <DetailValueField label="Driver Name" value={driverName} />
            ) : (
              <AutoPopulateField label="Driver Name" value={driverName} />
            )}

            {isDetail ? (
              <DetailValueField label="Vehicle Number" value={vehicleNumber} />
            ) : (
              <AutoPopulateField label="Vehicle Number" value={vehicleNumber} />
            )}

            {isDetail ? (
              <DetailValueField label="Date" value={dateLabel} />
            ) : (
              <AutoPopulateField label="Date" value={dateLabel} />
            )}

            {isDetail ? (
              <DetailValueField label="Fuel Refill Liters" value={litersDisplay} />
            ) : (
              <div className="space-y-2">
                <Label htmlFor="fuel-liters">Fuel Refill Liters</Label>
                <Input
                  id="fuel-liters"
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
                <Label>Location</Label>
                <Select
                  value={location || undefined}
                  onValueChange={(value) => onLocationChange?.(value)}
                >
                  <SelectTrigger className="w-full rounded-full">
                    <SelectValue placeholder="Select Location" />
                  </SelectTrigger>
                  <SelectContent>
                    {FUEL_LOG_LOCATION_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <ReceiptUploadField
              readOnly={isDetail}
              fileName={receiptFileName}
              onFileChange={onReceiptChange}
            />
          </div>

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
  const crud = useRouteCrudPermissions('/fuel/create-fuel-log')

  const [fuelLiters, setFuelLiters] = useState('')
  const [totalCost, setTotalCost] = useState('')
  const [odometer, setOdometer] = useState('')
  const [location, setLocation] = useState('')
  const [receiptFileName, setReceiptFileName] = useState('')

  const canSubmit =
    Number(fuelLiters) > 0 &&
    Number(totalCost) > 0 &&
    Number(odometer) > 0 &&
    location.trim() !== '' &&
    receiptFileName.trim() !== ''

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!crud.canCreate && crud.isResolved) return
    if (!canSubmit) {
      showErrorToast('Fill in all required fuel log fields')
      return
    }

    createFuelLog({
      driver: FUEL_LOG_AUTO_DRIVER,
      vehicle: FUEL_LOG_AUTO_VEHICLE,
      date: getFuelLogAutoDateIso(),
      liters: Number(fuelLiters),
      totalCost: Number(totalCost),
      location,
      odometerKm: Number(odometer),
      receiptFileName,
    })
    showSuccessToast('Fuel log saved')
    navigate('/fuel/logs')
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
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" asChild>
          <Link to="/fuel/logs" aria-label="Back to fuel logs">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader title="Add Fuel Log" />
      </div>

      <FuelLogForm
        mode="create"
        driverName={FUEL_LOG_AUTO_DRIVER}
        vehicleNumber={FUEL_LOG_AUTO_VEHICLE}
        dateLabel={getFuelLogAutoDateLabel()}
        fuelLiters={fuelLiters}
        totalCost={totalCost}
        odometer={odometer}
        location={location}
        receiptFileName={receiptFileName}
        onFuelLitersChange={setFuelLiters}
        onTotalCostChange={setTotalCost}
        onOdometerChange={setOdometer}
        onLocationChange={setLocation}
        onReceiptChange={setReceiptFileName}
        onSubmit={handleSubmit}
        submitDisabled={!canSubmit}
      />
    </section>
  )
}

function FuelLogDetailPage() {
  const { logId = '' } = useParams<{ logId: string }>()
  const crud = useRouteCrudPermissions('/fuel/logs')

  const record = useMemo(
    () => (logId ? getFuelLogById(logId) : undefined),
    [logId],
  )

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

  if (!record) {
    return (
      <section className="space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild>
            <Link to="/fuel/logs" aria-label="Back to fuel logs">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <PageHeader title="Fuel Log Details" subtitle="Record not found" />
        </div>
        <Button variant="outline" asChild>
          <Link to="/fuel/logs">Back to Fuel Log</Link>
        </Button>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" asChild>
          <Link to="/fuel/logs" aria-label="Back to fuel logs">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader title="Fuel Log Details" />
      </div>

      <FuelLogForm
        mode="detail"
        driverName={record.driver}
        vehicleNumber={record.vehicle}
        dateLabel={formatFuelLogDate(record.date)}
        fuelLiters={String(record.liters)}
        totalCost={String(record.totalCost)}
        odometer={String(record.odometerKm)}
        location={record.location}
        receiptFileName={record.receiptFileName}
      />

      <Button variant="outline" asChild>
        <Link to="/fuel/logs">Back to Fuel Log</Link>
      </Button>
    </section>
  )
}

export default function CreateFuelLog() {
  const { logId } = useParams<{ logId?: string }>()
  if (logId) return <FuelLogDetailPage />
  return <CreateFuelLogPage />
}
