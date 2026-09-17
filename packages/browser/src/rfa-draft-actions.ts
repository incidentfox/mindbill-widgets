import type { BillLifecycleSession, OrganizationClientOptions, RfaRecord } from "./index";

export type RfaDraftActionsClient = {
  /** Copies the request content into a new unsigned draft. Attachments and delivery are not copied. */
  copy(id: string, expectedRevision: number, idempotencyKey: string): Promise<RfaRecord>;
  /** Cancels only an unchanged, unsigned, unsubmitted draft; audit history is retained. */
  cancelDraft(id: string, expectedRevision: number, idempotencyKey: string): Promise<RfaRecord>;
  clearSession(): void;
};

export function createRfaDraftActionsClient({ sessionEndpoint = "/api/mindbill/session", getSession, apiBaseUrl = "https://app.mindbill.org", fetch: fetchOverride }: OrganizationClientOptions = {}): RfaDraftActionsClient {
  const fetcher = fetchOverride ?? globalThis.fetch;
  let session: BillLifecycleSession | null = null;
  let pending: Promise<BillLifecycleSession> | null = null;
  const failure = async (response: Response) => {
    const body = await response.json().catch(() => null) as { detail?: unknown; message?: unknown; error?: { message?: unknown } } | null;
    const detail = body?.detail ?? body?.message ?? body?.error?.message;
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
  const mutate = async (id: string, expectedRevision: number, idempotencyKey: string, action: "copy" | "cancel"): Promise<RfaRecord> => {
      if (!id.trim()) throw new Error("An RFA ID is required.");
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) throw new Error("The current RFA content revision is required.");
      if (!idempotencyKey.trim()) throw new Error("An idempotency key is required.");
      const perform = (active: BillLifecycleSession) => fetcher(`${(active.apiBaseUrl ?? apiBaseUrl).replace(/\/$/, "")}/partner/v2/rfas/${encodeURIComponent(id)}${action === "copy" ? "/copy" : ""}`, {
        method: action === "copy" ? "POST" : "PATCH", headers: { authorization: `Bearer ${active.token}`, "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify(action === "copy" ? { expectedRevision } : { status: "canceled", draftOnly: true, expectedRevision }),
      });
      let response = await perform(await mint());
      if (response.status === 401) response = await perform(await mint(true));
      if (!response.ok) throw await failure(response);
      const result = await response.json() as { data?: RfaRecord };
      if (!result.data?.id) throw new Error("The RFA response was invalid.");
      return result.data;
  };
  return {
    copy: (id, revision, key) => mutate(id, revision, key, "copy"),
    cancelDraft: (id, revision, key) => mutate(id, revision, key, "cancel"),
    clearSession: () => { session = null; },
  };
}
