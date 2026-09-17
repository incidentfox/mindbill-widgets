import type { CaMedicalDirection } from "@mindbill/browser";

/** In-progress clinical records remain separate from a validated quote request. */
export type DirectionDraft = Record<string, unknown>;
type Field = { title: string; kind: "reference" } | { title: string; kind: "minute" } |
  { title: string; kind: "select"; options: ReadonlyArray<readonly [string, string]> } |
  { title: string; kind: "record"; fields: Record<string, Field> } |
  { title: string; kind: "list"; item: Field; min: number; max: number } |
  { title: string; kind: "participation" };
const reference = (title: string): Field => ({ title, kind: "reference" });
const minute = (title: string): Field => ({ title, kind: "minute" });
const record = (title: string, fields: Record<string, Field>): Field => ({ title, kind: "record", fields });
const list = (title: string, item: Field, min = 0, max = 100): Field => ({ title, kind: "list", item, min, max });
const select = (title: string, options: ReadonlyArray<readonly [string, string]>): Field => ({ title, kind: "select", options });
const interval = record("Service interval", { startMinute: minute("Start"), endMinute: minute("End") });
const occurrence = record("Activity", { physicianRef: reference("Physician reference"), recordRef: reference("Record reference"), minute: minute("Activity time") });
const presence = record("Participation", { physicianRef: reference("Physician reference"), recordRef: reference("Record reference"), startMinute: minute("Start"), endMinute: minute("End") });
const caseFields = record("Case", {
  caseRef: reference("Case reference"),
  anesthetistRole: select("Anesthetist role", [["crna", "CRNA"], ["anesthesiologist_assistant", "Anesthesiologist assistant"], ["intern", "Intern"], ["resident", "Resident"], ["student_nurse_anesthetist", "Student nurse anesthetist"]]),
  qualificationRecordRef: reference("Anesthetist qualification record"),
  procedure: select("Procedure category", [["other", "Other procedure"], ["cataract", "Cataract"], ["iridectomy", "Iridectomy"]]),
  interval,
  activities: record("Medical direction activities", {
    preAnestheticEvaluation: { ...occurrence, title: "Pre-anesthetic examination and evaluation" },
    prescribedPlan: { ...occurrence, title: "Prescribed anesthesia plan" },
    demandingProcedures: list("Personal participation in demanding procedures", presence, 1),
    induction: { kind: "participation", title: "Induction" },
    emergence: { kind: "participation", title: "Emergence" },
    qualifiedAnesthetistProcedures: { ...occurrence, title: "Ensured procedures were performed by a qualified anesthetist" },
    frequentMonitoring: record("Frequent monitoring", { recordRef: reference("Monitoring record"), observations: list("Monitoring observations", occurrence, 1, 1440) }),
    indicatedPostAnesthesiaCare: { ...occurrence, title: "Indicated post-anesthesia care" },
  }),
});
const schema = record("Medical direction record", {
  physicianRef: reference("Directing physician reference"),
  groupPhysicianRefs: list("Other physicians in the same group", reference("Physician reference")),
  billedCaseRef: reference("Case reference for this bill"),
  rosterRecordRef: reference("Complete roster record reference"),
  cases: list("All overlapping cases across all payers", caseFields, 1),
  physicalPresenceAndImmediateAvailability: list("Physical presence and immediate availability", presence, 1),
  otherPatientServices: list("Other patient services performed by the physician", record("Other patient service", {
    kind: select("Activity", [["emergency", "Emergency"], ["labor_analgesia", "Labor analgesia"], ["obstetric_monitoring", "Obstetric monitoring"], ["receiving_patient", "Receiving a patient"], ["recovery_care", "Recovery care"], ["other", "Other"]]), interval, recordRef: reference("Record reference"),
  })),
});
const asRecord = (value: unknown): DirectionDraft => value && typeof value === "object" && !Array.isArray(value) ? value as DirectionDraft : {};
const asList = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
function decode(field: Field, value: unknown): unknown {
  if (field.kind === "reference") return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 128 ? value.trim() : undefined;
  if (field.kind === "minute") return (typeof value === "number" || typeof value === "string" && /^\d+$/.test(value)) && Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 2880 ? Number(value) : undefined;
  if (field.kind === "select") return field.options.some(([key]) => key === value) ? value : undefined;
  if (field.kind === "participation") {
    const item = asRecord(value);
    return item.applicability === "not_indicated" ? decode(record(field.title, { applicability: select("Applicability", [["not_indicated", "Not indicated"]]), recordRef: reference("Record reference") }), item) : decode(presence, item);
  }
  if (field.kind === "list") {
    const items = asList(value);
    if (items.length < field.min || items.length > field.max) return undefined;
    const result = items.map(item => decode(field.item, item));
    return result.some(item => item === undefined) ? undefined : result;
  }
  const item = asRecord(value); const result: DirectionDraft = {};
  for (const [key, child] of Object.entries(field.fields)) {
    const decoded = decode(child, item[key]); if (decoded === undefined) return undefined; result[key] = decoded;
  }
  if (typeof result.startMinute === "number" && typeof result.endMinute === "number" && result.endMinute <= result.startMinute) return undefined;
  return result;
}
export function directionFromDraft(value: DirectionDraft | undefined): CaMedicalDirection | undefined {
  const decoded = decode(schema, value);
  if (!decoded) return undefined;
  const result = { ...asRecord(decoded), rosterScope: "all_overlapping_cases_all_payers" } as CaMedicalDirection;
  if (new Set(result.cases.map(item => item.caseRef)).size !== result.cases.length || !result.cases.some(item => item.caseRef === result.billedCaseRef)) return undefined;
  return result;
}

function FieldInput({ field, value, onChange, path }: { field: Field; value: unknown; onChange: (value: unknown) => void; path: string }) {
  if (field.kind === "reference") return <label className="mbsf-field"><span>{field.title}</span><input className="mbsf-input" aria-label={path} maxLength={128} value={typeof value === "string" ? value : ""} onChange={event => onChange(event.target.value)} /></label>;
  if (field.kind === "minute") {
    const valid = value !== "" && value !== undefined && Number.isInteger(Number(value)); const n = valid ? Number(value) : 0;
    const day = Math.floor(n / 1440); const time = valid ? `${String(Math.floor(n % 1440 / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}` : "";
    return <label className="mbsf-field"><span>{field.title}</span><input className="mbsf-input" aria-label={path} type="time" value={time} onChange={event => { const [h, m] = event.target.value.split(":").map(Number); onChange(event.target.value ? day * 1440 + h! * 60 + m! : ""); }} /><select className="mbsf-input" aria-label={`${path} day`} value={day} onChange={event => onChange(valid ? Number(event.target.value) * 1440 + n % 1440 : "")}><option value={0}>Service date</option><option value={1}>Following day</option><option value={2}>Two days later</option></select></label>;
  }
  if (field.kind === "select") return <label className="mbsf-field"><span>{field.title}</span><select className="mbsf-input" aria-label={path} value={typeof value === "string" ? value : ""} onChange={event => onChange(event.target.value)}><option value="">Select from the record…</option>{field.options.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>;
  if (field.kind === "participation") {
    const item = asRecord(value); const choice = item.applicability === "not_indicated" ? "not_indicated" : item.applicability === "participated" || "physicianRef" in item ? "participated" : "";
    return <fieldset className="mbsf-span"><legend>{field.title}</legend><label className="mbsf-field"><span>Documented participation</span><select className="mbsf-input" aria-label={`${path} applicability`} value={choice} onChange={event => onChange({ applicability: event.target.value })}><option value="">Select from the record…</option><option value="participated">Physician participated</option><option value="not_indicated">Not indicated</option></select></label>{choice === "not_indicated" ? <FieldInput field={reference("Supporting record reference")} value={item.recordRef} path={`${path} supporting record`} onChange={recordRef => onChange({ ...item, recordRef })} /> : choice === "participated" ? <FieldInput field={presence} value={item} path={path} onChange={onChange} /> : null}</fieldset>;
  }
  if (field.kind === "list") {
    const items = asList(value);
    return <fieldset className="mbsf-span"><legend>{field.title}</legend>{items.map((item, index) => <div key={index}><FieldInput field={{ ...field.item, title: `${field.item.title} ${index + 1}` }} value={item} path={`${path} ${index + 1}`} onChange={next => onChange(items.map((old, i) => i === index ? next : old))} /><button type="button" className="mbsf-secondary" aria-label={`Remove ${path} ${index + 1}`} onClick={() => onChange(items.filter((_, i) => i !== index))}>Remove</button></div>)}{items.length < field.max && <button type="button" className="mbsf-secondary" onClick={() => onChange([...items, field.item.kind === "reference" ? "" : {}])}>Add {field.item.title.toLowerCase()}</button>}</fieldset>;
  }
  const item = asRecord(value);
  return <fieldset className="mbsf-span"><legend>{field.title}</legend><div className="mbsf-grid">{Object.entries(field.fields).map(([key, child]) => <FieldInput key={key} field={child} value={item[key]} path={`${path} / ${child.title}`} onChange={next => onChange({ ...item, [key]: next })} />)}</div></fieldset>;
}
export function AnesthesiaDirectionFields({ value, onChange, lineNumber }: { value: DirectionDraft | undefined; onChange: (value: DirectionDraft) => void; lineNumber: number }) {
  return <div className="mbsf-span"><p className="mbsf-help">Enter the complete overlapping case roster across all payers, including cases outside this bill. Use opaque case, physician and record references. Times are local to the service location. Enter each recorded activity and interval; the fee check evaluates concurrency and timing. Teaching, overnight, cataract and other-service exceptions may need review.</p><FieldInput field={schema} value={value} onChange={next => onChange(asRecord(next))} path={`Line ${lineNumber} medical direction`} />{!directionFromDraft(value) && <p className="mbsf-help">Complete the case roster, activity records and availability intervals to calculate medical direction.</p>}</div>;
}
