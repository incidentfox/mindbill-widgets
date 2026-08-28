import { createHmac, timingSafeEqual } from "node:crypto";

export const MINDBILL_API_BASE_URL = "https://app.mindbill.org";
export const MINDBILL_BROWSER_COMPONENTS = ["bill-review", "bill-timeline"] as const;
export type MindBillBrowserComponent = (typeof MINDBILL_BROWSER_COMPONENTS)[number];

export type MindBillClientOptions = {
  /** A server credential. Never expose this value to browser code. */
  apiKey: string;
  /** Optional when the credential can access more than one customer organization. */
  organizationId?: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
};

export type Address = {
  line1: string;
  city: string;
  state: string;
  postalCode: string;
};

export type PatientSnapshot = {
  /** Use either id or externalId, never both. */
  id?: string;
  externalId?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth?: string;
  ssn?: string;
  gender?: "M" | "F" | "X";
  phone?: string;
  address: Address;
};

export type ClaimsAdministratorReference = { id?: string; name: string };

export type ClaimSnapshot = {
  /** Use either id or externalId, never both. */
  id?: string;
  externalId?: string;
  claimNumber: string;
  adjNumber?: string;
  employer?: string;
  dateOfInjury?: string;
  injuryState?: string;
  description?: string;
  claimsAdministrator?: ClaimsAdministratorReference;
};

export type BillingProviderSnapshot = {
  name?: string;
  taxId?: string;
  npi?: string;
  phone?: string;
  address?: Address;
};

export type RenderingProviderSnapshot = {
  name?: string;
  specialty?: string;
  npi?: string;
  taxonomy?: string;
  licenseNumber?: string;
  licenseState?: string;
  isQme?: boolean;
  isAme?: boolean;
};

export type ServiceLocationSnapshot = {
  name?: string;
  address?: Address;
  placeOfServiceCode?: string;
};

export type ServiceLine = {
  id?: string;
  code: string;
  modifiers?: string[];
  units?: number;
};

export type CreateBillRequest = {
  /** Stable report, case, or work-item ID in your system. */
  externalId?: string;
  /** `professional` is reserved and currently returns a capability error. */
  billingMode?: "med_legal" | "professional";
  patient: PatientSnapshot;
  claim: ClaimSnapshot;
  service: {
    date: string;
    endDate?: string | null;
    authorizationNumber?: string | null;
  };
  billingProvider?: BillingProviderSnapshot;
  renderingProvider?: RenderingProviderSnapshot;
  serviceLocation?: ServiceLocationSnapshot;
  diagnoses?: string[];
  serviceLines?: Array<Omit<ServiceLine, "id">>;
};

type PatientPatch = Partial<Omit<PatientSnapshot, "id" | "externalId" | "address">> & {
  address?: Partial<Address>;
};

export type UpdateBillRequest = {
  patient?: PatientPatch;
  claim?: Partial<Omit<ClaimSnapshot, "id" | "externalId">>;
  service?: Partial<CreateBillRequest["service"]>;
  billingProvider?: BillingProviderSnapshot;
  renderingProvider?: RenderingProviderSnapshot;
  serviceLocation?: ServiceLocationSnapshot;
  diagnoses?: string[];
  serviceLines?: ServiceLine[];
};

export const BILL_DOCUMENT_TYPES = [
  "final_report",
  "proof_of_service",
  "letter_of_attestation",
  "form_122",
  "return_to_work_voucher",
  "w9",
  "medical_records",
  "appeal",
  "other",
] as const;
export type BillDocumentType = (typeof BILL_DOCUMENT_TYPES)[number];

export type BillDocument = {
  id: string;
  externalId: string | null;
  filename: string;
  description: string | null;
  documentType: BillDocumentType;
  reportType: string | null;
  reportTypeCode: string | null;
  source: string;
  addedAt: string;
  contentUrl: string;
};

export type Bill = {
  id: string;
  externalId: string | null;
  state: string;
  billingMode: "med_legal";
  billNumber: number | null;
  patient: {
    firstName: string;
    middleName: string | null;
    lastName: string;
    dateOfBirth: string | null;
    ssn: string | null;
    gender: "M" | "F" | "X" | null;
    phone: string | null;
    address: Address;
  };
  claim: {
    claimNumber: string;
    adjNumber: string | null;
    employer: string | null;
    dateOfInjury: string | null;
    injuryState: string | null;
    description: string | null;
    diagnoses: string[];
    claimsAdministrator: (ClaimsAdministratorReference & { name?: string | null }) | null;
  };
  service: { date: string; endDate: string | null; authorizationNumber: string | null };
  billingProvider: BillingProviderSnapshot | null;
  renderingProvider: RenderingProviderSnapshot | null;
  serviceLocation: ServiceLocationSnapshot | null;
  serviceLines: Array<ServiceLine & { allowed?: number }>;
  documents: BillDocument[];
  amounts: { charged: number; paid: number; balance: number };
};

export type BillPage = { data: Bill[]; nextCursor: string | null };
export type ListBillsQuery = Partial<{
  cursor: string;
  limit: number;
  externalId: string;
  patientExternalId: string;
  claimExternalId: string;
  state: string;
}>;

export type UploadBillDocumentRequest = {
  file: Blob;
  filename: string;
  documentType: BillDocumentType;
  externalId?: string;
  description?: string;
};
export type BillDocumentListResponse = { data: BillDocument[] };
export type BillDocumentResponse = { data: BillDocument };

export type SubmitRoute = "ebill" | "fax" | "mail" | "email";
export type SubmitBillRequest = { route?: SubmitRoute };
export type SandboxBillSubmission = {
  ok: true;
  sandbox: true;
  billId: string;
  controlNumber: string;
  state: "submitted";
  acknowledgments: Array<{ type: "999" | "277CA"; status: "accepted" }>;
};
export type LiveBillSubmission = {
  bill: Bill;
  transmissionState: string;
  transmissionError?: string;
  uploaded: string[];
  [key: string]: unknown;
};
export type SubmitBillResponse = SandboxBillSubmission | LiveBillSubmission;

export type BillStatus = {
  billId: string;
  externalId: string | null;
  state: string;
  nativeStatus: string | null;
  totalCharge: number;
  totalPaid: number;
  balanceDue: number;
  lastEventId: string | null;
  updatedAt: string | null;
};
export type BillStatusResponse = { data: BillStatus };

export type BillEorLineItem = {
  id: string;
  code: string;
  paid: number;
  allowedAmount: number | null;
  adjustmentAmount: number | null;
  patientResponsibility: number | null;
  reasonCodes: string[];
};
export type BillEorDocument = {
  id: string;
  filename: string;
  contentType: string | null;
  addedAt: string;
  contentUrl: string;
};
export type BillEorResponse = {
  data: {
    billId: string;
    reportedPaid: number | null;
    totalPaid: number;
    balanceDue: number;
    payment: unknown | null;
    payments: unknown[];
    lineItems: BillEorLineItem[];
    documents: BillEorDocument[];
  };
};

export type BillReviewType = "second_review" | "independent_bill_review";
export type BillReview = {
  id: string;
  billId: string;
  originalBillId: string;
  externalId: string | null;
  type: BillReviewType;
  state: "draft" | "submitted";
  reason: string;
  disputedAmount: number | null;
  payerClaimControlNumber: string | null;
  attachmentIds: string[];
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type CreateBillReviewRequest = {
  externalId?: string;
  type: BillReviewType;
  reason: string;
  disputedAmount?: number;
  payerClaimControlNumber?: string;
  attachmentIds?: string[];
};
export type BillReviewResponse = { data: BillReview };
export type BillReviewListResponse = { data: BillReview[] };

export type BillAction =
  | { action: "close"; reason: string }
  | { action: "post_payment"; amount: number; method: "check" | "eft"; checkNumber?: string; depositDate: string; note?: string }
  | { action: "second_review"; reason: string; payerClaimControlNumber: string; disputedAmount?: number; attachmentIds?: string[]; route?: SubmitRoute }
  | { action: "start_correction" };
export type BillActionResponse = { ok: true; replacementBillId?: string; data: Record<string, unknown> | null };

export type MindBillEvent = {
  id: string;
  sequence: string;
  type: string;
  apiVersion: string;
  createdAt: string;
  data: Record<string, unknown>;
};
export type EventPage = { events: MindBillEvent[]; nextCursor: string | null };
export type WebhookDeliveryPage = { data: Record<string, unknown>[]; nextCursor: string | null };

export type BrowserSessionRequest = {
  component: MindBillBrowserComponent;
  billId: string;
  /** Exact HTTPS origin, without path, query, fragment, or credentials. */
  allowedOrigin: string;
  expiresIn?: number;
};
export type BrowserSession = {
  sessionId: string;
  component: MindBillBrowserComponent;
  token: string;
  embedUrl: string;
  expiresAt: string;
};

export class MindBillError extends Error {
  readonly name = "MindBillError";
  constructor(
    public readonly status: number,
    public readonly problem: Record<string, unknown>,
    public readonly requestId?: string,
  ) {
    super(String(problem.detail ?? problem.title ?? `MindBill API error ${status}`));
  }
}

type RequestOptions = { idempotencyKey?: string };

async function parseJson(response: Response): Promise<Record<string, unknown>> {
  if (response.status === 204) return {};
  return response.json().catch(() => ({})) as Promise<Record<string, unknown>>;
}

function exactHttpsOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

export class MindBillClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof globalThis.fetch;

  constructor(private readonly options: MindBillClientOptions) {
    if (!options.apiKey) throw new Error("apiKey is required");
    this.baseUrl = (options.baseUrl ?? MINDBILL_API_BASE_URL).replace(/\/$/, "");
    this.fetcher = options.fetch ?? globalThis.fetch;
    if (!this.fetcher) throw new Error("A fetch implementation is required");
  }

  private headers(options: RequestOptions, json = false): Record<string, string> {
    return {
      authorization: `Bearer ${this.options.apiKey}`,
      accept: "application/json",
      ...(json ? { "content-type": "application/json" } : {}),
      ...(this.options.organizationId ? { "x-mindbill-org-id": this.options.organizationId } : {}),
      ...(options.idempotencyKey ? { "idempotency-key": options.idempotencyKey } : {}),
    };
  }

  private async request<T>(method: string, path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers(options, body !== undefined),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload = await parseJson(response);
    if (!response.ok) throw this.error(response, payload);
    return payload as T;
  }

  private error(response: Response, payload: Record<string, unknown>): MindBillError {
    const requestId = response.headers.get("x-request-id") ?? (typeof payload.requestId === "string" ? payload.requestId : undefined);
    return new MindBillError(response.status, payload, requestId);
  }

  createBill(input: CreateBillRequest, idempotencyKey: string): Promise<Bill> {
    return this.request("POST", "/partner/v2/bills", input, { idempotencyKey });
  }

  getBill(billId: string): Promise<Bill> {
    return this.request("GET", `/partner/v2/bills/${encodeURIComponent(billId)}`);
  }

  updateBill(billId: string, input: UpdateBillRequest, idempotencyKey: string): Promise<Bill> {
    return this.request("PATCH", `/partner/v2/bills/${encodeURIComponent(billId)}`, input, { idempotencyKey });
  }

  listBills(query: ListBillsQuery = {}): Promise<BillPage> {
    const search = new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)])).toString();
    return this.request("GET", `/partner/v2/bills${search ? `?${search}` : ""}`);
  }

  listBillDocuments(billId: string): Promise<BillDocumentListResponse> {
    return this.request("GET", `/partner/v2/bills/${encodeURIComponent(billId)}/documents`);
  }

  async uploadBillDocument(billId: string, input: UploadBillDocumentRequest, idempotencyKey: string): Promise<BillDocumentResponse> {
    if (!BILL_DOCUMENT_TYPES.includes(input.documentType)) {
      throw new Error(`documentType must be one of: ${BILL_DOCUMENT_TYPES.join(", ")}`);
    }
    const body = new FormData();
    body.append("file", input.file, input.filename);
    body.append("documentType", input.documentType);
    if (input.externalId) body.append("externalId", input.externalId);
    if (input.description) body.append("description", input.description);
    const response = await this.fetcher(`${this.baseUrl}/partner/v2/bills/${encodeURIComponent(billId)}/documents`, {
      method: "POST",
      headers: this.headers({ idempotencyKey }),
      body,
    });
    const payload = await parseJson(response);
    if (!response.ok) throw this.error(response, payload);
    return payload as BillDocumentResponse;
  }

  async getBillDocument(billId: string, documentId: string): Promise<Blob> {
    const response = await this.fetcher(
      `${this.baseUrl}/partner/v2/bills/${encodeURIComponent(billId)}/documents/${encodeURIComponent(documentId)}`,
      { headers: this.headers({}) },
    );
    if (!response.ok) throw this.error(response, await parseJson(response));
    return response.blob();
  }

  deleteBillDocument(billId: string, documentId: string, idempotencyKey: string): Promise<void> {
    return this.request("DELETE", `/partner/v2/bills/${encodeURIComponent(billId)}/documents/${encodeURIComponent(documentId)}`, undefined, { idempotencyKey });
  }

  submitBill(billId: string, input: SubmitBillRequest, idempotencyKey: string): Promise<SubmitBillResponse> {
    return this.request("POST", `/partner/v2/bills/${encodeURIComponent(billId)}/submissions`, input, { idempotencyKey });
  }

  getBillStatus(billId: string): Promise<BillStatusResponse> {
    return this.request("GET", `/partner/v2/bills/${encodeURIComponent(billId)}/status`);
  }

  getBillEor(billId: string): Promise<BillEorResponse> {
    return this.request("GET", `/partner/v2/bills/${encodeURIComponent(billId)}/eor`);
  }

  performBillAction(billId: string, input: BillAction, idempotencyKey: string): Promise<BillActionResponse> {
    return this.request("POST", `/partner/v2/bills/${encodeURIComponent(billId)}/actions`, input, { idempotencyKey });
  }

  listBillReviews(billId: string): Promise<BillReviewListResponse> {
    return this.request("GET", `/partner/v2/bills/${encodeURIComponent(billId)}/reviews`);
  }

  createBillReview(billId: string, input: CreateBillReviewRequest, idempotencyKey: string): Promise<BillReviewResponse> {
    return this.request("POST", `/partner/v2/bills/${encodeURIComponent(billId)}/reviews`, input, { idempotencyKey });
  }

  getBillReview(billId: string, reviewId: string): Promise<BillReviewResponse> {
    return this.request("GET", `/partner/v2/bills/${encodeURIComponent(billId)}/reviews/${encodeURIComponent(reviewId)}`);
  }

  submitBillReview(billId: string, reviewId: string, idempotencyKey: string): Promise<BillReviewResponse> {
    return this.request("POST", `/partner/v2/bills/${encodeURIComponent(billId)}/reviews/${encodeURIComponent(reviewId)}/submissions`, {}, { idempotencyKey });
  }

  listEvents(cursor = "0", limit = 50): Promise<EventPage> {
    return this.request("GET", `/partner/v2/events?cursor=${encodeURIComponent(cursor)}&limit=${limit}`);
  }

  listWebhookDeliveries(cursor = "0", limit = 50): Promise<WebhookDeliveryPage> {
    return this.request("GET", `/partner/v2/webhook-deliveries?cursor=${encodeURIComponent(cursor)}&limit=${limit}`);
  }

  createBrowserSession(input: BrowserSessionRequest): Promise<BrowserSession> {
    if (!MINDBILL_BROWSER_COMPONENTS.includes(input.component)) {
      throw new Error(`component must be one of: ${MINDBILL_BROWSER_COMPONENTS.join(", ")}`);
    }
    if (!input.billId) throw new Error("billId is required");
    const allowedOrigin = exactHttpsOrigin(input.allowedOrigin);
    if (!allowedOrigin) throw new Error("allowedOrigin must be an exact HTTPS origin without credentials, path, query, or fragment");
    if (input.expiresIn !== undefined && (!Number.isInteger(input.expiresIn) || input.expiresIn < 60 || input.expiresIn > 3600)) {
      throw new Error("expiresIn must be an integer from 60 through 3600 seconds");
    }
    return this.request("POST", "/partner/v2/browser-sessions", { ...input, allowedOrigin });
  }
}

function normalizeSequence(sequence: string): string {
  if (!/^[0-9]+$/.test(sequence)) throw new Error("MindBill event sequence must contain decimal digits only");
  return sequence.replace(/^0+(?=\d)/, "");
}

/** Compare arbitrary-length event cursors without losing integer precision. */
export function compareMindBillEventSequence(left: string, right: string): -1 | 0 | 1 {
  const a = normalizeSequence(left);
  const b = normalizeSequence(right);
  if (a.length !== b.length) return a.length < b.length ? -1 : 1;
  return a === b ? 0 : a < b ? -1 : 1;
}

export type VerifyWebhookSignatureOptions = { toleranceSeconds?: number; now?: number };

/** Verify `MindBill-Signature` against the exact raw request body. */
export function verifyMindBillWebhookSignature(
  rawBody: string | Uint8Array,
  signatureHeader: string | null | undefined,
  secret: string,
  options: VerifyWebhookSignatureOptions = {},
): boolean {
  if (!signatureHeader || !secret) return false;
  const toleranceSeconds = options.toleranceSeconds ?? 300;
  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (!Number.isFinite(toleranceSeconds) || toleranceSeconds < 0 || !Number.isFinite(now)) return false;
  const values = signatureHeader.split(",").map((value) => value.trim());
  const timestamps = values.filter((value) => value.startsWith("t=")).map((value) => value.slice(2));
  const signatures = values.filter((value) => value.startsWith("v1=")).map((value) => value.slice(3));
  if (timestamps.length !== 1 || signatures.length === 0 || !/^[0-9]+$/.test(timestamps[0]!)) return false;
  const timestamp = Number(timestamps[0]);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(`${timestamps[0]}.`).update(rawBody).digest();
  return signatures.some((signature) => {
    if (!/^[0-9a-fA-F]{64}$/.test(signature)) return false;
    const supplied = Buffer.from(signature, "hex");
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  });
}
