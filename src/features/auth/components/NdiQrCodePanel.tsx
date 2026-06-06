import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
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
import { clearCurrentProfileQueryCache } from "@/lib/query-client";
import { apiGet } from "@/services/apiClient";
import { useUserStore } from "@/services/user-store";
import { Loader } from "@/shared/components/Loader";
import { showSuccessToast } from "@/shared/lib/toast";

const QR_DISPLAY_SIZE_PX = 176;
const CALLBACK_POLL_MS = 2500;
const CALLBACK_MAX_WAIT_MS = 2 * 60 * 1000; // 2 minutes

type Props = { intent: NdiProofIntent };

type ProfileResponse = {
  message?: string;
  data?: Record<string, unknown>;
  user?: Record<string, unknown>;
  [key: string]: unknown;
};

function pickProfileFromMeResponse(response: ProfileResponse): Record<string, unknown> | null {
  const raw =
    response.user ??
    response.data ??
    (response as unknown as Record<string, unknown>);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const inner = rec.user ?? rec.profile ?? rec.person;
  if (inner && typeof inner === "object" && !Array.isArray(inner))
    return inner as Record<string, unknown>;
  return rec;
}

export function NdiQrCodePanel({ intent }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setAuthSession = useUserStore((s) => s.setAuthSession);
  const setUser = useUserStore((s) => s.setUser);
  /** Incremented on unmount / new thread so in-flight polls exit without navigating or toasting. */
  const pollGenerationRef = useRef(0);
  /** Thread id currently being polled; cleared as soon as NDI returns a terminal outcome so no further callback POSTs run. */
  const activeCallbackThreadRef = useRef<string | null>(null);

  const [callbackUi, setCallbackUi] = useState<
    { phase: "idle" } | { phase: "polling" } | { phase: "error"; message: string }
  >({ phase: "idle" });

  const { data, isPending, isError, error, refetch } = useNdiProofRequestQr(intent);
  const qrPayload = data?.qrValue;
  const threadId = data?.threadId;

  useEffect(() => {
    if (!threadId) {
      setCallbackUi({ phase: "idle" });
      return;
    }

    setCallbackUi({ phase: "polling" });
    const pollGeneration = ++pollGenerationRef.current;
    const started = Date.now();
    const abortController = new AbortController();
    const tid = threadId;
    activeCallbackThreadRef.current = tid;

    const isStale = () => pollGenerationRef.current !== pollGeneration;
    const shouldStopPolling = () =>
      isStale() || activeCallbackThreadRef.current !== tid;

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms);
      });

    const fail = (message: string) => {
      if (isStale()) return;
      if (activeCallbackThreadRef.current === tid) {
        activeCallbackThreadRef.current = null;
      }
      setCallbackUi({ phase: "error", message });
    };

    const pollUntilResolved = async () => {
      while (!shouldStopPolling()) {
        if (Date.now() - started > CALLBACK_MAX_WAIT_MS) {
          fail(
            intent === "registration"
              ? "NDI verification timed out. Try again or use manual signup."
              : "NDI verification timed out. Try again or sign in with username and password.",
          );
          return;
        }

        try {
          const raw = await postNdiCheckCallbackResponse(tid, intent, {
            signal: abortController.signal,
          });
          if (shouldStopPolling()) return;
          const parsed = parseNdiCheckCallbackResponse(raw);
          if (parsed.kind === "complete") {
            activeCallbackThreadRef.current = null;
            if (intent === "registration") {
              navigate("/signup/manual", { state: { ndiPrefill: parsed.person } });
              return;
            }
            const auth = parsed.auth;
            if (!auth?.accessToken) {
              fail(
                "NDI sign-in succeeded but no access token was returned. Try password login.",
              );
              return;
            }
            setAuthSession({
              accessToken: auth.accessToken,
              refreshToken: auth.refreshToken,
              user: null,
            });
            try {
              clearCurrentProfileQueryCache();
              const profileResponse = await queryClient.fetchQuery({
                queryKey: ["current-profile"],
                queryFn: () => apiGet<ProfileResponse>("/auth/me"),
                staleTime: 5 * 60 * 1000,
              });
              const profile = pickProfileFromMeResponse(profileResponse);
              if (profile) setUser(profile);
            } catch {
              /* same as credential login — session still usable */
            }
            showSuccessToast("Login successful");
            navigate("/dashboard", { replace: true });
            return;
          }
          if (parsed.kind === "error") {
            fail(parsed.message);
            return;
          }
        } catch (e) {
          if (shouldStopPolling()) return;
          if (e instanceof DOMException && e.name === "AbortError") return;
          // Network-level failures: keep polling until max wait; API errors (thrown Error with server message) stop immediately.
          const isTransientNetwork =
            e instanceof TypeError ||
            (e instanceof Error && /network|fetch|failed to load/i.test(e.message));
          if (isTransientNetwork) {
            if (shouldStopPolling()) return;
            await sleep(CALLBACK_POLL_MS);
            continue;
          }
          fail(
            e instanceof Error ? e.message : "Could not reach NDI verification.",
          );
          return;
        }

        if (shouldStopPolling()) return;
        await sleep(CALLBACK_POLL_MS);
      }
    };

    void pollUntilResolved();

    return () => {
      pollGenerationRef.current += 1;
      if (activeCallbackThreadRef.current === tid) {
        activeCallbackThreadRef.current = null;
      }
      abortController.abort();
    };
  }, [
    intent,
    threadId,
    navigate,
    queryClient,
    setAuthSession,
    setUser,
  ]);

  const callbackPolling = callbackUi.phase === "polling";
  const callbackError =
    callbackUi.phase === "error" ? callbackUi.message : null;

  const restartQr = () => {
    pollGenerationRef.current += 1;
    activeCallbackThreadRef.current = null;
    setCallbackUi({ phase: "idle" });
    void refetch();
  };

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
      ) : callbackError ? (
        <div
          className="flex h-44 w-44 flex-col items-center justify-center gap-2 rounded-lg bg-[var(--fms-background)] px-3 text-center text-xs text-[var(--fms-text-subheading)]"
          role="alert"
        >
          <span>{callbackError}</span>
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={restartQr}>
            Try again
          </Button>
        </div>
      ) : qrPayload ? (
        <div className="inline-flex flex-col items-center gap-2">
          <div className="inline-flex rounded-lg">
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
          </div>
          {callbackPolling ? (
            <div
              className="flex flex-col items-center justify-center gap-2 px-2 text-center"
              aria-busy="true"
              aria-live="polite"
            >
              <Loader />
              <span className="text-[10px] font-medium leading-tight text-[var(--fms-text-subheading)]">
                Waiting for NDI verification…
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
