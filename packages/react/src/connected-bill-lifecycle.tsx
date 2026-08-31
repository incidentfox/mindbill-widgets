"use client";

import type { MindBillReactAppearance } from "./appearance";
import { mindBillAppearanceStyle } from "./appearance";
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
  BillStatusSummary,
  type BillReviewAttachment,
  type BillSubmissionRoute,
} from "./native-bill-review";
import {
  BillActivityTimeline,
  BillLifecycleProgress,
  BillPaymentLedger,
  BillPayerContactCard,
  BillRemittanceCard,
  BillSnapshotSummary,
} from "./bill-lifecycle-surfaces";
import {
  DEFAULT_API_BASE_URL,
  DEFAULT_SESSION_ENDPOINT,
  createBillLifecycleClient,
  type BillEorDocument,
  type BillLifecycleClient,
  type BillLifecycleClientOptions,
  type BillLifecycleData,
  type BillLifecycleActionId,
  type CloseBillInput,
  type PostBillPaymentInput,
  type SubmitSecondReviewInput,
} from "@mindbill/browser";
export { createBillLifecycleClient } from "@mindbill/browser";
export type {
  BillEorDocument,
  BillActivityRecord,
  BillLifecycleAction,
  BillLifecycleActionId,
  BillLifecycleClient,
  BillLifecycleClientOptions,
  BillLifecycleData,
  BillLifecycleDelivery,
  BillLifecycleSession,
  BillLifecycleSessionProvider,
  BillLifecycleSessionRequest,
  BrowserBillAddress,
  BillPaymentRecord,
  BillRemittanceSummary,
  CloseBillInput,
  PostBillPaymentInput,
  SubmitSecondReviewInput,
} from "@mindbill/browser";

const DEFAULT_REFRESH_INTERVAL = 60_000;

export type UseBillLifecycleOptions = BillLifecycleClientOptions & {
  refreshInterval?: number;
  enabled?: boolean;
  initialData?: BillLifecycleData | null;
};

export type UseBillLifecycleResult = {
  billId: string;
  data: BillLifecycleData | null;
  error: Error | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isMutating: boolean;
  refresh: () => Promise<void>;
  searchClaimsAdministrators: BillLifecycleClient["searchClaimsAdministrators"];
  getDeliveryOptions: BillLifecycleClient["getDeliveryOptions"];
  openAttachment: (attachment: BillReviewAttachment) => Promise<void>;
  openEor: (document: BillEorDocument) => Promise<void>;
  closeBill: BillLifecycleClient["closeBill"];
  postPayment: BillLifecycleClient["postPayment"];
  submitSecondReview: BillLifecycleClient["submitSecondReview"];
};

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
  fetch: fetchOverride,
}: UseBillLifecycleOptions): UseBillLifecycleResult {
  const billId = providedBillId;
  const [data, setData] = useState<BillLifecycleData | null>(initialData);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(enabled && !initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    setData(initialData);
    setError(null);
  }, [initialData, providedBillId]);

  const client = useMemo(() => createBillLifecycleClient({
    billId: providedBillId,
    sessionEndpoint,
    getSession,
    apiBaseUrl,
    fetch: fetchOverride,
  }), [apiBaseUrl, fetchOverride, getSession, providedBillId, sessionEndpoint]);

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
        : new Error("The billing service could not complete this request.");
      if (mounted.current) setError(nextError);
      throw nextError;
    } finally {
      if (mounted.current) setIsMutating(false);
    }
  }, []);

  const searchClaimsAdministrators = useCallback(
    (query: string, claimNumber?: string) =>
      client.searchClaimsAdministrators(query, claimNumber),
    [client],
  );
  const getDeliveryOptions = useCallback(
    () => client.getDeliveryOptions(),
    [client],
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
    searchClaimsAdministrators,
    getDeliveryOptions,
    openAttachment,
    openEor,
    closeBill,
    postPayment,
    submitSecondReview,
  };
}

export type ConnectedBillLifecycleProps = UseBillLifecycleOptions & {
  appearance?: MindBillReactAppearance;
  className?: string;
  style?: CSSProperties;
  loadingFallback?: ReactNode;
  errorFallback?: (error: Error, retry: () => Promise<void>) => ReactNode;
  onChanged?: (data: BillLifecycleData) => void;
};

type Panel = "" | "second_review" | "payment" | "close";

function LifecycleDialog({
  children,
  title,
  onClose,
}: {
  children: ReactNode;
  title: string;
  onClose: () => void;
}): ReactElement {
  const dialog = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [onClose]);
  return <div className="mb-lifecycle-dialog-backdrop" onMouseDown={(event) => {
    if (event.currentTarget === event.target) onClose();
  }}>
    <div ref={dialog} className="mb-lifecycle-dialog" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
      <button type="button" className="mb-lifecycle-dialog-close" aria-label="Close" onClick={onClose}>×</button>
      {children}
    </div>
  </div>;
}

function dateInputValue(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
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
  const closePanel = useCallback(() => setPanel(""), []);

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
    .filter((action) => action.id !== "view_eor" && action.id !== "independent_bill_review")
    .map((action) => ({
      ...action,
      onClick: () => {
        if (!action.enabled) return;
        if (action.id === "second_review") selectPanel("second_review");
        if (action.id === "post_payment") selectPanel("payment");
        if (action.id === "close") selectPanel("close");
      },
      disabled: !action.enabled || lifecycle.isMutating,
    }));

  return <section className={["mb-connected-lifecycle", className].filter(Boolean).join(" ")} style={mindBillAppearanceStyle(appearance, style)}>
    <style>{CONNECTED_LIFECYCLE_STYLES}</style>
    <style>{CONNECTED_THEME_OVERRIDE_STYLES}</style>
    <BillLifecycleProgress
      state={data.lifecycle.state}
      nativeStatus={data.lifecycle.nativeStatus}
      submittedAt={data.lifecycle.submittedAt ?? null}
      agingDays={data.lifecycle.agingDays ?? null}
      {...(appearance ? { appearance } : {})}
    />
    <BillSnapshotSummary
      bill={data.bill}
      patient={data.patient}
      injury={data.injury}
      delivery={data.delivery}
      {...(appearance ? { appearance } : {})}
    />

    <BillStatusSummary
      status={data.lifecycle.state}
      submittedAt={data.lifecycle.submittedAt ?? null}
      agingDays={data.lifecycle.agingDays ?? null}
      updatedAt={data.lifecycle.updatedAt ?? null}
      totalCharge={data.bill.totalCharge}
      totalPaid={data.bill.totalPaid}
      balanceDue={data.bill.balanceDue}
      actions={actionButtons}
      {...(appearance ? { appearance } : {})}
    />

    <div className="mb-lifecycle-toolbar">
      <div>
        <strong>Bill #{data.bill.billNumber}</strong>
        <span>{lifecycle.isRefreshing ? "Refreshing…" : "Status and actions update automatically."}</span>
      </div>
      <div className="mb-lifecycle-toolbar-actions">
        {has("view_eor") ? <button type="button" className="mb-lifecycle-button secondary" onClick={() => document.getElementById(`mb-eors-${data.bill.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>View EOR</button> : null}
        {has("close") ? <button type="button" className="mb-lifecycle-button quiet" onClick={() => selectPanel("close")}>Close bill</button> : null}
      </div>
    </div>

    {data.eors.length ? <section className="mb-lifecycle-card" id={`mb-eors-${data.bill.id}`}>
      <header><div><h3>Explanation of Review</h3><p>Review the payer response and original PDF before posting payment.</p></div><span>{data.eors.length} PDF{data.eors.length === 1 ? "" : "s"}</span></header>
      <ul className="mb-lifecycle-documents">{data.eors.map((eor) => <li key={eor.id}><div><strong>{eor.filename}</strong><span>{eor.description || `Added ${new Date(eor.addedAt).toLocaleDateString()}`}</span></div><button type="button" className="mb-lifecycle-button secondary" onClick={() => void lifecycle.openEor(eor).catch(() => undefined)}>View PDF</button></li>)}</ul>
    </section> : null}

    <div className="mb-lifecycle-detail-grid">
      <BillRemittanceCard remittance={data.remittance} {...(appearance ? { appearance } : {})} />
      <BillPayerContactCard delivery={data.delivery} {...(appearance ? { appearance } : {})} />
      <BillPaymentLedger payments={data.payments} {...(appearance ? { appearance } : {})} />
    </div>

    <BillActivityTimeline events={data.activity} {...(appearance ? { appearance } : {})} />

    {has("independent_bill_review") ? <div className="mb-lifecycle-info"><strong>{has("independent_bill_review")?.label}</strong><span>{has("independent_bill_review")?.reason}</span></div> : null}

    {panel === "second_review" ? <LifecycleDialog title="Submit Second Review" onClose={closePanel}><section className="mb-lifecycle-panel wide">
      <div><h3>Submit Second Review</h3><p>State why payment is disputed, confirm the payer control number, and choose the supporting documents to send.</p></div>
      <div className="mb-lifecycle-fields two">
        <label><span>Reason for Second Review</span><textarea required value={review.reason} onChange={(event) => setReview((current) => ({ ...current, reason: event.target.value }))} /></label>
        <div className="mb-lifecycle-fields">
          <label><span>Payer claim control number</span><input required value={review.payerClaimControlNumber} onChange={(event) => setReview((current) => ({ ...current, payerClaimControlNumber: event.target.value }))} /></label>
          <label><span>Disputed amount</span><input type="number" min="0.01" step="0.01" value={review.disputedAmount ?? ""} onChange={(event) => setReview((current) => ({ ...current, disputedAmount: event.target.value ? Number(event.target.value) : undefined }))} /></label>
          <label><span>Send via</span><select value={review.route} onChange={(event) => setReview((current) => ({ ...current, route: event.target.value as BillSubmissionRoute }))}><option value="ebill">E-bill</option><option value="fax">Fax</option><option value="mail">Mail</option><option value="email">Email</option></select></label>
        </div>
      </div>
      <fieldset className="mb-lifecycle-packet"><legend>Supporting packet</legend>{data.bill.attachments.map((attachment) => <label key={attachment.id}><input type="checkbox" checked={review.attachmentIds.includes(attachment.id)} onChange={(event) => setReview((current) => ({ ...current, attachmentIds: event.target.checked ? [...current.attachmentIds, attachment.id] : current.attachmentIds.filter((id) => id !== attachment.id) }))} /><span><strong>{attachment.filename}</strong><small>{attachment.description || attachment.documentType}</small></span><button type="button" onClick={() => void lifecycle.openAttachment(attachment).catch(() => undefined)}>View</button></label>)}</fieldset>
      <div className="mb-lifecycle-panel-actions"><button type="button" className="mb-lifecycle-button secondary" onClick={closePanel}>Cancel</button><button type="button" className="mb-lifecycle-button primary" disabled={lifecycle.isMutating || !review.reason.trim() || !review.payerClaimControlNumber.trim()} onClick={() => void complete("Second Review submitted.", () => lifecycle.submitSecondReview(review))}>{lifecycle.isMutating ? "Submitting…" : "Submit Second Review"}</button></div>
    </section></LifecycleDialog> : null}

    {panel === "payment" ? <LifecycleDialog title="Post payment" onClose={closePanel}><section className="mb-lifecycle-panel">
      <div><h3>Post payment</h3><p>Record funds shown on the EOR. The balance updates and the bill closes automatically when configured.</p></div>
      <div className="mb-lifecycle-fields two">
        <label><span>Amount</span><input type="number" min="0.01" max={data.bill.balanceDue} step="0.01" required value={payment.amount || ""} onChange={(event) => setPayment((current) => ({ ...current, amount: Number(event.target.value) }))} /></label>
        <label><span>Method</span><select value={payment.method} onChange={(event) => setPayment((current) => ({ ...current, method: event.target.value as "check" | "eft" }))}><option value="check">Check</option><option value="eft">EFT</option></select></label>
        <label><span>{payment.method === "check" ? "Check number" : "EFT reference"}</span><input value={payment.checkNumber} onChange={(event) => setPayment((current) => ({ ...current, checkNumber: event.target.value }))} /></label>
        <label><span>Deposit date</span><input type="date" required value={payment.depositDate} onChange={(event) => setPayment((current) => ({ ...current, depositDate: event.target.value }))} /></label>
        <label className="full"><span>Note <small>Optional</small></span><input value={payment.note} onChange={(event) => setPayment((current) => ({ ...current, note: event.target.value }))} /></label>
      </div>
      <div className="mb-lifecycle-panel-actions"><button type="button" className="mb-lifecycle-button secondary" onClick={closePanel}>Cancel</button><button type="button" className="mb-lifecycle-button primary" disabled={lifecycle.isMutating || payment.amount <= 0 || payment.amount > data.bill.balanceDue || !payment.depositDate} onClick={() => void complete("Payment posted.", () => lifecycle.postPayment(payment))}>{lifecycle.isMutating ? "Posting…" : "Post payment"}</button></div>
    </section></LifecycleDialog> : null}

    {panel === "close" ? <LifecycleDialog title="Close bill" onClose={closePanel}><section className="mb-lifecycle-panel danger">
      <div><h3>Close bill</h3><p>Closing removes this bill from active A/R. Any remaining balance will be written off and the original lifecycle is preserved.</p></div>
      <label><span>Reason for closing</span><textarea required value={closeReason} onChange={(event) => setCloseReason(event.target.value)} /></label>
      <div className="mb-lifecycle-panel-actions"><button type="button" className="mb-lifecycle-button secondary" onClick={closePanel}>Cancel</button><button type="button" className="mb-lifecycle-button danger" disabled={lifecycle.isMutating || !closeReason.trim()} onClick={() => void complete("Bill closed.", () => lifecycle.closeBill({ reason: closeReason }))}>{lifecycle.isMutating ? "Closing…" : "Close bill"}</button></div>
    </section></LifecycleDialog> : null}

    {notice ? <div className="mb-lifecycle-message success" role="status">{notice}</div> : null}
    {lifecycle.error ? <div className="mb-lifecycle-message error" role="alert">{lifecycle.error.message}</div> : null}
  </section>;
}

const CONNECTED_LIFECYCLE_STYLES = `
.mb-connected-lifecycle{--mb-accent:#238dbd;--mb-text:#203743;--mb-muted:#657982;--mb-border:#dbe6ea;--mb-soft:#f3f8fa;--mb-surface:#fff;display:grid;gap:14px;color:var(--mb-text);font:14px/1.45 var(--mb-font,Inter,ui-sans-serif,system-ui,sans-serif)}.mb-connected-lifecycle *{box-sizing:border-box}.mb-lifecycle-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.mb-lifecycle-detail-grid>*:last-child:nth-child(odd){grid-column:1/-1}.mb-lifecycle-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 14px;border:1px solid var(--mb-border);border-radius:10px;background:var(--mb-surface)}.mb-lifecycle-toolbar>div:first-child{display:grid;gap:2px}.mb-lifecycle-toolbar span,.mb-lifecycle-card p,.mb-lifecycle-panel p,.mb-lifecycle-info span{color:var(--mb-muted)}.mb-lifecycle-toolbar-actions,.mb-lifecycle-panel-actions{display:flex;justify-content:flex-end;gap:8px}.mb-lifecycle-button{min-height:38px;border:1px solid var(--mb-border);border-radius:8px;background:#fff;color:var(--mb-text);cursor:pointer;font:inherit;font-weight:750;padding:8px 13px}.mb-lifecycle-button.primary{border-color:var(--mb-accent);background:var(--mb-accent);color:#fff}.mb-lifecycle-button.quiet{border-color:transparent;background:transparent;color:var(--mb-muted)}.mb-lifecycle-button.danger{border-color:#b63d35;background:#b63d35;color:#fff}.mb-lifecycle-button:disabled{cursor:not-allowed;opacity:.5}.mb-lifecycle-card,.mb-lifecycle-panel{padding:18px;border:1px solid var(--mb-border);border-radius:12px;background:var(--mb-surface)}.mb-lifecycle-card header{display:flex;align-items:start;justify-content:space-between;gap:16px}.mb-lifecycle-card h3,.mb-lifecycle-panel h3{margin:0;font-size:18px}.mb-lifecycle-card p,.mb-lifecycle-panel p{margin:3px 0 0}.mb-lifecycle-card header>span{padding:5px 8px;border-radius:999px;background:var(--mb-soft);color:var(--mb-muted);font-size:11px;font-weight:800;text-transform:uppercase}.mb-lifecycle-documents{list-style:none;margin:12px 0 0;padding:0}.mb-lifecycle-documents li{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:11px 0;border-top:1px solid var(--mb-border)}.mb-lifecycle-documents li>div{display:grid}.mb-lifecycle-documents span{color:var(--mb-muted);font-size:12px}.mb-lifecycle-info{display:grid;gap:3px;padding:13px 15px;border:1px solid #cddfe5;border-radius:10px;background:var(--mb-soft)}.mb-lifecycle-dialog-backdrop{position:fixed;z-index:2147483000;inset:0;display:grid;place-items:center;padding:20px;background:rgba(18,35,43,.56);backdrop-filter:blur(3px)}.mb-lifecycle-dialog{position:relative;width:min(760px,100%);max-height:calc(100vh - 40px);overflow:auto;outline:0}.mb-lifecycle-dialog-close{position:absolute;z-index:1;top:12px;right:12px;width:34px;height:34px;border:1px solid var(--mb-border);border-radius:8px;background:var(--mb-surface);color:var(--mb-text);cursor:pointer;font:22px/1 inherit}.mb-lifecycle-panel{display:grid;gap:16px;padding-top:24px;box-shadow:0 24px 70px rgba(18,35,43,.22)}.mb-lifecycle-panel.danger{border-color:#ecc5c2}.mb-lifecycle-panel label{display:grid;gap:6px;font-size:12px;font-weight:750}.mb-lifecycle-panel label small{color:var(--mb-muted);font-size:inherit;font-weight:500}.mb-lifecycle-panel input,.mb-lifecycle-panel select,.mb-lifecycle-panel textarea,.mb-lifecycle-upload input,.mb-lifecycle-upload select{width:100%;min-height:42px;border:1px solid var(--mb-border);border-radius:8px;background:#fff;color:var(--mb-text);font:inherit;padding:9px 11px}.mb-lifecycle-panel textarea{min-height:100px;resize:vertical}.mb-lifecycle-fields{display:grid;gap:12px}.mb-lifecycle-fields.two{grid-template-columns:repeat(2,minmax(0,1fr))}.mb-lifecycle-fields .full{grid-column:1/-1}.mb-lifecycle-packet{display:grid;gap:0;margin:0;padding:0;border:0}.mb-lifecycle-packet legend{margin-bottom:7px;font-size:12px;font-weight:800}.mb-lifecycle-packet>label{display:grid;grid-template-columns:auto 1fr auto auto;align-items:center;gap:10px;padding:10px 2px;border-top:1px solid var(--mb-border)}.mb-lifecycle-packet>label>input{width:16px;min-height:16px}.mb-lifecycle-packet>label>span{display:grid}.mb-lifecycle-packet button{border:0;background:transparent;color:var(--mb-accent);cursor:pointer;font:inherit}.mb-lifecycle-upload{display:grid;grid-template-columns:220px 1fr auto;align-items:end;gap:10px;padding:12px;border-radius:9px;background:var(--mb-soft)}.mb-lifecycle-message,.mb-lifecycle-error,.mb-lifecycle-loading{padding:12px 14px;border-radius:9px}.mb-lifecycle-message.success{background:#edf9f2;color:#217449}.mb-lifecycle-message.error,.mb-lifecycle-error{background:#fff0ef;color:#9d3029}.mb-lifecycle-error{display:flex;align-items:center;gap:12px}.mb-lifecycle-error span{flex:1}.mb-lifecycle-error button{border:1px solid currentColor;border-radius:7px;background:transparent;color:inherit;padding:7px 10px}@media(max-width:760px){.mb-lifecycle-detail-grid{grid-template-columns:1fr}.mb-lifecycle-detail-grid>*:last-child:nth-child(odd){grid-column:auto}.mb-lifecycle-toolbar,.mb-lifecycle-card header{align-items:stretch;flex-direction:column}.mb-lifecycle-toolbar-actions,.mb-lifecycle-panel-actions{justify-content:start}.mb-lifecycle-fields.two,.mb-lifecycle-upload{grid-template-columns:1fr}.mb-lifecycle-documents li{align-items:start}.mb-lifecycle-packet>label{grid-template-columns:auto 1fr auto}.mb-lifecycle-dialog-backdrop{align-items:end;padding:0}.mb-lifecycle-dialog{max-height:92vh}.mb-lifecycle-dialog .mb-lifecycle-panel{border-radius:18px 18px 0 0}.mb-lifecycle-packet>label>button:last-child{grid-column:3}}
`;

const CONNECTED_THEME_OVERRIDE_STYLES = `
.mb-connected-lifecycle{color:var(--mb-text);font-family:var(--mb-font,Inter,ui-sans-serif,system-ui,sans-serif)}
.mb-lifecycle-toolbar,.mb-lifecycle-card,.mb-lifecycle-panel{border-color:var(--mb-border);border-radius:var(--mb-radius);background:var(--mb-surface)}
.mb-lifecycle-panel{box-shadow:var(--mb-shadow)}
.mb-lifecycle-toolbar span,.mb-lifecycle-card p,.mb-lifecycle-panel p,.mb-lifecycle-info span{color:var(--mb-muted)}
.mb-lifecycle-button{border-color:var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-input);color:var(--mb-text)}
.mb-lifecycle-button.primary{border-color:var(--mb-accent);background:var(--mb-accent);color:var(--mb-accent-contrast)}
.mb-lifecycle-button.primary:hover{filter:brightness(.96)}
.mb-lifecycle-button.danger{border-color:var(--mb-danger);background:var(--mb-danger);color:white}
.mb-lifecycle-card header>span,.mb-lifecycle-info,.mb-lifecycle-upload{background:var(--mb-soft)}
.mb-lifecycle-info,.mb-lifecycle-panel input,.mb-lifecycle-panel select,.mb-lifecycle-panel textarea,.mb-lifecycle-upload input,.mb-lifecycle-upload select{border-color:var(--mb-border);border-radius:var(--mb-control-radius)}
.mb-lifecycle-panel input,.mb-lifecycle-panel select,.mb-lifecycle-panel textarea,.mb-lifecycle-upload input,.mb-lifecycle-upload select{background:var(--mb-input);color:var(--mb-text)}
.mb-lifecycle-message,.mb-lifecycle-error,.mb-lifecycle-loading,.mb-lifecycle-upload{border-radius:var(--mb-control-radius)}
.mb-lifecycle-message.success{background:color-mix(in srgb,var(--mb-success) 10%,white);color:var(--mb-success)}
.mb-lifecycle-message.error,.mb-lifecycle-error{background:color-mix(in srgb,var(--mb-danger) 10%,white);color:var(--mb-danger)}
`;
