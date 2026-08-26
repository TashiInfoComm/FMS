// Driver dashboard fuel quota, from `/fuel/reports/vehicles/quota`.
import type { DriverAssignedVehicle } from '@/features/dashboard/lib/driver-vehicles-api'
import {
  fetchFuelConsumptionReportPage,
  fetchFuelQuotaReportPage,
  type FuelConsumptionReportRow,
  type FuelQuotaReportRow,
} from '@/features/reports/pages/fuel/lib/fuel-reports-api'

export type DriverVehicleFuelQuota = {
  id: string
  registrationNumber: string
  make: string
  model: string
  /** `Mahindra Bolero`, used next to the plate number. */
  makeModel: string
  remainingPercent: number | null
  remainingNu: number | null
  usedNu: number | null
  allocatedNu: number | null
  avgEfficiency: number | null
}

export type DriverFuelQuotaPayload = {
  quotaRows: FuelQuotaReportRow[]
  consumptionRows: FuelConsumptionReportRow[]
}

function matchesAssignedVehicle(
  row: FuelQuotaReportRow,
  vehicle: Pick<DriverAssignedVehicle, 'vehicleId' | 'plateNumber'>,
): boolean {
  if (vehicle.vehicleId && row.id && vehicle.vehicleId === row.id) return true
  const plate = vehicle.plateNumber.trim().toLowerCase()
  const registration = row.registrationNumber.trim().toLowerCase()
  return Boolean(plate && registration && plate === registration)
}

function formatMakeModel(make: string, model: string, fallbackMakeModel: string): string {
  return [make.trim(), model.trim()].filter(Boolean).join(' ') || fallbackMakeModel.trim()
}

function pickConsumption(
  vehicleId: string,
  registrationNumber: string,
  consumptionRows: FuelConsumptionReportRow[],
): FuelConsumptionReportRow | undefined {
  const plate = registrationNumber.trim().toLowerCase()
  return consumptionRows.find((row) => {
    if (vehicleId && row.id === vehicleId) return true
    const rowPlate = row.registrationNumber.trim().toLowerCase()
    return Boolean(plate && rowPlate && plate === rowPlate)
  })
}

function toVehicleQuota(
  input: {
    id: string
    registrationNumber: string
    make: string
    model: string
    fallbackMakeModel: string
    quota: FuelQuotaReportRow | undefined
    consumption: FuelConsumptionReportRow | undefined
  },
): DriverVehicleFuelQuota {
  const allocatedNu = input.quota?.allocatedL ?? null
  const remainingNu = input.quota?.remainingL ?? null
  const usedNu = input.quota?.usedL ?? null
  const avgEfficiency = input.consumption?.avgKmPerL ?? null

  return {
    id: input.id,
    registrationNumber: input.registrationNumber.trim(),
    make: input.make,
    model: input.model,
    makeModel: formatMakeModel(input.make, input.model, input.fallbackMakeModel),
    remainingPercent:
      allocatedNu !== null && allocatedNu > 0 && remainingNu !== null
        ? (remainingNu / allocatedNu) * 100
        : null,
    remainingNu,
    usedNu,
    allocatedNu,
    avgEfficiency,
  }
}

/**
 * One quota item per assigned vehicle. Falls back to the quota API list when
 * assignments have not loaded yet.
 */
export function mapDriverVehicleQuotas(
  assignedVehicles: DriverAssignedVehicle[],
  quotaRows: FuelQuotaReportRow[],
  consumptionRows: FuelConsumptionReportRow[] = [],
): DriverVehicleFuelQuota[] {
  if (assignedVehicles.length > 0) {
    return assignedVehicles.map((vehicle) => {
      const quota = quotaRows.find((row) => matchesAssignedVehicle(row, vehicle))
      const registrationNumber = quota?.registrationNumber || vehicle.plateNumber
      return toVehicleQuota({
        id: vehicle.id || vehicle.vehicleId || quota?.id || registrationNumber,
        registrationNumber,
        make: quota?.make ?? '',
        model: quota?.model ?? '',
        fallbackMakeModel: vehicle.makeModel,
        quota,
        consumption: pickConsumption(
          vehicle.vehicleId || quota?.id || '',
          registrationNumber,
          consumptionRows,
        ),
      })
    })
  }

  return quotaRows.map((quota) =>
    toVehicleQuota({
      id: quota.id,
      registrationNumber: quota.registrationNumber,
      make: quota.make,
      model: quota.model,
      fallbackMakeModel: '',
      quota,
      consumption: pickConsumption(quota.id, quota.registrationNumber, consumptionRows),
    }),
  )
}

/** `GET /fuel/reports/vehicles/quota` plus consumption for avg efficiency. */
export async function fetchDriverFuelQuotaPage(): Promise<DriverFuelQuotaPayload> {
  const [quotaPage, consumptionPage] = await Promise.all([
    fetchFuelQuotaReportPage({
      page: 1,
      pageSize: 50,
      common: {},
    }),
    fetchFuelConsumptionReportPage({
      page: 1,
      pageSize: 50,
      common: {},
    }).catch(() => null),
  ])

  return {
    quotaRows: quotaPage.rows,
    consumptionRows: consumptionPage?.rows ?? [],
  }
}
