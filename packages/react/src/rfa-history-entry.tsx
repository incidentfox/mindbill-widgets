import type { ReactElement } from "react";
import type { RfaHistoryEvent, RfaRecord } from "@mindbill/browser";

type Fields = Record<string, unknown>;
type Evidence = { id: string; label: string; kind: "document" | "packet" };
const object = (value: unknown): Fields => value && typeof value === "object" && !Array.isArray(value) ? value as Fields : {};
const string = (value: unknown): string | undefined => typeof value === "string" && value.trim() ? value : undefined;
const words = (value: string) => value.replace(/^rfa\./, "").replaceAll("_", " ");
const actions: Record<string, string> = { created: "RFA created", note_added: "Note added", transmission_recorded: "Transmission recorded", followup_opened: "Follow-up opened", signed: "RFA signed", submitted: "RFA submitted", treatment_closed: "Treatment closed — decision no longer required", treatment_reopened: "Treatment follow-up reopened" };
const date = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : "Not recorded";
const fields = {
  status: "Status", from: "Previous status", to: "New status", channel: "Delivery method", direction: "Direction",
  purpose: "Purpose", destination: "Recipient", recipientName: "Attention", providerMessageId: "Delivery reference",
  receivedAt: "Confirmed receipt", occurredAt: "Transmission time", requestedAt: "Information requested",
  dueAt: "Response due", respondedAt: "Response recorded", decidedAt: "Decision date", disposition: "Appointment status",
  appointmentAt: "Appointment time", providerName: "Provider", location: "Location", filename: "Filename",
  documentType: "Document type", source: "Source", itemCount: "Treatments", contentRevision: "Content revision",
  outcome: "Decision", authorizationNumber: "Authorization number", authorizedProcedureCode: "Authorized procedure",
  authorizedQuantity: "Authorized quantity", authorizedUnits: "Authorized units", effectiveFrom: "Effective from",
  effectiveTo: "Effective through", decisionReason: "Decision reason", reviewerName: "Reviewer", reviewerPhone: "Reviewer phone",
  message: "Cover sheet or email message", reason: "Reason",
} as const;
const dates = new Set(["receivedAt", "occurredAt", "requestedAt", "dueAt", "respondedAt", "decidedAt", "appointmentAt"]);
const enums = new Set(["status", "from", "to", "channel", "direction", "purpose", "disposition", "documentType", "outcome"]);
const changedFieldNames: Record<string, string> = {
  status: "Status", items: "Requested treatments", patientId: "Patient", claimId: "Injury or claim",
  renderingProviderId: "Requesting physician", claimsAdminId: "Claims administrator", expedited: "Expedited review",
  reviewType: "Review type", writtenConfirmation: "Written confirmation", clinicalRationale: "Clinical rationale",
  materialFacts: "Changed material facts", requestKind: "Request kind", requestedTreatmentSummary: "Treatment summary",
  practiceLocation: "Practice location", employee: "Employee information", claimsAdministrator: "Claims administrator",
};

function rows(value: Fields, omit: readonly string[] = []): Array<[string, string]> {
  return Object.entries(fields).flatMap(([key, label]) => {
    if (omit.includes(key)) return [];
    const raw = value[key];
    if (typeof raw !== "string" && typeof raw !== "number") return [];
    if (raw === "" || (typeof raw === "number" && !Number.isFinite(raw))) return [];
    return [[label, dates.has(key) ? date(String(raw)) : enums.has(key) ? words(String(raw)) : String(raw)]];
  });
}
function DefinitionList({ entries }: { entries: Array<[string, string]> }): ReactElement {
  return <dl>{entries.map(([label, value]) => <div key={label}><dt>{label}</dt><dd style={{ whiteSpace: "pre-wrap" }}>{value}</dd></div>)}</dl>;
}

/** Only display known clinical/workflow fields. Audit payloads may also contain private transport and concurrency metadata. */
export function RfaHistoryEntry({ event, rfa, disabled, onDownload }: {
  event: RfaHistoryEvent; rfa: RfaRecord; disabled: boolean;
  onDownload: (kind: "document" | "packet", id: string, filename: string) => void;
}): ReactElement {
  const payload = event.payload;
  const transmission = rfa.transmissions.find(value => value.id === payload.transmissionId);
  // Destination and receipt-document identity belong to this exact transmission. Do not copy its latest status into an older event.
  const entries = rows({ ...payload,
    destination: payload.destination ?? transmission?.destination,
    providerMessageId: payload.providerMessageId ?? transmission?.providerMessageId,
  }, ["reason"]);
  const appointment = payload.action === "scheduling_updated" ? rows(object(payload.details)) : [];
  const replacement = object(payload.replacement);
  const decisionGroups = Object.keys(replacement).length ? [["Original decision", object(payload.before)], ["Corrected decision", replacement]] as const : [["Treatment decisions", payload]] as const;
  const decisionSections = decisionGroups.map(([title, value]) => ({ title, value,
    decisions: Array.isArray(value.decisions) ? value.decisions.map(object) : [],
  })).filter(group => group.decisions.length > 0);
  const ids = new Set<string>();
  for (const value of [payload.itemId, ...(Array.isArray(payload.itemIds) ? payload.itemIds : []), ...decisionSections.flatMap(group => group.decisions.map(value => value.itemId))]) {
    if (string(value)) ids.add(String(value));
  }
  const treatment = (id: string) => {
    const index = rfa.items.findIndex(value => value.id === id);
    return index >= 0 ? <a href={`#rfa-treatment-${id}`}>Treatment {index + 1}: {rfa.items[index]!.serviceDescription}</a> : <span>Treatment reference: {id}</span>;
  };
  const evidence: Evidence[] = [];
  const add = (id: unknown, label: string, kind: Evidence["kind"] = "document") => {
    if (string(id) && !evidence.some(value => value.id === id && value.kind === kind)) evidence.push({ id: String(id), label, kind });
  };
  const documents = (value: Fields, prefix = "") => {
    add(value.documentId, `${prefix}Download document`);
    add(value.proofDocumentId, `${prefix}Download transmission receipt`);
    add(value.responseDocumentId, `${prefix}Download decision evidence`);
    add(value.imrDocumentId, `${prefix}Download independent medical review form`);
    for (const key of ["documentIds", "responseDocumentIds"]) if (Array.isArray(value[key])) for (const id of value[key]) add(id, `${prefix}Download supporting document`);
  };
  documents(payload);
  add(transmission?.proofDocumentId, "Download transmission receipt");
  if (Object.keys(replacement).length) { documents(object(payload.before), "Original: "); documents(replacement, "Corrected: "); }
  add(payload.packetId, "Download retained submission PDF", "packet");
  const changed = Array.isArray(payload.changedFields) ? payload.changedFields.flatMap(value => typeof value === "string" && Object.hasOwn(changedFieldNames, value) ? [changedFieldNames[value]!] : []) : [];
  const hasDetails = entries.length || appointment.length || decisionSections.length || evidence.length || changed.length;
  const actor = /^(system:|system$)/.test(event.actor) ? "System" : /^(native-user:|user:)/.test(event.actor) ? "Team member" : /^(developer:|integration:|api:)/.test(event.actor) ? "Integration" : event.actor;
  const action = string(payload.action) ?? event.eventType.replace(/^rfa\./, "");
  return <tr>
    <td><time dateTime={event.occurredAt ?? undefined}>{date(event.occurredAt)}</time></td>
    <td className="mbrfa-history-action">{actions[action] ?? words(action)}</td>
    <td><span className="mbrfa-sr-only">Recorded by </span>{actor}</td>
    <td>
    {["text", "reason", "requestText", "note"].map(key => string(payload[key]) ? <p key={key} style={{ whiteSpace: "pre-wrap" }}>{String(payload[key])}</p> : null)}
    {ids.size ? <ul aria-label="Related treatments">{[...ids].map(id => <li key={id}>{treatment(id)}</li>)}</ul> : null}
    {hasDetails ? <details><summary>Event details</summary>
      {entries.length ? <DefinitionList entries={entries} /> : null}
      {changed.length ? <p>Changed fields: {changed.join(", ")}</p> : null}
      {appointment.length ? <section><h4>Appointment details</h4><DefinitionList entries={appointment} /></section> : null}
      {decisionSections.map(group => <section key={group.title}><h4>{group.title}</h4>
        {group.value !== payload ? <DefinitionList entries={rows(group.value, ["reason"])} /> : null}
        {group.decisions.map((value, index) => <div key={index}>{string(value.itemId) ? treatment(String(value.itemId)) : null}<DefinitionList entries={rows(value)} /></div>)}
      </section>)}
      {evidence.length ? <ul aria-label="Event documents">{evidence.map(value => {
        const filename = rfa.documents.find(document => document.id === value.id)?.filename;
        return <li key={`${value.kind}:${value.id}`}><button type="button" disabled={disabled} onClick={() => onDownload(value.kind, value.id, filename ?? (value.kind === "packet" ? "RFA submission.pdf" : "RFA evidence.pdf"))}>{value.label}{filename ? `: ${filename}` : ""}</button></li>;
      })}</ul> : null}
    </details> : !["text", "reason", "requestText", "note"].some(key => string(payload[key])) && !ids.size ? <span>—</span> : null}
    </td>
  </tr>;
}
