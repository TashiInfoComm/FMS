import { apiGet } from '@/services/apiClient'
import { extractMasterList } from '@/shared/lib/organogram-master-lookup'

export type ReportAgencyOption = {
  value: string
  label: string
  code: string
  searchText?: string
}

type ApiRecord = Record<string, unknown>

const PAGE_SIZE = 200

function isActiveRecord(record: ApiRecord): boolean {
  if (record.active === undefined) return true
  return record.active === true || record.active === 1 || record.active === '1'
}

function recordsToOptions(records: ApiRecord[]): ReportAgencyOption[] {
  return records
    .filter(isActiveRecord)
    .map((r): ReportAgencyOption | null => {
      const id = r.id != null && String(r.id).trim() !== '' ? String(r.id).trim() : ''
      const name = typeof r.name === 'string' ? r.name.trim() : ''
      const code = typeof r.code === 'string' ? r.code.trim() : ''
      if (!id) return null
      return {
        value: id,
        label: name || code || id,
        code: code || id,
        searchText: [name, code, id].filter(Boolean).join(' '),
      }
    })
    .filter((o): o is ReportAgencyOption => o !== null)
}

/** Active agencies for report Agency filters (`GET /master/agencies`). */
export async function fetchReportAgencyOptions(): Promise<ReportAgencyOption[]> {
  const payload = await apiGet<unknown>(
    `/master/agencies?active=true&page=1&page_size=${PAGE_SIZE}&search=`,
  )
  return recordsToOptions(extractMasterList(payload))
}
