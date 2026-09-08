"use client";
import { Billing } from "../Billing";
import { CaseRecords } from "./CaseRecords";

export function CaseWorkspace({ tab, setTab }: {
  tab: "records" | "bill"; setTab(tab: "records" | "bill"): void;
}) {
  return <>
    <div className="page-heading"><div>
      <p className="eyebrow">CASE 001 <span>•</span> MED-LEGAL REVIEW</p>
      <h1>Alex Morgan <span className="fictional-badge">Fictional patient</span></h1>
      <p className="page-description">Left shoulder · Records review for an example evaluation</p>
    </div><button className="primary-button" onClick={() => setTab("bill")}>Open billing →</button></div>
    <dl className="case-facts">
      <div><dt>Claim number</dt><dd>TEST-2026-001</dd></div>
      <div><dt>Date of injury</dt><dd>Jun 1, 2026</dd></div>
      <div><dt>Evaluation date</dt><dd>Aug 1, 2026</dd></div>
      <div><dt>Reviewer</dt><dd>Dr. Jamie Example</dd></div>
    </dl>
    <div className="case-tabs" role="tablist" aria-label="Case sections">
      <button role="tab" id="records-tab" aria-controls="case-panel" aria-selected={tab === "records"} onClick={() => setTab("records")}>Records & summary <span>3</span></button>
      <button role="tab" id="bill-tab" aria-controls="case-panel" aria-selected={tab === "bill"} onClick={() => setTab("bill")}>Bill</button>
    </div>
    <section id="case-panel" role="tabpanel" aria-labelledby={tab === "records" ? "records-tab" : "bill-tab"}>
      {tab === "records" ? <CaseRecords /> : <Billing />}
    </section>
  </>;
}
