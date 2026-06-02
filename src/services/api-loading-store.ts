import { create } from "zustand";

type ApiLoadingState = {
  pending: number;
  begin: () => void;
  end: () => void;
};

/**
 * Tracks in-flight HTTP calls from {@link apiClient} (and refresh) for a global loading UI.
 */
export const useApiLoadingStore = create<ApiLoadingState>((set) => ({
  pending: 0,
  begin: () => set((s) => ({ pending: s.pending + 1 })),
  end: () => set((s) => ({ pending: Math.max(0, s.pending - 1) })),
}));
