"use client";

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
  DEFAULT_API_BASE_URL,
  DEFAULT_SESSION_ENDPOINT,
  createBillLifecycleClient,
  type BillEorDocument,
  type BillLifecycleAction,
  type BillLifecycleClient,
  type BillLifecycleClientOptions,
  type BillLifecycleData,
  type CloseBillInput,
  type PostBillPaymentInput,
  type ReopenBillInput,
  type SubmitSecondReviewInput,
} from "@mindbill/browser";
import type { MindBillReactAppearance } from "./appearance";
import { mindBillAppearanceStyle } from "./appearance";
import { BillActivityTimeline, BillLifecycleProgress } from "./bill-lifecycle-surfaces";
import { BillReadOnlyForm } from "./bill-read-only-form";
import type { BillReviewAttachment, BillSubmissionRoute } from "./native-bill-review";

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
  ReopenBillInput,
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
  downloadPacket: () => Promise<void>;
  closeBill: BillLifecycleClient["closeBill"];
  reopenBill: BillLifecycleClient["reopenBill"];
  postPayment: BillLifecycleClient["postPayment"];
  submitSecondReview: BillLifecycleClient["submitSecondReview"];
};

function downloadBlob(blob: Blob, filename: string, open = false): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.rel = "noopener noreferrer";
  link.download = filename;
  if (open) link.target = "_blank";
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
  const [data, setData] = useState<BillLifecycleData | null>(initialData);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(enabled && !initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const mounted = useRef(true);
  const client = useMemo(() => createBillLifecycleClient({
    billId: providedBillId,
    sessionEndpoint,
    getSession,
    apiBaseUrl,
    fetch: fetchOverride,
  }), [apiBaseUrl, fetchOverride, getSession, providedBillId, sessionEndpoint]);

  useEffect(() => {
    setData(initialData);
    setError(null);
  }, [initialData, providedBillId]);

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
      if (mounted.current) setError(cause instanceof Error ? cause : new Error("Bill could not be loaded."));
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
    const interval = refreshInterval > 0 ? window.setInterval(() => void refresh(), refreshInterval) : null;
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      if (interval) window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, refresh, refreshInterval]);

  const mutate = useCallback(async (task: () => Promise<BillLifecycleData>) => {
    setIsMutating(true);
    setError(null);
    try {
      const next = await task();
      if (mounted.current) setData(next);
      return next;
    } catch (cause) {
      const nextError = cause instanceof Error ? cause : new Error("The billing service could not complete this request.");
      if (mounted.current) setError(nextError);
      throw nextError;
    } finally {
      if (mounted.current) setIsMutating(false);
    }
  }, []);

  const openAttachment = useCallback(async (attachment: BillReviewAttachment) => {
    downloadBlob(await client.getAttachment(attachment.id), attachment.filename, true);
  }, [client]);
  const openEor = useCallback(async (document: BillEorDocument) => {
    downloadBlob(await client.getEor(document.id), document.filename, true);
  }, [client]);
  const downloadPacket = useCallback(async () => {
    const packet = await client.getPacket();
    downloadBlob(packet, `mindbill-${data?.bill.billNumber ?? providedBillId}-submission-packet.pdf`);
  }, [client, data?.bill.billNumber, providedBillId]);

  return {
    billId: providedBillId,
    data,
    error,
    isLoading,
    isRefreshing,
    isMutating,
    refresh,
    searchClaimsAdministrators: (query, claimNumber) => client.searchClaimsAdministrators(query, claimNumber),
    getDeliveryOptions: () => client.getDeliveryOptions(),
    openAttachment,
    openEor,
    downloadPacket,
    closeBill: (input) => mutate(() => client.closeBill(input)),
    reopenBill: (input) => mutate(() => client.reopenBill(input)),
    postPayment: (input) => mutate(() => client.postPayment(input)),
    submitSecondReview: (input) => mutate(() => client.submitSecondReview(input)),
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

type Panel = "" | "second_review" | "payment" | "close" | "reopen";
type Tab = "details" | "history";

function LifecycleDialog({ children, title, onClose }: { children: ReactNode; title: string; onClose: () => void }): ReactElement {
  const dialog = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [onClose]);
  return <div className="mb-lifecycle-dialog-backdrop" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
    <div ref={dialog} className="mb-lifecycle-dialog" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
      <button type="button" className="mb-lifecycle-dialog-close" aria-label="Close" onClick={onClose}>×</button>{children}
    </div>
  </div>;
}

function today(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function stateLabel(state: string): string {
  return state.replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function actionPanel(action: BillLifecycleAction): Panel {
  if (action.id === "second_review") return "second_review";
  if (action.id === "post_payment") return "payment";
  if (action.id === "close") return "close";
  if (action.id === "reopen") return "reopen";
  return "";
}

export function ConnectedBillLifecycle({ appearance, className, style, loadingFallback, errorFallback, onChanged, ...options }: ConnectedBillLifecycleProps): ReactElement {
  const lifecycle = useBillLifecycle(options);
  const { data } = lifecycle;
  const [tab, setTab] = useState<Tab>("details");
  const [panel, setPanel] = useState<Panel>("");
  const [notice, setNotice] = useState("");
  const [reason, setReason] = useState("");
  const [payment, setPayment] = useState<PostBillPaymentInput>({ amount: 0, method: "check", checkNumber: "", depositDate: today(), note: "" });
  const [review, setReview] = useState<SubmitSecondReviewInput>({ reason: "", payerClaimControlNumber: "", disputedAmount: undefined, attachmentIds: [], route: "ebill" });
  const lastData = useRef<BillLifecycleData | null>(null);

  useEffect(() => {
    if (!data || data === lastData.current) return;
    lastData.current = data;
    onChanged?.(data);
    setPayment((current) => ({ ...current, amount: current.amount > 0 ? current.amount : data.bill.balanceDue }));
    setReview((current) => ({
      ...current,
      disputedAmount: current.disputedAmount ?? data.bill.balanceDue,
      attachmentIds: current.attachmentIds.length ? current.attachmentIds.filter((id) => data.bill.attachments.some((document) => document.id === id)) : data.bill.attachments.map((document) => document.id),
    }));
  }, [data, onChanged]);

  if (lifecycle.isLoading && !data) return <>{loadingFallback ?? <div className="mb-lifecycle-loading">Loading bill…</div>}</>;
  if (!data) {
    const error = lifecycle.error ?? new Error("Bill could not be loaded.");
    return <>{errorFallback?.(error, lifecycle.refresh) ?? <div className="mb-lifecycle-error" role="alert"><strong>Billing is unavailable.</strong><span>{error.message}</span><button type="button" onClick={() => void lifecycle.refresh()}>Try again</button></div>}</>;
  }

  const complete = async (message: string, task: () => Promise<unknown>) => {
    setNotice("");
    try {
      await task();
      setPanel("");
      setReason("");
      setNotice(message);
    } catch {
      // useBillLifecycle keeps the server error visible.
    }
  };
  const viewEor = data.lifecycle.actions.find((action) => action.id === "view_eor" && action.enabled);
  const supportedActions = new Set<BillLifecycleAction["id"]>(["second_review", "post_payment", "close", "reopen"]);
  const actions = data.lifecycle.actions.filter((action) => action.enabled && supportedActions.has(action.id));

  return <section className={["mb-connected-lifecycle", className].filter(Boolean).join(" ")} style={mindBillAppearanceStyle(appearance, style)}>
    <style>{CONNECTED_LIFECYCLE_STYLES}</style>
    <BillLifecycleProgress state={data.lifecycle.state} nativeStatus={data.lifecycle.nativeStatus} submittedAt={data.lifecycle.submittedAt ?? null} agingDays={data.lifecycle.agingDays ?? null} {...(appearance ? { appearance } : {})} />

    <header className="mb-lifecycle-head">
      <div><div className="mb-lifecycle-title"><h2>Bill #{data.bill.billNumber}</h2><span>{stateLabel(data.lifecycle.nativeStatus || data.lifecycle.state)}</span></div><p>Claim {data.injury.claimNumber || "—"}{lifecycle.isRefreshing ? " · Refreshing…" : ""}</p></div>
      <button type="button" className="mb-lifecycle-button primary" disabled={lifecycle.isMutating} onClick={() => void lifecycle.downloadPacket().catch(() => undefined)}>Download packet</button>
    </header>

    <div className="mb-lifecycle-tabs" role="tablist" aria-label="Bill view">
      <button type="button" role="tab" aria-selected={tab === "details"} onClick={() => setTab("details")}>Bill details</button>
      <button type="button" role="tab" aria-selected={tab === "history"} onClick={() => setTab("history")}>Bill history <span>{data.activity.length}</span></button>
    </div>

    {tab === "details" ? <div className="mb-lifecycle-tabpanel" role="tabpanel">
      <BillReadOnlyForm data={data} onOpenAttachment={lifecycle.openAttachment} {...(appearance ? { appearance } : {})} />

      {data.eors.length ? <section className="mb-lifecycle-card" id={`mb-eors-${data.bill.id}`}><header><div><h3>Explanation of Review</h3><p>The payer response associated with this immutable submission.</p></div><span>{data.eors.length}</span></header><ul className="mb-lifecycle-documents">{data.eors.map((eor) => <li key={eor.id}><div><strong>{eor.filename}</strong><span>{eor.description || `Received ${new Date(eor.addedAt).toLocaleDateString()}`}</span></div><button type="button" className="mb-lifecycle-button secondary" onClick={() => void lifecycle.openEor(eor).catch(() => undefined)}>View EOR</button></li>)}</ul></section> : null}

      {(viewEor || actions.length) ? <section className="mb-lifecycle-actions-sheet"><div><h3>{data.lifecycle.state.includes("closed") ? "This bill is closed" : data.lifecycle.state.includes("denied") || data.lifecycle.state.includes("rejected") ? "This bill needs attention" : "Available actions"}</h3><p>Actions are determined by the current bill status.</p></div><div>
        {viewEor ? <button type="button" className="mb-lifecycle-button secondary" onClick={() => document.getElementById(`mb-eors-${data.bill.id}`)?.scrollIntoView({ behavior: "smooth" })}>{viewEor.label}</button> : null}
        {actions.map((action) => <button type="button" key={action.id} className={action.primary ? "mb-lifecycle-button primary" : "mb-lifecycle-button secondary"} onClick={() => {
          const next = actionPanel(action);
          if (next) setPanel(next);
        }}>{action.label}</button>)}
      </div></section> : null}
    </div> : <div className="mb-lifecycle-tabpanel" role="tabpanel"><BillActivityTimeline events={data.activity} {...(appearance ? { appearance } : {})} /></div>}

    {panel === "second_review" ? <LifecycleDialog title="Submit Second Review" onClose={() => setPanel("")}><section className="mb-lifecycle-panel"><div><h3>Submit Second Review</h3><p>Explain the dispute and include the payer control number and supporting documents.</p></div><div className="mb-lifecycle-fields two"><label className="full"><span>Reason</span><textarea required value={review.reason} onChange={(event) => setReview((current) => ({ ...current, reason: event.target.value }))} /></label><label><span>Payer claim control number</span><input required value={review.payerClaimControlNumber} onChange={(event) => setReview((current) => ({ ...current, payerClaimControlNumber: event.target.value }))} /></label><label><span>Disputed amount</span><input type="number" min="0.01" step="0.01" value={review.disputedAmount ?? ""} onChange={(event) => setReview((current) => ({ ...current, disputedAmount: event.target.value ? Number(event.target.value) : undefined }))} /></label><label><span>Send via</span><select value={review.route} onChange={(event) => setReview((current) => ({ ...current, route: event.target.value as BillSubmissionRoute }))}><option value="ebill">E-bill</option><option value="fax">Fax</option><option value="mail">Mail</option><option value="email">Email</option></select></label></div><fieldset className="mb-lifecycle-packet"><legend>Supporting packet</legend>{data.bill.attachments.map((attachment) => <label key={attachment.id}><input type="checkbox" checked={review.attachmentIds.includes(attachment.id)} onChange={(event) => setReview((current) => ({ ...current, attachmentIds: event.target.checked ? [...current.attachmentIds, attachment.id] : current.attachmentIds.filter((id) => id !== attachment.id) }))} /><span><strong>{attachment.filename}</strong><small>{attachment.description || attachment.documentType}</small></span><button type="button" onClick={() => void lifecycle.openAttachment(attachment).catch(() => undefined)}>View</button></label>)}</fieldset><div className="mb-lifecycle-panel-actions"><button type="button" className="mb-lifecycle-button secondary" onClick={() => setPanel("")}>Cancel</button><button type="button" className="mb-lifecycle-button primary" disabled={lifecycle.isMutating || !review.reason.trim() || !review.payerClaimControlNumber.trim()} onClick={() => void complete("Second Review submitted.", () => lifecycle.submitSecondReview(review))}>{lifecycle.isMutating ? "Submitting…" : "Submit Second Review"}</button></div></section></LifecycleDialog> : null}

    {panel === "payment" ? <LifecycleDialog title="Post payment" onClose={() => setPanel("")}><section className="mb-lifecycle-panel"><div><h3>Post payment</h3><p>Record funds shown on the payer response.</p></div><div className="mb-lifecycle-fields two"><label><span>Amount</span><input type="number" min="0.01" max={data.bill.balanceDue} step="0.01" value={payment.amount || ""} onChange={(event) => setPayment((current) => ({ ...current, amount: Number(event.target.value) }))} /></label><label><span>Method</span><select value={payment.method} onChange={(event) => setPayment((current) => ({ ...current, method: event.target.value as "check" | "eft" }))}><option value="check">Check</option><option value="eft">EFT</option></select></label><label><span>{payment.method === "check" ? "Check number" : "EFT reference"}</span><input value={payment.checkNumber} onChange={(event) => setPayment((current) => ({ ...current, checkNumber: event.target.value }))} /></label><label><span>Deposit date</span><input required value={payment.depositDate} placeholder="MM/DD/YYYY" onChange={(event) => setPayment((current) => ({ ...current, depositDate: event.target.value }))} /></label><label className="full"><span>Note (optional)</span><input value={payment.note} onChange={(event) => setPayment((current) => ({ ...current, note: event.target.value }))} /></label></div><div className="mb-lifecycle-panel-actions"><button type="button" className="mb-lifecycle-button secondary" onClick={() => setPanel("")}>Cancel</button><button type="button" className="mb-lifecycle-button primary" disabled={lifecycle.isMutating || payment.amount <= 0 || payment.amount > data.bill.balanceDue || !payment.depositDate} onClick={() => void complete("Payment posted.", () => lifecycle.postPayment(payment))}>{lifecycle.isMutating ? "Posting…" : "Post payment"}</button></div></section></LifecycleDialog> : null}

    {(panel === "close" || panel === "reopen") ? <LifecycleDialog title={panel === "close" ? "Close bill" : "Reopen bill"} onClose={() => setPanel("")}><section className="mb-lifecycle-panel"><div><h3>{panel === "close" ? "Close bill" : "Reopen bill"}</h3><p>{panel === "close" ? "The immutable submission and history remain available." : "Return this bill to active follow-up without changing the submitted snapshot."}</p></div><label><span>Reason</span><textarea required value={reason} onChange={(event) => setReason(event.target.value)} /></label><div className="mb-lifecycle-panel-actions"><button type="button" className="mb-lifecycle-button secondary" onClick={() => setPanel("")}>Cancel</button><button type="button" className="mb-lifecycle-button primary" disabled={lifecycle.isMutating || !reason.trim()} onClick={() => void complete(panel === "close" ? "Bill closed." : "Bill reopened.", () => panel === "close" ? lifecycle.closeBill({ reason } satisfies CloseBillInput) : lifecycle.reopenBill({ reason } satisfies ReopenBillInput))}>{lifecycle.isMutating ? "Saving…" : panel === "close" ? "Close bill" : "Reopen bill"}</button></div></section></LifecycleDialog> : null}

    {notice ? <div className="mb-lifecycle-message success" role="status">{notice}</div> : null}
    {lifecycle.error ? <div className="mb-lifecycle-message error" role="alert">{lifecycle.error.message}</div> : null}
  </section>;
}

const CONNECTED_LIFECYCLE_STYLES = `
.mb-connected-lifecycle{--mb-accent:#176c70;--mb-text:#17282d;--mb-muted:#607176;--mb-border:#d7e0df;--mb-soft:#f4f7f6;--mb-surface:#fff;display:grid;gap:18px;color:var(--mb-text);font:14px/1.45 var(--mb-font,Inter,ui-sans-serif,system-ui,sans-serif)}.mb-connected-lifecycle *{box-sizing:border-box}.mb-lifecycle-head{display:flex;align-items:center;justify-content:space-between;gap:20px}.mb-lifecycle-title{display:flex;align-items:center;flex-wrap:wrap;gap:10px}.mb-lifecycle-title h2{margin:0;font-size:1.7rem}.mb-lifecycle-title span{border-radius:999px;background:var(--mb-soft);padding:5px 10px;font-weight:750}.mb-lifecycle-head p{margin:3px 0 0;color:var(--mb-muted)}.mb-lifecycle-tabs{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--mb-border);border-radius:12px;background:var(--mb-surface);padding:6px}.mb-lifecycle-tabs button{min-height:46px;border:0;border-radius:8px;background:transparent;color:var(--mb-muted);font:inherit;font-size:1rem;font-weight:750;cursor:pointer}.mb-lifecycle-tabs button[aria-selected=true]{background:var(--mb-accent);color:white}.mb-lifecycle-tabs span{display:inline-grid;place-items:center;min-width:24px;height:24px;margin-left:6px;border-radius:999px;background:rgba(127,127,127,.14);font-size:.8rem}.mb-lifecycle-tabpanel{display:grid;gap:18px}.mb-lifecycle-button{min-height:40px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius,8px);background:var(--mb-input,#fff);color:var(--mb-text);cursor:pointer;font:inherit;font-weight:750;padding:9px 14px}.mb-lifecycle-button.primary{border-color:var(--mb-accent);background:var(--mb-accent);color:var(--mb-accent-contrast,#fff)}.mb-lifecycle-button:disabled{cursor:not-allowed;opacity:.5}.mb-lifecycle-card,.mb-lifecycle-actions-sheet,.mb-lifecycle-panel{padding:20px;border:1px solid var(--mb-border);border-radius:var(--mb-radius,14px);background:var(--mb-surface)}.mb-lifecycle-card header,.mb-lifecycle-actions-sheet{display:flex;align-items:center;justify-content:space-between;gap:20px}.mb-lifecycle-card h3,.mb-lifecycle-actions-sheet h3,.mb-lifecycle-panel h3{margin:0;font-size:1.08rem}.mb-lifecycle-card p,.mb-lifecycle-actions-sheet p,.mb-lifecycle-panel p{margin:3px 0 0;color:var(--mb-muted)}.mb-lifecycle-card header>span{display:grid;place-items:center;min-width:28px;height:28px;border-radius:999px;background:var(--mb-soft);font-weight:750}.mb-lifecycle-actions-sheet>div:last-child{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}.mb-lifecycle-documents{list-style:none;margin:14px 0 0;padding:0}.mb-lifecycle-documents li{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 0;border-top:1px solid var(--mb-border)}.mb-lifecycle-documents li>div{display:grid;gap:3px;min-width:0}.mb-lifecycle-documents li span{color:var(--mb-muted);font-size:.85rem}.mb-lifecycle-dialog-backdrop{position:fixed;z-index:2147483000;inset:0;display:grid;place-items:center;padding:20px;background:rgba(18,35,43,.56);backdrop-filter:blur(3px)}.mb-lifecycle-dialog{position:relative;width:min(760px,100%);max-height:calc(100vh - 40px);overflow:auto;outline:0}.mb-lifecycle-dialog-close{position:absolute;z-index:1;top:12px;right:12px;width:34px;height:34px;border:1px solid var(--mb-border);border-radius:8px;background:var(--mb-surface);color:var(--mb-text);cursor:pointer;font:22px/1 inherit}.mb-lifecycle-panel{display:grid;gap:17px;padding-top:24px;box-shadow:0 24px 70px rgba(18,35,43,.22)}.mb-lifecycle-panel label{display:grid;gap:6px;font-size:.85rem;font-weight:750}.mb-lifecycle-panel label small{color:var(--mb-muted);font-weight:500}.mb-lifecycle-panel input,.mb-lifecycle-panel select,.mb-lifecycle-panel textarea{width:100%;min-height:44px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius,8px);background:var(--mb-input,#fff);color:var(--mb-text);font:inherit;padding:10px 12px}.mb-lifecycle-panel textarea{min-height:100px;resize:vertical}.mb-lifecycle-fields{display:grid;gap:13px}.mb-lifecycle-fields.two{grid-template-columns:repeat(2,minmax(0,1fr))}.mb-lifecycle-fields .full{grid-column:1/-1}.mb-lifecycle-panel-actions{display:flex;justify-content:flex-end;gap:8px}.mb-lifecycle-packet{display:grid;gap:0;margin:0;padding:0;border:0}.mb-lifecycle-packet legend{margin-bottom:7px;font-size:.85rem;font-weight:800}.mb-lifecycle-packet>label{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;padding:10px 2px;border-top:1px solid var(--mb-border)}.mb-lifecycle-packet>label>input{width:16px;min-height:16px}.mb-lifecycle-packet>label>span{display:grid}.mb-lifecycle-packet button{border:0;background:transparent;color:var(--mb-accent);cursor:pointer;font:inherit}.mb-lifecycle-message,.mb-lifecycle-error,.mb-lifecycle-loading{padding:12px 14px;border-radius:9px}.mb-lifecycle-message.success{background:#edf9f2;color:#217449}.mb-lifecycle-message.error,.mb-lifecycle-error{background:#fff0ef;color:#9d3029}.mb-lifecycle-error{display:flex;align-items:center;gap:12px}.mb-lifecycle-error span{flex:1}.mb-lifecycle-error button{border:1px solid currentColor;border-radius:7px;background:transparent;color:inherit;padding:7px 10px}
@media(max-width:700px){.mb-lifecycle-head,.mb-lifecycle-actions-sheet,.mb-lifecycle-card header{align-items:stretch;flex-direction:column}.mb-lifecycle-head>.mb-lifecycle-button{width:100%}.mb-lifecycle-actions-sheet>div:last-child{justify-content:stretch}.mb-lifecycle-actions-sheet .mb-lifecycle-button{width:100%}.mb-lifecycle-fields.two{grid-template-columns:1fr}.mb-lifecycle-fields .full{grid-column:auto}.mb-lifecycle-dialog-backdrop{align-items:end;padding:0}.mb-lifecycle-dialog{max-height:92vh}.mb-lifecycle-dialog .mb-lifecycle-panel{border-radius:18px 18px 0 0}.mb-lifecycle-tabs button{font-size:.9rem}.mb-lifecycle-title h2{font-size:1.4rem}}
`;
