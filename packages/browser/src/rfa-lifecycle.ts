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
export type RfaScheduling = {
  itemId: string; serviceDescription: string; outcome: string; eligible: boolean;
  authorizationToken: string; version: number; disposition: "pending" | "scheduled" | "no_appointment" | "canceled";
  current: boolean; appointmentAt: string | null; providerName: string | null; location: string | null;
  reason: string | null; updatedAt: string | null;
};
export type RfaSchedulingInput = { expectedVersion: number; authorizationToken: string } & (
  { disposition: "scheduled"; appointmentAt: string; providerName: string; location: string } |
  { disposition: "no_appointment" | "canceled"; reason: string }
);
export type RfaTreatmentClosureInput = { closed: boolean; reason: string; expectedVersion: number };
export type RfaTreatmentClosure = { closed: boolean; reason: string; version: number; updatedAt: string; updatedBy: string };
export type RfaDecisionCorrectionInput = { itemId: string; expectedDecisionEventId: string; reason: string; replacement: RfaDecisionsInput };
export type RfaHistoryEvent = { id: string; sequence: number; eventType: string; actor: string; payload: Record<string, unknown>; occurredAt: string | null };
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
export type RfaInboundFax = {
  id: string; receivedAt: string; fromFax: string | null; fromName: string | null; pages: number | null;
  ocrStatus: string | null; matchedRfaId: string | null; documentId: string | null; previewUrl: string;
  suggestedRfaIds: string[];
};
export type RfaInboundFaxMatch = { faxId: string; rfaId: string; documentId: string; alreadyAttached: boolean };
export type RfaFollowUpList = { data: RfaFollowUp[]; nextCursor: string | null };
export type RfaLifecycleClient = {
  listInboundFaxes(query?: { includeMatched?: boolean; cursor?: string; limit?: number }): Promise<{ data: RfaInboundFax[]; hasMore: boolean; nextCursor: string | null }>;
  getInboundFaxContent(faxId: string): Promise<Blob>;
  matchInboundFax(faxId: string, rfaId: string, idempotencyKey: string): Promise<RfaInboundFaxMatch>;
  listScheduling(id: string): Promise<RfaScheduling[]>;
  updateScheduling(id: string, itemId: string, input: RfaSchedulingInput, idempotencyKey: string): Promise<RfaScheduling[]>;
  updateTreatmentClosure(id: string, itemId: string, input: RfaTreatmentClosureInput, idempotencyKey: string): Promise<RfaRecord>;
  correctDecision(id: string, input: RfaDecisionCorrectionInput, idempotencyKey: string): Promise<RfaRecord>;
  listHistory(id: string): Promise<RfaHistoryEvent[]>;
  addNote(id: string, text: string, idempotencyKey: string): Promise<RfaHistoryEvent>;
  recordReceipt(id: string, input: RfaReceiptInput, idempotencyKey: string): Promise<RfaRecord>;
  recordInformationRequest(id: string, input: RfaInformationRequestInput, idempotencyKey: string): Promise<RfaRecord>;
  recordInformationResponse(id: string, requestId: string, input: RfaInformationResponseInput, idempotencyKey: string): Promise<RfaRecord>;
  recordDecisions(id: string, input: RfaDecisionsInput, idempotencyKey: string): Promise<RfaRecord>;
  listFollowUps(query?: { patientId?: string; renderingProviderId?: string; claimId?: string; includeResolved?: boolean; limit?: number; cursor?: string }): Promise<RfaFollowUpList>;
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
  const responseFor = async (path: string, init: RequestInit = {}): Promise<Response> => {
    const perform = (active: BillLifecycleSession) => {
      const headers = new Headers(init.headers); headers.set("authorization", `Bearer ${active.token}`);
      if (init.body) headers.set("content-type", "application/json");
      return fetcher(`${(active.apiBaseUrl ?? apiBaseUrl).replace(/\/$/, "")}/partner/v2/${path}`, { ...init, headers });
    };
    let response = await perform(await mint());
    if (response.status === 401) response = await perform(await mint(true));
    if (!response.ok) throw await failure(response);
    return response;
  };
  const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => (await responseFor(path, init)).json() as Promise<T>;
  const mutate = async <T extends { id: string }>(path: string, input: unknown, key: string, method = "POST"): Promise<T> => {
    if (!key.trim()) throw new Error("An idempotency key is required.");
    const result = await request<{ data: T }>(path, { method, headers: { "idempotency-key": key }, body: JSON.stringify(input) });
    if (!result.data?.id) throw new Error("The RFA response was invalid.");
    return result.data;
  };
  const path = (id: string, suffix: string) => `rfas/${encodeURIComponent(id)}/${suffix}`;
  const readArray = async <T>(route: string, init?: RequestInit): Promise<T[]> => {
    const result = await request<{ data: T[] }>(route, init);
    if (!Array.isArray(result.data)) throw new Error("The RFA response was invalid.");
    return result.data;
  };
  return {
    listInboundFaxes: async (query = {}) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
      const result = await request<{ data: RfaInboundFax[]; hasMore: boolean; nextCursor: string | null }>(`rfa-inbound-faxes${params.size ? `?${params}` : ""}`);
      if (!Array.isArray(result.data) || typeof result.hasMore !== "boolean" || (result.nextCursor !== null && typeof result.nextCursor !== "string") || (result.hasMore && !result.nextCursor)) throw new Error("The inbound fax response was invalid.");
      return result;
    },
    getInboundFaxContent: async faxId => (await responseFor(`rfa-inbound-faxes/${encodeURIComponent(faxId)}/content`)).blob(),
    matchInboundFax: async (faxId, rfaId, key) => {
      if (!key.trim()) throw new Error("An idempotency key is required.");
      if (!rfaId.trim()) throw new Error("Choose an authorization request.");
      const result = await request<{ data: RfaInboundFaxMatch }>(`rfa-inbound-faxes/${encodeURIComponent(faxId)}/match`, { method: "POST", headers: { "idempotency-key": key }, body: JSON.stringify({ rfaId }) });
      if (!result.data?.documentId || result.data.faxId !== faxId || result.data.rfaId !== rfaId) throw new Error("The fax match response was invalid.");
      return result.data;
    },
    listScheduling: id => readArray<RfaScheduling>(path(id, "scheduling")),
    updateScheduling: (id, itemId, input, key) => {
      if (!key.trim()) return Promise.reject(new Error("An idempotency key is required."));
      return readArray<RfaScheduling>(path(id, `items/${encodeURIComponent(itemId)}/scheduling`), { method: "PATCH", headers: { "idempotency-key": key }, body: JSON.stringify(input) });
    },
    updateTreatmentClosure: (id, itemId, input, key) => {
      const reason = input.reason.trim();
      if (!reason || reason.length > 2000) return Promise.reject(new Error("Enter a reason of 1–2000 characters."));
      if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 0) return Promise.reject(new Error("Refresh to load the current treatment version."));
      return mutate(path(id, `items/${encodeURIComponent(itemId)}/closure`), { ...input, reason }, key, "PATCH");
    },
    correctDecision: (id, input, key) => mutate(path(id, "decision-corrections"), input, key),
    listHistory: id => readArray<RfaHistoryEvent>(path(id, "events")),
    addNote: (id, text, key) => {
      if (!text.trim()) return Promise.reject(new Error("Enter a note."));
      return mutate<RfaHistoryEvent>(path(id, "events"), { text: text.trim() }, key);
    },
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
