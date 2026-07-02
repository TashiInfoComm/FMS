import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FuelTableListToolbar } from "@/features/fuel/components/FuelTableListToolbar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatNuDisplay,
  QUOTA_REQUEST_STATUS_OPTIONS,
  type QuotaRequestStatus,
} from "@/features/fuel/lib/quota-request-mock-data";
import {
  fetchQuotaRequestsPage,
  formatQuotaRequestSource,
  type QuotaRequestListRow,
} from "@/features/fuel/lib/quota-requests-api";
import { cn } from "@/lib/utils";
import {
  ListPanelMessage,
  MobileListCard,
  MobileListField,
} from "@/shared/components/MobileListCard";
import { PageHeader } from "@/shared/components/PageHeader";
import {
  DetailRowActionButton,
  editRowActionButtonClassName,
  rowActionsContainerClassName,
} from "@/shared/components/TableRowActionButtons";
import { TablePagination } from "@/shared/components/TablePagination";
import { useAccessControl } from "@/shared/hooks/useAccessControl";
import { useRouteCrudPermissions } from "@/shared/hooks/useRouteCrudPermissions";

const TABLE_COLUMNS = [
  "Sl.No",
  "Registration No.",
  "Make & Model",
  "Request Source",
  "Current Quota",
  "Status",
] as const;

function QuotaRequestStatusCell({ status }: { status: QuotaRequestStatus }) {
  if (status === "PENDING") {
    return (
      <span className="rounded-full  px-2 py-1 text-xs  text-[#0a72a5]">
        PENDING
      </span>
    );
  }
  if (status === "APPROVED") {
    return (
      <span className="rounded-full  px-2 py-1 text-xs  text-[#0f8e5c]">
        APPROVED
      </span>
    );
  }
  if (status === "COMPLETED") {
    return (
      <span className="rounded-full  px-2 py-1 text-xs  text-[#0f8e5c]">
        COMPLETED
      </span>
    );
  }
  if (status === "TOPPED_UP") {
    return (
      <span className="rounded-full bg-[#d1fae5] px-2 py-1 text-xs font-semibold text-[#047857]">
        TOPPED UP
      </span>
    );
  }
  if (status === "FORWARDED") {
    return (
      <span className="rounded-full  px-2 py-1 text-xs  text-[#6b46c1]">
        FORWARDED
      </span>
    );
  }
  if (status === "MTO_REJECTED") {
    return (
      <span className="rounded-full  px-2 py-1 text-xs  text-[#b83280]">
        MTO REJECTED
      </span>
    );
  }
  if (status === "FINANCE_REJECTED") {
    return (
      <span className="rounded-full  px-2 py-1 text-xs  text-[#c53030]">
        FINANCE REJECTED
      </span>
    );
  }
  return (
    <span className="rounded-full  px-2 py-1 text-xs  text-[#c53030]">
      REJECTED
    </span>
  );
}

export default function QuotaRequestList() {
  const navigate = useNavigate();
  const crud = useRouteCrudPermissions("/fuel/quota-request-list");
  const { apiRoleName } = useAccessControl();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const listQuery = useQuery({
    queryKey: ["fuel-quota-requests", search, statusFilter, page, pageSize],
    queryFn: () => fetchQuotaRequestsPage(search, statusFilter, page, pageSize),
    enabled: !crud.isResolved || crud.canRead,
    staleTime: 30_000,
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
  const normalizedRole = apiRoleName?.trim().toLowerCase() ?? "";
  const isMto = normalizedRole.includes("mto");
  const isFinanceOfficer =
    normalizedRole.includes("finance-officer") ||
    normalizedRole.includes("finance_officer") ||
    normalizedRole.includes("finance officer");

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const openDetail = (row: QuotaRequestListRow) => {
    navigate(`/fuel/quota-request-list/${encodeURIComponent(row.id)}`);
  };

  const openReplenish = (row: QuotaRequestListRow) => {
    navigate(
      `/fuel/quota-request-list/${encodeURIComponent(row.id)}/replenish`,
    );
  };

  const canOpenReplenish = (row: QuotaRequestListRow) => {
    if (!crud.canUpdate) return false;
    if (isMto) return row.status === "PENDING" || row.status === "FINANCE_REJECTED";
    if (isFinanceOfficer) return row.status === "FORWARDED";
    return false;
  };

  return (
    <section className="space-y-5">
      <PageHeader title="Quota Requests" />

      <Card className="min-w-0 rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="min-w-0 space-y-4 p-0 align-end">
          <FuelTableListToolbar
            search={search}
            onSearchChange={(next) => {
              setSearch(next);
              setPage(1);
            }}
            searchPlaceholder="Search vehicle"
            searchAriaLabel="Search quota requests"
            leading={
              <Select
                value={statusFilter}
                onValueChange={(next) => {
                  setStatusFilter(next);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-10 w-full sm:w-[200px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  {QUOTA_REQUEST_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />

          <div className="hidden w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
            <table className="w-max min-w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  {TABLE_COLUMNS.map((column) => (
                    <th
                      key={column}
                      className="px-4 py-3 text-left font-semibold"
                    >
                      {column}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {crud.isResolved && !crud.canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMNS.length + 1}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      You do not have permission to view quota requests.
                    </td>
                  </tr>
                ) : listQuery.isLoading ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMNS.length + 1}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      Loading quota requests…
                    </td>
                  </tr>
                ) : listQuery.isError ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMNS.length + 1}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      {listQuery.error instanceof Error
                        ? listQuery.error.message
                        : "Could not load quota requests."}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMNS.length + 1}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      {search.trim() || statusFilter !== "all"
                        ? "No quota requests match your filters."
                        : "No quota requests found."}
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr
                      key={row.id}
                      className="border-t border-[var(--fms-strokes)]"
                    >
                      <td className="px-4 py-3 tabular-nums text-[var(--fms-text-subheading)]">
                        {serialBase + index + 1}
                      </td>
                      <td className="px-4 py-3 font-medium text-[var(--fms-text-header)]">
                        {row.registrationNumber}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.make && row.model && row.year ? (
                          <>
                            {row.make}{' '}{row.model} {`(${row.year})`}
                          </>
                        ) : (
                          <span className="text-[var(--fms-text-subheading)]">—</span>
                        )}

                      </td>

                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {formatQuotaRequestSource(row.requestSource)}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {`${formatNuDisplay(row.balanceAtRequest)} / ${formatNuDisplay(row.recommendedAmount)}`}
                      </td>

                      <td className="px-4 py-3">
                        <QuotaRequestStatusCell status={row.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div
                          className={cn(
                            rowActionsContainerClassName,
                            "justify-center gap-2",
                          )}
                        >
                          <DetailRowActionButton
                            type="button"
                            disabled={!crud.canRead && crud.isResolved}
                            onClick={() => openDetail(row)}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={editRowActionButtonClassName}
                            disabled={!canOpenReplenish(row)}
                            onClick={() => openReplenish(row)}
                          >
                            <Pencil aria-hidden />
                            Replenish
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {crud.isResolved && !crud.canRead ? (
              <ListPanelMessage>
                You do not have permission to view quota requests.
              </ListPanelMessage>
            ) : listQuery.isLoading ? (
              <ListPanelMessage>Loading quota requests…</ListPanelMessage>
            ) : listQuery.isError ? (
              <ListPanelMessage tone="error">
                {listQuery.error instanceof Error
                  ? listQuery.error.message
                  : "Could not load quota requests."}
              </ListPanelMessage>
            ) : rows.length === 0 ? (
              <ListPanelMessage>
                {search.trim() || statusFilter !== "all"
                  ? "No quota requests match your filters."
                  : "No quota requests found."}
              </ListPanelMessage>
            ) : (
              rows.map((row, index) => (
                <MobileListCard key={row.id}>
                  <MobileListField label="Sl.No">
                    {serialBase + index + 1}
                  </MobileListField>
                  <MobileListField label="Registration No.">
                    {row.registrationNumber}
                  </MobileListField>
                  <MobileListField label="Make">{row.make}</MobileListField>
                  <MobileListField label="Model">{row.model}</MobileListField>
                  <MobileListField label="Year">{row.year}</MobileListField>
                  <MobileListField label="Request Source">
                    {formatQuotaRequestSource(row.requestSource)}
                  </MobileListField>
                  <MobileListField label="Current Quota">
                    {`${formatNuDisplay(row.balanceAtRequest)} / ${formatNuDisplay(row.recommendedAmount)}`}
                  </MobileListField>
                  <p className="text-sm text-[var(--fms-text-subheading)]">
                    <span className="font-medium text-[var(--fms-text-header)]">
                      Status:
                    </span>{" "}
                    <QuotaRequestStatusCell status={row.status} />
                  </p>
                  <div
                    className={cn(
                      "mt-3",
                      rowActionsContainerClassName,
                      "justify-start gap-2",
                    )}
                  >
                    <DetailRowActionButton
                      type="button"
                      disabled={!crud.canRead && crud.isResolved}
                      onClick={() => openDetail(row)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={editRowActionButtonClassName}
                      disabled={!canOpenReplenish(row)}
                      onClick={() => openReplenish(row)}
                    >
                      <Pencil aria-hidden />
                      Replenish
                    </Button>

                  </div>
                </MobileListCard>
              ))
            )}
          </div>

          <TablePagination
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
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
