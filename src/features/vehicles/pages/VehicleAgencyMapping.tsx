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
import { Label } from "@/components/ui/label";
import {
  mergeQuotaOrgScopeAutocompleteOptions,
  orgScopeOptionKey,
  profileToOrgScopeOption,
  profileToOrgScopeOptions,
  resolveCurrentUserId,
  resolveQuotaOrgScopeOptions,
} from "@/features/fuel/lib/quota-configuration-api";
import type { AssignmentEntityType } from "@/features/vehicles/lib/vehicle-agency-assignment-api";
import {
  fetchVehicleAgencyAssignments,
  orgScopeKeyFromAssignment,
  postVehicleAgencyAssignment,
  putVehicleAgencyAssignment,
  resolveAssignmentPayloadFromOrgScopeKey,
  type VehicleAgencyAssignmentBody,
  type VehicleAgencyAssignmentListItem,
} from "@/features/vehicles/lib/vehicle-agency-assignment-api";
import type { ApiRecord } from "@/features/user/lib/roles-api";
import { fetchUserOrgScopes } from "@/features/user/lib/user-org-scopes-api";
import {
  fetchUserOrganogramDisplayNames,
  mapUserDetailFields,
} from "@/features/user/lib/users-api";
import { useUserStore } from "@/services/user-store";
import { SearchableAutocomplete } from "@/shared/components/SearchableAutocomplete";
import { showErrorToast, showSuccessToast } from "@/shared/lib/toast";
import { PageHeader } from "@/shared/components/PageHeader";
import {
  EditRowActionButton,
  rowActionsContainerClassName,
} from "@/shared/components/TableRowActionButtons";
import { useRouteCrudPermissions } from "@/shared/hooks/useRouteCrudPermissions";

function asRecord(user: unknown): ApiRecord | null {
  if (user && typeof user === "object" && !Array.isArray(user)) {
    return user as ApiRecord;
  }
  return null;
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
  row: VehicleAgencyAssignmentListItem,
  orgLabelByKey: Map<string, string>,
): string {
  if (row.label) return row.label;
  const key = orgScopeKeyFromAssignment(row.entityType, row.entityId);
  return orgLabelByKey.get(key) ?? row.entityId;
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

function useAgencyAssignmentOrgOptions(enabled: boolean) {
  const user = useUserStore((state) => state.user);
  const profileRecord = asRecord(user);
  const currentUserId = resolveCurrentUserId(profileRecord);

  const organogramNamesQuery = useQuery({
    queryKey: ["vehicles", "agency-assignment", "profile-organogram", currentUserId],
    enabled: enabled && Boolean(profileRecord),
    queryFn: () => fetchUserOrganogramDisplayNames(profileRecord!),
    staleTime: 60_000,
  });

  const profileScopes = useMemo(() => {
    if (!profileRecord) return [];
    const labels = organogramNamesQuery.data ?? mapUserDetailFields(profileRecord);
    return profileToOrgScopeOptions(profileRecord, {
      agency: labels.agency,
      department: labels.department,
      division: labels.division,
      subDivision: labels.subDivision,
    });
  }, [profileRecord, organogramNamesQuery.data]);

  const organizationOptionsQuery = useQuery({
    queryKey: [
      "vehicles",
      "agency-assignment",
      "org-options",
      currentUserId,
      profileScopes.map((scope) => orgScopeOptionKey(scope)).join("|"),
    ],
    enabled: enabled && (Boolean(currentUserId) || profileScopes.length > 0),
    queryFn: async () => {
      const apiScopes = currentUserId ? await fetchUserOrgScopes(currentUserId) : [];
      return resolveQuotaOrgScopeOptions(profileScopes, apiScopes);
    },
    staleTime: 60_000,
  });

  const organizationOptions = organizationOptionsQuery.data ?? [];

  const organizationAutocompleteOptions = useMemo(
    () => mergeQuotaOrgScopeAutocompleteOptions(profileScopes, organizationOptions),
    [profileScopes, organizationOptions],
  );

  const orgLabelByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of organizationOptions) {
      map.set(orgScopeOptionKey(option), option.label);
    }
    for (const option of profileScopes) {
      map.set(orgScopeOptionKey(option), option.label);
    }
    return map;
  }, [organizationOptions, profileScopes]);

  const defaultOrganizationKey = useMemo(() => {
    if (profileRecord) {
      const labels = organogramNamesQuery.data ?? mapUserDetailFields(profileRecord);
      const mostSpecific = profileToOrgScopeOption(profileRecord, {
        agency: labels.agency,
        department: labels.department,
        division: labels.division,
        subDivision: labels.subDivision,
      });
      if (mostSpecific) return orgScopeOptionKey(mostSpecific);
    }
    const first = organizationOptions[0];
    return first ? orgScopeOptionKey(first) : "";
  }, [profileRecord, organogramNamesQuery.data, organizationOptions]);

  const orgSelectLoading =
    (Boolean(profileRecord) && organogramNamesQuery.isLoading) ||
    (organizationOptionsQuery.isLoading &&
      organizationAutocompleteOptions.length === 0);

  return {
    organizationAutocompleteOptions,
    orgLabelByKey,
    defaultOrganizationKey,
    orgSelectLoading,
    organizationOptionsQuery,
  };
}

export type VehicleAgencyAssignmentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string | null;
  /** When set, the form is prefilled and submit issues PUT for this assignment id. */
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
  const [organizationKey, setOrganizationKey] = useState("");

  const {
    organizationAutocompleteOptions,
    defaultOrganizationKey,
    orgSelectLoading,
    organizationOptionsQuery,
  } = useAgencyAssignmentOrgOptions(open);

  useEffect(() => {
    if (!open) {
      setOrganizationKey("");
      return;
    }

    if (editingAssignment) {
      setOrganizationKey(
        orgScopeKeyFromAssignment(
          editingAssignment.entityType,
          editingAssignment.entityId,
        ),
      );
      return;
    }

    setOrganizationKey(defaultOrganizationKey);
  }, [
    open,
    editingAssignment?.id,
    editingAssignment?.entityType,
    editingAssignment?.entityId,
    defaultOrganizationKey,
  ]);

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

  const resolved =
    vehicleId && organizationKey
      ? resolveAssignmentPayloadFromOrgScopeKey(organizationKey, vehicleId)
      : null;

  const canSubmit =
    Boolean(resolved) &&
    !saveMutation.isPending &&
    !orgSelectLoading &&
    Boolean(vehicleId?.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-4 overflow-visible px-6">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit agency assignment" : "Assign agency"}
          </DialogTitle>
          <DialogDescription>
            Choose the organogram level for this vehicle. The assignment uses
            the most specific organization you select (for example, if you pick
            a division, that division is sent—not the agency).
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-w-0 grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label htmlFor="assign-organization">Organization</Label>
            <SearchableAutocomplete
              id="assign-organization"
              value={organizationKey}
              onChange={setOrganizationKey}
              options={organizationAutocompleteOptions}
              loading={orgSelectLoading}
              disabled={
                !orgSelectLoading && organizationAutocompleteOptions.length === 0
              }
              placeholder={
                orgSelectLoading
                  ? "Loading organizations…"
                  : organizationAutocompleteOptions.length === 0
                    ? "No organizations available"
                    : "Search and select organization"
              }
              searchPlaceholder="Type to search…"
              emptyMessage="No organizations found."
              side="top"
            />
          </div>
        </div>

        {organizationOptionsQuery.isError ? (
          <p className="text-sm text-[var(--fms-error-text)]">
            {organizationOptionsQuery.error instanceof Error
              ? organizationOptionsQuery.error.message
              : "Could not load organization options."}
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

  const { orgLabelByKey } = useAgencyAssignmentOrgOptions(
    Boolean(vehicleId) && crud.isResolved && crud.canRead,
  );

  const assignmentsQuery = useQuery({
    queryKey: ["vehicles", "agency-assignments", vehicleId],
    queryFn: () => fetchVehicleAgencyAssignments(vehicleId),
    enabled: Boolean(vehicleId) && crud.isResolved && crud.canRead,
    staleTime: 30_000,
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
                ) : assignmentsQuery.isLoading ? (
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
                        {resolveAssignmentDisplayName(row, orgLabelByKey)}
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
            {assignmentsQuery.isLoading ? (
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
                    {resolveAssignmentDisplayName(row, orgLabelByKey)}
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
