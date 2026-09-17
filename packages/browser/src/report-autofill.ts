import type { BillLifecycleSession, OrganizationClientOptions } from "./index";

export type ReportAutofillField = { key: string; value: string; sourceText: string; confidence: "high" | "medium" };
export type ReportAutofillMatch = { status: "matched" | "ambiguous" | "none"; candidates: Array<{ id: string; name: string }>; selectedId?: string };
export type ReportAutofillResult = {
  model: "gpt-5.6-luna"; requiresReview: true; fields: ReportAutofillField[];
  matches: Record<"patient" | "billingProvider" | "renderingProvider" | "serviceLocation", ReportAutofillMatch>;
  warnings: string[];
};
export type ReportAutofillClient = { analyze(report: File): Promise<ReportAutofillResult>; clearSession(): void };
/** Available only by written agreement, with an organization-wide autofill:run session. Does not save a document or submit a bill. */
export function createReportAutofillClient({ sessionEndpoint = "/api/mindbill/session", getSession, apiBaseUrl = "https://app.mindbill.org", fetch: fetchOverride }: OrganizationClientOptions = {}): ReportAutofillClient {
  const fetcher = fetchOverride ?? globalThis.fetch;
  let session: BillLifecycleSession | null = null;
  const error = async (response: Response) => {
    const body = await response.json().catch(() => null) as { detail?: unknown; message?: unknown } | null;
    return new Error(typeof body?.detail === "string" ? body.detail : typeof body?.message === "string" ? body.message : `Report analysis failed (${response.status}).`);
  };
  const mint = async (): Promise<BillLifecycleSession> => {
    if (session && (!session.expiresAt || Date.parse(session.expiresAt) > Date.now() + 30_000)) return session;
    const value: unknown = getSession ? await getSession({ signal: new AbortController().signal }) : await (async () => {
      const response = await fetcher(sessionEndpoint, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: "{}" });
      if (!response.ok) throw await error(response);
      return response.json();
    })();
    const envelope = value as { session?: unknown; data?: unknown } | null;
    const candidate = (envelope?.session ?? envelope?.data ?? value) as BillLifecycleSession | null;
    if (!candidate || typeof candidate.token !== "string" || candidate.token.length < 8) throw new Error("The report session endpoint did not return a browser session token.");
    session = candidate;
    return candidate;
  };
  return {
    clearSession: () => { session = null; },
    analyze: async report => {
      if (report.type !== "application/pdf") throw new Error("Choose a PDF report.");
      if (!report.size || report.size > 25 * 1024 * 1024) throw new Error("Choose a non-empty PDF report no larger than 25 MB.");
      const perform = async () => {
        const active = await mint(); const body = new FormData(); body.append("report", report);
        return fetcher(`${(active.apiBaseUrl ?? apiBaseUrl).replace(/\/$/, "")}/partner/v2/report-autofill`, { method: "POST", headers: { authorization: `Bearer ${active.token}` }, body });
      };
      let response = await perform();
      if (response.status === 401) { session = null; response = await perform(); }
      if (!response.ok) throw await error(response);
      const envelope = await response.json() as { data?: ReportAutofillResult };
      const result = envelope.data;
      if (!result || result.requiresReview !== true || !Array.isArray(result.fields) || !Array.isArray(result.warnings) || !result.matches
        || result.fields.some(field => !field || typeof field.key !== "string" || typeof field.value !== "string" || typeof field.sourceText !== "string" || !["high", "medium"].includes(field.confidence))
        || result.warnings.some(warning => typeof warning !== "string")
        || (["patient", "billingProvider", "renderingProvider", "serviceLocation"] as const).some(kind => {
          const match = result.matches[kind];
          return !match || !["matched", "ambiguous", "none"].includes(match.status) || !Array.isArray(match.candidates) || match.candidates.some(candidate => !candidate || typeof candidate.id !== "string" || typeof candidate.name !== "string");
        })) throw new Error("The report analysis response was invalid.");
      return result;
    },
  };
}
