import type { BillLifecycleSession, BrowserBillCreateInput, OrganizationClientOptions } from "./index";
import type { EncounterQuoteIdentity } from "./encounter-fees";

/**
 * An unsent bill draft (`/partner/v2/bill-drafts`). It holds the bill input as entered, which may be
 * incomplete, and the saved ids used to price it. A draft is never transmitted: submit it by sending its
 * bill through `submitBill` with `draft: { id, revision }`.
 */
export type BillDraft = {
  id: string;
  externalId: string | null;
  status: "draft" | "submitting" | "submitted";
  revision: number;
  claimId: string | null;
  patientId: string | null;
  bill: Partial<BrowserBillCreateInput> & Record<string, unknown>;
  encounter: Partial<EncounterQuoteIdentity> | null;
  serviceLineCount: number;
  submittedBillId: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
};
export type BillDraftReference = { id: string; revision: number };
export type BillDraftListQuery = { claimId?: string; status?: "draft" | "submitted"; limit?: number; cursor?: string };
export type BillDraftPage = { data: BillDraft[]; nextCursor: string | null };
export type BillDraftSaveInput = { bill: Record<string, unknown>; encounter?: Partial<EncounterQuoteIdentity> | null; externalId?: string };

export type BillDraftsClient = {
  list(query?: BillDraftListQuery): Promise<BillDraftPage>;
  get(id: string): Promise<BillDraft>;
  /** Saves a new draft. Nothing is validated for submission or sent. */
  create(input: BillDraftSaveInput, idempotencyKey?: string): Promise<BillDraft>;
  /** Replaces a draft; `expectedRevision` must be its current revision. */
  update(id: string, expectedRevision: number, input: Omit<BillDraftSaveInput, "externalId">, idempotencyKey?: string): Promise<BillDraft>;
  /** Deletes an unsent draft. */
  remove(id: string, expectedRevision: number, idempotencyKey?: string): Promise<void>;
  clearSession(): void;
};

const failure = async (response: Response) => {
  const body = await response.json().catch(() => null) as { detail?: unknown; code?: unknown } | null;
  const error = new Error(typeof body?.detail === "string" ? body.detail : `The bill draft request failed (${response.status}).`) as Error & { code?: string; status?: number };
  if (typeof body?.code === "string") error.code = body.code;
  error.status = response.status;
  return error;
};
const key = () => globalThis.crypto.randomUUID();
const draftOf = (value: unknown): BillDraft => {
  const draft = (value as { data?: BillDraft } | null)?.data;
  if (!draft || typeof draft.id !== "string" || !Number.isInteger(draft.revision)) throw new Error("The bill draft response was invalid.");
  return draft;
};

/** Unsent bill drafts through a short-lived browser session (`bills:read`; `bills:create` to save). Never pass an API key. */
export function createBillDraftsClient({ sessionEndpoint = "/api/mindbill/session", getSession, apiBaseUrl = "https://app.mindbill.org", fetch: fetchOverride }: OrganizationClientOptions = {}): BillDraftsClient {
  const fetcher = fetchOverride ?? globalThis.fetch;
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
      return fetcher(`${(active.apiBaseUrl ?? apiBaseUrl).replace(/\/$/, "")}/partner/v2/bill-drafts${path}`, { ...init, headers });
    };
    let response = await perform(await mint());
    if (response.status === 401) response = await perform(await mint(true));
    if (!response.ok) throw await failure(response);
    return response;
  };
  const id = (value: string) => {
    if (!value?.trim()) throw new Error("A draft ID is required.");
    return encodeURIComponent(value);
  };
  return {
    async list(query = {}) {
      const params = new URLSearchParams();
      for (const [name, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(name, String(value));
      const body = await (await request(params.size ? `?${params}` : "")).json() as BillDraftPage;
      if (!Array.isArray(body?.data)) throw new Error("The bill draft list was invalid.");
      return body;
    },
    async get(draftId) { return draftOf(await (await request(`/${id(draftId)}`)).json()); },
    async create(input, idempotencyKey = key()) {
      const body = { bill: input.bill, ...(input.encounter ? { encounter: input.encounter } : {}), ...(input.externalId ? { externalId: input.externalId } : {}) };
      return draftOf(await (await request("", { method: "POST", headers: { "idempotency-key": idempotencyKey }, body: JSON.stringify(body) })).json());
    },
    async update(draftId, expectedRevision, input, idempotencyKey = key()) {
      const body = { expectedRevision, bill: input.bill, ...(input.encounter !== undefined ? { encounter: input.encounter } : {}) };
      return draftOf(await (await request(`/${id(draftId)}`, { method: "PATCH", headers: { "idempotency-key": idempotencyKey }, body: JSON.stringify(body) })).json());
    },
    async remove(draftId, expectedRevision, idempotencyKey = key()) {
      await request(`/${id(draftId)}?${new URLSearchParams({ expectedRevision: String(expectedRevision) })}`, { method: "DELETE", headers: { "idempotency-key": idempotencyKey } });
    },
    clearSession() { session = null; },
  };
}
