/**
 * Route: `/master/vehicle-type-category/:categoryCode/types`.
 * Lists vehicle types for one category via GET `/master/vehicle-types/category/{code}`.
 */
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiGet } from "@/services/apiClient";
import { PageHeader } from "@/shared/components/PageHeader";
import { TablePagination } from "@/shared/components/TablePagination";
import { useRouteCrudPermissions } from "@/shared/hooks/useRouteCrudPermissions";
import { applyPagination } from "@/shared/utils/pagination";

type ApiRecord = Record<string, unknown>;

type VehicleTypeRow = {
  serialNo: number;
  code: string;
  name: string;
  active: boolean;
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

function mapVehicleTypeRows(
  records: ApiRecord[],
  serialStart: number,
): VehicleTypeRow[] {
  return records.map((record, index) => ({
    serialNo: serialStart + index + 1,
    code: toText(record.code),
    name: toText(record.name),
    active:
      typeof record.active === "boolean"
        ? record.active
        : record.active === 1 || record.active === "1",
  }));
}

function categoryTypesPath(
  code: string,
  search: string,
  page: number,
  pageSize: number,
) {
  const q = encodeURIComponent(search.trim());
  return `/master/vehicle-types/category/${encodeURIComponent(code)}?page=${page}&page_size=${pageSize}&code=&search=${q}`;
}

export function VehicleCategoryDetailPage() {
  const { categoryCode = "" } = useParams();
  const [searchParams] = useSearchParams();
  const categoryName = searchParams.get("name") ?? "";

  const crud = useRouteCrudPermissions("/master/vehicle-type-category", {
    subMenuNameHint: "Vehicle Category",
  });

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const typesQuery = useQuery({
    queryKey: [
      "master-vehicle-types-by-category",
      categoryCode,
      search,
      page,
      pageSize,
    ],
    enabled: categoryCode !== "",
    queryFn: async () => {
      const payload = await apiGet<unknown>(
        categoryTypesPath(categoryCode, search, page, pageSize),
      );
      const records = toArray(payload);
      const paged = applyPagination(payload, records, page, pageSize, {
        page,
        pageSize,
        pageLength: records.length,
      });
      const rows = mapVehicleTypeRows(paged.rows, paged.serialBase);
      return {
        rows,
        totalCount: paged.totalCount,
        totalPages: paged.totalPages,
        effectivePageSize: paged.effectivePageSize,
      };
    },
  });

  const rows = useMemo(
    () => typesQuery.data?.rows ?? [],
    [typesQuery.data?.rows],
  );
  const totalCount = typesQuery.data?.totalCount ?? rows.length;
  const effectivePageSize = typesQuery.data?.effectivePageSize ?? pageSize;
  const totalPages =
    typesQuery.data?.totalPages ??
    Math.max(1, Math.ceil(totalCount / effectivePageSize));

  const displayName = categoryName || categoryCode || "—";

  return (
    <section className="space-y-5">
      <PageHeader
        title="Vehicle Category Detail"
        subtitle={`Vehicle types for ${displayName}`}
      />

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="space-y-4 p-0">
          <Link
            to="/master/vehicle-type-category?tab=category"
            className="text-sm text-[var(--fms-text-subheading)] hover:text-[var(--fms-text-header)]"
          >
            Back to Vehicle Category List
          </Link>

          <div className="flex justify-end">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--fms-text-subheading)]" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search by vehicle type name..."
                className="pl-9"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[var(--fms-strokes)]">
            <table className="min-w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  {["Sl.No", "Vehicle Type", "Code", "Status"].map((column) => (
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
                {typesQuery.isLoading ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      Loading vehicle types...
                    </td>
                  </tr>
                ) : typesQuery.isError ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-[var(--fms-delete)]"
                    >
                      Failed to load vehicle types for this category.
                    </td>
                  </tr>
                ) : crud.isResolved && !crud.canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      You do not have permission to view this data.
                    </td>
                  </tr>
                ) : !categoryCode ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      Missing vehicle category code.
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      No vehicle types found for this category.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr
                      key={`category-type-${categoryCode}-${index}`}
                      className="border-t border-[var(--fms-strokes)]"
                    >
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.serialNo}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.name || "-"}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.code || "-"}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        <span
                          className={
                            row.active
                              ? "rounded-full bg-[#d7f8e8] px-2 py-1 text-xs text-[#0f8e5c]"
                              : "rounded-full bg-[#fff4cc] px-2 py-1 text-xs text-[#9f7b00]"
                          }
                        >
                          {row.active ? "Active" : "Inactive"}
                        </span>
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
    </section>
  );
}
