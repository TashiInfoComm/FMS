type GenericRecord = Record<string, unknown>

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function readTruthyNext(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number') return value > 0
  return null
}

/** Resolves pagination metadata objects sent as `pagination`, `paginationData`, or nested under `data` / `meta`. */
export function resolvePaginationObject(payload: unknown): GenericRecord | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const root = payload as GenericRecord
  const nestedData = root.data && typeof root.data === 'object' && !Array.isArray(root.data) ? (root.data as GenericRecord) : undefined
  const nestedMeta = root.meta && typeof root.meta === 'object' ? (root.meta as GenericRecord) : undefined

  const candidates: unknown[] = [
    root.pagination,
    root.paginationData,
    root.paginationdata,
    nestedData?.pagination,
    nestedData?.paginationData,
    nestedData?.paginationdata,
    nestedMeta?.pagination,
  ]

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue
    const o = candidate as GenericRecord
    const hasSignal = [
      o.page,
      o.current_page,
      o.page_size,
      o.pageSize,
      o.limit,
      o.per_page,
      o.total_items,
      o.totalItems,
      o.total,
      o.count,
      o.total_count,
      o.totalCount,
      o.total_pages,
      o.totalPages,
    ].some((v) => readNumber(v) !== null)
    if (hasSignal) return o
  }
  return undefined
}

export type ParsedApiPagination = {
  page: number
  pageSize: number
  totalItems?: number
  totalPages?: number
}

export function parseApiPagination(payload: unknown, requestPage: number, requestPageSize: number): ParsedApiPagination | null {
  const p = resolvePaginationObject(payload)
  if (!p) return null

  const pageSize =
    readNumber(p.page_size) ??
    readNumber(p.pageSize) ??
    readNumber(p.limit) ??
    readNumber(p.per_page) ??
    requestPageSize

  const page = readNumber(p.page) ?? readNumber(p.current_page) ?? requestPage

  const totalItems =
    readNumber(p.total_items) ??
    readNumber(p.totalItems) ??
    readNumber(p.total_count) ??
    readNumber(p.totalCount) ??
    readNumber(p.total) ??
    readNumber(p.count) ??
    undefined

  const totalPages = readNumber(p.total_pages) ?? readNumber(p.totalPages) ?? undefined

  return {
    page: page > 0 ? page : requestPage,
    pageSize: pageSize > 0 ? pageSize : requestPageSize,
    totalItems: totalItems ?? undefined,
    totalPages: totalPages ?? undefined,
  }
}

export type PaginationSliceResult<T> = {
  rows: T[]
  totalCount: number
  effectivePage: number
  effectivePageSize: number
  totalPages: number
  serialBase: number
}

type ExtractCountOptions = {
  page?: number
  pageSize?: number
  pageLength?: number
}

/**
 * When the API includes a pagination block, uses server page size and total count and skips client-side slicing.
 * Otherwise keeps the previous behavior: client slice + heuristic total from {@link extractTotalCount}.
 */
export function applyPagination<T>(
  payload: unknown,
  rows: T[],
  page: number,
  pageSize: number,
  extractOptions?: ExtractCountOptions,
): PaginationSliceResult<T> {
  const options: ExtractCountOptions = extractOptions ?? { page, pageSize, pageLength: rows.length }
  const parsed = parseApiPagination(payload, page, pageSize)

  if (parsed) {
    const displayRows = rows
    const totalCount = parsed.totalItems ?? extractTotalCount(payload, rows.length, options)
    const effectivePageSize = parsed.pageSize
    const effectivePage = parsed.page
    const totalPages =
      parsed.totalPages != null && parsed.totalPages > 0
        ? Math.ceil(parsed.totalPages)
        : Math.max(1, Math.ceil(totalCount / Math.max(1, effectivePageSize)))
    const serialBase = Math.max(0, (effectivePage - 1) * effectivePageSize)
    return { rows: displayRows, totalCount, effectivePage, effectivePageSize, totalPages, serialBase }
  }

  const sliced = getPageRows(rows, page, pageSize)
  const totalCount = extractTotalCount(payload, rows.length, options)
  const totalPages = Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize)))
  const serialBase = Math.max(0, (page - 1) * pageSize)
  return {
    rows: sliced,
    totalCount,
    effectivePage: page,
    effectivePageSize: pageSize,
    totalPages,
    serialBase,
  }
}

export function extractTotalCount(payload: unknown, fallback: number, options?: ExtractCountOptions): number {
  if (!payload || typeof payload !== 'object') return fallback

  const root = payload as GenericRecord
  const data = root.data && typeof root.data === 'object' && !Array.isArray(root.data) ? (root.data as GenericRecord) : undefined
  const pagination = resolvePaginationObject(payload)
  const legacyNestedPagination =
    data?.pagination && typeof data.pagination === 'object' && !Array.isArray(data.pagination) ? (data.pagination as GenericRecord) : undefined
  const meta = root.meta && typeof root.meta === 'object' ? (root.meta as GenericRecord) : undefined

  const candidates: unknown[] = [
    root.count,
    root.total,
    root.total_count,
    root.totalCount,
    root.total_records,
    root.recordsTotal,
    data?.count,
    data?.total,
    data?.total_count,
    data?.totalCount,
    data?.total_records,
    meta?.count,
    meta?.total,
    meta?.total_count,
    meta?.totalCount,
    meta?.total_records,
    pagination?.total_items,
    pagination?.totalItems,
    pagination?.count,
    pagination?.total,
    pagination?.total_count,
    pagination?.totalCount,
    pagination?.total_records,
    legacyNestedPagination?.count,
    legacyNestedPagination?.total,
    legacyNestedPagination?.total_count,
    legacyNestedPagination?.totalCount,
    legacyNestedPagination?.total_records,
    legacyNestedPagination?.total_items,
    legacyNestedPagination?.totalItems,
  ]

  for (const candidate of candidates) {
    const parsed = readNumber(candidate)
    if (parsed !== null) return parsed
  }

  const currentPage = options?.page
  const pageSize = options?.pageSize
  const pageLength = options?.pageLength ?? fallback
  if (currentPage && pageSize) {
    const totalPagesCandidates: unknown[] = [
      root.total_pages,
      root.totalPages,
      data?.total_pages,
      data?.totalPages,
      meta?.total_pages,
      meta?.totalPages,
      pagination?.total_pages,
      pagination?.totalPages,
      pagination?.pages,
      legacyNestedPagination?.total_pages,
      legacyNestedPagination?.totalPages,
      legacyNestedPagination?.pages,
      root.pages,
    ]
    for (const item of totalPagesCandidates) {
      const parsedPages = readNumber(item)
      if (parsedPages !== null && parsedPages > 0) {
        const safePages = Math.ceil(parsedPages)
        const lastPageCount = safePages === currentPage ? pageLength : pageSize
        return Math.max(fallback, (safePages - 1) * pageSize + lastPageCount)
      }
    }

    const nextCandidates: unknown[] = [
      root.next,
      root.has_next,
      root.hasNext,
      data?.next,
      data?.has_next,
      data?.hasNext,
      meta?.next,
      meta?.has_next,
      meta?.hasNext,
      pagination?.next,
      pagination?.has_next,
      pagination?.hasNext,
      legacyNestedPagination?.next,
      legacyNestedPagination?.has_next,
      legacyNestedPagination?.hasNext,
    ]
    for (const item of nextCandidates) {
      const hasNext = readTruthyNext(item)
      if (hasNext === true) return Math.max(fallback, currentPage * pageSize + 1)
      if (hasNext === false) return Math.max(fallback, (currentPage - 1) * pageSize + pageLength)
    }
  }

  return fallback
}

export function getPageRows<T>(rows: T[], page: number, pageSize: number): T[] {
  if (rows.length <= pageSize) return rows
  const start = Math.max(0, (page - 1) * pageSize)
  const end = start + pageSize
  return rows.slice(start, end)
}
