// Manages vehicle type and vehicle category master data from API-backed CRUD endpoints.
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search, X } from "lucide-react";
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
  DetailRowActionButton,
  EditRowActionButton,
  rowActionsContainerClassName,
} from "@/shared/components/TableRowActionButtons";
import { TablePagination } from "@/shared/components/TablePagination";
import { applyPagination } from "@/shared/utils/pagination";
import { useRouteCrudPermissions } from "@/shared/hooks/useRouteCrudPermissions";
import { showErrorToast, showSuccessToast } from "@/shared/lib/toast";
import { Badge } from "@/components/ui/badge";
import { SearchableAutocomplete } from "@/shared/components/SearchableAutocomplete";
import { SearchableMultiAutocomplete } from "@/shared/components/SearchableMultiAutocomplete";

const tabs = ["Vehicle Category", "Vehicle Type"] as const;
type VehicleMetaTab = (typeof tabs)[number];
type ApiRecord = Record<string, unknown>;

type VehicleCategoryFormValues = {
  code: string;
  name: string;
  description: string;
};

type VehicleTypeFormValues = {
  vehicle_category_id: string;
  asset_names: string[];
  asset_name: string;
};

type FormValues = VehicleCategoryFormValues & VehicleTypeFormValues;

type MasterPayload = Record<string, string | number | boolean | string[]>;

type MasterRow = {
  serialNo: number;
  code: string;
  name: string;
  description: string;
  vehicle_category_id: string;
  vehicle_category_name: string;
  asset_names: string[];
  active: boolean;
};

function toText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function parseAssetNames(payload: unknown): string[] {
  if (Array.isArray(payload)) {
    return payload
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
          const record = item as ApiRecord;
          return (
            toText(record.name) ||
            toText(record.asset_name) ||
            toText(record.code)
          );
        }
        return "";
      })
      .filter((name) => name.length > 0);
  }
  return toArray(payload)
    .map(
      (record) =>
        toText(record.name) || toText(record.asset_name) || toText(record.code),
    )
    .filter((name) => name.length > 0);
}

function categoryId(record: ApiRecord) {
  return record.id != null && String(record.id).trim() !== ""
    ? String(record.id)
    : "";
}

function vehicleCategoryFromRecord(record: ApiRecord): ApiRecord | null {
  const nested = record.vehicle_category;
  if (nested && typeof nested === "object") return nested as ApiRecord;
  return null;
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

function mapRows(records: ApiRecord[], serialStart: number): MasterRow[] {
  return records.map((record, index) => {
    const vehicleCategory = vehicleCategoryFromRecord(record);
    return {
      serialNo: serialStart + index + 1,
      code: toText(record.code),
      name: toText(record.name),
      description: toText(record.description) || "-",
      vehicle_category_id:
        toText(record.vehicle_category_id) ||
        (vehicleCategory ? categoryId(vehicleCategory) : ""),
      vehicle_category_name: vehicleCategory
        ? toText(vehicleCategory.name)
        : toText(record.vehicle_category_name),
      asset_names: assetNamesFromRecord(record),
      active:
        typeof record.active === "boolean"
          ? record.active
          : record.active === 1 || record.active === "1",
    };
  });
}

function emptyValues(): FormValues {
  return {
    code: "",
    name: "",
    description: "",
    vehicle_category_id: "",
    asset_names: [],
    asset_name: "",
  };
}

function assetNamesTriggerLabel(names: string[]) {
  if (names.length === 0) return "Select asset names";
  if (names.length === 1) return names[0];
  return `${names.length} asset names selected`;
}

function assetNamesFromRecord(record: ApiRecord): string[] {
  const raw = record.asset_names;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((name) => name.length > 0);
}

function listPath(
  basePath: string,
  search: string,
  page: number,
  pageSize: number,
) {
  const q = encodeURIComponent(search.trim());
  return `${basePath}?page=${page}&page_size=${pageSize}&code=&search=${q}`;
}

type MasterSectionProps = {
  title: string;
  subtitle: string;
  basePath: string;
  queryKey: string;
  deleteTitle: string;
};

/** Full CRUD + pagination for one master resource; parameterized by `basePath` and React Query `queryKey`. */
function MasterSection({
  title,
  subtitle,
  basePath,
  queryKey,
  deleteTitle,
}: MasterSectionProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [selectedDeleteCode, setSelectedDeleteCode] = useState<string | null>(
    null,
  );
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState,
    watch,
    setValue,
    setError,
    clearErrors,
  } = useForm<FormValues>({ defaultValues: emptyValues() });
  const selectedAssetNames = watch("asset_names");
  const selectedAssetName = watch("asset_name");
  const isVehicleType = title === "Vehicle Type";
  const isEditing = Boolean(editingCode);

  const crud = useRouteCrudPermissions("/master/vehicle-type-category", {
    subMenuNameHint: title,
  });

  const vehicleCategoryQuery = useQuery({
    queryKey: ["master-vehicle-categories"],
    queryFn: async () => {
      const payload = await apiGet<unknown>("/master/vehicle-categories");
      return toArray(payload);
    },
    enabled: isVehicleType,
  });

  const assetNamesQuery = useQuery({
    queryKey: ["master-asset-names"],
    queryFn: async () => {
      const payload = await apiGet<unknown>("/master/asset-names");
      return parseAssetNames(payload);
    },
    enabled: isVehicleType,
  });

  const vehicleCategoryAutocompleteOptions = useMemo(
    () =>
      (vehicleCategoryQuery.data ?? [])
        .map((category) => {
          const id = categoryId(category);
          if (!id) return null;
          return { value: id, label: toText(category.name) };
        })
        .filter((item): item is { value: string; label: string } => item !== null),
    [vehicleCategoryQuery.data],
  );

  const assetNameAutocompleteOptions = useMemo(
    () =>
      (assetNamesQuery.data ?? []).map((name) => ({
        value: name,
        label: name,
      })),
    [assetNamesQuery.data],
  );

  const listQuery = useQuery({
    queryKey: [queryKey, search, page, pageSize],
    queryFn: async () => {
      const payload = await apiGet<unknown>(
        listPath(basePath, search, page, pageSize),
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
    mutationFn: (payload: MasterPayload) =>
      isVehicleType
        ? apiPost<unknown, MasterPayload>("/master/vehicle-types/bulk", payload)
        : apiPost<unknown, MasterPayload>(basePath, payload),
    onSuccess: () => {
      showSuccessToast(`${title} created successfully`);
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : `Failed to create ${title.toLowerCase()}`;
      showErrorToast(message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ code, payload }: { code: string; payload: MasterPayload }) =>
      apiPut<unknown, MasterPayload>(
        `${basePath}/${encodeURIComponent(code)}`,
        payload,
      ),
    onSuccess: () => {
      showSuccessToast(`${title} updated successfully`);
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : `Failed to update ${title.toLowerCase()}`;
      showErrorToast(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (code: string) =>
      apiDelete<unknown>(`${basePath}/${encodeURIComponent(code)}`),
    onSuccess: () => {
      showSuccessToast(`${title} deleted successfully`);
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : `Failed to delete ${title.toLowerCase()}`;
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

  const tableColumns = isVehicleType
    ? ["Sl.No", "Vehicle Category", "Vehicle Type", "Code"]
    : ["Sl.No", "Code", title, "Description", "Status"];

  const onCreateOpen = () => {
    if (!crud.canCreate) return;
    setEditingCode(null);
    reset(emptyValues());
    setDialogOpen(true);
  };

  const onEdit = (row: MasterRow) => {
    if (!crud.canUpdate) return;
    if (!row.code) {
      showErrorToast(`Missing code for ${title.toLowerCase()} update`);
      return;
    }
    setEditingCode(row.code);
    reset({
      ...emptyValues(),
      ...(isVehicleType
        ? {
            vehicle_category_id: row.vehicle_category_id,
            asset_name: row.name,
          }
        : {
            code: row.code,
            name: row.name,
            description: row.description === "-" ? "" : row.description,
          }),
    });
    setDialogOpen(true);
  };

  const onDeleteRequest = (row: MasterRow) => {
    if (!crud.canDelete) return;
    if (!row.code) {
      showErrorToast(`Missing code for ${title.toLowerCase()} delete`);
      return;
    }
    setSelectedDeleteCode(row.code);
    setDeleteOpen(true);
  };

  const onViewCategoryTypes = (row: MasterRow) => {
    if (!crud.canRead) return;
    if (!row.code) {
      showErrorToast("Missing code for vehicle category detail");
      return;
    }
    navigate(`/master/vehicle-type-category/${encodeURIComponent(row.code)}`);
  };

  const onConfirmDelete = () => {
    if (!crud.canDelete) return;
    if (!selectedDeleteCode) return;
    deleteMutation.mutate(selectedDeleteCode);
    setSelectedDeleteCode(null);
  };

  const removeAssetName = (name: string) => {
    const next = watch("asset_names").filter((item) => item !== name);
    setValue("asset_names", next, { shouldValidate: true });
  };

  const onSubmit = (raw: FormValues) => {
    if (editingCode && !crud.canUpdate) return;
    if (!editingCode && !crud.canCreate) return;

    let payload: MasterPayload;

    if (isVehicleType) {
      if (editingCode) {
        if (!raw.asset_name.trim()) {
          setError("asset_name", {
            type: "manual",
            message: "Asset name is required",
          });
          return;
        }
        payload = {
          vehicle_category_id: raw.vehicle_category_id.trim(),
          name: raw.asset_name.trim(),
        };
      } else {
        if (raw.asset_names.length === 0) {
          setError("asset_names", {
            type: "manual",
            message: "Select at least one asset name",
          });
          return;
        }
        payload = {
          vehicle_category_id: raw.vehicle_category_id.trim(),
          asset_names: raw.asset_names,
        };
      }
    } else {
      payload = {
        code: raw.code.trim(),
        name: raw.name.trim(),
        description: raw.description.trim(),
      };
      if (!editingCode) {
        payload.display_order = 1;
        payload.active = true;
      }
    }

    if (editingCode) {
      updateMutation.mutate({ code: editingCode, payload });
    } else {
      createMutation.mutate(payload);
    }
    setDialogOpen(false);
    setEditingCode(null);
    reset(emptyValues());
  };

  const onToggleStatus = (row: MasterRow, checked: boolean) => {
    if (!crud.canUpdate) return;
    if (!row.code) {
      showErrorToast(`Missing code for ${title.toLowerCase()} status update`);
      return;
    }
    updateMutation.mutate({
      code: row.code,
      payload: {
        active: checked,
        name: row.name,
        vehicle_category_id: row.vehicle_category_id.trim(),
      },
    });
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title={title} subtitle={subtitle} />
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
          <DialogContent className="flex max-h-[min(90vh,640px)] max-w-lg flex-col overflow-hidden p-2">
            <DialogHeader className="shrink-0 px-4 pt-4">
              <DialogTitle>
                {editingCode ? `Update ${title}` : `Add New ${title}`}
              </DialogTitle>
            </DialogHeader>

            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={handleSubmit(onSubmit)}
              noValidate
            >
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-1">
                {isVehicleType ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="vehicle_category_id">
                        Vehicle Category{" "}
                        <span className="text-[var(--fms-delete)]">*</span>
                      </Label>
                      <input
                        type="hidden"
                        {...register("vehicle_category_id", {
                          required: "Vehicle category is required",
                          validate: (value) =>
                            value.trim() !== "" ||
                            "Vehicle category cannot be empty",
                        })}
                      />
                      <SearchableAutocomplete
                        id="vehicle_category_id"
                        value={watch("vehicle_category_id")}
                        onChange={(value) =>
                          setValue("vehicle_category_id", value, {
                            shouldValidate: true,
                          })
                        }
                        options={vehicleCategoryAutocompleteOptions}
                        loading={vehicleCategoryQuery.isLoading}
                        error={!!formState.errors.vehicle_category_id}
                        placeholder="Select vehicle category"
                        searchPlaceholder="Type to search categories…"
                      />
                      {formState.errors.vehicle_category_id?.message ? (
                        <p className="text-xs text-[var(--fms-delete)]">
                          {formState.errors.vehicle_category_id.message}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={isEditing ? "asset_name" : "asset_names"}>
                        Asset name{" "}
                        <span className="text-[var(--fms-delete)]">*</span>
                      </Label>
                      {isEditing ? (
                        <>
                          <input
                            type="hidden"
                            {...register("asset_name", {
                              required: "Asset name is required",
                              validate: (value) =>
                                value.trim() !== "" ||
                                "Asset name cannot be empty",
                            })}
                          />
                          <SearchableAutocomplete
                            id="asset_name"
                            value={selectedAssetName}
                            onChange={(value) =>
                              setValue("asset_name", value, {
                                shouldValidate: true,
                              })
                            }
                            options={assetNameAutocompleteOptions}
                            loading={assetNamesQuery.isLoading}
                            error={!!formState.errors.asset_name}
                            placeholder="Select asset name"
                            searchPlaceholder="Type to search asset names…"
                          />
                          {formState.errors.asset_name?.message ? (
                            <p className="text-xs text-[var(--fms-delete)]">
                              {formState.errors.asset_name.message}
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <SearchableMultiAutocomplete
                            id="asset_names"
                            value={selectedAssetNames}
                            onChange={(names) => {
                              setValue("asset_names", names, {
                                shouldValidate: true,
                              });
                              if (names.length > 0) clearErrors("asset_names");
                            }}
                            options={assetNameAutocompleteOptions}
                            loading={assetNamesQuery.isLoading}
                            disabled={assetNamesQuery.isError}
                            error={!!formState.errors.asset_names}
                            placeholder="Select asset names"
                            searchPlaceholder="Type to search asset names…"
                            emptyMessage="No asset names available."
                            loadingMessage="Loading asset names..."
                            formatTriggerLabel={(names) =>
                              assetNamesTriggerLabel(names)
                            }
                            side="top"
                          />
                          {selectedAssetNames.length > 0 ? (
                            <div className="max-h-28 overflow-x-auto overflow-y-auto overscroll-contain rounded-md border border-[var(--fms-strokes)] p-2">
                              <div className="flex flex-wrap gap-1.5">
                                {selectedAssetNames.map((name) => (
                                  <Badge
                                    key={name}
                                    variant="secondary"
                                    className="gap-1 pr-1 font-normal"
                                  >
                                    {name}
                                    <button
                                      type="button"
                                      className="rounded-sm p-0.5 hover:bg-black/10"
                                      aria-label={`Remove ${name}`}
                                      onClick={() => removeAssetName(name)}
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          {formState.errors.asset_names?.message ? (
                            <p className="text-xs text-[var(--fms-delete)]">
                              {formState.errors.asset_names.message}
                            </p>
                          ) : null}
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <>
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
                        disabled={Boolean(editingCode)}
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
                        {title}{" "}
                        <span className="text-[var(--fms-delete)]">*</span>
                      </Label>
                      <Input
                        id="name"
                        {...register("name", {
                          required: `${title} is required`,
                          validate: (value) =>
                            value.trim() !== "" || `${title} cannot be empty`,
                        })}
                        placeholder={`Enter ${title.toLowerCase()}`}
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
                            value.trim() !== "" ||
                            "Description cannot be empty",
                        })}
                        placeholder="Enter description"
                        className="min-h-20 w-full rounded-md border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--fms-info-border)] aria-invalid:border-[var(--fms-delete)]"
                        aria-invalid={
                          formState.errors.description ? true : undefined
                        }
                      />
                      {formState.errors.description?.message ? (
                        <p className="text-xs text-[var(--fms-delete)]">
                          {formState.errors.description.message}
                        </p>
                      ) : null}
                    </div>
                  </>
                )}
              </div>

              <DialogFooter className="shrink-0">
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
                placeholder={`Search ${title.toLowerCase()}...`}
                className="pl-9"
              />
            </div>
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  {tableColumns.map((column) => (
                    <th
                      key={column}
                      className="px-4 py-3 text-left font-semibold"
                    >
                      {column}
                    </th>
                  ))}
                  <th
                    key={"column"}
                    className="px-4 py-3 text-center font-semibold"
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
                      key={`${queryKey}-${index}`}
                      className="border-t border-[var(--fms-strokes)]"
                    >
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.serialNo}
                      </td>

                      {isVehicleType ? (
                        <>
                          <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                            {row.vehicle_category_name || "-"}
                          </td>
                          <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                            {row.name || "-"}
                          </td>
                          <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                            {row.code || "-"}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                            {row.code || "-"}
                          </td>
                          <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                            {row.name || "-"}
                          </td>
                          <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                            {row.description}
                          </td>
                        </>
                      )}
                      {!isVehicleType && (
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
                      )}
                      <td className="px-4 py-3">
                        <div className={rowActionsContainerClassName}>
                          {!isVehicleType ? (
                            <DetailRowActionButton
                              type="button"
                              tooltip="View vehicle type"
                              disabled={!crud.canRead}
                              onClick={() => onViewCategoryTypes(row)}
                              aria-label={`View vehicle types for ${row.name || row.code}`}
                            />
                          ) : null}
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
        title={deleteTitle}
        description={`Are you sure you want to delete this ${title.toLowerCase()}? This action cannot be undone.`}
      />
    </section>
  );
}

function tabFromSearchParam(tab: string | null): VehicleMetaTab {
  if (tab === "category") return "Vehicle Category";
  if (tab === "type") return "Vehicle Type";
  return "Vehicle Category";
}

/** Routes between Vehicle Type and Vehicle Category CRUD sub-pages using local tab state only. */
export function VehicleTypeCategoryPage() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<VehicleMetaTab>(() =>
    tabFromSearchParam(searchParams.get("tab")),
  );

  return (
    <section className="space-y-4">
      <div className="space-y-4">
        <div className="inline-flex w-full max-w-full overflow-x-auto rounded-md bg-[#e8ebf0] p-1 sm:w-auto">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
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

      {activeTab === "Vehicle Type" ? (
        <MasterSection
          title="Vehicle Type"
          subtitle="Manage vehicle type records and configurations"
          basePath="/master/vehicle-types"
          queryKey="master-vehicle-type"
          deleteTitle="Delete Vehicle Type"
        />
      ) : (
        <MasterSection
          title="Vehicle Category"
          subtitle="Manage vehicle category records and configurations"
          basePath="/master/vehicle-categories"
          queryKey="master-vehicle-categories"
          deleteTitle="Delete Vehicle Category"
        />
      )}
    </section>
  );
}
