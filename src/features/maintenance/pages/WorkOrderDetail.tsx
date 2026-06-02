import {
  ArrowLeft,
  CarFront,
  Clock3,
  CloudUpload,
  User,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ServicesPartsTable } from '@/features/maintenance/components/ServicesPartsTable'
import {
  getWorkOrderById,
  sumLineItems,
  type MaintenanceLineItem,
} from '@/features/maintenance/lib/maintenance-mock-data'
import { workOrderStatusBadgeClass } from '@/features/maintenance/lib/maintenance-ui'
import { PageHeader } from '@/shared/components/PageHeader'
import { cn } from '@/lib/utils'

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--fms-strokes)] bg-[#f6f6f7] p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--fms-primary)]">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs text-[var(--fms-text-subheading)]">{label}</p>
        <p className="mt-0.5 font-semibold text-[var(--fms-text-header)]">
          {value}
        </p>
      </div>
    </div>
  )
}

function FieldReadOnly({
  label,
  value,
  className,
}: {
  label: string
  value?: string
  className?: string
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label>{label}</Label>
      <Input
        readOnly
        value={value ?? ''}
        placeholder="—"
        className="bg-[#f8f8f9] text-[var(--fms-text-header)]"
      />
    </div>
  )
}

export default function WorkOrderDetail() {
  const { workOrderId = '' } = useParams<{ workOrderId: string }>()
  const workOrder = getWorkOrderById(workOrderId)
  const [lineItems, setLineItems] = useState<MaintenanceLineItem[]>(
    () => workOrder?.lineItems ?? [],
  )

  const total = useMemo(() => sumLineItems(lineItems), [lineItems])

  if (!workOrder) {
    return (
      <section className="space-y-4">
        <PageHeader
          title="Work Order Details"
          subtitle="This work order has been initiated by the driver."
        />
        <Card className="border border-[var(--fms-strokes)] bg-white">
          <CardContent className="py-8 text-center text-[var(--fms-text-subheading)]">
            Work order not found.
          </CardContent>
        </Card>
        <Button asChild variant="outline">
          <Link to="/maintenance/work-orders">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Work Orders
          </Link>
        </Button>
      </section>
    )
  }

  const removeLineItem = (itemId: string) => {
    setLineItems((prev) => prev.filter((row) => row.id !== itemId))
  }

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: `li-new-${Date.now()}`,
        description: 'New service item',
        quantity: 1,
        unitPrice: 0,
      },
    ])
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <PageHeader
            title="Work Order Details"
            subtitle="This work order has been initiated by the driver."
          />
          <Badge className={workOrderStatusBadgeClass(workOrder.status)}>
            {workOrder.status}
          </Badge>
        </div>
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link to="/maintenance/work-orders">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard icon={User} label="Driver" value={workOrder.driverName} />
        <SummaryCard
          icon={CarFront}
          label="Vehicle"
          value={workOrder.vehicleModel}
        />
        <SummaryCard
          icon={Clock3}
          label="Initiation Reason"
          value={workOrder.initiationReason}
        />
      </div>

      <Card className="border border-[var(--fms-strokes)] bg-white">
        <CardContent className="space-y-4 pt-5">
          <h2 className="text-base font-semibold text-[var(--fms-text-header)]">
            General Information
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <FieldReadOnly label="Vehicle" value={workOrder.vehiclePlate} />
            <FieldReadOnly
              label="Maintenance Type"
              value={workOrder.maintenanceType}
            />
            <FieldReadOnly
              label="Problem Category"
              value={workOrder.problemCategory}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FieldReadOnly
              label="Problem Description"
              value={workOrder.problemDescription}
              className="md:col-span-1"
            />
            <div className="space-y-2">
              <Label>Proof</Label>
              {workOrder.proof ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2 text-sm text-[var(--fms-primary)]">
                  <CloudUpload className="h-4 w-4 shrink-0" />
                  <span className="font-medium">{workOrder.proof.name}</span>
                  <span className="text-[var(--fms-text-subheading)]">
                    {workOrder.proof.sizeLabel}
                  </span>
                </div>
              ) : (
                <Input
                  readOnly
                  value=""
                  placeholder="—"
                  className="bg-[#f8f8f9]"
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-[var(--fms-strokes)] bg-white">
        <CardContent className="pt-5">
          <ServicesPartsTable
            title="Services & Parts Required"
            items={lineItems}
            total={total}
            editable
            onAdd={addLineItem}
            onDelete={removeLineItem}
          />
        </CardContent>
      </Card>
    </section>
  )
}
