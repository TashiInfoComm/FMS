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
  vehicle_type_id: requiredText('Vehicle type'),
  fuel_type_id: requiredText('Fuel type'),
  status_id: requiredText('Vehicle status'),
  movement_status_id: requiredText('Vehicle movement status'),
  engine_capacity_cc: requiredNumberText('Engine capacity (cc)'),
  seating_capacity: requiredNumberText('Seating capacity'),
  registration_date: requiredText('Registration date'),
  registration_expiry: requiredText('Registration expiry'),
  insurance_provider_id: requiredText('Insurance provider'),
  insurance_expiry: requiredText('Insurance expiry'),
  gps_device_imei: z.string(),
  fuel_quota_balance: optionalNumberText('Fuel quota balance'),
})

/** Edit mode: asset name is optional; fuel quota is not edited on this form. */
export const vehicleEditFormSchema = vehicleFormSchema.extend({
  asset_name_id: z.string(),
})

export type VehicleFormFieldKey = keyof z.infer<typeof vehicleFormSchema>

function collectFieldErrors(
  issues: readonly { path: PropertyKey[]; message: string }[],
): Partial<Record<VehicleFormFieldKey, string>> {
  const errors: Partial<Record<VehicleFormFieldKey, string>> = {}
  for (const issue of issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !(key in errors)) {
      errors[key as VehicleFormFieldKey] = issue.message
    }
  }
  return errors
}

export function getVehicleFormFieldErrors(
  form: VehicleFormStringState,
  options?: { isEdit?: boolean },
): Partial<Record<VehicleFormFieldKey, string>> {
  const schema = options?.isEdit ? vehicleEditFormSchema : vehicleFormSchema
  const parsed = schema.safeParse(form)
  if (parsed.success) return {}
  return collectFieldErrors(parsed.error.issues)
}

export function isVehicleFormValid(
  form: VehicleFormStringState,
  options?: { isEdit?: boolean },
): boolean {
  const schema = options?.isEdit ? vehicleEditFormSchema : vehicleFormSchema
  return schema.safeParse(form).success
}

export const VEHICLE_FORM_FIELD_KEYS = Object.keys(
  vehicleFormSchema.shape,
) as VehicleFormFieldKey[]
