import { useQuery } from "@tanstack/react-query";

import {
  fetchNdiProofRequest,
  type NdiProofIntent,
} from "@/features/auth/lib/ndi-proof-request-api";

/** Loads the scan QR payload from POST /auth/ndi/proof_request. */
export function useNdiProofRequestQr(intent: NdiProofIntent) {
  return useQuery({
    queryKey: ["auth", "ndi", "proof_request", intent],
    queryFn: () => fetchNdiProofRequest(intent),
    staleTime: 0,
    gcTime: 120_000,
    retry: 1,
    // Avoid refetching a new proof session when the user returns from the NDI app; polling handles completion.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
