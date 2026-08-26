import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'

import { TripDetailContent } from '@/features/trips/components/TripDetailContent'
import { TripDetailSkeleton } from '@/features/trips/components/TripDetailSkeleton'
import { fetchTripDetail } from '@/features/trips/lib/trips-api'
import { BackToListButton } from '@/shared/components/BackToListButton'
import { PageHeader } from '@/shared/components/PageHeader'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'

export default function TripRequestDetailPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const crud = useRouteCrudPermissions('/trip/request')

  const detailQuery = useQuery({
    queryKey: ['trips', 'detail', requestId],
    queryFn: () => fetchTripDetail(requestId!),
    enabled: Boolean(requestId?.trim()) && (!crud.isResolved || crud.canRead),
    staleTime: 30_000,
  })

  if (crud.isResolved && !crud.canRead) {
    return (
      <section className="space-y-5">
        <BackToListButton to="/trip/request" />
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
      />
    )
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <section className="space-y-5">
        <BackToListButton to="/trip/request" />
        <PageHeader title="Trip Request" subtitle="Request not found" />
        <p className="text-sm text-[var(--fms-text-subheading)]">
          {detailQuery.error instanceof Error
            ? detailQuery.error.message
            : `No trip request matches "${requestId}". Return to the list and try again.`}
        </p>
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
