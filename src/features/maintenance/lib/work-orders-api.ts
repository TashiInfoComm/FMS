import type { ApiRecord } from '@/features/user/lib/roles-api'
import { toText } from '@/features/user/lib/users-api'
import { fetchVehicleById, mapVehicleRecordToListRow } from '@/features/vehicles/lib/vehicles-api'
import { apiClient, apiGet, apiGetBlob } from '@/services/apiClient'
import {
  closeBrowserTab,
  navigateBrowserTab,
} from '@/shared/lib/open-in-new-tab'
import { extractMasterList } from '@/shared/lib/organogram-master-lookup'
import { applyPagination } from '@/shared/utils/pagination'
import { formatFileSizeLabel } from '@/features/trips/lib/trip-form-utils'

import { fetchMaintenanceTypes } from '@/features/maintenance/lib/maintenance-masters-api'
import type {
  MaintenanceLineItem,
  MaintenanceProofFile,
  MaintenanceType,
  WorkOrderDetail,
  WorkOrderListItem,
  WorkOrderProblemReport,
  WorkOrderProofAttachment,
  WorkOrderServiceRecord,
} from '@/features/maintenance/lib/maintenance-mock-data'

export type WorkOrdersPageResult = {
  rows: WorkOrderListItem[]
  totalCount: number
  totalPages: number
  effectivePageSize: number
  serialBase: number
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

function pickWorkOrderStatus(record: ApiRecord): string {
  return (
    pickScalar(record, ['status', 'work_order_status', 'workOrderStatus']) || '—'
  )
}

function normalizeMaintenanceType(value: unknown): MaintenanceType {
  const normalized = toText(value).trim().toUpperCase()
  if (normalized === 'MAJOR') return 'Major'
  return 'Minor'
}

function pickVehicleBlock(record: ApiRecord): ApiRecord {
  return (
    pickNestedRecord(record, ['vehicle', 'assigned_vehicle', 'assignedVehicle']) ?? record
  )
}

function pickDriverBlock(record: ApiRecord): ApiRecord {
  return pickNestedRecord(record, ['driver', 'assigned_driver', 'assignedDriver']) ?? record
}

function pickVehiclePlate(record: ApiRecord): string {
  const directRegistration = pickScalar(record, [
    'vehicle_registration',
    'vehicleRegistration',
  ])
  if (directRegistration) return directRegistration

  const vehicle = pickVehicleBlock(record)
  return (
    pickScalar(vehicle, [
      'vehicle_registration',
      'vehicleRegistration',
      'registration_number',
      'registrationNumber',
      'vehicle_number',
      'vehicleNumber',
      'plate_number',
      'plateNumber',
    ]) ||
    pickScalar(record, [
      'vehicle_registration_number',
      'vehicleRegistrationNumber',
      'registration_number',
      'registrationNumber',
      'vehicle_number',
      'vehicleNumber',
    ]) ||
    '—'
  )
}

function pickVehicleModel(record: ApiRecord): string {
  const vehicle = pickVehicleBlock(record)
  const make = pickScalar(vehicle, ['make', 'vehicle_make', 'vehicleMake'])
  const model = pickScalar(vehicle, ['model', 'vehicle_model', 'vehicleModel'])
  const combined = [make, model].filter(Boolean).join(' ').trim()
  return (
    combined ||
    pickScalar(record, ['vehicle_model', 'vehicleModel', 'make_model', 'makeModel']) ||
    '—'
  )
}

function pickDriverName(record: ApiRecord): string {
  const driver = pickDriverBlock(record)
  return (
    pickScalar(driver, ['name', 'full_name', 'fullName', 'driver_name', 'driverName']) ||
    pickScalar(record, ['driver_name', 'driverName', 'initiated_by_name', 'initiatedByName']) ||
    '—'
  )
}

function pickMaintenanceTypeLabel(record: ApiRecord): string {
  return (
    pickScalar(record, [
      'maintenance_type_name',
      'maintenanceTypeName',
      'maintenance_type_label',
      'maintenanceTypeLabel',
    ]) ||
    pickScalar(record, ['maintenance_type', 'maintenanceType', 'type']) ||
    '—'
  )
}

function pickWorkOrderReference(record: ApiRecord, id: string): string {
  return (
    pickScalar(record, [
      'reference_no',
      'referenceNo',
      'work_order_number',
      'workOrderNumber',
      'work_order_no',
      'workOrderNo',
      'work_order_id',
      'workOrderId',
    ]) || id
  )
}

function mapLineItem(record: ApiRecord, index: number): MaintenanceLineItem | null {
  const id =
    pickScalar(record, ['id', 'line_item_id', 'lineItemId', 'item_id', 'itemId']) ||
    `line-item-${index + 1}`
  const description =
    pickScalar(record, [
      'description',
      'item_description',
      'itemDescription',
      'service_name',
      'serviceName',
      'part_name',
      'partName',
      'name',
    ]) || '—'

  return {
    id,
    description,
    quantity: toNumber(record.quantity ?? record.qty, 1),
    unitPrice: toNumber(
      record.unit_price ?? record.unitPrice ?? record.price ?? record.rate,
      0,
    ),
    notes: pickScalar(record, ['notes', 'note', 'remarks', 'remark']) || undefined,
  }
}

function mapProofAttachment(record: ApiRecord, index: number): WorkOrderProofAttachment | null {
  const id =
    pickScalar(record, ['id', 'attachment_id', 'attachmentId']) || `attachment-${index + 1}`
  const fileName =
    pickScalar(record, ['file_name', 'fileName', 'name', 'original_name', 'originalName']) || ''
  if (!fileName) return null

  const sizeBytes = toNumber(record.file_size ?? record.fileSize ?? record.size, 0)
  const sizeLabel =
    pickScalar(record, ['size_label', 'sizeLabel', 'formatted_size', 'formattedSize']) ||
    (sizeBytes > 0 ? formatFileSizeLabel(sizeBytes) : '—')

  return {
    id,
    fileName,
    sizeLabel,
    contentType: pickScalar(record, ['content_type', 'contentType']) || undefined,
    downloadUrl:
      pickScalar(record, ['download_url', 'downloadUrl', 'url', 'file_url', 'fileUrl']) ||
      undefined,
  }
}

function mapProblemReport(record: ApiRecord, index: number): WorkOrderProblemReport | null {
  const id = pickScalar(record, ['id', 'problem_report_id', 'problemReportId']) || `report-${index + 1}`
  const categoryName =
    pickScalar(record, ['category_name', 'categoryName', 'problem_category_name', 'problemCategoryName']) ||
    '—'
  const description = pickScalar(record, ['description', 'problem_description', 'problemDescription']) || '—'

  const attachmentCandidates = [
    record.proof_attachments,
    record.proofAttachments,
    record.attachments,
  ]
  let proofAttachments: WorkOrderProofAttachment[] = []
  for (const candidate of attachmentCandidates) {
    if (!Array.isArray(candidate)) continue
    proofAttachments = candidate
      .map((item, attachmentIndex) =>
        item && typeof item === 'object'
          ? mapProofAttachment(item as ApiRecord, attachmentIndex)
          : null,
      )
      .filter((item): item is WorkOrderProofAttachment => item !== null)
    if (proofAttachments.length > 0) break
  }

  return {
    id,
    categoryName,
    description,
    proofAttachments,
  }
}

function mapProblemReports(record: ApiRecord): WorkOrderProblemReport[] {
  const candidates = [record.problem_reports, record.problemReports, record.problems]
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue
    return candidate
      .map((item, index) =>
        item && typeof item === 'object' ? mapProblemReport(item as ApiRecord, index) : null,
      )
      .filter((item): item is WorkOrderProblemReport => item !== null)
  }
  return []
}

function mapProofFile(record: ApiRecord): MaintenanceProofFile | undefined {
  const proofBlock = pickNestedRecord(record, ['proof', 'proof_file', 'proofFile', 'attachment'])
  const source = proofBlock ?? record
  const name =
    pickScalar(source, [
      'file_name',
      'fileName',
      'name',
      'original_name',
      'originalName',
      'proof_file_name',
      'proofFileName',
    ]) || pickScalar(record, ['proof_file_name', 'proofFileName'])
  if (!name) return undefined

  const sizeBytes = toNumber(source.size ?? source.file_size ?? source.fileSize, 0)
  const sizeLabel =
    pickScalar(source, ['size_label', 'sizeLabel', 'formatted_size', 'formattedSize']) ||
    (sizeBytes > 0 ? `${(sizeBytes / 1024).toFixed(1)} KB` : '')

  return {
    name,
    sizeLabel: sizeLabel || '—',
  }
}

function mapServiceRecord(value: unknown): WorkOrderServiceRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as ApiRecord
  const id = pickScalar(record, ['id'])
  if (!id) return undefined

  const laborHoursRaw = record.labor_hours ?? record.laborHours
  const laborHours =
    laborHoursRaw === null || laborHoursRaw === undefined || laborHoursRaw === ''
      ? undefined
      : toNumber(laborHoursRaw, Number.NaN)
  const invoiceUrl = pickScalar(record, ['invoice_url', 'invoiceUrl']) || undefined

  return {
    id,
    workOrderId: pickScalar(record, ['work_order_id', 'workOrderId']) || undefined,
    invoiceNumber: pickScalar(record, ['invoice_number', 'invoiceNumber']) || '—',
    invoiceDate: pickScalar(record, ['invoice_date', 'invoiceDate']) || '—',
    invoiceUrl,
    notes: pickScalar(record, ['notes']) || undefined,
    laborHours: Number.isFinite(laborHours) ? laborHours : undefined,
    createdAt: pickScalar(record, ['created_at', 'createdAt']) || undefined,
  }
}

function extractWorkOrderList(payload: unknown): ApiRecord[] {
  const records = extractMasterList(payload)
  if (records.length > 0) return records
  if (!payload || typeof payload !== 'object') return []

  const root = payload as ApiRecord
  const data = root.data
  const dataObj =
    data && typeof data === 'object' && !Array.isArray(data) ? (data as ApiRecord) : null
  const candidates = [
    root.work_orders,
    root.workOrders,
    dataObj?.work_orders,
    dataObj?.workOrders,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is ApiRecord => !!item && typeof item === 'object')
    }
  }

  return []
}

function unwrapWorkOrderDetail(payload: unknown): ApiRecord | null {
  if (!payload || typeof payload !== 'object') return null
  const root = payload as ApiRecord
  if (root.id || root.work_order_id || root.workOrderId) return root

  const data = root.data
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const nested = data as ApiRecord
    if (nested.id || nested.work_order_id || nested.workOrderId) return nested
  }

  const workOrder = root.work_order ?? root.workOrder
  if (workOrder && typeof workOrder === 'object' && !Array.isArray(workOrder)) {
    return workOrder as ApiRecord
  }

  return root
}

export function mapWorkOrderListRow(record: ApiRecord): WorkOrderListItem | null {
  const id = pickScalar(record, ['id', 'work_order_id', 'workOrderId', 'uuid'])
  if (!id) return null

  const maintenanceTypeLabel = pickMaintenanceTypeLabel(record)
  const maintenanceType =
    maintenanceTypeLabel !== '—'
      ? maintenanceTypeLabel
      : normalizeMaintenanceType(record.maintenance_type ?? record.maintenanceType)

  return {
    id,
    workOrderId: pickWorkOrderReference(record, id),
    vehiclePlate: pickVehiclePlate(record),
    assetCode:
      pickScalar(record, ['asset_code', 'assetCode', 'vehicle_asset_code', 'vehicleAssetCode']) ||
      undefined,
    maintenanceType,
    status: pickWorkOrderStatus(record),
  }
}

export function mapWorkOrderDetail(record: ApiRecord): WorkOrderDetail | null {
  const listRow = mapWorkOrderListRow(record)
  if (!listRow) return null

  const lineItemCandidates = [
    record.services_and_parts,
    record.servicesAndParts,
    record.line_items,
    record.lineItems,
    record.services_parts,
    record.servicesParts,
    record.items,
    record.parts,
    record.services,
  ]
  let lineItems: MaintenanceLineItem[] = []
  for (const candidate of lineItemCandidates) {
    if (!Array.isArray(candidate)) continue
    lineItems = candidate
      .map((item, index) =>
        item && typeof item === 'object'
          ? mapLineItem(item as ApiRecord, index)
          : null,
      )
      .filter((item): item is MaintenanceLineItem => item !== null)
    if (lineItems.length > 0) break
  }

  const maintenanceTypeLabel = pickMaintenanceTypeLabel(record)
  const problemReports = mapProblemReports(record)
  const firstReport = problemReports[0]
  const vehicleModel = pickVehicleModel(record)

  return {
    ...listRow,
    maintenanceType:
      maintenanceTypeLabel !== '—' ? maintenanceTypeLabel : listRow.maintenanceType,
    reportedById: pickScalar(record, ['reported_by', 'reportedBy']),
    maintenanceTypeId: pickScalar(record, ['maintenance_type_id', 'maintenanceTypeId']) || undefined,
    driverName: pickDriverName(record),
    vehicleModel: vehicleModel !== '—' ? vehicleModel : listRow.vehiclePlate,
    triggerType: pickScalar(record, ['trigger_type', 'triggerType']) || '—',
    priority: pickScalar(record, ['priority']) || '—',
    initiationReason:
      pickScalar(record, [
        'trigger_type',
        'triggerType',
        'initiation_reason',
        'initiationReason',
        'request_source',
        'requestSource',
        'source',
      ]) || '—',
    problemCategory: firstReport?.categoryName || '—',
    problemDescription: firstReport?.description || '—',
    proof: firstReport?.proofAttachments[0]
      ? {
          name: firstReport.proofAttachments[0].fileName,
          sizeLabel: firstReport.proofAttachments[0].sizeLabel,
          downloadUrl: firstReport.proofAttachments[0].downloadUrl,
        }
      : mapProofFile(record),
    problemReports,
    lineItems,
    maintenanceRequestStatus:
      pickScalar(record, [
        'maintenance_request_status',
        'maintenanceRequestStatus',
        'request_status',
        'requestStatus',
      ]) || undefined,
    vehicleReadyStatus:
      pickScalar(record, [
        'vehicle_ready_status',
        'vehicleReadyStatus',
        'ready_status',
        'readyStatus',
      ]) || undefined,
    lastServiceDate:
      pickScalar(record, [
        'last_service_date',
        'lastServiceDate',
        'previous_service_date',
        'previousServiceDate',
      ]) || undefined,
    serviceRecord: mapServiceRecord(record.service_record ?? record.serviceRecord),
  }
}

export function workOrdersListPath(
  search: string,
  statusFilter: string,
  page: number,
  pageSize: number,
): string {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('page_size', String(pageSize))
  const q = search.trim()
  if (q) params.set('search', q)
  const status = statusFilter.trim()
  if (status && status !== 'all') params.set('status', status)
  return `/maintenance/work-orders?${params.toString()}`
}

export async function fetchWorkOrdersPage(
  search: string,
  statusFilter: string,
  page: number,
  pageSize: number,
): Promise<WorkOrdersPageResult> {
  const payload = await apiGet<unknown>(
    workOrdersListPath(search, statusFilter, page, pageSize),
  )
  const records = extractWorkOrderList(payload)
  const pairs = records
    .map((record) => ({ record, row: mapWorkOrderListRow(record) }))
    .filter(
      (entry): entry is { record: ApiRecord; row: WorkOrderListItem } =>
        entry.row !== null,
    )
  const enrichedMapped = await enrichWorkOrderListRows(pairs)
  const paged = applyPagination(payload, enrichedMapped, page, pageSize, {
    page,
    pageSize,
    pageLength: enrichedMapped.length,
  })

  return {
    rows: paged.rows,
    totalCount: paged.totalCount,
    totalPages: paged.totalPages,
    effectivePageSize: paged.effectivePageSize,
    serialBase: paged.serialBase,
  }
}

function needsMaintenanceTypeLookup(row: WorkOrderListItem, record: ApiRecord): boolean {
  const maintenanceTypeId = pickScalar(record, ['maintenance_type_id', 'maintenanceTypeId'])
  if (!maintenanceTypeId) return false
  const current = row.maintenanceType.trim()
  return current === 'Minor' || current === 'Major' || current === '—' || current === ''
}

async function enrichWorkOrderListRows(
  pairs: Array<{ record: ApiRecord; row: WorkOrderListItem }>,
): Promise<WorkOrderListItem[]> {
  if (!pairs.some(({ record, row }) => needsMaintenanceTypeLookup(row, record))) {
    return pairs.map(({ row }) => row)
  }

  let maintenanceTypes: Awaited<ReturnType<typeof fetchMaintenanceTypes>> = []
  try {
    maintenanceTypes = await fetchMaintenanceTypes()
  } catch {
    return pairs.map(({ row }) => row)
  }

  return pairs.map(({ record, row }) => {
    if (!needsMaintenanceTypeLookup(row, record)) return row
    const maintenanceTypeId = pickScalar(record, ['maintenance_type_id', 'maintenanceTypeId'])
    const match = maintenanceTypes.find((option) => option.value === maintenanceTypeId)
    if (!match?.label) return row
    return { ...row, maintenanceType: match.label }
  })
}

export async function fetchWorkOrderById(workOrderId: string): Promise<WorkOrderDetail> {
  const trimmed = workOrderId.trim()
  if (!trimmed) throw new Error('Missing work order id')
  const payload = await apiGet<unknown>(
    `/maintenance/work-orders/${encodeURIComponent(trimmed)}`,
  )
  const record = unwrapWorkOrderDetail(payload)
  if (!record) throw new Error('Invalid work order response')
  const mapped = mapWorkOrderDetail(record)
  if (!mapped) throw new Error('Invalid work order response')
  return mapped
}

export type DriverAssignedVehicleOption = {
  value: string
  label: string
  searchText?: string
}

function extractDriverVehicleIds(payload: unknown): string[] {
  const idsFromArray = (items: unknown[]): string[] =>
    items
      .map((item) => {
        if (typeof item === 'string') return item.trim()
        if (item && typeof item === 'object') {
          return pickDriverAssignedVehicleId(item as ApiRecord)
        }
        return ''
      })
      .filter(Boolean)

  if (Array.isArray(payload)) {
    return idsFromArray(payload)
  }

  const records = extractDriverVehicleRecords(payload)
  const fromRecords = records
    .map((record) => pickDriverAssignedVehicleId(record))
    .filter(Boolean)
  if (fromRecords.length > 0) return fromRecords

  if (!payload || typeof payload !== 'object') return []

  const root = payload as ApiRecord
  const data = root.data
  const dataObj =
    data && typeof data === 'object' && !Array.isArray(data) ? (data as ApiRecord) : null
  const candidates = [
    root.vehicles,
    root.vehicle_ids,
    root.vehicleIds,
    dataObj?.vehicles,
    dataObj?.vehicle_ids,
    dataObj?.vehicleIds,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const ids = idsFromArray(candidate)
      if (ids.length > 0) return ids
    }
  }

  return []
}

function extractDriverVehicleRecords(payload: unknown): ApiRecord[] {
  const records = extractMasterList(payload)
  if (records.length > 0) return records

  if (Array.isArray(payload)) {
    return payload.filter((item): item is ApiRecord => !!item && typeof item === 'object')
  }

  if (!payload || typeof payload !== 'object') return []

  const root = payload as ApiRecord
  const data = root.data
  const dataObj =
    data && typeof data === 'object' && !Array.isArray(data) ? (data as ApiRecord) : null
  const candidates = [root.vehicles, dataObj?.vehicles]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is ApiRecord => !!item && typeof item === 'object')
    }
  }

  return []
}

function pickDriverAssignedVehicleId(record: ApiRecord): string {
  return (
    pickScalar(record, ['vehicle_id', 'vehicleId']) ||
    pickScalar(pickVehicleBlock(record), ['vehicle_id', 'vehicleId', 'id', 'uuid']) ||
    pickScalar(record, ['id', 'uuid']) ||
    ''
  )
}

function mapVehicleDetailToAssignedOption(
  record: ApiRecord,
  fallbackId: string,
): DriverAssignedVehicleOption {
  const row = mapVehicleRecordToListRow(record)
  const id = row.id || fallbackId
  const vehicle = pickVehicleBlock(record)
  const vehicleName = pickScalar(vehicle, ['vehicle_name', 'vehicleName', 'name'])
  const make = pickScalar(vehicle, ['make', 'vehicle_make', 'vehicleMake'])
  const model = pickScalar(vehicle, ['model', 'vehicle_model', 'vehicleModel'])
  const registration =
    row.registration_number !== '—' && row.registration_number !== id
      ? row.registration_number
      : pickVehiclePlate(record) !== '—'
        ? pickVehiclePlate(record)
        : ''
  const makeModel =
    row.makeModel !== '—'
      ? row.makeModel
      : [make, model].filter(Boolean).join(' ').trim()

  const title = vehicleName || registration || makeModel || id
  const detail = makeModel && makeModel !== title ? makeModel : ''
  const label = detail ? `${title} (${detail})` : title

  return {
    value: id,
    label,
    searchText: [vehicleName, registration, make, model, makeModel, label, id]
      .filter(Boolean)
      .join(' '),
  }
}

export async function fetchDriverAssignedVehicles(
  driverId: string,
): Promise<DriverAssignedVehicleOption[]> {
  const trimmed = driverId.trim()
  if (!trimmed) return []

  const payload = await apiGet<unknown>(`/drivers/${encodeURIComponent(trimmed)}/vehicles`)
  const vehicleIds = extractDriverVehicleIds(payload)
  if (vehicleIds.length === 0) return []

  const details = await Promise.all(
    vehicleIds.map(async (vehicleId) => {
      try {
        const record = await fetchVehicleById(vehicleId)
        return mapVehicleDetailToAssignedOption(record, vehicleId)
      } catch {
        return null
      }
    }),
  )

  return details.filter(
    (option): option is DriverAssignedVehicleOption => option !== null,
  )
}

export type SubmitWorkOrderProblem = {
  description: string
  category_name: string
}

export type SubmitWorkOrderInput = {
  vehicleId: string
  maintenanceTypeId: string
  problems: SubmitWorkOrderProblem[]
  proofFiles: Array<{ file: File; problemIndex: number }>
}

function buildWorkOrderSubmitFormData(input: SubmitWorkOrderInput): FormData {
  const form = new FormData()
  form.append(
    'data',
    JSON.stringify({
      vehicle_id: input.vehicleId,
      maintenance_type_id: input.maintenanceTypeId,
      problems: input.problems,
    }),
  )

  const fileProblemIndices: number[] = []
  for (const { file, problemIndex } of input.proofFiles) {
    form.append('files', file, file.name)
    fileProblemIndices.push(problemIndex)
  }
  form.append('file_problem_indices', JSON.stringify(fileProblemIndices))

  return form
}

export async function submitWorkOrder(input: SubmitWorkOrderInput): Promise<unknown> {
  if (!input.vehicleId.trim()) throw new Error('Vehicle is required')
  if (!input.maintenanceTypeId.trim()) throw new Error('Maintenance type is required')
  if (!input.problems.length) throw new Error('At least one problem is required')

  return apiClient<unknown>('/maintenance/work-orders/submit', {
    method: 'POST',
    body: buildWorkOrderSubmitFormData(input),
  })
}

export type UpdateWorkOrderServicePartItem = {
  name: string
  unit_price: number
  quantity: number
  notes: string
}

export type ApproveWorkOrderInput = {
  remarks: string
  services_and_parts: UpdateWorkOrderServicePartItem[]
}

export type RejectWorkOrderInput = {
  reason: string
}

export async function approveWorkOrder(
  workOrderId: string,
  input: ApproveWorkOrderInput,
): Promise<unknown> {
  const trimmedId = workOrderId.trim()
  if (!trimmedId) throw new Error('Work order id is required')
  if (!input.remarks.trim()) throw new Error('Remarks are required')
  if (!input.services_and_parts.length) throw new Error('At least one service/part item is required')

  return apiClient<unknown>(
    `/maintenance/work-orders/${encodeURIComponent(trimmedId)}/approve`,
    {
      method: 'POST',
      body: JSON.stringify({
        remarks: input.remarks.trim(),
        services_and_parts: input.services_and_parts,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )
}

export async function rejectWorkOrder(
  workOrderId: string,
  input: RejectWorkOrderInput,
): Promise<unknown> {
  const trimmedId = workOrderId.trim()
  if (!trimmedId) throw new Error('Work order id is required')
  if (!input.reason.trim()) throw new Error('Reject reason is required')

  return apiClient<unknown>(
    `/maintenance/work-orders/${encodeURIComponent(trimmedId)}/reject`,
    {
      method: 'POST',
      body: JSON.stringify({
        reason: input.reason.trim(),
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )
}

export async function updateWorkOrderServicesAndParts(
  workOrderId: string,
  items: UpdateWorkOrderServicePartItem[],
): Promise<unknown> {
  const trimmedId = workOrderId.trim()
  if (!trimmedId) throw new Error('Work order id is required')
  if (!items.length) throw new Error('At least one service/part item is required')

  return apiClient<unknown>(
    `/maintenance/work-orders/${encodeURIComponent(trimmedId)}/update-services-and-parts`,
    {
      method: 'POST',
      body: JSON.stringify({ new_items: items }),
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )
}

export type CompleteWorkOrderInput = {
  final_odometer_km: number
}

export type VerifyWorkOrderInput = {
  invoice_number: string
  invoice_date: string
  remarks?: string
  invoice_file?: File | null
}

function buildVerifyWorkOrderFormData(input: VerifyWorkOrderInput): FormData {
  const form = new FormData()
  form.append('invoice_number', input.invoice_number.trim())
  form.append('invoice_date', input.invoice_date.trim())
  const remarks = input.remarks?.trim()
  if (remarks) form.append('remarks', remarks)
  if (input.invoice_file) {
    form.append('invoice_file', input.invoice_file, input.invoice_file.name)
  }
  return form
}

export async function completeWorkOrder(
  workOrderId: string,
  input: CompleteWorkOrderInput,
): Promise<unknown> {
  const trimmedId = workOrderId.trim()
  if (!trimmedId) throw new Error('Work order id is required')
  if (!Number.isFinite(input.final_odometer_km) || input.final_odometer_km < 0) {
    throw new Error('Final odometer must be zero or greater')
  }

  return apiClient<unknown>(
    `/maintenance/work-orders/${encodeURIComponent(trimmedId)}/complete`,
    {
      method: 'POST',
      body: JSON.stringify({
        final_odometer_km: input.final_odometer_km,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )
}

export async function verifyWorkOrder(
  workOrderId: string,
  input: VerifyWorkOrderInput,
): Promise<unknown> {
  const trimmedId = workOrderId.trim()
  if (!trimmedId) throw new Error('Work order id is required')
  if (!input.invoice_number.trim()) throw new Error('Invoice number is required')
  if (!input.invoice_date.trim()) throw new Error('Invoice date is required')

  return apiClient<unknown>(
    `/maintenance/work-orders/${encodeURIComponent(trimmedId)}/verify`,
    {
      method: 'POST',
      body: buildVerifyWorkOrderFormData(input),
    },
  )
}

function pickInvoiceUrlFromPayload(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const root = payload as ApiRecord
  const data =
    root.data && typeof root.data === 'object' && !Array.isArray(root.data)
      ? (root.data as ApiRecord)
      : null

  return (
    pickScalar(data ?? root, [
      'url',
      'download_url',
      'downloadUrl',
      'invoice_url',
      'invoiceUrl',
      'signed_url',
      'signedUrl',
    ]) || ''
  )
}

function guessInvoiceMimeType(fileName: string): string {
  const lower = fileName.trim().toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  return 'application/octet-stream'
}

/** GET `/maintenance/work-orders/{id}/invoice` and open the invoice in a new browser tab. */
export async function openWorkOrderInvoice(
  workOrderId: string,
  fileName = '',
  targetWindow?: Window | null,
): Promise<void> {
  const trimmed = workOrderId.trim()
  if (!trimmed) throw new Error('Work order id is required')

  try {
    const { blob, contentType } = await apiGetBlob(
      `/maintenance/work-orders/${encodeURIComponent(trimmed)}/invoice`,
    )

    if (contentType.includes('application/json')) {
      const payload = JSON.parse(await blob.text()) as unknown
      const url = pickInvoiceUrlFromPayload(payload)
      if (!url) throw new Error('Invoice URL not found')
      navigateBrowserTab(targetWindow, url)
      return
    }

    const mimeType =
      contentType && contentType !== 'application/octet-stream'
        ? contentType
        : guessInvoiceMimeType(fileName)
    const fileBlob = mimeType === blob.type ? blob : blob.slice(0, blob.size, mimeType)
    const objectUrl = URL.createObjectURL(fileBlob)
    navigateBrowserTab(targetWindow, objectUrl)
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
  } catch (error) {
    closeBrowserTab(targetWindow)
    throw error
  }
}
