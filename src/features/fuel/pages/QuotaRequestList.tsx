import { Pencil, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deleteQuotaRequest,
  filterQuotaRequests,
  formatCurrentQuota,
  getQuotaRequests,
  QUOTA_REQUEST_STATUS_OPTIONS,
  type QuotaRequestRecord,
  type QuotaRequestStatus,
} from "@/features/fuel/lib/quota-request-mock-data";
import { cn } from "@/lib/utils";
import { DeleteDialog } from "@/shared/components/DeleteDialog";
import { PageHeader } from "@/shared/components/PageHeader";
import {
  DeleteRowActionButton,
  DetailRowActionButton,
  editRowActionButtonClassName,
  rowActionsContainerClassName,
} from "@/shared/components/TableRowActionButtons";
import { TablePagination } from "@/shared/components/TablePagination";
import { useRouteCrudPermissions } from "@/shared/hooks/useRouteCrudPermissions";
import { showSuccessToast } from "@/shared/lib/toast";

const TABLE_COLUMNS = [
  "Sl.No",
  "Name",
  "Contact",
  "Vehicle",
  "Current Quota",
  "Status",
] as const;

function QuotaRequestStatusCell({ status }: { status: QuotaRequestStatus }) {
  if (status === "PENDING") {
    return (
      <span className="rounded-full bg-[#ddf2ff] px-2 py-1 text-xs font-semibold text-[#0a72a5]">
        PENDING
      </span>
    );
  }
  if (status === "APPROVED") {
    return (
      <span className="rounded-full bg-[#d7f8e8] px-2 py-1 text-xs font-semibold text-[#0f8e5c]">
        APPROVED
      </span>
    );
  }
  return (
    <span className="rounded-full bg-[#fde8e8] px-2 py-1 text-xs font-semibold text-[#c53030]">
      REJECTED
    </span>
  );
}

export default function QuotaRequestList() {
  const navigate = useNavigate();
  const location = useLocation();
  const crud = useRouteCrudPermissions("/fuel/quota-request-list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedDeleteId, setSelectedDeleteId] = useState<string | null>(null);

  const allRows = useMemo(() => {
    void refreshKey;
    return getQuotaRequests();
  }, [refreshKey, location.pathname]);

  const filtered = useMemo(
    () => filterQuotaRequests(allRows, search, statusFilter),
    [allRows, search, statusFilter],
  );

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const serialBase = (page - 1) * pageSize;

  const rows = useMemo(() => {
    const start = serialBase;
    return filtered.slice(start, start + pageSize);
  }, [filtered, pageSize, serialBase]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const openDetail = (row: QuotaRequestRecord) => {
    navigate(`/fuel/quota-request-list/${encodeURIComponent(row.id)}`);
  };

  const openReplenish = (row: QuotaRequestRecord) => {
    navigate(
      `/fuel/quota-request-list/${encodeURIComponent(row.id)}/replenish`,
    );
  };

  const onDeleteRequest = (row: QuotaRequestRecord) => {
    setSelectedDeleteId(row.id);
    setDeleteOpen(true);
  };

  const onConfirmDelete = () => {
    if (!selectedDeleteId) return;
    deleteQuotaRequest(selectedDeleteId);
    setSelectedDeleteId(null);
    setRefreshKey((key) => key + 1);
    showSuccessToast("Quota request deleted");
  };

  return (
    <section className="space-y-5">
      <PageHeader title="Quota Requests" />

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="space-y-4 p-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
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

            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fms-text-subheading)]" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search driver, vehicle, email..."
                className="h-10 pl-9"
                aria-label="Search quota requests"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[var(--fms-strokes)]">
            <table className="w-full min-w-[900px] text-sm">
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
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMNS.length + 1}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      No quota requests match your filters.
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
                        {row.name}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.contact}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">
                        {row.vehicle}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {formatCurrentQuota(row.quotaUsed, row.quotaTotal)}
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
                            disabled={
                              row.status !== "PENDING" ||
                              (!crud.canUpdate && crud.isResolved)
                            }
                            onClick={() => openReplenish(row)}
                          >
                            <Pencil aria-hidden />
                            Replenish
                          </Button>
                          <DeleteRowActionButton type="button" disabled={!crud.canDelete && crud.isResolved} onClick={() => onDeleteRequest(row)} />    
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

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={onConfirmDelete}
        title="Delete Quota Request"
        description="Are you sure you want to delete this quota request? This action cannot be undone."
      />
    </section>
  );
}
