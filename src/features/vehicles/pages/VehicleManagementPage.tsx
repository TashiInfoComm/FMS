// Lists vehicles from GET `/vehicles` with search; detail opens `/vehicle/list/:vehicleId`.
import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  fetchVehiclesPage,
  type VehicleListRow,
} from "@/features/vehicles/lib/vehicles-api";
import { fetchVehicleListStatusLookups } from "@/shared/lib/organogram-master-lookup";
import { apiDelete } from "@/services/apiClient";
import { DeleteDialog } from "@/shared/components/DeleteDialog";
import { PageHeader } from "@/shared/components/PageHeader";
import { TablePagination } from "@/shared/components/TablePagination";
import {
  DeleteRowActionButton,
  DetailRowActionButton,
  EditRowActionButton,
  rowActionsContainerClassName,
} from "@/shared/components/TableRowActionButtons";
import { useRouteCrudPermissions } from "@/shared/hooks/useRouteCrudPermissions";
import { showErrorToast, showSuccessToast } from "@/shared/lib/toast";

export function VehicleManagementPage() {
  const crud = useRouteCrudPermissions("/vehicle/list");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(
    null,
  );
  const statusLookupsQuery = useQuery({
    queryKey: ["vehicles", "list", "status-lookups"],
    queryFn: fetchVehicleListStatusLookups,
    enabled: crud.isResolved && crud.canRead,
    staleTime: 60_000,
  });

  const vehiclesQuery = useQuery({
    queryKey: [
      "vehicles",
      "list",
      search,
      page,
      pageSize,
      statusLookupsQuery.dataUpdatedAt,
    ],
    queryFn: () =>
      fetchVehiclesPage(
        search,
        page,
        pageSize,
        statusLookupsQuery.data
          ? {
              vehicleStatuses: statusLookupsQuery.data.vehicleStatuses,
              vehicleMovementStatuses:
                statusLookupsQuery.data.vehicleMovementStatuses,
            }
          : undefined,
      ),
    enabled: crud.isResolved && crud.canRead,
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiDelete<unknown>(`/vehicles/${encodeURIComponent(id)}`),
    onSuccess: () => {
      showSuccessToast("Vehicle deleted");
      void queryClient.invalidateQueries({ queryKey: ["vehicles", "list"] });
      setSelectedVehicleId(null);
    },
    onError: (err) => {
      showErrorToast(err instanceof Error ? err.message : "Delete failed");
    },
  });

  const vehicles = useMemo(
    () => vehiclesQuery.data?.rows ?? [],
    [vehiclesQuery.data?.rows],
  );
  const totalCount = vehiclesQuery.data?.totalCount ?? vehicles.length;
  const effectivePageSize = vehiclesQuery.data?.effectivePageSize ?? pageSize;
  const totalPages =
    vehiclesQuery.data?.totalPages ??
    Math.max(1, Math.ceil(totalCount / Math.max(1, effectivePageSize)));
  const serialBase = (page - 1) * effectivePageSize;

  const askDelete = (id: string) => {
    if (!crud.canDelete) return;
    setSelectedVehicleId(id);
    setDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (!crud.canDelete || selectedVehicleId === null) return;
    deleteMutation.mutate(selectedVehicleId);
  };

  const listError = vehiclesQuery.isError
    ? vehiclesQuery.error instanceof Error
      ? vehiclesQuery.error.message
      : "Could not load vehicles."
    : null;

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Vehicle"
          subtitle="Manage vehicle records and configurations"
        />
        {crud.canCreate ? (
          <Button asChild className="w-full sm:w-auto">
            <Link to="/vehicle/add">
              <Plus className="mr-1 h-4 w-4" />
              Add New
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
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search by vehicle name"
                className="pl-9"
              />
            </div>
          </div>

          {listError ? (
            <p className="text-sm text-[var(--fms-error-text)]">{listError}</p>
          ) : null}

          <div className="hidden overflow-hidden rounded-lg border border-[var(--fms-strokes)] md:block">
            <table className="w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  <th className="w-16 px-4 py-3 text-left font-semibold">Sl.No</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Vehicle Number
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Make & Model
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Movement Status
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Color</th>
                  <th className="px-4 py-3 text-center font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {crud.isResolved && !crud.canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      You do not have permission to view this data.
                    </td>
                  </tr>
                ) : vehiclesQuery.isLoading ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      Loading vehicles…
                    </td>
                  </tr>
                ) : vehicles.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      No vehicles found.
                    </td>
                  </tr>
                ) : (
                  vehicles.map((vehicle, index) => (
                    <VehicleTableRow
                      key={vehicle.id}
                      serialNo={serialBase + index + 1}
                      vehicle={vehicle}
                      crud={crud}
                      onAskDelete={askDelete}
                      onAssignAgency={(id) => {
                        navigate(
                          `/vehicle/list/${encodeURIComponent(id)}/agency-assignments`,
                        );
                      }}
                      deleteBusy={deleteMutation.isPending}
                    />
                  ))
                )}
              </tbody>
            </table>
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
          setDeleteOpen(open);
          if (!open) setSelectedVehicleId(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Vehicle"
        description="Are you sure you want to delete this vehicle? This action cannot be undone."
      />

    </section>
  );
}

function VehicleTableRow({
  serialNo,
  vehicle,
  crud,
  onAskDelete,
  onAssignAgency,
  deleteBusy,
}: {
  serialNo: number;
  vehicle: VehicleListRow;
  crud: ReturnType<typeof useRouteCrudPermissions>;
  onAskDelete: (id: string) => void;
  onAssignAgency: (id: string) => void;
  deleteBusy: boolean;
}) {
  const navigate = useNavigate();

  return (
    <tr className="border-t border-[var(--fms-strokes)]">
      <td className="px-4 py-3 tabular-nums text-[var(--fms-text-subheading)]">
        {serialNo}
      </td>
      <td className="px-4 py-3">{vehicle.registration_number}</td>
      <td className="px-4 py-3">{vehicle.makeModel}</td>
      <td className="px-4 py-3">
        <span
          className={
            vehicle.status.toLowerCase() === "active"
              ? "rounded-full bg-[#d7f8e8] px-2 py-1 text-xs text-[#0f8e5c]"
              : "rounded-full bg-[#fff4cc] px-2 py-1 text-xs text-[#9f7b00]"
          }
        >
          {vehicle.status}
        </span>
      </td>
      <td className="px-4 py-3">{vehicle.movement}</td>
      <td className="px-4 py-3">{vehicle.color}</td>

      <td className="px-4 py-3">
        <div className={rowActionsContainerClassName}>
          <DetailRowActionButton
            type="button"
            disabled={!crud.canRead}
            onClick={() =>
              navigate(`/vehicle/list/${encodeURIComponent(vehicle.id)}`)
            }
          />
          <EditRowActionButton
            type="button"
            disabled={!crud.canUpdate}
            onClick={() =>
              navigate(`/vehicle/list/${encodeURIComponent(vehicle.id)}/edit`)
            }
          />

          <DeleteRowActionButton
            type="button"
            disabled={!crud.canDelete || deleteBusy}
            onClick={() => onAskDelete(vehicle.id)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={
              "h-8 gap-1 cursor-pointer rounded-lg border border-[var(--fms-neutral-border)] bg-[var(--fms-neutral-fill)] text-[var(--fms-neutral-text)] shadow-none hover:brightness-[0.98] [&_svg]:size-3.5 dark:border-[var(--fms-warning-border)]/55 dark:bg-[var(--fms-warning-fill)]/30 dark:text-[var(--fms-warning-text)] dark:hover:bg-[var(--fms-warning-fill)]/45"
            }
            onClick={() => onAssignAgency(vehicle.id)}
          >
             Agency Mapping
          </Button>
        </div>
      </td>
    </tr>
  );
}
