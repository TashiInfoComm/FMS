import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  filterDriverFeedbackTrips,
  formatFeedbackRoute,
  formatFeedbackVehicle,
  getDriverFeedbackTrips,
  type DriverFeedbackStatus,
} from "@/features/trips/lib/trip-driver-feedback-mock-data";
import { PageHeader } from "@/shared/components/PageHeader";
import { useRouteCrudPermissions } from "@/shared/hooks/useRouteCrudPermissions";
import { cn } from "@/lib/utils";
import { DetailRowActionButton } from "@/shared/components/TableRowActionButtons";

function tripStatusBadgeClass() {
  return "border-transparent bg-[#d0fae5] text-[#007a55] hover:bg-[#d0fae5]";
}

function feedbackBadgeClass(status: DriverFeedbackStatus) {
  return status === "Pending"
    ? "border-transparent bg-[#fef3c7] text-[#b45309] hover:bg-[#fef3c7]"
    : "border-transparent bg-[#d0fae5] text-[#007a55] hover:bg-[#d0fae5]";
}

export default function DriverFeedback() {
  const navigate = useNavigate();
  const crud = useRouteCrudPermissions("/trip/driver-feedback");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const all = getDriverFeedbackTrips();
    return filterDriverFeedbackTrips(all, search);
  }, [search]);

  const openRateDriver = (tripId: string) => {
    navigate(`/trip/driver-feedback/${encodeURIComponent(tripId)}/rate`);
  };

  return (
    <section className="space-y-5">
      <PageHeader
        title="Driver Feedback"
        subtitle="Select a completed trip and rate the assigned driver."
      />

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="space-y-4 p-0">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fms-text-subheading)]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search trip ID, route, driver, vehicle…"
              className="h-10 pl-9"
              aria-label="Search completed trips"
            />
          </div>

          <div className="overflow-hidden rounded-lg border border-[var(--fms-strokes)]">
            <table className="w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  <th className="w-16 px-4 py-3 text-left font-semibold">Sl.No</th>
                  <th className="px-4 py-3 text-left font-semibold">Trip ID</th>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Route</th>
                  <th className="px-4 py-3 text-left font-semibold">Vehicle</th>
                  <th className="px-4 py-3 text-left font-semibold">Driver</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Trip Status
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Feedback
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {crud.isResolved && !crud.canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={8}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      You do not have permission to view driver feedback.
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={8}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      No completed trips match your search.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-t border-[var(--fms-strokes)]",
                        row.feedbackStatus === "Pending" &&
                          "hover:bg-[#fafafa]",
                      )}
                    >
                      <td className="px-4 py-3 tabular-nums text-[var(--fms-text-subheading)]">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 font-medium text-[var(--fms-primary)]">
                        {row.tripId}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {row.date}
                      </td>
                      <td className="px-4 py-3">
                        {formatFeedbackRoute(row.origin, row.destination)}
                      </td>
                      <td className="px-4 py-3">
                        {formatFeedbackVehicle(
                          row.vehiclePlate,
                          row.vehicleModel,
                        )}
                      </td>
                      <td className="px-4 py-3">{row.driverName}</td>
                      <td className="px-4 py-3">
                        <Badge className={tripStatusBadgeClass()}>
                          {row.tripStatus}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {row.feedbackStatus === "Pending" ? (
                          <button type="button" className="inline-flex">
                            <Badge
                              className={cn(
                                feedbackBadgeClass("Pending"),
                                "cursor-pointer transition-opacity hover:opacity-90",
                              )}
                            >
                              Pending
                            </Badge>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="inline-flex"
                            title="View submitted feedback"
                          >
                            <Badge
                              className={cn(
                                feedbackBadgeClass("Submitted"),
                                "cursor-pointer transition-opacity hover:opacity-90",
                              )}
                            >
                              Submitted
                            </Badge>
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <DetailRowActionButton
                          name={row.tripId}
                          tooltip="View Details"
                          onClick={() => openRateDriver(row.tripId)}
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
