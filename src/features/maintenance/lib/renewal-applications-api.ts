import type { ApiRecord } from '@/features/user/lib/roles-api'
import { apiGet, apiGetBlob, apiPost } from '@/services/apiClient'
import { extractMasterList } from '@/shared/lib/organogram-master-lookup'
import { closeBrowserTab, navigateBrowserTab } from '@/shared/lib/open-in-new-tab'

export type RenewalDocumentType = {
  id: string
  name: string
  code: string
}

export type RenewalApplicationItem = {
  id: string
  documentTypeId: string
  documentTypeName: string
  documentTypeCode: string
  currentExpiryDate: string
  amount: number | null
  company: string
  receiptFileName: string
  receiptUrl: string
  receiptObjectKey: string
  newExpiryDate: string
  status: string
}

export type RenewalApplication = {
  id: string
  applicationNumber: string
  vehicleNumber: string
  status: string
  completedCount: number
  totalCount: number
  renewalTypeLabels: string[]
  renewalTypeIds: string[]
  items: RenewalApplicationItem[]
  createdAt: string
  remarks: string
  driverName: string
  designationType: string
}

export type SubmitRenewalApplicationInput = {
  selectedDocumentTypeIds: string[]
  submissionRemarks: string
}

export const RENEWAL_PENDING_DRIVER_STATUS = 'PENDING_DRIVER_RESPONSE'

export type RenewalApplicationListFilters = {
  status?: string
  /** Document type code, for example `VEHICLE_REGISTRATION`. */
  code?: string
  /** Vehicle designated type, for example `SECRETARIAT`. Sent as `designation_type`. */
  designationType?: string
}

const ITEM_LIST_KEYS = [
  'items',
  'lines',
  'documents',
  'renewal_items',
  'renewalItems',
  'renewal_documents',
  'renewalDocuments',
  'application_items',
  'applicationItems',
  'document_renewals',
  'documentRenewals',
  'renewals',
]

function pickScalar(record: ApiRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return ''
}

function pickNumber(record: ApiRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
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

function pickRecordList(record: ApiRecord, keys: string[]): ApiRecord[] {
  for (const key of keys) {
    const value = record[key]
    if (!Array.isArray(value)) continue
    return value.filter((item): item is ApiRecord => !!item && typeof item === 'object')
  }
  return []
}

function isActiveRecord(record: ApiRecord): boolean {
  if (record.active === undefined && record.is_active === undefined && record.isActive === undefined) {
    return true
  }
  const flag = record.active ?? record.is_active ?? record.isActive
  return flag === true || flag === 1 || flag === '1' || flag === 'true'
}

export function isInsuranceDocumentType(name: string, code = ''): boolean {
  return `${name} ${code}`.toLowerCase().includes('insurance')
}

function pickInsuranceCompanyName(record: ApiRecord): string {
  const insurance = pickNestedRecord(record, [
    'insurance',
    'vehicle_insurance',
    'vehicleInsurance',
    'insurance_detail',
    'insuranceDetail',
  ])
  const companyKeys = [
    'insurance_company_name',
    'insuranceCompanyName',
    'company_name',
    'companyName',
    'company',
    'insurance_company',
    'insuranceCompany',
    'provider_name',
    'providerName',
    'insurance_provider',
    'insuranceProvider',
  ]
  return (
    (insurance ? pickScalar(insurance, [...companyKeys, 'name']) : '') ||
    pickScalar(record, companyKeys)
  )
}

function pickDocumentType(record: ApiRecord): { id: string; name: string; code: string } {
  const nested =
    pickNestedRecord(record, [
      'renewal_document_type',
      'renewalDocumentType',
      'document_type',
      'documentType',
      'type',
    ]) ?? {}

  const id =
    pickScalar(nested, ['id', 'uuid', 'renewal_document_type_id', 'document_type_id']) ||
    pickScalar(record, [
      'renewal_document_type_id',
      'renewalDocumentTypeId',
      'document_type_id',
      'documentTypeId',
    ])
  const code =
    pickScalar(nested, ['code', 'document_type_code', 'documentTypeCode']) ||
    pickScalar(record, [
      'document_type_code',
      'documentTypeCode',
      'renewal_document_type_code',
      'renewalDocumentTypeCode',
      'type_code',
      'typeCode',
    ])
  const name =
    pickScalar(nested, ['name', 'label', 'document_type_name', 'documentTypeName']) ||
    pickScalar(record, [
      'document_type_name',
      'documentTypeName',
      'renewal_document_type_name',
      'renewalDocumentTypeName',
      'renewal_type',
      'renewalType',
      'type_name',
      'typeName',
    ]) ||
    code

  return { id, name, code }
}

function pickPersonName(record: ApiRecord, keys: string[]): string {
  const nested = pickNestedRecord(record, keys)
  if (!nested) return ''
  const direct = pickScalar(nested, ['name', 'full_name', 'fullName', 'display_name', 'displayName'])
  if (direct) return direct
  const first = pickScalar(nested, ['first_name', 'firstName'])
  const last = pickScalar(nested, ['last_name', 'lastName'])
  return [first, last].filter(Boolean).join(' ')
}

function pickReceiptFileName(record: ApiRecord): string {
  const direct = pickScalar(record, [
    'receipt_file_name',
    'receiptFileName',
    'receipt_name',
    'receiptName',
    'file_name',
    'fileName',
    'original_filename',
    'originalFilename',
  ])
  if (direct) return direct

  const receipt = pickNestedRecord(record, ['receipt', 'receipt_file', 'receiptFile', 'attachment'])
  if (!receipt) return ''
  return pickScalar(receipt, ['file_name', 'fileName', 'name', 'original_filename', 'originalFilename'])
}

export function receiptNameFromObjectKey(objectKey: string): string {
  const segment = objectKey.trim().split('?')[0]?.split('/').filter(Boolean).pop() ?? ''
  if (!segment) return ''
  let decoded = segment
  try {
    decoded = decodeURIComponent(segment)
  } catch {
    decoded = segment
  }
  return decoded.replace(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i,
    '',
  )
}

function pickReceiptUrl(record: ApiRecord): string {
  const direct = pickScalar(record, [
    'receipt_url',
    'receiptUrl',
    'file_url',
    'fileUrl',
    'receipt_file_url',
    'receiptFileUrl',
    'download_url',
    'downloadUrl',
  ])
  if (direct) return direct

  const receipt = pickNestedRecord(record, ['receipt', 'receipt_file', 'receiptFile', 'attachment', 'file'])
  if (!receipt) return ''
  return pickScalar(receipt, ['url', 'file_url', 'fileUrl', 'download_url', 'downloadUrl'])
}

function mapRenewalItem(
  record: ApiRecord,
  index: number,
  options?: { ignoreRecordId?: boolean },
): RenewalApplicationItem {
  const documentType = pickDocumentType(record)
  const id =
    pickScalar(
      record,
      options?.ignoreRecordId
        ? ['item_id', 'itemId', 'line_id', 'lineId']
        : ['id', 'uuid', 'item_id', 'itemId', 'line_id', 'lineId'],
    ) || `renewal-item-${index + 1}`

  return {
    id,
    documentTypeId: documentType.id,
    documentTypeName: documentType.name,
    documentTypeCode: documentType.code,
    currentExpiryDate: pickScalar(record, [
      'old_expiry_date',
      'oldExpiryDate',
      'current_expiry_date',
      'currentExpiryDate',
      'expiry_date',
      'expiryDate',
      'document_expiry_date',
      'documentExpiryDate',
      'expires_at',
      'expiresAt',
      'expires_on',
      'expiresOn',
      'valid_until',
      'validUntil',
      'valid_to',
      'validTo',
      'valid_till',
      'validTill',
    ]),
    amount: pickNumber(record, ['amount', 'renewal_amount', 'renewalAmount', 'fee', 'cost']),
    company: pickInsuranceCompanyName(record),
    receiptObjectKey: pickScalar(record, ['receipt_object_key', 'receiptObjectKey']),
    receiptFileName:
      pickReceiptFileName(record) ||
      receiptNameFromObjectKey(pickScalar(record, ['receipt_object_key', 'receiptObjectKey'])),
    receiptUrl: pickReceiptUrl(record),
    newExpiryDate: pickScalar(record, [
      'new_expiry_date',
      'newExpiryDate',
      'renewed_expiry_date',
      'renewedExpiryDate',
      'next_expiry_date',
      'nextExpiryDate',
    ]),
    status: options?.ignoreRecordId
      ? ''
      : pickScalar(record, ['status', 'item_status', 'itemStatus', 'document_status', 'documentStatus']),
  }
}

function collectTypeLabels(record: ApiRecord, items: RenewalApplicationItem[]): string[] {
  const labels = items.map((item) => item.documentTypeName).filter(Boolean)
  if (labels.length > 0) return [...new Set(labels)]

  const direct = pickScalar(record, [
    'renewal_type',
    'renewalType',
    'renewal_types',
    'document_type_name',
    'documentTypeName',
  ])
  if (direct) return [direct]

  const list = record.renewal_types ?? record.renewalTypes ?? record.document_types ?? record.documentTypes
  if (Array.isArray(list)) {
    const fromList = list
      .map((entry) => {
        if (typeof entry === 'string') return entry.trim()
        if (entry && typeof entry === 'object') {
          return pickScalar(entry as ApiRecord, ['name', 'label', 'code'])
        }
        return ''
      })
      .filter(Boolean)
    if (fromList.length > 0) return [...new Set(fromList)]
  }

  return []
}

function mapRenewalApplication(record: ApiRecord): RenewalApplication | null {
  const id = pickScalar(record, ['id', 'uuid', 'application_id', 'applicationId'])
  if (!id) return null

  const nestedItems = pickRecordList(record, ITEM_LIST_KEYS)
  const items =
    nestedItems.length > 0
      ? nestedItems.map((item, index) => mapRenewalItem(item, index))
      : [mapRenewalItem(record, 0, { ignoreRecordId: true })].filter(
          (item) =>
            item.documentTypeId ||
            item.documentTypeName ||
            item.currentExpiryDate ||
            item.amount !== null,
        )

  const renewalTypeLabels = collectTypeLabels(record, items)
  const renewalTypeIds = [
    ...new Set(items.map((item) => item.documentTypeId).filter(Boolean)),
  ]

  const vehicle =
    pickNestedRecord(record, ['vehicle', 'assigned_vehicle', 'assignedVehicle']) ?? record
  const vehicleNumber =
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
      'vehicle_registration',
      'vehicleRegistration',
      'vehicle_number',
      'vehicleNumber',
      'registration_number',
      'registrationNumber',
    ]) ||
    '—'

  const totalFromApi = pickNumber(record, [
    'total_count',
    'totalCount',
    'total_items',
    'totalItems',
    'document_count',
    'documentCount',
    'total_documents',
    'totalDocuments',
  ])
  const completedFromApi = pickNumber(record, [
    'completed_count',
    'completedCount',
    'completed_items',
    'completedItems',
    'completed_documents',
    'completedDocuments',
  ])
  const totalCount = totalFromApi ?? (items.length > 0 ? items.length : renewalTypeLabels.length || 0)
  const itemCompleted = nestedItems.filter((item) => {
    const status = pickScalar(item, ['status', 'item_status', 'itemStatus']).toLowerCase()
    return status.includes('complet') || status.includes('submitted') || status.includes('approv')
  }).length

  return {
    id,
    applicationNumber:
      pickScalar(record, [
        'application_number',
        'applicationNumber',
        'application_no',
        'applicationNo',
        'reference_no',
        'referenceNo',
        'reference_number',
        'referenceNumber',
        'code',
      ]) || id,
    vehicleNumber,
    status: pickScalar(record, ['status', 'application_status', 'applicationStatus']) || '—',
    completedCount: completedFromApi ?? itemCompleted,
    totalCount,
    renewalTypeLabels,
    renewalTypeIds,
    items,
    createdAt: pickScalar(record, [
      'created_at',
      'createdAt',
      'raised_at',
      'raisedAt',
      'triggered_at',
      'triggeredAt',
      'submitted_at',
      'submittedAt',
    ]),
    remarks: pickScalar(record, ['remarks', 'remark', 'notes', 'note', 'description']),
    designationType: pickScalar(record, ['designation_type', 'designationType']),
    driverName:
      pickPersonName(record, ['driver', 'submitted_by', 'submittedBy', 'assigned_driver', 'assignedDriver']) ||
      pickScalar(record, ['driver_name', 'driverName', 'submitted_by_name', 'submittedByName']),
  }
}

function extractRenewalRecords(payload: unknown): ApiRecord[] {
  const records = extractMasterList(payload)
  if (records.length > 0) return records
  if (!payload || typeof payload !== 'object') return []

  const root = payload as ApiRecord
  const data =
    root.data && typeof root.data === 'object' && !Array.isArray(root.data)
      ? (root.data as ApiRecord)
      : null
  const candidates = [
    root.renewal_applications,
    root.renewalApplications,
    root.applications,
    data?.renewal_applications,
    data?.renewalApplications,
    data?.applications,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is ApiRecord => !!item && typeof item === 'object')
    }
  }

  return []
}

function unwrapRenewalDetail(payload: unknown): ApiRecord | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const root = payload as ApiRecord
  if (pickScalar(root, ['id', 'uuid', 'application_id', 'applicationId'])) return root

  const data = root.data
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const nested = data as ApiRecord
    if (pickScalar(nested, ['id', 'uuid', 'application_id', 'applicationId'])) return nested
  }

  const application = root.renewal_application ?? root.renewalApplication ?? root.application
  if (application && typeof application === 'object' && !Array.isArray(application)) {
    return application as ApiRecord
  }

  return root
}

export function formatRenewalStatusLabel(status: string): string {
  const cleaned = status.trim().replace(/_+/g, ' ').replace(/\s+/g, ' ')
  if (!cleaned || cleaned === '—') return '—'
  return cleaned.toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase())
}

export function normalizeRenewalStatus(status: string): string {
  return status.trim().toUpperCase().replace(/[\s-]+/g, '_')
}

export function isSecretariatDesignationType(value: string): boolean {
  return value.trim().toUpperCase().replace(/[\s-]+/g, '_') === 'SECRETARIAT'
}

export function isRenewalPaidStatus(status: string): boolean {
  return normalizeRenewalStatus(status) === 'PAID'
}

/** Submitted or resubmitted: finance officer can approve or reject. */
export function isRenewalFinanceReviewStatus(status: string): boolean {
  const normalized = normalizeRenewalStatus(status)
  return normalized === 'SUBMITTED' || normalized === 'RESUBMITTED'
}

/** Verified or returned: accountant can proceed for renewal. */
export function isRenewalAccountantProceedStatus(status: string): boolean {
  const normalized = normalizeRenewalStatus(status)
  return normalized === 'VERIFIED' || normalized === 'RETURNED'
}

/** Proceed for renewal: driver or designated MTO can upload receipts. */
export function isRenewalReceiptUploadStatus(status: string): boolean {
  const normalized = normalizeRenewalStatus(status)
  return normalized === 'PROCEED_FOR_RENEWAL' || normalized === 'PROCEED'
}

/** Returned: driver or designated MTO can resubmit. */
export function isRenewalResubmitStatus(status: string): boolean {
  return normalizeRenewalStatus(status) === 'RETURNED'
}

export function renewalStatusBadgeClass(status: string): string {
  const normalized = normalizeRenewalStatus(status)
  if (
    normalized === 'PAID' ||
    normalized === 'VERIFIED' ||
    normalized.includes('APPROV') ||
    normalized.includes('COMPLET')
  ) {
    return 'border-transparent bg-[#ecfdf5] text-[#059669] hover:bg-[#ecfdf5]'
  }
  if (normalized.includes('REJECT')) {
    return 'border-transparent bg-[#fee2e2] text-[#b91c1c] hover:bg-[#fee2e2]'
  }
  if (
    normalized.includes('PENDING') ||
    normalized === 'RETURNED' ||
    normalized === 'SUBMITTED' ||
    normalized === 'RESUBMITTED'
  ) {
    return 'border-transparent bg-[#fef9c3] text-[#a16207] hover:bg-[#fef9c3]'
  }
  return 'border-transparent bg-[#edf2f7] text-[#2d3748] hover:bg-[#edf2f7]'
}

/** `GET /maintenance/renewal-document-types` */
export async function fetchRenewalDocumentTypes(): Promise<RenewalDocumentType[]> {
  const payload = await apiGet<unknown>('/maintenance/renewal-document-types')
  return extractMasterList(payload)
    .filter(isActiveRecord)
    .map((record) => {
      const id = pickScalar(record, ['id', 'uuid'])
      const code = pickScalar(record, ['code'])
      const name = pickScalar(record, ['name', 'label']) || code
      if (!id || !name) return null
      return { id, name, code }
    })
    .filter((option): option is RenewalDocumentType => option !== null)
}

/** `GET /maintenance/renewal-applications` with optional `status` and document type `code`. */
export async function fetchRenewalApplications(
  filters: RenewalApplicationListFilters = {},
): Promise<RenewalApplication[]> {
  const params = new URLSearchParams()
  const status = filters.status?.trim()
  const code = filters.code?.trim()
  const designationType = filters.designationType?.trim()
  if (status) params.set('status', status)
  if (code) params.set('code', code)
  if (designationType) params.set('designation_type', designationType)
  const query = params.toString()
  const path = query
    ? `/maintenance/renewal-applications?${query}`
    : '/maintenance/renewal-applications'

  const payload = await apiGet<unknown>(path)
  return extractRenewalRecords(payload)
    .map(mapRenewalApplication)
    .filter((row): row is RenewalApplication => row !== null)
}

/** `GET /maintenance/renewal-applications/{id}` */
export async function fetchRenewalApplication(applicationId: string): Promise<RenewalApplication> {
  const trimmed = applicationId.trim()
  if (!trimmed) throw new Error('Renewal application id is required')
  const payload = await apiGet<unknown>(
    `/maintenance/renewal-applications/${encodeURIComponent(trimmed)}`,
  )
  const record = unwrapRenewalDetail(payload)
  const application = record ? mapRenewalApplication(record) : null
  if (!application) throw new Error('Renewal application could not be loaded.')
  return application
}

/** `POST /maintenance/renewal-applications/{id}/submit` */
export function submitRenewalApplication(
  applicationId: string,
  input: SubmitRenewalApplicationInput,
): Promise<unknown> {
  const trimmed = applicationId.trim()
  if (!trimmed) throw new Error('Renewal application id is required')
  const selectedDocumentTypeIds = [
    ...new Set(input.selectedDocumentTypeIds.map((id) => id.trim()).filter(Boolean)),
  ]
  if (selectedDocumentTypeIds.length === 0) {
    throw new Error('This application has no documents to submit.')
  }

  return apiPost<unknown, { selected_document_type_ids: string[]; submission_remarks: string }>(
    `/maintenance/renewal-applications/${encodeURIComponent(trimmed)}/submit`,
    {
      selected_document_type_ids: selectedDocumentTypeIds,
      submission_remarks: input.submissionRemarks.trim(),
    },
  )
}

export type RenewalVerificationAction = 'APPROVE' | 'REJECT'

function renewalApplicationActionPath(applicationId: string, action: string): string {
  const trimmed = applicationId.trim()
  if (!trimmed) throw new Error('Renewal application id is required')
  return `/maintenance/renewal-applications/${encodeURIComponent(trimmed)}/${action}`
}

/** `POST /maintenance/renewal-applications/{id}/verify` */
export function verifyRenewalApplication(
  applicationId: string,
  input: { action: RenewalVerificationAction; verificationRemarks: string },
): Promise<unknown> {
  return apiPost<unknown, { action: RenewalVerificationAction; verification_remarks: string }>(
    renewalApplicationActionPath(applicationId, 'verify'),
    {
      action: input.action,
      verification_remarks: input.verificationRemarks.trim(),
    },
  )
}

/** `POST /maintenance/renewal-applications/{id}/proceed` */
export function proceedRenewalApplication(
  applicationId: string,
  input: { accountantRemarks: string },
): Promise<unknown> {
  return apiPost<unknown, { accountant_remarks: string }>(
    renewalApplicationActionPath(applicationId, 'proceed'),
    { accountant_remarks: input.accountantRemarks.trim() },
  )
}

/** `POST /maintenance/renewal-applications/{id}/resubmit` */
export function resubmitRenewalApplication(
  applicationId: string,
  input: { submissionRemarks: string },
): Promise<unknown> {
  return apiPost<unknown, { submission_remarks: string }>(
    renewalApplicationActionPath(applicationId, 'resubmit'),
    { submission_remarks: input.submissionRemarks.trim() },
  )
}

export type RenewalReceiptUploadDocument = {
  documentTypeId: string
  newDocumentNumber: string
  receiptFile: File
}

type RenewalReceiptDocumentPayload = {
  document_type_id: string
  new_document_number?: string
  receipt_object_key: string
}

function renewalReceiptObjectKey(applicationId: string, documentTypeId: string, file: File): string {
  const safeName = file.name.trim().replace(/[^\w.-]+/g, '_') || 'receipt'
  const unique =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : String(Date.now())
  return `renewal-receipts/${applicationId}/${documentTypeId}/${unique}-${safeName}`
}

/**
 * `POST /maintenance/renewal-applications/{id}/upload-receipt`
 * `{ documents: [{ document_type_id, receipt_object_key, new_document_number? }] }`
 */
export async function uploadRenewalApplicationReceipts(
  applicationId: string,
  documents: RenewalReceiptUploadDocument[],
): Promise<unknown> {
  const trimmed = applicationId.trim()
  if (!trimmed) throw new Error('Renewal application id is required')
  if (documents.length === 0) throw new Error('Upload a receipt for each document.')

  const prepared: RenewalReceiptDocumentPayload[] = []
  for (const document of documents) {
    const documentTypeId = document.documentTypeId.trim()
    const newDocumentNumber = document.newDocumentNumber.trim()
    if (!documentTypeId) throw new Error('A renewal document is missing its document type.')
    if (!document.receiptFile) throw new Error('Upload a receipt for each document.')
    prepared.push({
      document_type_id: documentTypeId,
      ...(newDocumentNumber ? { new_document_number: newDocumentNumber } : {}),
      receipt_object_key: renewalReceiptObjectKey(trimmed, documentTypeId, document.receiptFile),
    })
  }

  return apiPost<unknown, { documents: RenewalReceiptDocumentPayload[] }>(
    renewalApplicationActionPath(trimmed, 'upload-receipt'),
    { documents: prepared },
  )
}

function pickReceiptUrlFromPayload(payload: unknown): string {
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
      'receipt_url',
      'receiptUrl',
      'signed_url',
      'signedUrl',
    ]) || ''
  )
}

function guessReceiptMimeType(fileName: string): string {
  const lower = fileName.trim().toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  return 'application/octet-stream'
}

/** GET the renewal document receipt and open it in a new browser tab. */
export async function openRenewalDocumentReceipt(
  applicationId: string,
  documentId: string,
  fileName = '',
  targetWindow?: Window | null,
): Promise<void> {
  const application = applicationId.trim()
  const document = documentId.trim()
  if (!application || !document) throw new Error('Receipt could not be opened.')

  try {
    const { blob, contentType } = await apiGetBlob(
      `/maintenance/renewal-applications/${encodeURIComponent(application)}/documents/${encodeURIComponent(document)}/receipt`,
    )

    if (contentType.includes('application/json')) {
      const payload = JSON.parse(await blob.text()) as unknown
      const url = pickReceiptUrlFromPayload(payload)
      if (!url) throw new Error('Receipt URL not found')
      navigateBrowserTab(targetWindow, url)
      return
    }

    const mimeType =
      contentType && contentType !== 'application/octet-stream'
        ? contentType
        : guessReceiptMimeType(fileName)
    const fileBlob = mimeType === blob.type ? blob : blob.slice(0, blob.size, mimeType)
    const objectUrl = URL.createObjectURL(fileBlob)
    navigateBrowserTab(targetWindow, objectUrl)
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
  } catch (error) {
    closeBrowserTab(targetWindow)
    throw error
  }
}
