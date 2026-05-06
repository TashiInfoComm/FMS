/**
 * Org group tree for user org assignment (`GET /public/groups`; used for signup and admin create/edit flows).
 * Normalizes heterogeneous list shapes and supports resolving directory organogram hints.
 */
import { apiGet } from '@/services/apiClient'

type ApiRecord = Record<string, unknown>

function toText(value: unknown) {
  return typeof value === 'string' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

export type AdminGroupNode = {
  id: string
  name: string
  parentId: string | null
}

export type DirectoryOrganogramHints = {
  level1Id?: string
  level2Id?: string
  level3Id?: string
  level4Id?: string
  level1Name?: string
  level2Name?: string
  level3Name?: string
  level4Name?: string
  subGroupId?: string
  subGroupName?: string
  directoryAgencyId?: string
  directoryAgencyName?: string
}

export type OrgTierSelection = {
  agencyId: string
  agencyName: string
  departmentId: string
  departmentName: string
  divisionId: string
  divisionName: string
  subDivisionId: string
  subDivisionName: string
}

export type OrgTierLocks = {
  agency: boolean
  department: boolean
  division: boolean
  subDivision: boolean
}

function extractGroupsList(payload: unknown): ApiRecord[] {
  if (Array.isArray(payload)) return payload.filter((item): item is ApiRecord => !!item && typeof item === 'object')
  if (!payload || typeof payload !== 'object') return []
  const root = payload as Record<string, unknown>
  const candidates = [
    root.groups,
    root.items,
    root.results,
    root.records,
    root.data,
    (root.data as Record<string, unknown> | undefined)?.groups,
    (root.data as Record<string, unknown> | undefined)?.items,
    (root.data as Record<string, unknown> | undefined)?.results,
    (root.data as Record<string, unknown> | undefined)?.records,
  ]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is ApiRecord => !!item && typeof item === 'object')
    }
  }
  return []
}

/** Keys used by tree-shaped group APIs for child rows (agency → department → …). */
const NESTED_GROUP_CHILD_KEYS = ['subGroups', 'sub_groups', 'childGroups', 'children'] as const

function nestedGroupChildren(record: ApiRecord): ApiRecord[] {
  for (const key of NESTED_GROUP_CHILD_KEYS) {
    const v = record[key]
    if (Array.isArray(v)) {
      return v.filter((item): item is ApiRecord => !!item && typeof item === 'object')
    }
  }
  return []
}

/**
 * Turns nested `/public/groups` payloads (`data[]` with `subGroups`) into flat `AdminGroupNode[]`
 * linked by `parentId`, so CID `OrganogramLevel1`–`OrganogramLevel4` can match tier by tier.
 */
function flattenNestedGroupRecords(items: ApiRecord[], parentFallbackId: string | null): AdminGroupNode[] {
  const out: AdminGroupNode[] = []
  for (const row of items) {
    let n = mapRecordToGroupNode(row)
    if (!n) continue
    if (
      parentFallbackId != null &&
      parentFallbackId !== '' &&
      (n.parentId == null || n.parentId === '')
    ) {
      n = { ...n, parentId: parentFallbackId }
    }
    out.push(n)
    const kids = nestedGroupChildren(row)
    if (kids.length > 0) {
      out.push(...flattenNestedGroupRecords(kids, n.id))
    }
  }
  return out
}

function normalizeParentRef(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  if (!s || s === '0') return null
  return s
}

/** Maps one API row into a graph node; skips rows without id+name. */
export function mapRecordToGroupNode(item: ApiRecord): AdminGroupNode | null {
  const id =
    toText(item.id) ||
    toText(item.group_id) ||
    toText(item.uuid) ||
    (typeof item.groupId === 'number' || typeof item.groupId === 'string' ? String(item.groupId) : '')
  const name =
    toText(item.name) ||
    toText(item.group_name) ||
    toText(item.title) ||
    toText(item.label) ||
    toText(item.agency_name) ||
    toText(item.agencyName)
  if (!id?.trim() || !name?.trim()) return null

  const parentRaw =
    item.parent_id ??
    item.parentId ??
    item.parent_group_id ??
    item.parentGroupId ??
    item.parent ??
    item.agency_id ??
    item.agencyId ??
    item.department_id ??
    item.departmentId ??
    item.division_id ??
    item.divisionId

  let parentId = normalizeParentRef(parentRaw)

  const nestedParent = item.parent
  if (!parentId && nestedParent && typeof nestedParent === 'object' && !Array.isArray(nestedParent)) {
    const po = nestedParent as ApiRecord
    parentId =
      normalizeParentRef(po.id) ??
      normalizeParentRef(po.group_id)
  }

  return { id: id.trim(), name: name.trim(), parentId }
}

/** Parses any `/public/groups` or `/admin/groups` JSON body into a deduped flat node list. */
export function parseGroupsApiPayloadToNodes(payload: unknown): AdminGroupNode[] {
  const rows = extractGroupsList(payload)
  const flattened = flattenNestedGroupRecords(rows, null)
  const nodes: AdminGroupNode[] = []
  const seen = new Set<string>()
  for (const n of flattened) {
    if (seen.has(n.id)) continue
    seen.add(n.id)
    nodes.push(n)
  }
  return nodes
}

/** Loads all public groups (single page; extend with pagination if the API grows). */
export async function fetchAdminGroups(): Promise<AdminGroupNode[]> {
  const payload = await apiGet<unknown>('/public/groups')
  return parseGroupsApiPayloadToNodes(payload)
}

/** Admin organogram tree for resolving stored group ids → names (`GET /admin/groups`). */
export async function fetchAdminHierarchyGroups(): Promise<AdminGroupNode[]> {
  const payload = await apiGet<unknown>('/admin/groups')
  return parseGroupsApiPayloadToNodes(payload)
}

function nodesById(nodes: AdminGroupNode[]): Map<string, AdminGroupNode> {
  return new Map(nodes.map((n) => [n.id, n]))
}

/** Roots: no parent or parent id not present in this dataset (external root). */
export function rootGroupNodes(nodes: AdminGroupNode[]): AdminGroupNode[] {
  const ids = new Set(nodes.map((n) => n.id))
  return nodes.filter((n) => {
    const p = n.parentId
    if (p == null || p === '') return true
    return !ids.has(p)
  })
}

export function childGroupsOf(parentId: string | null, nodes: AdminGroupNode[]): AdminGroupNode[] {
  const want = parentId ?? ''
  return nodes.filter((n) => (n.parentId ?? '') === want)
}

function normalizeNameKey(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function findById(id: string | undefined, byId: Map<string, AdminGroupNode>): AdminGroupNode | undefined {
  if (!id?.trim()) return undefined
  return byId.get(id.trim())
}

function findByNameAmong(name: string | undefined, pool: AdminGroupNode[]): AdminGroupNode | undefined {
  if (!name?.trim()) return undefined
  const key = normalizeNameKey(name)
  return pool.find((n) => normalizeNameKey(n.name) === key)
}

function resolveTier(
  idHint: string | undefined,
  nameHint: string | undefined,
  pool: AdminGroupNode[],
  byId: Map<string, AdminGroupNode>,
): { node?: AdminGroupNode; hadHint: boolean } {
  const hadHint = Boolean(idHint?.trim() || nameHint?.trim())
  if (!hadHint) return { hadHint: false }
  const byIdHit = findById(idHint, byId)
  if (byIdHit && pool.some((p) => p.id === byIdHit.id)) return { node: byIdHit, hadHint: true }
  const byName = findByNameAmong(nameHint, pool)
  if (byName) return { node: byName, hadHint: true }
  return { hadHint: true }
}

/** Prefer rows under the current parent scope; if no hit, match directory ids/names against the full group list. */
function resolveTierWithGlobalIdFallback(
  idHint: string | undefined,
  nameHint: string | undefined,
  pool: AdminGroupNode[],
  allNodes: AdminGroupNode[],
  byId: Map<string, AdminGroupNode>,
): { node?: AdminGroupNode; hadHint: boolean } {
  const hadHint = Boolean(idHint?.trim() || nameHint?.trim())
  if (!hadHint) return { hadHint: false }

  const scopedPool = pool.length > 0 ? pool : allNodes
  const scoped = resolveTier(idHint, nameHint, scopedPool, byId)
  if (scoped.node) return scoped

  const globalId = findById(idHint, byId)
  if (globalId) return { node: globalId, hadHint: true }

  const byName = findByNameAmong(nameHint, allNodes)
  if (byName) return { node: byName, hadHint: true }

  return { hadHint: true }
}

export function emptyOrgSelection(): OrgTierSelection {
  return {
    agencyId: '',
    agencyName: '',
    departmentId: '',
    departmentName: '',
    divisionId: '',
    divisionName: '',
    subDivisionId: '',
    subDivisionName: '',
  }
}

export function emptyOrgLocks(): OrgTierLocks {
  return { agency: false, department: false, division: false, subDivision: false }
}

/**
 * Maps directory organogram / EMS fields into our four-tier selection using `/public/groups` nodes.
 * Locks a tier when that tier had CID hints and we resolved a matching node (by id, else name among the right parent scope).
 */
export function resolveOrgSelectionFromHints(
  hints: DirectoryOrganogramHints | undefined,
  nodes: AdminGroupNode[],
): { selection: OrgTierSelection; locks: OrgTierLocks } {
  const sel = emptyOrgSelection()
  const locks = emptyOrgLocks()
  if (!hints || nodes.length === 0) {
    return { selection: sel, locks }
  }

  const byId = nodesById(nodes)
  const roots = rootGroupNodes(nodes)

  const agencyPool = roots.length > 0 ? roots : nodes
  const a = resolveTierWithGlobalIdFallback(hints.level1Id, hints.level1Name, agencyPool, nodes, byId)
  if (a.node) {
    sel.agencyId = a.node.id
    sel.agencyName = a.node.name
  }
  locks.agency = !!(hints.level1Id?.trim() || hints.level1Name?.trim()) && !!a.node

  const deptParent = sel.agencyId || null
  const deptPool = deptParent ? childGroupsOf(deptParent, nodes) : nodes
  const d = resolveTierWithGlobalIdFallback(hints.level2Id, hints.level2Name, deptPool, nodes, byId)
  if (d.node) {
    sel.departmentId = d.node.id
    sel.departmentName = d.node.name
  }
  locks.department = !!(hints.level2Id?.trim() || hints.level2Name?.trim()) && !!d.node

  const divParent = sel.departmentId || sel.agencyId || null
  const divPool = divParent ? childGroupsOf(divParent, nodes) : nodes
  const v = resolveTierWithGlobalIdFallback(hints.level3Id, hints.level3Name, divPool, nodes, byId)
  if (v.node) {
    sel.divisionId = v.node.id
    sel.divisionName = v.node.name
  }
  locks.division = !!(hints.level3Id?.trim() || hints.level3Name?.trim()) && !!v.node

  const subParent = sel.divisionId || sel.departmentId || sel.agencyId || null
  const subPool = subParent ? childGroupsOf(subParent, nodes) : nodes

  const level4Id = hints.level4Id?.trim() && hints.level4Id.trim() !== '0' ? hints.level4Id : undefined
  const s1 = resolveTierWithGlobalIdFallback(level4Id, hints.level4Name, subPool, nodes, byId)
  let subNode = s1.node
  const subHinted =
    !!(level4Id || hints.level4Name?.trim() || hints.subGroupId?.trim() || hints.subGroupName?.trim())
  if (!subNode && (hints.subGroupId?.trim() || hints.subGroupName?.trim())) {
    const s2 = resolveTierWithGlobalIdFallback(hints.subGroupId, hints.subGroupName, subPool, nodes, byId)
    subNode = s2.node
  }

  if (subNode) {
    sel.subDivisionId = subNode.id
    sel.subDivisionName = subNode.name
  }
  locks.subDivision = subHinted && !!subNode

  return { selection: sel, locks }
}
