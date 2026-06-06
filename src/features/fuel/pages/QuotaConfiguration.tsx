import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatNuAmount } from '@/features/maintenance/lib/maintenance-ui'
import {
  formatQuotaEffectiveDate,
  QUOTA_CONFIGURATION_MOCK_ROWS,
  QUOTA_FUEL_TYPE_OPTIONS,
  QUOTA_VEHICLE_CATEGORY_OPTIONS,
  type QuotaConfigurationRule,
} from '@/features/fuel/lib/quota-configuration-mock-data'
import { PageHeader } from '@/shared/components/PageHeader'
import {
  EditRowActionButton,
  rowActionsContainerClassName,
} from '@/shared/components/TableRowActionButtons'
import { TablePagination } from '@/shared/components/TablePagination'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showSuccessToast } from '@/shared/lib/toast'

type QuotaFormValues = {
  vehicleCategory: string
  fuelType: string
  maximumQuota: string
  threshold: string
  notes: string
}

const TABLE_COLUMNS = [
  'SL.No',
  'Vehicle Category',
  'Maximum Quota',
  'Threshold',
  'Effective from',
  'Fuel Type',
  'Status',
] as const

function emptyFormValues(): QuotaFormValues {
  return {
    vehicleCategory: '',
    fuelType: '',
    maximumQuota: '',
    threshold: '',
    notes: '',
  }
}

function ruleToFormValues(rule: QuotaConfigurationRule): QuotaFormValues {
  return {
    vehicleCategory: rule.vehicleCategory,
    fuelType: rule.fuelType,
    maximumQuota: String(rule.maximumQuota),
    threshold: String(rule.threshold),
    notes: rule.notes ?? '',
  }
}

function QuotaStatusBadge({ status }: { status: QuotaConfigurationRule['status'] }) {
  const isActive = status === 'Active'
  return (
    // <Badge
    //   className={cn(
    //     "rounded-full border-0 px-3 py-0.5 text-xs  hover:bg-transparent",
    //     isActive
    //       ? ' "rounded-full bg-[#d7f8e8] px-2 py-1 text-xs text-[#0f8e5c]"'
    //       : "bg-[#edf2f7] text-[var(--fms-text-subheading)]",
    //   )}
    // >
    //   {status}
    //   </Badge>
    <span
      className={
        isActive
          ? "rounded-full bg-[#d7f8e8] px-2 py-1 text-xs text-[#0f8e5c]"
          : "rounded-full bg-[#fff4cc] px-2 py-1 text-xs text-[#9f7b00]"
      }
    >
      {status}
    </span>
  );
}

function NuAmountField({
  id,
  label,
  value,
  placeholder,
  onChange,
}: {
  id: string
  label: string
  value: string
  placeholder: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex overflow-hidden rounded-lg border border-[var(--fms-strokes)] focus-within:ring-3 focus-within:ring-[var(--fms-info-border)]/40">
        <span className="flex items-center border-r border-[var(--fms-strokes)] bg-[#f6f6f7] px-3 text-sm text-[var(--fms-text-subheading)]">
          Nu.
        </span>
        <Input
          id={id}
          type="number"
          min={0}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="border-0 rounded-none shadow-none focus-visible:ring-0"
        />
      </div>
    </div>
  )
}

export default function QuotaConfiguration() {
  const crud = useRouteCrudPermissions('/fuel/quota-configuration')
  const [rules, setRules] = useState<QuotaConfigurationRule[]>(
    () => QUOTA_CONFIGURATION_MOCK_ROWS,
  )
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<QuotaFormValues>(emptyFormValues)

  const totalCount = rules.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const serialBase = (page - 1) * pageSize

  const rows = useMemo(() => {
    const start = serialBase
    return rules.slice(start, start + pageSize)
  }, [rules, pageSize, serialBase])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const openCreateDialog = () => {
    setEditingId(null)
    setForm(emptyFormValues())
    setDialogOpen(true)
  }

  const openEditDialog = (rule: QuotaConfigurationRule) => {
    setEditingId(rule.id)
    setForm(ruleToFormValues(rule))
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingId(null)
    setForm(emptyFormValues())
  }

  const onSaveConfiguration = () => {
    const vehicleCategory = form.vehicleCategory.trim()
    const fuelType = form.fuelType.trim()
    const maximumQuota = Number(form.maximumQuota)
    const threshold = Number(form.threshold)

    if (!vehicleCategory || !fuelType || !Number.isFinite(maximumQuota) || !Number.isFinite(threshold)) {
      return
    }

    if (editingId) {
      setRules((current) =>
        current.map((rule) =>
          rule.id === editingId
            ? {
                ...rule,
                vehicleCategory,
                fuelType,
                maximumQuota,
                threshold,
                notes: form.notes.trim() || undefined,
              }
            : rule,
        ),
      )
      showSuccessToast('Quota configuration updated')
    } else {
      const nextRule: QuotaConfigurationRule = {
        id: `quota-rule-${Date.now()}`,
        vehicleCategory,
        fuelType,
        maximumQuota,
        threshold,
        effectiveFrom: new Date().toISOString().slice(0, 10),
        status: 'Active',
        notes: form.notes.trim() || undefined,
      }
      setRules((current) => [nextRule, ...current])
      setPage(1)
      showSuccessToast('Quota configuration saved')
    }

    closeDialog()
  }

  const canSubmit =
    form.vehicleCategory.trim() !== '' &&
    form.fuelType.trim() !== '' &&
    Number(form.maximumQuota) > 0 &&
    Number(form.threshold) > 0

  return (
    <section className="space-y-5">
      <PageHeader title="Quota Configuration" />

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="space-y-4 p-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-[var(--fms-text-header)]">
              Existing Quota Rules
            </h2>
            <Button
              type="button"
              className="w-full bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)] sm:w-auto"
              onClick={openCreateDialog}
              disabled={!crud.canCreate && crud.isResolved}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add New
            </Button>
          </div>

          <div className="overflow-hidden rounded-lg border border-[var(--fms-strokes)]">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  {TABLE_COLUMNS.map((column) => (
                    <th key={column} className="px-4 py-3 text-left font-semibold">
                      {column}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {crud.isResolved && !crud.canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMNS.length + 1}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      You do not have permission to view quota rules.
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMNS.length + 1}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      No quota rules found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr
                      key={row.id}
                      className="border-t border-[var(--fms-strokes)]"
                    >
                      <td className="px-4 py-3 tabular-nums text-[var(--fms-text-subheading)]">
                        {serialBase + index + 1}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">
                        {row.vehicleCategory}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {formatNuAmount(row.maximumQuota)}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {formatNuAmount(row.threshold)}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {formatQuotaEffectiveDate(row.effectiveFrom)}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.fuelType}
                      </td>
                      <td className="px-4 py-3">
                        <QuotaStatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className={rowActionsContainerClassName}>
                          <EditRowActionButton
                            type="button"
                            disabled={!crud.canUpdate && crud.isResolved}
                            onClick={() => openEditDialog(row)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <TablePagination
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={(nextPage) =>
              setPage(Math.max(1, Math.min(nextPage, totalPages)))
            }
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize)
              setPage(1)
            }}
          />
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog()
          else setDialogOpen(true)
        }}
      >
        <DialogContent className="max-w-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[var(--fms-text-header)]">
              Add/Update Quota Configuration
            </DialogTitle>
          </DialogHeader>

          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault()
              onSaveConfiguration()
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Vehicle Category</Label>
                <Select
                  value={form.vehicleCategory || undefined}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, vehicleCategory: value }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Vehicle Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {QUOTA_VEHICLE_CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <NuAmountField
                id="maximum-quota"
                label="Maximum Quota Amount"
                value={form.maximumQuota}
                placeholder="Enter Amount"
                onChange={(value) =>
                  setForm((current) => ({ ...current, maximumQuota: value }))
                }
              />

              <div className="space-y-2">
                <Label>Fuel Type</Label>
                <Select
                  value={form.fuelType || undefined}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, fuelType: value }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Fuel Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {QUOTA_FUEL_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <NuAmountField
                id="threshold-amount"
                label="Threshold Amount"
                value={form.threshold}
                placeholder="Enter Amount"
                onChange={(value) =>
                  setForm((current) => ({ ...current, threshold: value }))
                }
              />

              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="quota-notes">Notes/Description</Label>
                <Input
                  id="quota-notes"
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, notes: event.target.value }))
                  }
                  placeholder="Enter Notes/ description"
                />
              </div>
            </div>

            <div className="flex justify-center pt-1">
              <Button
                type="submit"
                disabled={!canSubmit}
                className="min-w-[200px] bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)]"
              >
                Save Configuration
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
