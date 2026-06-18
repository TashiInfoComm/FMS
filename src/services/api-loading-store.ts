import { create } from "zustand";

type ApiLoadingState = {
  pending: number;
  begin: () => void;
  end: () => void;
};

/**
 * Tracks in-flight mutating HTTP calls from {@link apiClient} for a global loading UI.
 * GET/HEAD requests are excluded so detail pages can show field-level loaders.
 */
export const useApiLoadingStore = create<ApiLoadingState>((set) => ({
  pending: 0,
  begin: () => set((s) => ({ pending: s.pending + 1 })),
  end: () => set((s) => ({ pending: Math.max(0, s.pending - 1) })),
}));
