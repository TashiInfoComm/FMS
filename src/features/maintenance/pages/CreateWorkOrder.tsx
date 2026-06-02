import { CloudUpload, Plus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  MAINTENANCE_TYPE_OPTIONS,
  PROBLEM_CATEGORY_OPTIONS,
  type MaintenanceType,
} from '@/features/maintenance/lib/maintenance-mock-data'
import { PageHeader } from '@/shared/components/PageHeader'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'
import { cn } from '@/lib/utils'

type MaintenanceItemDraft = {
  key: string
  maintenanceType: MaintenanceType | ''
  problemCategory: string
  problemDescription: string
  proofFile: File | null
}

function RequiredMark() {
  return <span className="text-[var(--fms-delete)]">*</span>
}

function emptyItem(): MaintenanceItemDraft {
  return {
    key: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    maintenanceType: '',
    problemCategory: '',
    problemDescription: '',
    proofFile: null,
  }
}

function MaintenanceItemCard({
  item,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  item: MaintenanceItemDraft
  index: number
  canRemove: boolean
  onChange: (next: MaintenanceItemDraft) => void
  onRemove: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <Card className="border border-[var(--fms-strokes)] bg-[#fafafa] shadow-none">
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--fms-text-header)]">
            Maintenance item {index + 1}
          </p>
          {canRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-[var(--fms-delete)]"
              onClick={onRemove}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Remove
            </Button>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>
              Maintenance Type <RequiredMark />
            </Label>
            <select
              value={item.maintenanceType}
              onChange={(event) =>
                onChange({
                  ...item,
                  maintenanceType: event.target.value as MaintenanceType | '',
                })
              }
              className="flex h-10 w-full rounded-lg border border-[var(--fms-strokes)] bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Select type</option>
              {MAINTENANCE_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>
              Problem Category <RequiredMark />
            </Label>
            <select
              value={item.problemCategory}
              onChange={(event) =>
                onChange({ ...item, problemCategory: event.target.value })
              }
              className="flex h-10 w-full rounded-lg border border-[var(--fms-strokes)] bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Select category</option>
              {PROBLEM_CATEGORY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Problem Description</Label>
          <textarea
            value={item.problemDescription}
            onChange={(event) =>
              onChange({ ...item, problemDescription: event.target.value })
            }
            placeholder="Write description"
            className="min-h-[88px] w-full rounded-lg border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        <div className="space-y-2">
          <Label>Upload Proof</Label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null
              onChange({ ...item, proofFile: file })
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--fms-strokes)] bg-white px-4 py-8 text-center transition-colors hover:bg-[#f3f4f6]',
              item.proofFile && 'border-[var(--fms-primary)] bg-[#f8fbff]',
            )}
          >
            <CloudUpload className="h-8 w-8 text-[var(--fms-text-subheading)]" />
            <span className="text-sm font-medium text-[var(--fms-text-header)]">
              {item.proofFile
                ? item.proofFile.name
                : 'Click to upload or drag and drop'}
            </span>
          </button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function CreateWorkOrder() {
  const navigate = useNavigate()
  const [items, setItems] = useState<MaintenanceItemDraft[]>([emptyItem()])
  const assignedVehicle = 'BG-1-A1234'

  const updateItem = (key: string, next: MaintenanceItemDraft) => {
    setItems((prev) => prev.map((row) => (row.key === key ? next : row)))
  }

  const addItem = () => {
    setItems((prev) => [...prev, emptyItem()])
  }

  const removeItem = (key: string) => {
    setItems((prev) =>
      prev.length <= 1 ? prev : prev.filter((row) => row.key !== key),
    )
  }

  const handleSubmit = () => {
    const invalid = items.some(
      (row) => !row.maintenanceType || !row.problemCategory,
    )
    if (invalid) {
      showErrorToast('Please complete required fields before submitting.')
      return
    }
    showSuccessToast('Maintenance requisition submitted successfully.')
    navigate('/maintenance/work-orders')
  }

  return (
    <section className="space-y-5">
      <PageHeader
        title="Maintenance Requisition"
        subtitle="Apply work order for vehicle maintenance"
      />

      <Card className="border border-[var(--fms-strokes)] bg-white">
        <CardContent className="space-y-5 pt-5">
          <h2 className="text-base font-semibold text-[var(--fms-text-header)]">
            Maintenance Details
          </h2>

          <div className="space-y-2">
            <Label>Assigned Vehicle</Label>
            <Input
              readOnly
              value={assignedVehicle}
              className="bg-[#f8f8f9] text-[var(--fms-text-header)]"
              placeholder="Auto-Populate"
            />
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <MaintenanceItemCard
                key={item.key}
                item={item}
                index={index}
                canRemove={items.length > 1}
                onChange={(next) => updateItem(item.key, next)}
                onRemove={() => removeItem(item.key)}
              />
            ))}
          </div>

          <Button type="button" size="sm" onClick={addItem}>
            <Plus className="mr-1 h-4 w-4" />
            Add New
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="destructive"
          className="bg-[var(--fms-delete)] text-white hover:bg-[var(--fms-delete)]/90"
          asChild
        >
          <Link to="/maintenance/work-orders">Close</Link>
        </Button>
        <Button type="button" onClick={handleSubmit}>
          Submit Request
        </Button>
      </div>
    </section>
  )
}
