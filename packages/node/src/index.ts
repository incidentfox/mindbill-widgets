import { createHmac, timingSafeEqual } from "node:crypto";

export const MINDBILL_API_BASE_URL = "https://app.mindbill.org/partner/v1";
export const MINDBILL_TERMS_VERSION = "2026-08-16";
export const MINDBILL_BAA_VERSION = "2026-08-16";

export type MindBillEnvironment = "sandbox" | "live";
export const MINDBILL_COMPONENTS = ["bill-timeline", "bill-from-report", "collections", "onboarding"] as const;
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

export type DeveloperSecurity = { ipAllowlist: string[]; rateLimitPerMinute: number };
export type BaaAcceptance = { baaVersion: string; baaAcceptedAt: string; acceptedBy: string };
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
export type ProvisionManagedOrganizationRequest = ProvisionOrganizationSettings & {
  name: string;
  accessMode?: "managed";
};
export type ProvisionInvitedOrganizationRequest = ProvisionOrganizationSettings & {
  name: string;
  accessMode: "invite";
  adminName: string;
  adminEmail: string;
};
export type ProvisionOrganizationRequest =
  | ProvisionManagedOrganizationRequest
  | ProvisionInvitedOrganizationRequest;
export type ProvisionOrganizationResponse =
  | ManagedOrganizationProvisioning
  | InvitedOrganizationProvisioning;
export type GrantOrganizationUserAccessRequest = {
  adminName: string;
  adminEmail: string;
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
  expiresAt: string;
};

export type Money = { amount: number; currency: "USD" };
export type ServiceLine = { code: string; modifiers?: string[]; units?: number };
export type QuoteRequest = { lineItems: ServiceLine[] };
export type Quote = {
  currency?: "USD";
  lineItems?: Record<string, unknown>[];
  totalAllowed?: number;
  [key: string]: unknown;
};
export type NewPatientReference = { kind: "new" };
export type ExistingPatientReference = { kind: "existing"; id: string };
export type CreateBillRequest = {
  fields?: Record<string, string>;
  patient: NewPatientReference | ExistingPatientReference;
  claimsAdminId?: string;
  renderingProviderId?: string;
  placeOfServiceId?: string;
  placeOfServiceCodeOverride?: string;
  billingProviderId?: string;
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
    super(String(problem.detail ?? problem.title ?? `MindBill API error ${status}`));
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
export function compareMindBillEventSequence(left: string, right: string): -1 | 0 | 1 {
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
  if (!Number.isFinite(toleranceSeconds) || toleranceSeconds < 0 || !Number.isFinite(now)) return false;

  const values = signatureHeader.split(",").map((value) => value.trim());
  const timestamps = values.filter((value) => value.startsWith("t=")).map((value) => value.slice(2));
  const signatures = values.filter((value) => value.startsWith("v1=")).map((value) => value.slice(3));
  if (timestamps.length !== 1 || signatures.length === 0 || !/^[0-9]+$/.test(timestamps[0]!)) return false;

  const timestamp = Number(timestamps[0]);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret)
    .update(`${timestamps[0]}.`)
    .update(rawBody)
    .digest();

  return signatures.some((signature) => {
    if (!/^[0-9a-fA-F]{64}$/.test(signature)) return false;
    const supplied = Buffer.from(signature, "hex");
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  });
}

async function parseResponse(response: Response): Promise<Record<string, unknown>> {
  if (response.status === 204) return {};
  return response.json().catch(() => ({})) as Promise<Record<string, unknown>>;
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

  private async request<T>(method: string, path: string, body?: unknown, config: RequestConfig = {}): Promise<T> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.options.apiKey}`,
        accept: "application/json",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(this.options.organizationId ? { "x-mindbill-org-id": this.options.organizationId } : {}),
        ...(config.idempotencyKey ? { "idempotency-key": config.idempotencyKey } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload = await parseResponse(response);
    if (!response.ok) {
      const requestId = response.headers.get("x-request-id") ??
        (typeof payload.requestId === "string" ? payload.requestId : undefined);
      throw new MindBillError(response.status, payload, requestId);
    }
    return payload as T;
  }

  getDeveloperAccount(): Promise<DeveloperAccount> {
    return this.request("GET", "/developer/account");
  }
  updateDeveloperSecurity(input: DeveloperSecurity): Promise<DeveloperSecurity> {
    return this.request("PATCH", "/developer/account", input);
  }
  acceptBaa(input: { accepted: true; acceptedBy: string; baaVersion?: typeof MINDBILL_BAA_VERSION }): Promise<BaaAcceptance> {
    return this.request("POST", "/developer/account/baa", {
      ...input,
      baaVersion: input.baaVersion ?? MINDBILL_BAA_VERSION,
    });
  }
  requestLiveAccess(organizationId: string): Promise<LiveAccessResponse> {
    return this.request("POST", "/developer/account/live-access", { organizationId });
  }
  createBillingPortalSession(): Promise<HostedSession> {
    return this.request("POST", "/developer/account/billing-portal");
  }
  mintCredential(input: MintCredentialRequest): Promise<MintCredentialResponse> {
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
  quote<T = Quote>(input: QuoteRequest, idempotencyKey: string): Promise<T> {
    return this.request("POST", "/quote", input, { idempotencyKey });
  }
  createBill<T = CreateBillResponse>(input: CreateBillRequest, idempotencyKey: string): Promise<T> {
    return this.request("POST", "/bills", input, { idempotencyKey });
  }
  getBill<T = BillResponse>(id: string): Promise<T> {
    return this.request("GET", `/bills/${encodeURIComponent(id)}`);
  }
  listBills<T = BillPage>(query: Record<string, string | number | boolean> = {}): Promise<T> {
    const search = new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)])).toString();
    return this.request("GET", `/bills${search ? `?${search}` : ""}`);
  }
  submitBill<T = SubmitBillResponse>(id: string, input: SubmitBillRequest, idempotencyKey: string): Promise<T> {
    return this.request("POST", `/bills/${encodeURIComponent(id)}/submit`, input, { idempotencyKey });
  }
  listEvents(cursor = "0", limit = 50): Promise<{ events: MindBillEvent[]; nextCursor: string | null }> {
    return this.request("GET", `/events?cursor=${encodeURIComponent(cursor)}&limit=${limit}`);
  }
  listWebhookDeliveries(limit = 50): Promise<Record<string, unknown>> {
    return this.request("GET", `/webhook-deliveries?limit=${limit}`);
  }
  createEmbedSession(input: EmbedSessionRequest): Promise<EmbedSession> {
    if (!MINDBILL_COMPONENTS.includes(input.component)) {
      throw new Error(`component must be one of: ${MINDBILL_COMPONENTS.join(", ")}`);
    }
    if (input.component === "bill-timeline" && !input.billId) {
      throw new Error("billId is required for bill-timeline sessions");
    }
    if (input.component !== "bill-timeline" && input.billId !== undefined) {
      throw new Error("billId is supported only for bill-timeline sessions");
    }
    const allowedOrigin = exactHttpsOrigin(input.allowedOrigin);
    if (!allowedOrigin) {
      throw new Error("allowedOrigin must be an exact HTTPS origin without credentials, path, query, or fragment");
    }
    if (input.expiresIn !== undefined && (!Number.isInteger(input.expiresIn) || input.expiresIn < 60 || input.expiresIn > 3600)) {
      throw new Error("expiresIn must be an integer from 60 through 3600 seconds");
    }
    return this.request("POST", "/embed/sessions", { ...input, allowedOrigin });
  }
}

export async function createDeveloperSandbox(
  input: Omit<DeveloperSignupRequest, "termsAccepted" | "termsVersion"> & { termsAccepted: true },
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
    const requestId = response.headers.get("x-request-id") ??
      (typeof payload.requestId === "string" ? payload.requestId : undefined);
    throw new MindBillError(response.status, payload, requestId);
  }
  return payload as DeveloperSignupResponse;
}
