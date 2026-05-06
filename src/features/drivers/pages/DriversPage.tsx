// Shows the drivers module overview and summary widgets.
import { useState } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AppButton } from '@/shared/components/AppButton'
import { PageHeader } from '@/shared/components/PageHeader'

export function DriversPage() {
  // Scaffold form state; submit handler not wired yet.
  const [name, setName] = useState('')
  const [licenseNo, setLicenseNo] = useState('')

  return (
    <section className="space-y-6">
      <PageHeader title="Drivers" subtitle="Register and manage assigned drivers." />
      <Card size="sm" className="max-w-xl">
        <CardHeader>
          <CardTitle>CreateDriver</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="driver-name">Driver Name</Label>
            <Input id="driver-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="license-number">License Number</Label>
            <Input id="license-number" value={licenseNo} onChange={(e) => setLicenseNo(e.target.value)} />
          </div>
          <AppButton className="w-full">Create Driver</AppButton>
        </CardContent>
      </Card>
    </section>
  )
}
