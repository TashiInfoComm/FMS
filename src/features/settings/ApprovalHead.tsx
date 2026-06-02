import { useMemo, useState } from "react";
import { CloudUpload, Plus, RotateCcw, Search } from "lucide-react";
import { useForm } from "react-hook-form";
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
import {
  createApprovalHead,
  deleteApprovalHead,
  fetchApprovalHeadsPage,
  toApprovalHeadPayload,
  updateApprovalHead,
  type ApprovalHeadTableRow,
} from "@/features/settings/lib/approval-head-api";
import { DeleteDialog } from "@/shared/components/DeleteDialog";
import { PageHeader } from "@/shared/components/PageHeader";
import {
  DeleteRowActionButton,
  DetailRowActionButton,
  EditRowActionButton,
  rowActionsContainerClassName,
} from "@/shared/components/TableRowActionButtons";
import { TablePagination } from "@/shared/components/TablePagination";
import { useRouteCrudPermissions } from "@/shared/hooks/useRouteCrudPermissions";
import { showErrorToast, showSuccessToast } from "@/shared/lib/toast";
import { useNavigate } from "react-router-dom";

type FormValues = {
  name: string;
  description: string;
};

const LIST_QUERY_KEY = "workflows/approval-heads";

function emptyValues(): FormValues {
  return {
    name: "",
    description: "",
  };
}

function ApprovalHead() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingIsActive, setEditingIsActive] = useState(true);
  const [selectedDeleteId, setSelectedDeleteId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const crud = useRouteCrudPermissions("/settings/approval-head");
  const canCreate = !crud.isResolved || crud.canCreate;
  const canUpdate = !crud.isResolved || crud.canUpdate;
  const canDelete = !crud.isResolved || crud.canDelete;
  const canRead = !crud.isResolved || crud.canRead;

  const { register, handleSubmit, reset, formState } = useForm<FormValues>({
    defaultValues: emptyValues(),
  });

  const listQuery = useQuery({
    queryKey: [LIST_QUERY_KEY, search, page, pageSize],
    queryFn: () => fetchApprovalHeadsPage(search, page, pageSize),
    enabled: canRead,
  });

  const createMutation = useMutation({
    mutationFn: createApprovalHead,
    onSuccess: () => {
      showSuccessToast("Approval head created successfully");
      queryClient.invalidateQueries({ queryKey: [LIST_QUERY_KEY] });
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to create approval head";
      showErrorToast(message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: ReturnType<typeof toApprovalHeadPayload>;
    }) => updateApprovalHead(id, body),
    onSuccess: () => {
      showSuccessToast("Approval head updated successfully");
      queryClient.invalidateQueries({ queryKey: [LIST_QUERY_KEY] });
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update approval head";
      showErrorToast(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteApprovalHead,
    onSuccess: () => {
      showSuccessToast("Approval head deleted successfully");
      queryClient.invalidateQueries({ queryKey: [LIST_QUERY_KEY] });
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to delete approval head";
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

  const onEdit = (row: ApprovalHeadTableRow) => {
    if (!canUpdate) return;
    setEditingId(row.id);
    setEditingIsActive(row.isActive);
    reset({
      name: row.name,
      description: row.description,
    });
    setDialogOpen(true);
  };

  const onDeleteRequest = (row: ApprovalHeadTableRow) => {
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
    if (!raw.name.trim() || !raw.description.trim()) return;
    if (editingId && !canUpdate) return;
    if (!editingId && !canCreate) return;

    const body = toApprovalHeadPayload({
      ...raw,
      isActive: editingId ? editingIsActive : true,
    });

    if (editingId) {
      updateMutation.mutate(
        { id: editingId, body },
        { onSuccess: closeDialog },
      );
    } else {
      createMutation.mutate(body, { onSuccess: closeDialog });
    }
  };

  const onViewDetail = (row: ApprovalHeadTableRow) => {
    if (!crud.canRead) return;
    navigate(`/settings/approval-head/${encodeURIComponent(row.id)}/conditions`);
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Approval Head"
          subtitle="Configure approval heads used in workflow routing"
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
                placeholder="Search approval head..."
                className="pl-9"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[var(--fms-strokes)]">
            <table className="min-w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  {["Sl.No", "Name", "Description"].map((column) => (
                    <th
                      key={column}
                      className={
                        column === "ACTION"
                          ? "px-4 py-3 text-center font-semibold capitalize"
                          : "px-4 py-3 text-left font-semibold capitalize"
                      }
                    >
                      {column}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center font-semibold capitalize">Action</th>
                </tr>
              </thead>
              <tbody>
                {crud.isResolved && !canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      You do not have permission to view this data.
                    </td>
                  </tr>
                ) : listQuery.isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr
                      key={`ah-sk-${index}`}
                      className="border-t border-[var(--fms-strokes)]"
                    >
                      {Array.from({ length: 4 }).map((__, cellIndex) => (
                        <td key={cellIndex} className="px-4 py-3">
                          <Skeleton className="h-4 w-full max-w-[8rem]" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : listQuery.isError ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-[var(--fms-delete)]"
                    >
                      Failed to load approval heads.
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={4}
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
                        {row.description}
                      </td>
                      <td className="px-4 py-3">
                        <div className={rowActionsContainerClassName}>
                          <DetailRowActionButton
                            type="button"
                            tooltip="View approval conditions"
                            disabled={!canRead}
                            onClick={() => onViewDetail(row)}
                          />
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Update Approval Head" : "Create Approval Head"}
            </DialogTitle>
          </DialogHeader>

          <form
            className="space-y-5 py-1"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
          >
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="approval-head-name">
                  Name <span className="text-[var(--fms-delete)]">*</span>
                </Label>
                <Input
                  id="approval-head-name"
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
                <Label htmlFor="approval-head-description">
                  Description{" "}
                  <span className="text-[var(--fms-delete)]">*</span>
                </Label>
                <Input
                  id="approval-head-description"
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
        title="Delete Approval Head"
        description="Are you sure you want to delete this approval head? This action cannot be undone."
      />
    </section>
  );
}

export default ApprovalHead;
