import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

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
import { Label } from '@/components/ui/label'
import { canCancelTrip, tripStatusBadgeClass } from '@/features/trips/lib/trip-form-utils'
import { TripTableListToolbar } from '@/features/trips/components/TripTableListToolbar'
import { cancelTrip, fetchTripRequisitionsPage } from '@/features/trips/lib/trips-api'
import { PageHeader } from '@/shared/components/PageHeader'
import {
  ListPanelMessage,
  MobileListCard,
  MobileListField,
} from '@/shared/components/MobileListCard'
import { CancelRowActionButton, DetailRowActionButton, rowActionsContainerClassName } from '@/shared/components/TableRowActionButtons'
import { TablePagination } from '@/shared/components/TablePagination'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

const TABLE_COLUMN_COUNT = 7

type CancelTarget = {
  id: string
  tripType: string
}

function TripRequisition() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const crud = useRouteCrudPermissions('/trip/requisition')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null)
  const [cancellationReason, setCancellationReason] = useState('')

  const listQuery = useQuery({
    queryKey: ['trips', 'requisitions', search, page, pageSize],
    queryFn: () => fetchTripRequisitionsPage(search, page, pageSize),
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

  const openDetail = (row: (typeof rows)[number]) => {
    navigate(`/trip/requisition/${encodeURIComponent(row.id)}`, {
      state: { hasFeedback: row.hasFeedback },
    })
  }

  const cancelMutation = useMutation({
    mutationFn: async ({
      tripId,
      reason,
    }: {
      tripId: string
      reason: string
    }) => cancelTrip(tripId, reason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['trips'] })
      showSuccessToast('Trip cancelled successfully.')
      setCancelTarget(null)
      setCancellationReason('')
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to cancel trip')
    },
  })

  const openCancelDialog = (target: CancelTarget) => {
    setCancelTarget(target)
    setCancellationReason('')
  }

  const closeCancelDialog = () => {
    if (cancelMutation.isPending) return
    setCancelTarget(null)
    setCancellationReason('')
  }

  const confirmCancelTrip = () => {
    if (!cancelTarget) return
    const reason = cancellationReason.trim()
    if (!reason) {
      showErrorToast('Cancellation reason is required.')
      return
    }
    cancelMutation.mutate({ tripId: cancelTarget.id, reason })
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="My Trips"
          subtitle="View and manage all submitted trip requests."
        />
        {crud.canCreate ? (
          <Button asChild className="w-full sm:w-auto">
            <Link to="/trip/request/create">
              <Plus className="mr-1 h-4 w-4" />
              Request New Trip
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
            searchAriaLabel="Search my trips"
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
                    <td
                      colSpan={TABLE_COLUMN_COUNT}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      You do not have permission to view this data.
                    </td>
                  </tr>
                ) : listQuery.isLoading ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMN_COUNT}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      Loading trips…
                    </td>
                  </tr>
                ) : listQuery.isError ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMN_COUNT}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      {listQuery.error instanceof Error
                        ? listQuery.error.message
                        : 'Could not load trips.'}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMN_COUNT}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      {search.trim()
                        ? 'No trips match your search.'
                        : 'No trip requests found.'}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className="cursor-pointer border-t border-[var(--fms-strokes)] hover:bg-[#fafafa]"
                      onClick={() => openDetail(row)}
                    >
                      <td className="px-4 py-3">{row.serialNo}</td>
                      <td className="px-4 py-3 font-medium text-[var(--fms-text-header)]">
                        {row.referenceNo}
                      </td>
                      <td className="px-4 py-3">{row.tripType}</td>
                      <td className="px-4 py-3">{row.journeyDate}</td>
                      <td className="px-4 py-3">{row.route}</td>
                      <td className="px-4 py-3">
                        <Badge
                          className={tripStatusBadgeClass(
                            row.statusCode || row.status,
                          )}
                        >
                          {row.status}
                        </Badge>
                      </td>
                      <td
                        className="px-4 py-3 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className={rowActionsContainerClassName}>
                        <DetailRowActionButton
                          name={row.tripType}
                          tooltip="View trip details"
                          onClick={() => openDetail(row)}
                        />
                        {crud.canCancel ? (
                          <CancelRowActionButton
                            name={row.tripType}
                            tooltip={
                              canCancelTrip(row.statusCode || row.status)
                                ? 'Cancel trip'
                                : 'Cannot cancel after the driver has started the trip'
                            }
                            disabled={!canCancelTrip(row.statusCode || row.status)}
                            onClick={() =>
                              openCancelDialog({ id: row.id, tripType: row.tripType })
                            }
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
              <ListPanelMessage>You do not have permission to view this data.</ListPanelMessage>
            ) : listQuery.isLoading ? (
              <ListPanelMessage>Loading trips…</ListPanelMessage>
            ) : listQuery.isError ? (
              <ListPanelMessage tone="error">
                {listQuery.error instanceof Error
                  ? listQuery.error.message
                  : 'Could not load trips.'}
              </ListPanelMessage>
            ) : rows.length === 0 ? (
              <ListPanelMessage>
                {search.trim()
                  ? 'No trips match your search.'
                  : 'No trip requests found.'}
              </ListPanelMessage>
            ) : (
              rows.map((row) => (
                <MobileListCard key={row.id} onClick={() => openDetail(row)}>
                  <MobileListField label="Sl.No">{row.serialNo}</MobileListField>
                  <MobileListField label="Reference No.">{row.referenceNo}</MobileListField>
                  <MobileListField label="Trip">{row.tripType}</MobileListField>
                  <MobileListField label="Purpose">{row.purpose}</MobileListField>
                  <MobileListField label="Journey Start">{row.journeyDate}</MobileListField>
                  <MobileListField label="Route">{row.route}</MobileListField>
                  <p className="text-sm text-[var(--fms-text-subheading)]">
                    <span className="font-medium text-[var(--fms-text-header)]">Status:</span>{' '}
                    <Badge
                      className={tripStatusBadgeClass(row.statusCode || row.status)}
                    >
                      {row.status}
                    </Badge>
                  </p>
                  <div
                    className={`mt-3 ${rowActionsContainerClassName}`}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <DetailRowActionButton
                      name={row.tripType}
                      tooltip="View trip details"
                      onClick={() => openDetail(row)}
                    />
                    {crud.canCancel ? (
                      <CancelRowActionButton
                        name={row.tripType}
                        tooltip={
                          canCancelTrip(row.statusCode || row.status)
                            ? 'Cancel trip'
                            : 'Cannot cancel after the driver has started the trip'
                        }
                        disabled={!canCancelTrip(row.statusCode || row.status)}
                        onClick={() =>
                          openCancelDialog({ id: row.id, tripType: row.tripType })
                        }
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
        open={cancelTarget !== null}
        onOpenChange={(open) => !open && closeCancelDialog()}
      >
        <DialogContent className="max-w-md">
          <DialogHeader className="items-center text-center">
            <div className="mb-2 rounded-full bg-[var(--fms-error-fill)] p-2.5">
              <AlertTriangle className="h-5 w-5 text-[var(--fms-delete)]" />
            </div>
            <DialogTitle>Cancel Trip</DialogTitle>
            <DialogDescription>
              {cancelTarget
                ? `Are you sure you want to cancel the ${cancelTarget.tripType} trip? This action cannot be undone.`
                : 'Are you sure you want to cancel this trip?'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancellation-reason">
              Cancellation Reason <span className="text-[var(--fms-delete)]">*</span>
            </Label>
            <textarea
              id="cancellation-reason"
              value={cancellationReason}
              onChange={(event) => setCancellationReason(event.target.value)}
              placeholder="Provide a reason for cancelling this trip"
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
              onClick={confirmCancelTrip}
            >
              {cancelMutation.isPending ? 'Cancelling…' : 'Confirm Cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

export default TripRequisition
