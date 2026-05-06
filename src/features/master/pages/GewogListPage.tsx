/**
 * Gewogs for one dzongkhag: reads `dzongkhagId` from the route and optional `name` from the query
 * string (set by DzongkhagListPage) for the subtitle; shares the same list/pagination helpers as dzongkhags.
 */
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { apiGet } from '@/services/apiClient'
import { PageHeader } from '@/shared/components/PageHeader'
import { TablePagination } from '@/shared/components/TablePagination'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { applyPagination } from '@/shared/utils/pagination'

type ApiRecord = Record<string, unknown>

type GewogRow = {
  id: string
  code: string
  name: string
}

function toText(value: unknown) {
  return typeof value === 'string' ? value : ''
}

/** Normalizes id values for keys and future API calls. */
function toId(value: unknown) {
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value
  return ''
}

/** Extracts an array of records from several common API envelope shapes. */
function toArray(payload: unknown): ApiRecord[] {
  if (Array.isArray(payload)) return payload.filter((item): item is ApiRecord => !!item && typeof item === 'object')
  if (!payload || typeof payload !== 'object') return []
  const root = payload as Record<string, unknown>
  const candidates = [root.items, root.results, root.data, (root.data as Record<string, unknown> | undefined)?.items]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is ApiRecord => !!item && typeof item === 'object')
    }
  }
  return []
}

/** Table projection; some APIs use `gewog` instead of `name`. */
function mapGewogRows(records: ApiRecord[]): GewogRow[] {
  return records.map((record) => ({
    id: toId(record.id),
    code: toText(record.code),
    name: toText(record.name || record.gewog),
  }))
}

/** Nested REST path: gewogs scoped under a dzongkhag. */
function gewogListPath(dzongkhagId: string, search: string, page: number, pageSize: number) {
  const q = encodeURIComponent(search.trim())
  return `/master/dzongkhags/${encodeURIComponent(dzongkhagId)}/gewogs?page=${page}&page_size=${pageSize}&code=&search=${q}`
}

export function GewogListPage() {
  const { dzongkhagId = '' } = useParams()
  const crud = useRouteCrudPermissions('/master/dzongkhags', { subMenuNameHint: 'gewog' })
  const [searchParams] = useSearchParams()
  // Display-only label from the parent list (not returned again by the gewogs endpoint).
  const dzongkhagName = searchParams.get('name') ?? ''

  const [gewogSearch, setGewogSearch] = useState('')
  const [gewogPage, setGewogPage] = useState(1)
  const [gewogPageSize, setGewogPageSize] = useState(10)

  const gewogQuery = useQuery({
    queryKey: ['master-gewogs-by-dzongkhag', dzongkhagId, gewogSearch, gewogPage, gewogPageSize],
    enabled: dzongkhagId !== '', // Avoid calling `/gewogs` with an empty parent id.
    queryFn: async () => {
      const payload = await apiGet<unknown>(gewogListPath(dzongkhagId, gewogSearch, gewogPage, gewogPageSize))
      const records = mapGewogRows(toArray(payload))
      const paged = applyPagination(payload, records, gewogPage, gewogPageSize, {
        page: gewogPage,
        pageSize: gewogPageSize,
        pageLength: records.length,
      })
      return {
        rows: paged.rows,
        totalCount: paged.totalCount,
        totalPages: paged.totalPages,
        effectivePageSize: paged.effectivePageSize,
        serialBase: paged.serialBase,
      }
    },
  })

  const gewogRows = useMemo(() => gewogQuery.data?.rows ?? [], [gewogQuery.data?.rows])
  const gewogTotalCount = gewogQuery.data?.totalCount ?? gewogRows.length // See DzongkhagListPage for pagination fallback rationale.
  const gewogEffectivePageSize = gewogQuery.data?.effectivePageSize ?? gewogPageSize
  const gewogTotalPages = gewogQuery.data?.totalPages ?? Math.max(1, Math.ceil(gewogTotalCount / gewogEffectivePageSize))
  const gewogSerialBase = gewogQuery.data?.serialBase ?? (gewogPage - 1) * gewogPageSize

  return (
    <section className="space-y-5">
      <PageHeader
        title="Gewog List"
        subtitle={dzongkhagName ? `View gewogs for ${dzongkhagName}` : 'View gewogs for selected dzongkhag'}
      />

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="space-y-4 p-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link to="/master/dzongkhags" className="text-sm text-[var(--fms-text-subheading)] hover:text-[var(--fms-text-header)]">
              Back to Dzongkhag List
            </Link>
            <div className="w-full max-w-sm">
              <Input
                value={gewogSearch}
                onChange={(event) => {
                  setGewogSearch(event.target.value)
                  setGewogPage(1)
                }}
                placeholder="Search gewog..."
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[var(--fms-strokes)]">
            <table className="min-w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  {['Sl.No', 'Code', 'Gewog'].map((column) => (
                    <th key={column} className="px-4 py-3 text-left font-semibold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gewogQuery.isLoading ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td colSpan={3} className="px-4 py-6 text-center text-[var(--fms-text-subheading)]">
                      Loading gewogs...
                    </td>
                  </tr>
                ) : crud.isResolved && !crud.canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td colSpan={3} className="px-4 py-6 text-center text-[var(--fms-text-subheading)]">
                      You do not have permission to view this data.
                    </td>
                  </tr>
                ) : gewogRows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td colSpan={3} className="px-4 py-6 text-center text-[var(--fms-text-subheading)]">
                      No gewogs found for this dzongkhag.
                    </td>
                  </tr>
                ) : (
                  gewogRows.map((row, index) => (
                    <tr key={`gewog-${row.id || index}`} className="border-t border-[var(--fms-strokes)]">
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">{gewogSerialBase + index + 1}</td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">{row.code || '-'}</td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">{row.name || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={gewogPage}
            totalPages={gewogTotalPages}
            pageSize={gewogEffectivePageSize}
            totalCount={gewogTotalCount}
            onPageChange={(nextPage) => setGewogPage(Math.max(1, Math.min(nextPage, gewogTotalPages)))}
            onPageSizeChange={(nextPageSize) => {
              setGewogPageSize(nextPageSize)
              setGewogPage(1)
            }}
          />
        </CardContent>
      </Card>
    </section>
  )
}
