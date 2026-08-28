"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  BillStatusSummary,
  type BillStatusSummaryProps,
} from "./native-bill-review";

const DEFAULT_API_BASE_URL = "https://app.mindbill.org";
const DEFAULT_SESSION_ENDPOINT = "/api/mindbill/status-session";
const DEFAULT_REFRESH_INTERVAL = 60_000;

export type BillStatusData = {
  billId: string;
  state: string;
  nativeStatus: string;
  submittedAt: string | null;
  agingDays: number | null;
  updatedAt: string | null;
  totalCharge: number;
  totalPaid: number;
  balanceDue: number;
};

export type BillStatusSession = {
  token: string;
  expiresAt?: string;
  apiBaseUrl?: string;
};

export type BillStatusSessionRequest = {
  billId: string;
  signal: AbortSignal;
};

export type BillStatusSessionProvider = (
  request: BillStatusSessionRequest,
) => Promise<BillStatusSession>;

export type BillStatusClientOptions = {
  billId: string;
  /** Same-origin route that mints a short-lived, bill-scoped browser session. */
  sessionEndpoint?: string;
  /** Advanced escape hatch for non-HTTP session exchange. */
  getSession?: BillStatusSessionProvider;
  apiBaseUrl?: string;
  fetch?: typeof globalThis.fetch;
};

export type BillStatusClient = {
  getStatus: (signal?: AbortSignal) => Promise<BillStatusData>;
  clearSession: () => void;
};

export type UseBillStatusOptions = BillStatusClientOptions & {
  refreshInterval?: number;
  enabled?: boolean;
  initialData?: BillStatusData | null;
};

export type UseBillStatusResult = {
  data: BillStatusData | null;
  error: Error | null;
  isLoading: boolean;
  isRefreshing: boolean;
  refresh: () => Promise<void>;
};

async function responseError(
  response: Response,
  fallback: string,
): Promise<Error> {
  const body: unknown = await response.json().catch(() => null);
  const detail = body && typeof body === "object"
    ? (body as { detail?: unknown; error?: unknown }).detail
      ?? (body as { error?: unknown }).error
    : null;
  return new Error(typeof detail === "string" ? detail : fallback);
}

function isSessionFresh(session: BillStatusSession | null): boolean {
  if (!session) return false;
  if (!session.expiresAt) return true;
  const expiresAt = new Date(session.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt > Date.now() + 30_000;
}

function normalizeSession(value: unknown): BillStatusSession {
  if (!value || typeof value !== "object") {
    throw new Error("The MindBill session endpoint returned an invalid response.");
  }
  const candidate = value as {
    token?: unknown;
    expiresAt?: unknown;
    apiBaseUrl?: unknown;
    session?: unknown;
    data?: unknown;
  };
  const nested = candidate.session ?? candidate.data;
  const session = nested && typeof nested === "object"
    ? nested as typeof candidate
    : candidate;
  if (typeof session.token !== "string" || session.token.length < 8) {
    throw new Error("The MindBill session endpoint did not return a browser session token.");
  }
  return {
    token: session.token,
    ...(typeof session.expiresAt === "string"
      ? { expiresAt: session.expiresAt }
      : {}),
    ...(typeof session.apiBaseUrl === "string"
      ? { apiBaseUrl: session.apiBaseUrl }
      : {}),
  };
}

function normalizeStatus(value: unknown, billId: string): BillStatusData {
  if (!value || typeof value !== "object") {
    throw new Error("MindBill returned an invalid bill status.");
  }
  const status = value as Partial<BillStatusData>;
  const amounts = [status.totalCharge, status.totalPaid, status.balanceDue];
  if (
    typeof status.state !== "string"
    || amounts.some(
      (amount) => typeof amount !== "number" || !Number.isFinite(amount),
    )
  ) {
    throw new Error("MindBill returned an invalid bill status.");
  }
  return {
    billId: typeof status.billId === "string" ? status.billId : billId,
    state: status.state,
    nativeStatus: typeof status.nativeStatus === "string"
      ? status.nativeStatus
      : status.state,
    submittedAt: typeof status.submittedAt === "string"
      ? status.submittedAt
      : null,
    agingDays: typeof status.agingDays === "number" ? status.agingDays : null,
    updatedAt: typeof status.updatedAt === "string" ? status.updatedAt : null,
    totalCharge: status.totalCharge as number,
    totalPaid: status.totalPaid as number,
    balanceDue: status.balanceDue as number,
  };
}

/**
 * Browser-safe status client used by useBillStatus. It exchanges the user's
 * authenticated same-origin session for a short-lived MindBill token, then
 * reads status directly from MindBill. It never accepts a Partner API key.
 */
export function createBillStatusClient({
  billId,
  sessionEndpoint = DEFAULT_SESSION_ENDPOINT,
  getSession,
  apiBaseUrl = DEFAULT_API_BASE_URL,
  fetch: fetchOverride,
}: BillStatusClientOptions): BillStatusClient {
  const fetcher = fetchOverride ?? globalThis.fetch;
  if (typeof fetcher !== "function") {
    throw new Error("A Fetch API implementation is required.");
  }
  let session: BillStatusSession | null = null;
  let sessionRequest: Promise<BillStatusSession> | null = null;

  const mintSession = async (
    signal: AbortSignal,
    force = false,
  ): Promise<BillStatusSession> => {
    if (!force && isSessionFresh(session)) return session as BillStatusSession;
    if (!force && sessionRequest) return sessionRequest;

    const pending = getSession
      ? getSession({ billId, signal })
      : fetcher(sessionEndpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ billId }),
        signal,
      }).then(async (response) => {
        if (!response.ok) {
          throw await responseError(
            response,
            "MindBill browser session could not be created.",
          );
        }
        return response.json();
      });

    const request = Promise.resolve(pending)
      .then(normalizeSession)
      .then((nextSession) => {
        session = nextSession;
        return nextSession;
      })
      .finally(() => {
        if (sessionRequest === request) sessionRequest = null;
      });
    sessionRequest = request;
    return request;
  };

  const requestStatus = async (
    browserSession: BillStatusSession,
    signal: AbortSignal,
  ): Promise<Response> => {
    const baseUrl = (browserSession.apiBaseUrl ?? apiBaseUrl).replace(/\/$/, "");
    return fetcher(`${baseUrl}/partner/v2/browser/status`, {
      headers: { authorization: `Bearer ${browserSession.token}` },
      signal,
    });
  };

  return {
    clearSession() {
      session = null;
      sessionRequest = null;
    },
    async getStatus(providedSignal) {
      const controller = providedSignal ? null : new AbortController();
      const signal = providedSignal ?? controller?.signal;
      if (!signal) throw new Error("An AbortSignal could not be created.");
      let browserSession = await mintSession(signal);
      let response = await requestStatus(browserSession, signal);
      if (response.status === 401) {
        session = null;
        browserSession = await mintSession(signal, true);
        response = await requestStatus(browserSession, signal);
      }
      if (!response.ok) {
        throw await responseError(response, "Bill status could not be loaded.");
      }
      const body = await response.json() as { data?: unknown };
      return normalizeStatus(body.data, billId);
    },
  };
}

export function useBillStatus({
  billId,
  sessionEndpoint = DEFAULT_SESSION_ENDPOINT,
  getSession,
  apiBaseUrl = DEFAULT_API_BASE_URL,
  refreshInterval = DEFAULT_REFRESH_INTERVAL,
  enabled = true,
  initialData = null,
  fetch: fetchOverride,
}: UseBillStatusOptions): UseBillStatusResult {
  const client = useMemo(() => createBillStatusClient({
    billId,
    sessionEndpoint,
    ...(getSession ? { getSession } : {}),
    apiBaseUrl,
    ...(fetchOverride ? { fetch: fetchOverride } : {}),
  }), [apiBaseUrl, billId, fetchOverride, getSession, sessionEndpoint]);
  const [data, setData] = useState<BillStatusData | null>(initialData);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(enabled && !initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const dataRef = useRef<BillStatusData | null>(initialData);
  const initialDataRef = useRef<BillStatusData | null>(initialData);
  initialDataRef.current = initialData;
  const activeControllerRef = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);

  useEffect(() => {
    const seed = initialDataRef.current;
    dataRef.current = seed;
    setData(seed);
    setError(null);
    setIsLoading(enabled && !seed);
    activeControllerRef.current?.abort();
    return () => activeControllerRef.current?.abort();
  }, [client, enabled]);

  const load = useCallback(async () => {
    if (!enabled || !billId) return;
    const sequence = ++requestSequence.current;
    activeControllerRef.current?.abort();
    const controller = new AbortController();
    activeControllerRef.current = controller;
    if (dataRef.current) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const nextData = await client.getStatus(controller.signal);
      if (!controller.signal.aborted && sequence === requestSequence.current) {
        dataRef.current = nextData;
        setData(nextData);
      }
    } catch (cause) {
      if (controller.signal.aborted) return;
      if (sequence === requestSequence.current) {
        setError(
          cause instanceof Error
            ? cause
            : new Error("Bill status could not be loaded."),
        );
      }
    } finally {
      if (activeControllerRef.current === controller) {
        activeControllerRef.current = null;
      }
      if (!controller.signal.aborted && sequence === requestSequence.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [billId, client, enabled]);

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled || refreshInterval <= 0) return;
    const timer = window.setInterval(() => void load(), refreshInterval);
    const onFocus = () => void load();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, load, refreshInterval]);

  return { data, error, isLoading, isRefreshing, refresh: load };
}

export type ConnectedBillStatusProps = UseBillStatusOptions & {
  actions?: BillStatusSummaryProps["actions"];
  appearance?: BillStatusSummaryProps["appearance"];
  className?: string;
  style?: BillStatusSummaryProps["style"];
  loadingFallback?: ReactNode;
  errorFallback?: (error: Error, retry: () => Promise<void>) => ReactNode;
};

export function ConnectedBillStatus({
  actions,
  appearance,
  className,
  style,
  loadingFallback,
  errorFallback,
  ...options
}: ConnectedBillStatusProps): ReactElement | null {
  const status = useBillStatus(options);
  if (status.isLoading && !status.data) {
    return <>{loadingFallback ?? <div role="status">Loading bill status…</div>}</>;
  }
  if (status.error && !status.data) {
    return <>{errorFallback?.(status.error, status.refresh) ?? (
      <div role="alert">
        {status.error.message}{" "}
        <button type="button" onClick={() => void status.refresh()}>Retry</button>
      </div>
    )}</>;
  }
  if (!status.data) return null;
  return <BillStatusSummary
    status={status.data.state}
    submittedAt={status.data.submittedAt}
    agingDays={status.data.agingDays}
    updatedAt={status.data.updatedAt}
    totalCharge={status.data.totalCharge}
    totalPaid={status.data.totalPaid}
    balanceDue={status.data.balanceDue}
    {...(actions ? { actions } : {})}
    {...(appearance ? { appearance } : {})}
    {...(className ? { className } : {})}
    {...(style ? { style } : {})}
  />;
}
