import { useMemo, useState } from "react";
import { Badge, Check, CloudUpload, Plus, RotateCcw, Search, X } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  createApprovingAuthority,
  deleteApprovingAuthority,
  fetchApprovingAuthoritiesPage,
  toApprovingAuthorityPayload,
  updateApprovingAuthority,
  type ApprovingAuthorityTableRow,
} from "@/features/settings/lib/approving-authority-api";
import {
  fetchAdminRoleOptions,
  type AdminRoleOption,
} from "@/features/user/lib/roles-api";
import { DeleteDialog } from "@/shared/components/DeleteDialog";
import { SearchableAutocomplete } from "@/shared/components/SearchableAutocomplete";
import { PageHeader } from "@/shared/components/PageHeader";
import {
  DeleteRowActionButton,
  EditRowActionButton,
  rowActionsContainerClassName,
} from "@/shared/components/TableRowActionButtons";
import { TablePagination } from "@/shared/components/TablePagination";
import { useRouteCrudPermissions } from "@/shared/hooks/useRouteCrudPermissions";
import { formatRealmRoleDisplayName } from "@/shared/lib/format-realm-role-display";
import { showErrorToast, showSuccessToast } from "@/shared/lib/toast";
import { cn } from "@/lib/utils";

type FormValues = {
  name: string;
  role: string;
  description: string;
  hasEmployeeField: boolean;
  isActive: boolean;
};

const LIST_QUERY_KEY = "workflows/approving-authorities";

function emptyValues(): FormValues {
  return {
    name: "",
    role: "",
    description: "",
    hasEmployeeField: false,
    isActive: false,
  };
}

function formatRole(value: string) {
  const trimmed = value.trim();
  return trimmed ? formatRealmRoleDisplayName(trimmed) : "-";
}

function BooleanCellIcon({ value }: { value: boolean }) {
  return value ? (
    <Check className="h-4 w-4 text-[var(--fms-success-text)]" aria-hidden />
  ) : (
    <X className="h-4 w-4 text-[var(--fms-delete)]" aria-hidden />
  );
}

function toRoleAutocompleteOptions(options: AdminRoleOption[]) {
  return options.map((option) => ({
    value: option.roleName,
    label: formatRealmRoleDisplayName(option.roleName),
    description: option.description || undefined,
    searchText: option.roleName,
  }));
}


function ApprovingAuthority() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedDeleteId, setSelectedDeleteId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const crud = useRouteCrudPermissions("/settings/approving-authority");
  const canCreate = !crud.isResolved || crud.canCreate;
  const canUpdate = !crud.isResolved || crud.canUpdate;
  const canDelete = !crud.isResolved || crud.canDelete;
  const canRead = !crud.isResolved || crud.canRead;

  const { register, handleSubmit, reset, watch, setValue, control, formState } =
    useForm<FormValues>({
      defaultValues: emptyValues(),
    });

  const hasEmployeeFieldValue = watch("hasEmployeeField");
  const isActiveValue = watch("isActive");

  const listQuery = useQuery({
    queryKey: [LIST_QUERY_KEY, search, page, pageSize],
    queryFn: () => fetchApprovingAuthoritiesPage(search, page, pageSize),
    enabled: canRead,
  });

  const rolesQuery = useQuery({
    queryKey: ["admin-role-options"],
    queryFn: fetchAdminRoleOptions,
    staleTime: 60_000,
    enabled: dialogOpen,
  });

  const roleOptions = useMemo(() => rolesQuery.data ?? [], [rolesQuery.data]);
  const roleAutocompleteOptions = useMemo(
    () => toRoleAutocompleteOptions(roleOptions),
    [roleOptions],
  );

  const createMutation = useMutation({
    mutationFn: createApprovingAuthority,
    onSuccess: () => {
      showSuccessToast("Approving authority created successfully");
      queryClient.invalidateQueries({ queryKey: [LIST_QUERY_KEY] });
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to create approving authority";
      showErrorToast(message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: ReturnType<typeof toApprovingAuthorityPayload>;
    }) => updateApprovingAuthority(id, body),
    onSuccess: () => {
      showSuccessToast("Approving authority updated successfully");
      queryClient.invalidateQueries({ queryKey: [LIST_QUERY_KEY] });
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update approving authority";
      showErrorToast(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteApprovingAuthority,
    onSuccess: () => {
      showSuccessToast("Approving authority deleted successfully");
      queryClient.invalidateQueries({ queryKey: [LIST_QUERY_KEY] });
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to delete approving authority";
      showErrorToast(message);
    },
  });

  const rows = useMemo(
    () => listQuery.data?.rows ?? [],
    [listQuery.data?.rows],
  );
  const totalCount = listQuery.data?.totalCount ?? rows.length;
  const effectivePageSize = listQuery.data?.effectivePageSize ?? pageSize;
  const totalPages =
    listQuery.data?.totalPages ??
    Math.max(1, Math.ceil(totalCount / effectivePageSize));
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    reset(emptyValues());
  };

  const onCreateOpen = () => {
    if (!canCreate) return;
    setEditingId(null);
    reset(emptyValues());
    setDialogOpen(true);
  };

  const onEdit = (row: ApprovingAuthorityTableRow) => {
    if (!canUpdate) return;
    setEditingId(row.id);
    reset({
      name: row.name,
      role: row.role,
      description: row.description,
      hasEmployeeField: row.hasEmployeeField,
      isActive: row.isActive,
    });
    setDialogOpen(true);
  };

  const onDeleteRequest = (row: ApprovingAuthorityTableRow) => {
    if (!canDelete) return;
    setSelectedDeleteId(row.id);
    setDeleteOpen(true);
  };

  const onConfirmDelete = () => {
    if (!canDelete || !selectedDeleteId) return;
    deleteMutation.mutate(selectedDeleteId, {
      onSettled: () => {
        setSelectedDeleteId(null);
        setDeleteOpen(false);
      },
    });
  };

  const onSubmit = (raw: FormValues) => {
    if (!raw.name.trim() || !raw.description.trim() || !raw.role.trim()) return;
    if (editingId && !canUpdate) return;
    if (!editingId && !canCreate) return;

    const body = toApprovingAuthorityPayload(raw);

    if (editingId) {
      updateMutation.mutate(
        { id: editingId, body },
        { onSuccess: closeDialog },
      );
    } else {
      createMutation.mutate(body, { onSuccess: closeDialog });
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Approving Authority"
          subtitle="Configure approving authorities used in approval workflows"
        />
        {canCreate ? (
          <Button
            type="button"
            className="w-full bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)] sm:w-auto"
            onClick={onCreateOpen}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add New
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
                placeholder="Search approving authority..."
                className="pl-9"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[var(--fms-strokes)]">
            <table className="min-w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  {[
                    "Sl.No",
                    "Name",
                    "Role",
                    "Description",
                    "Has Employee Field",
                    "Status",
                  ].map((column) => (
                    <th
                      key={column}
                      className={
                        column === "ACTION"
                          ? "px-4 py-3 text-center font-semibold "
                          : "px-4 py-3 text-left font-semibold "
                      }
                    >
                      {column}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center font-semibold ">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {crud.isResolved && !canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      You do not have permission to view this data.
                    </td>
                  </tr>
                ) : listQuery.isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr
                      key={`aa-sk-${index}`}
                      className="border-t border-[var(--fms-strokes)]"
                    >
                      {Array.from({ length: 7 }).map((__, cellIndex) => (
                        <td key={cellIndex} className="px-4 py-3">
                          <Skeleton className="h-4 w-full max-w-[8rem]" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : listQuery.isError ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-[var(--fms-delete)]"
                    >
                      Failed to load approving authorities.
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      No records found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-[var(--fms-strokes)]"
                    >
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.serialNo}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.name}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {formatRole(row.role)}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.description}
                      </td>
                      <td className="px-4 py-3">
                        <BooleanCellIcon value={row.hasEmployeeField} />
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        <span
                          className={cn(
                            "rounded-full border-0 px-3 py-1 font-normal text-white inline-block",
                            row.isActive
                              ? "text-[var(--fms-success-text)]"
                              : "text-[var(--fms-text-subheading)]",
                          )}
                        >
                          {row.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className={rowActionsContainerClassName}>
                          <EditRowActionButton
                            type="button"
                            disabled={!canUpdate}
                            onClick={() => onEdit(row)}
                          />
                          <DeleteRowActionButton
                            type="button"
                            disabled={!canDelete}
                            onClick={() => onDeleteRequest(row)}
                          />
                        </div>
                      </td>
                    </tr>
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

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
          else setDialogOpen(true);
        }}
      >
        <DialogContent className="max-w-3xl overflow-visible">
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? "Update Approving Authority"
                : "Create Approving Authority"}
            </DialogTitle>
          </DialogHeader>

          <form
            className="space-y-5 py-1"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
          >
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="authority-name">
                  Name <span className="text-[var(--fms-delete)]">*</span>
                </Label>
                <Input
                  id="authority-name"
                  {...register("name", {
                    required: "Name is required",
                    validate: (value) =>
                      value.trim() !== "" || "Name cannot be empty",
                  })}
                  placeholder="Enter name"
                  aria-invalid={formState.errors.name ? true : undefined}
                />
                {formState.errors.name?.message ? (
                  <p className="text-xs text-[var(--fms-delete)]">
                    {formState.errors.name.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="authority-role">
                  Role <span className="text-[var(--fms-delete)]">*</span>
                </Label>
                <Controller
                  name="role"
                  control={control}
                  rules={{
                    required: "Role is required",
                    validate: (value) =>
                      value.trim() !== "" || "Role is required",
                  }}
                  render={({ field }) => (
                    <SearchableAutocomplete
                      id="authority-role"
                      value={field.value}
                      onChange={field.onChange}
                      options={roleAutocompleteOptions}
                      loading={rolesQuery.isLoading}
                      error={!!formState.errors.role}
                      disabled={rolesQuery.isError}
                      placeholder="Search and select role"
                      searchPlaceholder="Type to search roles..."
                      emptyMessage="No roles found."
                      loadingMessage="Loading roles..."
                    />
                  )}
                />
                {rolesQuery.isError ? (
                  <p className="text-xs text-[var(--fms-delete)]">
                    Failed to load roles.
                  </p>
                ) : null}
                {formState.errors.role?.message ? (
                  <p className="text-xs text-[var(--fms-delete)]">
                    {formState.errors.role.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="authority-description">
                  Description{" "}
                  <span className="text-[var(--fms-delete)]">*</span>
                </Label>
                <Input
                  id="authority-description"
                  {...register("description", {
                    required: "Description is required",
                    validate: (value) =>
                      value.trim() !== "" || "Description cannot be empty",
                  })}
                  placeholder="Enter description"
                  aria-invalid={formState.errors.description ? true : undefined}
                />
                {formState.errors.description?.message ? (
                  <p className="text-xs text-[var(--fms-delete)]">
                    {formState.errors.description.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3">
                <Switch
                  id="authority-has-employee-field"
                  checked={hasEmployeeFieldValue}
                  onCheckedChange={(checked) =>
                    setValue("hasEmployeeField", checked)
                  }
                />
                <Label
                  htmlFor="authority-has-employee-field"
                  className="text-[var(--fms-text-subheading)]"
                >
                  Has Employee Field
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="authority-is-active"
                  checked={isActiveValue}
                  onCheckedChange={(checked) => setValue("isActive", checked)}
                />
                <Label
                  htmlFor="authority-is-active"
                  className="text-[var(--fms-text-subheading)]"
                >
                  Is Active
                </Label>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-2 border-t border-[var(--fms-strokes)] pt-4">
              <Button
                type="submit"
                className="bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)]"
                disabled={isSubmitting || (editingId ? !canUpdate : !canCreate)}
              >
                <CloudUpload className="mr-2 h-4 w-4" />
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={closeDialog}
                disabled={isSubmitting}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                CANCEL
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={onConfirmDelete}
        title="Delete Approving Authority"
        description="Are you sure you want to delete this approving authority? This action cannot be undone."
      />
    </section>
  );
}

export default ApprovingAuthority;
