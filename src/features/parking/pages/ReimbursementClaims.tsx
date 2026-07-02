import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Card, CardContent } from '@/components/ui/card'
import { FuelTableListToolbar } from '@/features/fuel/components/FuelTableListToolbar'
import {
    formatParkingClaimStatusLabel,
    ParkingClaimStatusCell,
} from '@/features/parking/components/ParkingClaimStatusCell'
import {
    fetchParkingClaims,
} from '@/features/parking/lib/parking-logs-api'
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
import { useAccessControl } from '@/shared/hooks/useAccessControl'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'

const BASE_CLAIM_COLUMNS = ['Reference No.', 'Month & Year', 'Amount', 'Status'] as const

function formatCurrency(amount: number): string {
    return `Nu. ${amount.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    })}`
}

export default function ReimbursementClaims() {
    const navigate = useNavigate()
    const crud = useRouteCrudPermissions('/parking/reimbursement-claims')
    const { role } = useAccessControl()
    const showDriverColumn = role !== 'fms-driver'
    const claimColumns = showDriverColumn
        ? (['Reference No.', 'Month', 'Driver', 'Amount', 'Status'] as const)
        : BASE_CLAIM_COLUMNS
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)

    const logsQuery = useQuery({
        queryKey: ['parking-reimbursement-claims-source'],
        queryFn: fetchParkingClaims,
        enabled: !crud.isResolved || crud.canRead,
        staleTime: 30_000,
    })

    const monthlyClaims = useMemo(() => logsQuery.data ?? [], [logsQuery.data])

    const filteredClaims = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return monthlyClaims
        return monthlyClaims.filter((claim) => {
            const statusLabel = formatParkingClaimStatusLabel(claim.status).toLowerCase()
            const driverName = claim.driverName?.toLowerCase() ?? ''
            return (
                claim.referenceNo.toLowerCase().includes(q) ||
                claim.monthLabel.toLowerCase().includes(q) ||
                statusLabel.includes(q) ||
                driverName.includes(q)
            )
        })
    }, [monthlyClaims, search])

    const totalCount = filteredClaims.length
    const totalPages = Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize)))
    const pageStart = Math.max(0, (page - 1) * pageSize)
    const pageRows = filteredClaims.slice(pageStart, pageStart + pageSize)

    useEffect(() => {
        setPage(1)
    }, [search, pageSize])

    useEffect(() => {
        if (page > totalPages) setPage(totalPages)
    }, [page, totalPages])

    return (
        <section className="space-y-5">
            <Card className="min-w-0 rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
                <CardContent className="min-w-0 space-y-4 p-0">
                    <div className="flex items-center justify-between">
                        <h1 className="text-xl font-semibold text-[var(--fms-text-header)] sm:text-2xl">
                            Reimbursement Claims
                        </h1>
                    </div>

                    <FuelTableListToolbar
                        search={search}
                        onSearchChange={(value) => {
                            setSearch(value)
                            setPage(1)
                        }}
                        searchPlaceholder="Search claims"
                        searchAriaLabel="Search reimbursement claims"
                    />

                    <div className="hidden w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
                        <table className="w-max min-w-full text-sm">
                            <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                                <tr>
                                    {claimColumns.map((column) => (
                                        <th key={column} className="px-4 py-3 text-left font-semibold">
                                            {column}
                                        </th>
                                    ))}
                                    <th className="px-4 py-3 text-center font-semibold">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {crud.isResolved && !crud.canRead ? (
                                    <tr className="border-t border-[var(--fms-strokes)]">
                                        <td
                                            colSpan={claimColumns.length}
                                            className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                                        >
                                            You do not have permission to view reimbursement claims.
                                        </td>
                                    </tr>
                                ) : logsQuery.isLoading ? (
                                    <tr className="border-t border-[var(--fms-strokes)]">
                                        <td
                                            colSpan={claimColumns.length}
                                            className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                                        >
                                            Loading reimbursement claims...
                                        </td>
                                    </tr>
                                ) : logsQuery.isError ? (
                                    <tr className="border-t border-[var(--fms-strokes)]">
                                        <td
                                            colSpan={claimColumns.length}
                                            className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                                        >
                                            {logsQuery.error instanceof Error
                                                ? logsQuery.error.message
                                                : 'Could not load reimbursement claims.'}
                                        </td>
                                    </tr>
                                ) : pageRows.length === 0 ? (
                                    <tr className="border-t border-[var(--fms-strokes)]">
                                        <td
                                            colSpan={claimColumns.length}
                                            className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                                        >
                                            {search.trim()
                                                ? 'No reimbursement claims match your search.'
                                                : 'No reimbursement claims found.'}
                                        </td>
                                    </tr>
                                ) : (
                                    pageRows.map((row) => (
                                        <tr key={row.id} className="border-t border-[var(--fms-strokes)]">
                                            <td className="px-4 py-3 font-medium text-[var(--fms-text-header)]">
                                                {row.referenceNo}
                                            </td>
                                            <td className="px-4 py-3 text-[var(--fms-text-header)]">{row.monthLabel}</td>
                                            {showDriverColumn ? (
                                                <td className="px-4 py-3 text-[var(--fms-text-header)]">
                                                    {row.driverName || '—'}
                                                </td>
                                            ) : null}
                                            <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                                                {formatCurrency(row.amount)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <ParkingClaimStatusCell status={row.status} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className={rowActionsContainerClassName}>
                                                    <DetailRowActionButton
                                                        type="button"
                                                        tooltip="View daily parking logs"
                                                        onClick={() =>
                                                            navigate(
                                                                `/parking/reimbursement-claims/${encodeURIComponent(row.id)}`,
                                                            )
                                                        }
                                                    />
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
                            <ListPanelMessage>
                                You do not have permission to view reimbursement claims.
                            </ListPanelMessage>
                        ) : logsQuery.isLoading ? (
                            <ListPanelMessage>Loading reimbursement claims...</ListPanelMessage>
                        ) : logsQuery.isError ? (
                            <ListPanelMessage tone="error">
                                {logsQuery.error instanceof Error
                                    ? logsQuery.error.message
                                    : 'Could not load reimbursement claims.'}
                            </ListPanelMessage>
                        ) : pageRows.length === 0 ? (
                            <ListPanelMessage>
                                {search.trim()
                                    ? 'No reimbursement claims match your search.'
                                    : 'No reimbursement claims found.'}
                            </ListPanelMessage>
                        ) : (
                            pageRows.map((row) => (
                                <MobileListCard key={row.id}>
                                    <MobileListField label="Reference No.">{row.referenceNo}</MobileListField>
                                    <MobileListField label="Month">{row.monthLabel}</MobileListField>
                                    {showDriverColumn ? (
                                        <MobileListField label="Driver">{row.driverName || '—'}</MobileListField>
                                    ) : null}
                                    <MobileListField label="Amount">{formatCurrency(row.amount)}</MobileListField>
                                    <MobileListField label="Status">
                                        <ParkingClaimStatusCell status={row.status} />
                                    </MobileListField>
                                    <div className={`mt-3 ${rowActionsContainerClassName}`}>
                                        <DetailRowActionButton
                                            type="button"
                                            tooltip="View daily parking logs"
                                            onClick={() =>
                                                navigate(
                                                    `/parking/reimbursement-claims/${encodeURIComponent(row.id)}`,
                                                )
                                            }
                                        />
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
        </section>
    )
}