import { Star } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/shared/components/PageHeader'

const formSections = [
  {
    title: 'Personal Details',
    subtitle: 'Basic information about the driver.',
    fields: [
      { key: 'citizenId', label: 'Citizen ID', placeholder: 'Enter citizen ID' },
      { key: 'fullName', label: 'Full Name', placeholder: 'Auto Fetch' },
      { key: 'employeeId', label: 'Employee ID', placeholder: 'Auto Fetch' },
      { key: 'contactNumber', label: 'Contact Number', placeholder: 'Auto Fetch' },
    ],
  },
  {
    title: 'License Information',
    subtitle: 'Driver license and certification details.',
    fields: [
      { key: 'licenseNumber', label: 'License Number', placeholder: 'Enter license number' },
      { key: 'licenseExpiryDate', label: 'License Expiry Date', placeholder: 'mm/dd/yyyy' },
    ],
  },
  {
    title: 'Assignment & Status',
    subtitle: 'Vehicle assignment and current status.',
    fields: [
      { key: 'assignedAgency', label: 'Assigned Agency', placeholder: 'Select Assigned agency' },
      { key: 'assignedVehicle', label: 'Assigned Vehicle', placeholder: 'Select assigned vehicle' },
      { key: 'status', label: 'Status', placeholder: 'Enter Status' },
    ],
  },
]

export function AssignVehicleCreatePage() {
  const [formValues, setFormValues] = useState<Record<string, string>>({})

  return (
    <section className="space-y-5">
      <PageHeader title="Assign Vehicle" subtitle="Enter the details of the new driver." />

      <div className="space-y-5 rounded-xl border border-[var(--fms-strokes)] bg-white p-4">
        {formSections.map((section) => (
          <Card key={section.title} className="border border-[var(--fms-strokes)] bg-white">
            <CardContent className="space-y-4 pt-5">
              <div>
                <p className="text-base font-semibold text-[var(--fms-text-header)]">{section.title}</p>
                <p className="text-xs text-[var(--fms-text-subheading)]">{section.subtitle}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {section.fields.map((field) => (
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
              </div>
            </CardContent>
          </Card>
        ))}

        <Card className="border border-[var(--fms-strokes)] bg-white">
          <CardContent className="space-y-4 pt-5">
            <div>
              <p className="text-base font-semibold text-[var(--fms-text-header)]">Performance</p>
              <p className="text-xs text-[var(--fms-text-subheading)]">Driver performance and rating information.</p>
            </div>

            <div className="space-y-2">
              <Label>Average Rating (0-5)</Label>
              <div className="inline-flex items-center gap-1 text-[#d1d5db]">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <Star key={idx} className="h-5 w-5" />
                ))}
              </div>
              <p className="text-xs text-[var(--fms-text-subheading)]">The rating will be displayed once you have a rating.</p>
            </div>

            <div className="space-y-2">
              <Label>Rating Scale</Label>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  { label: 'Poor', range: '0 - 1' },
                  { label: 'Fair', range: '1 - 2' },
                  { label: 'Average', range: '2 - 3' },
                  { label: 'Good', range: '3 - 4' },
                  { label: 'Excellent', range: '4 - 5' },
                ].map((item) => (
                  <div key={item.label} className="rounded-md border border-[var(--fms-strokes)] bg-[#f8f8f9] p-3 text-center">
                    <div className="mb-1 inline-flex text-[#facc15]">
                      <Star className="h-3.5 w-3.5 fill-[#facc15]" />
                      <Star className="h-3.5 w-3.5 fill-[#facc15]" />
                      <Star className="h-3.5 w-3.5 fill-[#facc15]" />
                    </div>
                    <p className="text-xs font-medium text-[var(--fms-text-header)]">{item.label}</p>
                    <p className="text-[10px] text-[var(--fms-text-subheading)]">{item.range}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button variant="destructive" asChild>
            <Link to="/master/assign-vehicle">Close</Link>
          </Button>
          <Button asChild>
            <Link to="/master/assign-vehicle">Save</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
