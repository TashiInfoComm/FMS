// Configures the shared React Query client defaults.
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

/** Drop cached `/auth/me` so the next fetch matches the active session (avoid stale user in localStorage). */
export function clearCurrentProfileQueryCache() {
  queryClient.removeQueries({ queryKey: ['current-profile'] })
}
