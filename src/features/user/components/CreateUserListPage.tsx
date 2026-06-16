/**
 * Users list at `/users`: loads `GET /admin/users` with search, optional `status`, optional `role_name`, and pagination,
 * maps flexible API shapes to table rows, respects CRUD flags from `useRouteCrudPermissions('/users')`,
 * and wires Detail / Edit / Delete navigation (links avoid Radix `asChild` + Router issues).
 */
import { LayoutGrid, Pencil, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { realmRoleNamesFromUserRecord } from "@/features/user/lib/users-api";
import { fetchAdminRoleOptions } from "@/features/user/lib/roles-api";
import { apiDelete, apiGet } from "@/services/apiClient";
import { cn } from "@/lib/utils";
import { DeleteDialog } from "@/shared/components/DeleteDialog";
import { PageHeader } from "@/shared/components/PageHeader";
import {
  DeleteRowActionButton,
  DetailRowActionButton,
  detailRowActionButtonClassName,
  EditRowActionButton,
  editRowActionButtonClassName,
  rowActionsContainerClassName,
} from "@/shared/components/TableRowActionButtons";
import { TablePagination } from "@/shared/components/TablePagination";
import { useRouteCrudPermissions } from "@/shared/hooks/useRouteCrudPermissions";
import { formatRealmRoleDisplayName } from "@/shared/lib/format-realm-role-display";
import { showErrorToast, showSuccessToast } from "@/shared/lib/toast";
import { applyPagination } from "@/shared/utils/pagination";

type ApiRecord = Record<string, unknown>;

type UserRow = {
  id: string;
  name: string;
  contact: string;
  email: string;
  username: string;
  roles: string[];
  enabled: boolean;
  status: string;
};

/** First role as plain text (like other columns); additional roles open in a popover of badges. */
function UserRolesListValue({ roles }: { roles: string[] }) {
  if (roles.length === 0) {
    return (
      <span className="text-[var(--fms-text-subheading)]">—</span>
    );
  }
  const firstLabel = formatRealmRoleDisplayName(roles[0]);
  const rest = roles.slice(1);
  if (rest.length === 0) {
    return <span>{firstLabel}</span>;
  }
  return (
    <span className="inline-flex max-w-[14rem] flex-wrap items-baseline gap-x-1.5 gap-y-1">
      <span>{firstLabel}</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="link"
            size="xs"
            className="inline h-auto min-h-0 px-0 py-0 underline-offset-2"
            aria-label={`${rest.length} more roles`}
          >
            +{rest.length}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto max-w-xs" align="start">
          <div className="flex flex-wrap gap-1.5">
            {rest.map((role) => (
              <Badge key={role} variant="secondary" className="font-normal">
                {formatRealmRoleDisplayName(role)}
              </Badge>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </span>
  );
}

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
      roles: realmRoleNamesFromUserRecord(record),
      enabled: Boolean(record.enabled),
      status: pickStatus(record),
    };
  });
}

/** Registration status values sent to `GET /admin/users` (aligned with table display casing). */
const USER_STATUS_FILTER_OPTIONS = [
  { apiValue: "APPROVED", label: "Approved" },
  { apiValue: "PENDING", label: "Pending" },
  { apiValue: "REJECTED", label: "Rejected" },
] as const;

/** Sentinel for Radix Select (no empty `value` on items); maps to omitted `status` query param. */
const USER_STATUS_FILTER_ALL = "__all__";

/** Builds the list query path; omits `search` / `status` / `role_name` when empty so strict backends do not error. */
function usersListPath(
  search: string,
  status: string,
  roleName: string,
  page: number,
  pageSize: number,
) {
  let path = `/admin/users?page=${page}&page_size=${pageSize}`;
  const q = search.trim();
  if (q) path += `&search=${encodeURIComponent(q)}`;
  const st = status.trim();
  if (st) path += `&status=${encodeURIComponent(st)}`;
  const role = roleName.trim();
  if (role) path += `&role=${encodeURIComponent(role)}`;
  return path;
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

type UserStatusFilterSelectProps = {
  value: string;
  onValueChange: (apiValue: string) => void;
};

const USER_LIST_SKELETON_CAP = 8;

function UsersTableSkeletonBody({ rowCount }: { rowCount: number }) {
  return (
    <>
      {Array.from({ length: rowCount }).map((_, i) => (
        <tr
          key={`user-sk-${i}`}
          className="border-t border-[var(--fms-strokes)]"
        >
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-8" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-[min(100%,12rem)]" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-24" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-[min(100%,14rem)]" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-28" />
          </td>
          <td className="px-4 py-3">
            <div className="flex flex-wrap gap-1.5">
              <Skeleton className="h-5 w-16 rounded-md" />
              <Skeleton className="h-5 w-20 rounded-md" />
            </div>
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-20" />
          </td>
          <td className="px-4 py-3">
            <div className="flex justify-center gap-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-14" />
              <Skeleton className="h-8 w-8" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

function UsersMobileCardSkeleton({ rowCount }: { rowCount: number }) {
  return (
    <>
      {Array.from({ length: rowCount }).map((_, i) => (
        <div
          key={`user-m-sk-${i}`}
          className="space-y-2 rounded-lg border border-[var(--fms-strokes)] bg-white p-3"
        >
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-full max-w-xs" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-full max-w-sm" />
          <Skeleton className="h-4 w-36" />
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <Skeleton className="h-5 w-14 rounded-md" />
            <Skeleton className="h-5 w-20 rounded-md" />
          </div>
          <Skeleton className="h-4 w-24" />
          <div className="flex flex-wrap gap-2 pt-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-14" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
      ))}
    </>
  );
}

/** Sentinel for Radix Select (no empty `value` on items); maps to omitted `role_name` query param. */
const USER_ROLE_FILTER_ALL = "__all_roles__";

type UserRoleFilterSelectProps = {
  value: string;
  onValueChange: (roleName: string) => void;
  options: { roleName: string; description: string }[];
  loading?: boolean;
};

/** Status filter dropdown (`Approved` / `Pending` / `Rejected`, or all). */
function UserStatusFilterSelect({
  value,
  onValueChange,
}: UserStatusFilterSelectProps) {
  const selectValue =
    value.trim() === "" ? USER_STATUS_FILTER_ALL : value.trim();

  return (
    <Select
      value={selectValue}
      onValueChange={(next) =>
        onValueChange(next === USER_STATUS_FILTER_ALL ? "" : next)
      }
    >
      <SelectTrigger className="w-full max-w-[220px]">
        <SelectValue placeholder="Filter by status…" />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value={USER_STATUS_FILTER_ALL}>All statuses</SelectItem>
        {USER_STATUS_FILTER_OPTIONS.map((o) => (
          <SelectItem key={o.apiValue} value={o.apiValue}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Role filter dropdown from GET `/admin/roles`; sends `role_name` to the users list API. */
function UserRoleFilterSelect({
  value,
  onValueChange,
  options,
  loading,
}: UserRoleFilterSelectProps) {
  const selectValue = value.trim() === "" ? USER_ROLE_FILTER_ALL : value.trim();

  return (
    <Select
      value={selectValue}
      onValueChange={(next) =>
        onValueChange(next === USER_ROLE_FILTER_ALL ? "" : next)
      }
      disabled={loading}
    >
      <SelectTrigger className="w-full max-w-[220px]">
        <SelectValue placeholder={loading ? "Loading roles…" : "Filter by role…"} />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value={USER_ROLE_FILTER_ALL}>All roles</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.roleName} value={o.roleName}>
            {formatRealmRoleDisplayName(o.roleName)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Route: `/users`. Fetches user list, applies server/client pagination metadata, gates UI by `canRead`/`canCreate`/`canDelete`.
 */
export function CreateUserListPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const crud = useRouteCrudPermissions("/users");
  const navigate = useNavigate();

  const rolesQuery = useQuery({
    queryKey: ["admin-roles", "user-list-filter"],
    queryFn: () => fetchAdminRoleOptions(),
    staleTime: 60_000,
    enabled: !crud.isResolved || crud.canRead,
  });

  const listQuery = useQuery({
    queryKey: ["admin-users", search, statusFilter, roleFilter, page, pageSize],
    queryFn: async () => {
      const payload = await apiGet<unknown>(
        usersListPath(search, statusFilter, roleFilter, page, pageSize),
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
  const userListSkeletonRows = Math.min(pageSize, USER_LIST_SKELETON_CAP);

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
          title="User Management"
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

      <Card className="min-w-0 rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="min-w-0 space-y-4 p-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <UserRoleFilterSelect
              value={roleFilter}
              options={rolesQuery.data ?? []}
              loading={rolesQuery.isLoading}
              onValueChange={(next) => {
                setRoleFilter(next);
                setPage(1);
              }}
            />
            <UserStatusFilterSelect
              value={statusFilter}
              onValueChange={(next) => {
                setStatusFilter(next);
                setPage(1);
              }}
            />
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

          <div className="hidden w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
            <table className="w-max min-w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Sl.No</th>
                  <th className="px-4 py-3 text-left font-semibold">Name</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Username
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Contact</th>
                  <th className="px-4 py-3 text-left font-semibold">Email</th>

                  <th className="px-4 py-3 text-left font-semibold">Role</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-center font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {listQuery.isLoading ? (
                  <UsersTableSkeletonBody rowCount={userListSkeletonRows} />
                ) : listError ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={8}
                      className="px-4 py-6 text-center text-[var(--fms-delete)]"
                    >
                      {listError}
                    </td>
                  </tr>
                ) : crud.isResolved && !crud.canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={8}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      You do not have permission to view this data.
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={8}
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
                      <td className="px-4 py-3">{user.username}</td>
                      <td className="px-4 py-3">{user.contact}</td>
                      <td className="px-4 py-3">{user.email}</td>

                      <td className="px-4 py-3 capitalize">
                        <UserRolesListValue roles={user.roles} />
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(statusDisplayClass(user.status))}>
                          {user.status}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className={rowActionsContainerClassName}>
                          <DetailRowActionButton
                            type="button"
                            disabled={!crud.canRead}
                            onClick={() =>
                              navigate(`/users/${encodeURIComponent(user.id)}`)
                            }
                          />
                          <EditRowActionButton
                            type="button"
                            disabled={!crud.canUpdate}
                            onClick={() =>
                              navigate(
                                `/users/${encodeURIComponent(user.id)}/edit`,
                              )
                            }
                          />

                          
                          {/* <DeleteRowActionButton
                            type="button"
                            disabled={!crud.canDelete || !user.id}
                            onClick={() => askDelete(user.id)}
                          /> */}
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
              <UsersMobileCardSkeleton rowCount={userListSkeletonRows} />
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
                      Role:
                    </span>{" "}
                    <UserRolesListValue roles={user.roles} />
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
