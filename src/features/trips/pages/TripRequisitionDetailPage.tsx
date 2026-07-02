import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { TripDetailContent } from '@/features/trips/components/TripDetailContent'
import { TripDetailSkeleton } from '@/features/trips/components/TripDetailSkeleton'
import { fetchTripDetail } from '@/features/trips/lib/trips-api'
import { PageHeader } from '@/shared/components/PageHeader'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'

export default function TripRequisitionDetailPage() {
  const { tripId } = useParams<{ tripId: string }>()
  const crud = useRouteCrudPermissions('/trip/requisition')

  const detailQuery = useQuery({
    queryKey: ['trips', 'detail', tripId],
    queryFn: () => fetchTripDetail(tripId!),
    enabled: Boolean(tripId?.trim()) && (!crud.isResolved || crud.canRead),
    staleTime: 30_000,
  })

  if (crud.isResolved && !crud.canRead) {
    return (
      <section className="space-y-5">
        <PageHeader title="My Trip" subtitle="Trip detail" />
        <p className="text-sm text-[var(--fms-text-subheading)]">
          You do not have permission to view this trip.
        </p>
      </section>
    )
  }

  if (detailQuery.isLoading) {
    return (
      <TripDetailSkeleton
        title="My Trip"
        backPath="/trip/requisition"
        backLabel="Back to my trips"
      />
    )
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <section className="space-y-5">
        <Button variant="outline" size="icon" asChild>
          <Link to="/trip/requisition" aria-label="Back to my trips">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader title="My Trip" subtitle="Trip not found" />
        <p className="text-sm text-[var(--fms-text-subheading)]">
          {detailQuery.error instanceof Error
            ? detailQuery.error.message
            : `No trip matches "${tripId}". Return to the list and try again.`}
        </p>
        <Button variant="outline" asChild>
          <Link to="/trip/requisition">Back to My Trips</Link>
        </Button>
      </section>
    )
  }

  return (
    <TripDetailContent
      trip={detailQuery.data}
      mode="requisition"
      backPath="/trip/requisition"
    />
  )
}
