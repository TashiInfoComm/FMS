import { Eye } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DriverOffenceDetailDialog } from '@/features/driver-offence/components/DriverOffenceDetailDialog'
import { DriverOffenceStatusCell } from '@/features/driver-offence/components/DriverOffenceStatusCell'
import {
  MOCK_DRIVER_OFFENCES,
  filterMockDriverOffences,
  getMockDriverOffenceDetail,
  paginateMockRows,
} from '@/features/driver-offence/lib/driver-offence-mock-data'
import type { DriverOffenceListRow } from '@/features/driver-offence/lib/driver-offence-types'
import {
  formatOffenceAmount,
  formatOffenceListDate,
} from '@/features/driver-offence/lib/driver-offence-ui'
import { FuelTableListToolbar } from '@/features/fuel/components/FuelTableListToolbar'
import {
  ListPanelMessage,
  MobileListCard,
  MobileListField,
} from '@/shared/components/MobileListCard'
import { TablePagination } from '@/shared/components/TablePagination'

function DriverOffence() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filteredRows = useMemo(
    () => filterMockDriverOffences(MOCK_DRIVER_OFFENCES, search),
    [search],
  )

  const paged = useMemo(
    () => paginateMockRows(filteredRows, page, pageSize),
    [filteredRows, page, pageSize],
  )

  const selectedDetail = useMemo(
    () => (selectedId ? getMockDriverOffenceDetail(selectedId) : null),
    [selectedId],
  )

  useEffect(() => {
    setPage(1)
  }, [search, pageSize])

  useEffect(() => {
    if (page > paged.totalPages) setPage(paged.totalPages)
  }, [page, paged.totalPages])

  const openDetail = (row: DriverOffenceListRow) => {
    setSelectedId(row.id)
  }

  const closeDetail = () => {
    setSelectedId(null)
  }

  return (
    <section className="space-y-5">
      <Card className="min-w-0 overflow-visible rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="min-w-0 space-y-4 p-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-xl font-semibold text-[var(--fms-text-header)] sm:text-2xl">
              My Offences
            </h1>
          </div>

          <FuelTableListToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search"
            searchAriaLabel="Search offences"
          />

          <div className="hidden w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
            <table className="w-max min-w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Offense</th>
                  <th className="px-4 py-3 text-left font-semibold">Amount</th>
                  <th className="px-4 py-3 text-center font-semibold">Status</th>
                  <th className="px-4 py-3 text-center font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {paged.rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      {search.trim() ? 'No offences match your search.' : 'No offences found.'}
                    </td>
                  </tr>
                ) : (
                  paged.rows.map((row) => (
                    <tr key={row.id} className="border-t border-[var(--fms-strokes)] hover:bg-[#fafafa]">
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">
                        {formatOffenceListDate(row.offenceDate)}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">{row.offence}</td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">
                        {formatOffenceAmount(row.amount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <DriverOffenceStatusCell status={row.status} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 border-[var(--fms-strokes)] text-[var(--fms-text-header)]"
                          onClick={() => openDetail(row)}
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {paged.rows.length === 0 ? (
              <ListPanelMessage>
                {search.trim() ? 'No offences match your search.' : 'No offences found.'}
              </ListPanelMessage>
            ) : (
              paged.rows.map((row) => (
                <MobileListCard key={row.id}>
                  <MobileListField label="Date">
                    {formatOffenceListDate(row.offenceDate)}
                  </MobileListField>
                  <MobileListField label="Offense">{row.offence}</MobileListField>
                  <MobileListField label="Amount">{formatOffenceAmount(row.amount)}</MobileListField>
                  <MobileListField label="Status">
                    <DriverOffenceStatusCell status={row.status} />
                  </MobileListField>
                  <div className="mt-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5"
                      onClick={() => openDetail(row)}
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden />
                      View
                    </Button>
                  </div>
                </MobileListCard>
              ))
            )}
          </div>

          {paged.rows.length > 0 ? (
            <TablePagination
              page={paged.page}
              totalPages={paged.totalPages}
              pageSize={paged.effectivePageSize}
              totalCount={paged.totalCount}
              onPageChange={setPage}
              onPageSizeChange={(next) => {
                setPageSize(next)
                setPage(1)
              }}
            />
          ) : null}
        </CardContent>
      </Card>

      <DriverOffenceDetailDialog
        detail={selectedDetail}
        open={selectedId !== null}
        onOpenChange={(open) => !open && closeDetail()}
      />
    </section>
  )
}

export default DriverOffence
