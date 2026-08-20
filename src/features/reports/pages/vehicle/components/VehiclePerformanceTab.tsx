// Performance tab of the vehicle report: model efficiency, running cost and
// maintenance cost, all sourced from `/reports/vehicles/efficiency-by-model`.
import { BarChart3 } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { ReportChartCard } from '@/features/reports/components/ReportChartCard'
import { VehicleModelBarChart } from '@/features/reports/pages/vehicle/components/VehicleModelBarChart'
import {
  formatCompactNu,
  formatKmPerL,
  formatReportNu,
  type VehicleModelEfficiencyRow,
} from '@/features/reports/pages/vehicle/lib/vehicle-reports-api'
import {
  ListPanelMessage,
  MobileListCard,
  MobileListField,
} from '@/shared/components/MobileListCard'

const EFFICIENCY_COLOR = '#14b8a6'
const MAINTENANCE_COLOR = '#f59e0b'

const COMPARISON_COLUMNS = [
  'Make / Model',
  'Fleet',
  'Fuel Eff (km/L)',
  'Cost / Km',
  'Avg Maint. Cost',
] as const

type VehiclePerformanceTabProps = {
  rows: VehicleModelEfficiencyRow[]
  isLoading: boolean
  isError: boolean
  errorMessage: string
}

export function VehiclePerformanceTab({
  rows,
  isLoading,
  isError,
  errorMessage,
}: VehiclePerformanceTabProps) {
  const isEmpty = rows.length === 0
  const emptyMessage = 'No model performance data for the selected filters.'

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-sm text-[#1e40af]">
        <BarChart3 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          Compare fleet models on efficiency, running cost and reliability to guide procurement
          &amp; disposal decisions.
        </p>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <ReportChartCard
          title="Fuel Efficiency by Model"
          meta="km / litre"
          isLoading={isLoading}
          isError={isError}
          errorMessage={errorMessage}
          isEmpty={isEmpty}
          emptyMessage={emptyMessage}
        >
          <VehicleModelBarChart
            rows={rows}
            metric="fuelEfficiencyKmPerL"
            seriesLabel="Fuel efficiency"
            color={EFFICIENCY_COLOR}
            formatTick={(value) => value.toLocaleString('en-BT', { maximumFractionDigits: 0 })}
            formatValue={(value) => `${formatKmPerL(value)} km/L`}
            yAxisWidth={36}
          />
        </ReportChartCard>

        <ReportChartCard
          title="Avg Maintenance Cost by Model"
          meta="Nu per vehicle"
          isLoading={isLoading}
          isError={isError}
          errorMessage={errorMessage}
          isEmpty={isEmpty}
          emptyMessage={emptyMessage}
        >
          <VehicleModelBarChart
            rows={rows}
            metric="avgMaintenanceCostNu"
            seriesLabel="Avg maintenance cost"
            color={MAINTENANCE_COLOR}
            formatTick={formatCompactNu}
            formatValue={formatReportNu}
            yAxisWidth={72}
          />
        </ReportChartCard>
      </div>

      <Card className="min-w-0 rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="min-w-0 space-y-4 p-0">
          <h2 className="text-base font-semibold text-[var(--fms-text-header)]">
            Vehicle Performance Comparison
          </h2>

          <div className="hidden w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
            <table className="w-max min-w-full text-sm">
              <thead className="bg-[#f6f6f7]">
                <tr>
                  {COMPARISON_COLUMNS.map((column) => (
                    <th
                      key={column}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--fms-text-subheading)]"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={COMPARISON_COLUMNS.length}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      Loading performance report…
                    </td>
                  </tr>
                ) : isError ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={COMPARISON_COLUMNS.length}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      {errorMessage}
                    </td>
                  </tr>
                ) : isEmpty ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={COMPARISON_COLUMNS.length}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-t border-[var(--fms-strokes)]">
                      <td className="px-4 py-3 font-medium text-[var(--fms-text-header)]">
                        {row.makeModel}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[var(--fms-text-header)]">
                        {row.fleetCount.toLocaleString('en-BT')}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[var(--fms-text-header)]">
                        {formatKmPerL(row.fuelEfficiencyKmPerL)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[var(--fms-text-header)]">
                        {formatReportNu(row.costPerKmNu)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[var(--fms-text-header)]">
                        {formatReportNu(row.avgMaintenanceCostNu)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {isLoading ? (
              <ListPanelMessage>Loading performance report…</ListPanelMessage>
            ) : isError ? (
              <ListPanelMessage tone="error">{errorMessage}</ListPanelMessage>
            ) : isEmpty ? (
              <ListPanelMessage>{emptyMessage}</ListPanelMessage>
            ) : (
              rows.map((row) => (
                <MobileListCard key={row.id}>
                  <MobileListField label="Make / Model">{row.makeModel}</MobileListField>
                  <MobileListField label="Fleet">
                    {row.fleetCount.toLocaleString('en-BT')}
                  </MobileListField>
                  <MobileListField label="Fuel Eff (km/L)">
                    {formatKmPerL(row.fuelEfficiencyKmPerL)}
                  </MobileListField>
                  <MobileListField label="Cost / Km">
                    {formatReportNu(row.costPerKmNu)}
                  </MobileListField>
                  <MobileListField label="Avg Maint. Cost">
                    {formatReportNu(row.avgMaintenanceCostNu)}
                  </MobileListField>
                </MobileListCard>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
