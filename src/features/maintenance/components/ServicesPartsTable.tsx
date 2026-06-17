import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type {
  MaintenanceLineItem,
  ServicePartOption,
} from '@/features/maintenance/lib/maintenance-mock-data'
import { formatNuAmount } from '@/features/maintenance/lib/maintenance-ui'
import { cn } from '@/lib/utils'

type ServicesPartsTableProps = {
  items: MaintenanceLineItem[]
  total: number
  title?: string
  editable?: boolean
  servicePartOptions?: ServicePartOption[]
  onAdd?: () => void
  onItemChange?: (itemId: string, next: MaintenanceLineItem) => void
  onDelete?: (itemId: string) => void
  isRowLocked?: (row: MaintenanceLineItem) => boolean
  className?: string
}

const selectClassName =
  'flex h-10 w-80 rounded-lg border border-[var(--fms-strokes)] bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

export function ServicesPartsTable({
  items,
  total,
  title = 'Services & Parts',
  editable = false,
  servicePartOptions = [],
  onAdd,
  onItemChange,
  onDelete,
  isRowLocked,
  className,
}: ServicesPartsTableProps) {
  const handleServicePartChange = (row: MaintenanceLineItem, servicePartId: string) => {
    const match = servicePartOptions.find((option) => option.id === servicePartId)
    onItemChange?.(row.id, {
      ...row,
      servicePartId,
      description: match?.label ?? '',
      unitPrice: match?.unitPrice ?? 0,
    })
  }

  const handleQuantityChange = (row: MaintenanceLineItem, rawValue: string) => {
    const quantity = Math.max(1, Number.parseInt(rawValue, 10) || 1)
    onItemChange?.(row.id, { ...row, quantity })
  }

  const handleNotesChange = (row: MaintenanceLineItem, notes: string) => {
    onItemChange?.(row.id, { ...row, notes })
  }

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
          <thead className="text-[var(--fms-text-header)]">
            <tr>
              <th className="w-16 bg-[#f6f6f7] px-4 py-3 text-left font-semibold">Sl.No</th>
              <th className="bg-[#f6f6f7] px-4 py-3 text-left font-semibold">Service / Part</th>
              <th className="w-28 bg-[#f6f6f7] px-4 py-3 text-left font-semibold">Qty</th>
              <th className="w-36 bg-[#f6f6f7] px-4 py-3 text-right font-semibold">
                EGP Unit Price
              </th>
              <th className="w-36 bg-[#f6f6f7] px-4 py-3 text-right font-semibold">Total</th>
              <th className="bg-[#f6f6f7] px-4 py-3 text-left font-semibold">Notes</th>
              {editable ? (
                <th className="w-20 bg-[#f6f6f7] px-4 py-3 text-center font-semibold">
                  Actions
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr className="border-t border-[var(--fms-strokes)]">
                <td
                  colSpan={editable ? 7 : 6}
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
                  {(() => {
                    const rowLocked = Boolean(isRowLocked?.(row))
                    return (
                      <>
                  <td className="px-4 py-3 align-top">{index + 1}</td>
                  <td className="px-4 py-3 align-top">
                    {editable && !rowLocked ? (
                      <select
                        value={row.servicePartId ?? ''}
                        onChange={(event) =>
                          handleServicePartChange(row, event.target.value)
                        }
                        className={selectClassName}
                      >
                        <option value="">Select service / part</option>
                        {servicePartOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      row.description
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {editable && !rowLocked ? (
                      <Input
                        type="number"
                        min={1}
                        value={row.quantity}
                        onChange={(event) =>
                          handleQuantityChange(row, event.target.value)
                        }
                        className="h-10 bg-white"
                      />
                    ) : (
                      row.quantity
                    )}
                  </td>
                  <td className="px-4 py-3 text-right align-top">
                    {row.servicePartId || !editable
                      ? formatNuAmount(row.unitPrice)
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right align-top">
                    {row.servicePartId || !editable
                      ? formatNuAmount(row.quantity * row.unitPrice)
                      : '—'}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {editable && !rowLocked ? (
                      <Input
                        value={row.notes ?? ''}
                        onChange={(event) =>
                          handleNotesChange(row, event.target.value)
                        }
                        placeholder="Add note"
                        className="h-10 bg-white"
                      />
                    ) : (
                      row.notes || '—'
                    )}
                  </td>
                  {editable && !rowLocked ? (
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center justify-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-[var(--fms-delete)] hover:text-[var(--fms-delete)]"
                          aria-label={`Delete ${row.description || 'line item'}`}
                          onClick={() => onDelete?.(row.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  ) : editable ? <td className="px-4 py-3" /> : null}
                      </>
                    )
                  })()}
                </tr>
              ))
            )}
            <tr className="border-t border-[var(--fms-strokes)] bg-[#fafafa]">
              <td
                colSpan={5}
                className="px-4 py-3 font-semibold text-[var(--fms-text-header)]"
              >
                Estimated Work order cost
              </td>
              <td className="px-4 py-3 text-right font-semibold text-[var(--fms-text-header)]">
                {formatNuAmount(total)}
              </td>
              {editable ? <td className="px-4 py-3" /> : null}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
