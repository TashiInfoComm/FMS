/**
 * Admin screen at `/admin/permissions`: lists permission catalog (object rows or string-only action list from
 * `GET /admin/permissions/actions`), supports create/edit/delete when the API returns record shapes and CRUD flags allow.
 */
import {  Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery,  } from "@tanstack/react-query";

import { Card, CardContent } from "@/components/ui/card";

import { Input } from "@/components/ui/input";
import { apiGet} from "@/services/apiClient";
import { PageHeader } from "@/shared/components/PageHeader";
import { TablePagination } from "@/shared/components/TablePagination";
import { useRouteCrudPermissions } from "@/shared/hooks/useRouteCrudPermissions";
import { applyPagination } from "@/shared/utils/pagination";

type ApiRecord = Record<string, unknown>;


type PermissionRow = {
  serialNo: number;
  code: string;
  module: string;
  description: string;
};

/** Scalar → string for grid cells (mirrors other feature pages). */
function toText(value: unknown) {
  return typeof value === "string"
    ? value
    : typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : "";
}

/** Normalizes list payloads: top-level array or common `items`/`results`/`data`/`actions` buckets. */
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
    root.actions,
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

/** API returns `{ data: ["create", "read", ...] }` — list of action identifiers. */
function parseActionStringsFromPayload(payload: unknown): string[] | null {
  if (!payload || typeof payload !== "object") return null;
  const data = (payload as Record<string, unknown>).data;
  if (!Array.isArray(data)) return null;
  if (!data.every((item) => typeof item === "string")) return null;
  return data.map((s) => (s as string).trim()).filter(Boolean);
}

type ParsedList =
  | { kind: "actions"; actions: string[] }
  | { kind: "records"; records: ApiRecord[] };

/**
 * Decides whether the list API returned a catalog of action codes only vs full permission objects;
 * drives UI (string table vs CRUD dialog/delete).
 */
function parseListPayload(payload: unknown): ParsedList {
  const actions = parseActionStringsFromPayload(payload);
  if (actions) return { kind: "actions", actions };

  if (payload && typeof payload === "object") {
    const data = (payload as Record<string, unknown>).data;
    if (
      Array.isArray(data) &&
      data.every(
        (item): item is ApiRecord => !!item && typeof item === "object",
      )
    ) {
      return { kind: "records", records: data };
    }
  }

  return { kind: "records", records: toArray(payload) };
}

/** Maps API records to numbered table rows for server-paginated grids. */
function mapRows(records: ApiRecord[], serialBase: number): PermissionRow[] {
  return records.map((record, index) => ({
    serialNo: serialBase + index + 1,
    code:
      toText(record.code) ||
      toText(record.permission_code) ||
      toText(record.action) ||
      toText(record.name),
    module: toText(record.module) || "-",
    description: toText(record.description) || "-",
  }));
}

const PERMISSION_ACTIONS_PATH = "/admin/permissions/actions";

/** Sidebar route for the Permission admin screen (`/admin/permissions`). */
const PERMISSION_PAGE_ROUTE = "/admin/permissions";

/** Fetches `/admin/permissions` or interprets `/admin/permissions/actions`; handles mutations and dialogs. */
export function PermissionManagement() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const listQuery = useQuery({
    queryKey: ["admin-permissions-actions", search, page, pageSize],
    queryFn: async () => {
      const payload = await apiGet<unknown>(PERMISSION_ACTIONS_PATH);
      const parsed = parseListPayload(payload);

      if (parsed.kind === "actions") {
        const q = search.trim().toLowerCase();
        let actions = parsed.actions;
        if (q) actions = actions.filter((a) => a.toLowerCase().includes(q));
        const paged = applyPagination(payload, actions, page, pageSize, {
          page,
          pageSize,
          pageLength: actions.length,
        });
        const rows: PermissionRow[] = paged.rows.map((action, index) => ({
          serialNo: paged.serialBase + index + 1,
          code: action,
          module: "",
          description: "",
        }));
        return {
          listKind: "actions" as const,
          rows,
          totalCount: paged.totalCount,
          totalPages: paged.totalPages,
          effectivePageSize: paged.effectivePageSize,
        };
      }

      const records = parsed.records;
      const paged = applyPagination(payload, records, page, pageSize, {
        page,
        pageSize,
        pageLength: records.length,
      });
      const rows = mapRows(paged.rows, paged.serialBase);
      return {
        listKind: "records" as const,
        rows,
        totalCount: paged.totalCount,
        totalPages: paged.totalPages,
        effectivePageSize: paged.effectivePageSize,
      };
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

  const listError = listQuery.isError
    ? listQuery.error instanceof Error
      ? listQuery.error.message
      : "Failed to load permissions"
    : null;

  const crud = useRouteCrudPermissions(PERMISSION_PAGE_ROUTE);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Permissions"
          subtitle="Permissions available in the system"
        />
      </div>
      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="space-y-4 p-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-end">
            <div className="relative w-full max-w-sm sm:ml-auto">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--fms-text-subheading)]" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder={"Search actions..."}
                className="pl-9"
              />
            </div>
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  {["Sl.No", "Action Name"].map((column) => (
                    <th
                      key={column}
                      className="px-4 py-3 text-left font-semibold"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listQuery.isLoading ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={2}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      Loading permissions...
                    </td>
                  </tr>
                ) : listError ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={2}
                      className="px-4 py-6 text-center text-[var(--fms-delete)]"
                    >
                      {listError}
                    </td>
                  </tr>
                ) : crud.isResolved && !crud.canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={2}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      You do not have permission to view this list.
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={2}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      {"No permission actions found."}
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr
                      key={row.code || `action-${index}`}
                      className="border-t border-[var(--fms-strokes)]"
                    >
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.serialNo}
                      </td>
                      <td className="px-4 py-3 font-medium text-[var(--fms-text-header)] capitalize">
                        {row.code}
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
                Loading permissions...
              </p>
            ) : listError ? (
              <p className="py-6 text-center text-[var(--fms-delete)]">
                {listError}
              </p>
            ) : crud.isResolved && !crud.canRead ? (
              <p className="py-6 text-center text-[var(--fms-text-subheading)]">
                You do not have permission to view this list.
              </p>
            ) : rows.length === 0 ? (
              <p className="py-6 text-center text-[var(--fms-text-subheading)]">
                {"No permission actions found."}
              </p>
            ) : (
              rows.map((row, index) => (
                <div
                  key={row.code || `action-m-${index}`}
                  className="rounded-lg border border-[var(--fms-strokes)] bg-white p-3"
                >
                  <p className="text-sm text-[var(--fms-text-subheading)]">
                    <span className="font-medium text-[var(--fms-text-header)]">
                      Sl.No:
                    </span>{" "}
                    {row.serialNo}
                  </p>
                  <p className="text-sm text-[var(--fms-text-subheading)]">
                    <span className="font-medium text-[var(--fms-text-header)]">
                      Action:
                    </span>{" "}
                    <span className="font-medium text-[var(--fms-text-header)] capitalize">
                      {row.code}
                    </span>
                  </p>
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
    </section>
  );
}
