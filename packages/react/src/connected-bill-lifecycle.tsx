"use client";

import type { MindBillAppearance } from "@mindbill/embed";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  BillReviewForm,
  BillStatusSummary,
  type BillReviewAttachment,
  type BillReviewData,
  type BillReviewDocumentType,
  type BillReviewSaveInput,
  type BillSubmissionRoute,
} from "./native-bill-review";

const DEFAULT_API_BASE_URL = "https://app.mindbill.org";
const DEFAULT_SESSION_ENDPOINT = "/api/mindbill/bill-session";
const DEFAULT_REFRESH_INTERVAL = 60_000;

export type BillLifecycleActionId =
  | "edit_and_submit"
  | "correct_and_resubmit"
  | "second_review"
  | "independent_bill_review"
  | "view_eor"
  | "post_payment"
  | "close";

export type BillLifecycleAction = {
  id: BillLifecycleActionId;
  label: string;
  enabled: boolean;
  primary?: boolean;
  reason?: string;
};

export type BillEorDocument = {
  id: string;
  filename: string;
  description: string | null;
  addedAt: string;
  contentUrl: string;
};

export type BillLifecycleData = BillReviewData & {
  lifecycle: {
    state: string;
    nativeStatus: string;
    submittedAt?: string | null;
    agingDays?: number | null;
    updatedAt?: string | null;
    actions: BillLifecycleAction[];
  };
  eors: BillEorDocument[];
};

export type BillLifecycleSession = {
  token: string;
  expiresAt?: string;
  apiBaseUrl?: string;
};

export type BillLifecycleSessionRequest = {
  billId: string;
  component: "bill-review";
  signal: AbortSignal;
};

export type BillLifecycleSessionProvider = (
  request: BillLifecycleSessionRequest,
) => Promise<BillLifecycleSession>;

export type CloseBillInput = { reason: string };
export type PostBillPaymentInput = {
  amount: number;
  method: "check" | "eft";
  checkNumber?: string;
  depositDate: string;
  note?: string;
};
export type SubmitSecondReviewInput = {
  reason: string;
  payerClaimControlNumber: string;
  disputedAmount: number | undefined;
  attachmentIds: string[];
  route: BillSubmissionRoute;
};

export type BillLifecycleClientOptions = {
  billId: string;
  /** Same-origin server route that mints a short-lived, bill-scoped session. */
  sessionEndpoint?: string | undefined;
  /** Advanced escape hatch for a custom session exchange. */
  getSession?: BillLifecycleSessionProvider | undefined;
  apiBaseUrl?: string | undefined;
  fetch?: typeof globalThis.fetch | undefined;
};

export type BillLifecycleClient = {
  getLifecycle: (signal?: AbortSignal) => Promise<BillLifecycleData>;
  saveReview: (input: BillReviewSaveInput) => Promise<BillLifecycleData>;
  submitBill: (
    input: BillReviewSaveInput,
    route: BillSubmissionRoute,
  ) => Promise<BillLifecycleData>;
  addAttachment: (
    file: File,
    documentType: BillReviewDocumentType,
    description?: string,
  ) => Promise<BillLifecycleData>;
  removeAttachment: (attachmentId: string) => Promise<BillLifecycleData>;
  getAttachment: (attachmentId: string) => Promise<Blob>;
  getEor: (documentId: string) => Promise<Blob>;
  closeBill: (input: CloseBillInput) => Promise<BillLifecycleData>;
  postPayment: (input: PostBillPaymentInput) => Promise<BillLifecycleData>;
  submitSecondReview: (
    input: SubmitSecondReviewInput,
  ) => Promise<BillLifecycleData>;
  startCorrection: () => Promise<{
    replacementBillId: string;
    data: BillLifecycleData;
  }>;
  clearSession: () => void;
};

export type UseBillLifecycleOptions = BillLifecycleClientOptions & {
  refreshInterval?: number;
  enabled?: boolean;
  initialData?: BillLifecycleData | null;
  onBillIdChange?: (
    billId: string,
    previousBillId: string,
  ) => void | Promise<void>;
};

export type UseBillLifecycleResult = {
  billId: string;
  data: BillLifecycleData | null;
  error: Error | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isMutating: boolean;
  refresh: () => Promise<void>;
  saveReview: BillLifecycleClient["saveReview"];
  submitBill: BillLifecycleClient["submitBill"];
  addAttachment: BillLifecycleClient["addAttachment"];
  removeAttachment: BillLifecycleClient["removeAttachment"];
  openAttachment: (attachment: BillReviewAttachment) => Promise<void>;
  openEor: (document: BillEorDocument) => Promise<void>;
  closeBill: BillLifecycleClient["closeBill"];
  postPayment: BillLifecycleClient["postPayment"];
  submitSecondReview: BillLifecycleClient["submitSecondReview"];
  startCorrection: () => Promise<BillLifecycleData>;
};

async function responseError(
  response: Response,
  fallback: string,
): Promise<Error> {
  const body: unknown = await response.json().catch(() => null);
  const detail = body && typeof body === "object"
    ? (body as { detail?: unknown; message?: unknown; error?: unknown }).detail
      ?? (body as { message?: unknown }).message
      ?? (body as { error?: unknown }).error
    : null;
  return new Error(typeof detail === "string" ? detail : fallback);
}

function isSessionFresh(session: BillLifecycleSession | null): boolean {
  if (!session) return false;
  if (!session.expiresAt) return true;
  const expiresAt = new Date(session.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt > Date.now() + 30_000;
}

function normalizeSession(value: unknown): BillLifecycleSession {
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
    throw new Error(
      "The MindBill session endpoint did not return a browser session token.",
    );
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

function normalizeLifecycle(value: unknown): BillLifecycleData {
  if (!value || typeof value !== "object") {
    throw new Error("MindBill returned an invalid bill lifecycle.");
  }
  const data = value as Partial<BillLifecycleData>;
  if (
    !data.bill
    || !data.patient
    || !data.injury
    || !data.lifecycle
    || !Array.isArray(data.lifecycle.actions)
    || !Array.isArray(data.eors)
  ) {
    throw new Error("MindBill returned an invalid bill lifecycle.");
  }
  return data as BillLifecycleData;
}

function idempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `mb-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Browser-safe client for the complete bill lifecycle. The only long-lived
 * secret remains on the partner server; this client uses a short-lived,
 * origin-bound session scoped to one bill.
 */
export function createBillLifecycleClient({
  billId,
  sessionEndpoint = DEFAULT_SESSION_ENDPOINT,
  getSession,
  apiBaseUrl = DEFAULT_API_BASE_URL,
  fetch: fetchOverride,
}: BillLifecycleClientOptions): BillLifecycleClient {
  const fetcher = fetchOverride ?? globalThis.fetch;
  if (typeof fetcher !== "function") {
    throw new Error("A Fetch API implementation is required.");
  }
  let session: BillLifecycleSession | null = null;
  let sessionRequest: Promise<BillLifecycleSession> | null = null;

  const mintSession = async (
    signal: AbortSignal,
    force = false,
  ): Promise<BillLifecycleSession> => {
    if (!force && isSessionFresh(session)) return session as BillLifecycleSession;
    if (!force && sessionRequest) return sessionRequest;
    const pending = getSession
      ? getSession({ billId, component: "bill-review", signal })
      : fetcher(sessionEndpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ billId, component: "bill-review" }),
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

  const request = async (
    path: string,
    init: RequestInit = {},
    providedSignal?: AbortSignal,
  ): Promise<Response> => {
    const controller = providedSignal ? null : new AbortController();
    const signal = providedSignal ?? controller?.signal;
    if (!signal) throw new Error("An AbortSignal could not be created.");
    let browserSession = await mintSession(signal);
    const perform = (current: BillLifecycleSession) => {
      const base = (current.apiBaseUrl ?? apiBaseUrl).replace(/\/$/, "");
      const headers = new Headers(init.headers);
      headers.set("authorization", `Bearer ${current.token}`);
      return fetcher(`${base}${path}`, { ...init, headers, signal });
    };
    let response = await perform(browserSession);
    if (response.status === 401) {
      session = null;
      browserSession = await mintSession(signal, true);
      response = await perform(browserSession);
    }
    return response;
  };

  const loadLifecycle = async (signal?: AbortSignal) => {
    const response = await request("/embed/api/bill-lifecycle", {}, signal);
    if (!response.ok) {
      throw await responseError(response, "Bill lifecycle could not be loaded.");
    }
    const body = await response.json() as { data?: unknown };
    return normalizeLifecycle(body.data);
  };

  const mutation = async (
    path: string,
    init: RequestInit,
    fallback: string,
  ) => {
    const headers = new Headers(init.headers);
    headers.set("idempotency-key", idempotencyKey());
    const response = await request(path, { ...init, headers });
    if (!response.ok) throw await responseError(response, fallback);
    return response;
  };

  const action = async (
    input: Record<string, unknown>,
    fallback: string,
  ): Promise<BillLifecycleData> => {
    const response = await mutation(
      "/embed/api/bill-lifecycle/actions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
      fallback,
    );
    const body = await response.json() as { data?: unknown };
    return normalizeLifecycle(body.data);
  };

  const saveReview = async (
    input: BillReviewSaveInput,
  ): Promise<BillLifecycleData> => {
    await mutation(
      "/embed/api/bill-review",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
      "Bill changes could not be saved.",
    );
    return loadLifecycle();
  };

  return {
    clearSession() {
      session = null;
      sessionRequest = null;
    },
    getLifecycle: loadLifecycle,
    saveReview,
    async submitBill(input, route) {
      await saveReview(input);
      await mutation(
        "/embed/api/bill-review/submit",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ route }),
        },
        "Bill could not be submitted.",
      );
      return loadLifecycle();
    },
    async addAttachment(file, documentType, description) {
      const body = new FormData();
      body.set("file", file);
      body.set("documentType", documentType);
      if (description) body.set("description", description);
      await mutation(
        "/embed/api/bill-review/attachments",
        { method: "POST", body },
        "Document could not be attached.",
      );
      return loadLifecycle();
    },
    async removeAttachment(attachmentId) {
      await mutation(
        `/embed/api/bill-review/attachments/${encodeURIComponent(attachmentId)}`,
        { method: "DELETE" },
        "Document could not be removed.",
      );
      return loadLifecycle();
    },
    async getAttachment(attachmentId) {
      const response = await request(
        `/embed/api/bill-review/attachments/${encodeURIComponent(attachmentId)}`,
      );
      if (!response.ok) {
        throw await responseError(response, "Document could not be opened.");
      }
      return response.blob();
    },
    async getEor(documentId) {
      const response = await request(
        `/embed/api/bill-lifecycle/eor/${encodeURIComponent(documentId)}`,
      );
      if (!response.ok) throw await responseError(response, "EOR could not be opened.");
      return response.blob();
    },
    closeBill(input) {
      return action({ action: "close", ...input }, "Bill could not be closed.");
    },
    postPayment(input) {
      return action(
        { action: "post_payment", ...input, checkNumber: input.checkNumber ?? "" },
        "Payment could not be posted.",
      );
    },
    submitSecondReview(input) {
      return action(
        { action: "second_review", ...input },
        "Second Review could not be submitted.",
      );
    },
    async startCorrection() {
      const response = await mutation(
        "/embed/api/bill-lifecycle/actions",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "start_correction" }),
        },
        "Correction draft could not be created.",
      );
      const body = await response.json() as {
        replacementBillId?: unknown;
        data?: unknown;
      };
      if (typeof body.replacementBillId !== "string") {
        throw new Error("MindBill did not return the correction bill ID.");
      }
      return {
        replacementBillId: body.replacementBillId,
        data: normalizeLifecycle(body.data),
      };
    },
  };
}

function openPdf(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function useBillLifecycle({
  billId: providedBillId,
  sessionEndpoint = DEFAULT_SESSION_ENDPOINT,
  getSession,
  apiBaseUrl = DEFAULT_API_BASE_URL,
  refreshInterval = DEFAULT_REFRESH_INTERVAL,
  enabled = true,
  initialData = null,
  onBillIdChange,
  fetch: fetchOverride,
}: UseBillLifecycleOptions): UseBillLifecycleResult {
  const [billId, setBillId] = useState(providedBillId);
  const [data, setData] = useState<BillLifecycleData | null>(initialData);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(enabled && !initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    setBillId(providedBillId);
    setData(initialData);
    setError(null);
  }, [initialData, providedBillId]);

  const client = useMemo(() => createBillLifecycleClient({
    billId,
    sessionEndpoint,
    getSession,
    apiBaseUrl,
    fetch: fetchOverride,
  }), [apiBaseUrl, billId, fetchOverride, getSession, sessionEndpoint]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      client.clearSession();
    };
  }, [client]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setIsRefreshing(true);
    try {
      const next = await client.getLifecycle();
      if (!mounted.current) return;
      setData(next);
      setError(null);
    } catch (cause) {
      if (!mounted.current) return;
      setError(cause instanceof Error ? cause : new Error("Bill could not be loaded."));
    } finally {
      if (mounted.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [client, enabled]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const interval = refreshInterval > 0
      ? window.setInterval(() => void refresh(), refreshInterval)
      : null;
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      if (interval) window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, refresh, refreshInterval]);

  const mutate = useCallback(async <T extends BillLifecycleData,>(
    task: () => Promise<T>,
  ): Promise<T> => {
    setIsMutating(true);
    setError(null);
    try {
      const next = await task();
      if (mounted.current) setData(next);
      return next;
    } catch (cause) {
      const nextError = cause instanceof Error
        ? cause
        : new Error("MindBill could not complete this request.");
      if (mounted.current) setError(nextError);
      throw nextError;
    } finally {
      if (mounted.current) setIsMutating(false);
    }
  }, []);

  const saveReview = useCallback(
    (input: BillReviewSaveInput) => mutate(() => client.saveReview(input)),
    [client, mutate],
  );
  const submitBill = useCallback(
    (input: BillReviewSaveInput, route: BillSubmissionRoute) =>
      mutate(() => client.submitBill(input, route)),
    [client, mutate],
  );
  const addAttachment = useCallback(
    (file: File, type: BillReviewDocumentType, description?: string) =>
      mutate(() => client.addAttachment(file, type, description)),
    [client, mutate],
  );
  const removeAttachment = useCallback(
    (attachmentId: string) => mutate(() => client.removeAttachment(attachmentId)),
    [client, mutate],
  );
  const closeBill = useCallback(
    (input: CloseBillInput) => mutate(() => client.closeBill(input)),
    [client, mutate],
  );
  const postPayment = useCallback(
    (input: PostBillPaymentInput) => mutate(() => client.postPayment(input)),
    [client, mutate],
  );
  const submitSecondReview = useCallback(
    (input: SubmitSecondReviewInput) =>
      mutate(() => client.submitSecondReview(input)),
    [client, mutate],
  );
  const startCorrection = useCallback(async () => {
    setIsMutating(true);
    setError(null);
    try {
      const result = await client.startCorrection();
      const previousBillId = billId;
      await onBillIdChange?.(result.replacementBillId, previousBillId);
      setBillId(result.replacementBillId);
      setData(result.data);
      return result.data;
    } catch (cause) {
      const nextError = cause instanceof Error
        ? cause
        : new Error("Correction draft could not be created.");
      setError(nextError);
      throw nextError;
    } finally {
      setIsMutating(false);
    }
  }, [billId, client, onBillIdChange]);
  const openAttachment = useCallback(async (attachment: BillReviewAttachment) => {
    openPdf(await client.getAttachment(attachment.id), attachment.filename);
  }, [client]);
  const openEor = useCallback(async (document: BillEorDocument) => {
    openPdf(await client.getEor(document.id), document.filename);
  }, [client]);

  return {
    billId,
    data,
    error,
    isLoading,
    isRefreshing,
    isMutating,
    refresh,
    saveReview,
    submitBill,
    addAttachment,
    removeAttachment,
    openAttachment,
    openEor,
    closeBill,
    postPayment,
    submitSecondReview,
    startCorrection,
  };
}

export type ConnectedBillLifecycleProps = UseBillLifecycleOptions & {
  appearance?: MindBillAppearance;
  className?: string;
  style?: CSSProperties;
  loadingFallback?: ReactNode;
  errorFallback?: (error: Error, retry: () => Promise<void>) => ReactNode;
  onChanged?: (data: BillLifecycleData) => void;
};

type Panel = "" | "correction" | "second_review" | "payment" | "close";

function dateInputValue(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function appearanceStyle(
  appearance: MindBillAppearance | undefined,
  style: CSSProperties | undefined,
): CSSProperties {
  return {
    ...(appearance?.accentColor ? { "--mb-accent": appearance.accentColor } : {}),
    ...(appearance?.textColor ? { "--mb-text": appearance.textColor } : {}),
    ...(appearance?.mutedColor ? { "--mb-muted": appearance.mutedColor } : {}),
    ...(appearance?.borderColor ? { "--mb-border": appearance.borderColor } : {}),
    ...(appearance?.backgroundColor ? { "--mb-soft": appearance.backgroundColor } : {}),
    ...(appearance?.surfaceColor ? { "--mb-surface": appearance.surfaceColor } : {}),
    ...(appearance?.fontFamily ? { "--mb-font": appearance.fontFamily } : {}),
    ...style,
  } as CSSProperties;
}

function SupportingDocumentControl({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (
    file: File,
    type: BillReviewDocumentType,
    description?: string,
  ) => Promise<unknown>;
}): ReactElement {
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<BillReviewDocumentType>("appeal");
  const [busy, setBusy] = useState(false);
  return <div className="mb-lifecycle-upload">
    <select aria-label="Supporting document type" value={type} disabled={disabled || busy} onChange={(event) => setType(event.target.value as BillReviewDocumentType)}>
      <option value="appeal">Second Review support</option>
      <option value="final_report">Final report</option>
      <option value="proof_of_service">Proof of service</option>
      <option value="letter_of_attestation">Letter of attestation</option>
      <option value="form_122">DWC Form 122</option>
      <option value="w9">W-9</option>
      <option value="other">Other supporting document</option>
    </select>
    <input aria-label="Choose supporting PDF" type="file" accept="application/pdf,.pdf" disabled={disabled || busy} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
    <button type="button" className="mb-lifecycle-button secondary" disabled={disabled || busy || !file} onClick={() => {
      if (!file) return;
      setBusy(true);
      void onAdd(file, type)
        .then(() => setFile(null))
        .catch(() => undefined)
        .finally(() => setBusy(false));
    }}>{busy ? "Attaching…" : "Attach PDF"}</button>
  </div>;
}

export function ConnectedBillLifecycle({
  appearance,
  className,
  style,
  loadingFallback,
  errorFallback,
  onChanged,
  ...options
}: ConnectedBillLifecycleProps): ReactElement {
  const lifecycle = useBillLifecycle(options);
  const { data } = lifecycle;
  const [panel, setPanel] = useState<Panel>("");
  const [notice, setNotice] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [payment, setPayment] = useState<PostBillPaymentInput>({
    amount: 0,
    method: "check",
    checkNumber: "",
    depositDate: dateInputValue(),
    note: "",
  });
  const [review, setReview] = useState<SubmitSecondReviewInput>({
    reason: "",
    payerClaimControlNumber: "",
    disputedAmount: undefined,
    attachmentIds: [],
    route: "ebill",
  });
  const lastData = useRef<BillLifecycleData | null>(null);

  useEffect(() => {
    if (!data || data === lastData.current) return;
    lastData.current = data;
    onChanged?.(data);
    setPayment((current) => ({
      ...current,
      amount: current.amount > 0 ? current.amount : data.bill.balanceDue,
    }));
    setReview((current) => ({
      ...current,
      disputedAmount: current.disputedAmount ?? data.bill.balanceDue,
      attachmentIds: current.attachmentIds.length
        ? current.attachmentIds.filter((id) => data.bill.attachments.some((doc) => doc.id === id))
        : data.bill.attachments.map((doc) => doc.id),
    }));
  }, [data, onChanged]);

  if (lifecycle.isLoading && !data) {
    return <>{loadingFallback ?? <div className="mb-lifecycle-loading">Loading billing…</div>}</>;
  }
  if (!data) {
    const error = lifecycle.error ?? new Error("Bill could not be loaded.");
    return <>{errorFallback?.(error, lifecycle.refresh) ?? <div className="mb-lifecycle-error" role="alert"><strong>Billing is unavailable.</strong><span>{error.message}</span><button type="button" onClick={() => void lifecycle.refresh()}>Try again</button></div>}</>;
  }

  const actionMap = new Map(data.lifecycle.actions.map((action) => [action.id, action]));
  const has = (id: BillLifecycleActionId) => actionMap.get(id);
  const selectPanel = (next: Panel) => {
    setNotice("");
    setPanel((current) => current === next ? "" : next);
  };
  const complete = async (message: string, task: () => Promise<unknown>) => {
    setNotice("");
    try {
      await task();
      setPanel("");
      setNotice(message);
    } catch {
      // The hook keeps the actionable error visible in this component.
    }
  };
  const actionButtons = data.lifecycle.actions
    .filter((action) => action.id !== "edit_and_submit" && action.id !== "view_eor" && action.id !== "independent_bill_review")
    .map((action) => ({
      ...action,
      onClick: () => {
        if (!action.enabled) return;
        if (action.id === "correct_and_resubmit") selectPanel("correction");
        if (action.id === "second_review") selectPanel("second_review");
        if (action.id === "post_payment") selectPanel("payment");
        if (action.id === "close") selectPanel("close");
      },
      disabled: !action.enabled || lifecycle.isMutating,
    }));

  const canEditAndSubmit = Boolean(has("edit_and_submit"));

  return <section className={["mb-connected-lifecycle", className].filter(Boolean).join(" ")} style={appearanceStyle(appearance, style)}>
    <style>{CONNECTED_LIFECYCLE_STYLES}</style>
    {canEditAndSubmit
      ? <BillReviewForm
          data={data}
          {...(appearance ? { appearance } : {})}
          disabled={lifecycle.isMutating}
          onSave={lifecycle.saveReview}
          onSubmit={async (input, route) => { await complete("Bill submitted.", () => lifecycle.submitBill(input, route)); }}
          onAddAttachment={async (file, type, description) => { await lifecycle.addAttachment(file, type, description); }}
          onRemoveAttachment={async (attachmentId) => { await lifecycle.removeAttachment(attachmentId); }}
          onOpenAttachment={(attachment) => void lifecycle.openAttachment(attachment).catch(() => undefined)}
        />
      : <BillStatusSummary
          status={data.lifecycle.state}
          submittedAt={data.lifecycle.submittedAt ?? null}
          agingDays={data.lifecycle.agingDays ?? null}
          updatedAt={data.lifecycle.updatedAt ?? null}
          totalCharge={data.bill.totalCharge}
          totalPaid={data.bill.totalPaid}
          balanceDue={data.bill.balanceDue}
          actions={actionButtons}
          {...(appearance ? { appearance } : {})}
        />}

    <div className="mb-lifecycle-toolbar">
      <div>
        <strong>Bill #{data.bill.billNumber}</strong>
        <span>{lifecycle.isRefreshing ? "Refreshing…" : "MindBill manages this lifecycle."}</span>
      </div>
      <div className="mb-lifecycle-toolbar-actions">
        {has("view_eor") ? <button type="button" className="mb-lifecycle-button secondary" onClick={() => document.getElementById(`mb-eors-${data.bill.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>View EOR</button> : null}
        {canEditAndSubmit && has("close") ? <button type="button" className="mb-lifecycle-button quiet" onClick={() => selectPanel("close")}>Close bill</button> : null}
      </div>
    </div>

    {data.eors.length ? <section className="mb-lifecycle-card" id={`mb-eors-${data.bill.id}`}>
      <header><div><h3>Explanation of Review</h3><p>Review the payer response and original PDF before posting payment.</p></div><span>{data.eors.length} PDF{data.eors.length === 1 ? "" : "s"}</span></header>
      <ul className="mb-lifecycle-documents">{data.eors.map((eor) => <li key={eor.id}><div><strong>{eor.filename}</strong><span>{eor.description || `Added ${new Date(eor.addedAt).toLocaleDateString()}`}</span></div><button type="button" className="mb-lifecycle-button secondary" onClick={() => void lifecycle.openEor(eor).catch(() => undefined)}>View PDF</button></li>)}</ul>
    </section> : null}

    {has("independent_bill_review") ? <div className="mb-lifecycle-info"><strong>{has("independent_bill_review")?.label}</strong><span>{has("independent_bill_review")?.reason}</span></div> : null}

    {panel === "correction" ? <section className="mb-lifecycle-panel">
      <div><h3>Correct and resubmit</h3><p>MindBill will create a new correction draft and preserve this rejected bill in history. Review the copied values before submitting.</p></div>
      <div className="mb-lifecycle-panel-actions"><button type="button" className="mb-lifecycle-button secondary" onClick={() => setPanel("")}>Cancel</button><button type="button" className="mb-lifecycle-button primary" disabled={lifecycle.isMutating} onClick={() => void complete("Correction draft created.", lifecycle.startCorrection)}>{lifecycle.isMutating ? "Creating…" : "Create correction draft"}</button></div>
    </section> : null}

    {panel === "second_review" ? <section className="mb-lifecycle-panel wide">
      <div><h3>Submit Second Review</h3><p>State why payment is disputed, confirm the payer control number, and choose the supporting documents MindBill should send.</p></div>
      <div className="mb-lifecycle-fields two">
        <label><span>Reason for Second Review</span><textarea required value={review.reason} onChange={(event) => setReview((current) => ({ ...current, reason: event.target.value }))} /></label>
        <div className="mb-lifecycle-fields">
          <label><span>Payer claim control number</span><input required value={review.payerClaimControlNumber} onChange={(event) => setReview((current) => ({ ...current, payerClaimControlNumber: event.target.value }))} /></label>
          <label><span>Disputed amount</span><input type="number" min="0.01" step="0.01" value={review.disputedAmount ?? ""} onChange={(event) => setReview((current) => ({ ...current, disputedAmount: event.target.value ? Number(event.target.value) : undefined }))} /></label>
          <label><span>Send via</span><select value={review.route} onChange={(event) => setReview((current) => ({ ...current, route: event.target.value as BillSubmissionRoute }))}><option value="ebill">E-bill</option><option value="fax">Fax</option><option value="mail">Mail</option><option value="email">Email</option></select></label>
        </div>
      </div>
      <fieldset className="mb-lifecycle-packet"><legend>Supporting packet</legend>{data.bill.attachments.map((attachment) => <label key={attachment.id}><input type="checkbox" checked={review.attachmentIds.includes(attachment.id)} onChange={(event) => setReview((current) => ({ ...current, attachmentIds: event.target.checked ? [...current.attachmentIds, attachment.id] : current.attachmentIds.filter((id) => id !== attachment.id) }))} /><span><strong>{attachment.filename}</strong><small>{attachment.description || attachment.documentType}</small></span><button type="button" onClick={() => void lifecycle.openAttachment(attachment).catch(() => undefined)}>View</button><button type="button" aria-label={`Remove ${attachment.filename}`} onClick={() => void lifecycle.removeAttachment(attachment.id).catch(() => undefined)}>×</button></label>)}</fieldset>
      <SupportingDocumentControl disabled={lifecycle.isMutating} onAdd={async (file, type, description) => {
        const next = await lifecycle.addAttachment(file, type, description);
        setReview((current) => ({
          ...current,
          attachmentIds: Array.from(new Set([
            ...current.attachmentIds,
            ...next.bill.attachments.map((attachment) => attachment.id),
          ])),
        }));
      }} />
      <div className="mb-lifecycle-panel-actions"><button type="button" className="mb-lifecycle-button secondary" onClick={() => setPanel("")}>Cancel</button><button type="button" className="mb-lifecycle-button primary" disabled={lifecycle.isMutating || !review.reason.trim() || !review.payerClaimControlNumber.trim()} onClick={() => void complete("Second Review submitted.", () => lifecycle.submitSecondReview(review))}>{lifecycle.isMutating ? "Submitting…" : "Submit Second Review"}</button></div>
    </section> : null}

    {panel === "payment" ? <section className="mb-lifecycle-panel">
      <div><h3>Post payment</h3><p>Record funds shown on the EOR. MindBill updates the balance and closes the bill automatically when configured.</p></div>
      <div className="mb-lifecycle-fields two">
        <label><span>Amount</span><input type="number" min="0.01" max={data.bill.balanceDue} step="0.01" required value={payment.amount || ""} onChange={(event) => setPayment((current) => ({ ...current, amount: Number(event.target.value) }))} /></label>
        <label><span>Method</span><select value={payment.method} onChange={(event) => setPayment((current) => ({ ...current, method: event.target.value as "check" | "eft" }))}><option value="check">Check</option><option value="eft">EFT</option></select></label>
        <label><span>{payment.method === "check" ? "Check number" : "EFT reference"}</span><input value={payment.checkNumber} onChange={(event) => setPayment((current) => ({ ...current, checkNumber: event.target.value }))} /></label>
        <label><span>Deposit date</span><input type="date" required value={payment.depositDate} onChange={(event) => setPayment((current) => ({ ...current, depositDate: event.target.value }))} /></label>
        <label className="full"><span>Note <small>Optional</small></span><input value={payment.note} onChange={(event) => setPayment((current) => ({ ...current, note: event.target.value }))} /></label>
      </div>
      <div className="mb-lifecycle-panel-actions"><button type="button" className="mb-lifecycle-button secondary" onClick={() => setPanel("")}>Cancel</button><button type="button" className="mb-lifecycle-button primary" disabled={lifecycle.isMutating || payment.amount <= 0 || payment.amount > data.bill.balanceDue || !payment.depositDate} onClick={() => void complete("Payment posted.", () => lifecycle.postPayment(payment))}>{lifecycle.isMutating ? "Posting…" : "Post payment"}</button></div>
    </section> : null}

    {panel === "close" ? <section className="mb-lifecycle-panel danger">
      <div><h3>Close bill</h3><p>Closing removes this bill from active A/R. Any remaining balance will be written off and the original lifecycle is preserved.</p></div>
      <label><span>Reason for closing</span><textarea required value={closeReason} onChange={(event) => setCloseReason(event.target.value)} /></label>
      <div className="mb-lifecycle-panel-actions"><button type="button" className="mb-lifecycle-button secondary" onClick={() => setPanel("")}>Cancel</button><button type="button" className="mb-lifecycle-button danger" disabled={lifecycle.isMutating || !closeReason.trim()} onClick={() => void complete("Bill closed.", () => lifecycle.closeBill({ reason: closeReason }))}>{lifecycle.isMutating ? "Closing…" : "Close bill"}</button></div>
    </section> : null}

    {notice ? <div className="mb-lifecycle-message success" role="status">{notice}</div> : null}
    {lifecycle.error ? <div className="mb-lifecycle-message error" role="alert">{lifecycle.error.message}</div> : null}
  </section>;
}

const CONNECTED_LIFECYCLE_STYLES = `
.mb-connected-lifecycle{--mb-accent:#238dbd;--mb-text:#203743;--mb-muted:#657982;--mb-border:#dbe6ea;--mb-soft:#f3f8fa;--mb-surface:#fff;display:grid;gap:14px;color:var(--mb-text);font:14px/1.45 var(--mb-font,Inter,ui-sans-serif,system-ui,sans-serif)}.mb-connected-lifecycle *{box-sizing:border-box}.mb-lifecycle-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 14px;border:1px solid var(--mb-border);border-radius:10px;background:var(--mb-surface)}.mb-lifecycle-toolbar>div:first-child{display:grid;gap:2px}.mb-lifecycle-toolbar span,.mb-lifecycle-card p,.mb-lifecycle-panel p,.mb-lifecycle-info span{color:var(--mb-muted)}.mb-lifecycle-toolbar-actions,.mb-lifecycle-panel-actions{display:flex;justify-content:flex-end;gap:8px}.mb-lifecycle-button{min-height:38px;border:1px solid var(--mb-border);border-radius:8px;background:#fff;color:var(--mb-text);cursor:pointer;font:inherit;font-weight:750;padding:8px 13px}.mb-lifecycle-button.primary{border-color:var(--mb-accent);background:var(--mb-accent);color:#fff}.mb-lifecycle-button.quiet{border-color:transparent;background:transparent;color:var(--mb-muted)}.mb-lifecycle-button.danger{border-color:#b63d35;background:#b63d35;color:#fff}.mb-lifecycle-button:disabled{cursor:not-allowed;opacity:.5}.mb-lifecycle-card,.mb-lifecycle-panel{padding:18px;border:1px solid var(--mb-border);border-radius:12px;background:var(--mb-surface)}.mb-lifecycle-card header{display:flex;align-items:start;justify-content:space-between;gap:16px}.mb-lifecycle-card h3,.mb-lifecycle-panel h3{margin:0;font-size:18px}.mb-lifecycle-card p,.mb-lifecycle-panel p{margin:3px 0 0}.mb-lifecycle-card header>span{padding:5px 8px;border-radius:999px;background:var(--mb-soft);color:var(--mb-muted);font-size:11px;font-weight:800;text-transform:uppercase}.mb-lifecycle-documents{list-style:none;margin:12px 0 0;padding:0}.mb-lifecycle-documents li{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:11px 0;border-top:1px solid var(--mb-border)}.mb-lifecycle-documents li>div{display:grid}.mb-lifecycle-documents span{color:var(--mb-muted);font-size:12px}.mb-lifecycle-info{display:grid;gap:3px;padding:13px 15px;border:1px solid #cddfe5;border-radius:10px;background:var(--mb-soft)}.mb-lifecycle-panel{display:grid;gap:16px;box-shadow:0 14px 38px rgba(30,56,68,.08)}.mb-lifecycle-panel.danger{border-color:#ecc5c2}.mb-lifecycle-panel label{display:grid;gap:6px;font-size:12px;font-weight:750}.mb-lifecycle-panel label small{color:var(--mb-muted);font-size:inherit;font-weight:500}.mb-lifecycle-panel input,.mb-lifecycle-panel select,.mb-lifecycle-panel textarea,.mb-lifecycle-upload input,.mb-lifecycle-upload select{width:100%;min-height:42px;border:1px solid var(--mb-border);border-radius:8px;background:#fff;color:var(--mb-text);font:inherit;padding:9px 11px}.mb-lifecycle-panel textarea{min-height:100px;resize:vertical}.mb-lifecycle-fields{display:grid;gap:12px}.mb-lifecycle-fields.two{grid-template-columns:repeat(2,minmax(0,1fr))}.mb-lifecycle-fields .full{grid-column:1/-1}.mb-lifecycle-packet{display:grid;gap:0;margin:0;padding:0;border:0}.mb-lifecycle-packet legend{margin-bottom:7px;font-size:12px;font-weight:800}.mb-lifecycle-packet>label{display:grid;grid-template-columns:auto 1fr auto auto;align-items:center;gap:10px;padding:10px 2px;border-top:1px solid var(--mb-border)}.mb-lifecycle-packet>label>input{width:16px;min-height:16px}.mb-lifecycle-packet>label>span{display:grid}.mb-lifecycle-packet button{border:0;background:transparent;color:var(--mb-accent);cursor:pointer;font:inherit}.mb-lifecycle-upload{display:grid;grid-template-columns:220px 1fr auto;align-items:end;gap:10px;padding:12px;border-radius:9px;background:var(--mb-soft)}.mb-lifecycle-message,.mb-lifecycle-error,.mb-lifecycle-loading{padding:12px 14px;border-radius:9px}.mb-lifecycle-message.success{background:#edf9f2;color:#217449}.mb-lifecycle-message.error,.mb-lifecycle-error{background:#fff0ef;color:#9d3029}.mb-lifecycle-error{display:flex;align-items:center;gap:12px}.mb-lifecycle-error span{flex:1}.mb-lifecycle-error button{border:1px solid currentColor;border-radius:7px;background:transparent;color:inherit;padding:7px 10px}@media(max-width:760px){.mb-lifecycle-toolbar,.mb-lifecycle-card header{align-items:stretch;flex-direction:column}.mb-lifecycle-toolbar-actions,.mb-lifecycle-panel-actions{justify-content:start}.mb-lifecycle-fields.two,.mb-lifecycle-upload{grid-template-columns:1fr}.mb-lifecycle-documents li{align-items:start}.mb-lifecycle-packet>label{grid-template-columns:auto 1fr auto}}
`;
