import { withMindBillSdkFetch } from "./analytics";
import type { BillLifecycleSession, OrganizationClientOptions, RfaListResult, RfaRecord } from "./index";

/** One request for authorization on a claim, as the claim's RFA index shows it. */
export type ClaimRfaSummary = {
  id: string;
  status: string;
  lifecycleStatus: string;
  renderingProviderId: string;
  providerName: string;
  expedited: boolean;
  requestType: string;
  createdAt: string | null;
  submittedAt: string | null;
  decisionDueAt: string | null;
  decidedAt: string | null;
  items: Array<{
    id: string;
    ordinal: number;
    serviceDescription: string;
    procedureCode: string | null;
    diagnosisCode: string;
    quantity: number | null;
    frequency: string | null;
    duration: string | null;
    outcome: string;
    /** Closed as no longer requiring a decision ("Not required"). */
    notRequired: boolean;
    authorizationNumber: string | null;
    decidedAt: string | null;
  }>;
};

/** A bill related to an RFA, or an RFA related to a bill, on the same claim. */
export type RelatedAuthorizationRecord = {
  id: string;
  label: string;
  treatments: string[];
  /** "Linked authorization" when a bill line uses one of the request's approved treatments; otherwise "Same injury". */
  relationship: string;
  status?: string;
  serviceDate?: string | null;
};
export type RelatedAuthorizationResult = { data: RelatedAuthorizationRecord[]; claimId: string; hasMore: boolean };
export type RelatedAuthorizationQuery = { rfaId: string; billId?: never } | { billId: string; rfaId?: never };

export type RfaEvidenceState = "attached" | "ready" | "awaiting_decision" | "denied" | "not_signed" | "unavailable" | "bill_sent";
/** The signed RFA form and the UR decision for one authorization linked to a bill's service line. */
export type LinkedRfaEvidence = {
  rfaId: string;
  rfaItemId: string;
  service: string;
  form: { state: RfaEvidenceState; filename?: string; message?: string };
  decision: { state: RfaEvidenceState; filename?: string; outcome?: string; authorizationNumber?: string | null; message?: string };
};
export type BillUrDecisionTreatment = { service: string; code: string | null; outcome: string; authorizationNumber: string | null; effectiveFrom: string | null; effectiveTo: string | null };
export type BillUrDecision = {
  documentId: string; rfaId: string; filename: string; decidedAt: string | null; treatments: BillUrDecisionTreatment[];
  /** Already on the bill. */ attached: boolean;
  /** Authorizes a procedure billed here, on a date inside the authorized period. */ matchesBill: boolean;
};
/** `editable` is true only while the bill is unsent. */
export type BillUrDecisionsResult = { editable: boolean; decisions: BillUrDecision[]; linked: LinkedRfaEvidence[] };
export type BillUrDecisionsAttachInput = { documentIds: string[]; linked?: never } | { linked: true; documentIds?: never };
export type BillUrDecisionsAttachResult = { attached: number; linked?: LinkedRfaEvidence[] };

export type RfaRecordsClient = {
  /** Every RFA on one claim, newest first (all pages). */
  listClaimRfas(claimId: string): Promise<ClaimRfaSummary[]>;
  listRelated(query: RelatedAuthorizationQuery): Promise<RelatedAuthorizationResult>;
  listBillUrDecisions(billId: string): Promise<BillUrDecisionsResult>;
  /** Copies chosen decision letters onto an unsent bill, or retries attaching every linked RFA's form and decision. Sends nothing. */
  attachBillUrDecisions(billId: string, input: BillUrDecisionsAttachInput, idempotencyKey?: string): Promise<BillUrDecisionsAttachResult>;
  /** A request's stored document, such as a UR decision letter (PDF). */
  getRfaDocument(rfaId: string, documentId: string): Promise<Blob>;
  clearSession(): void;
};

/** Project a full RFA record onto the claim index summary. */
export function claimRfaSummary(rfa: RfaRecord): ClaimRfaSummary {
  const record = rfa as RfaRecord & { decidedAt?: string | null };
  const itemDecisions = rfa.items.map(item => item.decidedAt ?? null).filter((value): value is string => Boolean(value)).sort();
  return {
    id: rfa.id,
    status: rfa.status,
    lifecycleStatus: rfa.lifecycleStatus ?? "",
    renderingProviderId: rfa.renderingProviderId,
    providerName: rfa.providerName,
    expedited: rfa.expedited,
    requestType: rfa.requestType ?? "initial",
    createdAt: rfa.createdAt,
    submittedAt: rfa.submittedAt,
    decisionDueAt: rfa.decisionDueAt ?? null,
    decidedAt: record.decidedAt ?? itemDecisions.at(-1) ?? null,
    items: rfa.items.map((item, index) => ({
      id: item.id,
      ordinal: (item as { ordinal?: number }).ordinal ?? index + 1,
      serviceDescription: item.serviceDescription,
      procedureCode: item.authorizedProcedureCode ?? item.procedureCode,
      diagnosisCode: item.diagnosisCode,
      quantity: item.authorizedQuantity ?? item.quantity,
      frequency: item.frequency ?? null,
      duration: item.duration ?? null,
      outcome: item.outcome,
      notRequired: item.decisionClosure?.closed === true,
      authorizationNumber: item.authorizationNumber,
      decidedAt: item.decidedAt ?? null,
    })),
  };
}

const failure = async (response: Response) => {
  const body = await response.json().catch(() => null) as { detail?: unknown; message?: unknown; code?: unknown; error?: unknown } | null;
  const detail = body?.detail ?? body?.message ?? (typeof body?.error === "string" ? body.error : undefined);
  const error = new Error(typeof detail === "string" ? detail : `The request failed (${response.status}).`) as Error & { code?: string; status?: number };
  if (typeof body?.code === "string") error.code = body.code;
  else if (typeof body?.error === "string") error.code = body.error;
  error.status = response.status;
  return error;
};

/** Claim RFA index, related records and bill UR decisions. Uses short-lived browser credentials; never pass a partner API key. */
export function createRfaRecordsClient({ sessionEndpoint = "/api/mindbill/session", getSession, apiBaseUrl = "https://app.mindbill.org", fetch: fetchOverride }: OrganizationClientOptions = {}): RfaRecordsClient {
  const fetcher = withMindBillSdkFetch(fetchOverride ?? globalThis.fetch);
  let session: BillLifecycleSession | null = null;
  let pending: Promise<BillLifecycleSession> | null = null;
  const mint = (force = false): Promise<BillLifecycleSession> => {
    if (!force && session && (!session.expiresAt || Date.parse(session.expiresAt) > Date.now() + 30_000)) return Promise.resolve(session);
    if (pending) return pending;
    pending = (async () => {
      const value: unknown = getSession ? await getSession({ signal: new AbortController().signal }) : await (async () => {
        const response = await fetcher(sessionEndpoint, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: "{}" });
        if (!response.ok) throw await failure(response);
        return response.json();
      })();
      const envelope = value as { session?: unknown; data?: unknown } | null;
      const candidate = (envelope?.session ?? envelope?.data ?? value) as BillLifecycleSession | null;
      if (!candidate || typeof candidate.token !== "string" || candidate.token.length < 8) throw new Error("The session endpoint did not return a browser session token.");
      session = { token: candidate.token, ...(typeof candidate.expiresAt === "string" ? { expiresAt: candidate.expiresAt } : {}), ...(typeof candidate.apiBaseUrl === "string" ? { apiBaseUrl: candidate.apiBaseUrl } : {}) };
      return session;
    })().finally(() => { pending = null; });
    return pending;
  };
  const request = async (path: string, init?: RequestInit): Promise<Response> => {
    const perform = (active: BillLifecycleSession) => {
      const headers = new Headers(init?.headers);
      headers.set("authorization", `Bearer ${active.token}`);
      if (init?.body) headers.set("content-type", "application/json");
      return fetcher(`${(active.apiBaseUrl ?? apiBaseUrl).replace(/\/$/, "")}/partner/v2${path}`, { ...init, headers });
    };
    let response = await perform(await mint());
    if (response.status === 401) response = await perform(await mint(true));
    if (!response.ok) throw await failure(response);
    return response;
  };
  const required = (value: string, label: string) => {
    if (!value || !value.trim()) throw new Error(`${label} is required.`);
    return encodeURIComponent(value);
  };
  return {
    async listClaimRfas(claimId) {
      required(claimId, "A claim ID");
      const rows: RfaRecord[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < 20; page++) {
        const params = new URLSearchParams({ claimId, limit: "200", sortBy: "createdAt", sortDirection: "desc" });
        if (cursor) params.set("cursor", cursor);
        const body = await (await request(`/rfas?${params}`)).json() as RfaListResult;
        if (!Array.isArray(body?.data)) throw new Error("The RFA list response was invalid.");
        rows.push(...body.data);
        cursor = body.nextCursor;
        if (!cursor) break;
      }
      return rows.map(claimRfaSummary);
    },
    async listRelated(query) {
      const params = "rfaId" in query && query.rfaId ? new URLSearchParams({ rfaId: query.rfaId }) : new URLSearchParams({ billId: (query as { billId: string }).billId });
      if (!params.get("rfaId") && !params.get("billId")) throw new Error("An RFA ID or bill ID is required.");
      const body = await (await request(`/rfas/related?${params}`)).json() as RelatedAuthorizationResult;
      if (!Array.isArray(body?.data) || typeof body.claimId !== "string") throw new Error("The related records response was invalid.");
      return { data: body.data, claimId: body.claimId, hasMore: body.hasMore === true };
    },
    async listBillUrDecisions(billId) {
      const body = await (await request(`/bills/${required(billId, "A bill ID")}/ur-decisions`)).json() as { data?: BillUrDecisionsResult };
      if (!body.data || !Array.isArray(body.data.decisions) || !Array.isArray(body.data.linked)) throw new Error("The UR decision response was invalid.");
      return body.data;
    },
    async attachBillUrDecisions(billId, input, key) {
      const path = `/bills/${required(billId, "A bill ID")}/ur-decisions`;
      const payload = input.linked === true ? { linked: true } : { documentIds: input.documentIds ?? [] };
      if ("documentIds" in payload && (!payload.documentIds.length || payload.documentIds.length > 8)) throw new Error("Choose one to eight decisions to attach.");
      const body = await (await request(path, { method: "POST", headers: { "idempotency-key": key ?? globalThis.crypto.randomUUID() }, body: JSON.stringify(payload) })).json() as { data?: BillUrDecisionsAttachResult };
      if (!body.data || typeof body.data.attached !== "number") throw new Error("The attach response was invalid.");
      return body.data;
    },
    async getRfaDocument(rfaId, documentId) {
      return (await request(`/rfas/${required(rfaId, "An RFA ID")}/documents/${required(documentId, "A document ID")}`)).blob();
    },
    clearSession() { session = null; },
  };
}
