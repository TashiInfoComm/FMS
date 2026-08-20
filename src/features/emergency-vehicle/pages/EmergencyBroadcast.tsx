import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CircleCheck, Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

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
import { EmergencyBroadcastStatusCell } from '@/features/emergency-vehicle/components/EmergencyBroadcastStatusCell'
import type { EmergencyBroadcastRow } from '@/features/emergency-vehicle/lib/emergency-broadcast-types'
import {
  canCancelOrCloseEmergencyIncident,
  cancelEmergencyIncident,
  closeEmergencyIncident,
  fetchEmergencyIncidentsPage,
  localDatetimeToIso,
  updateEmergencyIncidentEndDate,
} from '@/features/emergency-vehicle/lib/emergency-incidents-api'
import { cn } from '@/lib/utils'
import {
  ListPanelMessage,
  MobileListCard,
  MobileListField,
} from '@/shared/components/MobileListCard'
import {
  CancelRowActionButton,
  CloseRowActionButton,
  DetailRowActionButton,
  EditRowActionButton,
  rowActionsContainerClassName,
} from '@/shared/components/TableRowActionButtons'
import { TablePagination } from '@/shared/components/TablePagination'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

const TABLE_COLUMN_COUNT = 6

type ActionTarget = {
  id: string
  requestId: string
}

function toDatetimeLocalValue(iso?: string): string {
  const source = iso?.trim() ? new Date(iso) : new Date()
  if (Number.isNaN(source.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${source.getFullYear()}-${pad(source.getMonth() + 1)}-${pad(source.getDate())}T${pad(source.getHours())}:${pad(source.getMinutes())}`
}

function EmergencyBroadcast() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const crud = useRouteCrudPermissions('/emergency/broadcast')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [cancelTarget, setCancelTarget] = useState<ActionTarget | null>(null)
  const [cancelRemarks, setCancelRemarks] = useState('')
  const [closeTarget, setCloseTarget] = useState<ActionTarget | null>(null)
  const [closureNotes, setClosureNotes] = useState('')
  const [closeEndDatetime, setCloseEndDatetime] = useState('')
  const [endDateTarget, setEndDateTarget] = useState<ActionTarget | null>(null)
  const [endDateDatetime, setEndDateDatetime] = useState('')
  const [endDateRemarks, setEndDateRemarks] = useState('')

  const listQuery = useQuery({
    queryKey: ['emergency', 'incidents', search, page, pageSize],
    queryFn: () => fetchEmergencyIncidentsPage(search, page, pageSize),
    enabled: !crud.isResolved || crud.canRead,
    staleTime: 30_000,
  })

  const pageRows = listQuery.data?.rows ?? []
  const totalCount = listQuery.data?.totalCount ?? 0
  const totalPages =
    listQuery.data?.totalPages ?? Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize)))

  useEffect(() => {
    setPage(1)
  }, [search, pageSize])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const cancelMutation = useMutation({
    mutationFn: ({ incidentId, remarks }: { incidentId: string; remarks: string }) =>
      cancelEmergencyIncident(incidentId, remarks),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['emergency', 'incidents'] })
      showSuccessToast('Emergency incident cancelled')
      setCancelTarget(null)
      setCancelRemarks('')
    },
    onError: (error) => {
      showErrorToast(error, 'Could not cancel emergency incident')
    },
  })

  const closeMutation = useMutation({
    mutationFn: ({
      incidentId,
      notes,
      endDateIso,
    }: {
      incidentId: string
      notes: string
      endDateIso: string
    }) => closeEmergencyIncident(incidentId, notes, endDateIso),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['emergency', 'incidents'] })
      showSuccessToast('Emergency incident closed')
      setCloseTarget(null)
      setClosureNotes('')
      setCloseEndDatetime('')
    },
    onError: (error) => {
      showErrorToast(error, 'Could not close emergency incident')
    },
  })

  const updateEndDateMutation = useMutation({
    mutationFn: ({
      incidentId,
      endDateIso,
      remarks,
    }: {
      incidentId: string
      endDateIso: string
      remarks: string
    }) => updateEmergencyIncidentEndDate(incidentId, endDateIso, remarks),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['emergency', 'incidents'] })
      showSuccessToast('End date and time updated')
      setEndDateTarget(null)
      setEndDateDatetime('')
      setEndDateRemarks('')
    },
    onError: (error) => {
      showErrorToast(error, 'Could not update end date and time')
    },
  })

  const openDetail = (incidentId: string) => {
    navigate(`/emergency/broadcast/${encodeURIComponent(incidentId)}`, {
      state: { backPath: '/emergency/broadcast' },
    })
  }

  const openCancelDialog = (row: EmergencyBroadcastRow) => {
    setCancelTarget({ id: row.id, requestId: row.requestId })
    setCancelRemarks('')
  }

  const closeCancelDialog = () => {
    if (cancelMutation.isPending) return
    setCancelTarget(null)
    setCancelRemarks('')
  }

  const openCloseDialog = (row: EmergencyBroadcastRow) => {
    setCloseTarget({ id: row.id, requestId: row.requestId })
    setClosureNotes('')
    setCloseEndDatetime(toDatetimeLocalValue(row.endDate))
  }

  const closeCloseDialog = () => {
    if (closeMutation.isPending) return
    setCloseTarget(null)
    setClosureNotes('')
    setCloseEndDatetime('')
  }

  const openEndDateDialog = (row: EmergencyBroadcastRow) => {
    setEndDateTarget({ id: row.id, requestId: row.requestId })
    setEndDateDatetime(toDatetimeLocalValue(row.endDate))
    setEndDateRemarks('')
  }

  const closeEndDateDialog = () => {
    if (updateEndDateMutation.isPending) return
    setEndDateTarget(null)
    setEndDateDatetime('')
    setEndDateRemarks('')
  }

  const confirmCancel = () => {
    if (!cancelTarget) return
    const remarks = cancelRemarks.trim()
    if (!remarks) {
      showErrorToast('Remarks are required.')
      return
    }
    cancelMutation.mutate({ incidentId: cancelTarget.id, remarks })
  }

  const confirmClose = () => {
    if (!closeTarget) return
    const notes = closureNotes.trim()
    if (!notes) {
      showErrorToast('Closure notes are required.')
      return
    }
    const endDateIso = localDatetimeToIso(closeEndDatetime)
    if (!endDateIso) {
      showErrorToast('Enter a valid end date and time.')
      return
    }
    closeMutation.mutate({
      incidentId: closeTarget.id,
      notes,
      endDateIso,
    })
  }

  const confirmUpdateEndDate = () => {
    if (!endDateTarget) return
    const endDateIso = localDatetimeToIso(endDateDatetime)
    if (!endDateIso) {
      showErrorToast('Enter a valid end date and time.')
      return
    }
    const remarks = endDateRemarks.trim()
    if (!remarks) {
      showErrorToast('Remarks are required.')
      return
    }
    updateEndDateMutation.mutate({
      incidentId: endDateTarget.id,
      endDateIso,
      remarks,
    })
  }

  const emptyMessage =
    crud.isResolved && !crud.canRead
      ? 'You do not have permission to view emergency dispatches.'
      : listQuery.isError
        ? 'Failed to load emergency dispatches.'
        : search.trim()
          ? 'No emergency dispatches match your search.'
          : 'No emergency dispatches found.'

  const renderRowActions = (row: EmergencyBroadcastRow) => {
    const canAct = canCancelOrCloseEmergencyIncident(row.status)
    const isActive = row.status === 'active'
    const actionPending =
      closeMutation.isPending || cancelMutation.isPending || updateEndDateMutation.isPending
    return (
      <div className={cn(rowActionsContainerClassName, 'justify-center gap-2')}>
        <DetailRowActionButton
          type="button"
          tooltip={`View ${row.requestId}`}
          aria-label={`View ${row.requestId}`}
          onClick={() => openDetail(row.id)}
        />
        {crud.canUpdate ? (
          <EditRowActionButton
            type="button"
            tooltip="Update the End date and time"
            aria-label={`Update end date and time for ${row.requestId}`}
            disabled={!canAct || actionPending}
            onClick={() => openEndDateDialog(row)}
          />
        ) : null}
        {crud.canCancel ? (
          <>
            <CloseRowActionButton
              type="button"
              tooltip={canAct ? `Close ${row.requestId}` : 'Incident already closed or cancelled'}
              aria-label={`Close ${row.requestId}`}
              disabled={!canAct || actionPending}
              onClick={() => openCloseDialog(row)}
            />
            {!isActive ? (
              <CancelRowActionButton
                type="button"
                tooltip={canAct ? `Cancel ${row.requestId}` : 'Incident already closed or cancelled'}
                aria-label={`Cancel ${row.requestId}`}
                disabled={!canAct || actionPending}
                onClick={() => openCancelDialog(row)}
              />
            ) : null}
          </>
        ) : null}
      </div>
    )
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-[var(--fms-text-header)] sm:text-2xl">
          Emergency Dispatch
        </h1>
        {crud.canCreate ? (
          <Button
            type="button"
            className="w-full bg-[var(--fms-button)] text-white hover:bg-[var(--fms-button-hover)] sm:w-auto"
            onClick={() => navigate('/emergency/broadcast/create')}
          >
            <Plus className="mr-1 h-4 w-4" />
            New Requirement
          </Button>
        ) : null}
      </div>

      <Card className="min-w-0 overflow-visible rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="min-w-0 space-y-4 p-0">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fms-text-subheading)]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search ..."
              className="h-9 pl-9"
              aria-label="Search emergency dispatches"
            />
          </div>

          <div className="hidden w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
            <table className="w-max min-w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-subheading)]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
                    Request ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
                    Start Date and Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
                    End Date and Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
                    Agency
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide uppercase">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {listQuery.isLoading ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMN_COUNT}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      Loading emergency dispatches…
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMN_COUNT}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-[var(--fms-strokes)] hover:bg-[#fafafa]"
                    >
                      <td className="px-4 py-3 font-semibold text-[var(--fms-text-header)]">
                        {row.requestId}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">
                        {row.startDateLabel}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">
                        {row.endDateLabel}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">
                        {row.agencyLabel}
                      </td>
                      <td className="px-4 py-3">
                        <EmergencyBroadcastStatusCell
                          status={row.status}
                          statusLabel={row.statusLabel}
                        />
                      </td>
                      <td className="px-4 py-3">{renderRowActions(row)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {listQuery.isLoading ? (
              <ListPanelMessage>Loading emergency dispatches…</ListPanelMessage>
            ) : pageRows.length === 0 ? (
              <ListPanelMessage>{emptyMessage}</ListPanelMessage>
            ) : (
              pageRows.map((row) => (
                <MobileListCard key={row.id}>
                  <MobileListField label="Request ID">
                    <span className="font-semibold text-[var(--fms-text-header)]">
                      {row.requestId}
                    </span>
                  </MobileListField>
                  <MobileListField label="Start Date and Time">
                    {row.startDateLabel}
                  </MobileListField>
                  <MobileListField label="End Date and Time">
                    {row.endDateLabel}
                  </MobileListField>
                  <MobileListField label="Agency">{row.agencyLabel}</MobileListField>
                  <MobileListField label="Status">
                    <EmergencyBroadcastStatusCell
                      status={row.status}
                      statusLabel={row.statusLabel}
                    />
                  </MobileListField>
                  <div className="mt-3">{renderRowActions(row)}</div>
                </MobileListCard>
              ))
            )}
          </div>

          {totalCount > 0 ? (
            <TablePagination
              page={page}
              totalPages={totalPages}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={setPage}
              onPageSizeChange={(next) => {
                setPageSize(next)
                setPage(1)
              }}
            />
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={cancelTarget !== null}
        onOpenChange={(open) => !open && closeCancelDialog()}
      >
        <DialogContent className="max-w-md">
          <DialogHeader className="items-center text-center">
            <div className="mb-2 rounded-full bg-[var(--fms-error-fill)] p-2.5">
              <AlertTriangle className="h-5 w-5 text-[var(--fms-delete)]" />
            </div>
            <DialogTitle>Cancel Emergency Incident</DialogTitle>
            <DialogDescription>
              {cancelTarget
                ? `Cancel ${cancelTarget.requestId}? This action cannot be undone.`
                : 'Cancel this emergency incident?'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="emergency-cancel-remarks">
              Remarks <span className="text-[var(--fms-delete)]">*</span>
            </Label>
            <textarea
              id="emergency-cancel-remarks"
              value={cancelRemarks}
              onChange={(event) => setCancelRemarks(event.target.value)}
              placeholder="False alarm — situation resolved before dispatch"
              rows={4}
              className="min-h-[96px] w-full rounded-lg border border-[var(--fms-strokes)] bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <DialogFooter className="justify-center gap-2 sm:justify-center">
            <Button
              type="button"
              variant="outline"
              disabled={cancelMutation.isPending}
              onClick={closeCancelDialog}
            >
              Close
            </Button>
            <Button
              type="button"
              className="bg-[var(--fms-delete)] text-white hover:bg-[#c70009]"
              disabled={cancelMutation.isPending}
              onClick={confirmCancel}
            >
              {cancelMutation.isPending ? 'Cancelling…' : 'Confirm Cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={closeTarget !== null}
        onOpenChange={(open) => !open && closeCloseDialog()}
      >
        <DialogContent className="max-w-md">
          <DialogHeader className="items-center text-center">
            <div className="mb-2 rounded-full bg-[#dcfce7] p-2.5">
              <CircleCheck className="h-5 w-5 text-[#15803d]" />
            </div>
            <DialogTitle>Close Emergency Incident</DialogTitle>
            <DialogDescription>
              {closeTarget
                ? `Close ${closeTarget.requestId} after the situation is resolved.`
                : 'Close this emergency incident.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="emergency-close-notes">
                Closure notes <span className="text-[var(--fms-delete)]">*</span>
              </Label>
              <textarea
                id="emergency-close-notes"
                value={closureNotes}
                onChange={(event) => setClosureNotes(event.target.value)}
                placeholder="Situation resolved, all units released"
                rows={4}
                className="min-h-[96px] w-full rounded-lg border border-[var(--fms-strokes)] bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergency-close-end-date">
                End date and time <span className="text-[var(--fms-delete)]">*</span>
              </Label>
              <Input
                id="emergency-close-end-date"
                type="datetime-local"
                value={closeEndDatetime}
                onChange={(event) => setCloseEndDatetime(event.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <DialogFooter className="justify-center gap-2 sm:justify-center">
            <Button
              type="button"
              variant="outline"
              disabled={closeMutation.isPending}
              onClick={closeCloseDialog}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[var(--fms-button)] text-white hover:bg-[var(--fms-button-hover)]"
              disabled={closeMutation.isPending}
              onClick={confirmClose}
            >
              {closeMutation.isPending ? 'Closing…' : 'Confirm Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={endDateTarget !== null}
        onOpenChange={(open) => !open && closeEndDateDialog()}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update End Date and Time</DialogTitle>
            <DialogDescription>
              {endDateTarget
                ? `Update the end date and time for ${endDateTarget.requestId}.`
                : 'Update the end date and time for this incident.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="emergency-update-end-date">
                End date and time <span className="text-[var(--fms-delete)]">*</span>
              </Label>
              <Input
                id="emergency-update-end-date"
                type="datetime-local"
                value={endDateDatetime}
                onChange={(event) => setEndDateDatetime(event.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergency-update-end-date-remarks">
                Remarks <span className="text-[var(--fms-delete)]">*</span>
              </Label>
              <textarea
                id="emergency-update-end-date-remarks"
                value={endDateRemarks}
                onChange={(event) => setEndDateRemarks(event.target.value)}
                placeholder="Extended response window due to weather conditions"
                rows={4}
                className="min-h-[96px] w-full rounded-lg border border-[var(--fms-strokes)] bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          </div>
          <DialogFooter className="justify-center gap-2 sm:justify-center">
            <Button
              type="button"
              variant="outline"
              disabled={updateEndDateMutation.isPending}
              onClick={closeEndDateDialog}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[var(--fms-button)] text-white hover:bg-[var(--fms-button-hover)]"
              disabled={updateEndDateMutation.isPending}
              onClick={confirmUpdateEndDate}
            >
              {updateEndDateMutation.isPending ? 'Updating…' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

export default EmergencyBroadcast
