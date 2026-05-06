/**
 * Users list at `/users`: loads `GET /admin/users` with search + pagination,
 * maps flexible API shapes to table rows, respects CRUD flags from `useRouteCrudPermissions('/users')`,
 * and wires Detail / Edit / Delete navigation (links avoid Radix `asChild` + Router issues).
 */
import { LayoutGrid, Pencil, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiDelete, apiGet } from "@/services/apiClient";
import { cn } from "@/lib/utils";
import { DeleteDialog } from "@/shared/components/DeleteDialog";
import { PageHeader } from "@/shared/components/PageHeader";
import {
  DeleteRowActionButton,
  detailRowActionButtonClassName,
  editRowActionButtonClassName,
  rowActionsContainerClassName,
} from "@/shared/components/TableRowActionButtons";
import { TablePagination } from "@/shared/components/TablePagination";
import { useRouteCrudPermissions } from "@/shared/hooks/useRouteCrudPermissions";
import { showErrorToast, showSuccessToast } from "@/shared/lib/toast";
import { applyPagination } from "@/shared/utils/pagination";

type ApiRecord = Record<string, unknown>;

type UserRow = {
  id: string;
  name: string;
  contact: string;
  email: string;
  username: string;
  enabled: boolean;
  status: string;
};

/** Coerces API scalars to trimmed string; numbers become string; everything else → `""`. */
function toText(value: unknown) {
  return typeof value === "string"
    ? value
    : typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : "";
}

/** Returns the first array-valued list field on a single response object (items, users, data[], …). */
function arrayFromEnvelope(obj: ApiRecord): unknown[] | null {
  const keys = [
    "items",
    "results",
    "users",
    "records",
    "rows",
    "list",
    "data",
  ] as const;
  for (const key of keys) {
    const v = obj[key];
    if (Array.isArray(v)) return v;
  }
  return null;
}

/**
 * Flattens common paginated JSON envelopes to a `Record[]`: top-level array, `{ data: [] }`,
 * or `{ data: { users|items|… } }` so one code path works across backends.
 */
function toArray(payload: unknown): ApiRecord[] {
  if (Array.isArray(payload))
    return payload.filter(
      (item): item is ApiRecord => !!item && typeof item === "object",
    );
  if (!payload || typeof payload !== "object") return [];
  const root = payload as ApiRecord;

  const direct = arrayFromEnvelope(root);
  if (direct)
    return direct.filter(
      (item): item is ApiRecord => !!item && typeof item === "object",
    );

  const data = root.data;
  if (Array.isArray(data)) {
    return data.filter(
      (item): item is ApiRecord => !!item && typeof item === "object",
    );
  }
  if (data && typeof data === "object") {
    const nested = arrayFromEnvelope(data as ApiRecord);
    if (nested)
      return nested.filter(
        (item): item is ApiRecord => !!item && typeof item === "object",
      );
  }

  return [];
}

/** Stable user id for routes and DELETE: prefers `id`, then `user_id`, uuid-style keys. */
function toId(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return "";
}

/** Human-readable display name from whichever name fields the API sends. */
function toName(record: ApiRecord) {
  const name = toText(record.name);
  if (name) return name;
  const first = toText(record.first_name);
  const last = toText(record.last_name);
  if (first || last) return [first, last].filter(Boolean).join(" ").trim();
  return toText(record.full_name) || toText(record.username) || "-";
}

/** Picks the first non-empty phone-style field for the Contact column. */
function toContact(record: ApiRecord) {
  return toText(record.contact_no) || "-";
}

/** Login id for the Username column. */
function toUsername(record: ApiRecord) {
  return toText(record.username) || "-";
}

/** Email column; falls back to `-` when missing. */
function toEmail(record: ApiRecord) {
  return toText(record.email) || "-";
}

/** Flattens `{ user: { … } }` / `{ profile: { … } }` list rows so fields align with flat detail payloads. */
function mergeNestedUserEnvelope(record: ApiRecord): ApiRecord {
  let merged: ApiRecord = { ...record };
  const u = record.user;
  if (u && typeof u === "object" && !Array.isArray(u)) {
    merged = { ...merged, ...(u as ApiRecord) };
  }
  const p = record.profile;
  if (p && typeof p === "object" && !Array.isArray(p)) {
    merged = { ...merged, ...(p as ApiRecord) };
  }
  return merged;
}

/** Registration / approval status; coerces to string (React renders `undefined` / most booleans as empty). */
function pickStatus(record: ApiRecord): string {
  const attrs = record.attributes;
  const fromAttributes = (): string => {
    if (!attrs || typeof attrs !== "object" || Array.isArray(attrs)) return "";
    const a = attrs as Record<string, unknown>;
    for (const key of ["status"]) {
      const v = a[key];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (Array.isArray(v) && typeof v[0] === "string" && v[0].trim())
        return v[0].trim();
    }
    return "";
  };

  const direct =
    toText(record.status) ||
    toText(record.user_status) ||
    toText(record.account_status) ||
    toText(record.registration_status) ||
    toText(record.approval_status) ||
    toText((record as { userStatus?: unknown }).userStatus) ||
    toText((record as { accountStatus?: unknown }).accountStatus);

  const raw = record.status;
  if (!direct && raw && typeof raw === "object" && !Array.isArray(raw)) {
    const code =
      toText((raw as ApiRecord).code) || toText((raw as ApiRecord).value);
    if (code) return code;
  }

  return direct || fromAttributes() || "-";
}

/** List cell text color for known registration statuses. */
function statusDisplayClass(status: string) {
  const key = status.trim().toLowerCase();
  if (key === "approved")
    return "text-xs text-[var(--fms-success-text)] font-medium";
  if (key === "pending")
    return "text-xs text-[var(--fms-info-text)] font-medium";
  if (key === "rejected")
    return "text-xs text-[var(--fms-error-text)] font-medium";
  return "text-xs";
}

/** Maps raw API records into the row shape used by the table and keys. */
function mapUserRows(records: ApiRecord[]): UserRow[] {
  return records.map((raw) => {
    const record = mergeNestedUserEnvelope(raw);
    const id = toId(
      record.id ??
        record.user_id ??
        record.uuid ??
        record.keycloak_id ??
        record.keycloak_user_id,
    );
    return {
      id,
      name: toName(record),
      contact: toContact(record),
      email: toEmail(record),
      username: toUsername(record),
      enabled: Boolean(record.enabled),
      status: pickStatus(record),
    };
  });
}

/** Builds the list query path; omits `search` when empty so strict backends do not error. */
function usersListPath(search: string, page: number, pageSize: number) {
  const base = `/admin/users?page=${page}&page_size=${pageSize}`;
  const q = search.trim();
  if (!q) return base;
  return `${base}&search=${encodeURIComponent(q)}`;
}

/** Styles for the “Detail” router link (same look as `DetailRowActionButton`, no `asChild`). */
const viewLinkClassName = cn(
  detailRowActionButtonClassName,
  "inline-flex items-center justify-center px-2.5 text-sm font-medium no-underline",
);

/** Styles for the “Edit” router link to `/users/:id/edit`. */
const editLinkClassName = cn(
  editRowActionButtonClassName,
  "inline-flex items-center justify-center px-2.5 text-sm font-medium no-underline",
);

/**
 * Route: `/users`. Fetches user list, applies server/client pagination metadata, gates UI by `canRead`/`canCreate`/`canDelete`.
 */
export function CreateUserListPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const crud = useRouteCrudPermissions("/users");

  const listQuery = useQuery({
    queryKey: ["admin-users", search, page, pageSize],
    queryFn: async () => {
      const payload = await apiGet<unknown>(
        usersListPath(search, page, pageSize),
      );
      const records = mapUserRows(toArray(payload));
      const paged = applyPagination(payload, records, page, pageSize, {
        page,
        pageSize,
        pageLength: records.length,
      });
      return {
        rows: paged.rows,
        totalCount: paged.totalCount,
        totalPages: paged.totalPages,
        effectivePageSize: paged.effectivePageSize,
        serialBase: paged.serialBase,
      };
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (!crud.canDelete) {
        throw new Error("You do not have permission to delete users.");
      }
      return apiDelete<unknown>(`/admin/users/${encodeURIComponent(id)}`);
    },
    onSuccess: () => {
      showSuccessToast("User removed successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Failed to delete user";
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
    Math.max(1, Math.ceil(totalCount / Math.max(1, effectivePageSize)));
  const serialBase = listQuery.data?.serialBase ?? (page - 1) * pageSize;

  /** Opens delete dialog after permission + id checks. */
  const askDelete = (id: string) => {
    if (!crud.canDelete) return;
    if (!id) {
      showErrorToast("Cannot delete: missing user id");
      return;
    }
    setSelectedId(id);
    setDeleteOpen(true);
  };

  /** Confirms delete: runs mutation then clears `selectedId` in `onSettled`. */
  const onConfirmDelete = () => {
    if (!crud.canDelete) return;
    if (selectedId === null) return;
    deleteMutation.mutate(selectedId, {
      onSettled: () => setSelectedId(null),
    });
  };

  const listError = listQuery.isError
    ? listQuery.error instanceof Error
      ? listQuery.error.message
      : "Failed to load users"
    : null;

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Create User"
          subtitle="Manage user records and configurations"
        />
        {crud.canCreate ? (
          <Button asChild className="w-full sm:w-auto">
            <Link to="/users/add">
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
                placeholder="Search name, username, email…"
                className="pl-9"
              />
            </div>
          </div>

          <div className="hidden overflow-hidden rounded-lg border border-[var(--fms-strokes)] md:block">
            <table className="w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Sl.No</th>
                  <th className="px-4 py-3 text-left font-semibold">Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Contact</th>
                  <th className="px-4 py-3 text-left font-semibold">Email</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Username
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-center font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {listQuery.isLoading ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      Loading users...
                    </td>
                  </tr>
                ) : listError ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-[var(--fms-delete)]"
                    >
                      {listError}
                    </td>
                  </tr>
                ) : crud.isResolved && !crud.canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      You do not have permission to view this data.
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      No users found.
                    </td>
                  </tr>
                ) : (
                  rows.map((user, index) => (
                    <tr
                      key={user.id || `user-${serialBase + index}`}
                      className="border-t border-[var(--fms-strokes)]"
                    >
                      <td className="px-4 py-3">{serialBase + index + 1}</td>
                      <td className="px-4 py-3">{user.name}</td>
                      <td className="px-4 py-3">{user.contact}</td>
                      <td className="px-4 py-3">{user.email}</td>
                      <td className="px-4 py-3">{user.username}</td>
                      <td className="px-4 py-3">
                        <span className={cn(statusDisplayClass(user.status))}>
                          {user.status}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className={rowActionsContainerClassName}>
                          {user.id ? (
                            <Link
                              to={`/users/${encodeURIComponent(user.id)}`}
                              className={viewLinkClassName}
                              aria-label="View user"
                            >
                              <LayoutGrid
                                aria-hidden
                                className="size-3.5 shrink-0"
                              />
                              Detail
                            </Link>
                          ) : (
                            <span
                              className={cn(
                                viewLinkClassName,
                                "pointer-events-none opacity-45",
                              )}
                              aria-disabled
                            >
                              <LayoutGrid
                                aria-hidden
                                className="size-3.5 shrink-0"
                              />
                              Detail
                            </span>
                          )}
                          {user.id ? (
                            <Link
                              to={`/users/${encodeURIComponent(user.id)}/edit`}
                              className={editLinkClassName}
                              aria-label="Edit user"
                            >
                              <Pencil
                                aria-hidden
                                className="size-3.5 shrink-0"
                              />
                              Edit
                            </Link>
                          ) : (
                            <span
                              className={cn(
                                editLinkClassName,
                                "pointer-events-none opacity-45",
                              )}
                              aria-disabled
                            >
                              <Pencil
                                aria-hidden
                                className="size-3.5 shrink-0"
                              />
                              Edit
                            </span>
                          )}
                          <DeleteRowActionButton
                            type="button"
                            disabled={!crud.canDelete || !user.id}
                            onClick={() => askDelete(user.id)}
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
            {listQuery.isLoading ? (
              <p className="py-6 text-center text-[var(--fms-text-subheading)]">
                Loading users...
              </p>
            ) : listError ? (
              <p className="py-6 text-center text-[var(--fms-delete)]">
                {listError}
              </p>
            ) : crud.isResolved && !crud.canRead ? (
              <p className="py-6 text-center text-[var(--fms-text-subheading)]">
                You do not have permission to view this data.
              </p>
            ) : rows.length === 0 ? (
              <p className="py-6 text-center text-[var(--fms-text-subheading)]">
                No users found.
              </p>
            ) : (
              rows.map((user, index) => (
                <div
                  key={user.id || `user-m-${serialBase + index}`}
                  className="rounded-lg border border-[var(--fms-strokes)] bg-white p-3"
                >
                  <p className="text-sm text-[var(--fms-text-subheading)]">
                    <span className="font-medium text-[var(--fms-text-header)]">
                      Sl.No:
                    </span>{" "}
                    {serialBase + index + 1}
                  </p>
                  <p className="text-sm text-[var(--fms-text-subheading)]">
                    <span className="font-medium text-[var(--fms-text-header)]">
                      Name:
                    </span>{" "}
                    {user.name}
                  </p>
                  <p className="text-sm text-[var(--fms-text-subheading)]">
                    <span className="font-medium text-[var(--fms-text-header)]">
                      Contact:
                    </span>{" "}
                    {user.contact}
                  </p>
                  <p className="text-sm text-[var(--fms-text-subheading)]">
                    <span className="font-medium text-[var(--fms-text-header)]">
                      Email:
                    </span>{" "}
                    {user.email}
                  </p>
                  <p className="text-sm text-[var(--fms-text-subheading)]">
                    <span className="font-medium text-[var(--fms-text-header)]">
                      Username:
                    </span>{" "}
                    {user.username}
                  </p>
                  <p className="text-sm text-[var(--fms-text-subheading)]">
                    <span className="font-medium text-[var(--fms-text-header)]">
                      Status:
                    </span>{" "}
                    {user.status}
                  </p>
                  <div className={`mt-3 ${rowActionsContainerClassName}`}>
                    {user.id ? (
                      <Link
                        to={`/users/${encodeURIComponent(user.id)}`}
                        className={viewLinkClassName}
                        aria-label="View user"
                      >
                        <LayoutGrid aria-hidden className="size-3.5 shrink-0" />
                        View
                      </Link>
                    ) : (
                      <span
                        className={cn(
                          viewLinkClassName,
                          "pointer-events-none opacity-45",
                        )}
                        aria-disabled
                      >
                        <LayoutGrid aria-hidden className="size-3.5 shrink-0" />
                        View
                      </span>
                    )}
                    {user.id ? (
                      <Link
                        to={`/users/${encodeURIComponent(user.id)}/edit`}
                        className={editLinkClassName}
                        aria-label="Edit user"
                      >
                        <Pencil aria-hidden className="size-3.5 shrink-0" />
                        Edit
                      </Link>
                    ) : (
                      <span
                        className={cn(
                          editLinkClassName,
                          "pointer-events-none opacity-45",
                        )}
                        aria-disabled
                      >
                        <Pencil aria-hidden className="size-3.5 shrink-0" />
                        Edit
                      </span>
                    )}
                    <DeleteRowActionButton
                      type="button"
                      disabled={!crud.canDelete || !user.id}
                      onClick={() => askDelete(user.id)}
                    />
                  </div>
                </div>
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
        onOpenChange={setDeleteOpen}
        onConfirm={onConfirmDelete}
        title="Delete User"
        description="Are you sure you want to delete this user? This action cannot be undone."
      />
    </section>
  );
}
