import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AssignDesignatedVehicleDialog } from '@/features/designated-vehicle/components/AssignDesignatedVehicleDialog'
import { DesignatedVehicleStatusCell } from '@/features/designated-vehicle/components/DesignatedVehicleStatusCell'
import {
  deleteDesignatedOfficial,
  fetchDesignatedVehiclesPage,
} from '@/features/designated-vehicle/lib/designated-vehicle-api'
import type { DesignatedVehicleListRow } from '@/features/designated-vehicle/lib/designated-vehicle-types'
import { FuelTableListToolbar } from '@/features/fuel/components/FuelTableListToolbar'
import {
  ListPanelMessage,
  MobileListCard,
  MobileListField,
} from '@/shared/components/MobileListCard'
import { DeleteDialog } from '@/shared/components/DeleteDialog'
import {
  DeleteRowActionButton,
  DetailRowActionButton,
  EditRowActionButton,
  rowActionsContainerClassName,
} from '@/shared/components/TableRowActionButtons'
import { TablePagination } from '@/shared/components/TablePagination'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

const TABLE_COLUMN_COUNT = 6

function DesignatedVehicle() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignMode, setAssignMode] = useState<'create' | 'edit'>('create')
  const [editVehicleId, setEditVehicleId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DesignatedVehicleListRow | null>(null)

  const listQuery = useQuery({
    queryKey: ['designated-vehicles', search, page, pageSize],
    queryFn: () => fetchDesignatedVehiclesPage(search, page, pageSize),
    staleTime: 30_000,
  })

  const rows = listQuery.data?.rows ?? []
  const totalCount = listQuery.data?.totalCount ?? rows.length
  const effectivePageSize = listQuery.data?.effectivePageSize ?? pageSize
  const totalPages =
    listQuery.data?.totalPages ?? Math.max(1, Math.ceil(totalCount / Math.max(1, effectivePageSize)))

  useEffect(() => {
    setPage(1)
  }, [search, pageSize])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const deleteMutation = useMutation({
    mutationFn: (vehicleId: string) => deleteDesignatedOfficial(vehicleId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['designated-vehicles'] })
      showSuccessToast('Designated vehicle assignment deleted.')
      setDeleteTarget(null)
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to delete designated vehicle assignment')
    },
  })

  const openCreate = () => {
    setAssignMode('create')
    setEditVehicleId(null)
    setAssignOpen(true)
  }

  const openEdit = (row: DesignatedVehicleListRow) => {
    setAssignMode('edit')
    setEditVehicleId(row.vehicleId)
    setAssignOpen(true)
  }

  const openDetail = (row: DesignatedVehicleListRow) => {
    const vehicleId = row.vehicleId.trim()
    if (!vehicleId) {
      showErrorToast('Missing vehicle id for detail view.')
      return
    }
    navigate(`/vehicle/list/${encodeURIComponent(vehicleId)}`, {
      state: { fromDesignatedList: true },
    })
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget.vehicleId)
  }

  const renderRowActions = (row: DesignatedVehicleListRow) => (
    <div className={rowActionsContainerClassName}>
      <DetailRowActionButton
        tooltip="View vehicle details"
        onClick={() => openDetail(row)}
      />
      <EditRowActionButton
        tooltip="Edit designated vehicle assignment"
        onClick={() => openEdit(row)}
      />
      <DeleteRowActionButton
        tooltip="Delete designated vehicle assignment"
        onClick={() => setDeleteTarget(row)}
      />
    </div>
  )

  return (
    <section className="space-y-5">
      <Card className="min-w-0 overflow-visible rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="min-w-0 space-y-4 p-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-[var(--fms-text-header)] sm:text-2xl">
                Designated Vehicle
              </h1>
              <p className="mt-1 text-sm text-[var(--fms-text-subheading)]">
                Assigned Designated Vehicles
              </p>
            </div>
            <Button type="button" className="w-full sm:w-auto" onClick={openCreate}>
              <Plus className="mr-1 h-4 w-4" />
              Assign Vehicle
            </Button>
          </div>

          <FuelTableListToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search table..."
            searchAriaLabel="Search designated vehicles"
          />

          <div className="hidden w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
            <table className="w-max min-w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Vehicle No.</th>
                  <th className="px-4 py-3 text-left font-semibold">Designated Type</th>
                  <th className="px-4 py-3 text-left font-semibold">Official Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Designation</th>
                  <th className="px-4 py-3 text-center font-semibold">Status</th>
                  <th className="px-4 py-3 text-center font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {listQuery.isLoading ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMN_COUNT}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      Loading designated vehicles…
                    </td>
                  </tr>
                ) : listQuery.isError ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMN_COUNT}
                      className="px-4 py-6 text-center text-[var(--fms-delete)]"
                    >
                      Failed to load designated vehicles.
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMN_COUNT}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      {search.trim()
                        ? 'No designated vehicles match your search.'
                        : 'No designated vehicles found.'}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-[var(--fms-strokes)] hover:bg-[#fafafa]"
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[var(--fms-text-header)]">
                          {row.registrationNumber}
                        </p>
                        {row.makeModel !== '—' ? (
                          <p className="text-xs text-[var(--fms-text-subheading)]">{row.makeModel}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">
                        {row.designationTypeName}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">{row.officialName}</td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">{row.designation}</td>
                     
                      <td className="px-4 py-3 text-center">
                        <DesignatedVehicleStatusCell status={row.status} />
                      </td>
                      <td className="px-4 py-3 text-center">{renderRowActions(row)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {listQuery.isLoading ? (
              <ListPanelMessage>Loading designated vehicles…</ListPanelMessage>
            ) : listQuery.isError ? (
              <ListPanelMessage tone="error">Failed to load designated vehicles.</ListPanelMessage>
            ) : rows.length === 0 ? (
              <ListPanelMessage>
                {search.trim()
                  ? 'No designated vehicles match your search.'
                  : 'No designated vehicles found.'}
              </ListPanelMessage>
            ) : (
              rows.map((row) => (
                <MobileListCard key={row.id}>
                  <MobileListField label="Vehicle No.">
                    <span className="font-semibold text-[var(--fms-text-header)]">
                      {row.registrationNumber}
                    </span>
                    {row.makeModel !== '—' ? (
                      <span className="block text-xs text-[var(--fms-text-subheading)]">
                        {row.makeModel}
                      </span>
                    ) : null}
                  </MobileListField>
                  <MobileListField label="Official Name">{row.officialName}</MobileListField>
                  <MobileListField label="Designation">{row.designation}</MobileListField>
                  <MobileListField label="Designated Type">
                    {row.designationTypeName}
                  </MobileListField>
                  <MobileListField label="Status">
                    <DesignatedVehicleStatusCell status={row.status} />
                  </MobileListField>
                  <div className={`mt-3 ${rowActionsContainerClassName}`}>
                    {renderRowActions(row)}
                  </div>
                </MobileListCard>
              ))
            )}
          </div>

          {rows.length > 0 ? (
            <TablePagination
              page={page}
              totalPages={totalPages}
              pageSize={effectivePageSize}
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

      <AssignDesignatedVehicleDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        mode={assignMode}
        editVehicleId={editVehicleId}
      />

      <DeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Designated Vehicle"
        description={
          deleteTarget
            ? `Are you sure you want to delete the assignment for ${deleteTarget.registrationNumber}? This action cannot be undone.`
            : 'Are you sure you want to delete this designated vehicle assignment?'
        }
      />
    </section>
  )
}

export default DesignatedVehicle
