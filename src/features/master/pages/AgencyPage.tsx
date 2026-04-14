import { useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DeleteDialog } from '@/shared/components/DeleteDialog'
import { PageHeader } from '@/shared/components/PageHeader'

const tabs = ['Agency', 'Department', 'Division', 'Sub-Division'] as const
type AgencyTab = (typeof tabs)[number]
type TableRow = Record<string, string | number>
type TableConfig = {
  title: string
  subtitle: string
  columns: string[]
  rows: TableRow[]
  formFields: Array<{ key: string; label: string; type: 'text' | 'textarea' | 'select'; placeholder?: string; options?: string[] }>
}

const tabConfig: Record<AgencyTab, TableConfig> = {
  Agency: {
    title: 'Agency',
    subtitle: 'Manage agency records and configurations',
    columns: ['Sl.No', 'Agency Name', 'Short Name', 'Description', 'Actions'],
    rows: [
      { id: 1, agencyName: 'Ministry of Health', shortName: 'MoH', description: 'Oversees health services' },
      { id: 2, agencyName: 'Ministry of Education', shortName: 'MoE', description: 'Oversees education system' },
      { id: 3, agencyName: 'Ministry of Finance', shortName: 'MoF', description: 'Manages national finances' },
    ],
    formFields: [
      { key: 'agencyName', label: 'Agency Name', type: 'text', placeholder: 'Enter agency name' },
      { key: 'shortName', label: 'Short Name', type: 'text', placeholder: 'Enter short name' },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Enter description for this agency' },
    ],
  },
  Department: {
    title: 'Department',
    subtitle: 'Manage department records and configurations',
    columns: ['Sl.No', 'Department Name', 'Agency', 'Description', 'Actions'],
    rows: [
      { id: 1, departmentName: 'Department of Public Health', agency: 'Ministry of Health', description: 'Public health initiatives' },
      { id: 2, departmentName: 'Department of School Education', agency: 'Ministry of Education', description: 'School management' },
      { id: 3, departmentName: 'Department of Revenue', agency: 'Ministry of Finance', description: 'Tax and revenue collection' },
    ],
    formFields: [
      { key: 'departmentName', label: 'Department Name', type: 'text', placeholder: 'Enter department name' },
      {
        key: 'agency',
        label: 'Agency',
        type: 'select',
        options: ['Ministry of Health', 'Ministry of Education', 'Ministry of Finance'],
      },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Enter description for this department' },
    ],
  },
  Division: {
    title: 'Division',
    subtitle: 'Manage division records and configurations',
    columns: ['Sl.No', 'Division', 'Department', 'Agency', 'Description', 'Actions'],
    rows: [
      { id: 1, division: 'Accounts Division', department: 'Department of Public Health', agency: 'Ministry of Health', description: 'Public health initiatives' },
      { id: 2, division: 'Treasury Management Division', department: 'Department of School Education', agency: 'Ministry of Education', description: 'School management' },
      { id: 3, division: 'Cluster Finance Service', department: 'Department of Revenue', agency: 'Ministry of Finance', description: 'Tax and revenue collection' },
    ],
    formFields: [
      { key: 'division', label: 'Division Name', type: 'text', placeholder: 'Enter division name' },
      {
        key: 'department',
        label: 'Department',
        type: 'select',
        options: ['Department of Public Health', 'Department of School Education', 'Department of Revenue'],
      },
      {
        key: 'agency',
        label: 'Agency',
        type: 'select',
        options: ['Ministry of Health', 'Ministry of Education', 'Ministry of Finance'],
      },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Enter description for this division' },
    ],
  },
  'Sub-Division': {
    title: 'Sub-Division',
    subtitle: 'Manage sub-division records and configurations',
    columns: ['Sl.No', 'Sub-Division', 'Division', 'Department', 'Agency', 'Description', 'Actions'],
    rows: [
      { id: 1, subDivision: 'Accounts Division', division: 'Accounts Division', department: 'Department of Public Health', agency: 'Ministry of Health', description: 'Public health initiatives' },
      { id: 2, subDivision: 'Treasury Management Division', division: 'Treasury Management Division', department: 'Department of School Education', agency: 'Ministry of Education', description: 'School management' },
      { id: 3, subDivision: 'Cluster Finance Service', division: 'Cluster Finance Service', department: 'Department of Revenue', agency: 'Ministry of Finance', description: 'Tax and revenue collection' },
    ],
    formFields: [
      { key: 'subDivision', label: 'Sub-Division Name', type: 'text', placeholder: 'Enter sub-division name' },
      {
        key: 'division',
        label: 'Division',
        type: 'select',
        options: ['Accounts Division', 'Treasury Management Division', 'Cluster Finance Service'],
      },
      {
        key: 'department',
        label: 'Department',
        type: 'select',
        options: ['Department of Public Health', 'Department of School Education', 'Department of Revenue'],
      },
      {
        key: 'agency',
        label: 'Agency',
        type: 'select',
        options: ['Ministry of Health', 'Ministry of Education', 'Ministry of Finance'],
      },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Enter description for this sub-division' },
    ],
  },
}

const tableKeysByTab: Record<AgencyTab, string[]> = {
  Agency: ['id', 'agencyName', 'shortName', 'description'],
  Department: ['id', 'departmentName', 'agency', 'description'],
  Division: ['id', 'division', 'department', 'agency', 'description'],
  'Sub-Division': ['id', 'subDivision', 'division', 'department', 'agency', 'description'],
}

export function AgencyPage() {
  const [activeTab, setActiveTab] = useState<AgencyTab>('Agency')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null)
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [rowsState, setRowsState] = useState<Record<AgencyTab, TableRow[]>>({
    Agency: [...tabConfig.Agency.rows],
    Department: [...tabConfig.Department.rows],
    Division: [...tabConfig.Division.rows],
    'Sub-Division': [...tabConfig['Sub-Division'].rows],
  })

  const config = tabConfig[activeTab]
  const tableKeys = tableKeysByTab[activeTab]
  const currentRows = rowsState[activeTab]

  const normalizedRows = useMemo(
    () =>
      currentRows.map((row) => {
        const normalized: TableRow = {}
        tableKeys.forEach((key) => {
          normalized[key] = row[key] ?? '-'
        })
        return normalized
      }),
    [currentRows, tableKeys],
  )

  const onCreate = () => {
    if (config.formFields.some((field) => !String(formValues[field.key] ?? '').trim())) {
      return
    }

    const nextId = currentRows.length + 1
    const newRow: TableRow = { id: nextId }
    config.formFields.forEach((field) => {
      newRow[field.key] = formValues[field.key]
    })

    setRowsState((prev) => ({
      ...prev,
      [activeTab]: [...prev[activeTab], newRow],
    }))
    setDialogOpen(false)
    setFormValues({})
  }

  const onDeleteRequest = (rowId: number) => {
    setSelectedRowId(rowId)
    setDeleteOpen(true)
  }

  const onConfirmDelete = () => {
    if (selectedRowId === null) return
    setRowsState((prev) => ({
      ...prev,
      [activeTab]: prev[activeTab].filter((row) => Number(row.id) !== selectedRowId),
    }))
    setSelectedRowId(null)
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title={config.title} subtitle={config.subtitle} />
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                  <DialogTitle>Add New {activeTab}</DialogTitle>
                  <p className="mt-1 text-sm text-[var(--fms-text-subheading)]">
                    Create a new {activeTab.toLowerCase()} record in the system
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-3 py-1">
              {config.formFields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key}>
                    {field.label} <span className="text-[var(--fms-delete)]">*</span>
                  </Label>
                  {field.type === 'select' ? (
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
                  ) : field.type === 'textarea' ? (
                    <textarea
                      id={field.key}
                      value={formValues[field.key] ?? ''}
                      onChange={(event) => setFormValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
                      placeholder={field.placeholder}
                      className="min-h-20 w-full rounded-md border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--fms-info-border)]"
                    />
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
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={onCreate}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="inline-flex w-full max-w-full overflow-x-auto rounded-md bg-[#e8ebf0] p-1 sm:w-auto">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={
              tab === activeTab
                ? 'whitespace-nowrap rounded-sm bg-white px-3 py-1.5 text-sm text-[var(--fms-text-header)] shadow-xs'
                : 'whitespace-nowrap rounded-sm px-3 py-1.5 text-sm text-[var(--fms-text-subheading)]'
            }
          >
            {tab}
          </button>
        ))}
      </div>

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="p-0">
          <div className="hidden overflow-x-auto rounded-lg border border-[var(--fms-strokes)] md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  {config.columns.map((column) => (
                    <th key={column} className="px-4 py-3 text-left font-semibold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {normalizedRows.map((row, rowIndex) => (
                  <tr key={`row-${rowIndex}`} className="border-t border-[var(--fms-strokes)]">
                    {tableKeys.map((key) => (
                      <td key={key} className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {String(row[key])}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center gap-2">
                        <button type="button" className="rounded p-1 hover:bg-[var(--fms-info-fill)]">
                          <Pencil className="h-4 w-4 text-[var(--fms-text-header)]" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 hover:bg-[var(--fms-error-fill)]"
                          onClick={() => onDeleteRequest(Number(row.id))}
                        >
                          <Trash2 className="h-4 w-4 text-[var(--fms-delete)]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {normalizedRows.map((row, idx) => (
              <div key={`mobile-${idx}`} className="rounded-lg border border-[var(--fms-strokes)] bg-white p-3">
                {tableKeys.map((key) => (
                  <p key={key} className="text-sm text-[var(--fms-text-subheading)]">
                    <span className="font-medium text-[var(--fms-text-header)]">{key}:</span> {String(row[key])}
                  </p>
                ))}
                <div className="mt-3 inline-flex items-center gap-2">
                  <button type="button" className="rounded p-1 hover:bg-[var(--fms-info-fill)]">
                    <Pencil className="h-4 w-4 text-[var(--fms-text-header)]" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 hover:bg-[var(--fms-error-fill)]"
                    onClick={() => onDeleteRequest(Number(row.id))}
                  >
                    <Trash2 className="h-4 w-4 text-[var(--fms-delete)]" />
                  </button>
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
        title="Delete Record"
        description="Are you sure you want to delete this record? This action cannot be undone."
      />
    </section>
  )
}
