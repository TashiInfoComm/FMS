import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  computeTripRequestSummary,
  filterTripRequests,
  formatTripDateTime,
  formatTripRoute,
  TRIP_REQUEST_MOCK_ROWS,
  type TripRequestPriority,
  type TripRequestStatus,
} from "@/features/trips/lib/trip-request-mock-data";
import { PageHeader } from "@/shared/components/PageHeader";
import { DetailRowActionButton } from "@/shared/components/TableRowActionButtons";
import { useRouteCrudPermissions } from "@/shared/hooks/useRouteCrudPermissions";
import { cn } from "@/lib/utils";

function priorityBadgeClass(priority: TripRequestPriority) {
  switch (priority) {
    case "High":
      return "border-transparent bg-[#fde8e8] text-[#c53030] hover:bg-[#fde8e8]";
    case "Low":
      return "border-transparent bg-[#edf2f7] text-[#4a5568] hover:bg-[#edf2f7]";
    default:
      return "border-transparent bg-[#edf2f7] text-[#2d3748] hover:bg-[#edf2f7]";
  }
}

const statusBadgeClass = (status: TripRequestStatus) => {
  switch (status) {
    case "Pending Review":
      return "border-transparent bg-[#edf2f7] text-[#2d3748] hover:bg-[#edf2f7]";
    case "Approved":
      return "border-transparent bg-[#d0fae5] text-[#007a55] hover:bg-[#d0fae5]";

    case "Rejected":
      return "border-transparent bg-[#fde8e8] text-[#c53030] hover:bg-[#fde8e8]";
    default:
      return "border-transparent bg-[#edf2f7] text-[#2d3748] hover:bg-[#edf2f7]";
  }
};

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
      <CardContent className="px-4 py-4">
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

export default function TripRequest() {
  const navigate = useNavigate();
  const crud = useRouteCrudPermissions("/trip/request");
  const [search, setSearch] = useState("");

  const rows = useMemo(
    () => filterTripRequests(TRIP_REQUEST_MOCK_ROWS, search),
    [search],
  );
  const summary = useMemo(
    () => computeTripRequestSummary(TRIP_REQUEST_MOCK_ROWS),
    [],
  );

  const openDetail = (requestId: string) => {
    navigate(`/trip/request/${encodeURIComponent(requestId)}`);
  };

  return (
    <section className="space-y-5">
      <PageHeader
        title="Trip Requests"
        subtitle="Review applied trip requests and open each request for approval decision."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Pending Review"
          value={summary.pending}
          accent="primary"
        />
        <SummaryCard label="Long Trips" value={summary.longTrips} />
        <SummaryCard label="Local/Pick-Drop" value={summary.localOrPickDrop} />
        <SummaryCard
          label="High Priority"
          value={summary.highPriority}
          accent="warning"
        />
      </div>

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="space-y-4 p-0">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fms-text-subheading)]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search request ID, applicant, destination, status…"
              className="h-10 pl-9"
              aria-label="Search trip requests"
            />
          </div>

          <div className="overflow-hidden rounded-lg border border-[var(--fms-strokes)]">
            <table className="w-full text-sm">
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
                    Date &amp; Time
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Suggested Assignment
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Priority
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
                      colSpan={9}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      You do not have permission to view trip requests.
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={9}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      No trip requests match your search.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr
                      key={row.id}
                      className="cursor-pointer border-t border-[var(--fms-strokes)] hover:bg-[#fafafa]"
                      onClick={() => openDetail(row.requestId)}
                    >
                      <td className="px-4 py-3 tabular-nums text-[var(--fms-text-subheading)]">
                        {index + 1}
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
                        {formatTripRoute(row.origin, row.destination)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatTripDateTime(
                          row.dateOfJourney,
                          row.timeOfJourney,
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[var(--fms-text-header)]">
                          {row.suggestedVehicle.plateNumber} ·{" "}
                          {row.suggestedVehicle.model} ·{" "}
                          {row.suggestedVehicle.fuelEfficiency}
                        </p>
                        <p className="text-xs text-[var(--fms-text-subheading)]">
                          {row.suggestedDriver.name} · Rating{" "}
                          {row.suggestedDriver.rating}/5
                        </p>
                      </td>
                      
                      <td className="px-4 py-3">
                        <Badge className={priorityBadgeClass(row.priority)}>
                          {row.priority}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={statusBadgeClass(row.status)}>
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
                          onClick={() => openDetail(row.requestId)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
