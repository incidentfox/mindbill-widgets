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
  reportBillStatusContacts,
  secondReviewDeadline,
  type AddBillNoteInput,
  type BrowserBillCreateInput,
  type BillClaimsAdministratorSource,
  type BillEorDocument,
  type BillLifecycleAction,
  type BillLifecycleClient,
  type BillLifecycleClientOptions,
  type BillLifecycleData,
  type BillRejection,
  type CloseBillInput,
  type PostBillPaymentInput,
  type ReopenBillInput,
  type SandboxSimulationScenario,
  type SubmitNewBillInput,
} from "@mindbill/browser";
import type { MindBillReactAppearance } from "./appearance";
import { mindBillAppearanceStyle } from "./appearance";
import {
  BillActivityTimeline,
  BillExplanationOfReview,
  BillHistoryTable,
  BillLifecycleProgress,
  BillRejectionNotice,
} from "./bill-lifecycle-surfaces";
import { BillReadOnlyForm } from "./bill-read-only-form";
import {
  BILL_SUBMISSION_DOCUMENT_TYPES,
  BillSubmissionForm,
  prepareBillSubmissionDocuments,
  type BillSubmissionDocumentType,
  type BillSubmissionFormValue,
  type BillSubmissionInput,
  type BillSubmissionSourceAttachment,
} from "./bill-submission-form";
import type { BillReviewAttachment } from "./native-bill-review";
import { BillSubmissionsRibbon, billSubmissionsRibbonFromHistory } from "./bill-submissions-ribbon";
import { ReportBillStatusDialog } from "./report-bill-status-dialog";
import { SecondReviewForm } from "./second-review-form";
import { BillCourtesyCopyForm } from "./bill-courtesy-copy-form";

export {
  SECOND_REVIEW_REASON_TEMPLATE,
  SECOND_REVIEW_WINDOW_DAYS,
  createBillLifecycleClient,
  reportBillStatusContacts,
  secondReviewDeadline,
} from "@mindbill/browser";
export type {
  AddBillNoteInput,
  BillClaimsAdministratorContact,
  BillClaimsAdministratorDirectory,
  BillClaimsAdministratorMailingAddress,
  BillClaimsAdministratorPayer,
  BillClaimsAdministratorPattern,
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
  BillRejection,
  CloseBillInput,
  PostBillPaymentInput,
  ReopenBillInput,
  ReportBillStatusContacts,
  ResubmitBillInput,
  SandboxSimulationScenario,
  SecondReviewDeadline,
  SendDuplicateBillInput,
  SimulateSandboxBillInput,
  SubmitNewBillInput,
  SubmitSecondReviewInput,
} from "@mindbill/browser";

const DEFAULT_REFRESH_INTERVAL = 60_000;

/** Canonical team notes plus legacy API notes, without rendering their audit mirror twice. */
export function billTeamNotes(data: Pick<BillLifecycleData, "notes" | "history">) {
  const notes = data.notes ?? [];
  const canonicalIds = new Set(notes.map((note) => note.id));
  const legacy = (data.history ?? []).filter((entry) => entry.kind === "note" &&
    !canonicalIds.has(entry.id) && !notes.some((note) => entry.id.endsWith(`:ev-${note.id}`)));
  return [...legacy, ...notes.map((note) => ({ id: note.id, summary: note.body, actor: note.author, date: note.createdAt }))]
    .sort((left, right) => right.date.localeCompare(left.date));
}

export type UseBillLifecycleOptions = BillLifecycleClientOptions & {
  refreshInterval?: number;
  enabled?: boolean;
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
  getClaimsAdministratorDirectory: BillLifecycleClient["getClaimsAdministratorDirectory"];
  getDeliveryOptions: BillLifecycleClient["getDeliveryOptions"];
  getAttachment: BillLifecycleClient["getAttachment"];
  openAttachment: (attachment: Pick<BillReviewAttachment, "id">) => Promise<void>;
  openEor: (document: BillEorDocument) => Promise<void>;
  downloadPacket: () => Promise<void>;
  addNote: BillLifecycleClient["addNote"];
  previewCourtesyCopy: BillLifecycleClient["previewCourtesyCopy"];
  sendCourtesyCopy: BillLifecycleClient["sendCourtesyCopy"];
  closeBill: BillLifecycleClient["closeBill"];
  reopenBill: BillLifecycleClient["reopenBill"];
  postPayment: BillLifecycleClient["postPayment"];
  submitSecondReview: BillLifecycleClient["submitSecondReview"];
  resubmitBill: BillLifecycleClient["resubmitBill"];
  submitNewBill: BillLifecycleClient["submitNewBill"];
  sendDuplicateBill: BillLifecycleClient["sendDuplicateBill"];
  reportBillStatus: BillLifecycleClient["reportBillStatus"];
  simulateSandbox: BillLifecycleClient["simulateSandbox"];
};

function reservePreviewWindow(): Window | null {
  const preview = window.open("about:blank", "_blank");
  if (preview) {
    preview.opener = null;
    preview.document.open();
    preview.document.write("<!doctype html><title>Preparing PDF…</title><meta name=viewport content=\"width=device-width,initial-scale=1\"><style>body{margin:0;display:grid;place-items:center;min-height:100vh;font:16px system-ui;color:#42545a;background:#f5f8f8}</style><p>Preparing PDF preview…</p>");
    preview.document.close();
  }
  return preview;
}

function previewBlob(blob: Blob, preview: Window | null): void {
  const url = URL.createObjectURL(blob);
  if (preview) preview.location.replace(url);
  else {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 3_600_000);
}

/**
 * Opens a PDF loader from a user gesture without losing Safari's popup permission
 * while the authenticated request is in flight.
 */
export async function openPdfFromUserGesture(loadPdf: () => Promise<Blob>): Promise<void> {
  const preview = reservePreviewWindow();
  try {
    previewBlob(await loadPdf(), preview);
  } catch (error) {
    preview?.close();
    throw error;
  }
}

export function useBillLifecycle({
  billId: providedBillId,
  sessionEndpoint = DEFAULT_SESSION_ENDPOINT,
  getSession,
  apiBaseUrl = DEFAULT_API_BASE_URL,
  refreshInterval = DEFAULT_REFRESH_INTERVAL,
  enabled = true,
  fetch: fetchOverride,
}: UseBillLifecycleOptions): UseBillLifecycleResult {
  const [data, setData] = useState<BillLifecycleData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
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
    setData(null);
    setError(null);
    setIsLoading(enabled);
  }, [enabled, providedBillId]);

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

  const openAttachment = useCallback(async (attachment: Pick<BillReviewAttachment, "id">) => {
    await openPdfFromUserGesture(() => client.getAttachment(attachment.id));
  }, [client]);
  const openEor = useCallback(async (document: BillEorDocument) => {
    await openPdfFromUserGesture(() => client.getEor(document.id));
  }, [client]);
  const downloadPacket = useCallback(async () => {
    setError(null);
    try {
      await openPdfFromUserGesture(() => client.getPacket());
    } catch (cause) {
      const nextError = cause instanceof Error ? cause : new Error("Submission packet could not be opened.");
      if (mounted.current) setError(nextError);
      throw nextError;
    }
  }, [client]);

  return {
    billId: providedBillId,
    data,
    error,
    isLoading,
    isRefreshing,
    isMutating,
    refresh,
    searchClaimsAdministrators: (query, claimNumber) => client.searchClaimsAdministrators(query, claimNumber),
    getClaimsAdministratorDirectory: (id, injuryState) => client.getClaimsAdministratorDirectory(id, injuryState),
    getDeliveryOptions: () => client.getDeliveryOptions(),
    getAttachment: (attachmentId) => client.getAttachment(attachmentId),
    openAttachment,
    openEor,
    downloadPacket,
    addNote: (input) => mutate(() => client.addNote(input)),
    previewCourtesyCopy: (input) => client.previewCourtesyCopy(input),
    sendCourtesyCopy: (input, key) => client.sendCourtesyCopy(input, key),
    closeBill: (input) => mutate(() => client.closeBill(input)),
    reopenBill: (input) => mutate(() => client.reopenBill(input)),
    postPayment: (input) => mutate(() => client.postPayment(input)),
    submitSecondReview: (input) => mutate(() => client.submitSecondReview(input)),
    resubmitBill: (input) => mutate(() => client.resubmitBill(input)),
    submitNewBill: (input) => mutate(() => client.submitNewBill(input)),
    sendDuplicateBill: (input) => mutate(() => client.sendDuplicateBill(input)),
    reportBillStatus: (input) => mutate(() => client.reportBillStatus(input)),
    simulateSandbox: (input) => mutate(() => client.simulateSandbox(input)),
  };
}

export type ConnectedBillLifecycleProps = UseBillLifecycleOptions & {
  appearance?: MindBillReactAppearance;
  /** Human-readable name recorded for user-initiated bill actions. */
  actorName?: string;
  /** Optional host-system claims-administrator name shown as a selection hint. */
  claimsAdministratorHint?: ReactNode;
  /** Host-system evidence shown without preselecting a canonical directory entry. */
  claimsAdministratorSources?: readonly BillClaimsAdministratorSource[];
  /**
   * Exposes payer-response simulation controls for an explicit sandbox
   * playground. Sandbox responses remain indistinguishable from live
   * lifecycle responses to ordinary host applications.
   */
  sandboxControls?: boolean;
  className?: string;
  style?: CSSProperties;
  loadingFallback?: ReactNode;
  errorFallback?: (error: Error, retry: () => Promise<void>) => ReactNode;
  onChanged?: (data: BillLifecycleData) => void;
};

type Panel = "" | "resubmit" | "submit_new_bill" | "second_review" | "payment" | "close" | "reopen" | "send_duplicate" | "report_status" | "courtesy_copy";
type Tab = "details" | "history";

function LifecycleDialog({ children, title, wide = false, onClose }: { children: ReactNode; title: string; wide?: boolean; onClose: () => void }): ReactElement {
  const dialog = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onCloseRef.current();
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, []);
  return <div className="mb-lifecycle-dialog-backdrop" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
    <div ref={dialog} className={["mb-lifecycle-dialog", wide ? "wide" : ""].filter(Boolean).join(" ")} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
      <button type="button" className="mb-lifecycle-dialog-close" aria-label="Close" onClick={onClose}>×</button>{children}
    </div>
  </div>;
}

function correctionDocumentType(value: string): BillSubmissionDocumentType {
  return (BILL_SUBMISSION_DOCUMENT_TYPES as readonly string[]).includes(value)
    ? value as BillSubmissionDocumentType
    : "other";
}

function uniqueContactValues(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const trimmed = value?.trim();
    if (!trimmed) return [];
    const key = trimmed.toLocaleLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [trimmed];
  });
}

export type CorrectionRejectionSummary = {
  code: string | null;
  clearinghouseDetail: string | null;
  description: string;
};

export function correctionRejectionSummary(rejection: BillRejection): CorrectionRejectionSummary {
  const reason = rejection.reason.trim();
  const encodedReason = reason.match(/^([A-Z0-9]+:[A-Z0-9-]+)(?:\s+(\d{8}\s+[A-Z]\s+\d{4}))?\s*[:-]?\s+(.+)$/i);
  if (encodedReason?.[1] && encodedReason[3]) {
    return {
      code: encodedReason[1],
      clearinghouseDetail: encodedReason[2]?.trim() || null,
      description: encodedReason[3].trim(),
    };
  }

  const code = rejection.code?.trim() || null;
  const description = code && reason.toLocaleLowerCase().startsWith(code.toLocaleLowerCase())
    ? reason.slice(code.length).replace(/^\s*[:-]?\s*/, "").trim()
    : reason;
  return {
    code,
    clearinghouseDetail: null,
    description: description || reason || "The clearinghouse rejected this submission.",
  };
}

function CorrectionRejectionReason({ rejection }: { rejection: BillRejection }): ReactElement {
  const summary = correctionRejectionSummary(rejection);
  const details = rejection.issues?.filter((issue) => (
    issue.description.trim() !== summary.description
    || Boolean(issue.code?.trim() && issue.code.trim() !== summary.code)
  )) ?? [];

  return <div className="mb-lifecycle-correction-reason" role="alert">
    {summary.code ? <div className="mb-lifecycle-correction-reason-code">
      <span>Rejection code</span>
      <code>{summary.code}</code>
      {summary.clearinghouseDetail ? <small><span>Clearinghouse detail</span>{summary.clearinghouseDetail}</small> : null}
    </div> : null}
    <div className="mb-lifecycle-correction-reason-description">
      <span>Reason</span>
      <strong>{summary.description}</strong>
    </div>
    {details.length ? <ul aria-label="Additional rejection details">{details.map((issue, index) => <li key={`${issue.code || "issue"}-${index}`}>
      {issue.code ? <code>{issue.code}</code> : null}<span>{issue.description}</span>
    </li>)}</ul> : null}
  </div>;
}

function CorrectionVerificationContact({ delivery }: { delivery: BillLifecycleData["delivery"] }): ReactElement | null {
  const directory = delivery.directory;
  const billReview = directory?.billReview ?? [];
  const phones = uniqueContactValues([
    delivery.contacts.adjusterPhone,
    ...(directory?.telephoneNumbers ?? []),
    ...billReview.map((contact) => contact.phone),
  ]);
  const emails = uniqueContactValues([
    delivery.contacts.claimsEmail,
    delivery.contacts.adjusterEmail,
    ...(directory?.emailAddresses ?? []),
    ...billReview.map((contact) => contact.email),
  ]);
  const faxes = uniqueContactValues([
    delivery.contacts.faxNumber,
    ...billReview.map((contact) => contact.fax),
  ]);
  const portals = uniqueContactValues([
    delivery.contacts.portalUrl,
    ...(directory?.webPortals ?? []),
    ...billReview.map((contact) => contact.portalUrl),
    directory?.website,
  ]);
  const mailingAddresses = uniqueContactValues([
    delivery.contacts.mailingAddress,
    ...(directory?.mailingAddresses ?? []).map((entry) => entry.address),
    ...billReview.map((contact) => contact.address),
  ]);
  const methods = [
    { label: "Phone", values: phones, href: (value: string) => `tel:${value.replace(/[^+\d]/g, "")}` },
    { label: "Email", values: emails, href: (value: string) => `mailto:${value}` },
    { label: "Fax", values: faxes },
    { label: "Portal", values: portals, href: (value: string) => value },
    { label: "Mail", values: mailingAddresses },
  ].filter((method) => method.values.length);

  if (!methods.length) return null;
  return <aside className="mb-lifecycle-correction-contact">
    <strong>Need to verify the rejected information?</strong>
    <span>Contact {delivery.payerName} using any available method:</span>
    <dl>{methods.map((method) => <div key={method.label}>
      <dt>{method.label}</dt>
      <dd><ul>{method.values.map((value) => <li key={value}>{method.href
        ? <a href={method.href(value)} {...(method.label === "Portal" ? { target: "_blank", rel: "noreferrer" } : {})}>{value}</a>
        : value}</li>)}</ul></dd>
    </div>)}</dl>
  </aside>;
}

function correctionBill(data: BillLifecycleData): BillSubmissionInput {
  const billing = data.bill.billingSnapshot?.billingProvider;
  const rendering = data.bill.billingSnapshot?.renderingProvider;
  const location = data.bill.billingSnapshot?.placeOfService;
  const nameParts = data.patient.name.trim().split(/\s+/);
  const firstName = data.patient.firstName || nameParts[0] || "";
  const lastName = data.patient.lastName || nameParts.slice(1).join(" ") || "";
  return {
    billingMode: data.bill.billingMode,
    patient: {
      firstName,
      ...(data.patient.middleName ? { middleName: data.patient.middleName } : {}),
      lastName,
      dateOfBirth: data.patient.dob || "",
      ...(data.patient.phone ? { phone: data.patient.phone } : {}),
      address: {
        line1: data.patient.address?.line1 || "",
        city: data.patient.address?.city || "",
        state: data.patient.address?.state || "",
        postalCode: data.patient.address?.postalCode || "",
      },
    },
    claim: {
      claimNumber: data.injury.claimNumber || "",
      ...(data.injury.adjNumber ? { adjNumber: data.injury.adjNumber } : {}),
      employer: data.injury.employer || "",
      dateOfInjury: data.injury.doi || "",
      ...(data.injury.injuryDescription ? { description: data.injury.injuryDescription } : {}),
      ...(data.injury.claimsAdminId && data.injury.claimsAdminName ? {
        claimsAdministrator: { id: data.injury.claimsAdminId, name: data.injury.claimsAdminName },
      } : {}),
    },
    service: {
      date: data.bill.dos,
      ...(data.bill.dosEnd !== undefined ? { endDate: data.bill.dosEnd } : {}),
      ...(data.bill.authorizationNumber !== undefined ? { authorizationNumber: data.bill.authorizationNumber } : {}),
    },
    ...(billing ? { billingProvider: {
      name: billing.name,
      taxId: billing.taxId,
      ...(billing.taxIdType ? { taxIdType: billing.taxIdType } : {}),
      ...(billing.taxIdType === "SSN" && billing.taxIdConfigured ? { sourceBillId: data.bill.id, ...(billing.taxIdLast4 ? { taxIdLast4: billing.taxIdLast4 } : {}) } : {}),
      npi: billing.npi,
      ...(billing.phone ? { phone: billing.phone } : {}),
      address: {
        line1: billing.billingStreet || "",
        city: billing.billingCity || "",
        state: billing.billingState || "",
        postalCode: billing.billingZip || "",
      },
    } } : {}),
    ...(rendering ? { renderingProvider: {
      name: rendering.name,
      npi: rendering.npi,
      ...(rendering.taxonomy ? { taxonomy: rendering.taxonomy } : {}),
      ...(rendering.specialty ? { specialty: rendering.specialty } : {}),
      ...(rendering.licenseNumber ? { licenseNumber: rendering.licenseNumber } : {}),
      ...(rendering.licenseState ? { licenseState: rendering.licenseState } : {}),
      ...(rendering.isQME !== undefined ? { isQme: rendering.isQME } : {}),
      ...(rendering.isAME !== undefined ? { isAme: rendering.isAME } : {}),
    } } : {}),
    ...(location ? { serviceLocation: {
      ...(location.name ? { name: location.name } : {}),
      address: { line1: location.street, city: location.city, state: location.state, postalCode: location.zip },
      ...(location.posCode ? { placeOfServiceCode: location.posCode } : {}),
    } } : {}),
    diagnoses: data.injury.diagnoses?.map((diagnosis) => diagnosis.code)
      ?? [...(data.injury.diagnosisCodes || [])],
    serviceLines: data.bill.lineItems.map((line) => ({
      code: line.code,
      modifiers: [...line.modifiers],
      units: line.units,
      charge: line.charge,
      ...(line.serviceDate ? { serviceDate: line.serviceDate } : {}),
      ...(line.serviceDateEnd !== undefined ? { serviceDateEnd: line.serviceDateEnd } : {}),
      ...(line.diagnosisPointers ? { diagnosisPointers: [...line.diagnosisPointers] } : {}),
    })),
  };
}

function today(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function usDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return year && month && day ? `${month}/${day}/${year}` : isoDate;
}

function actionPanel(action: BillLifecycleAction): Panel {
  if (action.id === "resubmit") return "resubmit";
  if (action.id === "submit_new_bill") return "submit_new_bill";
  if (action.id === "second_review") return "second_review";
  if (action.id === "post_payment") return "payment";
  if (action.id === "close") return "close";
  if (action.id === "reopen") return "reopen";
  if (action.id === "send_duplicate") return "send_duplicate";
  if (action.id === "report_bill_status") return "report_status";
  return "";
}

function sandboxScenarios(state: string): Array<{ id: SandboxSimulationScenario; label: string; detail: string }> {
  if (state === "submitted") return [
    { id: "accepted", label: "Accept submission", detail: "Add clearinghouse and payer acknowledgements." },
    { id: "rejected", label: "Reject submission", detail: "Return a correctable routing rejection." },
  ];
  if (state === "accepted" || state === "second_review") return [
    { id: "processed", label: "Process with EOR", detail: "Attach a synthetic payer EOR and enable payment posting." },
    { id: "denied", label: "Deny payment", detail: "Attach a realistic denial EOR and enable Second Review." },
  ];
  return [];
}

export function shouldShowSandboxControls(environment: BillLifecycleData["environment"], enabled = false): boolean {
  return enabled && environment === "sandbox";
}

export function ConnectedBillLifecycle({ appearance, actorName, claimsAdministratorHint, claimsAdministratorSources, sandboxControls = false, className, style, loadingFallback, errorFallback, onChanged, ...options }: ConnectedBillLifecycleProps): ReactElement {
  const lifecycle = useBillLifecycle(options);
  const { data } = lifecycle;
  const [tab, setTab] = useState<Tab>("details");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string>();
  const [panel, setPanel] = useState<Panel>("");
  const [notice, setNotice] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [correctionError, setCorrectionError] = useState("");
  const [newBillError, setNewBillError] = useState("");
  const [payment, setPayment] = useState<PostBillPaymentInput>({ amount: 0, penaltyAmount: 0, interestAmount: 0, method: "check", checkNumber: "", depositDate: today(), note: "" });
  const [duplicateError, setDuplicateError] = useState("");
  const actor = actorName?.trim() ? { actorName: actorName.trim() } : {};
  const lastData = useRef<BillLifecycleData | null>(null);
  const correctionInitialBill = useMemo(() => data ? correctionBill(data) : null, [data]);
  const correctionAttachments = useMemo<BillSubmissionSourceAttachment[]>(() => data ? data.bill.attachments.map((attachment) => {
    const documentType = correctionDocumentType(attachment.documentType);
    const isW9 = documentType === "w9";
    return {
      id: attachment.id,
      fileName: attachment.filename,
      documentType,
      ...(attachment.description ? { description: attachment.description } : {}),
      ...(attachment.reportType ? { reportTypeCode: attachment.reportType } : {}),
      loadBlob: () => lifecycle.getAttachment(attachment.id),
      ...(isW9 ? { autoAttached: true, removable: false } : { removable: true }),
    };
  }) : [], [data, lifecycle]);
  const correctionAttentionFields = useMemo(() => data?.rejection?.issues
    ?.flatMap((issue) => issue.fieldPaths || [])
    .filter((path, index, fields) => fields.indexOf(path) === index) || [], [data]);

  useEffect(() => {
    if (!data || data === lastData.current) return;
    lastData.current = data;
    onChanged?.(data);
    const payerRemaining = data.remittance.payerReportedPaid === null
      ? data.bill.balanceDue
      : Math.max(0, data.remittance.payerReportedPaid - data.remittance.postedPrincipal);
    setPayment((current) => ({
      ...current,
      amount: current.amount > 0 && current.amount <= data.bill.balanceDue
        ? current.amount
        : Math.min(data.bill.balanceDue, payerRemaining || data.bill.balanceDue),
      penaltyAmount: 0,
      interestAmount: 0,
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
  const addNote = async () => {
    const value = note.trim();
    if (!value) return;
    setNotice("");
    try {
      await lifecycle.addNote({ note: value, ...actor } satisfies AddBillNoteInput);
      setNote("");
      setNotice("Note added.");
    } catch {
      // useBillLifecycle keeps the server error visible and the note editable.
    }
  };
  const submitCorrection = async (value: BillSubmissionFormValue) => {
    setNotice("");
    setCorrectionError("");
    try {
      const documents = await prepareBillSubmissionDocuments({
        attachments: correctionAttachments,
        selectedIds: value.sourceAttachmentIds,
        reportTypeCodeByAttachmentId: value.sourceAttachmentReportTypes,
        uploads: value.uploads,
        ...(options.fetch ? { fetch: options.fetch } : {}),
      });
      await lifecycle.resubmitBill({
        bill: value.bill as BrowserBillCreateInput,
        ...(value.submission ? { submission: value.submission } : {}),
        ...(documents.length ? { documents } : {}),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        ...actor,
      });
    } catch (cause) {
      // A failed resubmission must never look like a success: keep the dialog
      // (and the biller's corrections) open and show the server's reason inline
      // next to the submit control, like the other action panels do.
      setCorrectionError(
        cause instanceof Error && cause.message
          ? cause.message
          : "The corrected bill could not be resubmitted.",
      );
      throw cause;
    }
    setPanel("");
    setReason("");
    setNotice("Corrected submission sent.");
  };
  const submitNewBillFromForm = async (value: BillSubmissionFormValue) => {
    setNotice("");
    setNewBillError("");
    try {
      const documents = await prepareBillSubmissionDocuments({
        attachments: correctionAttachments,
        selectedIds: value.sourceAttachmentIds,
        reportTypeCodeByAttachmentId: value.sourceAttachmentReportTypes,
        uploads: value.uploads,
        ...(options.fetch ? { fetch: options.fetch } : {}),
      });
      await lifecycle.submitNewBill({
        bill: value.bill as BrowserBillCreateInput,
        ...(value.submission ? { submission: value.submission } : {}),
        ...(documents.length ? { documents } : {}),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        ...actor,
      } satisfies SubmitNewBillInput);
    } catch (cause) {
      // Same contract as the correction dialog: a failed submission must never
      // look like a success — keep the form (and the biller's edits) open and
      // show the server's reason inline next to the submit control.
      setNewBillError(
        cause instanceof Error && cause.message
          ? cause.message
          : "The new bill could not be submitted.",
      );
      throw cause;
    }
    setPanel("");
    setReason("");
    setNotice("New bill submitted.");
  };
  const submitDuplicateFromForm = async (value: BillSubmissionFormValue) => {
    setNotice("");
    setDuplicateError("");
    try {
      const documents = await prepareBillSubmissionDocuments({
        attachments: correctionAttachments,
        selectedIds: value.sourceAttachmentIds,
        reportTypeCodeByAttachmentId: value.sourceAttachmentReportTypes,
        uploads: value.uploads,
        ...(options.fetch ? { fetch: options.fetch } : {}),
      });
      await lifecycle.sendDuplicateBill({
        bill: value.bill as BrowserBillCreateInput,
        ...(value.submission ? { submission: value.submission } : {}),
        ...(documents.length ? { documents } : {}),
        ...actor,
      });
    } catch (cause) {
      setDuplicateError(
        cause instanceof Error && cause.message
          ? cause.message
          : "The duplicate bill could not be submitted.",
      );
      throw cause;
    }
    setPanel("");
    setNotice("Duplicate bill sent.");
  };
  const viewEor = data.lifecycle.actions.find((action) => action.id === "view_eor" && action.enabled);
  const supportedActions = new Set<BillLifecycleAction["id"]>(["resubmit", "submit_new_bill", "second_review", "post_payment", "close", "reopen", "send_duplicate", "report_bill_status"]);
  const actions = data.lifecycle.actions.filter((action) => action.enabled && supportedActions.has(action.id));
  const showSandboxControls = shouldShowSandboxControls(data.environment, sandboxControls);
  const simulations = showSandboxControls ? sandboxScenarios(data.lifecycle.state) : [];
  const mappedRibbonItems = data.history ? billSubmissionsRibbonFromHistory(data.history, data.attempts) : [];
  const activeSubmissionId = selectedSubmissionId
    ?? mappedRibbonItems.find((item) => item.active)?.id
    ?? mappedRibbonItems[mappedRibbonItems.length - 1]?.id;
  const ribbonItems = mappedRibbonItems.map((item) => ({ ...item, active: item.id === activeSubmissionId }));
  const selectedAttempt = data.attempts?.find((attempt) => attempt.id === activeSubmissionId);
  const billNotes = billTeamNotes(data);
  const statusContacts = reportBillStatusContacts(data.delivery);
  const receiptEntries = (data.history ?? []).filter((entry) => entry.kind === "submission" || entry.kind === "ack");
  const reviewDeadline = secondReviewDeadline(data.eors);

  return <section className={["mb-connected-lifecycle", className].filter(Boolean).join(" ")} style={mindBillAppearanceStyle(appearance, style)}>
    <style>{CONNECTED_LIFECYCLE_STYLES}</style>
    {ribbonItems.length >= 2 ? <BillSubmissionsRibbon items={ribbonItems} onSelect={(item) => { setSelectedSubmissionId(item.id); setTab("details"); }} {...(appearance ? { appearance } : {})} /> : null}
    {data.lifecycle.state.toLowerCase() === "rejected" && data.rejection
      ? <BillRejectionNotice rejection={data.rejection} submittedAt={data.lifecycle.submittedAt ?? null} {...(appearance ? { appearance } : {})} />
      : <BillLifecycleProgress state={data.lifecycle.state} nativeStatus={data.lifecycle.nativeStatus} submittedAt={data.lifecycle.submittedAt ?? null} agingDays={data.lifecycle.agingDays ?? null} {...(appearance ? { appearance } : {})} />}

    <header className="mb-lifecycle-head">
      <div><div className="mb-lifecycle-title"><h2>Bill #{data.bill.billNumber}</h2></div><p>Claim {data.injury.claimNumber || "—"}{lifecycle.isRefreshing ? " · Refreshing…" : ""}</p></div>
      <button type="button" className="mb-lifecycle-button primary" disabled={lifecycle.isMutating} onClick={() => void lifecycle.downloadPacket().catch(() => undefined)}>Download packet</button>
      <button type="button" className="mb-lifecycle-button secondary" disabled={lifecycle.isMutating} onClick={() => setPanel("courtesy_copy")}>Forward copy</button>
    </header>

    <div className="mb-lifecycle-tabs" role="tablist" aria-label="Bill view">
      <button type="button" role="tab" aria-selected={tab === "details"} onClick={() => setTab("details")}>Bill details</button>
      <button type="button" role="tab" aria-selected={tab === "history"} onClick={() => setTab("history")}>Bill history</button>
    </div>

    {tab === "details" ? <div className="mb-lifecycle-tabpanel" role="tabpanel">
      {selectedAttempt && ribbonItems.length >= 2 ? <section className="mb-lifecycle-attempt-detail" aria-label="Selected submission detail">
        <header><div><span>Selected submission</span><h3>{selectedAttempt.label}</h3></div><strong>{selectedAttempt.isCurrent ? "Current" : "Previous"}</strong></header>
        <dl>
          <div><dt>Bill</dt><dd>#{selectedAttempt.billNumber || data.bill.billNumber}</dd></div>
          <div><dt>Delivery</dt><dd>{selectedAttempt.deliveryLabel || "—"}</dd></div>
          <div><dt>Sent</dt><dd>{selectedAttempt.sentAt ? new Date(selectedAttempt.sentAt).toLocaleString() : "—"}</dd></div>
          <div><dt>Status</dt><dd>{selectedAttempt.ackLabel || selectedAttempt.status || "Submitted"}</dd></div>
          {selectedAttempt.complianceLabel ? <div><dt>{selectedAttempt.complianceLabel}</dt><dd>{selectedAttempt.complianceAt ? new Date(selectedAttempt.complianceAt).toLocaleDateString() : "—"}</dd></div> : null}
        </dl>
      </section> : null}
      {(data.eors.length || data.payments.length || ["processed", "denied", "partially_paid"].includes(data.lifecycle.state)) ? <BillExplanationOfReview remittance={data.remittance} eors={data.eors} payments={data.payments} submittedAt={data.lifecycle.submittedAt ?? null} onOpenEor={lifecycle.openEor} {...(appearance ? { appearance } : {})} /> : null}

      {showSandboxControls ? <section className="mb-lifecycle-simulator" aria-label="Sandbox lifecycle simulator"><div><span>Sandbox demo controls</span><h3>Simulate the next payer response</h3><p>This changes sandbox data only. The host receives the result through the same lifecycle API and components partners use.</p></div>{simulations.length ? <div className="mb-lifecycle-simulator-actions">{simulations.map((scenario) => <button type="button" key={scenario.id} disabled={lifecycle.isMutating} onClick={() => void complete(`${scenario.label} simulated.`, () => lifecycle.simulateSandbox({ scenario: scenario.id }))}><strong>{scenario.label}</strong><span>{scenario.detail}</span></button>)}</div> : <p className="mb-lifecycle-simulator-idle">No simulated payer transition is needed at this stage. Use the bill action below to continue.</p>}</section> : null}

      <BillReadOnlyForm data={data} onOpenAttachment={lifecycle.openAttachment} {...(appearance ? { appearance } : {})} />
      <section className="mb-lifecycle-notes" aria-label="Bill notes">
        <header><div><h3>Team notes</h3><p>Shared with your workspace’s billing team. Never sent to the payer.</p></div><span>{billNotes.length}</span></header>
        {billNotes.length ? <ol>{billNotes.map((entry) => <li key={entry.id}><p>{entry.summary}</p><small>{entry.actor || "System"} · {usDate(entry.date)}</small></li>)}</ol> : <p className="mb-lifecycle-notes-empty">No notes yet.</p>}
        <form onSubmit={(event) => { event.preventDefault(); void addNote(); }}><label><span>Add a note</span><textarea value={note} maxLength={2000} placeholder="Add context for the billing team…" onChange={(event) => setNote(event.target.value)} /></label><button type="submit" className="mb-lifecycle-button primary" disabled={lifecycle.isMutating || !note.trim()}>{lifecycle.isMutating ? "Adding…" : "Add note"}</button></form>
      </section>
    </div> : <div className="mb-lifecycle-tabpanel" role="tabpanel">{data.history?.length
      ? <BillHistoryTable entries={data.history} onOpenDocument={lifecycle.openAttachment} {...(appearance ? { appearance } : {})} />
      : <BillActivityTimeline events={data.activity} {...(appearance ? { appearance } : {})} />}</div>}

    {(viewEor || actions.length) ? <aside className="mb-lifecycle-actions-sheet" aria-label="Bill actions">
      {viewEor && data.eors[0] ? <button type="button" className="mb-lifecycle-button secondary" onClick={() => void lifecycle.openEor(data.eors[0]!).catch(() => undefined)}>{viewEor.label}</button> : null}
      {actions.map((action) => <button type="button" key={action.id} className={action.primary ? "mb-lifecycle-button primary" : "mb-lifecycle-button secondary"} onClick={() => {
        const next = actionPanel(action);
        if (!next) return;
        if (next === "resubmit") setCorrectionError("");
        if (next === "submit_new_bill") setNewBillError("");
        if (next === "send_duplicate") setDuplicateError("");
        setPanel(next);
      }}>{action.label}</button>)}
    </aside> : null}

    {panel === "courtesy_copy" ? <LifecycleDialog title="Forward courtesy copy" wide onClose={() => setPanel("")}><BillCourtesyCopyForm documents={data.bill.attachments} subject={`Courtesy copy — bill #${data.bill.billNumber}`} environment={data.environment} onPreview={lifecycle.previewCourtesyCopy} onSend={lifecycle.sendCourtesyCopy} onSent={() => { void lifecycle.refresh(); }} {...(appearance ? { appearance } : {})} /></LifecycleDialog> : null}
    {panel === "resubmit" && correctionInitialBill ? <LifecycleDialog title="Correct and resubmit" wide onClose={() => setPanel("")}><section className="mb-lifecycle-correction"><header><div><h3>Correct and resubmit</h3><p>Review the rejected snapshot, correct the highlighted information, and submit a new immutable attempt under this bill.</p></div></header>{data.environment === "live" ? <div className="mb-lifecycle-live-warning"><strong>Live clearinghouse submission</strong><span>Resubmitting sends a real bill. Confirm the corrected information before continuing.</span></div> : null}{data.rejection ? <CorrectionRejectionReason rejection={data.rejection} /> : null}<CorrectionVerificationContact delivery={data.delivery} /><label className="mb-lifecycle-correction-note"><span>Correction note (optional)</span><textarea value={reason} placeholder="What changed before resubmission?" onChange={(event) => setReason(event.target.value)} /></label><BillSubmissionForm
      className="mbsf-lifecycle-correction"
      initialBill={correctionInitialBill}
      attachments={correctionAttachments}
      onSubmit={submitCorrection}
      onSearchClaimsAdministrators={lifecycle.searchClaimsAdministrators}
      onGetClaimsAdministratorDirectory={lifecycle.getClaimsAdministratorDirectory}
      claimsAdministratorHint={claimsAdministratorHint}
      {...(claimsAdministratorSources ? { claimsAdministratorSources } : {})}
      attentionFields={correctionAttentionFields}
      attentionMessage={correctionAttentionFields.length ? "The rejected response points to the highlighted fields. Confirm every required value before resubmitting." : "Confirm the bill information below before resubmitting."}
      submitLabel={lifecycle.isMutating ? "Resubmitting…" : "Resubmit bill"}
      deliveryRoutePicker="required"
      deliveryRouteDialogTitle="Confirm corrected bill delivery"
      heading="Corrected bill information"
      description="The original submission stays unchanged. This form creates the next submission attempt."
      disabled={lifecycle.isMutating}
      {...(options.getSession ? { getSession: options.getSession } : {})}
      {...(options.sessionEndpoint ? { sessionEndpoint: options.sessionEndpoint } : {})}
      {...(options.apiBaseUrl ? { apiBaseUrl: options.apiBaseUrl } : {})}
      {...(options.fetch ? { fetch: options.fetch } : {})}
      {...(appearance ? { appearance } : {})}
    />{correctionError ? <div className="mb-lifecycle-message error" role="alert">{correctionError}</div> : null}</section></LifecycleDialog> : null}

    {panel === "submit_new_bill" && correctionInitialBill ? <LifecycleDialog title="Submit New Bill" wide onClose={() => setPanel("")}><section className="mb-lifecycle-correction"><header><div><h3>Submit New Bill</h3><p>This closed bill stays closed and keeps its record. Review the carried-over snapshot below and submit a fresh bill — both bills stay linked in the submissions timeline.</p></div></header><label className="mb-lifecycle-correction-note"><span>Submission note (optional)</span><textarea value={reason} placeholder="Why is a new bill being submitted?" onChange={(event) => setReason(event.target.value)} /></label><BillSubmissionForm
      className="mbsf-lifecycle-correction"
      initialBill={correctionInitialBill}
      attachments={correctionAttachments}
      onSubmit={submitNewBillFromForm}
      onSearchClaimsAdministrators={lifecycle.searchClaimsAdministrators}
      onGetClaimsAdministratorDirectory={lifecycle.getClaimsAdministratorDirectory}
      claimsAdministratorHint={claimsAdministratorHint}
      {...(claimsAdministratorSources ? { claimsAdministratorSources } : {})}
      attentionMessage="Confirm every value carried over from the closed bill before submitting the new bill."
      submitLabel={lifecycle.isMutating ? "Submitting…" : "Submit New Bill"}
      deliveryRoutePicker="required"
      deliveryRouteDialogTitle="Confirm new bill delivery"
      heading="New bill information"
      description="The closed bill stays unchanged. This form submits a fresh bill linked to it."
      disabled={lifecycle.isMutating}
      {...(options.getSession ? { getSession: options.getSession } : {})}
      {...(options.sessionEndpoint ? { sessionEndpoint: options.sessionEndpoint } : {})}
      {...(options.apiBaseUrl ? { apiBaseUrl: options.apiBaseUrl } : {})}
      {...(options.fetch ? { fetch: options.fetch } : {})}
      {...(appearance ? { appearance } : {})}
    />{newBillError ? <div className="mb-lifecycle-message error" role="alert">{newBillError}</div> : null}</section></LifecycleDialog> : null}

    {panel === "second_review" ? <LifecycleDialog title="Submit Second Review" wide onClose={() => setPanel("")}><SecondReviewForm
      data={data}
      submitting={lifecycle.isMutating}
      error={lifecycle.error}
      {...(options.fetch ? { fetch: options.fetch } : {})}
      getDeliveryOptions={lifecycle.getDeliveryOptions}
      openAttachment={lifecycle.openAttachment}
      onCancel={() => setPanel("")}
      onSubmit={(input) => complete("Second Review submitted.", () => lifecycle.submitSecondReview({ ...input, ...actor }))}
    />{reviewDeadline ? <p className="mb-lifecycle-deadline-hint">Second Review must be requested within 90 days of the denial EOR (dated {usDate(reviewDeadline.eorDate)}) — file by <strong>{usDate(reviewDeadline.deadline)}</strong>.</p> : null}</LifecycleDialog> : null}

    {panel === "payment" ? <LifecycleDialog title="Post payment" onClose={() => setPanel("")}><section className="mb-lifecycle-panel"><div><h3>Post payment</h3><p>Record a full or partial payment, plus any penalty and interest received.</p></div><div className="mb-lifecycle-fields two"><label><span>Amount applied to bill</span><input type="number" min="0.01" max={data.bill.balanceDue} step="0.01" value={payment.amount || ""} onChange={(event) => setPayment((current) => ({ ...current, amount: Number(event.target.value) }))} /></label><label><span>Penalty</span><input type="number" min="0" step="0.01" value={payment.penaltyAmount || ""} placeholder="0.00" onChange={(event) => setPayment((current) => ({ ...current, penaltyAmount: Number(event.target.value) }))} /></label><label><span>Interest</span><input type="number" min="0" step="0.01" value={payment.interestAmount || ""} placeholder="0.00" onChange={(event) => setPayment((current) => ({ ...current, interestAmount: Number(event.target.value) }))} /></label><label><span>Method</span><select value={payment.method} onChange={(event) => setPayment((current) => ({ ...current, method: event.target.value as "check" | "eft" }))}><option value="check">Check</option><option value="eft">EFT</option></select></label><label><span>{payment.method === "check" ? "Check number" : "EFT reference"}</span><input value={payment.checkNumber} onChange={(event) => setPayment((current) => ({ ...current, checkNumber: event.target.value }))} /></label><label><span>Deposit date</span><input required value={payment.depositDate} placeholder="MM/DD/YYYY" onChange={(event) => setPayment((current) => ({ ...current, depositDate: event.target.value }))} /></label><label className="full"><span>Note (optional)</span><input value={payment.note} onChange={(event) => setPayment((current) => ({ ...current, note: event.target.value }))} /></label></div><div className="mb-payment-total"><span>Total received</span><strong>{new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(payment.amount + (payment.penaltyAmount ?? 0) + (payment.interestAmount ?? 0))}</strong></div><div className="mb-lifecycle-panel-actions"><button type="button" className="mb-lifecycle-button secondary" onClick={() => setPanel("")}>Cancel</button><button type="button" className="mb-lifecycle-button primary" disabled={lifecycle.isMutating || payment.amount <= 0 || payment.amount > data.bill.balanceDue || (payment.penaltyAmount ?? 0) < 0 || (payment.interestAmount ?? 0) < 0 || !payment.depositDate} onClick={() => void complete("Payment posted.", () => lifecycle.postPayment({ ...payment, ...actor }))}>{lifecycle.isMutating ? "Posting…" : "Post payment"}</button></div></section></LifecycleDialog> : null}

    {(panel === "close" || panel === "reopen") ? <LifecycleDialog title={panel === "close" ? "Close bill" : "Reopen bill"} onClose={() => setPanel("")}><section className="mb-lifecycle-panel"><div><h3>{panel === "close" ? "Close bill" : "Reopen bill"}</h3><p>{panel === "close" ? "The immutable submission and history remain available." : "Return this bill to active follow-up without changing the submitted snapshot."}</p></div><label><span>Reason</span><textarea required value={reason} onChange={(event) => setReason(event.target.value)} /></label><div className="mb-lifecycle-panel-actions"><button type="button" className="mb-lifecycle-button secondary" onClick={() => setPanel("")}>Cancel</button><button type="button" className="mb-lifecycle-button primary" disabled={lifecycle.isMutating || !reason.trim()} onClick={() => void complete(panel === "close" ? "Bill closed." : "Bill reopened.", () => panel === "close" ? lifecycle.closeBill({ reason, ...actor } satisfies CloseBillInput) : lifecycle.reopenBill({ reason, ...actor } satisfies ReopenBillInput))}>{lifecycle.isMutating ? "Saving…" : panel === "close" ? "Close bill" : "Reopen bill"}</button></div></section></LifecycleDialog> : null}

    {panel === "send_duplicate" && correctionInitialBill ? <LifecycleDialog title="Send duplicate bill" wide onClose={() => setPanel("")}><section className="mb-lifecycle-correction"><header><div><h3>Send duplicate bill</h3><p>Review and edit any bill field before creating a duplicate submission. The original bill and its history stay unchanged.</p></div></header>{data.environment === "live" ? <div className="mb-lifecycle-live-warning"><strong>Live clearinghouse submission</strong><span>The duplicate will be sent only after you confirm its delivery route in the next dialog.</span></div> : null}<CorrectionVerificationContact delivery={data.delivery} /><BillSubmissionForm
      className="mbsf-lifecycle-correction"
      initialBill={correctionInitialBill}
      attachments={correctionAttachments}
      onSubmit={submitDuplicateFromForm}
      onSearchClaimsAdministrators={lifecycle.searchClaimsAdministrators}
      onGetClaimsAdministratorDirectory={lifecycle.getClaimsAdministratorDirectory}
      claimsAdministratorHint={claimsAdministratorHint}
      {...(claimsAdministratorSources ? { claimsAdministratorSources } : {})}
      attentionMessage="Confirm every carried-over value. You may edit any field before sending this duplicate."
      submitLabel={lifecycle.isMutating ? "Sending…" : "Send duplicate"}
      deliveryRoutePicker="required"
      deliveryRouteDialogTitle="Confirm duplicate bill delivery"
      heading="Duplicate bill information"
      description="The submitted original remains immutable. This form creates and sends a linked duplicate."
      disabled={lifecycle.isMutating}
      {...(options.getSession ? { getSession: options.getSession } : {})}
      {...(options.sessionEndpoint ? { sessionEndpoint: options.sessionEndpoint } : {})}
      {...(options.apiBaseUrl ? { apiBaseUrl: options.apiBaseUrl } : {})}
      {...(options.fetch ? { fetch: options.fetch } : {})}
      {...(appearance ? { appearance } : {})}
    />{duplicateError ? <div className="mb-lifecycle-message error" role="alert">{duplicateError}</div> : null}</section></LifecycleDialog> : null}

    {panel === "report_status" ? <ReportBillStatusDialog
      {...(data.delivery.directory ? { directory: data.delivery.directory } : {})}
      {...(statusContacts.claimsAdmin ? { claimsAdmin: statusContacts.claimsAdmin } : {})}
      {...(statusContacts.billReview ? { billReview: statusContacts.billReview } : {})}
      {...(receiptEntries.length ? { receipt: <BillHistoryTable entries={receiptEntries} onOpenDocument={lifecycle.openAttachment} {...(appearance ? { appearance } : {})} /> } : {})}
      submitting={lifecycle.isMutating}
      error={lifecycle.error?.message ?? null}
      onCancel={() => setPanel("")}
      onSave={(input) => void complete("Bill status reported.", () => lifecycle.reportBillStatus({ ...input, ...actor }))}
      {...(appearance ? { appearance } : {})}
    /> : null}

    {notice ? <div className="mb-lifecycle-message success" role="status">{notice}</div> : null}
    {lifecycle.error ? <div className="mb-lifecycle-message error" role="alert">{lifecycle.error.message}</div> : null}
  </section>;
}

const CONNECTED_LIFECYCLE_STYLES = `
.mb-lifecycle-attempt-detail{display:grid;gap:15px;padding:18px;border:1px solid color-mix(in srgb,var(--mb-accent) 38%,var(--mb-border));border-radius:var(--mb-radius,14px);background:color-mix(in srgb,var(--mb-accent) 5%,var(--mb-surface))}.mb-lifecycle-attempt-detail>header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.mb-lifecycle-attempt-detail>header span{color:var(--mb-accent);font-size:.72rem;font-weight:850;letter-spacing:.08em;text-transform:uppercase}.mb-lifecycle-attempt-detail h3{margin:3px 0 0;font-size:1.08rem}.mb-lifecycle-attempt-detail>header>strong{padding:4px 9px;border:1px solid color-mix(in srgb,var(--mb-accent) 35%,var(--mb-border));border-radius:999px;background:var(--mb-surface);color:var(--mb-accent);font-size:.75rem}.mb-lifecycle-attempt-detail dl{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0}.mb-lifecycle-attempt-detail dl>div{display:grid;gap:2px;min-width:0}.mb-lifecycle-attempt-detail dt{color:var(--mb-muted);font-size:.7rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase}.mb-lifecycle-attempt-detail dd{min-width:0;margin:0;font-weight:700;overflow-wrap:anywhere}
.mb-lifecycle-notes{display:grid;gap:14px;padding:20px;border:1px solid var(--mb-border);border-radius:var(--mb-radius,14px);background:var(--mb-surface)}.mb-lifecycle-notes>header{display:flex;align-items:center;justify-content:space-between;gap:16px}.mb-lifecycle-notes h3{margin:0;font-size:1.08rem}.mb-lifecycle-notes header p{margin:3px 0 0;color:var(--mb-muted)}.mb-lifecycle-notes>header>span{display:grid;place-items:center;min-width:28px;height:28px;border-radius:999px;background:var(--mb-soft);font-weight:750}.mb-lifecycle-notes ol{display:grid;gap:9px;margin:0;padding:0;list-style:none}.mb-lifecycle-notes li{padding:11px 13px;border-left:3px solid color-mix(in srgb,var(--mb-accent) 52%,var(--mb-border));border-radius:0 8px 8px 0;background:var(--mb-soft)}.mb-lifecycle-notes li p{margin:0;white-space:pre-wrap}.mb-lifecycle-notes li small{display:block;margin-top:4px;color:var(--mb-muted)}.mb-lifecycle-notes-empty{margin:0;color:var(--mb-muted)}.mb-lifecycle-notes form{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:10px}.mb-lifecycle-notes label{display:grid;gap:6px;font-size:.82rem;font-weight:750}.mb-lifecycle-notes textarea{width:100%;min-height:76px;padding:10px 12px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius,8px);background:var(--mb-input,#fff);color:var(--mb-text);font:inherit;resize:vertical}
.mb-lifecycle-simulator{display:grid;gap:14px;padding:18px;border:1px solid #b8dadd;border-radius:var(--mb-radius,14px);background:#f2fbfb}.mb-lifecycle-simulator>div:first-child>span{color:var(--mb-accent);font-size:.72rem;font-weight:850;letter-spacing:.09em;text-transform:uppercase}.mb-lifecycle-simulator h3{margin:3px 0 0;font-size:1.05rem}.mb-lifecycle-simulator p{margin:4px 0 0;color:var(--mb-muted)}.mb-lifecycle-simulator-actions{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.mb-lifecycle-simulator-actions button{min-height:76px;border:1px solid #a9cccf;border-radius:10px;background:var(--mb-surface);color:var(--mb-text);cursor:pointer;padding:12px 14px;text-align:left;font:inherit}.mb-lifecycle-simulator-actions button:hover{border-color:var(--mb-accent);box-shadow:0 3px 14px rgba(23,108,112,.1)}.mb-lifecycle-simulator-actions button:disabled{cursor:not-allowed;opacity:.55}.mb-lifecycle-simulator-actions button strong,.mb-lifecycle-simulator-actions button span{display:block}.mb-lifecycle-simulator-actions button span{margin-top:3px;color:var(--mb-muted);font-size:.83rem}.mb-lifecycle-simulator-idle{padding:10px 12px;border-radius:8px;background:rgba(255,255,255,.72)}
.mb-connected-lifecycle{--mb-accent:#176c70;--mb-text:#17282d;--mb-muted:#607176;--mb-border:#d7e0df;--mb-soft:#f4f7f6;--mb-surface:#fff;display:grid;gap:18px;color:var(--mb-text);font:14px/1.45 var(--mb-font,Inter,ui-sans-serif,system-ui,sans-serif)}.mb-connected-lifecycle *{box-sizing:border-box}.mb-lifecycle-head{display:flex;align-items:center;justify-content:space-between;gap:20px}.mb-lifecycle-title{display:flex;align-items:center;flex-wrap:wrap;gap:10px}.mb-lifecycle-title h2{margin:0;font-size:1.7rem}.mb-lifecycle-head p{margin:3px 0 0;color:var(--mb-muted)}.mb-lifecycle-tabs{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--mb-border);border-radius:12px;background:var(--mb-surface);padding:6px}.mb-lifecycle-tabs button{min-height:46px;border:0;border-radius:8px;background:transparent;color:var(--mb-muted);font:inherit;font-size:1rem;font-weight:750;cursor:pointer}.mb-lifecycle-tabs button[aria-selected=true]{background:var(--mb-accent);color:white}.mb-lifecycle-tabpanel{display:grid;gap:18px}.mb-lifecycle-button{min-height:40px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius,8px);background:var(--mb-input,#fff);color:var(--mb-text);cursor:pointer;font:inherit;font-weight:750;padding:9px 14px}.mb-lifecycle-button.primary{border-color:var(--mb-accent);background:var(--mb-accent);color:var(--mb-accent-contrast,#fff)}.mb-lifecycle-button:disabled{cursor:not-allowed;opacity:.5}.mb-lifecycle-actions-sheet{position:sticky;bottom:12px;z-index:24;display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:9px;padding:10px;border:1px solid var(--mb-border);border-radius:12px;background:color-mix(in srgb,var(--mb-surface) 94%,transparent);box-shadow:0 10px 34px rgba(18,35,43,.16);backdrop-filter:blur(12px)}.mb-lifecycle-card,.mb-lifecycle-panel{padding:20px;border:1px solid var(--mb-border);border-radius:var(--mb-radius,14px);background:var(--mb-surface)}.mb-lifecycle-card header{display:flex;align-items:center;justify-content:space-between;gap:20px}.mb-lifecycle-card h3,.mb-lifecycle-panel h3{margin:0;font-size:1.08rem}.mb-lifecycle-card p,.mb-lifecycle-panel p{margin:3px 0 0;color:var(--mb-muted)}.mb-lifecycle-card header>span{display:grid;place-items:center;min-width:28px;height:28px;border-radius:999px;background:var(--mb-soft);font-weight:750}.mb-lifecycle-documents{list-style:none;margin:14px 0 0;padding:0}.mb-lifecycle-documents li{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 0;border-top:1px solid var(--mb-border)}.mb-lifecycle-documents li>div{display:grid;gap:3px;min-width:0}.mb-lifecycle-documents li span{color:var(--mb-muted);font-size:.85rem}.mb-lifecycle-dialog-backdrop{position:fixed;z-index:2147483000;inset:0;display:grid;place-items:center;padding:20px;background:rgba(18,35,43,.56);backdrop-filter:blur(3px)}.mb-lifecycle-dialog{position:relative;width:min(760px,100%);max-height:calc(100dvh - 40px);overflow:auto;outline:0}.mb-lifecycle-dialog-close{position:absolute;z-index:1;top:12px;right:12px;width:44px;height:44px;border:1px solid var(--mb-border);border-radius:10px;background:var(--mb-surface);color:var(--mb-text);cursor:pointer;font:24px/1 inherit}.mb-lifecycle-panel{display:grid;gap:17px;padding-top:24px;box-shadow:0 24px 70px rgba(18,35,43,.22)}.mb-lifecycle-panel label{display:grid;gap:6px;font-size:.85rem;font-weight:750}.mb-lifecycle-panel label small{color:var(--mb-muted);font-weight:500}.mb-lifecycle-panel input,.mb-lifecycle-panel select,.mb-lifecycle-panel textarea{width:100%;min-height:44px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius,8px);background:var(--mb-input,#fff);color:var(--mb-text);font:inherit;padding:10px 12px}.mb-lifecycle-panel textarea{min-height:100px;resize:vertical}.mb-lifecycle-fields{display:grid;gap:13px}.mb-lifecycle-fields.two{grid-template-columns:repeat(2,minmax(0,1fr))}.mb-lifecycle-fields .full{grid-column:1/-1}.mb-lifecycle-panel-actions{display:flex;justify-content:flex-end;gap:8px}.mb-lifecycle-packet{display:grid;gap:0;margin:0;padding:0;border:0}.mb-lifecycle-packet legend{margin-bottom:7px;font-size:.85rem;font-weight:800}.mb-lifecycle-packet>label{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;padding:10px 2px;border-top:1px solid var(--mb-border)}.mb-lifecycle-packet>label>input{width:16px;min-height:16px}.mb-lifecycle-packet>label>span{display:grid}.mb-lifecycle-packet button{border:0;background:transparent;color:var(--mb-accent);cursor:pointer;font:inherit}.mb-lifecycle-message,.mb-lifecycle-error,.mb-lifecycle-loading{padding:12px 14px;border-radius:9px}.mb-lifecycle-message.success{background:#edf9f2;color:#217449}.mb-lifecycle-message.error,.mb-lifecycle-error{background:#fff0ef;color:#9d3029}.mb-lifecycle-error{display:flex;align-items:center;gap:12px}.mb-lifecycle-error span{flex:1}.mb-lifecycle-error button{border:1px solid currentColor;border-radius:7px;background:transparent;color:inherit;padding:7px 10px}
.mb-lifecycle-dialog.wide{width:min(1280px,100%)}.mb-lifecycle-correction{display:grid;gap:16px;padding:22px;border-radius:var(--mb-radius,14px);background:var(--mb-surface);box-shadow:0 24px 70px rgba(18,35,43,.22)}.mb-lifecycle-correction>header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding-right:56px}.mb-lifecycle-correction h3{margin:0;font-size:1.2rem}.mb-lifecycle-correction header p{margin:4px 0 0;color:var(--mb-muted)}.mb-lifecycle-live-warning,.mb-lifecycle-correction-reason,.mb-lifecycle-correction-contact{display:grid;gap:4px;padding:13px 15px;border-radius:10px}.mb-lifecycle-live-warning{border-left:4px solid #b97716;background:#fff8e8;color:#6f470e}.mb-lifecycle-correction-reason{grid-template-columns:max-content minmax(0,1fr);align-items:start;column-gap:18px;row-gap:10px;border-left:4px solid #c5443f;background:#fff2f1;color:#812d29}.mb-lifecycle-correction-reason-code,.mb-lifecycle-correction-reason-description{display:grid;gap:4px}.mb-lifecycle-correction-reason-code>span,.mb-lifecycle-correction-reason-description>span,.mb-lifecycle-correction-reason-code small>span{color:#9b514d;font-size:.7rem;font-weight:850;letter-spacing:.07em;text-transform:uppercase}.mb-lifecycle-correction-reason code{width:max-content;border:1px solid #e8b4b0;border-radius:6px;background:rgba(255,255,255,.66);color:#812d29;font:750 .84rem/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;padding:3px 7px}.mb-lifecycle-correction-reason-code small{display:grid;gap:1px;margin-top:3px;color:#9b514d;font:500 .72rem/1.35 ui-monospace,SFMono-Regular,Menlo,monospace}.mb-lifecycle-correction-reason-description strong{font-size:.94rem}.mb-lifecycle-correction-reason>ul{grid-column:1/-1;display:grid;gap:5px;margin:0;padding:8px 0 0 18px;border-top:1px solid #ecc7c4}.mb-lifecycle-correction-reason li{padding-left:3px}.mb-lifecycle-correction-reason li code{margin-right:7px}.mb-lifecycle-correction-contact{border:1px solid color-mix(in srgb,var(--mb-accent) 35%,var(--mb-border));background:color-mix(in srgb,var(--mb-accent) 7%,var(--mb-surface))}.mb-lifecycle-correction-contact dl{display:grid;gap:10px;margin:8px 0 0}.mb-lifecycle-correction-contact dl>div{display:grid;grid-template-columns:68px minmax(0,1fr);gap:10px}.mb-lifecycle-correction-contact dt{padding-top:2px;color:var(--mb-muted);font-size:.78rem;font-weight:800;text-transform:uppercase}.mb-lifecycle-correction-contact dd{min-width:0;margin:0;overflow-wrap:anywhere}.mb-lifecycle-correction-contact dd ul{display:grid;gap:4px;margin:0;padding:0;list-style:none}.mb-lifecycle-correction-contact dd li{min-width:0}.mb-lifecycle-correction-contact a{color:var(--mb-accent);text-underline-offset:2px}.mb-lifecycle-correction-note{display:grid;gap:6px;font-size:.85rem;font-weight:750}.mb-lifecycle-correction-note textarea{min-height:76px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius,8px);background:var(--mb-input,#fff);color:var(--mb-text);font:inherit;padding:10px 12px;resize:vertical}
.mb-payment-total{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-radius:9px;background:var(--mb-soft)}.mb-payment-total strong{font-size:1.12rem}
.mb-lifecycle-deadline-hint{margin:0;padding:10px 12px;border-radius:9px;background:color-mix(in srgb,var(--mb-warning,#8a5c17) 10%,var(--mb-surface));color:var(--mb-warning,#8a5c17);font-size:.85rem}
@media(max-width:700px){.mb-lifecycle-attempt-detail dl{grid-template-columns:repeat(2,minmax(0,1fr))}.mb-lifecycle-notes form{grid-template-columns:1fr}.mb-lifecycle-notes form button{width:100%}.mb-lifecycle-head,.mb-lifecycle-card header{align-items:stretch;flex-direction:column}.mb-lifecycle-head>.mb-lifecycle-button{width:100%}.mb-lifecycle-actions-sheet{bottom:calc(var(--mb-host-bottom-offset,72px) + env(safe-area-inset-bottom) + 8px);grid-template-columns:repeat(2,minmax(0,1fr))}.mb-lifecycle-actions-sheet .mb-lifecycle-button:last-child:nth-child(odd){grid-column:1/-1}.mb-lifecycle-fields.two{grid-template-columns:1fr}.mb-lifecycle-fields .full{grid-column:auto}.mb-lifecycle-dialog-backdrop{align-items:end;padding:0}.mb-lifecycle-dialog{max-height:calc(100dvh - 12px)}.mb-lifecycle-dialog .mb-lifecycle-panel,.mb-lifecycle-correction{border-radius:18px 18px 0 0}.mb-lifecycle-correction{padding:18px 12px calc(18px + env(safe-area-inset-bottom))}.mb-lifecycle-correction>header{align-items:stretch;flex-direction:column;padding-right:56px}.mb-lifecycle-correction-reason{grid-template-columns:1fr}.mb-lifecycle-correction-reason>ul{grid-column:auto}.mb-lifecycle-correction-contact dl>div{grid-template-columns:1fr;gap:2px}.mb-lifecycle-tabs button{font-size:.9rem}.mb-lifecycle-title h2{font-size:1.4rem}}
`;
