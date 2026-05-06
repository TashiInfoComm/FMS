/**
 * Dzongkhag directory: loads paginated dzongkhags from the API, supports client/server-aware
 * pagination via `applyPagination`, and navigates to gewogs scoped by dzongkhag id.
 */
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { apiGet } from '@/services/apiClient'
import { PageHeader } from '@/shared/components/PageHeader'
import { DetailRowActionButton, rowActionsContainerClassName } from '@/shared/components/TableRowActionButtons'
import { TablePagination } from '@/shared/components/TablePagination'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { applyPagination } from '@/shared/utils/pagination'

type ApiRecord = Record<string, unknown>

type DzongkhagRow = {
  id: string
  code: string
  name: string
}

/** Coerces unknown API fields to displayable strings. */
function toText(value: unknown) {
  return typeof value === 'string' ? value : ''
}

/**
 * Normalizes list responses whether the backend returns a bare array or wraps rows in
 * `items`, `results`, or nested `data`.
 */
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

/** Stringifies numeric or string ids for routing and React keys. */
function toId(value: unknown) {
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value
  return ''
}

/** Maps raw records to table rows; accepts alternate field names from the API (`dzongkhag`). */
function mapDzongkhagRows(records: ApiRecord[]): DzongkhagRow[] {
  return records.map((record) => ({
    id: toId(record.id),
    code: toText(record.code),
    name: toText(record.name || record.dzongkhag),
  }))
}

/** Builds the list endpoint query string (server search + pagination). */
function dzongkhagListPath(search: string, page: number, pageSize: number) {
  const q = encodeURIComponent(search.trim())
  return `/master/dzongkhags?active=true&page=${page}&page_size=${pageSize}&code=&search=${q}`
}

export function DzongkhagListPage() {
  const navigate = useNavigate()
  const crud = useRouteCrudPermissions('/master/dzongkhags', { subMenuNameHint: 'dzongkhag' })
  const [dzongkhagSearch, setDzongkhagSearch] = useState('')
  const [dzongkhagPage, setDzongkhagPage] = useState(1)
  const [dzongkhagPageSize, setDzongkhagPageSize] = useState(10)

  // Refetch whenever search or pagination changes; `applyPagination` merges API totals with the current page slice.
  const dzongkhagQuery = useQuery({
    queryKey: ['master-dzongkhags', dzongkhagSearch, dzongkhagPage, dzongkhagPageSize],
    queryFn: async () => {
      const payload = await apiGet<unknown>(dzongkhagListPath(dzongkhagSearch, dzongkhagPage, dzongkhagPageSize))
      const records = mapDzongkhagRows(toArray(payload))
      const paged = applyPagination(payload, records, dzongkhagPage, dzongkhagPageSize, {
        page: dzongkhagPage,
        pageSize: dzongkhagPageSize,
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

  const dzongkhagRows = useMemo(() => dzongkhagQuery.data?.rows ?? [], [dzongkhagQuery.data?.rows])
  // Fallbacks keep the footer stable before the first successful fetch or if the payload omits meta fields.
  const dzongkhagTotalCount = dzongkhagQuery.data?.totalCount ?? dzongkhagRows.length
  const dzongkhagEffectivePageSize = dzongkhagQuery.data?.effectivePageSize ?? dzongkhagPageSize
  const dzongkhagTotalPages =
    dzongkhagQuery.data?.totalPages ?? Math.max(1, Math.ceil(dzongkhagTotalCount / dzongkhagEffectivePageSize))
  const dzongkhagSerialBase = dzongkhagQuery.data?.serialBase ?? (dzongkhagPage - 1) * dzongkhagPageSize
  // Passes dzongkhag id in the path and display name in the query string for the gewog page header.
  const goToGewogList = (row: DzongkhagRow) => {
    if (!crud.canRead) return
    navigate(`/master/dzongkhag-gewog/${encodeURIComponent(row.id)}/gewogs?name=${encodeURIComponent(row.name)}`)
  }

  return (
    <section className="space-y-5">
      <PageHeader
        title="Dzongkhag List"
        subtitle="Select a dzongkhag to view gewogs on a separate page"
      />

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="space-y-4 p-0">
          <div className="flex justify-end">
            <div className="w-full max-w-sm">
              <Input
                value={dzongkhagSearch}
                onChange={(event) => {
                  setDzongkhagSearch(event.target.value);
                  setDzongkhagPage(1); // New filter: always restart from the first page.
                }}
                placeholder="Search dzongkhag..."
              />
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-[var(--fms-strokes)]">
            <table className="min-w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  {["Sl.No", "Code", "Dzongkhag"].map((column) => (
                    <th
                      key={column}
                      className="px-4 py-3 text-left font-semibold"
                    >
                      {column}
                    </th>
                  ))}
                  <th
                    key={"column"}
                    className="px-4 py-3  text-center font-semibold"
                  >
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {dzongkhagQuery.isLoading ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      Loading dzongkhags...
                    </td>
                  </tr>
                ) : crud.isResolved && !crud.canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      You do not have permission to view this data.
                    </td>
                  </tr>
                ) : dzongkhagRows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      No dzongkhags found.
                    </td>
                  </tr>
                ) : (
                  dzongkhagRows.map((row, index) => {
                    return (
                      <tr
                        key={`dzongkhag-${row.id || index}`}
                        className="border-t border-[var(--fms-strokes)]"
                      >
                        <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                          {dzongkhagSerialBase + index + 1}
                        </td>
                        <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                          {row.code || "-"}
                        </td>
                        <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                          {row.name || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <div className={rowActionsContainerClassName}>
                            <DetailRowActionButton
                              name="View Gewogs"
                              type="button"
                              disabled={!crud.canRead}
                              onClick={() => goToGewogList(row)}
                              aria-label={`View gewogs for ${row.name || "selected dzongkhag"}`}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={dzongkhagPage}
            totalPages={dzongkhagTotalPages}
            pageSize={dzongkhagEffectivePageSize}
            totalCount={dzongkhagTotalCount}
            onPageChange={(nextPage) =>
              setDzongkhagPage(
                Math.max(1, Math.min(nextPage, dzongkhagTotalPages)),
              )
            }
            onPageSizeChange={(nextPageSize) => {
              setDzongkhagPageSize(nextPageSize);
              setDzongkhagPage(1);
            }}
          />
        </CardContent>
      </Card>
    </section>
  );
}
