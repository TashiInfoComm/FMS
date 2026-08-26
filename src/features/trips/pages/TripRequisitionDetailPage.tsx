import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'

import { TripDetailContent } from '@/features/trips/components/TripDetailContent'
import { TripDetailSkeleton } from '@/features/trips/components/TripDetailSkeleton'
import { fetchTripDetail } from '@/features/trips/lib/trips-api'
import { BackToListButton } from '@/shared/components/BackToListButton'
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
        <BackToListButton to="/trip/requisition" />
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
      />
    )
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <section className="space-y-5">
        <BackToListButton to="/trip/requisition" />
        <PageHeader title="My Trip" subtitle="Trip not found" />
        <p className="text-sm text-[var(--fms-text-subheading)]">
          {detailQuery.error instanceof Error
            ? detailQuery.error.message
            : `No trip matches "${tripId}". Return to the list and try again.`}
        </p>
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
