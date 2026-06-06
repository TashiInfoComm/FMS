/**
 * Footer control: "Showing X–Y of Z", page-size select, and condensed page numbers with ellipses
 * for large page counts (`buildPageItems`).
 */
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination'

type TablePaginationProps = {
  page: number
  totalPages: number
  pageSize: number
  totalCount: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

/** Picks which page numbers to show; uses ellipses when there are more than seven pages. */
function buildPageItems(page: number, totalPages: number): Array<number | 'ellipsis-left' | 'ellipsis-right'> {
  const tp = Number.isFinite(totalPages) ? Math.floor(totalPages) : 1
  const p = Number.isFinite(page) ? Math.min(Math.max(1, Math.floor(page)), tp) : 1
  if (tp <= 0) return [1]
  if (tp <= 7) return Array.from({ length: tp }, (_, index) => index + 1)
  if (p <= 3) return [1, 2, 3, 4, 'ellipsis-right', tp]
  if (p >= tp - 2) return [1, 'ellipsis-left', tp - 3, tp - 2, tp - 1, tp]
  return [1, 'ellipsis-left', p - 1, p, p + 1, 'ellipsis-right', tp]
}

export function TablePagination({ page, totalPages, pageSize, totalCount, onPageChange, onPageSizeChange }: TablePaginationProps) {
  const safeTotalPages = Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 0
  const safePage = Number.isFinite(page) && page > 0 ? page : 1
  if (safeTotalPages <= 0) return null

  // Inclusive range of rows on this page for the summary label.
  const start = totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1
  const end = Math.min(safePage * pageSize, totalCount)
  const pageItems = buildPageItems(safePage, safeTotalPages)

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--fms-strokes)] pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-[var(--fms-text-subheading)]">
        Showing {start}-{end} of {totalCount}
      </p>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-[var(--fms-text-subheading)]">
          Page size
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-9 rounded-md border border-[var(--fms-strokes)] bg-white px-2 text-sm"
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <Pagination className="mx-0 w-auto justify-start">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious onClick={() => onPageChange(safePage - 1)} disabled={safePage <= 1} />
            </PaginationItem>
            {pageItems.map((item) =>
              typeof item === 'number' ? (
                <PaginationItem key={item}>
                  <PaginationLink isActive={item === safePage} onClick={() => onPageChange(item)}>
                    {item}
                  </PaginationLink>
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <PaginationEllipsis />
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <PaginationNext onClick={() => onPageChange(safePage + 1)} disabled={safePage >= safeTotalPages} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  )
}
