// Temporary trigger for the expiring-vehicle scan. Production runs this from a cron job.
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fetchExpiringVehicles } from '@/features/vehicles/lib/vehicles-api'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

function expiringVehicleCount(payload: unknown): number | null {
  if (Array.isArray(payload)) return payload.length
  if (!payload || typeof payload !== 'object') return null

  const root = payload as Record<string, unknown>
  if (typeof root.count === 'number' && Number.isFinite(root.count)) return root.count
  if (typeof root.total === 'number' && Number.isFinite(root.total)) return root.total

  const data = root.data
  if (Array.isArray(data)) return data.length
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const nested = data as Record<string, unknown>
    if (typeof nested.count === 'number' && Number.isFinite(nested.count)) return nested.count
    if (typeof nested.total === 'number' && Number.isFinite(nested.total)) return nested.total
    for (const key of ['vehicles', 'items', 'results', 'records']) {
      if (Array.isArray(nested[key])) return nested[key].length
    }
  }

  for (const key of ['vehicles', 'items', 'results', 'records']) {
    if (Array.isArray(root[key])) return root[key].length
  }

  return null
}

export function ExpiringVehiclesCard() {
  const queryClient = useQueryClient()
  const fetchMutation = useMutation({
    mutationFn: () => fetchExpiringVehicles(),
    onSuccess: async (payload) => {
      await queryClient.invalidateQueries({ queryKey: ['renewal-applications'] })
      const count = expiringVehicleCount(payload)
      showSuccessToast(
        count === null
          ? 'Expiring vehicles fetched.'
          : `Fetched ${count} expiring vehicle${count === 1 ? '' : 's'}.`,
      )
    },
    onError: (error) => {
      showErrorToast(error, 'Could not fetch expiring vehicles.')
    },
  })

  return (
    <Card className="rounded-xl border border-[var(--fms-strokes)] ring-0">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-[var(--fms-text-header)]">
          Expiring Vehicles
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-[var(--fms-text-subheading)]">
          Check vehicles with documents expiring in the next 7 days. In production this runs on a
          schedule.
        </p>
        <Button
          type="button"
          className="bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)]"
          disabled={fetchMutation.isPending}
          onClick={() => fetchMutation.mutate()}
        >
          {fetchMutation.isPending ? 'Fetching…' : 'Fetch Expiring Vehicles'}
        </Button>
      </CardContent>
    </Card>
  )
}
