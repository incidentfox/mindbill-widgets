import { createHmac, timingSafeEqual } from "node:crypto";

export const MINDBILL_API_BASE_URL = "https://app.mindbill.org/partner/v1";
export const MINDBILL_TERMS_VERSION = "2026-08-16";
export const MINDBILL_BAA_VERSION = "2026-08-16";

export type MindBillEnvironment = "sandbox" | "live";
export const MINDBILL_COMPONENTS = [
  "bill-timeline",
  "bill-review",
  "bill-from-report",
  "collections",
  "onboarding",
] as const;
export type MindBillComponent = (typeof MINDBILL_COMPONENTS)[number];
export const MINDBILL_SCOPES = [
  "account:read",
  "account:write",
  "keys:write",
  "orgs:read",
  "orgs:write",
  "bills:read",
  "bills:write",
  "bills:quote",
  "bills:submit",
  "events:read",
  "settings:read",
  "settings:write",
  "embed:write",
] as const;
export type MindBillScope = (typeof MINDBILL_SCOPES)[number];

export type MindBillClientOptions = {
  apiKey: string;
  organizationId?: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
};

export type RequestOptions = { idempotencyKey?: string };

export type DeveloperSignupRequest = {
  companyName: string;
  contactName: string;
  email: string;
  termsAccepted: true;
  termsVersion: typeof MINDBILL_TERMS_VERSION;
};

export type DeveloperSignupResponse = {
  partnerId: string;
  partnerSlug: string;
  accountId: string;
  credentialId: string;
  apiKey: string;
  environment: "sandbox";
};

export type DeveloperAccount = {
  id: string;
  email: string;
  contactName: string;
  status: "active" | "suspended";
  termsVersion: string;
  termsAcceptedAt: string;
  baaVersion: string | null;
  baaAcceptedAt: string | null;
  paymentMethodReady: boolean;
  liveAccessStatus: "not_requested" | "pending" | "approved" | "suspended";
  partnerSlug: string;
  companyName: string;
  ipAllowlist: string[];
  rateLimitPerMinute: number;
};

export type DeveloperSecurity = {
  ipAllowlist: string[];
  rateLimitPerMinute: number;
};
export type BaaAcceptance = {
  baaVersion: string;
  baaAcceptedAt: string;
  acceptedBy: string;
};
export type HostedSession = { id: string; url: string };
export type LiveAccessResponse = { status: "pending"; checkout: HostedSession };
export type MintCredentialRequest = {
  name: string;
  environment: MindBillEnvironment;
  organizationId?: string;
  scopes: MindBillScope[];
};
export type MintCredentialResponse = {
  credentialId: string;
  apiKey: string;
  keyPrefix: string;
  environment: MindBillEnvironment;
  scopes: MindBillScope[];
  organizationId: string | null;
  createdAt: string;
};

export type ManagedOrganizationProvisioning = {
  organizationId: string;
  status: "configuring";
  accessMode: "managed";
};
export type InvitedOrganizationProvisioning = {
  organizationId: string;
  status: "pending_activation";
  accessMode: "invite";
  /** One-time credential. Handle as a secret and never log it. */
  activationUrl: string;
  activationEmailSent: boolean;
};
export type ProvisionOrganizationSettings = {
  practiceIdentity?: Record<string, unknown>;
  billingProviders?: Record<string, unknown>[];
  renderingProviders?: Record<string, unknown>[];
  locations?: Record<string, unknown>[];
};
export type ProvisionManagedOrganizationRequest =
  ProvisionOrganizationSettings & {
    name: string;
    accessMode?: "managed";
  };
export type ProvisionInvitedOrganizationRequest =
  ProvisionOrganizationSettings & {
    name: string;
    accessMode: "invite";
    adminName: string;
    adminEmail: string;
  };
export type ProvisionOrganizationRequest =
  ProvisionManagedOrganizationRequest | ProvisionInvitedOrganizationRequest;
export type ProvisionOrganizationResponse =
  ManagedOrganizationProvisioning | InvitedOrganizationProvisioning;
export type GrantOrganizationUserAccessRequest = {
  adminName: string;
  adminEmail: string;
};

export type SourcePracticeIdentity = Partial<{
  name: string;
  legalName: string;
  taxId: string;
  npi: string;
  phone: string;
  email: string;
  website: string;
  posCodes: Array<{ code: string; name: string }>;
}>;
export type SourceRenderingProvider = {
  externalId: string;
  name: string;
  specialty?: string;
  npi: string;
  taxonomy?: string;
  licenseNumber?: string;
  licenseState?: string;
  isQME?: boolean;
  isAME?: boolean;
  email?: string;
  active?: boolean;
};
export type SourceLocation = {
  externalId: string;
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
export type SourceProfileRequest = {
  /** Stable namespace for the partner system, such as `acme-records`. */
  source: string;
  practiceIdentity?: SourcePracticeIdentity;
  /** When supplied, this is the complete provider snapshot for this source. */
  renderingProviders?: SourceRenderingProvider[];
  /** When supplied, this is the complete location snapshot for this source. */
  locations?: SourceLocation[];
};
export type SourceProfileMapping = { externalId: string; mindBillId: string };
export type SourceProfileResponse = {
  organizationId: string;
  source: string;
  synchronizedAt: string;
  providers?: SourceProfileMapping[];
  locations?: SourceProfileMapping[];
  onboarding: {
    complete: boolean;
    checklist: Array<{ key: string; label: string; complete: boolean }>;
  };
};

export type EmbedSessionRequest = {
  component: MindBillComponent;
  allowedOrigin: string;
  expiresIn?: number;
  billId?: string;
};
export type EmbedSession = {
  sessionId: string;
  component: MindBillComponent;
  token: string;
  embedUrl: string;
  /** Bill-scoped, organization-authorized link for the complete MindBill lifecycle. */
  mindBillUrl?: string;
  expiresAt: string;
};

export type Money = { amount: number; currency: "USD" };
export type ServiceLine = {
  code: string;
  modifiers?: string[];
  units?: number;
};
export type QuoteRequest = { lineItems: ServiceLine[] };
export type Quote = {
  currency?: "USD";
  lineItems?: Record<string, unknown>[];
  totalAllowed?: number;
  [key: string]: unknown;
};
export type NewPatientReference = { kind: "new" };
export type ExistingPatientReference = { kind: "existing"; id: string };
export type BillingProviderSnapshot = {
  taxId: string;
  npi: string;
  name: string;
  billType: "Professional" | "Institutional";
  phone?: string;
  billingStreet?: string;
  billingCity?: string;
  billingState?: string;
  billingZip?: string;
};
export type RenderingProviderSnapshot = {
  name: string;
  specialty?: string;
  npi: string;
  taxonomy?: string;
  licenseNumber?: string;
  licenseState?: string;
  isQME?: boolean;
  isAME?: boolean;
  email?: string;
};
export type LocationSnapshot = {
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
};
export type CreateBillRequest = {
  /** Stable bill/work-item ID in the partner system. */
  externalId?: string;
  fields?: Record<string, string>;
  patient: NewPatientReference | ExistingPatientReference;
  claimsAdminId?: string;
  /** Optional saved MindBill record. Inline data wins and is frozen onto this bill. */
  renderingProviderId?: string;
  renderingProvider?: RenderingProviderSnapshot;
  placeOfServiceId?: string;
  placeOfService?: LocationSnapshot;
  placeOfServiceCodeOverride?: string;
  billingProviderId?: string;
  billingProvider?: BillingProviderSnapshot;
  lineItems?: ServiceLine[];
  diagnosisCodes?: string[];
  payerSlug?: string;
  payerId?: string;
  payerName?: string;
  patientOverrides?: Record<string, string>;
  injuryOverrides?: Record<string, string>;
  allowDuplicatePatient?: boolean;
};
export type CreateBillResponse = {
  patientId: string;
  injuryId: string;
  billId: string;
  billNumber: number;
};
export type Bill = {
  id: string;
  status: string;
  externalId?: string | null;
  total?: Money;
  [key: string]: unknown;
};
export type BillResponse = { bill: Bill; multiple?: number; ids?: string[] };
export type BillPage = {
  bills: Bill[];
  limit: number;
  offset: number;
  hasMore: boolean;
  nextCursor: string | null;
  truncated?: boolean;
};
export type SubmitRoute = "ebill" | "fax" | "mail" | "email";
export type SubmitBillRequest = { route?: SubmitRoute };
export type SandboxBillSubmission = {
  ok: true;
  sandbox: true;
  billId: string;
  controlNumber: string;
  state: "paid";
  acknowledgments: Array<{ type: "999" | "277CA"; status: "accepted" }>;
  eor: { id: string; reportedPaid: number };
  payments: Array<{ id: string; amount: number }>;
  balanceDue: 0;
  [key: string]: unknown;
};
export type LiveBillSubmission = {
  bill: Bill;
  transmissionState: string;
  transmissionError?: string;
  dryRun: boolean;
  liveTransmit: boolean;
  clearinghouse: string;
  billFilename: string;
  attachmentFilename?: string;
  sbrPdfFilename?: string;
  sbrPdfPath?: string;
  uploaded: string[];
  lastEdiKey?: string;
  lastAttachmentKey?: string;
  artifactPath: string;
  clearinghouseUploadSkipped?: boolean;
  attachmentAdvisories: Array<{ id: string; message: string }>;
  [key: string]: unknown;
};
export type SubmitBillResponse = SandboxBillSubmission | LiveBillSubmission;
export type BillStatus = {
  billId: string;
  externalId: string | null;
  state: string;
  nativeStatus: string;
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
  allowedAmount: number;
  adjustmentAmount: number;
  patientResponsibility: number;
  reasonCodes: string[];
};
export type BillEor = {
  billId: string;
  reportedPaid: number | null;
  totalPaid: number;
  balanceDue: number;
  payment: unknown | null;
  payments: unknown[];
  lineItems: BillEorLineItem[];
};
export type BillEorResponse = { data: BillEor };
export const BILL_ATTACHMENT_DOCUMENT_TYPES = [
  "final_report",
  "proof_of_service",
  "w9",
  "medical_records",
  "appeal",
  "other",
] as const;
export type BillAttachmentDocumentType =
  (typeof BILL_ATTACHMENT_DOCUMENT_TYPES)[number];
export type BillAttachment = {
  id: string;
  externalId: string | null;
  filename: string;
  description: string | null;
  documentType: BillAttachmentDocumentType;
  reportType: string | null;
  reportTypeCode: string | null;
  source: string;
  addedAt: string;
  contentUrl: string;
};
export type BillAttachmentListResponse = { data: BillAttachment[] };
export type BillAttachmentResponse = { data: BillAttachment };
export type UploadBillAttachmentRequest = {
  file: Blob;
  filename: string;
  documentType: BillAttachmentDocumentType;
  externalId?: string;
  description?: string;
};
export type BillReviewType = "second_review" | "independent_bill_review";
export type BillReviewState = "draft" | "submitted";
export type BillReview = {
  id: string;
  billId: string;
  originalBillId: string;
  externalId: string | null;
  type: BillReviewType;
  state: BillReviewState;
  reason: string | null;
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
  reason?: string;
  disputedAmount?: number;
  payerClaimControlNumber?: string;
  attachmentIds?: string[];
};
export type BillReviewResponse = { data: BillReview };
export type BillReviewListResponse = { data: BillReview[] };
export type MindBillEvent = {
  id: string;
  sequence: string;
  type: string;
  apiVersion: string;
  createdAt: string;
  data: Record<string, unknown>;
};

export type VerifyWebhookSignatureOptions = {
  toleranceSeconds?: number;
  now?: number;
};

export class MindBillError extends Error {
  readonly name = "MindBillError";
  constructor(
    public readonly status: number,
    public readonly problem: Record<string, unknown>,
    public readonly requestId?: string,
  ) {
    super(
      String(problem.detail ?? problem.title ?? `MindBill API error ${status}`),
    );
  }
}

type RequestConfig = RequestOptions;

function exactHttpsOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

function normalizeSequence(sequence: string): string {
  if (!/^[0-9]+$/.test(sequence)) {
    throw new Error("MindBill event sequence must contain decimal digits only");
  }
  return sequence.replace(/^0+(?=\d)/, "");
}

/** Compare arbitrary-length decimal event sequences without losing integer precision. */
export function compareMindBillEventSequence(
  left: string,
  right: string,
): -1 | 0 | 1 {
  const normalizedLeft = normalizeSequence(left);
  const normalizedRight = normalizeSequence(right);
  if (normalizedLeft.length !== normalizedRight.length) {
    return normalizedLeft.length < normalizedRight.length ? -1 : 1;
  }
  if (normalizedLeft === normalizedRight) return 0;
  return normalizedLeft < normalizedRight ? -1 : 1;
}

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
  if (
    !Number.isFinite(toleranceSeconds) ||
    toleranceSeconds < 0 ||
    !Number.isFinite(now)
  )
    return false;

  const values = signatureHeader.split(",").map((value) => value.trim());
  const timestamps = values
    .filter((value) => value.startsWith("t="))
    .map((value) => value.slice(2));
  const signatures = values
    .filter((value) => value.startsWith("v1="))
    .map((value) => value.slice(3));
  if (
    timestamps.length !== 1 ||
    signatures.length === 0 ||
    !/^[0-9]+$/.test(timestamps[0]!)
  )
    return false;

  const timestamp = Number(timestamps[0]);
  if (
    !Number.isSafeInteger(timestamp) ||
    Math.abs(now - timestamp) > toleranceSeconds
  )
    return false;
  const expected = createHmac("sha256", secret)
    .update(`${timestamps[0]}.`)
    .update(rawBody)
    .digest();

  return signatures.some((signature) => {
    if (!/^[0-9a-fA-F]{64}$/.test(signature)) return false;
    const supplied = Buffer.from(signature, "hex");
    return (
      supplied.length === expected.length && timingSafeEqual(supplied, expected)
    );
  });
}

async function parseResponse(
  response: Response,
): Promise<Record<string, unknown>> {
  if (response.status === 204) return {};
  return response.json().catch(() => ({})) as Promise<Record<string, unknown>>;
}

export class MindBillClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof globalThis.fetch;

  constructor(private readonly options: MindBillClientOptions) {
    if (!options.apiKey) throw new Error("apiKey is required");
    this.baseUrl = (options.baseUrl ?? MINDBILL_API_BASE_URL).replace(
      /\/$/,
      "",
    );
    this.fetcher = options.fetch ?? globalThis.fetch;
    if (!this.fetcher) throw new Error("A fetch implementation is required");
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    config: RequestConfig = {},
  ): Promise<T> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.options.apiKey}`,
        accept: "application/json",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(this.options.organizationId
          ? { "x-mindbill-org-id": this.options.organizationId }
          : {}),
        ...(config.idempotencyKey
          ? { "idempotency-key": config.idempotencyKey }
          : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload = await parseResponse(response);
    if (!response.ok) {
      const requestId =
        response.headers.get("x-request-id") ??
        (typeof payload.requestId === "string" ? payload.requestId : undefined);
      throw new MindBillError(response.status, payload, requestId);
    }
    return payload as T;
  }

  private async requestForm<T>(
    path: string,
    body: FormData,
    config: RequestConfig = {},
  ): Promise<T> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.options.apiKey}`,
        accept: "application/json",
        ...(this.options.organizationId
          ? { "x-mindbill-org-id": this.options.organizationId }
          : {}),
        ...(config.idempotencyKey
          ? { "idempotency-key": config.idempotencyKey }
          : {}),
      },
      body,
    });
    const payload = await parseResponse(response);
    if (!response.ok) {
      const requestId =
        response.headers.get("x-request-id") ??
        (typeof payload.requestId === "string" ? payload.requestId : undefined);
      throw new MindBillError(response.status, payload, requestId);
    }
    return payload as T;
  }

  getDeveloperAccount(): Promise<DeveloperAccount> {
    return this.request("GET", "/developer/account");
  }
  updateDeveloperSecurity(
    input: DeveloperSecurity,
  ): Promise<DeveloperSecurity> {
    return this.request("PATCH", "/developer/account", input);
  }
  acceptBaa(input: {
    accepted: true;
    acceptedBy: string;
    baaVersion?: typeof MINDBILL_BAA_VERSION;
  }): Promise<BaaAcceptance> {
    return this.request("POST", "/developer/account/baa", {
      ...input,
      baaVersion: input.baaVersion ?? MINDBILL_BAA_VERSION,
    });
  }
  requestLiveAccess(organizationId: string): Promise<LiveAccessResponse> {
    return this.request("POST", "/developer/account/live-access", {
      organizationId,
    });
  }
  createBillingPortalSession(): Promise<HostedSession> {
    return this.request("POST", "/developer/account/billing-portal");
  }
  mintCredential(
    input: MintCredentialRequest,
  ): Promise<MintCredentialResponse> {
    return this.request("POST", "/developer/account/keys", input);
  }
  /**
   * Provision a partner-managed customer tenant. The default managed mode creates
   * no MindBill user, invitation, or customer-facing onboarding step.
   */
  provisionOrganization(
    input: ProvisionOrganizationRequest,
    idempotencyKey: string,
  ): Promise<ProvisionOrganizationResponse> {
    return this.request("POST", "/orgs", input, { idempotencyKey });
  }
  /** Grant optional direct MindBill access after a managed tenant already exists. */
  grantOrganizationUserAccess(
    organizationId: string,
    input: GrantOrganizationUserAccessRequest,
    idempotencyKey: string,
  ): Promise<InvitedOrganizationProvisioning> {
    return this.request(
      "POST",
      `/orgs/${encodeURIComponent(organizationId)}/user-access`,
      input,
      { idempotencyKey },
    );
  }
  /**
   * Synchronize partner-owned practice, provider, and location data without
   * creating a MindBill user or asking the customer to re-enter it.
   */
  synchronizeOrganizationProfile(
    organizationId: string,
    input: SourceProfileRequest,
    idempotencyKey: string,
  ): Promise<SourceProfileResponse> {
    return this.request(
      "PUT",
      `/orgs/${encodeURIComponent(organizationId)}/source-profile`,
      input,
      { idempotencyKey },
    );
  }
  quote<T = Quote>(input: QuoteRequest, idempotencyKey: string): Promise<T> {
    return this.request("POST", "/quote", input, { idempotencyKey });
  }
  createBill<T = CreateBillResponse>(
    input: CreateBillRequest,
    idempotencyKey: string,
  ): Promise<T> {
    return this.request("POST", "/bills", input, { idempotencyKey });
  }
  getBill<T = BillResponse>(id: string): Promise<T> {
    return this.request("GET", `/bills/${encodeURIComponent(id)}`);
  }
  listBills<T = BillPage>(
    query: Record<string, string | number | boolean> = {},
  ): Promise<T> {
    const search = new URLSearchParams(
      Object.entries(query).map(([key, value]) => [key, String(value)]),
    ).toString();
    return this.request("GET", `/bills${search ? `?${search}` : ""}`);
  }
  submitBill<T = SubmitBillResponse>(
    id: string,
    input: SubmitBillRequest,
    idempotencyKey: string,
  ): Promise<T> {
    return this.request(
      "POST",
      `/bills/${encodeURIComponent(id)}/submit`,
      input,
      { idempotencyKey },
    );
  }
  getBillStatus(id: string): Promise<BillStatusResponse> {
    return this.request(
      "GET",
      `/bills/${encodeURIComponent(id)}/status`,
    );
  }
  getBillEor(id: string): Promise<BillEorResponse> {
    return this.request("GET", `/bills/${encodeURIComponent(id)}/eor`);
  }
  listBillAttachments(id: string): Promise<BillAttachmentListResponse> {
    return this.request(
      "GET",
      `/bills/${encodeURIComponent(id)}/attachments`,
    );
  }
  uploadBillAttachment(
    id: string,
    input: UploadBillAttachmentRequest,
    idempotencyKey: string,
  ): Promise<BillAttachmentResponse> {
    if (!BILL_ATTACHMENT_DOCUMENT_TYPES.includes(input.documentType)) {
      throw new Error(
        `documentType must be one of: ${BILL_ATTACHMENT_DOCUMENT_TYPES.join(", ")}`,
      );
    }
    const body = new FormData();
    body.append("file", input.file, input.filename);
    body.append("documentType", input.documentType);
    if (input.externalId) body.append("externalId", input.externalId);
    if (input.description) body.append("description", input.description);
    return this.requestForm(
      `/bills/${encodeURIComponent(id)}/attachments`,
      body,
      { idempotencyKey },
    );
  }
  deleteBillAttachment(
    id: string,
    attachmentId: string,
    idempotencyKey: string,
  ): Promise<void> {
    return this.request(
      "DELETE",
      `/bills/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`,
      undefined,
      { idempotencyKey },
    );
  }
  createBillReview(
    id: string,
    input: CreateBillReviewRequest,
    idempotencyKey: string,
  ): Promise<BillReviewResponse> {
    return this.request(
      "POST",
      `/bills/${encodeURIComponent(id)}/reviews`,
      input,
      { idempotencyKey },
    );
  }
  listBillReviews(id: string): Promise<BillReviewListResponse> {
    return this.request(
      "GET",
      `/bills/${encodeURIComponent(id)}/reviews`,
    );
  }
  getBillReview(id: string, reviewId: string): Promise<BillReviewResponse> {
    return this.request(
      "GET",
      `/bills/${encodeURIComponent(id)}/reviews/${encodeURIComponent(reviewId)}`,
    );
  }
  submitBillReview(
    id: string,
    reviewId: string,
    idempotencyKey: string,
  ): Promise<BillReviewResponse> {
    return this.request(
      "POST",
      `/bills/${encodeURIComponent(id)}/reviews/${encodeURIComponent(reviewId)}/submit`,
      {},
      { idempotencyKey },
    );
  }
  listEvents(
    cursor = "0",
    limit = 50,
  ): Promise<{ events: MindBillEvent[]; nextCursor: string | null }> {
    return this.request(
      "GET",
      `/events?cursor=${encodeURIComponent(cursor)}&limit=${limit}`,
    );
  }
  listWebhookDeliveries(limit = 50): Promise<Record<string, unknown>> {
    return this.request("GET", `/webhook-deliveries?limit=${limit}`);
  }
  createEmbedSession(input: EmbedSessionRequest): Promise<EmbedSession> {
    if (!MINDBILL_COMPONENTS.includes(input.component)) {
      throw new Error(
        `component must be one of: ${MINDBILL_COMPONENTS.join(", ")}`,
      );
    }
    const requiresBill =
      input.component === "bill-timeline" || input.component === "bill-review";
    if (requiresBill && !input.billId) {
      throw new Error(`billId is required for ${input.component} sessions`);
    }
    if (!requiresBill && input.billId !== undefined) {
      throw new Error(
        "billId is supported only for bill-timeline and bill-review sessions",
      );
    }
    const allowedOrigin = exactHttpsOrigin(input.allowedOrigin);
    if (!allowedOrigin) {
      throw new Error(
        "allowedOrigin must be an exact HTTPS origin without credentials, path, query, or fragment",
      );
    }
    if (
      input.expiresIn !== undefined &&
      (!Number.isInteger(input.expiresIn) ||
        input.expiresIn < 60 ||
        input.expiresIn > 3600)
    ) {
      throw new Error(
        "expiresIn must be an integer from 60 through 3600 seconds",
      );
    }
    return this.request("POST", "/embed/sessions", { ...input, allowedOrigin });
  }
}

export async function createDeveloperSandbox(
  input: Omit<DeveloperSignupRequest, "termsAccepted" | "termsVersion"> & {
    termsAccepted: true;
  },
  options: { baseUrl?: string; fetch?: typeof globalThis.fetch } = {},
): Promise<DeveloperSignupResponse> {
  const fetcher = options.fetch ?? globalThis.fetch;
  if (!fetcher) throw new Error("A fetch implementation is required");
  const baseUrl = (options.baseUrl ?? MINDBILL_API_BASE_URL).replace(/\/$/, "");
  const response = await fetcher(`${baseUrl}/developer/signup`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ ...input, termsVersion: MINDBILL_TERMS_VERSION }),
  });
  const payload = await parseResponse(response);
  if (!response.ok) {
    const requestId =
      response.headers.get("x-request-id") ??
      (typeof payload.requestId === "string" ? payload.requestId : undefined);
    throw new MindBillError(response.status, payload, requestId);
  }
  return payload as DeveloperSignupResponse;
}
