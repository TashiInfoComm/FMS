import { useEffect, useRef } from "react";
import { QRCode } from "react-qrcode-logo";
import { useNavigate } from "react-router-dom";

import ndiImage from "@/assets/ndi.png";
import { Button } from "@/components/ui/button";
import { useNdiProofRequestQr } from "@/features/auth/hooks/useNdiProofRequestQr";
import {
  parseNdiCheckCallbackResponse,
  postNdiCheckCallbackResponse,
  type NdiProofIntent,
} from "@/features/auth/lib/ndi-proof-request-api";
import { Loader } from "@/shared/components/Loader";
import { showErrorToast } from "@/shared/lib/toast";

const QR_DISPLAY_SIZE_PX = 176;
const CALLBACK_POLL_MS = 2500;
const CALLBACK_MAX_WAIT_MS = 5 * 60 * 1000;

type Props = { intent: NdiProofIntent };

export function NdiQrCodePanel({ intent }: Props) {
  const navigate = useNavigate();
  /** Incremented when polling is superseded or unmounted so in-flight `tick` exits without acting. */
  const pollGenerationRef = useRef(0);

  const { data, isPending, isError, error, refetch } = useNdiProofRequestQr(intent);
  const qrPayload = data?.qrValue;
  const threadId = data?.threadId;

  useEffect(() => {
    if (intent !== "registration") return;
    if (!threadId) return;

    const pollGeneration = ++pollGenerationRef.current;
    const started = Date.now();
    let intervalId: ReturnType<typeof window.setInterval> | null = null;
    let tickRunning = false;
    let networkToastSent = false;

    const stopPolling = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const isStale = () => pollGenerationRef.current !== pollGeneration;

    const tick = async () => {
      if (isStale()) return;
      if (tickRunning) return;
      tickRunning = true;
      try {
        if (Date.now() - started > CALLBACK_MAX_WAIT_MS) {
          stopPolling();
          showErrorToast(
            "NDI verification timed out. Try again or use manual signup.",
          );
          return;
        }

        try {
          const raw = await postNdiCheckCallbackResponse(threadId);
          if (isStale()) return;
          const parsed = parseNdiCheckCallbackResponse(raw);
          if (parsed.kind === "complete") {
            stopPolling();
            navigate("/signup/manual", { state: { ndiPrefill: parsed.person } });
            return;
          }
          if (parsed.kind === "error") {
            stopPolling();
            showErrorToast(parsed.message);
          }
        } catch (e) {
          if (isStale()) return;
          if (!networkToastSent) {
            networkToastSent = true;
            showErrorToast(
              e instanceof Error ? e.message : "Could not reach NDI verification.",
            );
          }
        }
      } finally {
        tickRunning = false;
      }
    };

    void tick();
    intervalId = window.setInterval(() => void tick(), CALLBACK_POLL_MS);

    return () => {
      pollGenerationRef.current += 1;
      stopPolling();
    };
  }, [intent, threadId, navigate]);

  return (
    <div className="rounded-xl border-2 border-[var(--fms-ndi-text)] bg-white p-2">
      {isPending ? (
        <div
          className="flex h-44 w-44 flex-col items-center justify-center rounded-lg bg-[var(--fms-background)]"
          aria-busy="true"
        >
          <Loader />
        </div>
      ) : isError ? (
        <div
          className="flex h-44 w-44 flex-col items-center justify-center gap-2 rounded-lg bg-[var(--fms-background)] px-3 text-center text-xs text-[var(--fms-text-subheading)]"
          role="alert"
        >
          <span>
            {error instanceof Error ? error.message : "Could not load NDI QR code."}
          </span>
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : qrPayload ? (
        <QRCode
          value={qrPayload}
          size={QR_DISPLAY_SIZE_PX}
          logoImage={ndiImage}
          logoWidth={34}
          logoHeight={34}
          eyeRadius={4}
          logoPadding={1}
          logoPaddingStyle="circle"
        />
      ) : null}
    </div>
  );
}
