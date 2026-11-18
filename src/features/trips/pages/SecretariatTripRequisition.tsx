import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

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
import { Label } from '@/components/ui/label'
import { TripStatusWithExtension } from '@/features/trips/components/TripStatusWithExtension'
import { TripTableListToolbar } from '@/features/trips/components/TripTableListToolbar'
import {
  cancelSecretariatRequisition,
  fetchSecretariatRequisitionsPage,
} from '@/features/trips/lib/secretariat-requisitions-api'
import {
  ListPanelMessage,
  MobileListCard,
  MobileListField,
} from '@/shared/components/MobileListCard'
import { PageHeader } from '@/shared/components/PageHeader'
import {
  CancelRowActionButton,
  DetailRowActionButton,
  ExtendTripRowActionButton,
  rowActionsContainerClassName,
} from '@/shared/components/TableRowActionButtons'
import { TablePagination } from '@/shared/components/TablePagination'
import { useUserStore } from '@/services/user-store'
import { useAccessControl } from '@/shared/hooks/useAccessControl'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { roleMatches, userHandlesDesignatedVehicles } from '@/shared/lib/designated-mto-access'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

const CANCELLABLE_STATUSES = new Set(['SUBMITTED', 'REJECTED', 'APPROVED', 'PLANNED'])

const TABLE_COLUMN_COUNT = 7
const LIST_PATH = '/secretariat-requisitions'

function requisitionStatusCode(status: string): string {
  return status.trim().toUpperCase().replace(/[\s-]+/g, '_')
}

export default function SecretariatTripRequisition() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const crud = useRouteCrudPermissions(LIST_PATH)
  const { role } = useAccessControl()
  const currentUser = useUserStore((state) => state.user)
  const canCreate = role === 'fms-mto'
  const isAgencyMto =
    roleMatches(role, 'fms-mto') && !userHandlesDesignatedVehicles(currentUser)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [cancelTarget, setCancelTarget] = useState<{ id: string; referenceNo: string } | null>(
    null,
  )
  const [cancellationReason, setCancellationReason] = useState('')

  const listQuery = useQuery({
    queryKey: ['secretariat-requisitions', search, page, pageSize],
    queryFn: () => fetchSecretariatRequisitionsPage(search, page, pageSize),
    enabled: !crud.isResolved || crud.canRead,
    staleTime: 30_000,
  })

  const rows = useMemo(() => listQuery.data?.rows ?? [], [listQuery.data?.rows])
  const totalCount = listQuery.data?.totalCount ?? rows.length
  const effectivePageSize = listQuery.data?.effectivePageSize ?? pageSize
  const totalPages =
    listQuery.data?.totalPages ??
    Math.max(1, Math.ceil(totalCount / Math.max(1, effectivePageSize)))

  useEffect(() => {
    setPage(1)
  }, [search, pageSize])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const openDetail = (id: string) => {
    navigate(`${LIST_PATH}/${encodeURIComponent(id)}`)
  }

  const canExtendRow = (status: string, extensionStatus: string) =>
    isAgencyMto &&
    requisitionStatusCode(status) === 'IN_PROGRESS' &&
    !extensionStatus.trim()

  const openExtension = (id: string) => {
    navigate(`${LIST_PATH}/${encodeURIComponent(id)}`, { state: { extendTrip: true } })
  }

  const canCancelRow = (status: string) =>
    isAgencyMto && CANCELLABLE_STATUSES.has(requisitionStatusCode(status))

  const cancelMutation = useMutation({
    mutationFn: ({ requisitionId, reason }: { requisitionId: string; reason: string }) =>
      cancelSecretariatRequisition(requisitionId, reason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['secretariat-requisitions'] })
      setCancelTarget(null)
      setCancellationReason('')
      showSuccessToast('Secretariat trip requisition cancelled.')
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to cancel secretariat trip requisition')
    },
  })

  const closeCancelDialog = () => {
    if (cancelMutation.isPending) return
    setCancelTarget(null)
    setCancellationReason('')
  }

  const confirmCancel = () => {
    if (!cancelTarget) return
    const reason = cancellationReason.trim()
    if (!reason) {
      showErrorToast('Cancellation reason is required.')
      return
    }
    cancelMutation.mutate({ requisitionId: cancelTarget.id, reason })
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Secretariat Trip Requisition"
          subtitle="Apply trip requisition for secretariat."
        />
        {canCreate ? (
          <Button asChild className="w-full sm:w-auto">
            <Link to={`${LIST_PATH}/create`}>
              <Plus className="mr-1 h-4 w-4" />
              Create Secretariat Trip Requisition
            </Link>
          </Button>
        ) : null}
      </div>

      <Card className="min-w-0 rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="min-w-0 space-y-4 p-0">
          <TripTableListToolbar
            search={search}
            onSearchChange={(next) => {
              setSearch(next)
              setPage(1)
            }}
            searchPlaceholder="Search trip type, purpose, route, status…"
            searchAriaLabel="Search secretariat trip requisitions"
          />

          <div className="hidden w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
            <table className="w-max min-w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Sl.No</th>
                  <th className="px-4 py-3 text-left font-semibold">Reference No.</th>
                  <th className="px-4 py-3 text-left font-semibold">Trip</th>
                  <th className="px-4 py-3 text-left font-semibold">Journey Start Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Route</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {crud.isResolved && !crud.canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td colSpan={TABLE_COLUMN_COUNT} className="px-4 py-6 text-center text-[var(--fms-text-subheading)]">
                      You do not have permission to view secretariat requisitions.
                    </td>
                  </tr>
                ) : listQuery.isLoading ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td colSpan={TABLE_COLUMN_COUNT} className="px-4 py-6 text-center text-[var(--fms-text-subheading)]">
                      Loading secretariat requisitions…
                    </td>
                  </tr>
                ) : listQuery.isError ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td colSpan={TABLE_COLUMN_COUNT} className="px-4 py-6 text-center text-[var(--fms-text-subheading)]">
                      {listQuery.error instanceof Error
                        ? listQuery.error.message
                        : 'Could not load secretariat requisitions.'}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td colSpan={TABLE_COLUMN_COUNT} className="px-4 py-6 text-center text-[var(--fms-text-subheading)]">
                      {search.trim()
                        ? 'No secretariat requisitions match your search.'
                        : 'No secretariat requisitions found.'}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className="cursor-pointer border-t border-[var(--fms-strokes)] hover:bg-[#fafafa]"
                      onClick={() => openDetail(row.id)}
                    >
                      <td className="px-4 py-3">{row.serialNo}</td>
                      <td className="px-4 py-3 font-medium text-[var(--fms-text-header)]">
                        {row.referenceNo}
                      </td>
                      <td className="px-4 py-3">{row.tripLabel}</td>
                      <td className="px-4 py-3">{row.journeyDate}</td>
                      <td className="px-4 py-3">{row.route}</td>
                      <td className="px-4 py-3">
                        <TripStatusWithExtension
                          status={row.status}
                          statusCode={row.statusCode}
                          extensionStatusLabel={row.extensionStatusLabel}
                        />
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(event) => event.stopPropagation()}>
                        <div className={rowActionsContainerClassName}>
                          <DetailRowActionButton
                            name={row.referenceNo}
                            tooltip="View requisition details"
                            onClick={() => openDetail(row.id)}
                          />
                          {canExtendRow(row.statusCode || row.status, row.extensionStatus) ? (
                            <ExtendTripRowActionButton
                              tooltip="Extend trip"
                              onClick={() => openExtension(row.id)}
                            />
                          ) : null}
                          {canCancelRow(row.statusCode || row.status) ? (
                            <CancelRowActionButton
                              name={row.referenceNo}
                              tooltip="Cancel requisition"
                              onClick={() => {
                                setCancellationReason('')
                                setCancelTarget({ id: row.id, referenceNo: row.referenceNo })
                              }}
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {crud.isResolved && !crud.canRead ? (
              <ListPanelMessage>You do not have permission to view secretariat requisitions.</ListPanelMessage>
            ) : listQuery.isLoading ? (
              <ListPanelMessage>Loading secretariat requisitions…</ListPanelMessage>
            ) : listQuery.isError ? (
              <ListPanelMessage tone="error">
                {listQuery.error instanceof Error
                  ? listQuery.error.message
                  : 'Could not load secretariat requisitions.'}
              </ListPanelMessage>
            ) : rows.length === 0 ? (
              <ListPanelMessage>
                {search.trim()
                  ? 'No secretariat requisitions match your search.'
                  : 'No secretariat requisitions found.'}
              </ListPanelMessage>
            ) : (
              rows.map((row) => (
                <MobileListCard key={row.id} onClick={() => openDetail(row.id)}>
                  <MobileListField label="Sl.No">{row.serialNo}</MobileListField>
                  <MobileListField label="Reference No.">{row.referenceNo}</MobileListField>
                  <MobileListField label="Trip">{row.tripLabel}</MobileListField>
                  <MobileListField label="Journey Start">{row.journeyDate}</MobileListField>
                  <MobileListField label="Route">{row.route}</MobileListField>
                  <MobileListField label="Status">
                    <TripStatusWithExtension
                      status={row.status}
                      statusCode={row.statusCode}
                      extensionStatusLabel={row.extensionStatusLabel}
                    />
                  </MobileListField>
                  <div
                    className={`mt-3 ${rowActionsContainerClassName}`}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <DetailRowActionButton
                      name={row.referenceNo}
                      tooltip="View requisition details"
                      onClick={() => openDetail(row.id)}
                    />
                    {canExtendRow(row.statusCode || row.status, row.extensionStatus) ? (
                      <ExtendTripRowActionButton
                        tooltip="Extend trip"
                        onClick={() => openExtension(row.id)}
                      />
                    ) : null}
                    {canCancelRow(row.statusCode || row.status) ? (
                      <CancelRowActionButton
                        name={row.referenceNo}
                        tooltip="Cancel requisition"
                        onClick={() => {
                          setCancellationReason('')
                          setCancelTarget({ id: row.id, referenceNo: row.referenceNo })
                        }}
                      />
                    ) : null}
                  </div>
                </MobileListCard>
              ))
            )}
          </div>

          <TablePagination
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={(nextPage) => setPage(Math.max(1, Math.min(nextPage, totalPages)))}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize)
              setPage(1)
            }}
          />
        </CardContent>
      </Card>

      <Dialog open={cancelTarget !== null} onOpenChange={(open) => !open && closeCancelDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader className="items-center text-center">
            <div className="mb-2 rounded-full bg-[var(--fms-error-fill)] p-2.5">
              <AlertTriangle className="h-5 w-5 text-[var(--fms-delete)]" />
            </div>
            <DialogTitle>Cancel Requisition</DialogTitle>
            <DialogDescription>
              {cancelTarget
                ? `Are you sure you want to cancel ${cancelTarget.referenceNo}? This action cannot be undone.`
                : 'Are you sure you want to cancel this requisition?'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="secretariat-cancellation-reason">
              Cancellation Reason <span className="text-[var(--fms-delete)]">*</span>
            </Label>
            <textarea
              id="secretariat-cancellation-reason"
              value={cancellationReason}
              onChange={(event) => setCancellationReason(event.target.value)}
              placeholder="Provide a reason for cancelling this requisition"
              disabled={cancelMutation.isPending}
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
              disabled={cancelMutation.isPending || !cancellationReason.trim()}
              onClick={confirmCancel}
            >
              {cancelMutation.isPending ? 'Cancelling…' : 'Confirm Cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
