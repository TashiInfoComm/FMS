import { z } from 'zod'

import type { VehicleFormStringState } from '@/features/vehicles/lib/vehicles-api'

function requiredText(label: string) {
  return z.string().trim().min(1, `${label} is required`)
}

function requiredNumberText(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((value) => Number.isFinite(Number(value)), {
      message: `${label} must be a valid number`,
    })
}

function optionalNumberText(label: string) {
  return z
    .string()
    .trim()
    .refine((value) => value === '' || Number.isFinite(Number(value)), {
      message: `${label} must be a valid number`,
    })
}

export const vehicleFormSchema = z.object({
  registration_number: requiredText('Registration number'),
  asset_name_id: requiredText('Asset name'),
  chassis_number: requiredText('Chassis number'),
  engine_number: requiredText('Engine number'),
  make: requiredText('Make'),
  model: requiredText('Model'),
  year: requiredNumberText('Year'),
  color: requiredText('Color'),
  cost: requiredNumberText('Cost'),
  identification_code: requiredText('Identification code'),
  vehicle_category_id: requiredText('Vehicle category'),
  fuel_type_id: requiredText('Fuel type'),
  status_id: requiredText('Vehicle status'),
  movement_status_id: requiredText('Vehicle movement status'),
  engine_capacity_cc: requiredNumberText('Engine capacity (cc)'),
  seating_capacity: requiredNumberText('Seating capacity'),
  registration_date: requiredText('Registration date'),
  registration_expiry: requiredText('Registration expiry'),
  insurance_provider_id: requiredText('Insurance provider'),
  insurance_expiry: requiredText('Insurance expiry'),
  gps_device_imei: requiredText('GPS device IMEI'),
  fuel_quota_balance: optionalNumberText('Fuel quota balance'),
})

export type VehicleFormFieldKey = keyof z.infer<typeof vehicleFormSchema>

export function getVehicleFormFieldErrors(
  form: VehicleFormStringState,
): Partial<Record<VehicleFormFieldKey, string>> {
  const parsed = vehicleFormSchema.safeParse(form)
  if (parsed.success) return {}

  const errors: Partial<Record<VehicleFormFieldKey, string>> = {}
  for (const issue of parsed.error.issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !(key in errors)) {
      errors[key as VehicleFormFieldKey] = issue.message
    }
  }
  return errors
}

export function isVehicleFormValid(form: VehicleFormStringState): boolean {
  return vehicleFormSchema.safeParse(form).success
}

export const VEHICLE_FORM_FIELD_KEYS = Object.keys(
  vehicleFormSchema.shape,
) as VehicleFormFieldKey[]
