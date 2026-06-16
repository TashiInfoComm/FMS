/** Shared list filter state for trip requisition, request, assignments, and driver feedback. */
export type TripListFilters = {
  tripTypeId: string
}

export const emptyTripListFilters = (): TripListFilters => ({
  tripTypeId: '',
})

export type TripListQueryOptions = {
  /** Sent as `trip_type_id` on GET `/trips`. */
  tripTypeId?: string
  status?: string
}

export function tripListFiltersToQueryOptions(
  filters: TripListFilters,
  extra?: Pick<TripListQueryOptions, 'status'>,
): TripListQueryOptions | undefined {
  const tripTypeId = filters.tripTypeId.trim()
  const status = extra?.status?.trim()
  if (!tripTypeId && !status) return undefined
  return {
    ...(tripTypeId ? { tripTypeId } : {}),
    ...(status ? { status } : {}),
  }
}
