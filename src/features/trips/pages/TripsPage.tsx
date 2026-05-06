// Shows the trips module overview and summary widgets.
import { useState } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AppButton } from '@/shared/components/AppButton'
import { PageHeader } from '@/shared/components/PageHeader'

export function TripsPage() {
  // Scaffold form state; persistence and validation to be added with trips API.
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [departureDate, setDepartureDate] = useState('')

  return (
    <section className="space-y-6">
      <PageHeader title="Trips" subtitle="Plan and assign transportation trips." />
      <Card size="sm" className="max-w-xl">
        <CardHeader>
          <CardTitle>CreateTrip</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="trip-origin">Origin</Label>
            <Input id="trip-origin" value={origin} onChange={(e) => setOrigin(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trip-destination">Destination</Label>
            <Input id="trip-destination" value={destination} onChange={(e) => setDestination(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trip-date">Departure Date</Label>
            <Input id="trip-date" type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} />
          </div>
          <AppButton className="w-full">Create Trip</AppButton>
        </CardContent>
      </Card>
    </section>
  )
}
