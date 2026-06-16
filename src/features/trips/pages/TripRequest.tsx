import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { tripStatusBadgeClass } from "@/features/trips/lib/trip-form-utils";
import {
  emptyTripListFilters,
  tripListFiltersToQueryOptions,
} from "@/features/trips/lib/trip-list-filters";
import { TripTableListToolbar } from "@/features/trips/components/TripTableListToolbar";
import {
  formatTripDateTime,
  formatTripRoute,
  formatTripSummaryStatusLabel,
  type TripRequestsSummary,
} from "@/features/trips/lib/trip-request-mock-data";
import {
  fetchTripRequestsPage,
  fetchTripRequestsSummary,
} from "@/features/trips/lib/trips-api";
import { fetchTripRequisitionMasterLists } from "@/features/trips/lib/trip-requisition-masters";
import {
  ListPanelMessage,
  MobileListCard,
  MobileListField,
} from "@/shared/components/MobileListCard";
import { PageHeader } from "@/shared/components/PageHeader";
import {
  DetailRowActionButton,
  rowActionsContainerClassName,
} from "@/shared/components/TableRowActionButtons";
import { TablePagination } from "@/shared/components/TablePagination";
import { useRouteCrudPermissions } from "@/shared/hooks/useRouteCrudPermissions";
import { cn } from "@/lib/utils";

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "primary" | "warning";
}) {
  return (
    <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white shadow-none">
      <CardContent className="px-4 py-2">
        <p className="text-xs font-medium text-[var(--fms-text-subheading)]">
          {label}
        </p>
        <p
          className={cn(
            "mt-1 text-2xl font-semibold tabular-nums",
            accent === "warning"
              ? "text-[#c53030]"
              : accent === "primary"
                ? "text-[var(--fms-primary)]"
                : "text-[var(--fms-text-header)]",
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

const TABLE_COLUMN_COUNT = 10;

const EMPTY_TRIP_REQUESTS_SUMMARY: TripRequestsSummary = {
  pendingReview: 0,
  autoApproved: 0,
  completedToday: 0,
  inProgress: 0,
  mtoRequired: 0,
  byStatus: {},
};

export default function TripRequest() {
  const navigate = useNavigate();
  const crud = useRouteCrudPermissions("/trip/request");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(emptyTripListFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const mastersQuery = useQuery({
    queryKey: ["trips", "masters"],
    queryFn: fetchTripRequisitionMasterLists,
    enabled: !crud.isResolved || crud.canRead,
    staleTime: 5 * 60_000,
  });

  const listQuery = useQuery({
    queryKey: ["trips", "requests", search, filters.tripTypeId, page, pageSize],
    queryFn: () =>
      fetchTripRequestsPage(
        search,
        page,
        pageSize,
        { tripTypes: mastersQuery.data?.tripTypes },
        tripListFiltersToQueryOptions(filters),
      ),
    enabled:
      (!crud.isResolved || crud.canRead) &&
      (mastersQuery.isSuccess || mastersQuery.isError),
    staleTime: 30_000,
  });

  const summaryQuery = useQuery({
    queryKey: ["trips", "summary"],
    queryFn: fetchTripRequestsSummary,
    enabled: !crud.isResolved || crud.canRead,
    staleTime: 30_000,
  });

  const rows = useMemo(() => listQuery.data?.rows ?? [], [listQuery.data?.rows]);
  const summary = summaryQuery.data ?? EMPTY_TRIP_REQUESTS_SUMMARY;
  const statusSummaryEntries = useMemo(
    () => Object.entries(summary.byStatus),
    [summary.byStatus],
  );
  const totalCount = listQuery.data?.totalCount ?? rows.length;
  const effectivePageSize = listQuery.data?.effectivePageSize ?? pageSize;
  const totalPages =
    listQuery.data?.totalPages ??
    Math.max(1, Math.ceil(totalCount / Math.max(1, effectivePageSize)));
  const serialBase = listQuery.data?.serialBase ?? (page - 1) * pageSize;

  useEffect(() => {
    setPage(1);
  }, [search, filters.tripTypeId, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const openDetail = (row: (typeof rows)[number]) => {
    navigate(`/trip/request/${encodeURIComponent(row.id)}`, {
      state: { hasFeedback: row.hasFeedback },
    });
  };

  return (
    <section className="space-y-5">
      <PageHeader
        title="Trip Requests"
        subtitle="Review applied trip requests and open each request for approval decision."
      />

      <div className="space-y-3">
        
        {statusSummaryEntries.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {statusSummaryEntries.map(([status, count]) => (
              <SummaryCard
                key={status}
                label={formatTripSummaryStatusLabel(status)}
                value={count}
              />
            ))}
          </div>
        ) : null}
      </div>

      <Card className="min-w-0 rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="min-w-0 space-y-4 p-0">
          <TripTableListToolbar
            search={search}
            onSearchChange={(next) => {
              setSearch(next);
              setPage(1);
            }}
            searchPlaceholder="Search request ID, applicant, destination, status…"
            searchAriaLabel="Search trip requests"
            tripTypeId={filters.tripTypeId}
            onTripTypeIdChange={(tripTypeId) => {
              setFilters({ tripTypeId });
              setPage(1);
            }}
            tripTypeOptions={mastersQuery.data?.tripTypes ?? []}
            tripTypesLoading={mastersQuery.isLoading}
          />

          <div className="hidden w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
            <table className="w-max min-w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  <th className="w-16 px-4 py-3 text-left font-semibold">Sl.No</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Request ID
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Applicant
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Trip Type
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Route</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Journey Start Date
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {crud.isResolved && !crud.canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMN_COUNT}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      You do not have permission to view trip requests.
                    </td>
                  </tr>
                ) : listQuery.isLoading ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMN_COUNT}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      Loading trip requests…
                    </td>
                  </tr>
                ) : listQuery.isError ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMN_COUNT}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      {listQuery.error instanceof Error
                        ? listQuery.error.message
                        : "Could not load trip requests."}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMN_COUNT}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      {search.trim()
                        ? "No trip requests match your search."
                        : "No trip requests found."}
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr
                      key={row.id}
                      className="cursor-pointer border-t border-[var(--fms-strokes)] hover:bg-[#fafafa]"
                      onClick={() => openDetail(row)}
                    >
                      <td className="px-4 py-3 tabular-nums text-[var(--fms-text-subheading)]">
                        {serialBase + index + 1}
                      </td>
                      <td className="px-4 py-3 font-medium text-[var(--fms-primary)]">
                        {row.requestId}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--fms-text-header)]">
                          {row.applicantName}
                        </p>
                        <p className="text-xs text-[var(--fms-text-subheading)]">
                          {row.applicantDepartment}
                        </p>
                      </td>
                      <td className="px-4 py-3">{row.tripType}</td>
                      <td className="px-4 py-3">
                        {row.route?.trim() ||
                          formatTripRoute(row.origin, row.destination)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatTripDateTime(
                          row.dateOfJourney,
                          row.timeOfJourney,
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={tripStatusBadgeClass(
                            row.statusCode || row.status,
                          )}
                        >
                          {row.status}
                        </Badge>
                      </td>
                      <td
                        className="px-4 py-3 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DetailRowActionButton
                          name={row.requestId}
                          tooltip="Review request"
                          onClick={() => openDetail(row)}
                        />
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
                You do not have permission to view trip requests.
              </ListPanelMessage>
            ) : listQuery.isLoading ? (
              <ListPanelMessage>Loading trip requests…</ListPanelMessage>
            ) : listQuery.isError ? (
              <ListPanelMessage tone="error">
                {listQuery.error instanceof Error
                  ? listQuery.error.message
                  : "Could not load trip requests."}
              </ListPanelMessage>
            ) : rows.length === 0 ? (
              <ListPanelMessage>
                {search.trim()
                  ? "No trip requests match your search."
                  : "No trip requests found."}
              </ListPanelMessage>
            ) : (
              rows.map((row, index) => (
                <MobileListCard key={row.id} onClick={() => openDetail(row)}>
                  <MobileListField label="Sl.No">
                    {serialBase + index + 1}
                  </MobileListField>
                  <MobileListField label="Request ID">
                    <span className="font-medium text-[var(--fms-primary)]">
                      {row.requestId}
                    </span>
                  </MobileListField>
                  <MobileListField label="Applicant">
                    <span className="font-medium text-[var(--fms-text-header)]">
                      {row.applicantName}
                    </span>
                    {row.applicantDepartment ? (
                      <>
                        <br />
                        <span className="text-xs">{row.applicantDepartment}</span>
                      </>
                    ) : null}
                  </MobileListField>
                  <MobileListField label="Trip Type">{row.tripType}</MobileListField>
                  <MobileListField label="Route">
                    {row.route?.trim() ||
                      formatTripRoute(row.origin, row.destination)}
                  </MobileListField>
                  <MobileListField label="Journey Start">
                    {formatTripDateTime(row.dateOfJourney, row.timeOfJourney)}
                  </MobileListField>
                  <p className="text-sm text-[var(--fms-text-subheading)]">
                    <span className="font-medium text-[var(--fms-text-header)]">
                      Status:
                    </span>{" "}
                    <Badge
                      className={tripStatusBadgeClass(
                        row.statusCode || row.status,
                      )}
                    >
                      {row.status}
                    </Badge>
                  </p>
                  <div
                    className={`mt-3 ${rowActionsContainerClassName}`}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <DetailRowActionButton
                      name={row.requestId}
                      tooltip="Review request"
                      onClick={() => openDetail(row)}
                    />
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
