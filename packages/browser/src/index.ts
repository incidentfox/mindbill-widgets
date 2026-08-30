export const DEFAULT_API_BASE_URL = "https://app.mindbill.org";
export const DEFAULT_SESSION_ENDPOINT = "/api/mindbill/bill-session";

export type BillReviewDocumentType =
  | "final_report"
  | "letter_of_attestation"
  | "proof_of_service"
  | "form_122"
  | "return_to_work_voucher"
  | "w9"
  | "medical_records"
  | "appeal"
  | "other";

export type BillReviewBillingProvider = {
  name: string;
  taxId: string;
  npi: string;
  billType: "Professional" | "Institutional";
  phone?: string;
  billingStreet?: string;
  billingCity?: string;
  billingState?: string;
  billingZip?: string;
};

export type BillReviewClinician = {
  name: string;
  specialty: string;
  npi: string;
  taxonomy?: string;
  licenseNumber?: string;
  licenseState?: string;
  signaturePng?: string;
  signatureKey?: string;
  isQME?: boolean;
  isAME?: boolean;
  email?: string;
  active?: boolean;
};

export type BillReviewLocation = {
  billingProviderId?: string;
  name: string;
  nickname?: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  county?: string;
  posCode?: string;
  isPrimary?: boolean;
  active?: boolean;
};

export type BillReviewLineItem = {
  id?: string;
  code: string;
  modifiers: string[];
  units: number;
  charge: number;
  feeSchedule?: number;
  serviceDate?: string | null;
  serviceDateEnd?: string | null;
  diagnosisPointers?: number[];
};

export type BillReviewAttachment = {
  id: string;
  filename: string;
  description?: string | null;
  documentType: string;
  reportType?: string | null;
  source?: string;
  addedAt?: string;
  contentUrl?: string;
};

export type BillReviewPayer = {
  id: string;
  name: string;
  hasElectronic?: boolean;
  states?: string[];
  confidence?: "high" | "medium" | "directory";
  recommended?: boolean;
  signals?: Array<{
    kind: "name" | "claim_number";
    state: "match" | "warning";
    label: string;
  }>;
};

export type BillReviewFeatures = {
  authorizationNumber?: boolean;
  serviceDateRange?: boolean;
  wcabNumber?: boolean;
  codingPresets?: boolean;
};

export type BillReviewClaimPatternStatus = {
  state: "match" | "warning" | "unknown";
  label: string;
  detail?: string;
  suggestion?: string;
};

export type BillReviewData = {
  bill: {
    id: string;
    billNumber: string | number;
    status: string;
    transmissionState?: string;
    billingMode: "med_legal" | "professional";
    dos: string;
    dosEnd?: string | null;
    authorizationNumber?: string | null;
    billingSnapshot?: {
      billingProvider?: BillReviewBillingProvider;
      renderingProvider?: BillReviewClinician;
      placeOfService?: BillReviewLocation;
    } | null;
    lineItems: BillReviewLineItem[];
    attachments: BillReviewAttachment[];
    totalCharge: number;
    totalPaid: number;
    balanceDue: number;
  };
  patient: {
    name: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    dob?: string;
  };
  injury: {
    claimNumber?: string;
    employer?: string;
    doi?: string;
    injuryEndDate?: string;
    cumulativeTrauma?: boolean;
    adjNumber?: string;
    claimsAdminId?: string;
    claimsAdminName?: string;
    claimPatternStatus?: BillReviewClaimPatternStatus;
  };
};

export type BillReviewSaveInput = {
  claimsAdminId: string;
  patientOverrides?: {
    firstName: string;
    middleName?: string;
    lastName: string;
    dob?: string;
  };
  injuryOverrides?: {
    claimNumber?: string;
    employer?: string;
    doi?: string;
    injuryEndDate?: string;
    cumulativeTrauma?: boolean;
    adjNumber?: string;
  };
  dos: string;
  dosEnd?: string | null;
  authorizationNumber?: string | null;
  billingProvider?: BillReviewBillingProvider;
  renderingProvider?: BillReviewClinician;
  placeOfService?: BillReviewLocation;
  lineItems: Array<{
    id?: string;
    code: string;
    modifiers: string[];
    units: number;
    charge?: number;
    serviceDate?: string | null;
    serviceDateEnd?: string | null;
    diagnosisPointers?: number[];
  }>;
};

function pickDefined(
  source: object,
  keys: readonly string[],
): Record<string, unknown> {
  const record = source as Record<string, unknown>;
  return Object.fromEntries(
    keys.flatMap((key) => record[key] === undefined ? [] : [[key, record[key]]]),
  );
}

/**
 * Removes read-only snapshot metadata before a review mutation is sent.
 * Lifecycle reads can include display-only fields such as entity IDs; the v2
 * write contract accepts only the values that should be frozen onto the bill.
 */
export function sanitizeBillReviewSaveInput(
  input: BillReviewSaveInput,
): BillReviewSaveInput {
  return {
    claimsAdminId: input.claimsAdminId,
    ...(input.patientOverrides ? {
      patientOverrides: pickDefined(input.patientOverrides, [
        "firstName", "middleName", "lastName", "dob",
      ]) as NonNullable<BillReviewSaveInput["patientOverrides"]>,
    } : {}),
    ...(input.injuryOverrides ? {
      injuryOverrides: pickDefined(input.injuryOverrides, [
        "claimNumber", "employer", "doi", "injuryEndDate",
        "cumulativeTrauma", "adjNumber",
      ]) as NonNullable<BillReviewSaveInput["injuryOverrides"]>,
    } : {}),
    dos: input.dos,
    ...(input.dosEnd !== undefined ? { dosEnd: input.dosEnd } : {}),
    ...(input.authorizationNumber !== undefined
      ? { authorizationNumber: input.authorizationNumber }
      : {}),
    ...(input.billingProvider ? {
      billingProvider: pickDefined(input.billingProvider, [
        "name", "taxId", "npi", "billType", "phone", "billingStreet",
        "billingCity", "billingState", "billingZip",
      ]) as BillReviewBillingProvider,
    } : {}),
    ...(input.renderingProvider ? {
      renderingProvider: pickDefined(input.renderingProvider, [
        "name", "specialty", "npi", "taxonomy", "licenseNumber",
        "licenseState", "signaturePng", "signatureKey", "isQME", "isAME",
        "email", "active",
      ]) as BillReviewClinician,
    } : {}),
    ...(input.placeOfService ? {
      placeOfService: pickDefined(input.placeOfService, [
        "billingProviderId", "name", "nickname", "street", "city", "state",
        "zip", "county", "posCode", "isPrimary", "active",
      ]) as BillReviewLocation,
    } : {}),
    lineItems: input.lineItems.map((line) => pickDefined(line, [
      "id", "code", "modifiers", "units", "charge", "serviceDate",
      "serviceDateEnd", "diagnosisPointers",
    ]) as BillReviewSaveInput["lineItems"][number]),
  };
}

export type BillSubmissionRoute = "ebill" | "fax" | "mail" | "email";
export type BillDeliveryOption = {
  route: BillSubmissionRoute;
  label: string;
  detail: string;
  fallback: boolean;
  confidence: string;
  payerName: string;
  target?: string;
  chKey?: string;
  payerId?: string;
  printAndMail?: boolean;
  costUsd?: number;
};
export type BillDeliveryOptions = {
  payerName: string;
  recommended: BillDeliveryOption;
  options: BillDeliveryOption[];
  contacts: {
    faxNumber?: string | null;
    claimsEmail?: string | null;
    portalUrl?: string | null;
    mailingAddress?: string | null;
  };
};
export type SubmitBillInput = {
  route: BillSubmissionRoute;
  destination?: {
    faxNumber?: string;
    email?: string;
    mailingAddress?: string;
  };
  attention?: string;
  subject?: string;
  note?: string;
};
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
  sessionEndpoint?: string | undefined;
  getSession?: BillLifecycleSessionProvider | undefined;
  apiBaseUrl?: string | undefined;
  fetch?: typeof globalThis.fetch | undefined;
};

export type BillLifecycleClient = {
  getLifecycle: (signal?: AbortSignal) => Promise<BillLifecycleData>;
  searchClaimsAdministrators: (query: string, claimNumber?: string) => Promise<BillReviewPayer[]>;
  getDeliveryOptions: () => Promise<BillDeliveryOptions>;
  saveReview: (input: BillReviewSaveInput) => Promise<BillLifecycleData>;
  submitBill: (input: BillReviewSaveInput, submission: SubmitBillInput) => Promise<BillLifecycleData>;
  addAttachment: (file: File, documentType: BillReviewDocumentType, description?: string) => Promise<BillLifecycleData>;
  removeAttachment: (attachmentId: string) => Promise<BillLifecycleData>;
  getAttachment: (attachmentId: string) => Promise<Blob>;
  getEor: (documentId: string) => Promise<Blob>;
  closeBill: (input: CloseBillInput) => Promise<BillLifecycleData>;
  postPayment: (input: PostBillPaymentInput) => Promise<BillLifecycleData>;
  submitSecondReview: (input: SubmitSecondReviewInput) => Promise<BillLifecycleData>;
  startCorrection: () => Promise<{ replacementBillId: string; data: BillLifecycleData }>;
  clearSession: () => void;
};

async function responseError(response: Response, fallback: string): Promise<Error> {
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
    throw new Error("The billing session endpoint returned an invalid response.");
  }
  const candidate = value as { token?: unknown; expiresAt?: unknown; apiBaseUrl?: unknown; session?: unknown; data?: unknown };
  const nested = candidate.session ?? candidate.data;
  const session = nested && typeof nested === "object" ? nested as typeof candidate : candidate;
  if (typeof session.token !== "string" || session.token.length < 8) {
    throw new Error("The billing session endpoint did not return a browser session token.");
  }
  return {
    token: session.token,
    ...(typeof session.expiresAt === "string" ? { expiresAt: session.expiresAt } : {}),
    ...(typeof session.apiBaseUrl === "string" ? { apiBaseUrl: session.apiBaseUrl } : {}),
  };
}

function normalizeLifecycle(value: unknown): BillLifecycleData {
  if (!value || typeof value !== "object") {
    throw new Error("The billing service returned an invalid bill lifecycle.");
  }
  const data = value as Partial<BillLifecycleData>;
  if (!data.bill || !data.patient || !data.injury || !data.lifecycle || !Array.isArray(data.lifecycle.actions) || !Array.isArray(data.eors)) {
    throw new Error("The billing service returned an invalid bill lifecycle.");
  }
  return data as BillLifecycleData;
}

function normalizeDeliveryOptions(value: unknown): BillDeliveryOptions {
  if (!value || typeof value !== "object") {
    throw new Error("The billing service returned invalid delivery options.");
  }
  const data = value as Partial<BillDeliveryOptions>;
  if (
    typeof data.payerName !== "string"
    || !data.recommended
    || typeof data.recommended !== "object"
    || !["ebill", "fax", "mail", "email"].includes(data.recommended.route ?? "")
    || !Array.isArray(data.options)
    || !data.contacts
  ) {
    throw new Error("The billing service returned invalid delivery options.");
  }
  return data as BillDeliveryOptions;
}

function idempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `mb-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Browser-safe, framework-neutral client for the complete bill lifecycle. */
export function createBillLifecycleClient({
  billId,
  sessionEndpoint = DEFAULT_SESSION_ENDPOINT,
  getSession,
  apiBaseUrl = DEFAULT_API_BASE_URL,
  fetch: fetchOverride,
}: BillLifecycleClientOptions): BillLifecycleClient {
  const fetcher = fetchOverride ?? globalThis.fetch;
  if (typeof fetcher !== "function") throw new Error("A Fetch API implementation is required.");
  let session: BillLifecycleSession | null = null;
  let sessionRequest: Promise<BillLifecycleSession> | null = null;

  const mintSession = async (signal: AbortSignal, force = false): Promise<BillLifecycleSession> => {
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
        if (!response.ok) throw await responseError(response, "The billing session could not be created.");
        return response.json();
      });
    const request = Promise.resolve(pending).then(normalizeSession).then((nextSession) => {
      session = nextSession;
      return nextSession;
    }).finally(() => {
      if (sessionRequest === request) sessionRequest = null;
    });
    sessionRequest = request;
    return request;
  };

  const request = async (path: string, init: RequestInit = {}, providedSignal?: AbortSignal): Promise<Response> => {
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
    const response = await request("/partner/v2/browser/bill", {}, signal);
    if (!response.ok) throw await responseError(response, "Bill lifecycle could not be loaded.");
    const body = await response.json() as { data?: unknown };
    return normalizeLifecycle(body.data);
  };

  const searchClaimsAdministrators = async (query: string, claimNumber?: string): Promise<BillReviewPayer[]> => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (claimNumber?.trim()) params.set("claimNumber", claimNumber.trim());
    const response = await request(`/partner/v2/browser/claims-administrators?${params.toString()}`);
    if (!response.ok) throw await responseError(response, "Claims administrator search is unavailable.");
    const body = await response.json() as { results?: unknown };
    if (!Array.isArray(body.results)) throw new Error("Claims administrator search returned an invalid response.");
    return body.results.flatMap((value): BillReviewPayer[] => {
      if (!value || typeof value !== "object") return [];
      const payer = value as Partial<BillReviewPayer>;
      if (typeof payer.id !== "string" || typeof payer.name !== "string") return [];
      return [{
        id: payer.id,
        name: payer.name,
        ...(typeof payer.hasElectronic === "boolean" ? { hasElectronic: payer.hasElectronic } : {}),
        ...(Array.isArray(payer.states)
          ? { states: payer.states.filter((state): state is string => typeof state === "string") }
          : {}),
        ...(["high", "medium", "directory"].includes(payer.confidence ?? "")
          ? { confidence: payer.confidence as NonNullable<BillReviewPayer["confidence"]> }
          : {}),
        ...(typeof payer.recommended === "boolean" ? { recommended: payer.recommended } : {}),
        ...(Array.isArray(payer.signals)
          ? {
              signals: payer.signals.flatMap((signal) => {
                if (!signal || typeof signal !== "object") return [];
                const candidate = signal as { kind?: unknown; state?: unknown; label?: unknown };
                if (
                  !["name", "claim_number"].includes(String(candidate.kind))
                  || !["match", "warning"].includes(String(candidate.state))
                  || typeof candidate.label !== "string"
                ) return [];
                return [{
                  kind: candidate.kind as "name" | "claim_number",
                  state: candidate.state as "match" | "warning",
                  label: candidate.label,
                }];
              }),
            }
          : {}),
      }];
    });
  };

  const mutation = async (path: string, init: RequestInit, fallback: string) => {
    const headers = new Headers(init.headers);
    headers.set("idempotency-key", idempotencyKey());
    const response = await request(path, { ...init, headers });
    if (!response.ok) throw await responseError(response, fallback);
    return response;
  };
  const action = async (input: Record<string, unknown>, fallback: string): Promise<BillLifecycleData> => {
    const response = await mutation("/partner/v2/browser/actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }, fallback);
    const body = await response.json() as { data?: unknown };
    return normalizeLifecycle(body.data);
  };
  const saveReview = async (input: BillReviewSaveInput): Promise<BillLifecycleData> => {
    await mutation("/partner/v2/browser/bill", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sanitizeBillReviewSaveInput(input)),
    }, "Bill changes could not be saved.");
    return loadLifecycle();
  };

  return {
    clearSession() { session = null; sessionRequest = null; },
    getLifecycle: loadLifecycle,
    searchClaimsAdministrators,
    async getDeliveryOptions() {
      const response = await request("/partner/v2/browser/delivery-options");
      if (!response.ok) throw await responseError(response, "Delivery options could not be loaded.");
      const body = await response.json() as { data?: unknown };
      return normalizeDeliveryOptions(body.data);
    },
    saveReview,
    async submitBill(input, submission) {
      await saveReview(input);
      await mutation("/partner/v2/browser/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(submission),
      }, "Bill could not be submitted.");
      return loadLifecycle();
    },
    async addAttachment(file, documentType, description) {
      const body = new FormData();
      body.set("file", file);
      body.set("documentType", documentType);
      if (description) body.set("description", description);
      await mutation("/partner/v2/browser/documents", { method: "POST", body }, "Document could not be attached.");
      return loadLifecycle();
    },
    async removeAttachment(attachmentId) {
      await mutation(`/partner/v2/browser/documents/${encodeURIComponent(attachmentId)}`, { method: "DELETE" }, "Document could not be removed.");
      return loadLifecycle();
    },
    async getAttachment(attachmentId) {
      const response = await request(`/partner/v2/browser/documents/${encodeURIComponent(attachmentId)}`);
      if (!response.ok) throw await responseError(response, "Document could not be opened.");
      return response.blob();
    },
    async getEor(documentId) {
      const response = await request(`/partner/v2/browser/eors/${encodeURIComponent(documentId)}`);
      if (!response.ok) throw await responseError(response, "EOR could not be opened.");
      return response.blob();
    },
    closeBill(input) { return action({ action: "close", ...input }, "Bill could not be closed."); },
    postPayment(input) { return action({ action: "post_payment", ...input, checkNumber: input.checkNumber ?? "" }, "Payment could not be posted."); },
    submitSecondReview(input) { return action({ action: "second_review", ...input }, "Second Review could not be submitted."); },
    async startCorrection() {
      const response = await mutation("/partner/v2/browser/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "start_correction" }),
      }, "Correction draft could not be created.");
      const body = await response.json() as { replacementBillId?: unknown; data?: unknown };
      if (typeof body.replacementBillId !== "string") throw new Error("The billing service did not return the correction bill ID.");
      return { replacementBillId: body.replacementBillId, data: normalizeLifecycle(body.data) };
    },
  };
}
