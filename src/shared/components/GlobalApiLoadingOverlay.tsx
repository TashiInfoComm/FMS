import { Spinner } from "@/components/ui/spinner";
import { useApiLoadingStore } from "@/services/api-loading-store";

/**
 * Full-screen overlay while any request from `apiClient` / refresh is in flight.
 */
export function GlobalApiLoadingOverlay() {
  const pending = useApiLoadingStore((s) => s.pending);
  if (pending === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/55 backdrop-blur-[2px]"
      aria-busy="true"
      aria-live="polite"
    >
      <Spinner className="size-10 text-[var(--fms-button)]" />
    </div>
  );
}
