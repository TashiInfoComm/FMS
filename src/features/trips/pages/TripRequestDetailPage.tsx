import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { TripDetailContent } from '@/features/trips/components/TripDetailContent'
import { TripDetailSkeleton } from '@/features/trips/components/TripDetailSkeleton'
import { fetchTripDetail } from '@/features/trips/lib/trips-api'
import { fetchTripRequisitionMasterLists } from '@/features/trips/lib/trip-requisition-masters'
import { PageHeader } from '@/shared/components/PageHeader'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'

export default function TripRequestDetailPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const crud = useRouteCrudPermissions('/trip/request')

  const mastersQuery = useQuery({
    queryKey: ['trips', 'masters'],
    queryFn: fetchTripRequisitionMasterLists,
    enabled: !crud.isResolved || crud.canRead,
    staleTime: 5 * 60_000,
  })

  const detailQuery = useQuery({
    queryKey: ['trips', 'detail', requestId, mastersQuery.dataUpdatedAt],
    queryFn: () =>
      fetchTripDetail(requestId!, {
        tripTypes: mastersQuery.data?.tripTypes,
        purposes: mastersQuery.data?.journeyPurposes,
        vehicleTypes: mastersQuery.data?.vehicleTypes,
      }),
    enabled: Boolean(requestId?.trim()) && (!crud.isResolved || crud.canRead),
    staleTime: 30_000,
  })

  if (crud.isResolved && !crud.canRead) {
    return (
      <section className="space-y-5">
        <PageHeader title="Trip Request" subtitle="Trip request detail" />
        <p className="text-sm text-[var(--fms-text-subheading)]">
          You do not have permission to view this trip request.
        </p>
      </section>
    )
  }

  if (detailQuery.isLoading) {
    return (
      <TripDetailSkeleton
        title="Trip Request"
        backPath="/trip/request"
        backLabel="Back to trip requests"
      />
    )
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <section className="space-y-5">
        <Button variant="outline" size="icon" asChild>
          <Link to="/trip/request" aria-label="Back to trip requests">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader title="Trip Request" subtitle="Request not found" />
        <p className="text-sm text-[var(--fms-text-subheading)]">
          {detailQuery.error instanceof Error
            ? detailQuery.error.message
            : `No trip request matches "${requestId}". Return to the list and try again.`}
        </p>
        <Button variant="outline" asChild>
          <Link to="/trip/request">Back to Trip Requests</Link>
        </Button>
      </section>
    )
  }

  return (
    <TripDetailContent
      trip={detailQuery.data}
      mode="request"
      backPath="/trip/request"
    />
  )
}
