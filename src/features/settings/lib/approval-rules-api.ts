import { apiDelete, apiGet, apiPost, apiPut } from '@/services/apiClient'
import { applyPagination } from '@/shared/utils/pagination'

type ApiRecord = Record<string, unknown>

export type WorkflowDefinitionPayload = {
  name: string;
  workflow_module_id: string;
  workflow_approval_head_id: string;
  description: string;
  is_active: boolean;
  start_date: string;
  end_date: string;
};

export type WorkflowDefinitionRecord = {
  id: string;
  name: string;
  workflow_approval_head_id: string;
  workflow_module_id: string;
  description: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
};

export type WorkflowDefinitionTableRow = WorkflowDefinitionRecord & { serialNo: number }

export type ApprovableTypeOption = {
  id: string
  value: string
  label: string
  types: { value: string; label: string }[]
}

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
    toText(record.approvalHeadId)
  )
}

function mapSubtypeOption(record: ApiRecord | string) {
  if (typeof record === 'string') {
    const value = record.trim()
    return value ? { value, label: value } : null
  }
  const value =
    toText(record.value) ||
    toText(record.code) ||
    toText(record.name) ||
    toText(record.type) ||
    toText(record.id)
  if (!value) return null
  const label =
    toText(record.label) ||
    toText(record.title) ||
    toText(record.display_name) ||
    toText(record.displayName) ||
    value
  return { value, label }
}

function mapApprovableTypeOption(record: ApiRecord | string): ApprovableTypeOption | null {
  if (typeof record === 'string') {
    const value = record.trim()
    return value ? { id: '', value, label: value, types: [] } : null
  }

  const value =
    toText(record.value) ||
    toText(record.code) ||
    toText(record.module) ||
    toText(record.name) ||
    toText(record.id)
  if (!value) return null

  const label =
    toText(record.label) ||
    toText(record.title) ||
    toText(record.display_name) ||
    toText(record.displayName) ||
    value

  const nestedTypes = [
    record.types,
    record.subtypes,
    record.sub_types,
    record.children,
    record.options,
  ].find(Array.isArray)

  const types = Array.isArray(nestedTypes)
    ? nestedTypes
        .map((item) =>
          typeof item === 'object' && item
            ? mapSubtypeOption(item as ApiRecord)
            : mapSubtypeOption(String(item)),
        )
        .filter((item): item is { value: string; label: string } => !!item)
    : []

  return { id: toText(record.id) || toText(record.uuid), value, label, types }
}

export function mapWorkflowDefinitionRecord(record: ApiRecord): WorkflowDefinitionRecord {
  return {
    id: toText(record.id) || toText(record.uuid),
    workflow_approval_head_id: readApprovalHeadId(record),
    name: toText(record.name),
    workflow_module_id:
      toText(record.workflow_module_id) ||
      toText(record.for) ||
      toText(record.approvable_type),
    description: toText(record.description),
    start_date: toText(record.start_date),
    end_date: toText(record.end_date),
    is_active: toBool(record.is_active ?? record.isActive, true),
  };
}

export function listWorkflowDefinitionsPath(
  approvalHeadId: string,
  search: string,
  page: number,
  pageSize: number,
) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('page_size', String(pageSize))
  const headId = approvalHeadId.trim()
  if (headId) params.set('workflow_approval_head_id', headId)
  const q = search.trim()
  if (q) params.set('search', q)
  return `/workflows/definitions?${params.toString()}`
}

export async function fetchWorkflowDefinitionsPage(
  approvalHeadId: string,
  search: string,
  page: number,
  pageSize: number,
) {
  const payload = await apiGet<unknown>(
    listWorkflowDefinitionsPath(approvalHeadId, search, page, pageSize),
  )
  const records = toArray(payload).map(mapWorkflowDefinitionRecord).filter((row) => row.id)
  const paged = applyPagination(payload, records, page, pageSize, {
    page,
    pageSize,
    pageLength: records.length,
  })
  const rows: WorkflowDefinitionTableRow[] = paged.rows.map((row, index) => ({
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

export async function fetchApprovableTypes(): Promise<ApprovableTypeOption[]> {
  const payload = await apiGet<unknown>('/workflows/approvable-types')
  const items: (ApiRecord | string)[] = Array.isArray(payload)
    ? payload.filter((item): item is ApiRecord | string => {
        if (typeof item === 'string') return item.trim().length > 0
        return !!item && typeof item === 'object'
      })
    : toArray(payload)

  return items
    .map((item) => mapApprovableTypeOption(item))
    .filter((item): item is ApprovableTypeOption => !!item)
}

export function createWorkflowDefinition(body: WorkflowDefinitionPayload) {
  return apiPost<unknown, WorkflowDefinitionPayload>('/workflows/definitions', body)
}

export function updateWorkflowDefinition(id: string, body: WorkflowDefinitionPayload) {
  return apiPut<unknown, WorkflowDefinitionPayload>(
    `/workflows/definitions/${encodeURIComponent(id)}`,
    body,
  )
}

export function deleteWorkflowDefinition(id: string) {
  return apiDelete<unknown>(`/workflows/definitions/${encodeURIComponent(id)}`)
}

export async function fetchWorkflowDefinitionById(id: string): Promise<WorkflowDefinitionRecord> {
  const definitionId = id.trim()
  if (!definitionId) throw new Error('Approval rule not found')

  try {
    const one = await apiGet<unknown>(`/workflows/definitions/${encodeURIComponent(definitionId)}`)
    if (one && typeof one === 'object') {
      const mapped = mapWorkflowDefinitionRecord(one as ApiRecord)
      if (mapped.id) return mapped
    }
  } catch {
    /* try list */
  }

  const { rows } = await fetchWorkflowDefinitionsPage('', '', 1, 500)
  const found = rows.find((row) => row.id === definitionId)
  if (!found) throw new Error('Approval rule not found')
  return found
}

export function toWorkflowDefinitionPayload(raw: {
  workflow_module_id: string;
  name: string;
  description: string;
  workflow_approval_head_id: string;
  is_active: boolean;
  start_date: string;
  end_date: string;
}): WorkflowDefinitionPayload {
  return {
    name: raw.name.trim(),
    workflow_module_id: raw.workflow_module_id.trim(),
    workflow_approval_head_id: raw.workflow_approval_head_id.trim(),
    description: raw.description.trim(),
    is_active: raw.is_active,
    start_date: raw.start_date.trim(),
    end_date: raw.end_date.trim(),
  };
}
