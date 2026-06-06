// Manages vehicle status tabs using API-backed CRUD endpoints.
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiDelete, apiGet, apiPost, apiPut } from "@/services/apiClient";
import { DeleteDialog } from "@/shared/components/DeleteDialog";
import { PageHeader } from "@/shared/components/PageHeader";
import {
  DeleteRowActionButton,
  EditRowActionButton,
  rowActionsContainerClassName,
} from "@/shared/components/TableRowActionButtons";
import { TablePagination } from "@/shared/components/TablePagination";
import { applyPagination } from "@/shared/utils/pagination";
import { useRouteCrudPermissions } from "@/shared/hooks/useRouteCrudPermissions";
import { showErrorToast, showSuccessToast } from "@/shared/lib/toast";

const tabs = [
  "Vehicle Status",
  "Vehicle Movement Status",
  "Trip Status",
] as const;
type VehicleStatusTab = (typeof tabs)[number];
type ApiRecord = Record<string, unknown>;
type FormValues = {
  code: string;
  name: string;
  description: string;
};
type StatusRow = {
  serialNo: number;
  code: string;
  name: string;
  description: string;
  active: boolean;
};
type TabConfig = {
  title: string;
  subtitle: string;
  entityLabel: string;
  endpoint: string;
  queryKey: string;
};

const TAB_CONFIG: Record<VehicleStatusTab, TabConfig> = {
  "Vehicle Status": {
    title: "Vehicle Status",
    subtitle: "Manage vehicle status records and configurations",
    entityLabel: "Vehicle Status",
    endpoint: "/master/vehicle-statuses",
    queryKey: "master-vehicle-statuses",
  },
  "Vehicle Movement Status": {
    title: "Vehicle Movement Status",
    subtitle: "Manage vehicle movement status records and configurations",
    entityLabel: "Vehicle Movement Status",
    endpoint: "/master/vehicle-movement-statuses",
    queryKey: "master-vehicle-movement-statuses",
  },
  "Trip Status": {
    title: "Trip Status",
    subtitle: "Manage trip status records and configurations",
    entityLabel: "Trip Status",
    endpoint: "/master/trip-statuses",
    queryKey: "master-trip-statuses",
  },
};

function toText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function toArray(payload: unknown): ApiRecord[] {
  if (Array.isArray(payload))
    return payload.filter(
      (item): item is ApiRecord => !!item && typeof item === "object",
    );
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;
  const candidates = [
    root.items,
    root.results,
    root.data,
    (root.data as Record<string, unknown> | undefined)?.items,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(
        (item): item is ApiRecord => !!item && typeof item === "object",
      );
    }
  }
  return [];
}

function mapRows(records: ApiRecord[], serialStart: number): StatusRow[] {
  return records.map((record, index) => ({
    serialNo: serialStart + index + 1,
    code: toText(record.code),
    name: toText(record.name),
    description: toText(record.description) || "-",
    active:
      typeof record.active === "boolean"
        ? record.active
        : record.active === 1 || record.active === "1",
  }));
}

function emptyValues(): FormValues {
  return { code: "", name: "", description: "" };
}

function listPath(
  endpoint: string,
  search: string,
  page: number,
  pageSize: number,
) {
  const q = encodeURIComponent(search.trim());
  return `${endpoint}?page=${page}&page_size=${pageSize}&code=&search=${q}`;
}

function buildPayload(values: FormValues, active: boolean) {
  return {
    code: values.code.trim(),
    name: values.name.trim(),
    description: values.description.trim(),
    display_order: 1,
    active,
  };
}

/** Tabbed vehicle metadata (status vs movement) with separate API paths per `TAB_CONFIG` entry. */
export function VehicleStatusPage() {
  const [activeTab, setActiveTab] =
    useState<VehicleStatusTab>("Vehicle Status");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [selectedDeleteCode, setSelectedDeleteCode] = useState<string | null>(
    null,
  );
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState } = useForm<FormValues>({
    defaultValues: emptyValues(),
  });

  const config = TAB_CONFIG[activeTab];
  const crud = useRouteCrudPermissions("/master/status", {
    subMenuNameHint: config.title,
  });
  const currentQueryKey = [config.queryKey, search, page, pageSize];

  const listQuery = useQuery({
    queryKey: currentQueryKey,
    queryFn: async () => {
      const payload = await apiGet<unknown>(
        listPath(config.endpoint, search, page, pageSize),
      );
      const records = toArray(payload);
      const paged = applyPagination(payload, records, page, pageSize, {
        page,
        pageSize,
        pageLength: records.length,
      });
      const rows = mapRows(paged.rows, paged.serialBase);
      return {
        rows,
        totalCount: paged.totalCount,
        totalPages: paged.totalPages,
        effectivePageSize: paged.effectivePageSize,
      };
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, string | number | boolean>) =>
      apiPost<unknown, Record<string, string | number | boolean>>(
        config.endpoint,
        payload,
      ),
    onSuccess: () => {
      showSuccessToast(`${config.entityLabel} created successfully`);
      queryClient.invalidateQueries({ queryKey: [config.queryKey] });
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : `Failed to create ${config.entityLabel.toLowerCase()}`;
      showErrorToast(message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      code,
      payload,
    }: {
      code: string;
      payload: Record<string, string | number | boolean>;
    }) =>
      apiPut<unknown, Record<string, string | number | boolean>>(
        `${config.endpoint}/${encodeURIComponent(code)}`,
        payload,
      ),
    onSuccess: () => {
      showSuccessToast(`${config.entityLabel} updated successfully`);
      queryClient.invalidateQueries({ queryKey: [config.queryKey] });
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : `Failed to update ${config.entityLabel.toLowerCase()}`;
      showErrorToast(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (code: string) =>
      apiDelete<unknown>(`${config.endpoint}/${encodeURIComponent(code)}`),
    onSuccess: () => {
      showSuccessToast(`${config.entityLabel} deleted successfully`);
      queryClient.invalidateQueries({ queryKey: [config.queryKey] });
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : `Failed to delete ${config.entityLabel.toLowerCase()}`;
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

  const switchTab = (tab: VehicleStatusTab) => {
    setActiveTab(tab);
    setSearch("");
    setPage(1);
    setDialogOpen(false);
    setDeleteOpen(false);
    setEditingCode(null);
    setSelectedDeleteCode(null);
    reset(emptyValues());
  };

  const onCreateOpen = () => {
    if (!crud.canCreate) return;
    setEditingCode(null);
    reset(emptyValues());
    setDialogOpen(true);
  };

  const onEdit = (row: StatusRow) => {
    if (!crud.canUpdate) return;
    if (!row.code) {
      showErrorToast(
        `Missing code for ${config.entityLabel.toLowerCase()} update`,
      );
      return;
    }
    setEditingCode(row.code);
    reset({
      code: row.code,
      name: row.name,
      description: row.description === "-" ? "" : row.description,
    });
    setDialogOpen(true);
  };

  const onDeleteRequest = (row: StatusRow) => {
    if (!crud.canDelete) return;
    if (!row.code) {
      showErrorToast(
        `Missing code for ${config.entityLabel.toLowerCase()} delete`,
      );
      return;
    }
    setSelectedDeleteCode(row.code);
    setDeleteOpen(true);
  };

  const onConfirmDelete = () => {
    if (!crud.canDelete) return;
    if (!selectedDeleteCode) return;
    deleteMutation.mutate(selectedDeleteCode);
    setSelectedDeleteCode(null);
  };

  const onSubmit = (raw: FormValues) => {
    if (!raw.code.trim() || !raw.name.trim() || !raw.description.trim()) return;
    const payload = buildPayload(raw, true);

    if (editingCode) {
      updateMutation.mutate({ code: editingCode, payload });
    } else {
      createMutation.mutate(payload);
    }
    setDialogOpen(false);
    setEditingCode(null);
    reset(emptyValues());
  };

  const onToggleStatus = (row: StatusRow, checked: boolean) => {
    if (!crud.canUpdate) return;
    if (!row.code) {
      showErrorToast(
        `Missing code for ${config.entityLabel.toLowerCase()} status update`,
      );
      return;
    }

    updateMutation.mutate({
      code: row.code,
      payload: buildPayload(
        {
          code: row.code,
          name: row.name,
          description: row.description === "-" ? "" : row.description,
        },
        checked,
      ),
    });
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-4">
          <PageHeader title={config.title} subtitle={config.subtitle} />
          <div className="inline-flex rounded-md bg-[#e8ebf0] p-1">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => switchTab(tab)}
                className={
                  tab === activeTab
                    ? "rounded-sm bg-white px-3 py-1.5 text-sm text-[var(--fms-text-header)] shadow-xs"
                    : "rounded-sm px-3 py-1.5 text-sm text-[var(--fms-text-subheading)]"
                }
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingCode(null);
              reset(emptyValues());
            }
          }}
        >
          {crud.canCreate ? (
            <Button
              type="button"
              className="w-full bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)] sm:w-auto"
              onClick={onCreateOpen}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add New
            </Button>
          ) : null}
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingCode
                  ? `Update ${config.entityLabel}`
                  : `Add New ${config.entityLabel}`}
              </DialogTitle>
            </DialogHeader>

            <form
              className="space-y-3 py-1"
              onSubmit={handleSubmit(onSubmit)}
              noValidate
            >
              <div className="space-y-2">
                <Label htmlFor="code">
                  Code <span className="text-[var(--fms-delete)]">*</span>
                </Label>
                <Input
                  id="code"
                  {...register("code", {
                    required: "Code is required",
                    validate: (value) =>
                      value.trim() !== "" || "Code cannot be empty",
                  })}
                  placeholder="Enter code"
                  aria-invalid={formState.errors.code ? true : undefined}
                />
                {formState.errors.code?.message ? (
                  <p className="text-xs text-[var(--fms-delete)]">
                    {formState.errors.code.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">
                  {config.entityLabel}{" "}
                  <span className="text-[var(--fms-delete)]">*</span>
                </Label>
                <Input
                  id="name"
                  {...register("name", {
                    required: `${config.entityLabel} is required`,
                    validate: (value) =>
                      value.trim() !== "" ||
                      `${config.entityLabel} cannot be empty`,
                  })}
                  placeholder={`Enter ${config.entityLabel.toLowerCase()}`}
                  aria-invalid={formState.errors.name ? true : undefined}
                />
                {formState.errors.name?.message ? (
                  <p className="text-xs text-[var(--fms-delete)]">
                    {formState.errors.name.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">
                  Description{" "}
                  <span className="text-[var(--fms-delete)]">*</span>
                </Label>
                <textarea
                  id="description"
                  {...register("description", {
                    required: "Description is required",
                    validate: (value) =>
                      value.trim() !== "" || "Description cannot be empty",
                  })}
                  placeholder="Enter description"
                  className="min-h-20 w-full rounded-md border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--fms-info-border)] aria-invalid:border-[var(--fms-delete)]"
                  aria-invalid={formState.errors.description ? true : undefined}
                />
                {formState.errors.description?.message ? (
                  <p className="text-xs text-[var(--fms-delete)]">
                    {formState.errors.description.message}
                  </p>
                ) : null}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    (editingCode ? !crud.canUpdate : !crud.canCreate)
                  }
                >
                  {editingCode ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
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
                placeholder={`Search ${config.entityLabel.toLowerCase()}...`}
                className="pl-9"
              />
            </div>
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  {[
                    "Sl.No",
                    "Code",
                    config.entityLabel,
                    "Description",
                    "Status",
                  ].map((column) => (
                    <th
                      key={column}
                      className="px-4 py-3 text-left font-semibold"
                    >
                      {column}
                    </th>
                  ))}
                  <th
                    key={"column"}
                    className="px-4 py-3  text-center font-semibold"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {listQuery.isLoading ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      Loading records...
                    </td>
                  </tr>
                ) : crud.isResolved && !crud.canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      You do not have permission to view this data.
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      No records found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr
                      key={`${config.queryKey}-${index}`}
                      className="border-t border-[var(--fms-strokes)]"
                    >
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.serialNo}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.code || "-"}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.name || "-"}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.description}
                      </td>
                      <td className="px-4 py-3">
                        <div className="inline-flex items-center gap-2">
                          <Switch
                            checked={row.active}
                            onCheckedChange={(checked) =>
                              onToggleStatus(row, checked)
                            }
                            disabled={
                              !crud.canUpdate || updateMutation.isPending
                            }
                          />
                          <span className="text-xs text-[var(--fms-text-subheading)]">
                            {row.active ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className={rowActionsContainerClassName}>
                          <EditRowActionButton
                            type="button"
                            disabled={!crud.canUpdate}
                            onClick={() => onEdit(row)}
                          />
                          <DeleteRowActionButton
                            type="button"
                            disabled={!crud.canDelete}
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

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={onConfirmDelete}
        title={`Delete ${config.entityLabel}`}
        description={`Are you sure you want to delete this ${config.entityLabel.toLowerCase()}? This action cannot be undone.`}
      />
    </section>
  );
}
