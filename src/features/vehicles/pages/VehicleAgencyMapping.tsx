// Agency assignments: GET `/vehicles/agency-assignments/{vehicle_id}`, create/edit via POST/PUT `/vehicles/agency-assignment`.
import { ArrowLeft, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MasterDataSelect } from "@/features/vehicles/components/MasterDataSelect";
import type { MasterOption } from "@/features/vehicles/lib/vehicle-create-master-data";
import type { AssignmentEntityType } from "@/features/vehicles/lib/vehicle-agency-assignment-api";
import {
  type AgencyAssignmentTierSelection,
  fetchVehicleAgencyAssignmentMasterData,
  fetchVehicleAgencyAssignments,
  postVehicleAgencyAssignment,
  putVehicleAgencyAssignment,
  resolveAssignmentPayload,
  tiersFromAssignment,
  type VehicleAgencyAssignmentBody,
  type VehicleAgencyAssignmentListItem,
  type VehicleAgencyAssignmentMasterData,
} from "@/features/vehicles/lib/vehicle-agency-assignment-api";
import { showErrorToast, showSuccessToast } from "@/shared/lib/toast";
import { PageHeader } from "@/shared/components/PageHeader";
import {
  EditRowActionButton,
  rowActionsContainerClassName,
} from "@/shared/components/TableRowActionButtons";
import { useRouteCrudPermissions } from "@/shared/hooks/useRouteCrudPermissions";

function emptyTiers(): AgencyAssignmentTierSelection {
  return { agencyId: "", departmentId: "", divisionId: "", subDivisionId: "" };
}

function rowsToOptions(rows: { id: string; name: string }[]): MasterOption[] {
  return rows.map((r) => ({ value: r.id, label: r.name }));
}

function formatEntityTypeLabel(t: AssignmentEntityType): string {
  switch (t) {
    case "AGENCY":
      return "Agency";
    case "DEPARTMENT":
      return "Department";
    case "DIVISION":
      return "Division";
    case "SUBDIVISION":
      return "Sub division";
  }
}

function resolveAssignmentDisplayName(
  master: VehicleAgencyAssignmentMasterData | undefined,
  row: VehicleAgencyAssignmentListItem,
): string {
  if (row.label) return row.label;
  if (!master) return row.entityId;
  switch (row.entityType) {
    case "AGENCY":
      return (
        master.agencies.find((a) => a.id === row.entityId)?.name ?? row.entityId
      );
    case "DEPARTMENT":
      return (
        master.departments.find((d) => d.id === row.entityId)?.name ??
        row.entityId
      );
    case "DIVISION":
      return (
        master.divisions.find((d) => d.id === row.entityId)?.name ??
        row.entityId
      );
    case "SUBDIVISION":
      return (
        master.subDivisions.find((s) => s.id === row.entityId)?.name ??
        row.entityId
      );
  }
}

function yesNoBadge(yes: boolean) {
  return (
    <span
      className={
        yes
          ? "rounded-full bg-[#d7f8e8] px-2 py-1 text-xs text-[#0f8e5c]"
          : "rounded-full bg-[#f0f0f2] px-2 py-1 text-xs text-[var(--fms-text-subheading)]"
      }
    >
      {yes ? "Yes" : "No"}
    </span>
  );
}

export type VehicleAgencyAssignmentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string | null;
  /** When set, the same tier form is prefilled and submit issues PUT for this assignment id. */
  editingAssignment?: {
    id: string;
    entityType: AssignmentEntityType;
    entityId: string;
  } | null;
};

export function VehicleAgencyAssignmentDialog({
  open,
  onOpenChange,
  vehicleId,
  editingAssignment = null,
}: VehicleAgencyAssignmentDialogProps) {
  const queryClient = useQueryClient();
  const [tiers, setTiers] = useState<AgencyAssignmentTierSelection>(() =>
    emptyTiers(),
  );

  const masterQuery = useQuery({
    queryKey: ["vehicles", "agency-assignment", "master"],
    queryFn: fetchVehicleAgencyAssignmentMasterData,
    enabled: open,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open) {
      setTiers(emptyTiers());
      return;
    }
    const data = masterQuery.data;
    if (!data || !vehicleId?.trim()) return;

    if (editingAssignment) {
      const mapped = tiersFromAssignment(
        data,
        editingAssignment.entityType,
        editingAssignment.entityId,
      );
      setTiers(mapped ?? emptyTiers());
      if (!mapped) {
        showErrorToast(
          "Could not load this assignment into the form. Master data may have changed.",
        );
      }
    } else {
      setTiers(emptyTiers());
    }
  }, [
    open,
    vehicleId,
    editingAssignment?.id,
    editingAssignment?.entityType,
    editingAssignment?.entityId,
    masterQuery.data,
  ]);

  const { agencies, departments, divisions, subDivisions } =
    masterQuery.data ?? {
      agencies: [],
      departments: [],
      divisions: [],
      subDivisions: [],
    };

  const departmentOptions = useMemo(() => {
    if (!tiers.agencyId) return [];
    return rowsToOptions(
      departments.filter((d) => d.agencyId === tiers.agencyId),
    );
  }, [departments, tiers.agencyId]);

  const divisionOptions = useMemo(() => {
    if (!tiers.departmentId) return [];
    return rowsToOptions(
      divisions.filter((d) => d.departmentId === tiers.departmentId),
    );
  }, [divisions, tiers.departmentId]);

  const subDivisionOptions = useMemo(() => {
    if (!tiers.divisionId) return [];
    return rowsToOptions(
      subDivisions.filter((s) => s.divisionId === tiers.divisionId),
    );
  }, [subDivisions, tiers.divisionId]);

  const agencyOptions = useMemo(() => rowsToOptions(agencies), [agencies]);

  const isEdit = Boolean(editingAssignment?.id);

  const saveMutation = useMutation({
    mutationFn: async (body: VehicleAgencyAssignmentBody) => {
      if (editingAssignment?.id) {
        return putVehicleAgencyAssignment(editingAssignment.id, body);
      }
      return postVehicleAgencyAssignment(body);
    },
    onSuccess: (_, body) => {
      showSuccessToast(
        isEdit ? "Assignment updated" : "Agency assignment saved",
      );
      void queryClient.invalidateQueries({ queryKey: ["vehicles", "list"] });
      void queryClient.invalidateQueries({
        queryKey: ["vehicles", "agency-assignments", body.vehicle_id],
      });
      onOpenChange(false);
    },
    onError: (err) => {
      showErrorToast(err, "Assignment failed");
    },
  });

  const resolved = vehicleId
    ? resolveAssignmentPayload(tiers, vehicleId)
    : null;

  const canSubmit =
    Boolean(resolved) &&
    !saveMutation.isPending &&
    !masterQuery.isLoading &&
    Boolean(vehicleId?.trim());

  const setAgency = (agencyId: string) => {
    setTiers({ agencyId, departmentId: "", divisionId: "", subDivisionId: "" });
  };

  const setDepartment = (departmentId: string) => {
    setTiers((prev) => ({
      ...prev,
      departmentId,
      divisionId: "",
      subDivisionId: "",
    }));
  };

  const setDivision = (divisionId: string) => {
    setTiers((prev) => ({
      ...prev,
      divisionId,
      subDivisionId: "",
    }));
  };

  const setSubDivision = (subDivisionId: string) => {
    setTiers((prev) => ({ ...prev, subDivisionId }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-4 overflow-visible px-6">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit agency assignment" : "Assign agency"}
          </DialogTitle>
          <DialogDescription>
            Choose the organogram level for this vehicle. The assignment uses
            the most specific level you select (for example, if you pick a
            division, that division is sent—not the agency.).
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-w-0 grid-cols-1 gap-4">
          <MasterDataSelect
            id="assign-agency"
            label="Agency"
            placeholder="Select agency"
            options={agencyOptions}
            value={tiers.agencyId}
            loading={masterQuery.isLoading}
            onValueChange={setAgency}
          />
          <MasterDataSelect
            id="assign-department"
            label="Department"
            placeholder={
              tiers.agencyId ? "Select department" : "Select agency first"
            }
            options={departmentOptions}
            value={tiers.departmentId}
            disabled={!tiers.agencyId}
            loading={masterQuery.isLoading}
            onValueChange={setDepartment}
          />
          <MasterDataSelect
            id="assign-division"
            label="Division"
            placeholder={
              tiers.departmentId ? "Select division" : "Select department first"
            }
            options={divisionOptions}
            value={tiers.divisionId}
            disabled={!tiers.departmentId}
            loading={masterQuery.isLoading}
            onValueChange={setDivision}
          />
          <MasterDataSelect
            id="assign-sub-division"
            label="Sub division"
            placeholder={
              tiers.divisionId
                ? subDivisionOptions.length
                  ? "Select sub division (optional)"
                  : "No sub divisions for this division"
                : "Select division first"
            }
            options={subDivisionOptions}
            value={tiers.subDivisionId}
            disabled={!tiers.divisionId || subDivisionOptions.length === 0}
            loading={masterQuery.isLoading}
            onValueChange={setSubDivision}
          />
        </div>

        {masterQuery.isError ? (
          <p className="text-sm text-[var(--fms-error-text)]">
            {masterQuery.error instanceof Error
              ? masterQuery.error.message
              : "Could not load master data."}
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              if (!resolved) return;
              saveMutation.mutate(resolved);
            }}
          >
            {saveMutation.isPending
              ? "Saving…"
              : isEdit
                ? "Save changes"
                : "Confirm assignment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Route: `/vehicle/list/:vehicleId/agency-assignments`. Lists assignments, edit row, or Assign to open the dialog.
 */
export function VehicleAgencyMapping() {
  const { vehicleId: vehicleIdParam } = useParams<{ vehicleId: string }>();
  const vehicleId = vehicleIdParam?.trim() ?? "";
  const crud = useRouteCrudPermissions("/vehicle/list");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] =
    useState<VehicleAgencyAssignmentListItem | null>(null);

  const assignmentsQuery = useQuery({
    queryKey: ["vehicles", "agency-assignments", vehicleId],
    queryFn: () => fetchVehicleAgencyAssignments(vehicleId),
    enabled: Boolean(vehicleId) && crud.isResolved && crud.canRead,
    staleTime: 30_000,
  });

  const masterQuery = useQuery({
    queryKey: ["vehicles", "agency-assignment", "master"],
    queryFn: fetchVehicleAgencyAssignmentMasterData,
    enabled: Boolean(vehicleId) && crud.isResolved && crud.canRead,
    staleTime: 60_000,
  });

  const listError = assignmentsQuery.isError
    ? assignmentsQuery.error instanceof Error
      ? assignmentsQuery.error.message
      : "Could not load assignments."
    : null;

  const openCreate = () => {
    setEditingRow(null);
    setDialogOpen(true);
  };

  const openEdit = (row: VehicleAgencyAssignmentListItem) => {
    setEditingRow(row);
    setDialogOpen(true);
  };

  const dialogEditing =
    editingRow !== null
      ? {
          id: editingRow.id,
          entityType: editingRow.entityType,
          entityId: editingRow.entityId,
        }
      : null;

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 w-fit gap-1"
            asChild
          >
            <Link to={`/vehicle/list/${encodeURIComponent(vehicleId)}`}>
              <ArrowLeft className="h-4 w-4" />
              Back to vehicle
            </Link>
          </Button>
          <PageHeader
            title="Agency assignments"
            subtitle="View agency assignments for this vehicle, add a new one, or edit an existing row."
          />
        </div>
        {crud.canCreate ? (
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={openCreate}
          >
            <Plus className="mr-1 h-4 w-4" />
            Assign
          </Button>
        ) : null}
      </div>

      {!vehicleId ? (
        <p className="text-sm text-[var(--fms-error-text)]">
          Missing vehicle id in the URL.
        </p>
      ) : null}

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="space-y-4 p-0">
          {listError ? (
            <p className="text-sm text-[var(--fms-error-text)]">{listError}</p>
          ) : null}

          <div className="hidden overflow-hidden rounded-lg border border-[var(--fms-strokes)] md:block">
            <table className="w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  <th className="w-16 px-4 py-3 text-left font-semibold">Sl.No</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Assigned to
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Level</th>
                  <th className="px-4 py-3 text-left font-semibold">Current Agency</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Original Agency
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
                ) : assignmentsQuery.isLoading || masterQuery.isLoading ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      Loading assignments…
                    </td>
                  </tr>
                ) : (assignmentsQuery.data ?? []).length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      No agency assignments yet. Use Assign to add one.
                    </td>
                  </tr>
                ) : (
                  (assignmentsQuery.data ?? []).map((row, index) => (
                    <tr
                      key={row.id}
                      className="border-t border-[var(--fms-strokes)]"
                    >
                      <td className="px-4 py-3 tabular-nums text-[var(--fms-text-subheading)]">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3">
                        {resolveAssignmentDisplayName(masterQuery.data, row)}
                      </td>
                      <td className="px-4 py-3">
                        {formatEntityTypeLabel(row.entityType)}
                      </td>
                      <td className="px-4 py-3">{yesNoBadge(row.active)}</td>
                      <td className="px-4 py-3">
                        {yesNoBadge(row.is_original_agency)}
                      </td>
                      <td className="px-4 py-3">
                        <div className={rowActionsContainerClassName}>
                          <EditRowActionButton
                            type="button"
                            disabled={!crud.canUpdate}
                            onClick={() => openEdit(row)}
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
            {assignmentsQuery.isLoading || masterQuery.isLoading ? (
              <p className="text-sm text-[var(--fms-text-subheading)]">
                Loading assignments…
              </p>
            ) : (assignmentsQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-[var(--fms-text-subheading)]">
                No agency assignments yet. Use Assign to add one.
              </p>
            ) : (
              (assignmentsQuery.data ?? []).map((row) => (
                <div
                  key={row.id}
                  className="rounded-lg border border-[var(--fms-strokes)] bg-[#fafafa] p-3"
                >
                  <p className="font-medium text-[var(--fms-text-header)]">
                    {resolveAssignmentDisplayName(masterQuery.data, row)}
                  </p>
                  <p className="text-xs text-[var(--fms-text-subheading)]">
                    {formatEntityTypeLabel(row.entityType)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="text-[var(--fms-text-subheading)]">
                      Active: {yesNoBadge(row.active)}
                    </span>
                    <span className="text-[var(--fms-text-subheading)]">
                      Original agency: {yesNoBadge(row.is_original_agency)}
                    </span>
                  </div>
                  {crud.canUpdate ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => openEdit(row)}
                    >
                      Edit
                    </Button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <VehicleAgencyAssignmentDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingRow(null);
        }}
        vehicleId={vehicleId || null}
        editingAssignment={dialogEditing}
      />
    </section>
  );
}
