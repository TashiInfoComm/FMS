import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Search } from 'lucide-react'
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
  declineEmergencyIncident,
  fetchEmergencyIncidentsPage,
} from '@/features/emergency-vehicle/lib/emergency-incidents-api'
import { cn } from '@/lib/utils'
import {
  ListPanelMessage,
  MobileListCard,
  MobileListField,
} from '@/shared/components/MobileListCard'
import {
  CancelRowActionButton,
  DetailRowActionButton,
  DeployVehicleRowActionButton,
  rowActionsContainerClassName,
} from '@/shared/components/TableRowActionButtons'
import { TablePagination } from '@/shared/components/TablePagination'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

const TABLE_COLUMN_COUNT = 7

type DeclineTarget = {
  id: string
  requestId: string
}

function EmergencyRequest() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const crud = useRouteCrudPermissions('/emergency/request')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [declineTarget, setDeclineTarget] = useState<DeclineTarget | null>(null)
  const [responseNotes, setResponseNotes] = useState('')

  const listQuery = useQuery({
    queryKey: ['emergency', 'incidents', 'request', search, page, pageSize],
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

  const declineMutation = useMutation({
    mutationFn: ({ incidentId, notes }: { incidentId: string; notes: string }) =>
      declineEmergencyIncident(incidentId, notes),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['emergency', 'incidents'] })
      showSuccessToast('Emergency request declined')
      setDeclineTarget(null)
      setResponseNotes('')
    },
    onError: (error) => {
      showErrorToast(error, 'Could not decline emergency request')
    },
  })

  const openDetail = (incidentId: string) => {
    navigate(`/emergency/broadcast/${encodeURIComponent(incidentId)}`, {
      state: { backPath: '/emergency/request' },
    })
  }

  const openDeploy = (incidentId: string) => {
    navigate(`/emergency/request/${encodeURIComponent(incidentId)}/deploy`)
  }

  const openDeclineDialog = (row: EmergencyBroadcastRow) => {
    setDeclineTarget({ id: row.id, requestId: row.requestId })
    setResponseNotes('')
  }

  const closeDeclineDialog = () => {
    if (declineMutation.isPending) return
    setDeclineTarget(null)
    setResponseNotes('')
  }

  const confirmDecline = () => {
    if (!declineTarget) return
    const notes = responseNotes.trim()
    if (!notes) {
      showErrorToast('Response notes are required.')
      return
    }
    declineMutation.mutate({ incidentId: declineTarget.id, notes })
  }

  const emptyMessage =
    crud.isResolved && !crud.canRead
      ? 'You do not have permission to view emergency requests.'
      : listQuery.isError
        ? 'Failed to load emergency requests.'
        : search.trim()
          ? 'No emergency requests match your search.'
          : 'No emergency requests found.'

  const renderRowActions = (row: EmergencyBroadcastRow) => {
    const canAct = canCancelOrCloseEmergencyIncident(row.status)
    return (
      <div className={cn(rowActionsContainerClassName, 'justify-center gap-2')}>
        <DetailRowActionButton
          type="button"
          tooltip={`View ${row.requestId}`}
          aria-label={`View ${row.requestId}`}
          onClick={() => openDetail(row.id)}
        />
        <DeployVehicleRowActionButton
          type="button"
          tooltip={`Deploy vehicle for ${row.requestId}`}
          aria-label={`Deploy vehicle for ${row.requestId}`}
          disabled={!canAct || declineMutation.isPending}
          onClick={() => openDeploy(row.id)}
        />
        <CancelRowActionButton
          type="button"
          tooltip="Decline emergency"
          aria-label={`Decline ${row.requestId}`}
          disabled={!canAct || declineMutation.isPending}
          onClick={() => openDeclineDialog(row)}
        />
      </div>
    )
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-[var(--fms-text-header)] sm:text-2xl">
          Emergency Request
        </h1>
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
              aria-label="Search emergency requests"
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
                    Vehicle Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
                    Start Date and Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
                    End Date and Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
                    Location
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
                      Loading emergency requests…
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
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-[#f0f0f2] px-2.5 py-1 text-xs font-medium text-[var(--fms-text-header)]">
                          {row.vehicleCategory}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">
                        {row.startDateLabel}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">
                        {row.endDateLabel}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">
                        {row.location}
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
              <ListPanelMessage>Loading emergency requests…</ListPanelMessage>
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
                  <MobileListField label="Vehicle Category">
                    <span className="inline-flex rounded-full bg-[#f0f0f2] px-2.5 py-1 text-xs font-medium text-[var(--fms-text-header)]">
                      {row.vehicleCategory}
                    </span>
                  </MobileListField>
                  <MobileListField label="Start Date and Time">
                    {row.startDateLabel}
                  </MobileListField>
                  <MobileListField label="End Date and Time">
                    {row.endDateLabel}
                  </MobileListField>
                  <MobileListField label="Location">{row.location}</MobileListField>
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
        open={declineTarget !== null}
        onOpenChange={(open) => !open && closeDeclineDialog()}
      >
        <DialogContent className="max-w-md">
          <DialogHeader className="items-center text-center">
            <div className="mb-2 rounded-full bg-[var(--fms-error-fill)] p-2.5">
              <AlertTriangle className="h-5 w-5 text-[var(--fms-delete)]" />
            </div>
            <DialogTitle>Decline Emergency</DialogTitle>
            <DialogDescription>
              {declineTarget
                ? `Decline ${declineTarget.requestId}? This notifies that your agency cannot respond.`
                : 'Decline this emergency request?'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="emergency-decline-notes">
              Response notes <span className="text-[var(--fms-delete)]">*</span>
            </Label>
            <textarea
              id="emergency-decline-notes"
              value={responseNotes}
              onChange={(event) => setResponseNotes(event.target.value)}
              placeholder="All vehicles currently on assignment"
              rows={4}
              className="min-h-[96px] w-full rounded-lg border border-[var(--fms-strokes)] bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <DialogFooter className="justify-center gap-2 sm:justify-center">
            <Button
              type="button"
              variant="outline"
              disabled={declineMutation.isPending}
              onClick={closeDeclineDialog}
            >
              Close
            </Button>
            <Button
              type="button"
              className="bg-[var(--fms-delete)] text-white hover:bg-[#c70009]"
              disabled={declineMutation.isPending}
              onClick={confirmDecline}
            >
              {declineMutation.isPending ? 'Declining…' : 'Confirm Decline'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

export default EmergencyRequest
