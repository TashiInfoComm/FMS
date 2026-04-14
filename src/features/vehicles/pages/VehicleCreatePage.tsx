import { Link } from 'react-router-dom'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/shared/components/PageHeader'

const createVehicleFields = [
  {
    section: 'Basic Information',
    subtitle: 'Core identification details of the vehicle.',
    fields: [
      { key: 'vehicleNumber', label: 'Vehicle Number', placeholder: 'Enter vehicle number' },
      { key: 'make', label: 'Make', placeholder: 'Enter make' },
      { key: 'model', label: 'Model', placeholder: 'Enter model' },
      { key: 'color', label: 'Color', placeholder: 'Enter color' },
      { key: 'manufacturingYear', label: 'Manufacturing Year', placeholder: 'mm/dd/yyyy' },
      { key: 'chassisNumber', label: 'Chassis Number', placeholder: 'Enter chassis number' },
      { key: 'registrationDate', label: 'Registration Date', placeholder: 'mm/dd/yyyy' },
      { key: 'engineNumber', label: 'Engine Number', placeholder: 'Enter engine number' },
      { key: 'seatingCapacity', label: 'Seating Capacity', placeholder: 'Enter seating capacity' },
      { key: 'odometer', label: 'Current Odometer Reading (km)', placeholder: 'Enter current odometer reading' },
      { key: 'lastServiceDate', label: 'Last Service Date', placeholder: 'mm/dd/yyyy' },
      { key: 'gpsDeviceId', label: 'GPS Device ID', placeholder: 'Enter GPS device id' },
    ],
  },
  {
    section: 'Classification',
    subtitle: 'Categorization and current status.',
    fields: [
      { key: 'vehicleType', label: 'Vehicle Type', placeholder: 'Select vehicle type' },
      { key: 'vehicleCategory', label: 'Vehicle Category', placeholder: 'Select category' },
      { key: 'fuelType', label: 'Fuel Type', placeholder: 'Select fuel type' },
      { key: 'vehicleStatus', label: 'Vehicle Status', placeholder: 'Select vehicle status' },
      { key: 'vehicleMovementStatus', label: 'Vehicle Movement Status', placeholder: 'Select vehicle movement status' },
    ],
  },
  {
    section: 'Agency & Insurance',
    subtitle: 'Ownership, transfers, and policy information.',
    fields: [
      { key: 'originalAgency', label: 'Original Agency', placeholder: 'Select original agency' },
      { key: 'currentAgency', label: 'Current Agency', placeholder: 'Select current agency' },
      { key: 'insurancePolicy', label: 'Insurance Policy', placeholder: 'Select insurance policy' },
    ],
  },
]

export function VehicleCreatePage() {
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [transferredStatus, setTransferredStatus] = useState<'yes' | 'no'>('yes')

  return (
    <section className="space-y-5">
      <PageHeader title="Add New Vehicle" subtitle="Enter the details of the new vehicle." />

      <div className="space-y-5 rounded-xl border border-[var(--fms-strokes)] bg-white p-4">
        {createVehicleFields.map((group) => (
          <Card key={group.section} className="border border-[var(--fms-strokes)] bg-white">
            <CardContent className="space-y-4 pt-5">
              <div>
                <p className="text-base font-semibold text-[var(--fms-text-header)]">{group.section}</p>
                <p className="text-xs text-[var(--fms-text-subheading)]">{group.subtitle}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {group.fields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={field.key}>
                      {field.label} <span className="text-[var(--fms-delete)]">*</span>
                    </Label>
                    <Input
                      id={field.key}
                      value={formValues[field.key] ?? ''}
                      onChange={(event) => setFormValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
                      placeholder={field.placeholder}
                    />
                  </div>
                ))}
                {group.section === 'Agency & Insurance' ? (
                  <div className="space-y-2">
                    <Label>
                      Transferred Status <span className="text-[var(--fms-delete)]">*</span>
                    </Label>
                    <div className="inline-flex rounded-md border border-[var(--fms-strokes)]">
                      <button
                        type="button"
                        onClick={() => setTransferredStatus('yes')}
                        className={
                          transferredStatus === 'yes'
                            ? 'rounded-l-md bg-[var(--fms-info-fill)] px-4 py-2 text-sm text-[var(--fms-text-header)]'
                            : 'rounded-l-md px-4 py-2 text-sm text-[var(--fms-text-subheading)]'
                        }
                      >
                        Yes (Transferred)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTransferredStatus('no')}
                        className={
                          transferredStatus === 'no'
                            ? 'rounded-r-md bg-[var(--fms-info-fill)] px-4 py-2 text-sm text-[var(--fms-text-header)]'
                            : 'rounded-r-md px-4 py-2 text-sm text-[var(--fms-text-subheading)]'
                        }
                      >
                        No (Original)
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}

        <div className="flex items-center gap-3">
          <Button variant="destructive" asChild>
            <Link to="/master/vehicle">Close</Link>
          </Button>
          <Button asChild>
            <Link to="/master/vehicle">Save Vehicle</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
