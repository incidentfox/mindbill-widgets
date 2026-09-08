"use client";
import { useEffect, useState } from "react";
import { jsonRequest } from "./api-client";
import { BillingDashboard } from "./billing/BillingDashboard";
import { PracticeSettings } from "./billing/PracticeSettings";
import { CaseWorkspace } from "./workspace/CaseWorkspace";
import { Icon } from "./workspace/Icon";
import { Login } from "./workspace/Login";

type Page = "case" | "dashboard" | "settings";
const pages = [["case", "Example case"], ["dashboard", "Billing dashboard"], ["settings", "Settings"]] as const;

export function ReviewDeskApp() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState<Page>("case");
  const [tab, setTab] = useState<"records" | "bill">("records");
  useEffect(() => {
    void jsonRequest("/api/config").then(value => setSignedIn(value.signedIn)).catch(cause => setError(cause.message));
  }, []);
  function openBill() { setPage("case"); setTab("bill"); }
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="Review desk home"><span className="brand-mark">r.</span><span>review desk<span className="brand-sub">REFERENCE APP</span></span></a>
      <div className="workspace-label"><span className="workspace-avatar">EW</span><div>Example workspace<small>Medical records review</small></div></div>
      <p className="nav-label">WORKSPACE</p><nav aria-label="Main navigation">
        {pages.map(([id, label]) => <button key={id} aria-current={page === id ? "page" : undefined} onClick={() => setPage(id)}><Icon name={id} />{label}{page === id && <span className="nav-dot" />}</button>)}
      </nav>
      <div className="sidebar-footer"><span className="demo-dot" /> Sandbox connection
        <p>Built with MindBill components.<br />All case content is fictional.</p>
        <a href="https://docs.mindbill.org/learn/quickstart" target="_blank" rel="noreferrer">Integration docs ↗</a>
        <a href="https://github.com/incidentfox/mindbill-widgets/tree/main/examples/quickstart" target="_blank" rel="noreferrer">Get the starter code ↗</a>
      </div>
    </aside>
    <div className="main-column">
      <header className="topbar"><span>Workspace <span className="crumb-divider">/</span> <strong>{pages.find(([id]) => id === page)?.[1]}</strong></span><span className="user-avatar" title="Fictional review administrator">JE</span></header>
      <div className="demo-banner"><span><strong>Sandbox workspace</strong><span className="banner-detail">Fictional records and sandbox billing.</span></span></div>
      <main>
        {error && <div role="alert" className="error-message">{error}</div>}
        {signedIn === null && !error && <p role="status">Opening the example workspace…</p>}
        {signedIn === false && <Login onSignedIn={() => setSignedIn(true)} />}
        {signedIn && page === "case" && <CaseWorkspace tab={tab} setTab={setTab} />}
        {signedIn && page === "dashboard" && <BillingDashboard openBill={openBill} />}
        {signedIn && page === "settings" && <PracticeSettings />}
      </main>
      <footer className="page-footer"><span>Review desk <span className="footer-dot">·</span> A MindBill reference implementation</span><span>Fictional data only</span></footer>
    </div>
  </div>;
}
