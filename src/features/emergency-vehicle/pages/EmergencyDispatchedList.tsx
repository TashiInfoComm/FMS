import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { EmergencyBroadcastStatusCell } from '@/features/emergency-vehicle/components/EmergencyBroadcastStatusCell'
import type { EmergencyBroadcastRow } from '@/features/emergency-vehicle/lib/emergency-broadcast-types'
import { fetchEmergencyDispatchRequestsPage } from '@/features/emergency-vehicle/lib/emergency-incidents-api'
import { cn } from '@/lib/utils'
import {
    ListPanelMessage,
    MobileListCard,
    MobileListField,
} from '@/shared/components/MobileListCard'
import {
    DetailRowActionButton,
    rowActionsContainerClassName,
} from '@/shared/components/TableRowActionButtons'
import { TablePagination } from '@/shared/components/TablePagination'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'

const TABLE_COLUMN_COUNT = 7
const LIST_PATH = '/emergency/dispatched'

function EmergencyDispatchedList() {
    const navigate = useNavigate()
    const crud = useRouteCrudPermissions(LIST_PATH)
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)

    const listQuery = useQuery({
        queryKey: ['emergency', 'dispatch-requests', search, page, pageSize],
        queryFn: () => fetchEmergencyDispatchRequestsPage(search, page, pageSize),
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

    const openDetail = (incidentId: string) => {
        navigate(`/emergency/broadcast/${encodeURIComponent(incidentId)}`, {
            state: { backPath: LIST_PATH },
        })
    }

    const emptyMessage =
        crud.isResolved && !crud.canRead
            ? 'You do not have permission to view dispatched emergencies.'
            : listQuery.isError
                ? 'Failed to load dispatched emergencies.'
                : search.trim()
                    ? 'No dispatched emergencies match your search.'
                    : 'No dispatched emergencies found.'

    const renderRowActions = (row: EmergencyBroadcastRow) => (
        <div className={cn(rowActionsContainerClassName, 'justify-center gap-2')}>
            <DetailRowActionButton
                type="button"
                tooltip={`View ${row.requestId}`}
                aria-label={`View ${row.requestId}`}
                onClick={() => openDetail(row.id)}
            />
        </div>
    )

    return (
        <section className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-xl font-semibold text-[var(--fms-text-header)] sm:text-2xl">
                    Emergency Dispatched
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
                            aria-label="Search dispatched emergencies"
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
                                            Loading dispatched emergencies…
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
                            <ListPanelMessage>Loading dispatched emergencies…</ListPanelMessage>
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
        </section>
    )
}

export default EmergencyDispatchedList
