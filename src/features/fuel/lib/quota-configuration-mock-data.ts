export type QuotaRuleStatus = 'Active' | 'Inactive'

export type QuotaConfigurationRule = {
  id: string
  vehicleCategory: string
  maximumQuota: number
  threshold: number
  effectiveFrom: string
  fuelType: string
  status: QuotaRuleStatus
  notes?: string
}

export const QUOTA_VEHICLE_CATEGORY_OPTIONS = [
  'Bolero',
  'Hilux',
  'Prado',
  'Pool Bus',
  'Land Cruiser',
  'Hiace',
  'Coaster',
  'Swift',
  'Wagon R',
] as const

export const QUOTA_FUEL_TYPE_OPTIONS = ['Petrol', 'Diesel', 'Electric'] as const

const SEED_RULES: Omit<QuotaConfigurationRule, 'id'>[] = [
  {
    vehicleCategory: 'Bolero',
    maximumQuota: 5000,
    threshold: 1000,
    effectiveFrom: '2026-05-01',
    fuelType: 'Petrol',
    status: 'Active',
  },
  {
    vehicleCategory: 'Hilux',
    maximumQuota: 10000,
    threshold: 2000,
    effectiveFrom: '2026-04-01',
    fuelType: 'Diesel',
    status: 'Active',
  },
  {
    vehicleCategory: 'Prado',
    maximumQuota: 30000,
    threshold: 6000,
    effectiveFrom: '2026-03-01',
    fuelType: 'Diesel',
    status: 'Active',
  },
  {
    vehicleCategory: 'Pool Bus',
    maximumQuota: 12000,
    threshold: 2500,
    effectiveFrom: '2026-02-01',
    fuelType: 'Diesel',
    status: 'Active',
  },
]

function buildGeneratedRule(index: number): QuotaConfigurationRule {
  const category =
    QUOTA_VEHICLE_CATEGORY_OPTIONS[index % QUOTA_VEHICLE_CATEGORY_OPTIONS.length]
  const fuelType = QUOTA_FUEL_TYPE_OPTIONS[index % QUOTA_FUEL_TYPE_OPTIONS.length]
  const month = (index % 12) + 1
  const maximumQuota = 4000 + (index % 20) * 1500
  const threshold = Math.round(maximumQuota * 0.2)

  return {
    id: `quota-rule-${index + 1}`,
    vehicleCategory: category,
    maximumQuota,
    threshold,
    effectiveFrom: `2026-${String(month).padStart(2, '0')}-01`,
    fuelType,
    status: index % 17 === 0 ? 'Inactive' : 'Active',
    notes: index % 5 === 0 ? 'Auto-generated mock rule' : undefined,
  }
}

/** 237 mock rows to match design pagination ("Showing 1 to 4 of 237 entries"). */
export const QUOTA_CONFIGURATION_MOCK_ROWS: QuotaConfigurationRule[] = [
  ...SEED_RULES.map((rule, index) => ({
    ...rule,
    id: `quota-rule-${index + 1}`,
  })),
  ...Array.from({ length: 237 - SEED_RULES.length }, (_, offset) =>
    buildGeneratedRule(SEED_RULES.length + offset),
  ),
]

export function formatQuotaEffectiveDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return isoDate
  const day = String(parsed.getDate()).padStart(2, '0')
  const month = parsed
    .toLocaleString('en-GB', { month: 'short' })
    .replace('.', '')
    .toUpperCase()
  const year = parsed.getFullYear()
  return `${day} ${month} ${year}`
}
