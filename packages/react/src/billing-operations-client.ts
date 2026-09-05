import {
  DEFAULT_API_BASE_URL,
  DEFAULT_SESSION_ENDPOINT,
  type BillLifecycleSession,
  type BillLifecycleSessionProvider,
  type BillTasksDashboardData,
} from "@mindbill/browser";

export type BillRegistryStatus = {
  id: string;
  label: string;
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
};

export type BillRegistryItem = {
  id: string;
  billNumber: string;
  externalId: string | null;
  patientName: string;
  claimNumber: string;
  claimsAdministrator: string;
  status: BillRegistryStatus;
  dateOfService: string | null;
  procedureCodes: string[];
  billingProviderId: string | null;
  submittedAt: string | null;
  arAgeDays: number | null;
  totalCharge: number;
  totalPaid: number;
  balanceDue: number;
};

export type BillRegistryAge = "all" | "0-30" | "31-60" | "61-90" | "91+" | "91-180" | "181+";
export type BillRegistrySort = "submitted_desc" | "submitted_asc" | "balance_desc" | "balance_asc" | "patient_asc";

export type BillRegistryQuery = {
  q?: string;
  status?: string;
  age?: BillRegistryAge;
  claimsAdministrator?: string;
  billingProviderId?: string;
  taskSection?: string;
  taskType?: string;
  taskLabel?: string;
  page?: number;
  pageSize?: number;
  sort?: BillRegistrySort;
};

export type BillRegistryResult = {
  items: BillRegistryItem[];
  total: number;
  balanceTotal: number;
  page: number;
  pageSize: number;
};

export type BillTasksResult = {
  dashboard: BillTasksDashboardData;
  /** Separate status inventory; not included in actionable task totals. */
  waiting?: BillTasksDashboardData;
  filters: { claimsAdministrators: Array<{ id: string; name: string }> };
};

export type ServiceLineItemsReport = {
  from: string;
  to: string;
  windowLabel: string;
  cptRows: Array<{ code: string; bills: number; lines: number; billed: number }>;
  billRows: Array<{
    billId: string;
    billNumber: string;
    submittedDate: string | null;
    dos: string | null;
    patient: string;
    claim: string;
    claimsAdmin: string;
    codes: string[];
    billed: number;
    status: string;
  }>;
  totalBills: number;
  totalLines: number;
  totalBilled: number;
};

export type ProductivityReport = {
  lo: string;
  hi: string;
  dayKeys: string[];
  billers: Array<{ name: string; initials: string }>;
  created: Record<string, Record<string, number>>;
  sent: Record<string, Record<string, number>>;
  createdTotal: Record<string, number>;
  sentTotal: Record<string, number>;
  submittedTotal: Record<string, number>;
  cleanTotal: Record<string, number>;
  totalCreated: number;
  totalSent: number;
  totalSubmitted: number;
  totalClean: number;
};

export type BillingOperationsClientOptions = {
  /** Same-origin route that exchanges the signed-in user for a short-lived MindBill browser session. */
  sessionEndpoint?: string;
  /** Advanced escape hatch for hosts that do not use an HTTP session endpoint. */
  getSession?: BillLifecycleSessionProvider;
  apiBaseUrl?: string;
  fetch?: typeof globalThis.fetch;
};

export type BillingOperationsClient = {
  clearSession: () => void;
  getBills: (query?: BillRegistryQuery, signal?: AbortSignal) => Promise<BillRegistryResult>;
  getBillTasks: (claimsAdministrator?: string, signal?: AbortSignal) => Promise<BillTasksResult>;
  getServiceLineItems: (range: { from: string; to: string }, signal?: AbortSignal) => Promise<ServiceLineItemsReport>;
  getProductivity: (range: { from: string; to: string }, signal?: AbortSignal) => Promise<ProductivityReport>;
};

async function responseError(response: Response, fallback: string): Promise<Error> {
  const body: unknown = await response.json().catch(() => null);
  const detail = body && typeof body === "object"
    ? (body as { detail?: unknown; error?: unknown }).detail ?? (body as { error?: unknown }).error
    : null;
  return new Error(typeof detail === "string" ? detail : fallback);
}

function normalizeSession(value: unknown): BillLifecycleSession {
  if (!value || typeof value !== "object") throw new Error("The MindBill session endpoint returned an invalid response.");
  const candidate = value as { token?: unknown; expiresAt?: unknown; apiBaseUrl?: unknown; session?: unknown; data?: unknown };
  const nested = candidate.session ?? candidate.data;
  const session = nested && typeof nested === "object" ? nested as typeof candidate : candidate;
  if (typeof session.token !== "string" || session.token.length < 8) {
    throw new Error("The MindBill session endpoint did not return a browser session token.");
  }
  return {
    token: session.token,
    ...(typeof session.expiresAt === "string" ? { expiresAt: session.expiresAt } : {}),
    ...(typeof session.apiBaseUrl === "string" ? { apiBaseUrl: session.apiBaseUrl } : {}),
  };
}

function isFresh(session: BillLifecycleSession | null): boolean {
  if (!session) return false;
  if (!session.expiresAt) return true;
  const expiresAt = Date.parse(session.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > Date.now() + 30_000;
}

function queryString(values: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** Browser-safe client for the multi-bill workspace. Partner API keys are never accepted here. */
export function createBillingOperationsClient({
  sessionEndpoint = DEFAULT_SESSION_ENDPOINT,
  getSession,
  apiBaseUrl = DEFAULT_API_BASE_URL,
  fetch: fetchOverride,
}: BillingOperationsClientOptions = {}): BillingOperationsClient {
  const fetcher = fetchOverride ?? globalThis.fetch;
  if (typeof fetcher !== "function") throw new Error("A Fetch API implementation is required.");
  let session: BillLifecycleSession | null = null;
  let pendingSession: Promise<BillLifecycleSession> | null = null;
  let pendingSessionSignal: AbortSignal | null = null;

  const mintSession = async (signal: AbortSignal, force = false): Promise<BillLifecycleSession> => {
    if (!force && isFresh(session)) return session as BillLifecycleSession;
    if (!force && pendingSession && !pendingSessionSignal?.aborted) return pendingSession;
    const pending = getSession
      ? getSession({ signal })
      : fetcher(sessionEndpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
        signal,
      }).then(async (response) => {
        if (!response.ok) throw await responseError(response, "MindBill browser session could not be created.");
        return response.json();
      });
    const request = Promise.resolve(pending).then(normalizeSession).then((next) => {
      session = next;
      return next;
    }).finally(() => {
      if (pendingSession === request) {
        pendingSession = null;
        pendingSessionSignal = null;
      }
    });
    pendingSession = request;
    pendingSessionSignal = signal;
    return request;
  };

  const get = async <T>(path: string, signal?: AbortSignal): Promise<T> => {
    const controller = signal ? null : new AbortController();
    const requestSignal = signal ?? controller?.signal;
    if (!requestSignal) throw new Error("An AbortSignal could not be created.");
    let browserSession = await mintSession(requestSignal);
    const request = (active: BillLifecycleSession) => {
      const base = (active.apiBaseUrl ?? apiBaseUrl).replace(/\/$/, "");
      return fetcher(`${base}${path}`, {
        headers: { authorization: `Bearer ${active.token}` },
        signal: requestSignal,
      });
    };
    let response = await request(browserSession);
    if (response.status === 401) {
      session = null;
      browserSession = await mintSession(requestSignal, true);
      response = await request(browserSession);
    }
    if (!response.ok) throw await responseError(response, "MindBill data could not be loaded.");
    const body = await response.json() as { data?: T } & T;
    return (body.data ?? body) as T;
  };

  return {
    clearSession() { session = null; pendingSession = null; pendingSessionSignal = null; },
    getBills(query = {}, signal) {
      const { claimsAdministrator, taskType, taskSection: _taskSection, sort, status, ...filters } = query;
      // Section is a presentation grouping, not a supported bill-list filter.
      void _taskSection;
      const sortKey = sort?.startsWith("balance_") ? "balanceDue"
        : sort?.startsWith("patient_") ? "patient" : sort ? "submitted" : undefined;
      return get<BillRegistryResult>(`/partner/v2/browser/bills${queryString({
        ...filters,
        status: status === "submitted" ? "sent" : status,
        claimsAdminId: claimsAdministrator,
        taskKind: taskType,
        sort: sortKey,
        dir: sort ? (sort.endsWith("_asc") ? "asc" : "desc") : undefined,
      })}`, signal);
    },
    getBillTasks(claimsAdministrator, signal) {
      return get<BillTasksResult>(
        `/partner/v2/browser/bill-tasks${queryString({ claimsAdminId: claimsAdministrator })}`,
        signal,
      );
    },
    getServiceLineItems(range, signal) {
      return get<ServiceLineItemsReport>(
        `/partner/v2/browser/reports/service-line-items${queryString(range)}`,
        signal,
      );
    },
    getProductivity(range, signal) {
      return get<ProductivityReport>(`/partner/v2/browser/reports/productivity${queryString(range)}`, signal);
    },
  };
}
