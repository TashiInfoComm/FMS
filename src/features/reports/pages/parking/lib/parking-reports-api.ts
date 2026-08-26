import { apiGet, apiGetBlob } from '@/services/apiClient'
import type { ParkingClaimStatus } from '@/features/parking/lib/parking-logs-api'
import {
  appendReportCommonFilterParams,
  type ReportCommonFilterParams,
} from '@/features/reports/lib/report-common-filters'
import { extractMasterList } from '@/shared/lib/organogram-master-lookup'
import { applyPagination } from '@/shared/utils/pagination'

type ApiRecord = Record<string, unknown>

export type ParkingReportRow = {
  id: string
  driver: string
  agency: string
  department: string
  division: string
  subDivision: string
  receipts: number
  claimAmount: number
  status: ParkingClaimStatus
  monthLabel: string
}

export type ParkingReportsPageResult = {
  rows: ParkingReportRow[]
  totalCount: number
  totalPages: number
  effectivePageSize: number
  serialBase: number
}

export type ParkingReportListQuery = {
  page: number
  pageSize: number
  search?: string
  status?: ParkingClaimStatus | ''
  common: ReportCommonFilterParams
}

export type ParkingReportExportFormat = 'xlsx' | 'pdf'

export type ParkingReportExportQuery = {
  format: ParkingReportExportFormat
  search?: string
  status?: ParkingClaimStatus | ''
  common: ReportCommonFilterParams
  year?: number
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function pickScalar(record: ApiRecord, keys: string[]): string {
  for (const key of keys) {
    const text = toText(record[key])
    if (text) return text
  }
  return ''
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function normalizeParkingClaimStatus(value: unknown): ParkingClaimStatus {
  const normalized = String(value ?? 'PENDING_APPROVAL')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')

  if (
    normalized === 'PENDING_APPROVAL' ||
    normalized === 'APPROVED' ||
    normalized === 'PAID' ||
    normalized === 'REJECTED'
  ) {
    return normalized
  }

  if (normalized === 'REIMBURSED') return 'PAID'
  if (normalized.includes('PENDING')) return 'PENDING_APPROVAL'
  return 'PENDING_APPROVAL'
}

function toMonthLabel(monthKey: string): string {
  const [yearText, monthText] = monthKey.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  if (!Number.isFinite(year) || !Number.isFinite(month)) return monthKey
  const date = new Date(year, month - 1, 1)
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date)
}

function toMonthKeyFromRecord(record: ApiRecord): string {
  const directMonth = pickScalar(record, ['month_key', 'monthKey'])
  if (/^\d{4}-\d{2}$/.test(directMonth)) return directMonth

  const year = pickScalar(record, ['claim_year', 'claimYear', 'year'])
  const month = pickScalar(record, ['claim_month', 'claimMonth', 'month_number', 'monthNumber'])
  if (/^\d{4}$/.test(year) && /^\d{1,2}$/.test(month)) {
    return `${year}-${month.padStart(2, '0')}`
  }

  const dateLike = pickScalar(record, ['created_at', 'createdAt'])
  if (dateLike.length >= 7) {
    const maybe = dateLike.slice(0, 7)
    if (/^\d{4}-\d{2}$/.test(maybe)) return maybe
  }

  return ''
}

function pickDriverName(record: ApiRecord): string {
  const driver = record.driver
  if (driver && typeof driver === 'object' && !Array.isArray(driver)) {
    return pickScalar(driver as ApiRecord, ['name', 'full_name', 'fullName', 'driver_name'])
  }
  return pickScalar(record, ['driver_name', 'driverName', 'driver'])
}

function nestedRecord(value: unknown): ApiRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as ApiRecord
}

function pickOrgEntityLabel(
  record: ApiRecord,
  nestedKeys: string[],
  flatNameKeys: string[],
  flatCodeKeys: string[] = [],
): string {
  for (const nestedKey of nestedKeys) {
    const nested = nestedRecord(record[nestedKey])
    if (!nested) continue

    const name = pickScalar(nested, ['name', 'display_name', 'displayName'])
    if (name) return name

    const code = pickScalar(nested, ['code', 'abbreviation', 'short_name', 'shortName'])
    if (code) return code
  }

  const flatName = pickScalar(record, flatNameKeys)
  if (flatName) return flatName

  const flatCode = pickScalar(record, flatCodeKeys)
  if (flatCode) return flatCode

  return '—'
}

function countReceipts(record: ApiRecord): number {
  const direct = toNumber(
    record.receipt_count ??
      record.receiptCount ??
      record.receipts_count ??
      record.receiptsCount ??
      record.number_of_receipts ??
      record.numberOfReceipts ??
      record.no_of_receipts ??
      record.noOfReceipts,
    -1,
  )
  if (direct >= 0) return direct

  const logArrays = [
    record.logs,
    record.parking_logs,
    record.parkingLogs,
    record.line_items,
    record.lineItems,
    record.receipts,
  ]

  for (const candidate of logArrays) {
    if (Array.isArray(candidate)) return candidate.length
  }

  return 0
}

function extractParkingReportsList(payload: unknown): ApiRecord[] {
  const records = extractMasterList(payload)
  if (records.length > 0) return records

  if (!payload || typeof payload !== 'object') return []
  const root = payload as ApiRecord
  const data = root.data
  const dataObj =
    data && typeof data === 'object' && !Array.isArray(data) ? (data as ApiRecord) : null

  const candidates = [
    root.reports,
    root.parking_reports,
    root.parkingReports,
    root.claims,
    root.parking_claims,
    root.parkingClaims,
    root.monthly_claims,
    root.monthlyClaims,
    root.items,
    dataObj?.reports,
    dataObj?.parking_reports,
    dataObj?.parkingReports,
    dataObj?.claims,
    dataObj?.parking_claims,
    dataObj?.parkingClaims,
    dataObj?.monthly_claims,
    dataObj?.monthlyClaims,
    dataObj?.items,
  ]

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue
    return candidate.filter(
      (item): item is ApiRecord => !!item && typeof item === 'object' && !Array.isArray(item),
    )
  }

  return []
}

export function mapParkingReportRecord(record: ApiRecord): ParkingReportRow | null {
  const id = pickScalar(record, [
    'id',
    'claim_id',
    'claimId',
    'monthly_claim_id',
    'monthlyClaimId',
    'report_id',
    'reportId',
  ])
  const monthKey = toMonthKeyFromRecord(record)
  if (!id && !monthKey) return null

  const claimAmount =
    toNumber(
      record.claim_amount ??
        record.claimAmount ??
        record.total_amount ??
        record.totalAmount ??
        record.amount,
    ) || 0

  return {
    id: id || monthKey,
    driver: pickDriverName(record) || '—',
    agency: pickOrgEntityLabel(
      record,
      ['agency'],
      ['agency_name', 'agencyName'],
      ['agency_code', 'agencyCode', 'agency_abbreviation', 'agencyAbbreviation', 'agency'],
    ),
    department: pickOrgEntityLabel(
      record,
      ['department'],
      ['department_name', 'departmentName'],
      ['department_code', 'departmentCode', 'department'],
    ),
    division: pickOrgEntityLabel(
      record,
      ['division'],
      ['division_name', 'divisionName'],
      ['division_code', 'divisionCode', 'division'],
    ),
    subDivision: pickOrgEntityLabel(
      record,
      ['sub_division', 'subDivision'],
      ['sub_division_name', 'subDivisionName'],
      ['sub_division_code', 'subDivisionCode', 'sub_division', 'subDivision'],
    ),
    receipts: countReceipts(record),
    claimAmount,
    status: normalizeParkingClaimStatus(record.status),
    monthLabel: monthKey ? toMonthLabel(monthKey) : '—',
  }
}

function buildParkingReportPath(query: ParkingReportListQuery): string {
  const params = new URLSearchParams()
  params.set('page', String(query.page))
  params.set('page_size', String(query.pageSize))

  const search = query.search?.trim()
  if (search) params.set('search', search)

  const status = query.status?.trim()
  if (status) params.set('status', status)

  appendReportCommonFilterParams(params, query.common)

  return `/parking/reports?${params.toString()}`
}

/** `GET /parking/reports` — monthly reimbursement claims report. */
export async function fetchParkingReportPage(
  query: ParkingReportListQuery,
): Promise<ParkingReportsPageResult> {
  const payload = await apiGet<unknown>(buildParkingReportPath(query))
  const rows = extractParkingReportsList(payload)
    .map((record) => mapParkingReportRecord(record))
    .filter((row): row is ParkingReportRow => row !== null)

  const paged = applyPagination(payload, rows, query.page, query.pageSize, {
    page: query.page,
    pageSize: query.pageSize,
    pageLength: rows.length,
  })

  return {
    rows: paged.rows,
    totalCount: paged.totalCount,
    totalPages: paged.totalPages,
    effectivePageSize: paged.effectivePageSize,
    serialBase: paged.serialBase,
  }
}

function buildParkingExportPath(query: ParkingReportExportQuery): string {
  const params = new URLSearchParams()
  params.set('format', query.format)
  params.set('year', String(query.year ?? new Date().getFullYear()))

  const search = query.search?.trim()
  if (search) params.set('search', search)

  const status = query.status?.trim()
  if (status) params.set('status', status)

  appendReportCommonFilterParams(params, query.common)

  return `/parking/reports/export?${params.toString()}`
}

function fileNameFromContentDisposition(header: string, fallback: string): string {
  if (!header) return fallback

  const utf8 = header.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim().replace(/^["']|["']$/g, ''))
    } catch {
      // Keep looking at the plain filename= form.
    }
  }

  const quoted = header.match(/filename="([^"]+)"/i)
  if (quoted?.[1]) return quoted[1]

  const plain = header.match(/filename=([^;]+)/i)
  if (plain?.[1]) return plain[1].trim().replace(/^["']|["']$/g, '')

  return fallback
}

function pickExportFileUrl(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const root = payload as ApiRecord
  const data = nestedRecord(root.data)
  const source = data ?? root
  return pickScalar(source, [
    'url',
    'download_url',
    'downloadUrl',
    'file_url',
    'fileUrl',
    'signed_url',
    'signedUrl',
  ])
}

function triggerBrowserDownload(href: string, fileName: string) {
  const link = document.createElement('a')
  link.href = href
  link.download = fileName
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

/**
 * `GET /parking/reports/export?format=xlsx|pdf`
 * Downloads the monthly claims report using the same list filters.
 */
export async function exportParkingReport(query: ParkingReportExportQuery): Promise<void> {
  const { blob, contentType, contentDisposition } = await apiGetBlob(buildParkingExportPath(query))
  const extension = query.format === 'pdf' ? 'pdf' : 'xlsx'
  const fallbackName = `parking-report.${extension}`

  if (contentType.includes('application/json')) {
    let payload: unknown
    try {
      payload = JSON.parse(await blob.text()) as unknown
    } catch {
      throw new Error('Could not export parking report.')
    }
    const fileUrl = pickExportFileUrl(payload)
    if (!fileUrl) throw new Error('Export file URL was not returned.')
    triggerBrowserDownload(fileUrl, fallbackName)
    return
  }

  const fileName = fileNameFromContentDisposition(contentDisposition, fallbackName)
  const objectUrl = URL.createObjectURL(blob)
  triggerBrowserDownload(objectUrl, fileName)
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
}

export function formatParkingReportAmount(amount: number): string {
  return `Nu ${amount.toLocaleString('en-BT', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}
