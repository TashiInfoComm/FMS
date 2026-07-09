import { apiGet, apiPatch, apiPost } from '@/services/apiClient'
import { fetchVehicleCategoryOptions } from '@/features/vehicles/lib/vehicle-create-master-data'
import { extractMasterList } from '@/shared/lib/organogram-master-lookup'
import { applyPagination } from '@/shared/utils/pagination'
import {
  calculateLoanDurationDays,
  LOAN_AUDIT_STEPS,
} from '@/features/inter-agency-vehicle-loan/lib/loan-requisition-ui'
import type {
  FuelingResponsibility,
  HighestAdminDecisionBody,
  LoanAuditStep,
  LoanAuditTimelineEntry,
  LoanFleetSearchAgency,
  LoanRequisitionDetail,
  LoanRequisitionListRow,
  LoanRequisitionStatus,
  LoanVehicleRequirement,
} from '@/features/inter-agency-vehicle-loan/lib/loan-requisition-types'

type ApiRecord = Record<string, unknown>

export type CreateLoanVehicleRequirementBody = {
  vehicle_category_id: string
  vehicle_count: number
  reason: string
  start_date: string
  end_date: string
  driver_required: boolean
}

export type CreateLoanBody = {
  vehicle_requirements: CreateLoanVehicleRequirementBody[]
  fueling_responsibility: FuelingResponsibility
  remarks: string
}

export type LoanRequisitionPageResult = {
  rows: LoanRequisitionListRow[]
  totalCount: number
  totalPages: number
  effectivePageSize: number
}

function pickScalar(record: ApiRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return ''
}

function pickNestedRecord(record: ApiRecord, keys: string[]): ApiRecord | null {
  for (const key of keys) {
    const value = record[key]
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as ApiRecord
    }
  }
  return null
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === 'true' || normalized === '1' || normalized === 'yes'
  }
  if (typeof value === 'number') return value > 0
  return false
}

function unwrapRecord(payload: unknown): ApiRecord {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {}
  const record = payload as ApiRecord
  const data = record.data
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as ApiRecord
  }
  return record
}

function extractLoanList(payload: unknown): ApiRecord[] {
  const records = extractMasterList(payload)
  if (records.length > 0) return records
  if (!payload || typeof payload !== 'object') return []

  const root = payload as ApiRecord
  const data = root.data
  const dataObj =
    data && typeof data === 'object' && !Array.isArray(data) ? (data as ApiRecord) : null
  const candidates = [root.loans, dataObj?.loans]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is ApiRecord => !!item && typeof item === 'object')
    }
  }

  return []
}

function extractVehicleRequirements(record: ApiRecord): ApiRecord[] {
  const candidates = [
    record.vehicle_requirements,
    record.vehicleRequirements,
    record.requirements,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is ApiRecord => !!item && typeof item === 'object')
    }
  }

  return []
}

function pickCategoryLabel(requirement: ApiRecord): string {
  const category = pickNestedRecord(requirement, ['vehicle_category', 'vehicleCategory', 'category'])
  if (category) {
    return (
      pickScalar(category, ['name', 'label', 'category_name', 'categoryName', 'code']) || ''
    )
  }

  return (
    pickScalar(requirement, [
      'vehicle_category_name',
      'vehicleCategoryName',
      'category_name',
      'categoryName',
      'vehicle_category_label',
      'vehicleCategoryLabel',
    ]) || pickScalar(requirement, ['vehicle_category_id', 'vehicleCategoryId'])
  )
}

function pickAgencyName(record: ApiRecord, nestedKeys: string[], scalarKeys: string[]): string {
  const nested = pickNestedRecord(record, nestedKeys)
  if (nested) {
    return (
      pickScalar(nested, ['name', 'agency_name', 'agencyName', 'label', 'display_name']) || '—'
    )
  }

  return pickScalar(record, scalarKeys) || '—'
}

function normalizeFuelingResponsibility(value: unknown): FuelingResponsibility {
  const normalized = (
    typeof value === 'string'
      ? value
      : typeof value === 'number' && Number.isFinite(value)
        ? String(value)
        : ''
  )
    .trim()
    .toUpperCase()
  if (normalized === 'LENDING_AGENCY') return 'LENDING_AGENCY'
  return 'BORROWING_AGENCY'
}

function normalizeLoanStatus(value: unknown): LoanRequisitionStatus {
  const status = (
    typeof value === 'string'
      ? value
      : typeof value === 'number' && Number.isFinite(value)
        ? String(value)
        : ''
  )
    .trim()
    .toUpperCase()

  if (status === 'DRAFT') return 'DRAFT'
  if (status === 'PENDING_HIGHEST_ADMIN') return 'PENDING_HIGHEST_ADMIN'
  if (status === 'PENDING_BORROWING_HEAD') return 'PENDING_BORROWING_HEAD'
  if (status === 'PENDING_LENDING_HEAD') return 'PENDING_LENDING_HEAD'
  if (status === 'PENDING_MTO_COMMIT') return 'PENDING_MTO_COMMIT'
  if (status === 'VEHICLE_COMMITTED') return 'VEHICLE_COMMITTED'
  if (status === 'ACTIVE') return 'ACTIVE'
  if (status === 'RETURNED') return 'RETURNED'
  if (status === 'COMPLETED') return 'COMPLETED'
  if (status === 'REJECTED') return 'REJECTED'
  if (status === 'CANCELLED') return 'CANCELLED'
  return 'DRAFT'
}

function statusToCompletedSteps(status: LoanRequisitionStatus): number {
  switch (status) {
    case 'DRAFT':
      return 1
    case 'PENDING_HIGHEST_ADMIN':
      return 2
    case 'PENDING_BORROWING_HEAD':
      return 3
    case 'PENDING_LENDING_HEAD':
      return 4
    case 'PENDING_MTO_COMMIT':
      return 5
    case 'VEHICLE_COMMITTED':
      return 6
    case 'ACTIVE':
      return 7
    case 'RETURNED':
    case 'COMPLETED':
      return 8
    case 'REJECTED':
      return 1
    case 'CANCELLED':
      return 0
    default:
      return 1
  }
}

function pickLoanPeriodDays(record: ApiRecord, requirements: ApiRecord[]): number {
  const first = requirements[0]
  const start = first
    ? pickScalar(first, ['start_date', 'startDate'])
    : pickScalar(record, ['start_date', 'startDate', 'borrow_start_date', 'borrowStartDatetime'])
  const end = first
    ? pickScalar(first, ['end_date', 'endDate'])
    : pickScalar(record, ['end_date', 'endDate', 'borrow_end_date', 'borrowEndDatetime'])

  if (start && end) {
    const days = calculateLoanDurationDays(start, end)
    const parsed = Number.parseInt(days, 10)
    if (parsed > 0) return parsed
  }

  return Math.max(1, toNumber(record.loan_period_days ?? record.loanPeriodDays, 1))
}

function mapVehicleRequirement(
  requirement: ApiRecord,
  index: number,
  loanId: string,
  fuelingResponsibility: FuelingResponsibility,
): LoanVehicleRequirement {
  const categoryId =
    pickScalar(requirement, ['vehicle_category_id', 'vehicleCategoryId', 'category_id']) ||
    'unknown'
  const categoryLabel = pickCategoryLabel(requirement) || categoryId

  return {
    id: pickScalar(requirement, ['id', 'requirement_id', 'requirementId']) || `${loanId}-req-${index + 1}`,
    vehicleCategory: categoryId,
    vehicleCategoryLabel: categoryLabel,
    numberOfVehicles: Math.max(
      1,
      toNumber(requirement.vehicle_count ?? requirement.vehicleCount ?? requirement.count, 1),
    ),
    fuelingResponsibility,
    reason: pickScalar(requirement, ['reason', 'purpose']),
    startDate: pickScalar(requirement, ['start_date', 'startDate', 'borrow_start_date']),
    endDate: pickScalar(requirement, ['end_date', 'endDate', 'borrow_end_date']),
    driverRequired: toBoolean(requirement.driver_required ?? requirement.driverRequired),
  }
}

function mapAuditTimeline(record: ApiRecord, status: LoanRequisitionStatus): LoanAuditTimelineEntry[] {
  const historyCandidates = [
    record.audit_timeline,
    record.auditTimeline,
    record.status_history,
    record.statusHistory,
    record.lifecycle_events,
    record.lifecycleEvents,
  ]

  for (const candidate of historyCandidates) {
    if (!Array.isArray(candidate) || candidate.length === 0) continue

    const mapped: LoanAuditTimelineEntry[] = []
    for (const [index, entry] of candidate.entries()) {
      if (!entry || typeof entry !== 'object') continue
      const item = entry as ApiRecord
      const step = pickScalar(item, ['step', 'status', 'event', 'name']).toUpperCase()
      const normalizedStep = LOAN_AUDIT_STEPS.includes(step as LoanAuditStep)
        ? (step as LoanAuditStep)
        : LOAN_AUDIT_STEPS[Math.min(index, LOAN_AUDIT_STEPS.length - 1)]
      const date =
        pickScalar(item, ['date', 'occurred_at', 'occurredAt', 'created_at', 'createdAt']) ||
        undefined

      mapped.push({
        step: normalizedStep,
        completed: toBoolean(item.completed ?? item.is_completed ?? item.isCompleted ?? true),
        ...(date ? { date } : {}),
      })
    }

    if (mapped.length > 0) return mapped
  }

  const completedSteps = statusToCompletedSteps(status)

  return LOAN_AUDIT_STEPS.map((step, index) => ({
    step,
    completed: index < completedSteps,
    date: undefined,
  }))
}

export function mapLoanListRow(record: ApiRecord): LoanRequisitionListRow | null {
  const id = pickScalar(record, ['id', 'loan_id', 'loanId', 'uuid'])
  if (!id) return null

  const requirements = extractVehicleRequirements(record)
  const vehicleCategories = requirements
    .map((requirement) => pickCategoryLabel(requirement))
    .filter((label) => label.trim().length > 0)
  const numberOfVehicles =
    requirements.reduce(
      (sum, requirement) =>
        sum + toNumber(requirement.vehicle_count ?? requirement.vehicleCount ?? requirement.count),
      0,
    ) ||
    toNumber(
      record.vehicle_count_requested ??
        record.vehicleCountRequested ??
        record.vehicle_count ??
        record.vehicleCount ??
        record.total_vehicles,
    )

  const startDate = pickScalar(record, [
    'loan_start_date',
    'loanStartDate',
    'start_date',
    'startDate',
    'borrow_start_date',
  ])
  const endDate = pickScalar(record, [
    'loan_end_date',
    'loanEndDate',
    'end_date',
    'endDate',
    'borrow_end_date',
  ])

  return {
    id,
    requestId:
      pickScalar(record, [
        'reference_no',
        'referenceNo',
        'request_id',
        'requestId',
        'loan_number',
        'loanNumber',
      ]) || id,
    borrowingAgency: pickAgencyName(
      record,
      ['borrowing_agency', 'borrowingAgency'],
      ['borrowing_agency_name', 'borrowingAgencyName'],
    ),
    lendingAgency: pickAgencyName(
      record,
      ['lending_agency', 'lendingAgency'],
      ['lending_agency_name', 'lendingAgencyName'],
    ),
    vehicleCategories: vehicleCategories.length > 0 ? vehicleCategories : ['—'],
    numberOfVehicles: Math.max(0, numberOfVehicles),
    loanPeriodDays: pickLoanPeriodDays(record, requirements),
    startDate,
    endDate,
    fuelingResponsibility: normalizeFuelingResponsibility(
      record.fueling_responsibility ?? record.fuelingResponsibility,
    ),
    status: normalizeLoanStatus(record.status),
  }
}

export function mapLoanDetail(record: ApiRecord): LoanRequisitionDetail | null {
  const listRow = mapLoanListRow(record)
  if (!listRow) return null

  const requirements = extractVehicleRequirements(record)
  const fuelingResponsibility = listRow.fuelingResponsibility
  const firstRequirement = requirements[0]

  return {
    id: listRow.id,
    requestId: listRow.requestId,
    borrowingAgency: pickAgencyName(
      record,
      ['borrowing_agency', 'borrowingAgency'],
      ['borrowing_agency_name', 'borrowingAgencyName'],
    ),
    lendingAgency: pickAgencyName(
      record,
      ['lending_agency', 'lendingAgency'],
      ['lending_agency_name', 'lendingAgencyName'],
    ),
    vehicleCategory: listRow.vehicleCategories.join(', '),
    loanPeriodDays: listRow.loanPeriodDays,
    requestedCount: Math.max(
      listRow.numberOfVehicles,
      toNumber(record.requested_count ?? record.requestedCount),
    ),
    acceptedCount: toNumber(record.accepted_count ?? record.acceptedCount),
    committedCount: toNumber(record.committed_count ?? record.committedCount),
    fuelingResponsibility,
    reason:
      pickScalar(record, ['reason', 'remarks', 'remark']) ||
      pickScalar(firstRequirement ?? {}, ['reason']) ||
      '—',
    driverRequired:
      toBoolean(record.driver_required ?? record.driverRequired) ||
      requirements.some((requirement) =>
        toBoolean(requirement.driver_required ?? requirement.driverRequired),
      ),
    borrowStartDatetime:
      pickScalar(firstRequirement ?? record, ['start_date', 'startDate', 'borrow_start_date']) ||
      '',
    borrowEndDatetime:
      pickScalar(firstRequirement ?? record, ['end_date', 'endDate', 'borrow_end_date']) || '',
    status: listRow.status,
    requirements:
      requirements.length > 0
        ? requirements.map((requirement, index) =>
            mapVehicleRequirement(requirement, index, listRow.id, fuelingResponsibility),
          )
        : listRow.vehicleCategories.map((category, index) => ({
            id: `${listRow.id}-req-${index + 1}`,
            vehicleCategory: category,
            vehicleCategoryLabel: category,
            numberOfVehicles: Math.max(
              1,
              Math.floor(listRow.numberOfVehicles / Math.max(1, listRow.vehicleCategories.length)),
            ),
            fuelingResponsibility,
            reason: '',
            startDate: listRow.startDate,
            endDate: listRow.endDate,
            driverRequired: false,
          })),
    auditTimeline: mapAuditTimeline(record, listRow.status),
    requestedVehicleSummary:
      pickScalar(record, [
        'requested_vehicle_summary',
        'requestedVehicleSummary',
        'recommended_vehicle_summary',
        'recommendedVehicleSummary',
      ]) || 'No recommended vehicle recorded',
    committedVehicleSummary:
      pickScalar(record, ['committed_vehicle_summary', 'committedVehicleSummary']) ||
      'No vehicle committed',
    handoverChecklistRecorded: toBoolean(
      record.handover_checklist_recorded ??
        record.handoverChecklistRecorded ??
        record.handover_checklist_completed,
    ),
    returnChecklistRecorded: toBoolean(
      record.return_checklist_recorded ??
        record.returnChecklistRecorded ??
        record.return_checklist_completed,
    ),
    rejectionReason: pickScalar(record, [
      'rejection_reason',
      'rejectionReason',
      'rejected_reason',
      'rejectedReason',
    ]),
  }
}

function pickCategoryId(requirement: ApiRecord): string {
  const category = pickNestedRecord(requirement, ['vehicle_category', 'vehicleCategory', 'category'])
  if (category) {
    return pickScalar(category, ['id', 'category_id', 'categoryId', 'vehicle_category_id'])
  }
  return pickScalar(requirement, [
    'vehicle_category_id',
    'vehicleCategoryId',
    'category_id',
    'categoryId',
  ])
}

function extractVehicleRequirementsOrFallback(record: ApiRecord): ApiRecord[] {
  const requirements = extractVehicleRequirements(record)
  if (requirements.length > 0) return requirements

  const count = toNumber(
    record.vehicle_count_requested ?? record.vehicleCountRequested ?? record.vehicle_count,
    0,
  )
  const start = pickScalar(record, ['loan_start_date', 'loanStartDate', 'start_date', 'startDate'])
  const end = pickScalar(record, ['loan_end_date', 'loanEndDate', 'end_date', 'endDate'])
  const purpose = pickScalar(record, ['purpose', 'reason', 'remarks', 'remark'])

  if (!start && !end && !purpose && count <= 0) return []

  return [
    {
      vehicle_category_id: pickCategoryId(record),
      vehicle_count: Math.max(1, count),
      reason: purpose,
      start_date: start,
      end_date: end,
      driver_required: record.driver_required ?? record.driverRequired ?? false,
    },
  ]
}

export function mapLoanRecordToEditForm(record: ApiRecord): CreateLoanBody | null {
  const requirements = extractVehicleRequirementsOrFallback(record)
  if (requirements.length === 0) return null

  return {
    vehicle_requirements: requirements.map((requirement) => ({
      vehicle_category_id: pickCategoryId(requirement),
      vehicle_count: Math.max(
        1,
        toNumber(requirement.vehicle_count ?? requirement.vehicleCount ?? requirement.count, 1),
      ),
      reason:
        pickScalar(requirement, ['reason', 'purpose']) ||
        pickScalar(record, ['purpose', 'reason', 'remarks', 'remark']),
      start_date:
        pickScalar(requirement, ['start_date', 'startDate']) ||
        pickScalar(record, ['loan_start_date', 'loanStartDate']),
      end_date:
        pickScalar(requirement, ['end_date', 'endDate']) ||
        pickScalar(record, ['loan_end_date', 'loanEndDate']),
      driver_required: toBoolean(requirement.driver_required ?? requirement.driverRequired),
    })),
    fueling_responsibility: normalizeFuelingResponsibility(
      record.fueling_responsibility ?? record.fuelingResponsibility,
    ),
    remarks: pickScalar(record, ['remarks', 'remark', 'purpose']),
  }
}

export function extractCreatedLoanId(payload: unknown): string {
  const record = unwrapRecord(payload)
  return pickScalar(record, ['id', 'loan_id', 'loanId', 'uuid'])
}

export function loansListPath(
  search: string,
  page: number,
  pageSize: number,
  asLending?: boolean,
  status?: string,
): string {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('page_size', String(pageSize))
  if (asLending !== undefined) {
    params.set('as_lending', String(asLending))
  }
  const statusFilter = status?.trim()
  if (statusFilter) params.set('status', statusFilter)
  const q = search.trim()
  if (q) params.set('search', q)
  return `/loans?${params.toString()}`
}

export async function fetchLoansPage(
  search: string,
  page: number,
  pageSize: number,
  asLending?: boolean,
  status?: string,
): Promise<LoanRequisitionPageResult> {
  const payload = await apiGet<unknown>(loansListPath(search, page, pageSize, asLending, status))
  const records = extractLoanList(payload)
  const rows = records
    .map((record) => mapLoanListRow(record))
    .filter((row): row is LoanRequisitionListRow => row !== null)
  const paged = applyPagination(payload, rows, page, pageSize, {
    page,
    pageSize,
    pageLength: rows.length,
  })

  return {
    rows: paged.rows,
    totalCount: paged.totalCount,
    totalPages: paged.totalPages,
    effectivePageSize: paged.effectivePageSize,
  }
}

export async function fetchLoanDetail(loanId: string): Promise<LoanRequisitionDetail | null> {
  const trimmed = loanId.trim()
  if (!trimmed) return null

  const payload = await apiGet<unknown>(`/loans/${encodeURIComponent(trimmed)}`)
  const record = unwrapRecord(payload)
  if (!record || Object.keys(record).length === 0) return null
  return mapLoanDetail(record)
}

function extractFleetSearchAgencies(payload: unknown): ApiRecord[] {
  const records = extractMasterList(payload)
  if (records.length > 0) return records
  if (!payload || typeof payload !== 'object') return []

  const root = payload as ApiRecord
  const data = root.data
  const dataObj =
    data && typeof data === 'object' && !Array.isArray(data) ? (data as ApiRecord) : null
  const candidates = [
    root.agencies,
    root.recommended_agencies,
    root.recommendedAgencies,
    dataObj?.agencies,
    dataObj?.recommended_agencies,
    dataObj?.recommendedAgencies,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is ApiRecord => !!item && typeof item === 'object')
    }
  }

  return []
}

function formatMatchingCategories(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim()
        if (item && typeof item === 'object') {
          return pickScalar(item as ApiRecord, ['name', 'label', 'title', 'category', 'category_name'])
        }
        return ''
      })
      .filter(Boolean)
      .join(', ')
  }
  if (typeof value === 'string') return value.trim()
  return ''
}

export function mapFleetSearchAgency(record: ApiRecord): LoanFleetSearchAgency | null {
  const nestedAgency = pickNestedRecord(record, ['agency'])
  const id =
    pickScalar(record, ['id', 'agency_id', 'agencyId', 'uuid']) ||
    pickScalar(nestedAgency ?? {}, ['id', 'agency_id', 'agencyId', 'uuid'])
  if (!id) return null

  return {
    id,
    name:
      pickScalar(record, ['name', 'agency_name', 'agencyName', 'title', 'label']) ||
      pickScalar(nestedAgency ?? {}, ['name', 'agency_name', 'agencyName', 'title', 'label']),
    code:
      pickScalar(record, ['code', 'agency_code', 'agencyCode']) ||
      pickScalar(nestedAgency ?? {}, ['code', 'agency_code', 'agencyCode']),
    availableVehicles: Math.max(
      0,
      toNumber(
        record.available_vehicles ??
          record.availableVehicles ??
          record.vehicle_count ??
          record.vehicleCount ??
          record.capacity ??
          record.matching_vehicle_count ??
          record.matchingVehicleCount,
      ),
    ),
    matchingCategories:
      formatMatchingCategories(
        record.matching_categories ??
          record.matchingCategories ??
          record.vehicle_categories ??
          record.vehicleCategories ??
          record.categories,
      ) ||
      pickScalar(record, [
        'matching_category',
        'matchingCategory',
        'vehicle_category',
        'vehicleCategory',
      ]),
    capacitySummary: pickScalar(record, [
      'capacity_summary',
      'capacitySummary',
      'summary',
      'match_summary',
      'matchSummary',
      'notes',
      'remark',
      'remarks',
    ]),
  }
}

export async function fetchLoanFleetSearch(loanId: string): Promise<LoanFleetSearchAgency[]> {
  const trimmed = loanId.trim()
  if (!trimmed) return []

  const payload = await apiGet<unknown>(`/loans/${encodeURIComponent(trimmed)}/fleet-search`)
  return extractFleetSearchAgencies(payload)
    .map((record) => mapFleetSearchAgency(record))
    .filter((agency): agency is LoanFleetSearchAgency => agency !== null)
}

export async function submitHighestAdminDecision(
  loanId: string,
  body: HighestAdminDecisionBody,
): Promise<unknown> {
  const trimmed = loanId.trim()
  if (!trimmed) throw new Error('Missing loan id')
  if (!body.remarks.trim()) throw new Error('Remarks are required')

  if (body.action === 'forward') {
    if (body.recommended_agency_ids.length === 0) {
      throw new Error('Select at least one recommended agency')
    }
    return apiPost<unknown, HighestAdminDecisionBody>(
      `/loans/${encodeURIComponent(trimmed)}/highest-admin-decision`,
      {
        action: 'forward',
        recommended_agency_ids: body.recommended_agency_ids,
        remarks: body.remarks.trim(),
      },
    )
  }

  return apiPost<unknown, HighestAdminDecisionBody>(
    `/loans/${encodeURIComponent(trimmed)}/highest-admin-decision`,
    {
      action: 'reject',
      remarks: body.remarks.trim(),
    },
  )
}

export async function fetchLoanForEdit(loanId: string): Promise<CreateLoanBody> {
  const trimmed = loanId.trim()
  if (!trimmed) throw new Error('Missing loan id')

  const payload = await apiGet<unknown>(`/loans/${encodeURIComponent(trimmed)}`)
  const record = unwrapRecord(payload)
  const mapped = mapLoanRecordToEditForm(record)
  if (!mapped) throw new Error('Could not load loan for editing')
  return mapped
}

export async function updateLoan(loanId: string, body: CreateLoanBody): Promise<unknown> {
  const trimmed = loanId.trim()
  if (!trimmed) throw new Error('Missing loan id')
  return apiPatch<unknown, CreateLoanBody>(`/loans/${encodeURIComponent(trimmed)}`, body)
}

export type CancelLoanBody = {
  reason: string
}

export async function cancelLoan(loanId: string, reason: string): Promise<unknown> {
  const trimmed = loanId.trim()
  const trimmedReason = reason.trim()
  if (!trimmed) throw new Error('Missing loan id')
  if (!trimmedReason) throw new Error('Cancellation reason is required')
  return apiPost<unknown, CancelLoanBody>(`/loans/${encodeURIComponent(trimmed)}/cancel`, {
    reason: trimmedReason,
  })
}

export async function fetchLoanVehicleCategoryOptions() {
  return fetchVehicleCategoryOptions()
}

export async function createLoan(body: CreateLoanBody): Promise<unknown> {
  return apiPost<unknown, CreateLoanBody>('/loans', body)
}
