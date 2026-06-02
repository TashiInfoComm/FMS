import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ServicesPartsTable } from '@/features/maintenance/components/ServicesPartsTable'
import {
  getServiceRecordById,
  sumLineItems,
} from '@/features/maintenance/lib/maintenance-mock-data'
import { workOrderStatusBadgeClass } from '@/features/maintenance/lib/maintenance-ui'
import { PageHeader } from '@/shared/components/PageHeader'
import { showSuccessToast } from '@/shared/lib/toast'

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--fms-strokes)] bg-white p-4">
      <p className="text-xs text-[var(--fms-text-subheading)]">{label}</p>
      <p className="mt-1 text-base font-semibold text-[var(--fms-text-header)]">
        {value}
      </p>
    </div>
  )
}

export default function ServiceRecordDetail() {
  const { recordId = '' } = useParams<{ recordId: string }>()
  const record = getServiceRecordById(recordId)

  if (!record) {
    return (
      <section className="space-y-4">
        <PageHeader
          title="Vehicle Service"
          subtitle="Report issues and update service completion."
        />
        <Card className="border border-[var(--fms-strokes)] bg-white">
          <CardContent className="py-8 text-center text-[var(--fms-text-subheading)]">
            Service record not found.
          </CardContent>
        </Card>
        <Button asChild variant="outline">
          <Link to="/maintenance/records">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Vehicle Service
          </Link>
        </Button>
      </section>
    )
  }

  const total = sumLineItems(record.lineItems)
  const statusLabel =
    record.maintenanceRequestStatus ?? record.status ?? 'Approved for Service'

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Vehicle Service"
          subtitle="Report issues and update service completion."
        />
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link to="/maintenance/records">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <Card className="border border-[var(--fms-strokes)] bg-white">
        <CardContent className="space-y-4 pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-[var(--fms-text-header)]">
              My vehicle service
            </h2>
            <Badge className={workOrderStatusBadgeClass('Approved for Service')}>
              {statusLabel}
            </Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <SummaryTile
              label="Maintenance Request Status"
              value={statusLabel}
            />
            <SummaryTile
              label="Vehicle Ready Status"
              value={record.vehicleReadyStatus ?? 'Proceed to workshop'}
            />
            <SummaryTile
              label="Last Service Date"
              value={record.lastServiceDate ?? '—'}
            />
          </div>

          <p className="text-sm text-[var(--fms-text-subheading)]">
            {record.workOrderId} · {record.vehiclePlate} · {record.vehicleModel}
          </p>
        </CardContent>
      </Card>

      <Card className="border border-[var(--fms-strokes)] bg-white">
        <CardContent className="pt-5">
          <ServicesPartsTable
            title="Services & Parts"
            items={record.lineItems}
            total={total}
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          className="border-transparent bg-[#16a34a] text-white hover:bg-[#15803d]"
          onClick={() =>
            showSuccessToast(`Service completed for ${record.workOrderId}`)
          }
        >
          Complete Service
        </Button>
      </div>
    </section>
  )
}
