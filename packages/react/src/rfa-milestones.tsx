import type { ReactElement, ReactNode } from "react";
import type { RfaRecord } from "@mindbill/browser";
import { rfaDecisionDueText } from "./rfa-decision-due";
import { formatRfaPhone } from "./rfa-official-fields";

export const rfaMilestonesCss = `.mbrfa-milestones{list-style:none;margin:0;padding:4px 0 0}.mbrfa-milestones>li{position:relative;display:grid;grid-template-columns:132px minmax(0,1fr);gap:4px 16px;padding:0 0 18px 26px}
.mbrfa-milestones>li::before{content:"";position:absolute;left:5px;top:5px;width:11px;height:11px;border-radius:50%;border:2px solid var(--mb-border);background:var(--mb-surface)}
.mbrfa-milestones>li::after{content:"";position:absolute;left:10px;top:20px;bottom:0;width:1px;background:var(--mb-border)}.mbrfa-milestones>li:last-child{padding-bottom:0}.mbrfa-milestones>li:last-child::after{display:none}
.mbrfa-milestones>li[data-state=done]::before{border-color:var(--mb-accent);background:var(--mb-accent)}.mbrfa-milestones>li[data-state=late]::before{border-color:var(--mb-danger,#b42318);background:var(--mb-danger,#b42318)}
.mbrfa-milestones time,.mbrfa-milestones .mbrfa-ms-when{font-size:12px;color:var(--mb-muted);padding-top:2px}.mbrfa-milestones strong{display:block;font-size:14px;font-weight:600}.mbrfa-milestones small{display:block;margin-top:2px;font-size:12px;color:var(--mb-muted)}
.mbrfa-milestones>li[data-state=todo] strong{font-weight:500;color:var(--mb-muted)}
@media(max-width:600px){.mbrfa-milestones>li{grid-template-columns:minmax(0,1fr)}.mbrfa-milestones time,.mbrfa-milestones .mbrfa-ms-when{order:2}}`;

const when = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";
const sentence = (value: string) => value.replaceAll("_", " ").replace(/^./, letter => letter.toUpperCase());
const OUTCOMES: Record<string, string> = { approved: "Approved", authorized: "Approved", modified: "Modified", denied: "Denied", delayed: "Delayed", deferred: "Deferred" };

/** The request's key dates in order: created, sent, received, decision due, decision. */
export function RfaMilestones({ rfa }: { rfa: RfaRecord }): ReactElement {
  const sent = rfa.transmissions.filter(item => item.direction === "outbound" && item.purpose !== "forward").sort((a, b) => (a.occurredAt ?? "").localeCompare(b.occurredAt ?? ""));
  const delivery = sent[sent.length - 1];
  const forwards = rfa.transmissions.filter(item => item.direction === "outbound" && item.purpose === "forward");
  const decided = rfa.items.filter(item => item.outcome !== "pending");
  const lastDecision = decided.map(item => item.decidedAt ?? "").sort().pop();
  const overdue = !!rfa.decisionDueAt && decided.length < rfa.items.length && Date.parse(rfa.decisionDueAt) < Date.now();
  const to = (destination: string | null) => destination ? (/@/.test(destination) ? destination : formatRfaPhone(destination)) : "";
  const steps: Array<{ state: "done" | "todo" | "late"; at: string; title: string; detail?: ReactNode }> = [
    { state: "done", at: when(rfa.createdAt), title: "Request created", detail: `${rfa.providerName} · ${rfa.items.length} requested treatment${rfa.items.length === 1 ? "" : "s"}` },
    { state: rfa.submittedAt ? "done" : "todo", at: when(rfa.submittedAt), title: rfa.submittedAt ? `Sent${delivery ? ` by ${delivery.channel}` : ""}` : "Not sent yet",
      detail: rfa.submittedAt ? [delivery?.destination ? `To ${to(delivery.destination)}` : "", rfa.claimsAdminName ?? "", delivery ? sentence(delivery.status) : ""].filter(Boolean).join(" · ") : "Signing happens when the request is sent." },
    ...forwards.map(item => ({ state: "done" as const, at: when(item.occurredAt), title: `Forwarded by ${item.channel}`, detail: [item.destination ? `To ${to(item.destination)}` : "", sentence(item.status)].filter(Boolean).join(" · ") })),
    { state: rfa.receivedAt ? "done" : "todo", at: when(rfa.receivedAt), title: rfa.receivedAt ? "Received by the claims administrator" : "Receipt not confirmed yet", detail: rfa.receivedAt ? "The decision clock runs from this receipt." : undefined },
    ...(rfa.submittedAt ? [{ state: decided.length === rfa.items.length ? "done" as const : overdue ? "late" as const : "todo" as const, at: rfaDecisionDueText(rfa), title: overdue ? "Decision is overdue" : "Decision due", detail: rfa.decisionDeadlineBasis ? sentence(rfa.decisionDeadlineBasis) : undefined }] : []),
    { state: decided.length ? "done" : "todo", at: when(lastDecision), title: decided.length ? decided.length === rfa.items.length ? "Decision received" : `Decision received for ${decided.length} of ${rfa.items.length} treatments` : "No decision yet",
      detail: decided.length ? decided.map(item => `${item.serviceDescription.slice(0, 60)}: ${OUTCOMES[item.outcome] ?? sentence(item.outcome)}${item.authorizationNumber ? ` (#${item.authorizationNumber})` : ""}`).join(" · ") : undefined },
  ];
  return <ol className="mbrfa-milestones" aria-label="Request timeline">{steps.map((step, index) => <li key={index} data-state={step.state}>
    <span className="mbrfa-ms-when">{step.at || (step.state === "todo" ? "Pending" : "")}</span><div><strong>{step.title}</strong>{step.detail ? <small>{step.detail}</small> : null}</div>
  </li>)}</ol>;
}
