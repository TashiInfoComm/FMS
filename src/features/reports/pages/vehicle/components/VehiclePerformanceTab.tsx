// Performance tab of the vehicle report: fuel efficiency from
// `/fuel/reports/vehicles/efficiency-by-model`, maintenance cost from
// `/maintenance/reports/vehicle-type-costs`. Both charts share the page filters.
import { BarChart3 } from 'lucide-react'

import { ReportChartCard } from '@/features/reports/components/ReportChartCard'
import { VehicleModelBarChart } from '@/features/reports/pages/vehicle/components/VehicleModelBarChart'
import {
  formatCompactNu,
  formatKmPerL,
  formatReportNu,
  type VehicleModelEfficiencyRow,
  type VehicleTypeCostRow,
} from '@/features/reports/pages/vehicle/lib/vehicle-reports-api'

const EFFICIENCY_COLOR = '#14b8a6'
const MAINTENANCE_COLOR = '#f59e0b'

type VehiclePerformanceTabProps = {
  rows: VehicleModelEfficiencyRow[]
  isLoading: boolean
  isError: boolean
  errorMessage: string
  maintenanceRows: VehicleTypeCostRow[]
  maintenanceIsLoading: boolean
  maintenanceIsError: boolean
  maintenanceErrorMessage: string
}

export function VehiclePerformanceTab({
  rows,
  isLoading,
  isError,
  errorMessage,
  maintenanceRows,
  maintenanceIsLoading,
  maintenanceIsError,
  maintenanceErrorMessage,
}: VehiclePerformanceTabProps) {
  const isEmpty = rows.length === 0
  const emptyMessage = 'No model performance data for the selected filters.'
  const maintenanceEmpty = maintenanceRows.length === 0
  const maintenanceEmptyMessage = 'No maintenance cost data for the selected filters.'

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-sm text-[#1e40af]">
        <BarChart3 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          Compare fleet models on efficiency, running cost and reliability to guide procurement
          &amp; disposal decisions.
        </p>
      </div>

      <div className="space-y-4">
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
            formatTick={formatKmPerL}
            formatValue={(value) => `${formatKmPerL(value)} km/L`}
            yAxisWidth={36}
          />
        </ReportChartCard>

        <ReportChartCard
          title="Avg Maintenance Cost by Model"
          meta="Nu per vehicle"
          isLoading={maintenanceIsLoading}
          isError={maintenanceIsError}
          errorMessage={maintenanceErrorMessage}
          isEmpty={maintenanceEmpty}
          emptyMessage={maintenanceEmptyMessage}
        >
          <VehicleModelBarChart
            rows={maintenanceRows}
            metric="avgMaintenanceCostNu"
            seriesLabel="Avg maintenance cost"
            color={MAINTENANCE_COLOR}
            formatTick={formatCompactNu}
            formatValue={formatReportNu}
            yAxisWidth={72}
          />
        </ReportChartCard>
      </div>
    </div>
  )
}
