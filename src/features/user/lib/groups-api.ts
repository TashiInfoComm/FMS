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
  /** Master organogram code used for nested `/master/.../{code}/...` lookups. */
  code?: string
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

/**
 * Top-level agency rows from `GET /admin/groups`.
 * Shape: parent array = agencies → `children` = departments → `children` = divisions → `children` = sub-divisions.
 */
export function extractAdminGroupAgencies(payload: unknown): ApiRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is ApiRecord => !!item && typeof item === 'object')
  }
  if (!payload || typeof payload !== 'object') return []
  const root = payload as Record<string, unknown>
  const dataObj =
    root.data && typeof root.data === 'object' && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : null
  const candidates = [
    root.agencies,
    dataObj?.agencies,
    root.children,
    dataObj?.children,
    root.data,
    dataObj?.data,
    root.groups,
    dataObj?.groups,
    root.items,
    root.results,
    root.records,
    root.content,
    dataObj?.items,
    dataObj?.results,
    dataObj?.records,
    dataObj?.content,
  ]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is ApiRecord => !!item && typeof item === 'object')
    }
  }
  return []
}

/** @deprecated Prefer `extractAdminGroupAgencies` for `/admin/groups`. */
function extractGroupsList(payload: unknown): ApiRecord[] {
  return extractAdminGroupAgencies(payload)
}

/** Merges id → name from nested group trees and flat node lists (`/public/groups`, `/admin/groups`). */
export function mergeGroupsPayloadIntoLookup(
  lookup: Map<string, string>,
  payload: unknown,
): void {
  for (const [id, name] of groupsPayloadToIdNameLookup(payload)) {
    if (name) lookup.set(id, name)
  }
  for (const node of parseGroupsApiPayloadToNodes(payload)) {
    lookup.set(node.id.toLowerCase(), node.name)
  }
  indexAllGroupRecordsInPayload(payload, lookup)
}

/** Builds a complete id → name map from `/admin/groups` and `/public/groups`. */
export async function fetchGroupsIdNameLookup(): Promise<Map<string, string>> {
  const lookup = new Map<string, string>()
  const [adminPayload, publicPayload] = await Promise.all([
    apiGet<unknown>('/admin/groups'),
    apiGet<unknown>('/public/groups').catch(() => null),
  ])
  mergeGroupsPayloadIntoLookup(lookup, adminPayload)
  if (publicPayload != null) mergeGroupsPayloadIntoLookup(lookup, publicPayload)
  for (const node of parseGroupsApiPayloadToNodes(adminPayload)) {
    lookup.set(node.id.toLowerCase(), node.name)
  }
  if (publicPayload != null) {
    for (const node of parseGroupsApiPayloadToNodes(publicPayload)) {
      lookup.set(node.id.toLowerCase(), node.name)
    }
  }
  return lookup
}

/**
 * Child array keys on `/admin/groups` (each tier usually nests the next under `children`;
 * some payloads also use tier-named keys).
 */
const NESTED_GROUP_CHILD_KEYS = [
  'children',
  'departments',
  'divisions',
  'sub_divisions',
  'subDivisions',
  'sub_division',
  'subdivision',
  'subGroups',
  'sub_groups',
  'childGroups',
] as const

function readGroupNodeId(record: ApiRecord): string {
  return (
    toText(record.id) ||
    toText(record.group_id) ||
    toText(record.groupId) ||
    toText(record.uuid) ||
    toText(record.entity_id) ||
    toText(record.entityId) ||
    toText(record.key)
  ).trim()
}

function readGroupNodeName(record: ApiRecord): string {
  return (
    toText(record.name) ||
    toText(record.group_name) ||
    toText(record.groupName) ||
    toText(record.title) ||
    toText(record.label) ||
    toText(record.text) ||
    toText(record.display_name) ||
    toText(record.displayName) ||
    toText(record.agency_name) ||
    toText(record.agencyName) ||
    toText(record.department_name) ||
    toText(record.division_name) ||
    toText(record.sub_division_name) ||
    toText(record.subDivisionName)
  ).trim()
}

/** Every id-like field on a group row (user `agency_id` may match `entity_id`, not primary `id`). */
const GROUP_RECORD_ID_KEYS = [
  'id',
  'group_id',
  'groupId',
  'uuid',
  'entity_id',
  'entityId',
  'key',
  'agency_id',
  'agencyId',
  'department_id',
  'departmentId',
  'division_id',
  'divisionId',
  'sub_division_id',
  'subDivisionId',
] as const

function readGroupRecordIdAliases(record: ApiRecord): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const key of GROUP_RECORD_ID_KEYS) {
    const id = toText(record[key]).trim()
    if (!id) continue
    const lower = id.toLowerCase()
    if (seen.has(lower)) continue
    seen.add(lower)
    out.push(id)
  }
  return out
}

/** Index all id aliases on a group row to the same display name. */
export function indexGroupRecordIdAliases(
  lookup: Map<string, string>,
  record: ApiRecord,
  name: string,
): void {
  const label = name.trim()
  if (!label) return
  for (const id of readGroupRecordIdAliases(record)) {
    lookup.set(id.toLowerCase(), label)
  }
}

/** True when any id-like field on the row matches `groupId` (case-insensitive). */
export function groupRecordMatchesId(record: ApiRecord, groupId: string): boolean {
  const want = groupId.trim().toLowerCase()
  if (!want) return false
  return readGroupRecordIdAliases(record).some((id) => id.toLowerCase() === want)
}

/** Deep-walk entire JSON (including `data` envelopes) to index every id + name pair. */
function indexAllGroupRecordsInPayload(payload: unknown, lookup: Map<string, string>): void {
  const seen = new WeakSet<object>()

  const walk = (nodes: unknown): void => {
    if (nodes == null) return
    if (typeof nodes === 'object') {
      if (seen.has(nodes as object)) return
      seen.add(nodes as object)
    }
    if (Array.isArray(nodes)) {
      for (const item of nodes) walk(item)
      return
    }
    if (typeof nodes !== 'object') return

    const record = nodes as ApiRecord
    const name = readGroupNodeName(record)
    if (name) indexGroupRecordIdAliases(lookup, record, name)

    for (const value of Object.values(record)) {
      walk(value)
    }
  }

  walk(payload)
}

/** Collects nested rows from all known child keys (deduped by id). */
function collectGroupChildRows(record: ApiRecord): ApiRecord[] {
  const out: ApiRecord[] = []
  const seen = new Set<string>()
  for (const key of NESTED_GROUP_CHILD_KEYS) {
    const v = record[key]
    if (!Array.isArray(v)) continue
    for (const item of v) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      const row = item as ApiRecord
      const id = readGroupNodeId(row).toLowerCase()
      if (id && seen.has(id)) continue
      if (id) seen.add(id)
      out.push(row)
    }
  }
  return out
}

function nestedGroupChildren(record: ApiRecord): ApiRecord[] {
  return collectGroupChildRows(record)
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
  const id = readGroupNodeId(item)
  const name = readGroupNodeName(item)
  if (!id || !name) return null

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

/**
 * Recursively walks nested `children` (and aliases) on `/admin/groups` payloads through every
 * organogram tier (agency → department → division → sub-division) and indexes id → name.
 */
function indexGroupNode(lookup: Map<string, string>, record: ApiRecord): void {
  const name = readGroupNodeName(record)
  if (name) indexGroupRecordIdAliases(lookup, record, name)
}

/** Walks agency → department → division → sub-division via nested `children` (and aliases). */
function indexAdminGroupsTree(rows: ApiRecord[], lookup: Map<string, string>): void {
  for (const row of rows) {
    indexGroupNode(lookup, row)
    const children = collectGroupChildRows(row)
    if (children.length > 0) indexAdminGroupsTree(children, lookup)
  }
}

/**
 * Indexes every organogram tier from `GET /admin/groups`:
 * parent array = agencies → `children` = departments → `children` = divisions → `children` = sub-divisions.
 */
export function groupsPayloadToIdNameLookup(payload: unknown): Map<string, string> {
  const lookup = new Map<string, string>()
  const agencies = extractAdminGroupAgencies(payload)
  indexAdminGroupsTree(agencies, lookup)
  indexAllGroupRecordsInPayload(payload, lookup)
  return lookup
}

/** Resolves a group id to its `name` anywhere in a groups API tree payload. */
export function findGroupNameInPayload(payload: unknown, groupId: string): string | null {
  const id = groupId.trim().toLowerCase()
  if (!id) return null

  let found: string | null = null
  const seen = new WeakSet<object>()

  const walk = (nodes: unknown): void => {
    if (found || nodes == null) return
    if (typeof nodes === 'object') {
      if (seen.has(nodes as object)) return
      seen.add(nodes as object)
    }
    if (Array.isArray(nodes)) {
      for (const item of nodes) walk(item)
      return
    }
    if (typeof nodes !== 'object') return

    const record = nodes as ApiRecord
    if (groupRecordMatchesId(record, id)) {
      const nodeName = readGroupNodeName(record)
      if (nodeName) {
        found = nodeName
        return
      }
    }

    for (const value of Object.values(record)) {
      walk(value)
    }
  }

  walk(payload)
  return found
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

/** Resolve one tier from CID id/name hints against a loaded master-data option pool. */
export function resolveOrgTierFromPool(
  idHint: string | undefined,
  nameHint: string | undefined,
  pool: AdminGroupNode[],
): { node?: AdminGroupNode; hadHint: boolean } {
  const hadHint = Boolean(idHint?.trim() || nameHint?.trim())
  if (!hadHint || pool.length === 0) return { hadHint }
  const byId = nodesById(pool)
  return resolveTierWithGlobalIdFallback(idHint, nameHint, pool, pool, byId)
}

export type AdminOrgTierPools = {
  agencies?: AdminGroupNode[]
  departments?: AdminGroupNode[]
  divisions?: AdminGroupNode[]
  subDivisions?: AdminGroupNode[]
}

function orgTierSelectionEqual(a: OrgTierSelection, b: OrgTierSelection): boolean {
  return (
    a.agencyId === b.agencyId &&
    a.departmentId === b.departmentId &&
    a.divisionId === b.divisionId &&
    a.subDivisionId === b.subDivisionId
  )
}

/**
 * Maps CID organogram hints onto admin master-data tiers as each cascading list loads.
 * Does not override a tier when the user already picked a different option for that tier.
 */
export function applyCidHintsToAdminOrgSelection(
  hints: DirectoryOrganogramHints,
  pools: AdminOrgTierPools,
  current: OrgTierSelection = emptyOrgSelection(),
): { selection: OrgTierSelection; locks: OrgTierLocks } {
  const sel = { ...current }
  const locks = emptyOrgLocks()

  if (pools.agencies?.length) {
    const a = resolveOrgTierFromPool(hints.level1Id, hints.level1Name, pools.agencies)
    if (a.node && (!current.agencyId || current.agencyId === a.node.id)) {
      if (sel.agencyId !== a.node.id) {
        sel.agencyId = a.node.id
        sel.agencyName = a.node.name
        sel.departmentId = ''
        sel.departmentName = ''
        sel.divisionId = ''
        sel.divisionName = ''
        sel.subDivisionId = ''
        sel.subDivisionName = ''
      }
    }
    locks.agency = a.hadHint && !!a.node
  }

  if (sel.agencyId && pools.departments?.length) {
    const d = resolveOrgTierFromPool(hints.level2Id, hints.level2Name, pools.departments)
    if (d.node && (!current.departmentId || current.departmentId === d.node.id)) {
      if (sel.departmentId !== d.node.id) {
        sel.departmentId = d.node.id
        sel.departmentName = d.node.name
        sel.divisionId = ''
        sel.divisionName = ''
        sel.subDivisionId = ''
        sel.subDivisionName = ''
      }
    }
    locks.department = d.hadHint && !!d.node
  }

  if (sel.departmentId && pools.divisions?.length) {
    const v = resolveOrgTierFromPool(hints.level3Id, hints.level3Name, pools.divisions)
    if (v.node && (!current.divisionId || current.divisionId === v.node.id)) {
      if (sel.divisionId !== v.node.id) {
        sel.divisionId = v.node.id
        sel.divisionName = v.node.name
        sel.subDivisionId = ''
        sel.subDivisionName = ''
      }
    }
    locks.division = v.hadHint && !!v.node
  }

  if (sel.divisionId && pools.subDivisions?.length) {
    const level4Id =
      hints.level4Id?.trim() && hints.level4Id.trim() !== '0' ? hints.level4Id : undefined
    let sub = resolveOrgTierFromPool(level4Id, hints.level4Name, pools.subDivisions)
    const subHinted = Boolean(
      level4Id ||
        hints.level4Name?.trim() ||
        hints.subGroupId?.trim() ||
        hints.subGroupName?.trim(),
    )
    if (!sub.node && (hints.subGroupId?.trim() || hints.subGroupName?.trim())) {
      sub = resolveOrgTierFromPool(hints.subGroupId, hints.subGroupName, pools.subDivisions)
    }
    if (sub.node && (!current.subDivisionId || current.subDivisionId === sub.node.id)) {
      sel.subDivisionId = sub.node.id
      sel.subDivisionName = sub.node.name
    }
    locks.subDivision = subHinted && !!sub.node
  }

  return { selection: sel, locks }
}

export { orgTierSelectionEqual }
