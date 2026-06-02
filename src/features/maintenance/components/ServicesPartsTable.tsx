import { Pencil, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { MaintenanceLineItem } from '@/features/maintenance/lib/maintenance-mock-data'
import { formatNuAmount } from '@/features/maintenance/lib/maintenance-ui'
import { cn } from '@/lib/utils'

type ServicesPartsTableProps = {
  items: MaintenanceLineItem[]
  total: number
  title?: string
  editable?: boolean
  onAdd?: () => void
  onEdit?: (item: MaintenanceLineItem) => void
  onDelete?: (itemId: string) => void
  className?: string
}

export function ServicesPartsTable({
  items,
  total,
  title = 'Services & Parts',
  editable = false,
  onAdd,
  onEdit,
  onDelete,
  className,
}: ServicesPartsTableProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold text-[var(--fms-text-header)]">
          {title}
        </h3>
        {editable && onAdd ? (
          <Button type="button" size="sm" onClick={onAdd}>
            <Plus className="mr-1 h-4 w-4" />
            Add New
          </Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--fms-strokes)]">
        <table className="w-full text-sm">
          <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
            <tr>
              <th className="w-16 px-4 py-3 text-left font-semibold">Sl.No</th>
              <th className="px-4 py-3 text-left font-semibold">Description</th>
              <th className="w-20 px-4 py-3 text-left font-semibold">Qty</th>
              <th className="w-36 px-4 py-3 text-right font-semibold">
                EGP Unit Price
              </th>
              {editable ? (
                <th className="w-24 px-4 py-3 text-center font-semibold">
                  Actions
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr className="border-t border-[var(--fms-strokes)]">
                <td
                  colSpan={editable ? 5 : 4}
                  className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                >
                  No line items added.
                </td>
              </tr>
            ) : (
              items.map((row, index) => (
                <tr
                  key={row.id}
                  className="border-t border-[var(--fms-strokes)]"
                >
                  <td className="px-4 py-3">{index + 1}</td>
                  <td className="px-4 py-3">{row.description}</td>
                  <td className="px-4 py-3">{row.quantity}</td>
                  <td className="px-4 py-3 text-right">
                    {formatNuAmount(row.unitPrice)}
                  </td>
                  {editable ? (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${row.description}`}
                          onClick={() => onEdit?.(row)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-[var(--fms-delete)] hover:text-[var(--fms-delete)]"
                          aria-label={`Delete ${row.description}`}
                          onClick={() => onDelete?.(row.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
            <tr className="border-t border-[var(--fms-strokes)] bg-[#fafafa]">
              <td
                colSpan={editable ? 3 : 3}
                className="px-4 py-3 font-semibold text-[var(--fms-text-header)]"
              >
                Estimated Work order cost
              </td>
              <td
                colSpan={editable ? 2 : 1}
                className="px-4 py-3 text-right font-semibold text-[var(--fms-text-header)]"
              >
                {formatNuAmount(total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
