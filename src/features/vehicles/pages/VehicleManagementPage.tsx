// Lists vehicles from GET `/vehicles` with search; detail opens `/vehicle/list/:vehicleId`.
import { Plus, RefreshCw, Search, Fuel } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  assignVehicleQuotaInitial,
  fetchVehiclesPage,
  syncVehicles,
  type VehicleListRow,
} from "@/features/vehicles/lib/vehicles-api";
import { cn } from "@/lib/utils";
import { apiDelete } from "@/services/apiClient";
import { DeleteDialog } from "@/shared/components/DeleteDialog";
import {
  ListPanelMessage,
  MobileListCard,
  MobileListField,
} from "@/shared/components/MobileListCard";
import { PageHeader } from "@/shared/components/PageHeader";
import { TablePagination } from "@/shared/components/TablePagination";
import {
  DeleteRowActionButton,
  DetailRowActionButton,
  EditRowActionButton,
  rowActionsContainerClassName,
} from "@/shared/components/TableRowActionButtons";
import { useAccessControl } from "@/shared/hooks/useAccessControl";
import { useRouteCrudPermissions } from "@/shared/hooks/useRouteCrudPermissions";
import { showErrorToast, showSuccessToast } from "@/shared/lib/toast";

export function VehicleManagementPage() {
  const crud = useRouteCrudPermissions("/vehicle/list");
  const { role } = useAccessControl();
  const isSuperAdmin = role === "fms-super-admin";
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(
    null,
  );
  const [assignQuotaOpen, setAssignQuotaOpen] = useState(false);
  const [assignQuotaVehicle, setAssignQuotaVehicle] =
    useState<VehicleListRow | null>(null);
  const [assignQuotaAmount, setAssignQuotaAmount] = useState("");
  const vehiclesQuery = useQuery({
    queryKey: ["vehicles", "list", search, page, pageSize],
    queryFn: () => fetchVehiclesPage(search, page, pageSize),
    enabled: crud.isResolved && crud.canRead,
    staleTime: 30_000,
  });

  const assignQuotaMutation = useMutation({
    mutationFn: ({
      vehicleId,
      fuelQuotaBalance,
    }: {
      vehicleId: string;
      fuelQuotaBalance: number;
    }) => assignVehicleQuotaInitial(vehicleId, fuelQuotaBalance),
    onSuccess: () => {
      showSuccessToast("Fuel quota assigned");
      void queryClient.invalidateQueries({ queryKey: ["vehicles", "list"] });
      setAssignQuotaOpen(false);
      setAssignQuotaVehicle(null);
      setAssignQuotaAmount("");
    },
    onError: (err) => {
      showErrorToast(err, "Could not assign fuel quota");
    },
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
      showErrorToast(err, "Delete failed");
    },
  });

  const syncMutation = useMutation({
    mutationFn: syncVehicles,
    onSuccess: async () => {
      showSuccessToast("Vehicles synced successfully");
      await queryClient.invalidateQueries({ queryKey: ["vehicles", "list"] });
    },
    onError: (err) => {
      showErrorToast(err, "Could not sync vehicles");
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

  const openAssignQuota = (vehicle: VehicleListRow) => {
    setAssignQuotaVehicle(vehicle);
    setAssignQuotaAmount("");
    setAssignQuotaOpen(true);
  };

  const closeAssignQuota = () => {
    setAssignQuotaOpen(false);
    setAssignQuotaVehicle(null);
    setAssignQuotaAmount("");
  };

  const submitAssignQuota = (event: FormEvent) => {
    event.preventDefault();
    if (!assignQuotaVehicle || !crud.canUpdate) return;
    const amount = Number(assignQuotaAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showErrorToast("Enter a valid fuel quota amount");
      return;
    }
    assignQuotaMutation.mutate({
      vehicleId: assignQuotaVehicle.id,
      fuelQuotaBalance: amount,
    });
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
        {isSuperAdmin ? (
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={syncMutation.isPending}
            onClick={() => syncMutation.mutate()}
          >
            <RefreshCw
              className={cn(
                "mr-1 h-4 w-4",
                syncMutation.isPending && "animate-spin",
              )}
            />
            {syncMutation.isPending ? "Syncing…" : "Sync Vehicle"}
          </Button>
        ) : crud.canCreate ? (
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

          <div className="hidden w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
            <table className="w-max min-w-full text-sm">
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
                      onAssignDriver={(id) => {
                        navigate(
                          `/vehicle/list/${encodeURIComponent(id)}/drivers`,
                        );
                      }}
                      onAssignQuota={openAssignQuota}
                      deleteBusy={deleteMutation.isPending}
                      assignQuotaBusy={assignQuotaMutation.isPending}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {crud.isResolved && !crud.canRead ? (
              <ListPanelMessage>
                You do not have permission to view this data.
              </ListPanelMessage>
            ) : vehiclesQuery.isLoading ? (
              <ListPanelMessage>Loading vehicles…</ListPanelMessage>
            ) : listError ? (
              <ListPanelMessage tone="error">{listError}</ListPanelMessage>
            ) : vehicles.length === 0 ? (
              <ListPanelMessage>No vehicles found.</ListPanelMessage>
            ) : (
              vehicles.map((vehicle, index) => (
                <VehicleMobileCard
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
                  onAssignQuota={openAssignQuota}
                  deleteBusy={deleteMutation.isPending}
                  assignQuotaBusy={assignQuotaMutation.isPending}
                />
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
          setDeleteOpen(open);
          if (!open) setSelectedVehicleId(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Vehicle"
        description="Are you sure you want to delete this vehicle? This action cannot be undone."
      />

      <Dialog
        open={assignQuotaOpen}
        onOpenChange={(open) => {
          if (!open) closeAssignQuota();
          else setAssignQuotaOpen(true);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign the Quota initials</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitAssignQuota}>
            <p className="text-sm text-[var(--fms-text-subheading)]">
              {assignQuotaVehicle
                ? `Set the initial fuel quota for ${assignQuotaVehicle.registration_number}.`
                : null}
            </p>
            <div className="space-y-2">
              <Label htmlFor="assign-quota-amount">Fuel quota balance</Label>
              <Input
                id="assign-quota-amount"
                type="number"
                min={0}
                step="0.01"
                value={assignQuotaAmount}
                onChange={(event) => setAssignQuotaAmount(event.target.value)}
                placeholder="e.g. 500"
                disabled={assignQuotaMutation.isPending}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeAssignQuota}
                disabled={assignQuotaMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  !crud.canUpdate ||
                  assignQuotaMutation.isPending ||
                  !assignQuotaAmount.trim()
                }
              >
                {assignQuotaMutation.isPending ? "Saving…" : "Assign quota"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

    </section>
  );
}

function vehicleStatusBadgeClass(status: string) {
  return status.toLowerCase() === "active"
    ? "rounded-full bg-[#d7f8e8] px-2 py-1 text-xs text-[#0f8e5c]"
    : "rounded-full bg-[#fff4cc] px-2 py-1 text-xs text-[#9f7b00]";
}

function VehicleMobileCard({
  serialNo,
  vehicle,
  crud,
  onAskDelete,
  onAssignAgency,
  onAssignQuota,
  deleteBusy,
  assignQuotaBusy,
}: {
  serialNo: number;
  vehicle: VehicleListRow;
  crud: ReturnType<typeof useRouteCrudPermissions>;
  onAskDelete: (id: string) => void;
  onAssignAgency: (id: string) => void;
  onAssignQuota: (vehicle: VehicleListRow) => void;
  deleteBusy: boolean;
  assignQuotaBusy: boolean;
}) {
  const navigate = useNavigate();
  const needsQuotaInitial = vehicle.quota_initialized === false;

  return (
    <MobileListCard>
      <div className="flex items-start justify-between gap-2">
        <MobileListField label="Sl.No">{serialNo}</MobileListField>
        {needsQuotaInitial ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "h-7 w-7 shrink-0 cursor-pointer rounded-lg border bg-[var(--fms-warning-fill)] p-0 shadow-none hover:brightness-[0.98] [&_svg]:size-3.5 disabled:animate-none",
                  "fms-quota-blink",
                )}
                disabled={!crud.canUpdate || assignQuotaBusy}
                onClick={() => onAssignQuota(vehicle)}
              >
                <Fuel aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              There is no vehicle quota assigned. Click to Assign.
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <MobileListField label="Vehicle Number">
        {vehicle.registration_number}
      </MobileListField>
      <MobileListField label="Make & Model">{vehicle.makeModel}</MobileListField>
      <p className="text-sm text-[var(--fms-text-subheading)]">
        <span className="font-medium text-[var(--fms-text-header)]">
          Status:
        </span>{" "}
        <span className={vehicleStatusBadgeClass(vehicle.status)}>
          {vehicle.status}
        </span>
      </p>
      <MobileListField label="Movement Status">{vehicle.movement}</MobileListField>
      <MobileListField label="Color">{vehicle.color}</MobileListField>
      <div className={`mt-3 ${rowActionsContainerClassName}`}>
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
            "h-8 gap-1 cursor-pointer rounded-lg font-normal border border-[var(--fms-neutral-border)] bg-[var(--fms-neutral-fill)] text-[var(--fms-neutral-text)] shadow-none hover:brightness-[0.98] [&_svg]:size-3.5 dark:border-[var(--fms-warning-border)]/55 dark:bg-[var(--fms-warning-fill)]/30 dark:text-[var(--fms-warning-text)] dark:hover:bg-[var(--fms-warning-fill)]/45"
          }
          onClick={() => onAssignAgency(vehicle.id)}
        >
          Agency Mapping
        </Button>
      </div>
    </MobileListCard>
  );
}

function VehicleTableRow({
  serialNo,
  vehicle,
  crud,
  onAskDelete,
  onAssignAgency,
  onAssignQuota,
  onAssignDriver,
  deleteBusy,
  assignQuotaBusy,
}: {
  serialNo: number;
  vehicle: VehicleListRow;
  crud: ReturnType<typeof useRouteCrudPermissions>;
  onAskDelete: (id: string) => void;
  onAssignAgency: (id: string) => void;
  onAssignDriver: (id: string) => void;
  onAssignQuota: (vehicle: VehicleListRow) => void;
  deleteBusy: boolean;
  assignQuotaBusy: boolean;
}) {
  const navigate = useNavigate();
  const needsQuotaInitial = vehicle.quota_initialized === false;

  return (
    <tr className="border-t border-[var(--fms-strokes)]">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="tabular-nums text-[var(--fms-text-subheading)]">
            {serialNo}
          </span>
          {needsQuotaInitial ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-7 w-7 shrink-0 cursor-pointer rounded-lg border bg-[var(--fms-warning-fill)] p-0 shadow-none hover:brightness-[0.98] [&_svg]:size-3.5 disabled:animate-none",
                    "fms-quota-blink",
                  )}
                  disabled={!crud.canUpdate || assignQuotaBusy}
                  onClick={() => onAssignQuota(vehicle)}
                >
                  <Fuel aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent>There is no vehicle quota assigned. Click to Assign.</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-3">{vehicle.registration_number}</td>
      <td className="px-4 py-3">{vehicle.makeModel}</td>
      <td className="px-4 py-3">
        <span className={vehicleStatusBadgeClass(vehicle.status)}>
          {vehicle.status}
        </span>
      </td>
      <td className="px-4 py-3">{vehicle.movement}</td>
      <td className="px-4 py-3">{vehicle.color}</td>

      <td className="px-4 py-3">
        <div className={rowActionsContainerClassName}>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className={
              "h-8 gap-1 cursor-pointer rounded-lg font-normal border border-[var(--fms-neutral-border)] bg-[var(--fms-neutral-fill)] text-[var(--fms-neutral-text)] shadow-none hover:brightness-[0.98] [&_svg]:size-3.5 dark:border-[var(--fms-warning-border)]/55 dark:bg-[var(--fms-warning-fill)]/30 dark:text-[var(--fms-warning-text)] dark:hover:bg-[var(--fms-warning-fill)]/45"
            }
            onClick={() => onAssignAgency(vehicle.id)}
          >
            Agency Mapping
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!crud.canAssign}
            size="sm"
            className={
              "h-8 gap-1 cursor-pointer rounded-lg font-normal border border-[var(--fms-neutral-border)] bg-[var(--fms-neutral-fill)] text-[var(--fms-neutral-text)] shadow-none hover:brightness-[0.98] [&_svg]:size-3.5 dark:border-[var(--fms-warning-border)]/55 dark:bg-[var(--fms-warning-fill)]/30 dark:text-[var(--fms-warning-text)] dark:hover:bg-[var(--fms-warning-fill)]/45"
            }
            onClick={() => onAssignDriver(vehicle.id)}
          >
             Driver Assignment
          </Button>
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
        </div>
      </td>
    </tr>
  );
}
