// Lists assigned vehicles with search and record actions.
import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  deleteDriverVehicleAssignment,
  fetchDriverVehicleAssignmentsPage,
} from '@/features/vehicles/lib/driver-vehicle-assignments-api'
import { apiGet } from '@/services/apiClient'
import { DeleteDialog } from '@/shared/components/DeleteDialog'
import {
  ListPanelMessage,
  MobileListCard,
  MobileListField,
} from '@/shared/components/MobileListCard'
import { PageHeader } from '@/shared/components/PageHeader'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'
import { TablePagination } from '@/shared/components/TablePagination'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import {
  DeleteRowActionButton,
  DetailRowActionButton,
  EditRowActionButton,
  rowActionsContainerClassName,
} from '@/shared/components/TableRowActionButtons'

type ApiRecord = Record<string, unknown>

function toText(value: unknown): string {
  return typeof value === 'string'
    ? value.trim()
    : typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : ''
}

async function fetchVehicleDetailById(vehicleId: string): Promise<string> {
  const payload = await apiGet<unknown>(`/vehicles/${encodeURIComponent(vehicleId)}`)
  const record =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? ((payload as ApiRecord).data &&
          typeof (payload as ApiRecord).data === 'object' &&
          !Array.isArray((payload as ApiRecord).data)
          ? ((payload as ApiRecord).data as ApiRecord)
          : (payload as ApiRecord))
      : {}
  const registration =
    toText(record.registration_number) || toText(record.vehicle_number) || toText(record.registrationNo)
  const makeModel =
    toText(record.makeModel) ||
    [toText(record.make), toText(record.model)].filter(Boolean).join(' ').trim() ||
    toText(record.model_name)
  
  if (registration && makeModel) return `${registration} (${makeModel})`
  return registration || makeModel || '—'
}

export function AssignVehiclePage() {
  const { vehicleId = '' } = useParams<{ vehicleId: string }>()
  const crud = useRouteCrudPermissions("/vehicle/list");
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null)
  const assignmentsQuery = useQuery({
    queryKey: ['driver-vehicle-assignments', 'list', vehicleId, query, page, pageSize],
    queryFn: () => fetchDriverVehicleAssignmentsPage(vehicleId, query, page, pageSize),
    enabled: crud.canRead && Boolean(vehicleId.trim()),
    staleTime: 30_000,
  })
  const rows = useMemo(() => assignmentsQuery.data?.rows ?? [], [assignmentsQuery.data?.rows])
  const vehicleIds = useMemo(
    () => Array.from(new Set(rows.map((row) => row.vehicleId).filter((id) => id && id !== '—'))),
    [rows],
  )
  const vehicleDetailQueries = useQueries({
    queries: vehicleIds.map((vehicleId) => ({
      queryKey: ['driver-vehicle-assignments', 'vehicle-detail', vehicleId],
      queryFn: () => fetchVehicleDetailById(vehicleId),
      enabled: crud.canRead,
      staleTime: 30_000,
    })),
  })
  const vehicleLabelById = useMemo(() => {
    const map = new Map<string, string>()
    vehicleIds.forEach((vehicleId, index) => {
      const data = vehicleDetailQueries[index]?.data
      if (data) map.set(vehicleId, data)
    })
    return map
  }, [vehicleIds, vehicleDetailQueries])

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDriverVehicleAssignment(id),
    onSuccess: async () => {
      showSuccessToast('Assignment deleted')
      await queryClient.invalidateQueries({ queryKey: ['driver-vehicle-assignments'] })
      setSelectedAssignmentId(null)
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to delete assignment')
    },
  })

  const askDelete = (id: string) => {
    if (!crud.canDelete) return
    setSelectedAssignmentId(id)
    setDeleteOpen(true)
  }

  const confirmDelete = () => {
    if (!crud.canDelete || selectedAssignmentId === null) return
    deleteMutation.mutate(selectedAssignmentId)
  }

  const totalCount = assignmentsQuery.data?.totalCount ?? rows.length
  const effectivePageSize = assignmentsQuery.data?.effectivePageSize ?? pageSize
  const totalPages =
    assignmentsQuery.data?.totalPages ?? Math.max(1, Math.ceil(totalCount / Math.max(1, effectivePageSize)))
  const serialBase = (page - 1) * effectivePageSize

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Assign Driver"
          subtitle="Manage driver records"
        />
        {crud.canCreate && vehicleId.trim() ? (
          <Button asChild className="w-full sm:w-auto">
            <Link to={`/vehicle/list/${encodeURIComponent(vehicleId)}/assign-driver`}>
              <Plus className="mr-1 h-4 w-4" />
              Assign New
            </Link>
          </Button>
        ) : null}
      </div>

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="space-y-4 p-0">
          <div className="flex justify-end">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--fms-text-subheading)]" />
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search by name or phone no."
                className="pl-9"
              />
            </div>
          </div>

          <div className="hidden w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
            <table className="w-max min-w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  <th className="w-16 px-4 py-3 text-left font-semibold">Sl.No</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Name & Phone no.
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    License Number
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Available Status
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Assigned Vehicle
                  </th>
                  <th className="px-4 py-3 text-center font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {crud.isResolved && !crud.canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      You do not have permission to view this data.
                    </td>
                  </tr>
                ) : (
                  <>
                    {assignmentsQuery.isLoading ? (
                      <tr className="border-t border-[var(--fms-strokes)]">
                        <td
                          colSpan={6}
                          className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                        >
                          Loading assignments...
                        </td>
                      </tr>
                    ) : assignmentsQuery.isError ? (
                      <tr className="border-t border-[var(--fms-strokes)]">
                        <td
                          colSpan={6}
                          className="px-4 py-6 text-center text-[var(--fms-delete)]"
                        >
                          Failed to load assignments.
                        </td>
                      </tr>
                    ) : rows.length === 0 ? (
                      <tr className="border-t border-[var(--fms-strokes)]">
                        <td
                          colSpan={6}
                          className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                        >
                          No assignments found.
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
                          <td className="px-4 py-3">
                            <p>{row.name}</p>
                            <p className="text-xs text-[var(--fms-text-subheading)]">
                              {row.contactNo || '—'}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p>{row.license}</p>
                          </td>
                          <td className="px-4 py-3 capitalize">
                            {row.availability_status || '—'}
                          </td>
                          <td className="px-4 py-3">
                            {vehicleLabelById.get(row.vehicleId) ||
                              row.assignedVehicle}
                          </td>

                          <td className="px-4 py-3">
                            <div className={rowActionsContainerClassName}>
                              <DetailRowActionButton
                                type="button"
                                disabled={!crud.canRead}
                                title="Detail"
                                aria-label="View assignment details"
                                onClick={() =>
                                  navigate(`/assign-driver/${encodeURIComponent(row.id)}`, {
                                    state: { vehicleId },
                                  })
                                }
                              />
                              <EditRowActionButton
                                type="button"
                                disabled={!crud.canUpdate}
                                title="Edit"
                                aria-label="Edit assignment"
                                onClick={() =>
                                  navigate(`/assign-driver/${encodeURIComponent(row.id)}/edit`, {
                                    state: { vehicleId },
                                  })
                                }
                              />
                              <DeleteRowActionButton
                                type="button"
                                disabled={!crud.canDelete || deleteMutation.isPending}
                                onClick={() => askDelete(row.id)}
                              />
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {crud.isResolved && !crud.canRead ? (
              <ListPanelMessage>
                You do not have permission to view this data.
              </ListPanelMessage>
            ) : assignmentsQuery.isLoading ? (
              <ListPanelMessage>Loading assignments…</ListPanelMessage>
            ) : assignmentsQuery.isError ? (
              <ListPanelMessage tone="error">
                Failed to load assignments.
              </ListPanelMessage>
            ) : rows.length === 0 ? (
              <ListPanelMessage>No assignments found.</ListPanelMessage>
            ) : (
              rows.map((row, index) => (
                <MobileListCard key={row.id}>
                  <MobileListField label="Sl.No">
                    {serialBase + index + 1}
                  </MobileListField>
                  <MobileListField label="Name">{row.name}</MobileListField>
                  <MobileListField label="Phone no.">
                    {row.contactNo || '—'}
                  </MobileListField>
                  <MobileListField label="License Number">
                    {row.license}
                  </MobileListField>
                  <MobileListField label="Available Status">
                    <span className="capitalize">
                      {row.availability_status || '—'}
                    </span>
                  </MobileListField>
                  <MobileListField label="Assigned Vehicle">
                    {vehicleLabelById.get(row.vehicleId) || row.assignedVehicle}
                  </MobileListField>
                  <div className={`mt-3 ${rowActionsContainerClassName}`}>
                    <DetailRowActionButton
                      type="button"
                      disabled={!crud.canRead}
                      title="Detail"
                      aria-label="View assignment details"
                      onClick={() =>
                        navigate(`/assign-driver/${encodeURIComponent(row.id)}`, {
                          state: { vehicleId },
                        })
                      }
                    />
                    <EditRowActionButton
                      type="button"
                      disabled={!crud.canUpdate}
                      title="Edit"
                      aria-label="Edit assignment"
                      onClick={() =>
                        navigate(`/assign-driver/${encodeURIComponent(row.id)}/edit`, {
                          state: { vehicleId },
                        })
                      }
                    />
                    <DeleteRowActionButton
                      type="button"
                      disabled={!crud.canDelete || deleteMutation.isPending}
                      onClick={() => askDelete(row.id)}
                    />
                  </div>
                </MobileListCard>
              ))
            )}
          </div>

          <TablePagination
            page={page}
            totalPages={totalPages}
            pageSize={effectivePageSize}
            totalCount={totalCount}
            onPageChange={(nextPage) =>
              setPage(Math.max(1, Math.min(nextPage, totalPages)))
            }
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize);
              setPage(1);
            }}
          />
        </CardContent>
      </Card>

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open)
          if (!open) setSelectedAssignmentId(null)
        }}
        onConfirm={confirmDelete}
        title="Delete Assignment"
        description="Are you sure you want to delete this driver vehicle assignment? This action cannot be undone."
      />
    </section>
  );
}
