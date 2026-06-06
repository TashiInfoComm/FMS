import { type FormEvent, useEffect, useMemo, useState } from 'react'

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
import {
  formatCurrentQuota,
  formatNuDisplay,
} from '@/features/fuel/lib/quota-request-mock-data'
import {
  getQuotaUpdatePendingList,
  getQuotaUpdateVehicleOptions,
  removeQuotaUpdatePending,
  type QuotaUpdatePendingRecord,
} from '@/features/fuel/lib/update-quota-mock-data'
import { PageHeader } from '@/shared/components/PageHeader'
import { TablePagination } from '@/shared/components/TablePagination'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showSuccessToast } from '@/shared/lib/toast'

const TABLE_COLUMNS = [
  'Sl.No',
  'Request ID',
  'Driver',
  'Vehicle',
  'Current Quota',
  'Finance Approved Amount',
  'Status',
] as const

function ReadyUpdateStatusBadge() {
  return (
    <span className="rounded-full bg-[#ddf2ff] px-2 py-1 text-xs font-semibold text-[#0a72a5]">
      READY UPDATE
    </span>
  )
}

export default function UpdateQuota() {
  const crud = useRouteCrudPermissions('/fuel/update-quota')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [refreshKey, setRefreshKey] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedRow, setSelectedRow] = useState<QuotaUpdatePendingRecord | null>(
    null,
  )
  const [vehicle, setVehicle] = useState('')
  const [newPrepaidAmount, setNewPrepaidAmount] = useState('')

  const allRows = useMemo(() => {
    void refreshKey
    return getQuotaUpdatePendingList()
  }, [refreshKey])

  const vehicleOptions = useMemo(
    () => getQuotaUpdateVehicleOptions(allRows),
    [allRows],
  )

  const totalCount = allRows.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const serialBase = (page - 1) * pageSize

  const rows = useMemo(() => {
    const start = serialBase
    return allRows.slice(start, start + pageSize)
  }, [allRows, pageSize, serialBase])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const openUpdateDialog = (row: QuotaUpdatePendingRecord) => {
    setSelectedRow(row)
    setVehicle(row.vehicle)
    setNewPrepaidAmount(String(row.financeApprovedAmount))
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setSelectedRow(null)
    setVehicle('')
    setNewPrepaidAmount('')
  }

  const canSubmitUpdate =
    vehicle.trim() !== '' && Number(newPrepaidAmount) > 0

  const onSubmitUpdate = (event: FormEvent) => {
    event.preventDefault()
    if (!selectedRow || !canSubmitUpdate) return
    removeQuotaUpdatePending(selectedRow.id)
    setRefreshKey((key) => key + 1)
    showSuccessToast('Quota updated successfully')
    closeDialog()
  }

  return (
    <section className="space-y-5">
      <PageHeader title="Quota Update" />

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="space-y-4 p-0">
          <div className="space-y-1 px-1 sm:px-0">
            <h2 className="text-lg font-semibold text-[var(--fms-text-header)]">
              Quota Update Pending List
            </h2>
            <p className="text-sm text-[var(--fms-text-subheading)]">
              List of Finance-approved fuel quota requests waiting for MTO quota
              update.
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[var(--fms-strokes)]">
            <table className="w-full min-w-[1020px] text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  {TABLE_COLUMNS.map((column) => (
                    <th
                      key={column}
                      className="px-4 py-3 text-left font-semibold"
                    >
                      {column}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {crud.isResolved && !crud.canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMNS.length + 1}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      You do not have permission to view quota updates.
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMNS.length + 1}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      No pending quota updates.
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
                      <td className="px-4 py-3 font-medium text-[var(--fms-text-header)]">
                        {row.requestId}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">
                        {row.driver}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">
                        {row.vehicle}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {formatCurrentQuota(row.quotaUsed, row.quotaTotal)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#0a72a5]">
                        {formatNuDisplay(row.financeApprovedAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <ReadyUpdateStatusBadge />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-full bg-[var(--fms-button)] px-4 hover:bg-[var(--fms-button-hover)]"
                          disabled={!crud.canUpdate && crud.isResolved}
                          onClick={() => openUpdateDialog(row)}
                        >
                          Update Quota
                        </Button>
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
        <DialogContent className="max-w-3xl sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[var(--fms-text-header)]">
              Update Quota Pending List
            </DialogTitle>
          </DialogHeader>

          <form
            className="flex flex-col gap-4 sm:flex-row sm:items-end"
            onSubmit={onSubmitUpdate}
          >
            <div className="min-w-0 flex-1 space-y-2">
              <Label>Select Vehicle</Label>
              <Select
                value={vehicle || undefined}
                onValueChange={setVehicle}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicleOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="new-prepaid-amount">New Prepaid Amount</Label>
              <Input
                id="new-prepaid-amount"
                type="number"
                min={1}
                value={newPrepaidAmount}
                onChange={(event) => setNewPrepaidAmount(event.target.value)}
                placeholder="Enter Amount"
              />
            </div>

            <Button
              type="submit"
              disabled={!canSubmitUpdate}
              className="w-full shrink-0 rounded-full bg-[var(--fms-button)] px-6 hover:bg-[var(--fms-button-hover)] sm:w-auto"
            >
              Update Quota
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
