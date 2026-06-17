import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FuelTableListToolbar } from '@/features/fuel/components/FuelTableListToolbar'
import {
  formatNuDisplay,
  type QuotaRequestStatus,
} from '@/features/fuel/lib/quota-request-mock-data'
import {
  fetchQuotaRequestsPage,
  topUpQuotaRequest,
  type QuotaRequestListRow,
} from '@/features/fuel/lib/quota-requests-api'
import { PageHeader } from '@/shared/components/PageHeader'
import {
  ListPanelMessage,
  MobileListCard,
  MobileListField,
} from '@/shared/components/MobileListCard'
import { TablePagination } from '@/shared/components/TablePagination'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

const TABLE_COLUMNS = [
  'Sl.No',
  'Driver',
  'Vehicle',
  'Current Quota',
  'Finance Approved Amount',
  'Status',
] as const

function UpdateQuotaStatusCell({ status }: { status: QuotaRequestStatus }) {
  if (status === 'APPROVED') {
    return (
      <span className="rounded-full bg-[#ddf2ff] px-2 py-1 text-xs font-semibold text-[#0a72a5]">
        APPROVED
      </span>
    )
  }
  if (status === 'COMPLETED') {
    return (
      <span className="rounded-full bg-[#d1fae5] px-2 py-1 text-xs font-semibold text-[#0f8e5c]">
        COMPLETED
      </span>
    )
  }
  if (status === 'TOPPED_UP') {
    return (
      <span className="rounded-full bg-[#d1fae5] px-2 py-1 text-xs font-semibold text-[#047857]">
        TOPPED UP
      </span>
    )
  }
  if (status === 'FORWARDED') {
    return (
      <span className="rounded-full px-2 py-1 text-xs text-[#6b46c1]">
        FORWARDED
      </span>
    )
  }
  if (status === 'PENDING') {
    return (
      <span className="rounded-full px-2 py-1 text-xs text-[#0a72a5]">
        PENDING
      </span>
    )
  }
  return (
    <span className="rounded-full px-2 py-1 text-xs text-[var(--fms-text-subheading)]">
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function isCompletedStatus(status: QuotaRequestStatus): boolean {
  return status === 'COMPLETED'
}

function isUpdateQuotaStatus(status: QuotaRequestStatus): boolean {
  return status === 'APPROVED'
}

export default function UpdateQuota() {
  const queryClient = useQueryClient()
  const crud = useRouteCrudPermissions('/fuel/update-quota')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null)

  const listQuery = useQuery({
    queryKey: ['fuel-quota-requests', 'update-quota', search, page, pageSize],
    queryFn: () => fetchQuotaRequestsPage(search, 'all', page, pageSize),
    enabled: !crud.isResolved || crud.canRead,
    staleTime: 30_000,
  })

  const topUpMutation = useMutation({
    mutationFn: ({
      requestId,
      mode,
    }: {
      requestId: string
      mode: 'update' | 'topup'
    }) => topUpQuotaRequest(requestId).then(() => mode),
    onSuccess: (mode) => {
      showSuccessToast(
        mode === 'topup' ? 'Quota topped up successfully' : 'Quota updated successfully',
      )
      void queryClient.invalidateQueries({ queryKey: ['fuel-quota-requests'] })
      setPendingRequestId(null)
    },
    onError: (error) => {
      showErrorToast(
        error instanceof Error ? error.message : 'Could not update quota.',
      )
      setPendingRequestId(null)
    },
  })

  const rows = useMemo(() => listQuery.data?.rows ?? [], [listQuery.data?.rows])
  const totalCount = listQuery.data?.totalCount ?? rows.length
  const effectivePageSize = listQuery.data?.effectivePageSize ?? pageSize
  const totalPages =
    listQuery.data?.totalPages ??
    Math.max(1, Math.ceil(totalCount / Math.max(1, effectivePageSize)))
  const serialBase = listQuery.data?.serialBase ?? (page - 1) * pageSize

  useEffect(() => {
    setPage(1)
  }, [search, pageSize])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const handleTopUp = (row: QuotaRequestListRow, mode: 'update' | 'topup') => {
    setPendingRequestId(row.id)
    topUpMutation.mutate({ requestId: row.id, mode })
  }

  const renderRowAction = (row: QuotaRequestListRow) => {
    const isPending = pendingRequestId === row.id && topUpMutation.isPending

    if (isCompletedStatus(row.status)) {
      return (
        <Button
          type="button"
          size="sm"
          className="rounded-full bg-[var(--fms-button)] px-4 hover:bg-[var(--fms-button-hover)]"
          disabled={(!crud.canUpdate && crud.isResolved) || isPending}
          onClick={() => handleTopUp(row, 'topup')}
        >
          {isPending ? 'Topping up…' : 'TopUp'}
        </Button>
      )
    }
    if (isUpdateQuotaStatus(row.status)) {
      return (
        <Button
          type="button"
          size="sm"
          className="rounded-full bg-[var(--fms-button)] px-4 hover:bg-[var(--fms-button-hover)]"
          disabled={(!crud.canUpdate && crud.isResolved) || isPending}
          onClick={() => handleTopUp(row, 'update')}
        >
          {isPending ? 'Updating…' : 'Update Quota'}
        </Button>
      )
    }
    return <span className="text-[var(--fms-text-subheading)]">—</span>
  }

  return (
    <section className="space-y-5">
      <PageHeader title="Quota Update" />

      <Card className="min-w-0 rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="min-w-0 space-y-4 p-0">
          <div className="space-y-1 px-1 sm:px-0">
            <h2 className="text-lg font-semibold text-[var(--fms-text-header)]">
              Quota Update Pending List
            </h2>
            <p className="text-sm text-[var(--fms-text-subheading)]">
              List of Finance-approved fuel quota requests waiting for MTO quota
              update.
            </p>
          </div>

          <FuelTableListToolbar
            search={search}
            onSearchChange={(next) => {
              setSearch(next)
              setPage(1)
            }}
            searchPlaceholder="Search request ID, driver, vehicle…"
            searchAriaLabel="Search quota updates"
          />

          <div className="hidden w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
            <table className="w-max min-w-full text-sm">
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
                ) : listQuery.isLoading ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMNS.length + 1}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      Loading quota requests…
                    </td>
                  </tr>
                ) : listQuery.isError ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMNS.length + 1}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      {listQuery.error instanceof Error
                        ? listQuery.error.message
                        : 'Could not load quota requests.'}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMNS.length + 1}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      {search.trim()
                        ? 'No quota requests match your search.'
                        : 'No quota requests found.'}
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
                        {row.driverName}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">
                        {row.vehicle}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {`${formatNuDisplay(row.balanceAtRequest)} / ${formatNuDisplay(row.recommendedAmount)}`}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#0a72a5]">
                        {formatNuDisplay(row.financeApprovedAmount ?? 0)}
                      </td>
                      <td className="px-4 py-3">
                        <UpdateQuotaStatusCell status={row.status} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {renderRowAction(row)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {crud.isResolved && !crud.canRead ? (
              <ListPanelMessage>
                You do not have permission to view quota updates.
              </ListPanelMessage>
            ) : listQuery.isLoading ? (
              <ListPanelMessage>Loading quota requests…</ListPanelMessage>
            ) : listQuery.isError ? (
              <ListPanelMessage tone="error">
                {listQuery.error instanceof Error
                  ? listQuery.error.message
                  : 'Could not load quota requests.'}
              </ListPanelMessage>
            ) : rows.length === 0 ? (
              <ListPanelMessage>
                {search.trim()
                  ? 'No quota requests match your search.'
                  : 'No quota requests found.'}
              </ListPanelMessage>
            ) : (
              rows.map((row, index) => (
                <MobileListCard key={row.id}>
                  <MobileListField label="Sl.No">{serialBase + index + 1}</MobileListField>
                  <MobileListField label="Request ID">{row.id}</MobileListField>
                  <MobileListField label="Driver">{row.driverName}</MobileListField>
                  <MobileListField label="Vehicle">{row.vehicle}</MobileListField>
                  <MobileListField label="Current Quota">
                    {`${formatNuDisplay(row.balanceAtRequest)} / ${formatNuDisplay(row.recommendedAmount)}`}
                  </MobileListField>
                  <MobileListField label="Finance Approved Amount">
                    <span className="font-semibold text-[#0a72a5]">
                      {formatNuDisplay(row.financeApprovedAmount ?? 0)}
                    </span>
                  </MobileListField>
                  <p className="text-sm text-[var(--fms-text-subheading)]">
                    <span className="font-medium text-[var(--fms-text-header)]">Status:</span>{' '}
                    <UpdateQuotaStatusCell status={row.status} />
                  </p>
                  <div className="mt-3">{renderRowAction(row)}</div>
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
    </section>
  )
}
