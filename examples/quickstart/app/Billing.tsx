"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { BillSubmissionForm, BillingSettings, ConnectedBillLifecycle, ConnectedBillingWorkspace } from "@mindbill/react";
import { exampleBill, records } from "../lib/case";

type Page = "case" | "dashboard" | "settings";
type Config = { mode: "demo" | "sandbox"; signedIn: boolean };
const appearance = { accentColor: "#27665b", fontFamily: "inherit" };

async function jsonRequest(path: string, init?: RequestInit) {
  const response = await fetch(path, { cache: "no-store", ...init });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "The request failed. Please try again.");
  return body;
}
function Icon({ name }: { name: "case" | "dashboard" | "settings" | "file" | "arrow" }) {
  const paths = { case: "M3 7h6l2 2h10v11H3z M3 7V4h7l2 3", dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z", settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2", file: "M6 2h8l4 4v16H6z M14 2v5h4 M9 12h6 M9 16h6", arrow: "M5 12h14 M13 6l6 6-6 6" };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
function IntegrationNote({ children }: { children: ReactNode }) {
  return <details className="integration-note"><summary>How this integration works <span aria-hidden="true">＋</span></summary><div>{children}</div></details>;
}

export function Billing() {
  const [config, setConfig] = useState<Config | null>(null);
  const [page, setPage] = useState<Page>("case");
  const [tab, setTab] = useState<"records" | "bill">("records");
  const [record, setRecord] = useState<number | null>(null);
  const [billId, setBillId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [linkError, setLinkError] = useState("");
  const [revision, setRevision] = useState(0);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const loadCase = useCallback(async (mode: Config["mode"]) => {
    setReady(false);
    setError("");
    try {
      const state = await jsonRequest(mode === "demo" ? "/api/demo/state" : "/api/case/bill");
      setBillId(state.billId ?? null);
      setReady(true);
    } catch (cause) { setError((cause as Error).message); }
  }, []);
  useEffect(() => {
    void jsonRequest("/api/config").then(async (value: Config) => {
      setConfig(value);
      if (value.signedIn) await loadCase(value.mode);
    }).catch(cause => setError(cause.message));
  }, [loadCase]);

  const getSession = useCallback(async ({ signal }: { signal: AbortSignal }) => {
    if (config?.mode === "demo") return { token: "synthetic-demo-token", apiBaseUrl: `${window.location.origin}/api/demo` };
    return jsonRequest("/api/mindbill/session", { method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ surface: "billing" }) });
  }, [config?.mode]);
  const getSettingsSession = useCallback(async ({ signal }: { signal: AbortSignal }) => {
    if (config?.mode === "demo") return { token: "synthetic-demo-token", apiBaseUrl: `${window.location.origin}/api/demo` };
    return jsonRequest("/api/mindbill/session", { method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ surface: "settings" }) });
  }, [config?.mode]);

  // The same SDK components are used in both modes. Only their session provider
  // changes. Demo HTTP responses live in lib/demo-transport.ts, outside this UI.
  const initialBill = useMemo(() => config?.mode === "sandbox"
    ? { ...exampleBill, claim: { ...exampleBill.claim, claimsAdministrator: undefined } }
    : exampleBill, [config?.mode]);
  async function created(id: string) {
    // Show the created bill immediately and never turn a linking failure back
    // into a create form. A retry/reload recovers the ID using externalId.
    setBillId(id);
    setLinkError("");
    try {
      if (config?.mode === "sandbox") await jsonRequest("/api/case/bill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ billId: id }) });
      else await jsonRequest("/api/demo/state");
    } catch { setLinkError("Your bill was created, but its case link could not be saved. Keep this bill open and retry saving the link; do not submit a new bill."); }
  }
  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await jsonRequest("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      setPassword(""); setConfig({ mode: "sandbox", signedIn: true }); await loadCase("sandbox");
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  async function reset() {
    setBusy(true); setError("");
    try {
      await jsonRequest("/api/demo/reset", { method: "POST" });
      setLinkError(""); setRevision(value => value + 1); await loadCase("demo");
      setPage("case"); setTab("records");
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  function openBill() { setPage("case"); setTab("bill"); if (config) void loadCase(config.mode); }

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="Review desk home"><span className="brand-mark">r.</span><span>review desk<span className="brand-sub">REFERENCE APP</span></span></a>
      <div className="workspace-label"><span className="workspace-avatar">EP</span><div>Example practice<small>Medical records review</small></div></div>
      <p className="nav-label">WORKSPACE</p>
      <nav aria-label="Main navigation">
        {([ ["case", "Example case"], ["dashboard", "Billing dashboard"], ["settings", "Settings"] ] as const).map(([id, label]) => <button key={id} aria-current={page === id ? "page" : undefined} onClick={() => setPage(id)}><Icon name={id} />{label}{page === id && <span className="nav-dot" />}</button>)}
      </nav>
      <div className="sidebar-footer"><span className="demo-dot" /> {config?.mode === "sandbox" ? "Sandbox connection" : "Interactive demo"}<p>Built with MindBill components.<br />All case content is fictional.</p><a href="https://docs.mindbill.org/learn/quickstart" target="_blank" rel="noreferrer">Integration docs ↗</a><a href="https://github.com/incidentfox/mindbill-widgets/tree/main/examples/quickstart" target="_blank" rel="noreferrer">Get the starter code ↗</a></div>
    </aside>
    <div className="main-column">
      <header className="topbar"><span>Workspace <span className="crumb-divider">/</span> <strong>{page === "case" ? "Example case" : page === "dashboard" ? "Billing dashboard" : "Settings"}</strong></span><span className="user-avatar" title="Fictional review administrator">JE</span></header>
      <div className="demo-banner"><span><strong>{config?.mode === "sandbox" ? "Sandbox setup" : "Try the full workflow"}</strong><span className="banner-detail">{config?.mode === "sandbox" ? "Use a sandbox key and fictional data only. Requests reach your configured MindBill organization." : "Fictional records. Simulated billing. No API key needed."}</span></span>{config?.mode !== "sandbox" && <button onClick={() => void reset()} disabled={busy || !ready}>Reset demo ↺</button>}</div>
      <main>
        {!config && !error && <p role="status">Opening the example workspace…</p>}
        {error && <div role="alert" className="error-message">{error}{config?.signedIn && <button onClick={() => void loadCase(config.mode)}>Retry</button>}</div>}
        {config && !config.signedIn ? <section className="login-panel"><p className="eyebrow">SANDBOX CONNECTION</p><h1>Open your workspace</h1><p>Enter the administrator password configured in your local starter’s environment file.</p><form onSubmit={login}><label htmlFor="password">Starter password</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /><button className="primary-button" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button></form></section> : config?.signedIn && <>
          {page === "case" && <>
            <div className="page-heading"><div><p className="eyebrow">CASE 001 <span>•</span> MED-LEGAL REVIEW</p><h1>Alex Morgan <span className="fictional-badge">Fictional patient</span></h1><p className="page-description">Left shoulder · Records review for an example evaluation</p></div><button className="primary-button" onClick={openBill}>{billId ? "Open bill" : "Prepare bill"}<Icon name="arrow" /></button></div>
            <dl className="case-facts"><div><dt>Claim number</dt><dd>TEST-2026-001</dd></div><div><dt>Date of injury</dt><dd>Jun 1, 2026</dd></div><div><dt>Evaluation date</dt><dd>Aug 1, 2026</dd></div><div><dt>Reviewer</dt><dd>Dr. Jamie Example</dd></div></dl>
            <div className="case-tabs" role="tablist" aria-label="Case sections"><button role="tab" id="records-tab" aria-controls="case-panel" aria-selected={tab === "records"} onClick={() => setTab("records")}>Records & summary <span>3</span></button><button role="tab" id="bill-tab" aria-controls="case-panel" aria-selected={tab === "bill"} onClick={openBill}>Bill {billId && <span className="linked-dot" aria-label="Bill linked" />}</button></div>
            <section id="case-panel" role="tabpanel" aria-labelledby={tab === "records" ? "records-tab" : "bill-tab"}>
              {tab === "records" ? <div className="records-layout">
                <section className="records-list"><div className="section-heading"><h2>Medical records</h2><span>3 files</span></div><p className="muted">A small, hand-authored example record set.</p>{records.map((item, index) => <button className={`record-card ${record === index ? "selected" : ""}`} key={item.id} onClick={() => setRecord(index)}><span className="file-icon"><Icon name="file" /></span><span><strong>{item.title}</strong><small>{item.date} · {item.kind}</small></span><span className="record-arrow">↗</span></button>)}<div className="record-footnote">Synthetic text documents for exploring the starter. Never upload real patient records to this demo.</div></section>
                <section className="summary-card">{record === null ? <><div className="summary-top"><span className="eyebrow">REVIEW SUMMARY</span><span className="subtle-badge">Example content</span></div><h2>A brief view of the record</h2><p className="summary-intro">Three documents trace a fictional left shoulder complaint from the first visit to follow-up.</p><div className="summary-section"><h3>Initial presentation</h3><p>The June 3 note describes shoulder discomfort after lifting at work, with difficulty reaching overhead. <button className="source-link" onClick={() => setRecord(0)}>1</button></p></div><div className="summary-section"><h3>Course documented</h3><p>The therapy and follow-up notes describe improving comfort, with some overhead symptoms remaining. <button className="source-link" onClick={() => setRecord(1)}>2</button> <button className="source-link" onClick={() => setRecord(2)}>3</button></p></div><div className="summary-section"><h3>Gaps to review</h3><p>These example records do not include imaging, standardized functional scores, or a final impairment determination.</p></div><div className="summary-footer"><span className="small-check">✓</span> Hand-authored summary · Click a source number to read its record</div></> : <><div className="summary-top"><button className="text-button" onClick={() => setRecord(null)}>← Back to summary</button><a className="text-button" href={records[record].file} download>Download .txt ↓</a></div><h2>{records[record].title}</h2><pre className="record-content">{records[record].text}</pre></>}</section>
              </div> : <>
                <div className="surface-intro"><div><h2>{billId ? "The bill for this case" : "Create this case’s first bill"}</h2><p>{billId ? "This case is linked to its MindBill bill. Come back here to track progress and take action." : "The case has no bill yet. We’ve filled in its example patient, claim, and service details."}</p></div>{billId && <span className="subtle-badge">Case linked</span>}</div>
                {linkError && <div className="error-message" role="alert">{linkError}<button onClick={() => billId && void created(billId)}>Retry saving link</button></div>}
                {!ready ? <p role="status">{error ? "Resolve the connection error before creating a bill." : "Checking this case’s saved bill…"}</p> : <div className="sdk-surface" key={revision}>{billId ? <ConnectedBillLifecycle billId={billId} getSession={getSession} appearance={appearance} style={{ height: 730 }} /> : <BillSubmissionForm initialBill={initialBill} getSession={getSession} onSubmitted={result => created(result.bill.id)} appearance={appearance} profileDisplay="compact" heading="New bill" description="Review the prefilled example, choose its claims administrator, and submit when ready." submitLabel={config.mode === "demo" ? "Create simulated bill" : "Create sandbox bill"} />}</div>}
                <IntegrationNote><p><code>BillSubmissionForm</code> creates the bill when this case has no saved ID. Its <code>onSubmitted</code> callback sends <code>result.bill.id</code> to your backend, which verifies it and saves the case association.</p><p>On later visits, the backend loads that ID and the app renders <code>ConnectedBillLifecycle billId=…</code>. If the callback was missed, the backend searches for the case’s stable <code>externalId</code> before offering a create form.</p><p>See <code>app/Billing.tsx</code>, <code>app/api/case/bill/route.ts</code>, and <code>lib/case-store.ts</code> in the starter.</p></IntegrationNote>
              </>}
            </section>
          </>}
          {page === "dashboard" && <><div className="page-heading"><div><p className="eyebrow">BILLING</p><h1>Billing dashboard</h1><p className="page-description">The billing workspace across your practice’s cases.</p></div><button className="primary-button" onClick={openBill}>{billId ? "Open example bill" : "Create example bill"}<Icon name="arrow" /></button></div>{ready && <div className="sdk-surface dashboard-surface"><ConnectedBillingWorkspace key={revision} initialView="bills" getSession={getSession} appearance={appearance} onCreateBill={openBill} style={{ height: 770 }} /></div>}<IntegrationNote><p><code>ConnectedBillingWorkspace</code> provides the bill list, filters, tasks, and drill-down into a bill. <code>onCreateBill</code> opens the host app’s case so the next bill has a case association.</p><p>The local simulation contains one case. Start on the Bill tab to create its bill, then return here to find it.</p></IntegrationNote></>}
          {page === "settings" && <><div className="page-heading"><div><p className="eyebrow">YOUR PRACTICE</p><h1>Billing settings</h1><p className="page-description">Practice identity, providers, and service locations in one place.</p></div><span className="subtle-badge">Administrator</span></div>{ready && <div className="sdk-surface settings-surface"><BillingSettings key={revision} getSession={getSettingsSession} appearance={appearance} heading="Practice profile" description="The example organization’s reusable billing details." /></div>}<IntegrationNote><p><code>BillingSettings</code> edits the organization profile stored in MindBill. Its separate session requires <code>organization:manage</code>; your backend must check the signed-in user’s administrator role.</p><p>The records and summary belong to your application. MindBill owns the billing workflow. The browser uses a short-lived session to call MindBill directly; the developer API key stays on your server.</p></IntegrationNote></>}
        </>}
      </main>
      <footer className="page-footer"><span>Review desk <span className="footer-dot">·</span> A MindBill reference implementation</span><span>Fictional data only</span></footer>
    </div>
  </div>;
}
