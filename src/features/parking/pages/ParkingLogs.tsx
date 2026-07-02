import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Car, CloudUpload, Eye, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogFooter,
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
import { ParkingLogStatusCell } from '@/features/parking/components/ParkingLogStatusCell'
import {
    canDeleteParkingLog,
    canEditParkingLog,
    canWithdrawParkingLog,
    createParkingLog,
    deleteParkingLog,
    fetchDriverParkingVehicles,
    fetchParkingLogsPage,
    updateParkingLog,
    withdrawParkingLog,
} from '@/features/parking/lib/parking-logs-api'
import {
    formatParkingAmount,
    formatParkingLogDate,
    getParkingLogAutoDateIso,
    type ParkingLogListRow,
} from '@/features/parking/lib/parking-logs-mock-data'
import { FuelTableListToolbar } from '@/features/fuel/components/FuelTableListToolbar'
import { formatFileSizeLabel } from '@/features/trips/lib/trip-form-utils'
import { cn } from '@/lib/utils'
import { useUserStore } from '@/services/user-store'
import {
    ListPanelMessage,
    MobileListCard,
    MobileListField,
} from '@/shared/components/MobileListCard'
import { TablePagination } from '@/shared/components/TablePagination'
import { DeleteDialog } from '@/shared/components/DeleteDialog'
import {
    CancelRowActionButton,
    DeleteRowActionButton,
    EditRowActionButton,
    rowActionsContainerClassName,
} from '@/shared/components/TableRowActionButtons'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

const TABLE_COLUMNS = ['Date', 'Vehicle', 'Location', 'Amount', 'Receipt', 'Status'] as const

type ParkingLogFormValues = {
    date: string
    vehicleId: string
    amount: string
    location: string
    receiptFile: File | null
    existingReceiptFileName: string
}

function emptyFormValues(): ParkingLogFormValues {
    return {
        date: getParkingLogAutoDateIso(),
        vehicleId: '',
        amount: '',
        location: '',
        receiptFile: null,
        existingReceiptFileName: '',
    }
}

function formValuesFromRow(row: ParkingLogListRow): ParkingLogFormValues {
    return {
        date: row.date,
        vehicleId: row.vehicleId ?? '',
        amount: String(row.amount),
        location: row.location,
        receiptFile: null,
        existingReceiptFileName: row.receiptFileName,
    }
}

function isFutureParkingLogDate(value: string): boolean {
    const trimmed = value.trim()
    if (!trimmed) return false
    return trimmed > getParkingLogAutoDateIso()
}

function AmountField({
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
            <Input
                id={id}
                type="number"
                min={0}
                step="0.01"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
            />
        </div>
    )
}

function ReceiptUploadField({
    file,
    existingFileName,
    onFileChange,
}: {
    file: File | null
    existingFileName?: string
    onFileChange: (file: File | null) => void
}) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const displayName = file?.name || existingFileName || ''

    return (
        <div className="space-y-2">
            <Label>Upload Receipt</Label>
            <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                className="sr-only"
                onChange={(event) => {
                    onFileChange(event.target.files?.[0] ?? null)
                }}
            />
            <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                    'flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--fms-strokes)] bg-[#fafafa] px-4 py-8 text-center transition-colors hover:bg-[#f3f4f6]',
                    displayName && 'border-[var(--fms-primary)] bg-[#f8fbff]',
                )}
            >
                <CloudUpload className="h-8 w-8 text-[var(--fms-text-subheading)]" />
                <span className="text-sm font-medium text-[var(--fms-text-header)]">
                    {displayName || 'Upload Receipt'}
                </span>
                <span className="text-xs text-[var(--fms-text-subheading)]">
                    {file
                        ? formatFileSizeLabel(file.size)
                        : existingFileName
                            ? 'Click to replace the current receipt'
                            : 'upload in JPG, PNG, PDF'}
                </span>
            </button>
        </div>
    )
}

function ViewReceiptButton({
    receiptUrl,
    disabled,
}: {
    receiptUrl?: string
    disabled?: boolean
}) {
    return (
        <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || !receiptUrl?.trim()}
            className="h-8 gap-1.5 border-[var(--fms-strokes)] text-[var(--fms-primary)]"
            onClick={() => {
                try {
                    const target = receiptUrl?.trim()
                    if (!target) {
                        throw new Error('Receipt URL is missing for this parking log.')
                    }
                    window.open(target, '_blank', 'noopener,noreferrer')
                } catch (error) {
                    showErrorToast(
                        error instanceof Error ? error.message : 'Could not open receipt.',
                    )
                }
            }}
        >
            <Eye className="h-3.5 w-3.5" />
            View
        </Button>
    )
}

export default function ParkingLogs() {
    const queryClient = useQueryClient()
    const crud = useRouteCrudPermissions('/parking/expense-log')
    const user = useUserStore((state) => state.user)
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [selectedDeleteId, setSelectedDeleteId] = useState<string | null>(null)
    const [withdrawOpen, setWithdrawOpen] = useState(false)
    const [selectedWithdrawId, setSelectedWithdrawId] = useState<string | null>(null)
    const [returnedRemarksOpen, setReturnedRemarksOpen] = useState(false)
    const [selectedReturnedRemarks, setSelectedReturnedRemarks] = useState('')
    const [form, setForm] = useState<ParkingLogFormValues>(() => emptyFormValues())
    const isEditing = editingId !== null

    const driverId = (() => {
        if (!user || typeof user !== 'object' || Array.isArray(user)) return ''
        const profile = user as Record<string, unknown>
        const rawId = profile.id ?? profile.user_id ?? profile.userId ?? profile.uuid
        return typeof rawId === 'string' ? rawId.trim() : ''
    })()

    const driverVehiclesQuery = useQuery({
        queryKey: ['parking-logs', 'driver-vehicles', driverId],
        queryFn: () => fetchDriverParkingVehicles(driverId),
        enabled: Boolean(driverId) && (!crud.isResolved || crud.canCreate || crud.canUpdate),
        staleTime: 60_000,
    })
    const vehicleOptions = driverVehiclesQuery.data ?? []

    const listQuery = useQuery({
        queryKey: ['parking-logs', search, page, pageSize],
        queryFn: () => fetchParkingLogsPage(search, page, pageSize),
        enabled: !crud.isResolved || crud.canRead,
        staleTime: 30_000,
    })

    const createMutation = useMutation({
        mutationFn: createParkingLog,
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['parking-logs'] })
            showSuccessToast('Parking expense logged successfully.')
            setDialogOpen(false)
            setEditingId(null)
            setForm(emptyFormValues())
            setPage(1)
        },
        onError: (error) => {
            showErrorToast(
                error instanceof Error ? error.message : 'Could not log parking expense.',
            )
        },
    })

    const updateMutation = useMutation({
        mutationFn: ({ logId, input }: { logId: string; input: Parameters<typeof updateParkingLog>[1] }) =>
            updateParkingLog(logId, input),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['parking-logs'] })
            showSuccessToast('Parking log updated successfully.')
            setDialogOpen(false)
            setEditingId(null)
            setForm(emptyFormValues())
        },
        onError: (error) => {
            showErrorToast(
                error instanceof Error ? error.message : 'Could not update parking log.',
            )
        },
    })

    const deleteMutation = useMutation({
        mutationFn: deleteParkingLog,
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['parking-logs'] })
            showSuccessToast('Parking log deleted successfully.')
            setSelectedDeleteId(null)
        },
        onError: (error) => {
            showErrorToast(
                error instanceof Error ? error.message : 'Could not delete parking log.',
            )
        },
    })

    const withdrawMutation = useMutation({
        mutationFn: withdrawParkingLog,
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['parking-logs'] })
            showSuccessToast('Parking log withdrawn successfully.')
            setSelectedWithdrawId(null)
        },
        onError: (error) => {
            showErrorToast(
                error instanceof Error ? error.message : 'Could not withdraw parking log.',
            )
        },
    })

    const isSaving = createMutation.isPending || updateMutation.isPending

    const rows = listQuery.data?.rows ?? []
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

    useEffect(() => {
        if (form.vehicleId || vehicleOptions.length === 0) return
        setForm((current) => ({ ...current, vehicleId: vehicleOptions[0]!.value }))
    }, [form.vehicleId, vehicleOptions])

    const parsedAmount = Number(form.amount)
    const expenseDate = form.date.trim()
    const hasValidDate =
        expenseDate.length > 0 && !isFutureParkingLogDate(expenseDate)
    const hasReceipt =
        form.receiptFile !== null || form.existingReceiptFileName.trim().length > 0
    const hasVehicle = form.vehicleId.trim().length > 0
    const canSubmit =
        hasValidDate &&
        hasVehicle &&
        form.location.trim().length > 0 &&
        Number.isFinite(parsedAmount) &&
        parsedAmount > 0 &&
        hasReceipt &&
        !isSaving

    const onOpenCreate = () => {
        setEditingId(null)
        setForm(emptyFormValues())
        setDialogOpen(true)
    }

    const onOpenEdit = (row: ParkingLogListRow) => {
        setEditingId(row.id)
        setForm(formValuesFromRow(row))
        setDialogOpen(true)
    }

    const onAskDelete = (row: ParkingLogListRow) => {
        setSelectedDeleteId(row.id)
        setDeleteOpen(true)
    }

    const onConfirmDelete = () => {
        if (!selectedDeleteId) return
        deleteMutation.mutate(selectedDeleteId)
    }

    const onAskWithdraw = (row: ParkingLogListRow) => {
        setSelectedWithdrawId(row.id)
        setWithdrawOpen(true)
    }

    const onConfirmWithdraw = () => {
        if (!selectedWithdrawId) return
        withdrawMutation.mutate(selectedWithdrawId)
    }

    const onOpenReturnedRemarks = (row: ParkingLogListRow) => {
        if (row.status !== 'RETURNED') return
        setSelectedReturnedRemarks(row.returnedRemarks?.trim() || 'No remarks available.')
        setReturnedRemarksOpen(true)
    }

    const closeDialog = () => {
        setDialogOpen(false)
        setEditingId(null)
        setForm(emptyFormValues())
    }

    const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!canSubmit) return

        if (!expenseDate) {
            showErrorToast('Please select a date.')
            return
        }

        if (isFutureParkingLogDate(form.date)) {
            showErrorToast('Parking log date cannot be in the future.')
            return
        }
        const vehicleId = form.vehicleId.trim()
        if (!vehicleId) {
            showErrorToast('Please select a vehicle.')
            return
        }

        if (isEditing && editingId) {
            updateMutation.mutate({
                logId: editingId,
                input: {
                    expenseDate,
                    vehicleId,
                    location: form.location,
                    amount: parsedAmount,
                    receiptFile: form.receiptFile,
                },
            })
            return
        }

        if (!form.receiptFile) return

        createMutation.mutate({
            expenseDate,
            vehicleId,
            location: form.location,
            amount: parsedAmount,
            receiptFile: form.receiptFile,
        })
    }

    return (
        <section className="space-y-5">
            <Card className="min-w-0 rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
                <CardContent className="min-w-0 space-y-4 p-0">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <h1 className="text-xl font-semibold text-[var(--fms-text-header)] sm:text-2xl">
                            My Parking Logs
                        </h1>
                        {crud.canCreate ? (
                            <Button
                                type="button"
                                onClick={onOpenCreate}
                                className="w-full bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)] sm:w-auto"
                            >
                                <Plus className="mr-1 h-4 w-4" />
                                Add New
                            </Button>
                        ) : null}
                    </div>

                    <FuelTableListToolbar
                        search={search}
                        onSearchChange={(next) => {
                            setSearch(next)
                            setPage(1)
                        }}
                        searchPlaceholder="Search logs"
                        searchAriaLabel="Search parking logs"
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
                                            You do not have permission to view parking logs.
                                        </td>
                                    </tr>
                                ) : listQuery.isLoading ? (
                                    <tr className="border-t border-[var(--fms-strokes)]">
                                        <td
                                            colSpan={TABLE_COLUMNS.length + 1}
                                            className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                                        >
                                            Loading parking logs…
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
                                                : 'Could not load parking logs.'}
                                        </td>
                                    </tr>
                                ) : rows.length === 0 ? (
                                    <tr className="border-t border-[var(--fms-strokes)]">
                                        <td
                                            colSpan={TABLE_COLUMNS.length + 1}
                                            className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                                        >
                                            {search.trim()
                                                ? 'No parking logs match your search.'
                                                : 'No parking logs found.'}
                                        </td>
                                    </tr>
                                ) : (
                                    rows.map((row) => (
                                        <tr
                                            key={row.id}
                                            className="border-t border-[var(--fms-strokes)]"
                                        >
                                            <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                                                {formatParkingLogDate(row.date)}
                                            </td>
                                            <td className="px-4 py-3 text-[var(--fms-text-header)]">
                                                {row.vehicleRegistrationNumber || '—'}
                                            </td>
                                            <td className="px-4 py-3 text-[var(--fms-text-header)]">
                                                {row.location}
                                            </td>
                                            <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                                                {formatParkingAmount(row.amount)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <ViewReceiptButton receiptUrl={row.receiptUrl} />
                                            </td>
                                            <td className="px-4 py-3">
                                                {row.status === 'RETURNED' ? (
                                                    <button
                                                        type="button"
                                                        className="inline-flex cursor-pointer items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                                        onClick={() => onOpenReturnedRemarks(row)}
                                                        title="View return remarks"
                                                    >
                                                        <ParkingLogStatusCell status={row.status} />
                                                    </button>
                                                ) : (
                                                    <ParkingLogStatusCell status={row.status} />
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className={rowActionsContainerClassName}>
                                                    <EditRowActionButton
                                                        type="button"
                                                        tooltip="Edit parking log"
                                                        disabled={
                                                            !crud.canUpdate ||
                                                            !canEditParkingLog(row.status) ||
                                                            isSaving
                                                        }
                                                        onClick={() => onOpenEdit(row)}
                                                    />
                                                    <DeleteRowActionButton
                                                        type="button"
                                                        tooltip="Delete parking log"
                                                        disabled={
                                                            !crud.canDelete ||
                                                            !canDeleteParkingLog(row.status) ||
                                                            deleteMutation.isPending
                                                        }
                                                        onClick={() => onAskDelete(row)}
                                                    />
                                                    <CancelRowActionButton
                                                        type="button"
                                                        tooltip="Withdraw parking log"
                                                        disabled={
                                                            !crud.canUpdate ||
                                                            !canWithdrawParkingLog(row.status) ||
                                                            withdrawMutation.isPending
                                                        }
                                                        onClick={() => onAskWithdraw(row)}
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
                                You do not have permission to view parking logs.
                            </ListPanelMessage>
                        ) : listQuery.isLoading ? (
                            <ListPanelMessage>Loading parking logs…</ListPanelMessage>
                        ) : listQuery.isError ? (
                            <ListPanelMessage tone="error">
                                {listQuery.error instanceof Error
                                    ? listQuery.error.message
                                    : 'Could not load parking logs.'}
                            </ListPanelMessage>
                        ) : rows.length === 0 ? (
                            <ListPanelMessage>
                                {search.trim()
                                    ? 'No parking logs match your search.'
                                    : 'No parking logs found.'}
                            </ListPanelMessage>
                        ) : (
                            rows.map((row) => (
                                <MobileListCard key={row.id}>
                                    <MobileListField label="Date">
                                        {formatParkingLogDate(row.date)}
                                    </MobileListField>
                                    <MobileListField label="Vehicle">
                                        {row.vehicleRegistrationNumber || '—'}
                                    </MobileListField>
                                    <MobileListField label="Location">{row.location}</MobileListField>
                                    <MobileListField label="Amount">
                                        {formatParkingAmount(row.amount)}
                                    </MobileListField>
                                    <MobileListField label="Receipt">
                                        <ViewReceiptButton receiptUrl={row.receiptUrl} />
                                    </MobileListField>
                                    <p className="text-sm text-[var(--fms-text-subheading)]">
                                        <span className="font-medium text-[var(--fms-text-header)]">
                                            Status:
                                        </span>{' '}
                                        {row.status === 'RETURNED' ? (
                                            <button
                                                type="button"
                                                className="inline-flex cursor-pointer items-center rounded-md align-middle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                                onClick={() => onOpenReturnedRemarks(row)}
                                                title="View return remarks"
                                            >
                                                <ParkingLogStatusCell status={row.status} />
                                            </button>
                                        ) : (
                                            <ParkingLogStatusCell status={row.status} />
                                        )}
                                    </p>
                                    <div className={`mt-3 ${rowActionsContainerClassName}`}>
                                        <EditRowActionButton
                                            type="button"
                                            disabled={
                                                !crud.canUpdate ||
                                                !canEditParkingLog(row.status) ||
                                                isSaving
                                            }
                                            onClick={() => onOpenEdit(row)}
                                        />
                                        <DeleteRowActionButton
                                            type="button"
                                            disabled={
                                                !crud.canDelete ||
                                                !canDeleteParkingLog(row.status) ||
                                                deleteMutation.isPending
                                            }
                                            onClick={() => onAskDelete(row)}
                                        />
                                        <CancelRowActionButton
                                            type="button"
                                            tooltip="Withdraw"
                                            disabled={
                                                !crud.canUpdate ||
                                                !canWithdrawParkingLog(row.status) ||
                                                withdrawMutation.isPending
                                            }
                                            onClick={() => onAskWithdraw(row)}
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
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Car className="h-5 w-5 text-[var(--fms-primary)]" />
                            {isEditing ? 'Edit Parking Expense' : 'Log Parking Expense'}
                        </DialogTitle>
                    </DialogHeader>

                    <form className="space-y-4" onSubmit={onSubmit} noValidate>
                        <div className="space-y-2">
                            <Label htmlFor="parking-log-date">Date</Label>
                            <Input
                                id="parking-log-date"
                                type="date"
                                value={form.date}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        date: event.target.value,
                                    }))
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="parking-log-vehicle">Vehicle</Label>
                            <Select
                                value={form.vehicleId}
                                onValueChange={(value) =>
                                    setForm((current) => ({ ...current, vehicleId: value }))
                                }
                            >
                                <SelectTrigger id="parking-log-vehicle">
                                    <SelectValue placeholder="Select a vehicle" />
                                </SelectTrigger>
                                <SelectContent>
                                    {vehicleOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {driverVehiclesQuery.isLoading ? (
                                <p className="text-xs text-[var(--fms-text-subheading)]">
                                    Loading your vehicles...
                                </p>
                            ) : driverVehiclesQuery.isError ? (
                                <p className="text-xs text-[var(--fms-delete)]">
                                    Could not load your vehicle list.
                                </p>
                            ) : null}
                        </div>

                        <AmountField
                            id="parking-log-amount"
                            label="Fee Amount"
                            value={form.amount}
                            placeholder="Enter Amount"
                            onChange={(value) =>
                                setForm((current) => ({ ...current, amount: value }))
                            }
                        />

                        <div className="space-y-2">
                            <Label htmlFor="parking-log-location">Location</Label>
                            <Input
                                id="parking-log-location"
                                value={form.location}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        location: event.target.value,
                                    }))
                                }
                                placeholder="Enter parking location"
                            />
                        </div>

                        <ReceiptUploadField
                            file={form.receiptFile}
                            existingFileName={form.existingReceiptFileName}
                            onFileChange={(file) =>
                                setForm((current) => ({ ...current, receiptFile: file }))
                            }
                        />

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={closeDialog}>
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={!canSubmit}
                                className="bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)]"
                            >
                                {isSaving ? 'Saving…' : isEditing ? 'Update' : 'Submit'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <DeleteDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                onConfirm={onConfirmDelete}
                title="Delete Parking Log"
                description="Are you sure you want to delete this parking log pending consolidation? This action cannot be undone."
            />

            <DeleteDialog
                open={withdrawOpen}
                onOpenChange={setWithdrawOpen}
                onConfirm={onConfirmWithdraw}
                title="Withdraw Parking Log"
                description="Are you sure you want to withdraw this parking log? This action cannot be undone."
                confirmLabel="Withdraw"
            />

            <Dialog open={returnedRemarksOpen} onOpenChange={setReturnedRemarksOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Returned Remarks</DialogTitle>
                    </DialogHeader>
                    <div className="rounded-lg border border-[var(--fms-strokes)] bg-[#f8f8f9] px-3 py-2.5 text-sm text-[var(--fms-text-header)]">
                        {selectedReturnedRemarks}
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setReturnedRemarksOpen(false)}
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    )
}
