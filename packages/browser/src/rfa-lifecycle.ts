import type { BillLifecycleSession, OrganizationClientOptions, RfaRecord } from "./index";

export type RfaReceiptInput = {
  channel: "fax" | "email" | "edi" | "portal" | "mail" | "manual";
  receivedAt: string;
  proofDocumentId?: string;
  providerMessageId?: string;
};
export type RfaInformationRequestInput = { requestedAt: string; requestText: string; dueAt?: string };
export type RfaInformationResponseInput = { respondedAt: string; responseDocumentIds: string[] };
export type RfaTreatmentDecisionInput = {
  itemId: string; outcome: "approved" | "modified" | "denied";
  authorizationNumber?: string; authorizedProcedureCode?: string; authorizedQuantity?: number; authorizedUnits?: number;
  effectiveFrom?: string; effectiveTo?: string; decisionReason?: string; reviewerName?: string; reviewerPhone?: string;
};
export type RfaDecisionsInput = { decidedAt: string; responseDocumentId: string; imrDocumentId?: string; decisions: RfaTreatmentDecisionInput[] };
export type RfaFollowUp = {
  id: string; rfaId: string; claimId: string; responseDocumentId: string | null; responseFilename: string | null;
  kind: string; status: string; dueAt: string; assigneeReference: string | null; snoozedUntil: string | null;
  lastOutcome: string | null; lastNote: string | null; createdAt: string; updatedAt: string; resolvedAt: string | null;
};
export type RfaFollowUpUpdate = {
  assigneeReference?: string | null; snoozedUntil?: string | null;
  outcome?: "message_left" | "decision_pending" | "decision_issued" | "not_on_file" | "reviewed";
  note?: string;
  responseReview?: { disposition: "no_new_decision"; noNewDecisionConfirmed: true } | { disposition: "decisions_recorded"; allDecisionsRecordedConfirmed: true };
};
export type RfaFollowUpList = { data: RfaFollowUp[]; nextCursor: string | null };
export type RfaLifecycleClient = {
  recordReceipt(id: string, input: RfaReceiptInput, idempotencyKey: string): Promise<RfaRecord>;
  recordInformationRequest(id: string, input: RfaInformationRequestInput, idempotencyKey: string): Promise<RfaRecord>;
  recordInformationResponse(id: string, requestId: string, input: RfaInformationResponseInput, idempotencyKey: string): Promise<RfaRecord>;
  recordDecisions(id: string, input: RfaDecisionsInput, idempotencyKey: string): Promise<RfaRecord>;
  listFollowUps(query?: { claimId?: string; includeResolved?: boolean; limit?: number; cursor?: string }): Promise<RfaFollowUpList>;
  updateFollowUp(id: string, input: RfaFollowUpUpdate, idempotencyKey: string): Promise<RfaFollowUp>;
  clearSession(): void;
};
/** Records clinical workflow evidence. These methods never send faxes or reconcile notification queues. */
export function createRfaLifecycleClient({ sessionEndpoint = "/api/mindbill/session", getSession, apiBaseUrl = "https://app.mindbill.org", fetch: fetchOverride }: OrganizationClientOptions = {}): RfaLifecycleClient {
  const fetcher = fetchOverride ?? globalThis.fetch;
  let session: BillLifecycleSession | null = null;
  let pending: Promise<BillLifecycleSession> | null = null;
  const failure = async (response: Response): Promise<Error> => {
    const body = await response.json().catch(() => null) as { detail?: unknown; message?: unknown } | null;
    const detail = body?.detail ?? body?.message;
    return new Error(typeof detail === "string" ? detail : `The RFA request failed (${response.status}).`);
  };
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
      if (!candidate || typeof candidate.token !== "string" || candidate.token.length < 8) throw new Error("The RFA session endpoint did not return a browser session token.");
      session = { token: candidate.token, ...(typeof candidate.expiresAt === "string" ? { expiresAt: candidate.expiresAt } : {}), ...(typeof candidate.apiBaseUrl === "string" ? { apiBaseUrl: candidate.apiBaseUrl } : {}) };
      return session;
    })().finally(() => { pending = null; });
    return pending;
  };
  const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const perform = (active: BillLifecycleSession) => {
      const headers = new Headers(init.headers); headers.set("authorization", `Bearer ${active.token}`);
      if (init.body) headers.set("content-type", "application/json");
      return fetcher(`${(active.apiBaseUrl ?? apiBaseUrl).replace(/\/$/, "")}/partner/v2/${path}`, { ...init, headers });
    };
    let response = await perform(await mint());
    if (response.status === 401) response = await perform(await mint(true));
    if (!response.ok) throw await failure(response);
    return response.json() as Promise<T>;
  };
  const mutate = async <T extends { id: string }>(path: string, input: unknown, key: string, method = "POST"): Promise<T> => {
    if (!key.trim()) throw new Error("An idempotency key is required.");
    const result = await request<{ data: T }>(path, { method, headers: { "idempotency-key": key }, body: JSON.stringify(input) });
    if (!result.data?.id) throw new Error("The RFA response was invalid.");
    return result.data;
  };
  const path = (id: string, suffix: string) => `rfas/${encodeURIComponent(id)}/${suffix}`;
  return {
    recordReceipt: (id, input, key) => {
      if (!input.proofDocumentId?.trim() && !input.providerMessageId?.trim()) return Promise.reject(new Error("Receipt requires a proof document or provider reference."));
      return mutate(path(id, "transmissions"), { ...input, direction: "inbound", status: "received", occurredAt: input.receivedAt }, key);
    },
    recordInformationRequest: (id, input, key) => mutate(path(id, "information-requests"), input, key),
    recordInformationResponse: (id, requestId, input, key) => mutate(path(id, `information-requests/${encodeURIComponent(requestId)}`), input, key),
    recordDecisions: (id, input, key) => mutate(path(id, "decisions"), input, key),
    listFollowUps: async (query = {}) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
      const result = await request<RfaFollowUpList>(`rfa-follow-ups${params.size ? `?${params}` : ""}`);
      if (!Array.isArray(result.data) || !(result.nextCursor === null || typeof result.nextCursor === "string")) throw new Error("The RFA follow-up response was invalid.");
      return result;
    },
    updateFollowUp: (id, input, key) => mutate(`rfa-follow-ups/${encodeURIComponent(id)}`, input, key, "PATCH"),
    clearSession: () => { session = null; },
  };
}
