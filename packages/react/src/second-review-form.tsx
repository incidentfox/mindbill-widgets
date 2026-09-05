"use client";

import { useMemo, useState, type ChangeEvent, type ReactElement } from "react";
import type {
  BillDeliveryOptions,
  BillLifecycleData,
  SecondReviewLineInput,
  SubmitSecondReviewInput,
} from "@mindbill/browser";
import {
  prepareBillSubmissionDocuments,
  type BillSubmissionUpload,
} from "./bill-submission-form";
import { SendRouteDialog, type SendRouteSubmission } from "./send-route-dialog";

export const SECOND_REVIEW_REASON_TEMPLATES = [
  {
    label: "Med-legal report denied",
    value: "The attached medical-legal report satisfies the applicable requirements for a compensable medical-legal evaluation. Please reprocess this service and issue payment under the Medical-Legal Fee Schedule.",
  },
  {
    label: "Supporting documentation was provided",
    value: "The EOR incorrectly states that supporting documentation was not received. The original electronic submission included the required documentation and was acknowledged as accepted. Please reprocess this service.",
  },
  {
    label: "Payment missing or not received",
    value: "The EOR reports payment, but the funds have not been received or deposited by the provider. Please issue or reissue payment and pay the remaining fee-schedule balance, including applicable penalty and interest.",
  },
  {
    label: "PPO or network reduction unsupported",
    value: "The EOR applies a PPO or network discount, but the provider has no agreement authorizing this reduction. Please demonstrate entitlement to the contracted rate or reprocess this service under the applicable fee schedule.",
  },
  {
    label: "Service was authorized",
    value: "The billed service was authorized. Please reprocess this service and issue payment; the supporting authorization is included with this request.",
  },
  {
    label: "Correct units or modifiers",
    value: "The units or modifiers on this service have been corrected on the accompanying modified bill. Please reprocess the service using the corrected billing information.",
  },
  {
    label: "Fee schedule incorrectly applied",
    value: "The applicable fee schedule was incorrectly applied to this service. Please recalculate the allowed amount under the governing fee schedule and issue the additional payment due.",
  },
  {
    label: "Treatment before liability decision",
    value: "This service was provided before the claims administrator accepted or denied liability and was authorized under California Labor Code section 5402(c). Please reprocess this service and issue payment.",
  },
] as const;

type AuthorizationAnswer = "" | "yes" | "no";
type LineDraft = { selected: boolean; reason: string; serviceAuthorized: AuthorizationAnswer };

export type SecondReviewFormProps = {
  data: BillLifecycleData;
  submitting?: boolean;
  error?: Error | null;
  fetch?: typeof globalThis.fetch;
  getDeliveryOptions: () => Promise<BillDeliveryOptions>;
  openAttachment: (attachment: { id: string }) => Promise<void>;
  onCancel: () => void;
  onSubmit: (input: SubmitSecondReviewInput) => Promise<void>;
};

const css = `
.mb-second-review{display:grid;gap:18px;padding:22px;color:var(--mb-text);font-family:var(--mb-font);background:var(--mb-surface);border:1px solid var(--mb-border);border-radius:var(--mb-radius);box-shadow:var(--mb-shadow)}
.mb-second-review *{box-sizing:border-box}.mb-second-review h3{margin:0;font-size:22px}.mb-second-review p{margin:4px 0 0;color:var(--mb-muted)}
.mb-second-review-deadline{padding:12px 14px;border-radius:var(--mb-control-radius);background:color-mix(in srgb,var(--mb-warning) 10%,var(--mb-surface));color:var(--mb-text)!important}
.mb-second-review-template,.mb-second-review-field{display:grid;gap:6px}.mb-second-review-label{font-size:13px;font-weight:720}.mb-second-review-select,.mb-second-review-textarea{width:100%;padding:10px 12px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-input);color:var(--mb-text);font:inherit}.mb-second-review-textarea{min-height:86px;resize:vertical}.mb-second-review-select:focus,.mb-second-review-textarea:focus{outline:3px solid color-mix(in srgb,var(--mb-accent) 20%,transparent);border-color:var(--mb-accent)}
.mb-second-review-lines{display:grid;gap:10px}.mb-second-review-line{display:grid;gap:12px;padding:14px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-surface)}.mb-second-review-line[data-selected=true]{border-color:color-mix(in srgb,var(--mb-accent) 65%,var(--mb-border));background:color-mix(in srgb,var(--mb-accent) 4%,var(--mb-surface))}.mb-second-review-line-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.mb-second-review-check{display:flex;align-items:center;gap:9px;font-weight:750}.mb-second-review-check input{width:18px;height:18px;accent-color:var(--mb-accent)}.mb-second-review-metrics{display:flex;gap:14px;color:var(--mb-muted);font-size:12px}.mb-second-review-auth{display:flex;align-items:center;flex-wrap:wrap;gap:8px;font-size:13px}.mb-second-review-auth strong{margin-right:4px}.mb-second-review-auth label{display:flex;align-items:center;gap:5px}.mb-second-review-auth input{accent-color:var(--mb-accent)}
.mb-second-review-packet{display:grid;gap:10px;padding:0;border:0}.mb-second-review-packet legend{margin-bottom:8px;font-weight:750}.mb-second-review-document{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--mb-border)}.mb-second-review-document input{width:18px;height:18px;accent-color:var(--mb-accent)}.mb-second-review-document span{display:grid;min-width:0;flex:1}.mb-second-review-document small{color:var(--mb-muted)}.mb-second-review-link{border:0;background:transparent;color:var(--mb-accent);font:inherit;font-weight:700;cursor:pointer}
.mb-second-review-upload{display:grid;place-items:center;min-height:82px;padding:16px;border:1px dashed color-mix(in srgb,var(--mb-accent) 55%,var(--mb-border));border-radius:var(--mb-control-radius);background:color-mix(in srgb,var(--mb-accent) 3%,var(--mb-surface));cursor:pointer}.mb-second-review-upload input{position:absolute;width:1px;height:1px;opacity:0}.mb-second-review-upload strong{color:var(--mb-accent)}
.mb-second-review-uploaded{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 11px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius)}
.mb-second-review-error{padding:10px 12px;border-radius:var(--mb-control-radius);background:color-mix(in srgb,var(--mb-danger) 10%,transparent);color:var(--mb-danger);font-size:13px}.mb-second-review-actions{display:flex;justify-content:flex-end;gap:10px}.mb-second-review-button{min-height:42px;padding:9px 16px;border-radius:var(--mb-control-radius);font:inherit;font-weight:740;cursor:pointer}.mb-second-review-button.secondary{border:1px solid var(--mb-border);background:var(--mb-surface);color:var(--mb-text)}.mb-second-review-button.primary{border:0;background:var(--mb-accent);color:var(--mb-accent-contrast)}.mb-second-review-button:disabled{opacity:.55;cursor:not-allowed}
@media(max-width:680px){.mb-second-review{padding:16px}.mb-second-review-line-head{align-items:flex-start;flex-direction:column}.mb-second-review-metrics{flex-wrap:wrap}}
`;

function money(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function initialLineDrafts(data: BillLifecycleData): Record<string, LineDraft> {
  return Object.fromEntries(data.bill.lineItems.flatMap((line) => line.id ? [[line.id, {
    selected: true,
    reason: "",
    serviceAuthorized: "" as AuthorizationAnswer,
  }]] : []));
}

export function SecondReviewForm({
  data,
  submitting = false,
  error,
  fetch: fetchOverride,
  getDeliveryOptions,
  openAttachment,
  onCancel,
  onSubmit,
}: SecondReviewFormProps): ReactElement {
  const [lines, setLines] = useState<Record<string, LineDraft>>(() => initialLineDrafts(data));
  const [attachmentIds, setAttachmentIds] = useState(() => data.bill.attachments.map((attachment) => attachment.id));
  const [uploads, setUploads] = useState<BillSubmissionUpload[]>([]);
  const [formError, setFormError] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [delivery, setDelivery] = useState<BillDeliveryOptions | null>(null);

  const selectableLines = useMemo(() => data.bill.lineItems.filter((line): line is typeof line & { id: string } => Boolean(line.id)), [data.bill.lineItems]);
  const selected = selectableLines.filter((line) => lines[line.id]?.selected);
  const invalidReason = selected.some((line) => !lines[line.id]?.reason.trim());
  const disputedAmount = selected.reduce((sum, line) => sum + Math.max(0, line.charge), 0);

  const patchLine = (id: string, patch: Partial<LineDraft>) => setLines((current) => {
    const line = current[id];
    if (!line) return current;
    return { ...current, [id]: { ...line, ...patch } };
  });

  const applyTemplate = (value: string) => {
    if (!value) return;
    setLines((current) => Object.fromEntries(Object.entries(current).map(([id, line]) => [
      id,
      line.selected ? { ...line, reason: value } : line,
    ])));
  };

  const addUploads = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    const invalid = files.find((file) => file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"));
    if (invalid) { setFormError(`${invalid.name} is not a PDF.`); return; }
    const oversized = files.find((file) => file.size > 25 * 1024 * 1024);
    if (oversized) { setFormError(`${oversized.name} is larger than 25 MB.`); return; }
    setFormError("");
    setUploads((current) => [...current, ...files.map((file) => ({ file, documentType: "appeal" as const }))]);
  };

  const continueToDelivery = async () => {
    if (!selected.length) { setFormError("Select at least one service line."); return; }
    if (invalidReason) { setFormError("Enter a dispute reason for every selected service line."); return; }
    setPreparing(true);
    setFormError("");
    try {
      setDelivery(await getDeliveryOptions());
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Delivery methods could not be loaded.");
    } finally {
      setPreparing(false);
    }
  };

  const submit = async (route: SendRouteSubmission) => {
    setPreparing(true);
    setFormError("");
    try {
      const documents = await prepareBillSubmissionDocuments({
        attachments: [],
        selectedIds: [],
        uploads,
        ...(fetchOverride ? { fetch: fetchOverride } : {}),
      });
      const lineItems: SecondReviewLineInput[] = selected.map((line) => {
        const draft = lines[line.id]!;
        return {
          lineItemId: line.id,
          reason: draft.reason.trim(),
          ...(draft.serviceAuthorized === "" ? {} : { serviceAuthorized: draft.serviceAuthorized === "yes" }),
        };
      });
      await onSubmit({
        attachmentIds,
        documents,
        disputedAmount,
        lineItems,
        ...(lineItems[0] ? { reason: lineItems[0].reason } : {}),
        ...route,
      });
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "The Second Review could not be submitted.");
    } finally {
      setPreparing(false);
    }
  };

  return <>
    <style>{css}</style>
    <section className="mb-second-review">
      <div><h3>Submit Second Review</h3><p>Select each disputed service and explain why it should be reconsidered.</p></div>
      <label className="mb-second-review-template"><span className="mb-second-review-label">Apply a saved reason to selected lines</span><select className="mb-second-review-select" defaultValue="" onChange={(event) => { applyTemplate(event.target.value); event.target.value = ""; }}><option value="">Choose a reason template (optional)</option>{SECOND_REVIEW_REASON_TEMPLATES.map((template) => <option key={template.label} value={template.value}>{template.label}</option>)}</select></label>
      <section className="mb-second-review-lines" aria-label="Service lines in dispute">
        {selectableLines.map((line) => {
          const draft = lines[line.id];
          return <article className="mb-second-review-line" data-selected={draft?.selected} key={line.id}>
            <div className="mb-second-review-line-head"><label className="mb-second-review-check"><input type="checkbox" checked={Boolean(draft?.selected)} onChange={(event) => patchLine(line.id, { selected: event.target.checked })} /><span>{line.code}{line.modifiers.length ? `-${line.modifiers.join("-")}` : ""}</span></label><span className="mb-second-review-metrics"><span>{line.units} unit{line.units === 1 ? "" : "s"}</span><span>{money(line.charge)}</span></span></div>
            {draft?.selected ? <><label className="mb-second-review-field"><span className="mb-second-review-label">Reason for requesting Second Review</span><textarea className="mb-second-review-textarea" required value={draft.reason} onChange={(event) => patchLine(line.id, { reason: event.target.value })} /></label><div className="mb-second-review-auth" role="radiogroup" aria-label={`Service or good ${line.code} authorized`}><strong>Service/Good Authorized?</strong>{([['yes','Yes'],['no','No'],['','Not specified']] as const).map(([value, label]) => <label key={label}><input type="radio" name={`authorized-${line.id}`} checked={draft.serviceAuthorized === value} onChange={() => patchLine(line.id, { serviceAuthorized: value })} />{label}</label>)}</div></> : null}
          </article>;
        })}
        {!selectableLines.length ? <div className="mb-second-review-error">This bill has no stable service-line identifiers. Refresh the bill before submitting a Second Review.</div> : null}
      </section>
      <fieldset className="mb-second-review-packet"><legend>Supporting packet</legend>{data.bill.attachments.map((attachment) => <label className="mb-second-review-document" key={attachment.id}><input type="checkbox" checked={attachmentIds.includes(attachment.id)} onChange={(event) => setAttachmentIds((current) => event.target.checked ? [...current, attachment.id] : current.filter((id) => id !== attachment.id))} /><span><strong>{attachment.filename}</strong><small>{attachment.description || attachment.documentType}</small></span><button className="mb-second-review-link" type="button" onClick={() => void openAttachment(attachment).catch(() => undefined)}>View</button></label>)}<label className="mb-second-review-upload"><input type="file" accept="application/pdf,.pdf" multiple onChange={addUploads} /><span><strong>Choose one or more PDF files</strong> to attach</span></label>{uploads.map((upload, index) => <div className="mb-second-review-uploaded" key={`${upload.file.name}-${index}`}><span>{upload.file.name}</span><button className="mb-second-review-link" type="button" onClick={() => setUploads((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>)}</fieldset>
      {(formError || error?.message) ? <div className="mb-second-review-error" role="alert">{formError || error?.message}</div> : null}
      <div className="mb-second-review-actions"><button className="mb-second-review-button secondary" type="button" disabled={submitting || preparing} onClick={onCancel}>Cancel</button><button className="mb-second-review-button primary" type="button" disabled={submitting || preparing || !selected.length || invalidReason} onClick={() => void continueToDelivery()}>{preparing ? "Preparing…" : "Continue to delivery"}</button></div>
    </section>
    {delivery ? <SendRouteDialog title="Confirm Second Review delivery" delivery={delivery} submitting={submitting || preparing} error={formError || error?.message || null} onCancel={() => setDelivery(null)} onConfirm={(route) => void submit(route)} /> : null}
  </>;
}
