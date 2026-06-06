import { apiDelete, apiGet, apiPost, apiPut } from '@/services/apiClient'
import { applyPagination } from '@/shared/utils/pagination'

type ApiRecord = Record<string, unknown>

export type ApprovalConditionBody = {
  name: string
  label: string
  has_employee_field: boolean
}

export type ApprovalConditionRecord = {
  id: string
  approvalHeadId: string
  approvalHeadName: string
  name: string
  label: string
  hasEmployeeField: boolean
}

export type ApprovalConditionTableRow = ApprovalConditionRecord & { serialNo: number }

function toText(value: unknown) {
  return typeof value === 'string'
    ? value.trim()
    : typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : ''
}

function toBool(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value
  if (value === 1 || value === '1') return true
  if (value === 0 || value === '0') return false
  return fallback
}

function toArray(payload: unknown): ApiRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is ApiRecord => !!item && typeof item === 'object')
  }
  if (!payload || typeof payload !== 'object') return []
  const root = payload as Record<string, unknown>
  const dataObj = root.data as Record<string, unknown> | undefined
  const candidates = [
    root.data,
    root.items,
    root.results,
    dataObj?.items,
    dataObj?.results,
  ]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is ApiRecord => !!item && typeof item === 'object')
    }
  }
  return []
}

function readApprovalHeadName(record: ApiRecord) {
  const nested = record.approval_head ?? record.approvalHead
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const head = nested as ApiRecord
    return toText(head.name) || toText(head.title)
  }
  return (
    toText(record.approval_head_name) ||
    toText(record.approvalHeadName) ||
    toText(record.head_name) ||
    toText(record.headName)
  )
}

function readApprovalHeadId(record: ApiRecord) {
  const nested = record.approval_head ?? record.approvalHead
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const head = nested as ApiRecord
    return toText(head.id) || toText(head.uuid)
  }
  return (
    toText(record.workflow_approval_head_id) ||
    toText(record.workflowApprovalHeadId) ||
    toText(record.approval_head_id) ||
    toText(record.approvalHeadId) ||
    toText(record.head_id) ||
    toText(record.headId)
  )
}

export function mapApprovalConditionRecord(record: ApiRecord): ApprovalConditionRecord {
  return {
    id: toText(record.id) || toText(record.uuid),
    approvalHeadId: readApprovalHeadId(record),
    approvalHeadName: readApprovalHeadName(record),
    name:
      toText(record.name) ||
      toText(record.field_name) ||
      toText(record.fieldName),
    label:
      toText(record.label) ||
      toText(record.field_label) ||
      toText(record.fieldLabel),
    hasEmployeeField: toBool(record.has_employee_field ?? record.hasEmployeeField, false),
  }
}

function approvalConditionFieldsBasePath(approvalHeadId: string) {
  const id = approvalHeadId.trim()
  if (!id) throw new Error('Approval head id is required')
  return `/workflows/approval-heads/${encodeURIComponent(id)}/condition-fields`
}

export function listApprovalConditionsPath(
  approvalHeadId: string,
  search: string,
  page: number,
  pageSize: number,
) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('page_size', String(pageSize))
  const q = search.trim()
  if (q) params.set('search', q)
  return `${approvalConditionFieldsBasePath(approvalHeadId)}?${params.toString()}`
}

export async function fetchApprovalConditionsPage(
  approvalHeadId: string,
  search: string,
  page: number,
  pageSize: number,
) {
  const payload = await apiGet<unknown>(
    listApprovalConditionsPath(approvalHeadId, search, page, pageSize),
  )
  const records = toArray(payload).map(mapApprovalConditionRecord).filter((row) => row.id)
  const paged = applyPagination(payload, records, page, pageSize, {
    page,
    pageSize,
    pageLength: records.length,
  })
  const rows: ApprovalConditionTableRow[] = paged.rows.map((row, index) => ({
    ...row,
    serialNo: paged.serialBase + index + 1,
  }))
  return {
    rows,
    totalCount: paged.totalCount,
    totalPages: paged.totalPages,
    effectivePageSize: paged.effectivePageSize,
  }
}

export function createApprovalCondition(approvalHeadId: string, body: ApprovalConditionBody) {
  return apiPost<unknown, ApprovalConditionBody>(
    approvalConditionFieldsBasePath(approvalHeadId),
    body,
  )
}

export function updateApprovalCondition(
  approvalHeadId: string,
  id: string,
  body: ApprovalConditionBody,
) {
  return apiPut<unknown, ApprovalConditionBody>(
    `${approvalConditionFieldsBasePath(approvalHeadId)}/${encodeURIComponent(id)}`,
    body,
  )
}

export function deleteApprovalCondition(approvalHeadId: string, id: string) {
  return apiDelete<unknown>(
    `${approvalConditionFieldsBasePath(approvalHeadId)}/${encodeURIComponent(id)}`,
  )
}

export function toApprovalConditionPayload(raw: {
  name: string
  label: string
  hasEmployeeField: boolean
}): ApprovalConditionBody {
  return {
    name: raw.name.trim(),
    label: raw.label.trim(),
    has_employee_field: raw.hasEmployeeField,
  }
}
