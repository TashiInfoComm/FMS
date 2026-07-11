import { apiGet, apiPatch, apiPost } from '@/services/apiClient'
import { fetchVehicleCategoryOptions } from '@/features/vehicles/lib/vehicle-create-master-data'
import { extractMasterList } from '@/shared/lib/organogram-master-lookup'
import { applyPagination } from '@/shared/utils/pagination'
import {
  calculateLoanDurationDays,
  formatFleetSearchMakeModelDisplay,
  formatFleetSearchPrimaryDriverDisplay,
  LOAN_AUDIT_STEPS,
} from '@/features/inter-agency-vehicle-loan/lib/loan-requisition-ui'
import type {
  FuelingResponsibility,
  BorrowingHeadDecisionBody,
  HighestAdminDecisionBody,
  ChecklistItemOption,
  CommitLoanVehiclesBody,
  DispatchLoanVehiclesBody,
  ReturnLoanVehiclesBody,
  LendingHeadDecisionBody,
  LoanCommittedVehicle,
  LoanCommitVehicleRow,
  LoanVehicleChecklist,
  LoanAuditStep,
  LoanAuditTimelineEntry,
  LoanAuditTimelineDisplayEntry,
  LoanFleetSearchOption,
  LoanFleetSearchRequirement,
  LoanFleetSearchVehicleOption,
  LoanRecommendedAgency,
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

function extractRecommendedAgencies(record: ApiRecord): LoanRecommendedAgency[] {
  const nested = record.recommended_agencies ?? record.recommendedAgencies
  if (Array.isArray(nested)) {
    return nested
      .filter((item): item is ApiRecord => !!item && typeof item === 'object')
      .map((item) => {
        const nestedAgency = pickNestedRecord(item, ['agency'])
        const id =
          pickScalar(item, ['agency_id', 'agencyId']) ||
          pickScalar(nestedAgency ?? {}, ['id', 'agency_id', 'agencyId', 'uuid']) ||
          pickScalar(item, ['id', 'uuid'])
        if (!id) return null
        return {
          id,
          name:
            pickScalar(item, ['name', 'agency_name', 'agencyName', 'label']) ||
            pickScalar(nestedAgency ?? {}, ['name', 'agency_name', 'agencyName', 'label']),
        }
      })
      .filter((agency): agency is LoanRecommendedAgency => agency !== null)
  }

  const ids = record.recommended_agency_ids ?? record.recommendedAgencyIds
  if (!Array.isArray(ids)) return []

  return ids
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
    .map((id) => ({ id, name: '' }))
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
    .replace(/\s+/g, '_')

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

function normalizeAuditStep(value: string): LoanAuditStep | null {
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_')
  if (LOAN_AUDIT_STEPS.includes(normalized as LoanAuditStep)) {
    return normalized as LoanAuditStep
  }

  const aliases: Record<string, LoanAuditStep> = {
    VEHICLE_COMMITTED: 'VEHICLES_COMMITTED',
    VEHICLES_COMMIT: 'VEHICLES_COMMITTED',
    LOAN_ACTIVATED: 'LOAN_ACTIVE',
    ACTIVE: 'LOAN_ACTIVE',
    RETURN_COMPLETED: 'VEHICLE_RETURNED',
    RETURNED: 'VEHICLE_RETURNED',
  }

  return aliases[normalized] ?? null
}

function mapVehicleChecklist(record: ApiRecord): LoanVehicleChecklist | null {
  const itemsRaw = record.items
  const items = Array.isArray(itemsRaw)
    ? itemsRaw
        .filter((item): item is ApiRecord => !!item && typeof item === 'object')
        .map((item) => ({
          item: pickScalar(item, ['item', 'name', 'item_name', 'itemName']),
          status: pickScalar(item, ['status']),
          notes: pickScalar(item, ['notes']) || null,
        }))
        .filter((item) => item.item.trim())
    : []

  const checklistType = pickScalar(record, ['checklist_type', 'checklistType', 'type'])
  const recordedByName = pickScalar(record, [
    'recorded_by_name',
    'recordedByName',
    'recorded_by',
    'recordedBy',
  ])

  if (items.length === 0 && !checklistType && !recordedByName) return null

  return {
    checklistType,
    recordedByName,
    items,
  }
}

function pickVehicleChecklist(record: ApiRecord, keys: string[]): LoanVehicleChecklist | null {
  for (const key of keys) {
    const value = record[key]
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const mapped = mapVehicleChecklist(value as ApiRecord)
      if (mapped) return mapped
    }
  }
  return null
}

function mapCommittedVehicle(record: ApiRecord): LoanCommittedVehicle | null {
  const nestedVehicle = pickNestedRecord(record, ['vehicle', 'vehicle_details', 'vehicleDetails'])
  const source = nestedVehicle ?? record
  const vehicleId =
    pickScalar(record, ['vehicle_id', 'vehicleId']) ||
    pickScalar(source, ['vehicle_id', 'vehicleId', 'id', 'uuid'])
  if (!vehicleId) return null

  const make = pickScalar(source, ['make', 'vehicle_make', 'vehicleMake'])
  const model = pickScalar(source, ['model', 'vehicle_model', 'vehicleModel'])
  const year = pickScalar(source, ['year', 'vehicle_year', 'vehicleYear', 'model_year', 'modelYear'])
  const color = pickScalar(source, ['color', 'vehicle_color', 'vehicleColor'])
  const categoryRecord = pickNestedRecord(source, ['vehicle_category', 'vehicleCategory', 'category'])

  return {
    vehicleId,
    registrationNumber: pickScalar(source, [
      'registration_number',
      'registrationNumber',
      'vehicle_registration_number',
      'vehicleRegistrationNumber',
    ]),
    makeModelDisplay: formatFleetSearchMakeModelDisplay(make, model, year, color),
    vehicleCategory:
      pickScalar(record, [
        'vehicle_category_name',
        'vehicleCategoryName',
        'vehicle_category',
        'vehicleCategory',
        'category_name',
        'categoryName',
      ]) ||
      pickScalar(source, [
        'vehicle_category_name',
        'vehicleCategoryName',
        'vehicle_category',
        'vehicleCategory',
        'category_name',
        'categoryName',
      ]) ||
      pickScalar(categoryRecord ?? {}, ['name', 'label', 'title']),
    driverRequired: toBoolean(
      record.driver_required ??
        record.driverRequired ??
        source.driver_required ??
        source.driverRequired,
    ),
    driverName: pickScalar(record, [
      'driver_name',
      'driverName',
      'assigned_driver_name',
      'assignedDriverName',
    ]),
    notes: pickScalar(record, ['notes', 'commit_notes', 'commitNotes', 'remarks', 'remark']),
    fuelLevelAtDispatch: pickScalar(record, [
      'fuel_level_at_dispatch',
      'fuelLevelAtDispatch',
    ]),
    odometerAtDispatch: pickScalar(record, [
      'odometer_at_dispatch',
      'odometerAtDispatch',
    ]),
    fuelLevelAtReturn: pickScalar(record, [
      'fuel_level_at_return',
      'fuelLevelAtReturn',
    ]),
    odometerAtReturn: pickScalar(record, [
      'odometer_at_return',
      'odometerAtReturn',
    ]),
    returnNotes: pickScalar(record, [
      'return_notes',
      'returnNotes',
      'notes_at_return',
      'notesAtReturn',
    ]),
    preDispatchChecklist: pickVehicleChecklist(record, [
      'pre_dispatch_checklist',
      'preDispatchChecklist',
    ]),
    postReturnChecklist: pickVehicleChecklist(record, [
      'post_return_checklist',
      'postReturnChecklist',
    ]),
  }
}

function extractCommittedVehicles(record: ApiRecord): LoanCommittedVehicle[] {
  const candidates = [record.committed_vehicles, record.committedVehicles]
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue
    return candidate
      .filter((item): item is ApiRecord => !!item && typeof item === 'object')
      .map((item) => mapCommittedVehicle(item))
      .filter((vehicle): vehicle is LoanCommittedVehicle => vehicle !== null)
  }
  return []
}

function extractTrackerEntries(payload: unknown): ApiRecord[] {
  if (!payload || typeof payload !== 'object') return []

  const root = payload as ApiRecord
  const data = root.data
  const dataObj =
    data && typeof data === 'object' && !Array.isArray(data) ? (data as ApiRecord) : null

  const candidates = [
    dataObj?.tracker,
    dataObj?.timeline,
    dataObj?.steps,
    dataObj?.events,
    dataObj?.audit_timeline,
    dataObj?.auditTimeline,
    root.tracker,
    root.timeline,
    root.steps,
    root.events,
    root.audit_timeline,
    root.auditTimeline,
    Array.isArray(data) ? data : null,
    Array.isArray(root) ? root : null,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is ApiRecord => !!item && typeof item === 'object')
    }
  }

  const objectCandidates = [dataObj?.tracker, dataObj?.timeline, root.tracker, root.timeline]
  for (const candidate of objectCandidates) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue
    const entries = Object.entries(candidate as ApiRecord)
    if (entries.length === 0) continue
    return entries.map(([key, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return { step: key, ...(value as ApiRecord) }
      }
      return { step: key, completed: value, date: typeof value === 'string' ? value : undefined }
    })
  }

  return []
}

function mapTrackerEntry(
  record: ApiRecord,
  index: number,
): LoanAuditTimelineEntry | null {
  const triggerLabel = pickScalar(record, ['trigger_label', 'triggerLabel'])
  if (!triggerLabel) return null

  const stepValue = pickScalar(record, ['step', 'trigger', 'status', 'event', 'name', 'key', 'code', 'label'])
  const step =
    (stepValue ? normalizeAuditStep(stepValue) : null) ??
    LOAN_AUDIT_STEPS[Math.min(index, LOAN_AUDIT_STEPS.length - 1)]
  const date =
    pickScalar(record, [
      'date',
      'occurred_at',
      'occurredAt',
      'completed_at',
      'completedAt',
      'created_at',
      'createdAt',
      'timestamp',
    ]) || undefined
  const statusValue = pickScalar(record, ['status']).toLowerCase()
  const completed =
    statusValue === 'completed' ||
    toBoolean(
      record.completed ??
        record.is_completed ??
        record.isCompleted ??
        record.done ??
        record.is_done ??
        record.isDone ??
        Boolean(date),
    )

  return {
    step,
    triggerLabel,
    completed,
    ...(date ? { date } : {}),
  }
}

export function mapLoanTracker(payload: unknown): LoanAuditTimelineEntry[] {
  const records = extractTrackerEntries(payload)
  if (records.length === 0) return []

  return records
    .map((record, index) => mapTrackerEntry(record, index))
    .filter((entry): entry is LoanAuditTimelineEntry => entry !== null)
}

export function buildLoanAuditTimeline(
  status: LoanRequisitionStatus,
  trackerEntries: LoanAuditTimelineEntry[] = [],
): LoanAuditTimelineDisplayEntry[] {
  const completedCount = statusToCompletedSteps(status)
  const labeledTracker = trackerEntries.filter((entry) => entry.triggerLabel?.trim())

  return LOAN_AUDIT_STEPS.map((step, index) => {
    const completed = index < completedCount
    const trackerEntry = completed ? labeledTracker[index] : undefined

    return {
      step,
      triggerLabel: trackerEntry?.triggerLabel,
      completed,
      ...(trackerEntry?.date ? { date: trackerEntry.date } : {}),
      isCurrent: completed && index === completedCount - 1,
    }
  })
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
    lendingAgencyId:
      pickScalar(record, ['lending_agency_id', 'lendingAgencyId']) ||
      pickScalar(pickNestedRecord(record, ['lending_agency', 'lendingAgency']) ?? {}, [
        'id',
        'agency_id',
        'agencyId',
      ]),
    fuelingResponsibility,
    reason:
      pickScalar(record, ['reason', 'remarks', 'remark']) ||
      pickScalar(firstRequirement ?? {}, ['reason']) ||
      '—',
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
    committedVehicles: extractCommittedVehicles(record),
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
    highestAdminRemarks: pickScalar(record, [
      'highest_admin_remarks',
      'highestAdminRemarks',
    ]),
    borrowingHeadRemarks: pickScalar(record, [
      'borrowing_head_remarks',
      'borrowingHeadRemarks',
    ]),
    lendingHeadRemarks: pickScalar(record, ['lending_head_remarks', 'lendingHeadRemarks']),
    dispatchedAt: pickScalar(record, ['dispatched_at', 'dispatchedAt']),
    returnedAt: pickScalar(record, ['returned_at', 'returnedAt']),
    recommendedAgencies: extractRecommendedAgencies(record),
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

export async function fetchLoanTracker(loanId: string): Promise<LoanAuditTimelineEntry[]> {
  const trimmed = loanId.trim()
  if (!trimmed) return []

  const payload = await apiGet<unknown>(`/loans/${encodeURIComponent(trimmed)}/tracker`)
  return mapLoanTracker(payload)
}

function extractFleetSearchOptions(payload: unknown): ApiRecord[] {
  if (!payload || typeof payload !== 'object') return []

  const root = payload as ApiRecord
  const data = root.data
  const dataObj =
    data && typeof data === 'object' && !Array.isArray(data) ? (data as ApiRecord) : null
  const candidates = [dataObj?.options, root.options]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is ApiRecord => !!item && typeof item === 'object')
    }
  }

  return []
}

function mapFleetSearchVehicle(record: ApiRecord): LoanFleetSearchVehicleOption | null {
  const id = pickScalar(record, ['vehicle_id', 'vehicleId', 'id', 'uuid'])
  if (!id) return null

  const primaryDriver = pickPrimaryFleetSearchDriver(record)

  return {
    id,
    registrationNumber: pickScalar(record, [
      'registration_number',
      'registrationNumber',
      'vehicle_registration_number',
      'vehicleRegistrationNumber',
    ]),
    make: pickScalar(record, ['make', 'vehicle_make', 'vehicleMake']),
    model: pickScalar(record, ['model', 'vehicle_model', 'vehicleModel']),
    year: pickScalar(record, ['year', 'vehicle_year', 'vehicleYear', 'model_year', 'modelYear']),
    color: pickScalar(record, ['color', 'vehicle_color', 'vehicleColor']),
    primaryDriverId: primaryDriver.driverId,
    primaryDriverName: primaryDriver.driverName,
    primaryDriverLicense: primaryDriver.licenseNumber,
  }
}

function pickPrimaryFleetSearchDriver(record: ApiRecord): {
  driverId: string
  driverName: string
  licenseNumber: string
} {
  const driversRaw = record.assigned_drivers ?? record.assignedDrivers
  if (!Array.isArray(driversRaw)) {
    return { driverId: '', driverName: '', licenseNumber: '' }
  }

  const drivers = driversRaw.filter((item): item is ApiRecord => !!item && typeof item === 'object')
  const primary =
    drivers.find((driver) => {
      const priority = pickScalar(driver, ['priority']).toUpperCase()
      if (priority === 'PRIMARY') return true
      return toNumber(driver.priority) === 1
    }) ?? drivers[0]

  if (!primary) {
    return { driverId: '', driverName: '', licenseNumber: '' }
  }

  const nestedDriver = pickNestedRecord(primary, ['driver', 'user'])
  const nestedDriverUser = pickNestedRecord(nestedDriver ?? {}, ['user'])
  const nestedLicense = pickNestedRecord(primary, ['license', 'driving_license', 'drivingLicense'])

  const driverNameCandidates = [primary, nestedDriver, nestedDriverUser]
  let driverName = ''
  for (const candidate of driverNameCandidates) {
    if (!candidate) continue
    driverName =
      pickScalar(candidate, ['driver_name', 'driverName', 'name', 'full_name', 'fullName']) ||
      [
        pickScalar(candidate, ['first_name', 'firstName']),
        pickScalar(candidate, ['middle_name', 'middleName']),
        pickScalar(candidate, ['last_name', 'lastName']),
      ]
        .filter(Boolean)
        .join(' ')
    if (driverName.trim()) break
  }

  return {
    driverId:
      pickScalar(primary, ['driver_id', 'driverId']) ||
      pickScalar(nestedDriver ?? {}, ['id', 'driver_id', 'driverId', 'uuid']),
    driverName,
    licenseNumber:
      pickScalar(primary, ['license_number', 'licenseNumber', 'license_no', 'licenseNo']) ||
      pickScalar(nestedLicense ?? {}, ['license_number', 'licenseNumber', 'license_no', 'licenseNo']),
  }
}

function mapFleetSearchRequirement(record: ApiRecord): LoanFleetSearchRequirement {
  const categoryRecord = pickNestedRecord(record, [
    'vehicle_category',
    'vehicleCategory',
    'category',
  ])
  const vehiclesRaw = record.vehicles

  return {
    vehicleCategory:
      pickScalar(record, [
        'vehicle_category_name',
        'vehicleCategoryName',
        'vehicle_category',
        'vehicleCategory',
        'category_name',
        'categoryName',
      ]) ||
      pickScalar(categoryRecord ?? {}, ['name', 'label', 'title']),
    vehicleCategoryId:
      pickScalar(record, [
        'vehicle_category_id',
        'vehicleCategoryId',
        'category_id',
        'categoryId',
      ]) || pickScalar(categoryRecord ?? {}, ['id', 'category_id', 'categoryId']),
    requestedCount: Math.max(
      0,
      toNumber(
        record.vehicle_count_requested ??
          record.vehicleCountRequested ??
          record.requested_count ??
          record.requestedCount ??
          record.vehicle_count ??
          record.vehicleCount ??
          record.count,
      ),
    ),
    availableCount: Math.max(
      0,
      toNumber(
        record.vehicles_available ??
          record.vehiclesAvailable ??
          record.available_count ??
          record.availableCount ??
          record.total_available ??
          record.totalAvailable ??
          record.available,
      ),
    ),
    driverRequired: toBoolean(record.driver_required ?? record.driverRequired),
    vehicles: Array.isArray(vehiclesRaw)
      ? vehiclesRaw
          .filter((item): item is ApiRecord => !!item && typeof item === 'object')
          .map((item) => mapFleetSearchVehicle(item))
          .filter((vehicle): vehicle is LoanFleetSearchVehicleOption => vehicle !== null)
      : [],
  }
}

export function mapFleetSearchOption(record: ApiRecord): LoanFleetSearchOption | null {
  const nestedAgency = pickNestedRecord(record, ['agency'])
  const id =
    pickScalar(record, ['agency_id', 'agencyId', 'id', 'uuid']) ||
    pickScalar(nestedAgency ?? {}, ['id', 'agency_id', 'agencyId', 'uuid'])
  if (!id) return null

  const requirementsRaw = record.requirements
  const requirements = Array.isArray(requirementsRaw)
    ? requirementsRaw
        .filter((item): item is ApiRecord => !!item && typeof item === 'object')
        .map((item) => mapFleetSearchRequirement(item))
    : []

  return {
    id,
    agencyName:
      pickScalar(record, ['agency_name', 'agencyName', 'name']) ||
      pickScalar(nestedAgency ?? {}, ['name', 'agency_name', 'agencyName', 'title', 'label']),
    fullyMatches: toBoolean(record.fully_matches ?? record.fullyMatches),
    totalAvailable: Math.max(
      0,
      toNumber(record.total_available ?? record.totalAvailable ?? record.available_vehicles),
    ),
    requirements,
  }
}

export async function fetchLoanFleetSearch(loanId: string): Promise<LoanFleetSearchOption[]> {
  const trimmed = loanId.trim()
  if (!trimmed) return []

  const payload = await apiGet<unknown>(`/loans/${encodeURIComponent(trimmed)}/fleet-search`)
  return extractFleetSearchOptions(payload)
    .map((record) => mapFleetSearchOption(record))
    .filter((option): option is LoanFleetSearchOption => option !== null)
}

export function flattenFleetSearchCommitVehicles(
  options: LoanFleetSearchOption[],
  lendingAgencyId?: string,
): LoanCommitVehicleRow[] {
  const matchedOption = lendingAgencyId
    ? options.find((option) => option.id === lendingAgencyId)
    : options.find((option) => option.fullyMatches) ?? options[0]
  if (!matchedOption) return []

  return matchedOption.requirements.flatMap((requirement, requirementIndex) =>
    requirement.vehicles.map((vehicle) => ({
      vehicleId: vehicle.id,
      registrationNumber: vehicle.registrationNumber,
      makeModelDisplay: formatFleetSearchMakeModelDisplay(
        vehicle.make,
        vehicle.model,
        vehicle.year,
        vehicle.color,
      ),
      vehicleCategory: requirement.vehicleCategory,
      requirementKey:
        requirement.vehicleCategoryId ||
        `${requirement.vehicleCategory || 'requirement'}-${requirementIndex}`,
      vehicleCountRequested: Math.max(0, requirement.requestedCount),
      driverRequired: requirement.driverRequired,
      primaryDriverId: vehicle.primaryDriverId,
      primaryDriverDisplay: formatFleetSearchPrimaryDriverDisplay(
        vehicle.primaryDriverName,
        vehicle.primaryDriverLicense,
      ),
    })),
  )
}

export async function commitLoanVehicles(
  loanId: string,
  body: CommitLoanVehiclesBody,
): Promise<unknown> {
  const trimmed = loanId.trim()
  if (!trimmed) throw new Error('Missing loan id')
  if (body.vehicles.length === 0) throw new Error('Select at least one vehicle to commit')

  const vehicleIds = body.vehicles.map((vehicle) => vehicle.vehicle_id.trim())
  if (vehicleIds.some((id) => !id)) throw new Error('Each committed vehicle must have a vehicle id')
  if (new Set(vehicleIds).size !== vehicleIds.length) {
    throw new Error('Duplicate vehicles cannot be committed in the same request')
  }

  return apiPost<unknown, CommitLoanVehiclesBody>(
    `/loans/${encodeURIComponent(trimmed)}/commit-vehicles`,
    {
      vehicles: body.vehicles.map((vehicle) => ({
        vehicle_id: vehicle.vehicle_id.trim(),
        driver_id: vehicle.driver_id?.trim() ? vehicle.driver_id.trim() : null,
        notes: vehicle.notes.trim(),
      })),
    },
  )
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

export async function submitBorrowingHeadDecision(
  loanId: string,
  body: BorrowingHeadDecisionBody,
): Promise<unknown> {
  const trimmed = loanId.trim()
  if (!trimmed) throw new Error('Missing loan id')
  if (!body.remarks.trim()) throw new Error('Remarks are required')

  if (body.action === 'approve') {
    if (!body.lending_agency_id.trim()) {
      throw new Error('Select a lending agency to approve')
    }
    return apiPost<unknown, BorrowingHeadDecisionBody>(
      `/loans/${encodeURIComponent(trimmed)}/borrowing-head-decision`,
      {
        action: 'approve',
        lending_agency_id: body.lending_agency_id.trim(),
        remarks: body.remarks.trim(),
      },
    )
  }

  return apiPost<unknown, BorrowingHeadDecisionBody>(
    `/loans/${encodeURIComponent(trimmed)}/borrowing-head-decision`,
    {
      action: 'reject',
      remarks: body.remarks.trim(),
    },
  )
}

export async function submitLendingHeadDecision(
  loanId: string,
  body: LendingHeadDecisionBody,
): Promise<unknown> {
  const trimmed = loanId.trim()
  if (!trimmed) throw new Error('Missing loan id')
  if (!body.remarks.trim()) throw new Error('Remarks are required')

  return apiPost<unknown, LendingHeadDecisionBody>(
    `/loans/${encodeURIComponent(trimmed)}/lending-head-decision`,
    {
      action: body.action,
      remarks: body.remarks.trim(),
    },
  )
}

export async function fetchChecklistItemOptions(): Promise<ChecklistItemOption[]> {
  const payload = await apiGet<unknown>('/master/item-names?page=1&page_size=200&code=&search=')
  const records = extractMasterList(payload)
  return records
    .map((record) => {
      const code = pickScalar(record, ['code', 'id', 'uuid'])
      const name = pickScalar(record, ['name', 'label', 'title'])
      if (!code && !name) return null
      return {
        code: code || name,
        name: name || code,
        description: pickScalar(record, ['description']),
        active:
          typeof record.active === 'boolean'
            ? record.active
            : record.active === 1 || record.active === '1' || record.active === undefined,
      }
    })
    .filter((item): item is ChecklistItemOption => item !== null)
    .filter((item) => item.active)
}

export async function dispatchLoanVehicles(
  loanId: string,
  body: DispatchLoanVehiclesBody,
): Promise<unknown> {
  const trimmed = loanId.trim()
  if (!trimmed) throw new Error('Missing loan id')
  if (body.vehicle_dispatches.length === 0) {
    throw new Error('Select at least one vehicle to dispatch')
  }

  const vehicleIds = body.vehicle_dispatches.map((item) => item.vehicle_id.trim())
  if (vehicleIds.some((id) => !id)) {
    throw new Error('Each dispatch entry must include a vehicle id')
  }
  if (new Set(vehicleIds).size !== vehicleIds.length) {
    throw new Error('Duplicate vehicles cannot be dispatched in the same request')
  }

  for (const dispatch of body.vehicle_dispatches) {
    if (!Number.isFinite(dispatch.odometer_at_dispatch) || dispatch.odometer_at_dispatch < 0) {
      throw new Error('Odometer reading must be a valid non-negative number')
    }
    if (!dispatch.fuel_level_at_dispatch.trim()) {
      throw new Error('Fuel level is required for each vehicle')
    }
    if (dispatch.checklist_items.length === 0) {
      throw new Error('Each vehicle must include at least one checklist item')
    }
    for (const item of dispatch.checklist_items) {
      if (!item.item.trim()) throw new Error('Checklist item name is required')
      if (!item.status.trim()) throw new Error('Checklist item status is required')
    }
  }

  return apiPost<unknown, DispatchLoanVehiclesBody>(
    `/loans/${encodeURIComponent(trimmed)}/dispatch`,
    {
      vehicle_dispatches: body.vehicle_dispatches.map((dispatch) => ({
        vehicle_id: dispatch.vehicle_id.trim(),
        fuel_level_at_dispatch: dispatch.fuel_level_at_dispatch.trim(),
        odometer_at_dispatch: dispatch.odometer_at_dispatch,
        checklist_items: dispatch.checklist_items.map((item) => ({
          item: item.item.trim(),
          status: item.status.trim(),
          notes: item.notes?.trim() ? item.notes.trim() : null,
        })),
      })),
    },
  )
}

export async function returnLoanVehicles(
  loanId: string,
  body: ReturnLoanVehiclesBody,
): Promise<unknown> {
  const trimmed = loanId.trim()
  if (!trimmed) throw new Error('Missing loan id')
  if (body.vehicle_returns.length === 0) {
    throw new Error('Select at least one vehicle to return')
  }

  const vehicleIds = body.vehicle_returns.map((item) => item.vehicle_id.trim())
  if (vehicleIds.some((id) => !id)) {
    throw new Error('Each return entry must include a vehicle id')
  }
  if (new Set(vehicleIds).size !== vehicleIds.length) {
    throw new Error('Duplicate vehicles cannot be returned in the same request')
  }

  for (const vehicleReturn of body.vehicle_returns) {
    if (!Number.isFinite(vehicleReturn.odometer_at_return) || vehicleReturn.odometer_at_return < 0) {
      throw new Error('Odometer reading must be a valid non-negative number')
    }
    if (!vehicleReturn.fuel_level_at_return.trim()) {
      throw new Error('Fuel level is required for each vehicle')
    }
    if (vehicleReturn.checklist_items.length === 0) {
      throw new Error('Each vehicle must include at least one checklist item')
    }
    for (const item of vehicleReturn.checklist_items) {
      if (!item.item.trim()) throw new Error('Checklist item name is required')
      if (!item.status.trim()) throw new Error('Checklist item status is required')
    }
  }

  return apiPost<unknown, ReturnLoanVehiclesBody>(
    `/loans/${encodeURIComponent(trimmed)}/return`,
    {
      vehicle_returns: body.vehicle_returns.map((vehicleReturn) => ({
        vehicle_id: vehicleReturn.vehicle_id.trim(),
        fuel_level_at_return: vehicleReturn.fuel_level_at_return.trim(),
        odometer_at_return: vehicleReturn.odometer_at_return,
        notes: vehicleReturn.notes?.trim() ? vehicleReturn.notes.trim() : null,
        checklist_items: vehicleReturn.checklist_items.map((item) => ({
          item: item.item.trim(),
          status: item.status.trim(),
          notes: item.notes?.trim() ? item.notes.trim() : null,
        })),
      })),
    },
  )
}

export async function completeLoan(loanId: string): Promise<unknown> {
  const trimmed = loanId.trim()
  if (!trimmed) throw new Error('Missing loan id')
  return apiPost<unknown, Record<string, never>>(
    `/loans/${encodeURIComponent(trimmed)}/complete`,
    {},
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
