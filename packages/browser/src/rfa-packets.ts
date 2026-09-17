import type { BillLifecycleSession, OrganizationClientOptions } from "./index";

export type RfaSavedPacket = { id: string; source: "download" | "submission"; sha256: string; sizeBytes: number; contentRevision: number; createdAt: string };
export type RfaPacketTransmission = { id: string; packetId: string | null; purpose: "submission" | "forward"; channel: string; status: string; destination: string | null; occurredAt: string; receivedAt: string | null };
export type RfaPacketHistory = { packets: RfaSavedPacket[]; transmissions: RfaPacketTransmission[] };
export type RfaForwardInput = { packetId: string; channel: "fax" | "email"; to: string };
export type RfaForwardResult = { transmissionId: string; packetId: string };
export type RfaPacketsClient = {
  list(id: string): Promise<RfaPacketHistory>;
  get(id: string, packetId: string): Promise<Blob>;
  /** Forwards retained bytes without changing the original submission or review deadline. */
  forward(id: string, input: RfaForwardInput, idempotencyKey: string): Promise<RfaForwardResult>;
  clearSession(): void;
};

export function createRfaPacketsClient({ sessionEndpoint = "/api/mindbill/session", getSession, apiBaseUrl = "https://app.mindbill.org", fetch: fetchOverride }: OrganizationClientOptions = {}): RfaPacketsClient {
  const fetcher = fetchOverride ?? globalThis.fetch;
  let session: BillLifecycleSession | null = null;
  let pending: Promise<BillLifecycleSession> | null = null;
  const failure = async (response: Response) => {
    const body = await response.json().catch(() => null) as { detail?: unknown; message?: unknown; error?: { message?: unknown } } | null;
    const detail = body?.detail ?? body?.message ?? (typeof body?.error === "string" ? body.error : body?.error?.message);
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
  const request = async (id: string, path: string, init?: RequestInit): Promise<Response> => {
    if (!id.trim()) throw new Error("An RFA ID is required.");
    const perform = (active: BillLifecycleSession) => fetcher(`${(active.apiBaseUrl ?? apiBaseUrl).replace(/\/$/, "")}/partner/v2/rfas/${encodeURIComponent(id)}${path}`, {
      ...init, headers: { ...init?.headers, authorization: `Bearer ${active.token}` },
    });
    let response = await perform(await mint());
    if (response.status === 401) response = await perform(await mint(true));
    if (!response.ok) throw await failure(response);
    return response;
  };
  return {
    async list(id) {
      const result = await (await request(id, "/packets")).json() as { data?: RfaPacketHistory };
      if (!result.data || !Array.isArray(result.data.packets) || !Array.isArray(result.data.transmissions)) throw new Error("The saved packet response was invalid.");
      return result.data;
    },
    async get(id, packetId) {
      if (!packetId.trim()) throw new Error("A saved packet ID is required.");
      const response = await request(id, `/packets/${encodeURIComponent(packetId)}`);
      if (!response.headers.get("content-type")?.toLowerCase().startsWith("application/pdf")) throw new Error("The saved packet response was not a PDF.");
      return response.blob();
    },
    async forward(id, input, idempotencyKey) {
      if (!input.packetId.trim()) throw new Error("A saved packet ID is required.");
      if (!idempotencyKey.trim()) throw new Error("An idempotency key is required.");
      const to = input.to.trim();
      if (input.channel === "fax" ? !/^\+[1-9]\d{7,14}$/.test(to) : input.channel !== "email" || to.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error("Enter a valid recipient email or fax number with country code.");
      const result = await (await request(id, "/forwards", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify({ packetId: input.packetId, channel: input.channel, to: input.channel === "email" ? to.toLowerCase() : to }) })).json() as { data?: RfaForwardResult };
      if (!result.data?.transmissionId || result.data.packetId !== input.packetId) throw new Error("The forwarding response was invalid. Check delivery history before retrying.");
      return result.data;
    },
    clearSession: () => { session = null; },
  };
}
