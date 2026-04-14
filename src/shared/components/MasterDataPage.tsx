import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DeleteDialog } from '@/shared/components/DeleteDialog'
import { PageHeader } from '@/shared/components/PageHeader'

type Field = {
  key: string
  label: string
  type?: 'text' | 'textarea' | 'select'
  placeholder?: string
  options?: string[]
}

type MasterDataPageProps = {
  title: string
  subtitle: string
  columns: string[]
  tableKeys: string[]
  initialRows: Array<Record<string, string | number>>
  createFields: Field[]
  hideHeader?: boolean
  headerContent?: ReactNode
}

export function MasterDataPage({
  title,
  subtitle,
  columns,
  tableKeys,
  initialRows,
  createFields,
  hideHeader = false,
  headerContent,
}: MasterDataPageProps) {
  const [rows, setRows] = useState(initialRows)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [formValues, setFormValues] = useState<Record<string, string>>({})

  const filteredRows = useMemo(() => {
    if (!query.trim()) return rows
    return rows.filter((row) =>
      tableKeys
        .map((key) => String(row[key] ?? ''))
        .join(' ')
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
  }, [query, rows, tableKeys])

  const onCreate = () => {
    if (createFields.some((field) => !String(formValues[field.key] ?? '').trim())) return

    const nextRow: Record<string, string | number> = { id: rows.length + 1 }
    createFields.forEach((field) => {
      nextRow[field.key] = formValues[field.key]
    })
    setRows((prev) => [...prev, nextRow])
    setFormValues({})
    setOpen(false)
  }

  const askDelete = (id: number) => {
    setSelectedId(id)
    setDeleteOpen(true)
  }

  const onConfirmDelete = () => {
    if (selectedId === null) return
    setRows((prev) => prev.filter((row) => Number(row.id) !== selectedId))
    setSelectedId(null)
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {headerContent ?? (hideHeader ? null : <PageHeader title={title} subtitle={subtitle} />)}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)] sm:w-auto">
              <Plus className="mr-1 h-4 w-4" />
              Add New
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="flex items-start justify-between">
                <div>
                  <DialogTitle>Add New {title}</DialogTitle>
                  <p className="mt-1 text-sm text-[var(--fms-text-subheading)]">Create a new {title.toLowerCase()} record in the system</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-[var(--fms-text-subheading)]"
                  onClick={() => setOpen(false)}
                >
                  {/* <X className="h-4 w-4" /> */}
                </Button>
              </div>
            </DialogHeader>
            <div className="space-y-3 py-1">
              {createFields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key}>
                    {field.label} <span className="text-[var(--fms-delete)]">*</span>
                  </Label>
                  {field.type === 'textarea' ? (
                    <textarea
                      id={field.key}
                      value={formValues[field.key] ?? ''}
                      onChange={(event) => setFormValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
                      placeholder={field.placeholder}
                      className="min-h-20 w-full rounded-md border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--fms-info-border)]"
                    />
                  ) : field.type === 'select' ? (
                    <select
                      id={field.key}
                      value={formValues[field.key] ?? ''}
                      onChange={(event) => setFormValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
                      className="h-10 w-full rounded-md border border-[var(--fms-strokes)] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--fms-info-border)]"
                    >
                      <option value="">{field.placeholder ?? `Select ${field.label.toLowerCase()}`}</option>
                      {(field.options ?? []).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={field.key}
                      value={formValues[field.key] ?? ''}
                      onChange={(event) => setFormValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
                      placeholder={field.placeholder}
                    />
                  )}
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={onCreate}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="space-y-4 p-0">
          <div className="flex justify-end">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--fms-text-subheading)]" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${title.toLowerCase()}...`}
                className="pl-9"
              />
            </div>
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  {columns.map((column) => (
                    <th key={column} className="px-4 py-3 text-left font-semibold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => (
                  <tr key={`row-${idx}`} className="border-t border-[var(--fms-strokes)]">
                    {tableKeys.map((key) => (
                      <td key={key} className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {String(row[key] ?? '-')}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center gap-2">
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 hover:bg-[var(--fms-info-fill)]">
                          <Pencil className="h-4 w-4 text-[var(--fms-text-header)]" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 hover:bg-[var(--fms-error-fill)]" onClick={() => askDelete(Number(row.id))}>
                          <Trash2 className="h-4 w-4 text-[var(--fms-delete)]" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {filteredRows.map((row, idx) => (
              <div key={`mobile-${idx}`} className="rounded-lg border border-[var(--fms-strokes)] bg-white p-3">
                {tableKeys.map((key) => (
                  <p key={key} className="text-sm text-[var(--fms-text-subheading)]">
                    <span className="font-medium text-[var(--fms-text-header)]">{key}:</span> {String(row[key] ?? '-')}
                  </p>
                ))}
                <div className="mt-3 inline-flex items-center gap-2">
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 hover:bg-[var(--fms-info-fill)]">
                    <Pencil className="h-4 w-4 text-[var(--fms-text-header)]" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 hover:bg-[var(--fms-error-fill)]" onClick={() => askDelete(Number(row.id))}>
                    <Trash2 className="h-4 w-4 text-[var(--fms-delete)]" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={onConfirmDelete}
      />
    </section>
  )
}
