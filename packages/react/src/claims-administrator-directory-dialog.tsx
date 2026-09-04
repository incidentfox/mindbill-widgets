"use client";

import type { ReactElement, ReactNode } from "react";
import { useEffect, useState } from "react";
import type {
  BillClaimsAdministratorContact,
  BillClaimsAdministratorDirectory,
} from "@mindbill/browser";

export type ClaimsAdministratorDirectoryDialogProps = {
  open: boolean;
  directory?: BillClaimsAdministratorDirectory | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
};

type Tab = "main" | "bill-review" | "authorization" | "mailing" | "patterns";

const css = `
.mbcad-backdrop{position:fixed;z-index:1000;inset:0;display:grid;place-items:center;padding:24px;background:rgba(17,28,38,.44)}
.mbcad-dialog{--mbcad-accent:var(--mb-accent,#176c70);--mbcad-border:var(--mb-border,#d7e0df);--mbcad-surface:var(--mb-surface,#fff);--mbcad-text:var(--mb-text,#17282d);--mbcad-muted:var(--mb-muted,#607176);display:grid;grid-template-rows:auto auto minmax(0,1fr);width:min(1180px,100%);max-height:min(860px,92vh);overflow:hidden;border:1px solid var(--mbcad-border);border-radius:14px;background:var(--mbcad-surface);color:var(--mbcad-text);box-shadow:0 28px 80px rgba(14,31,43,.28);font-family:var(--mb-font,Inter,ui-sans-serif,system-ui,sans-serif)}
.mbcad-head{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:18px 22px;border-bottom:1px solid var(--mbcad-border)}.mbcad-head h2{margin:0;font-size:24px;line-height:1.2}.mbcad-close{width:40px;height:40px;border:0;border-radius:9px;background:color-mix(in srgb,var(--mbcad-muted) 9%,var(--mbcad-surface));color:var(--mbcad-accent);font:inherit;font-size:28px;line-height:1;cursor:pointer}
.mbcad-tabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));margin:18px 22px 0;border-radius:10px;background:color-mix(in srgb,var(--mbcad-muted) 8%,var(--mbcad-surface));overflow:hidden}.mbcad-tab{min-height:64px;padding:10px;border:0;border-right:1px solid var(--mbcad-border);border-top:4px solid transparent;background:transparent;color:var(--mbcad-muted);font:inherit;font-weight:750;cursor:pointer}.mbcad-tab:last-child{border-right:0}.mbcad-tab[aria-selected=true]{border-top-color:var(--mbcad-accent);background:var(--mbcad-surface);color:var(--mbcad-text)}
.mbcad-body{overflow:auto;padding:24px 22px 28px}.mbcad-grid{display:grid;gap:0;border:1px solid var(--mbcad-border);border-radius:10px;overflow:hidden}.mbcad-row{display:grid;grid-template-columns:minmax(180px,.8fr) minmax(0,2fr);gap:18px;padding:11px 14px;border-bottom:1px solid var(--mbcad-border)}.mbcad-row:last-child{border-bottom:0}.mbcad-row strong{font-weight:750}.mbcad-list{display:grid;gap:5px;margin:0;padding:0;list-style:none}.mbcad-list a,.mbcad-table a{color:var(--mbcad-accent);overflow-wrap:anywhere}.mbcad-table{width:100%;border-collapse:collapse;border:1px solid var(--mbcad-border);border-radius:10px;overflow:hidden}.mbcad-table th,.mbcad-table td{padding:13px 14px;border-bottom:1px solid var(--mbcad-border);text-align:left;vertical-align:top}.mbcad-table th{background:color-mix(in srgb,var(--mbcad-muted) 7%,var(--mbcad-surface));font-size:13px}.mbcad-empty{padding:36px;text-align:center;color:var(--mbcad-muted)}.mbcad-notice{padding:14px 16px;border:1px solid color-mix(in srgb,var(--mbcad-accent) 70%,var(--mbcad-border));border-radius:9px;background:color-mix(in srgb,var(--mbcad-accent) 5%,var(--mbcad-surface));font-weight:650}
@media(max-width:760px){.mbcad-backdrop{padding:8px}.mbcad-dialog{max-height:96vh}.mbcad-head{padding:14px}.mbcad-head h2{font-size:19px}.mbcad-tabs{display:flex;overflow-x:auto;margin:10px 12px 0}.mbcad-tab{min-width:145px}.mbcad-body{padding:14px 12px 18px}.mbcad-row{grid-template-columns:1fr;gap:5px}.mbcad-table{display:block;overflow-x:auto}}
`;

function outbound(value: string, kind: "phone" | "email" | "url"): ReactElement {
  const href = kind === "phone" ? `tel:${value.replace(/[^+\d]/g, "")}` : kind === "email" ? `mailto:${value}` : /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return <a href={href} {...(kind === "url" ? { target: "_blank", rel: "noreferrer" } : {})}>{value}</a>;
}

function list(values: string[] | undefined, kind?: "phone" | "email" | "url"): ReactNode {
  return values?.length ? <ul className="mbcad-list">{values.map((value, index) => <li key={`${value}-${index}`}>{kind ? outbound(value, kind) : value}</li>)}</ul> : "—";
}

function Main({ directory }: { directory: BillClaimsAdministratorDirectory }): ReactElement {
  return <div className="mbcad-grid">
    {([
      ["Name", directory.name ?? "—"], ["Description", directory.description ?? "—"], ["Type", directory.type ?? "—"],
      ["Website", directory.website ? outbound(directory.website, "url") : "—"],
      ["Also known as", list(directory.aliases)], ["Affiliated entities", list(directory.affiliatedEntities)],
      ["Hours of operation", directory.hours ?? "—"], ["Telephone numbers", list(directory.telephoneNumbers, "phone")],
      ["Email addresses", list(directory.emailAddresses, "email")], ["Web portals", list(directory.webPortals, "url")],
      ["Payers", directory.payers?.length ? <ul className="mbcad-list">{directory.payers.map((payer, index) => <li key={`${payer.name}-${index}`}><strong>{payer.name}</strong>{payer.route ? ` · ${payer.route}` : ""}{payer.hint ? <small>{payer.hint}</small> : null}</li>)}</ul> : "—"],
      ["Bill processing workflow", directory.billProcessingWorkflow ?? "—"],
      ["Bill processing workflow notes", directory.billProcessingWorkflowNotes ?? "—"],
      ["Claim number hint", directory.claimNumberHint ?? "—"],
    ] as Array<[string, ReactNode]>).map(([label, value]) => <div className="mbcad-row" key={label}><strong>{label}</strong><div>{value}</div></div>)}
  </div>;
}

function contacts(items: BillClaimsAdministratorContact[] | undefined, empty: string): ReactElement {
  if (!items?.length) return <div className="mbcad-empty">{empty}</div>;
  return <table className="mbcad-table"><thead><tr><th>Name</th><th>Telephone</th><th>Web portal</th><th>Email</th><th>Fax</th><th>Address / note</th></tr></thead><tbody>{items.map((item, index) => <tr key={`${item.name ?? "contact"}-${index}`}><td>{item.name ?? "—"}</td><td>{item.phone ? outbound(item.phone, "phone") : "—"}</td><td>{item.portalUrl ? outbound(item.portalUrl, "url") : "—"}</td><td>{item.email ? outbound(item.email, "email") : "—"}</td><td>{item.fax ?? "—"}</td><td>{[item.address, item.note].filter(Boolean).join(" · ") || "—"}</td></tr>)}</tbody></table>;
}

export function ClaimsAdministratorDirectoryDialog({ open, directory, loading = false, error, onClose }: ClaimsAdministratorDirectoryDialogProps): ReactElement | null {
  const [tab, setTab] = useState<Tab>("main");
  useEffect(() => { if (open) setTab("main"); }, [open, directory?.id]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close);
  }, [onClose, open]);
  if (!open) return null;
  const title = directory?.name ?? "Claims administrator directory";
  return <div className="mbcad-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><style>{css}</style><section className="mbcad-dialog" role="dialog" aria-modal="true" aria-labelledby="mbcad-title">
    <header className="mbcad-head"><h2 id="mbcad-title">{title}</h2><button className="mbcad-close" type="button" aria-label="Close claims administrator details" onClick={onClose}>×</button></header>
    <div className="mbcad-tabs" role="tablist">{([
      ["main", "Main"], ["bill-review", "Bill Review"], ["authorization", "Authorization Info"], ["mailing", "Mailing Address"], ["patterns", "Claim Number Pattern"],
    ] as Array<[Tab, string]>).map(([id, label]) => <button className="mbcad-tab" type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} key={id}>{label}</button>)}</div>
    <div className="mbcad-body" role="tabpanel">{loading ? <div className="mbcad-empty">Loading directory details…</div> : error ? <div className="mbcad-empty" role="alert">{error}</div> : !directory ? <div className="mbcad-empty">Directory details are unavailable.</div> : tab === "main" ? <Main directory={directory} /> : tab === "bill-review" ? contacts(directory.billReview, "No bill-review contacts are listed.") : tab === "authorization" ? <>{directory.authorizationNotice ? <p className="mbcad-notice">{directory.authorizationNotice}</p> : null}{contacts(directory.authorization, "No authorization contacts are listed.")}</> : tab === "mailing" ? directory.mailingAddresses?.length ? <table className="mbcad-table"><thead><tr><th>Company</th><th>Address</th><th>Notes</th><th>Bill treatment types</th><th>Submission type</th></tr></thead><tbody>{directory.mailingAddresses.map((item, index) => <tr key={`${item.address}-${index}`}><td>{item.company ?? "—"}</td><td>{item.address}</td><td>{item.notes ?? "—"}</td><td>{item.billTreatmentTypes?.join(", ") || "—"}</td><td>{item.submissionTypes?.join(", ") || "—"}</td></tr>)}</tbody></table> : <div className="mbcad-empty">No mailing addresses are listed.</div> : directory.claimNumberPatterns?.length ? <table className="mbcad-table"><thead><tr><th>Length</th><th>Pattern</th><th>Example</th></tr></thead><tbody>{directory.claimNumberPatterns.map((item, index) => <tr key={`${item.pattern}-${index}`}><td>{item.length ?? "—"}</td><td>{item.pattern}</td><td>{item.example ?? "—"}</td></tr>)}</tbody></table> : <div className="mbcad-empty">No claim-number patterns are listed.</div>}</div>
  </section></div>;
}
