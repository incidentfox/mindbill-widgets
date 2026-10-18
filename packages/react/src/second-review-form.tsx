"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactElement } from "react";
import type {
  BillDeliveryOptions,
  BillLifecycleData,
  SecondReviewIbrDecision,
  SecondReviewLineInput,
  SecondReviewLineSuggestion,
  SecondReviewSuggestions,
  SubmitSecondReviewInput,
} from "@mindbill/browser";
import { appendSecondReviewIbrCitations, removeSecondReviewIbrCitation } from "@mindbill/browser";
import {
  prepareBillSubmissionDocuments,
  type BillSubmissionUpload,
} from "./bill-submission-form";
import { SendRouteDialog, type SendRouteSubmission } from "./send-route-dialog";
import { parseSecondReviewCorrection, type CorrectionDraft } from "./second-review-corrections";
import { Select, Checkbox, FileInput, Radio } from "./form-controls";

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
type LineDraft = CorrectionDraft & { selected: boolean; reason: string; serviceAuthorized: AuthorizationAnswer };

export type SecondReviewFormProps = {
  data: BillLifecycleData;
  submitting?: boolean;
  error?: Error | null;
  fetch?: typeof globalThis.fetch;
  getDeliveryOptions: () => Promise<BillDeliveryOptions>;
  openAttachment: (attachment: { id: string }) => Promise<void>;
  onCancel: () => void;
  onSubmit: (input: SubmitSecondReviewInput) => Promise<void>;
  /** Rule-based starting reasons and related IBR decisions. When omitted, reasons start blank. */
  getSuggestions?: (lineItemIds: string[], signal?: AbortSignal) => Promise<SecondReviewSuggestions>;
};

type SuggestionState =
  | { status: "idle" | "loading" | "error" }
  | { status: "ready"; lines: Record<string, SecondReviewLineSuggestion>; decisions: SecondReviewIbrDecision[] };

const css = `
.mb-second-review{display:grid;gap:18px;padding:22px;color:var(--mb-text);font-family:var(--mb-font);background:var(--mb-surface);border:1px solid var(--mb-border);border-radius:var(--mb-radius);box-shadow:var(--mb-shadow)}
.mb-second-review *{box-sizing:border-box}.mb-second-review h3{margin:0;font-size:22px}.mb-second-review p{margin:4px 0 0;color:var(--mb-muted)}
.mb-second-review-deadline{padding:12px 14px;border-radius:var(--mb-control-radius);background:color-mix(in srgb,var(--mb-warning) 10%,var(--mb-surface));color:var(--mb-text)!important}
.mb-second-review-template,.mb-second-review-field{display:grid;gap:6px}.mb-second-review-label{font-size:13px;font-weight:720}.mb-second-review-select,.mb-second-review-textarea{width:100%;padding:10px 12px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-input);color:var(--mb-text);font:inherit}.mb-second-review-textarea{min-height:86px;resize:vertical}.mb-second-review-select:focus,.mb-second-review-textarea:focus{outline:3px solid color-mix(in srgb,var(--mb-accent) 20%,transparent);border-color:var(--mb-accent)}
.mb-second-review-lines{display:grid;gap:10px}.mb-second-review-line{display:grid;gap:12px;padding:14px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-surface)}.mb-second-review-line[data-selected=true]{border-color:color-mix(in srgb,var(--mb-accent) 65%,var(--mb-border));background:color-mix(in srgb,var(--mb-accent) 4%,var(--mb-surface))}.mb-second-review-line-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.mb-second-review-check{display:flex;align-items:center;gap:9px;font-weight:750}.mb-second-review-check input{width:18px;height:18px;accent-color:var(--mb-accent)}.mb-second-review-metrics{display:flex;gap:14px;color:var(--mb-muted);font-size:12px}.mb-second-review-auth{display:flex;align-items:center;flex-wrap:wrap;gap:8px;font-size:13px}.mb-second-review-auth strong{margin-right:4px}.mb-second-review-auth label{display:flex;align-items:center;gap:5px}.mb-second-review-auth input{accent-color:var(--mb-accent)}
.mb-second-review-packet{display:grid;gap:10px;padding:0;border:0}.mb-second-review-packet legend{margin-bottom:8px;font-weight:750}.mb-second-review-document{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--mb-border)}.mb-second-review-document input{width:18px;height:18px;accent-color:var(--mb-accent)}.mb-second-review-document span{display:grid;min-width:0;flex:1}.mb-second-review-document small{color:var(--mb-muted)}.mb-second-review-link{border:0;background:transparent;color:var(--mb-accent);font:inherit;font-weight:700;cursor:pointer}
.mb-second-review-upload{position:relative;display:grid;place-items:center;min-height:82px;padding:16px;border:1px dashed color-mix(in srgb,var(--mb-accent) 55%,var(--mb-border));border-radius:var(--mb-control-radius);background:color-mix(in srgb,var(--mb-accent) 3%,var(--mb-surface));cursor:pointer}.mb-second-review-upload input{position:absolute;width:1px;height:1px;opacity:0}.mb-second-review-upload strong{color:var(--mb-accent)}
.mb-second-review-uploaded{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 11px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius)}
.mb-second-review-error{padding:10px 12px;border-radius:var(--mb-control-radius);background:color-mix(in srgb,var(--mb-danger) 10%,transparent);color:var(--mb-danger);font-size:13px}.mb-second-review-actions{display:flex;justify-content:flex-end;gap:10px}.mb-second-review-button{min-height:42px;padding:9px 16px;border-radius:var(--mb-control-radius);font:inherit;font-weight:740;cursor:pointer}.mb-second-review-button.secondary{border:1px solid var(--mb-border);background:var(--mb-surface);color:var(--mb-text)}.mb-second-review-button.primary{border:0;background:var(--mb-accent);color:var(--mb-accent-contrast)}.mb-second-review-button:disabled{opacity:.55;cursor:not-allowed}
.mb-second-review-corrections{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.mb-second-review-correction-note{font-size:13px}
.mb-second-review-hint{margin:0;font-size:12px;color:var(--mb-muted)}.mb-second-review-hint strong{color:var(--mb-text)}.mb-second-review-hint[data-tone=edited] strong{color:var(--mb-accent)}
.mb-second-review-ibr{display:grid;gap:10px;padding:14px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius)}.mb-second-review-ibr h4{margin:0;font-size:15px}.mb-second-review-ibr-list{display:grid;gap:8px;margin:0;padding:0;list-style:none}.mb-second-review-ibr-item{display:grid;gap:4px;padding:10px 0;border-top:1px solid var(--mb-border)}.mb-second-review-ibr-head{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:13px}.mb-second-review-ibr-head a{color:var(--mb-accent);font-weight:700;text-decoration:none}.mb-second-review-badge{display:inline-flex;align-items:center;min-height:22px;padding:0 8px;border:1px solid var(--mb-border);border-radius:999px;font-size:11px;font-weight:700}.mb-second-review-badge[data-tone=good]{border-color:color-mix(in srgb,var(--mb-success,#15803d) 45%,var(--mb-border));color:var(--mb-success,#15803d)}.mb-second-review-badge[data-tone=accent]{border-color:color-mix(in srgb,var(--mb-accent) 50%,var(--mb-border));color:var(--mb-accent)}.mb-second-review-ibr-item small{color:var(--mb-muted);font-size:12px}.mb-second-review-cite{margin-top:4px;font-size:13px;font-weight:650}
@media(max-width:680px){.mb-second-review{padding:16px}.mb-second-review-line-head{align-items:flex-start;flex-direction:column}.mb-second-review-metrics{flex-wrap:wrap}.mb-second-review-corrections{grid-template-columns:1fr}}
`;

function money(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function initialLineDrafts(data: BillLifecycleData): Record<string, LineDraft> {
  return Object.fromEntries(data.bill.lineItems.flatMap((line) => line.id ? [[line.id, {
    selected: true,
    reason: "",
    serviceAuthorized: "" as AuthorizationAnswer,
    correctBilling: false,
    units: String(line.units),
    modifiers: line.modifiers.join(", "),
    charge: line.charge.toFixed(2),
    chargeReviewed: false,
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
  getSuggestions,
}: SecondReviewFormProps): ReactElement {
  const [lines, setLines] = useState<Record<string, LineDraft>>(() => initialLineDrafts(data));
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const [attachmentIds, setAttachmentIds] = useState(() => data.bill.attachments.map((attachment) => attachment.id));
  const [uploads, setUploads] = useState<BillSubmissionUpload[]>([]);
  const [formError, setFormError] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [delivery, setDelivery] = useState<BillDeliveryOptions | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionState>({ status: getSuggestions ? "loading" : "idle" });
  /** Decisions cited in the reasons; MindBill encloses their original PDFs on send. */
  const [cited, setCited] = useState<string[]>([]);

  const selectableLines = useMemo(() => data.bill.lineItems.filter((line): line is typeof line & { id: string } => Boolean(line.id)), [data.bill.lineItems]);
  const selected = selectableLines.filter((line) => lines[line.id]?.selected);
  const invalidReason = selected.some((line) => !lines[line.id]?.reason.trim());
  const correctionErrors = Object.fromEntries(selected.map((line) => {
    try { parseSecondReviewCorrection(lines[line.id]!); return [line.id, ""]; }
    catch (cause) { return [line.id, cause instanceof Error ? cause.message : "Review the corrected billing values."]; }
  }));
  const invalidCorrection = Object.values(correctionErrors).some(Boolean);
  const disputedAmount = selected.reduce((sum, line) => sum + Math.max(0, !correctionErrors[line.id] && lines[line.id]?.correctBilling ? Number(lines[line.id]!.charge) : line.charge), 0);

  const lineIdsKey = selectableLines.map((line) => line.id).join(",");
  // Hosts often pass a new function each render; load once per set of lines.
  const suggest = useRef(getSuggestions);
  suggest.current = getSuggestions;
  const suggestionsEnabled = Boolean(getSuggestions);
  useEffect(() => {
    const load = suggest.current;
    if (!suggestionsEnabled || !load || !lineIdsKey) { setSuggestions({ status: "idle" }); return; }
    const controller = new AbortController();
    setSuggestions({ status: "loading" });
    load(lineIdsKey.split(","), controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      const byLine = Object.fromEntries(result.lines.map((line) => [line.lineItemId, line]));
      // Recommended decisions (favorable, with an attachable original) are cited
      // automatically on the lines they support, as in MindBill's own Second Review.
      const automatic = result.ibr.decisions.filter((decision) => decision.recommended && decision.sourceUrl && decision.lineItemIds.length);
      // Only fill reasons the reviewer has not started; never overwrite typed text.
      const prefilled = new Set(Object.entries(linesRef.current)
        .filter(([id, line]) => byLine[id]?.reason && !line.reason.trim()).map(([id]) => id));
      setLines((current) => Object.fromEntries(Object.entries(current).map(([id, line]) => {
        const suggested = byLine[id]?.reason;
        if (!suggested || line.reason.trim()) return [id, line];
        const support = automatic.filter((decision) => decision.lineItemIds.includes(id));
        return [id, { ...line, reason: appendSecondReviewIbrCitations(suggested, support) }];
      })));
      setCited(automatic.filter((decision) => decision.lineItemIds.some((id) => prefilled.has(id))).map((decision) => decision.id));
      setSuggestions({ status: "ready", lines: byLine, decisions: result.ibr.decisions });
    }).catch(() => {
      if (!controller.signal.aborted) setSuggestions({ status: "error" });
    });
    return () => controller.abort();
  }, [suggestionsEnabled, lineIdsKey]);
  const lineSuggestion = (id: string) => {
    if (suggestions.status !== "ready") return undefined;
    const suggestion = suggestions.lines[id];
    if (!suggestion?.reason) return suggestion;
    // Compare against the suggestion as prefilled, including automatic citations.
    const support = suggestions.decisions.filter((decision) => decision.recommended && decision.sourceUrl && decision.lineItemIds.includes(id));
    return { ...suggestion, reason: appendSecondReviewIbrCitations(suggestion.reason, support) };
  };
  const toggleCitation = (decision: SecondReviewIbrDecision, cite: boolean) => {
    setCited((current) => cite ? [...new Set([...current, decision.id])] : current.filter((id) => id !== decision.id));
    setLines((current) => {
      const selectedNow = Object.entries(current).filter(([, line]) => line.selected).map(([id]) => id);
      const targets = cite
        ? (decision.lineItemIds.filter((id) => selectedNow.includes(id)).length ? decision.lineItemIds.filter((id) => selectedNow.includes(id)) : selectedNow.slice(0, 1))
        : Object.keys(current);
      return Object.fromEntries(Object.entries(current).map(([id, line]) => [id, targets.includes(id)
        ? { ...line, reason: cite ? appendSecondReviewIbrCitations(line.reason, [decision]) : removeSecondReviewIbrCitation(line.reason, decision.id) }
        : line]));
    });
  };
  const selectedIds = new Set(selected.map((line) => line.id));
  const relatedDecisions = suggestions.status === "ready"
    ? suggestions.decisions.filter((decision) => !decision.recommended || !decision.lineItemIds.length || decision.lineItemIds.some((id) => selectedIds.has(id)))
    : [];

  const patchLine = (id: string, patch: Partial<LineDraft>) => setLines((current) => {
    const line = current[id];
    if (!line) return current;
    return { ...current, [id]: { ...line, ...patch } };
  });

  const applyTemplate = (value: string) => {
    if (!value) return;
    setLines((current) => Object.fromEntries(Object.entries(current).map(([id, line]) => [
      id,
      line.selected ? { ...line, reason: value, ...(value === SECOND_REVIEW_REASON_TEMPLATES[5].value ? { correctBilling: true, chargeReviewed: false } : {}) } : line,
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
    if (invalidCorrection) { setFormError("Review the corrected billing values for each selected service line."); return; }
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
      if (!selected.length || invalidReason || invalidCorrection) throw new Error("Review all selected service lines before submitting.");
      const documents = await prepareBillSubmissionDocuments({
        attachments: [],
        selectedIds: [],
        uploads,
        ...(fetchOverride ? { fetch: fetchOverride } : {}),
      });
      const citedIds = cited.filter((id) => selected.some((line) => (lines[line.id]?.reason ?? "").includes(`IBR ${id} (`)));
      const lineItems: SecondReviewLineInput[] = selected.map((line) => {
        const draft = lines[line.id]!;
        return {
          lineItemId: line.id,
          reason: draft.reason.trim(),
          ...(draft.serviceAuthorized === "" ? {} : { serviceAuthorized: draft.serviceAuthorized === "yes" }),
          ...(draft.correctBilling ? { correction: parseSecondReviewCorrection(draft)! } : {}),
        };
      });
      await onSubmit({
        attachmentIds,
        documents,
        disputedAmount,
        lineItems,
        ...(lineItems[0] ? { reason: lineItems[0].reason } : {}),
        ...(citedIds.length ? { ibrDecisionIds: citedIds } : {}),
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
      <label className="mb-second-review-template"><span className="mb-second-review-label">Apply a saved reason to selected lines</span><Select defaultValue="" onChange={(choice) => { applyTemplate(choice); choice = ""; }}><option value="">Choose a reason template (optional)</option>{SECOND_REVIEW_REASON_TEMPLATES.map((template) => <option key={template.label} value={template.value}>{template.label}</option>)}</Select></label>
      <section className="mb-second-review-lines" aria-label="Service lines in dispute">
        {selectableLines.map((line) => {
          const draft = lines[line.id];
          return <article className="mb-second-review-line" data-selected={draft?.selected} key={line.id}>
            <div className="mb-second-review-line-head"><label className="mb-second-review-check"><Checkbox checked={Boolean(draft?.selected)} onChange={(event) => patchLine(line.id, { selected: event.target.checked })} /><span>{line.code}{line.modifiers.length ? `-${line.modifiers.join("-")}` : ""}</span></label><span className="mb-second-review-metrics"><span>{line.units} unit{line.units === 1 ? "" : "s"}</span><span>{money(line.charge)}</span></span></div>
            {draft?.selected ? <><label className="mb-second-review-field"><span className="mb-second-review-label">Reason for requesting Second Review</span><textarea className="mb-second-review-textarea" required value={draft.reason} onChange={(event) => patchLine(line.id, { reason: event.target.value })} /></label><ReasonHint state={suggestions.status} suggestion={lineSuggestion(line.id)} reason={draft.reason} /><div className="mb-second-review-auth" role="radiogroup" aria-label={`Service or good ${line.code} authorized`}><strong>Service/Good Authorized?</strong>{([['yes','Yes'],['no','No'],['','Not specified']] as const).map(([value, label]) => <label key={label}><Radio name={`authorized-${line.id}`} checked={draft.serviceAuthorized === value} onChange={() => patchLine(line.id, { serviceAuthorized: value })} />{label}</label>)}</div></> : null}
            {draft?.selected ? <>
              <label className="mb-second-review-check"><Checkbox checked={draft.correctBilling} onChange={(event) => patchLine(line.id, { correctBilling: event.target.checked, chargeReviewed: false })} />Correct units or modifiers on this submission</label>
              {draft.correctBilling ? <>
                <p className="mb-second-review-correction-note">Earlier submissions stay unchanged. Review the charge explicitly; changing units or modifiers does not recalculate it.</p>
                <div className="mb-second-review-corrections">
                  <label className="mb-second-review-field"><span className="mb-second-review-label">Corrected units</span><input className="mb-second-review-select" type="number" min="1" max="10000" step="1" value={draft.units} onChange={(event) => patchLine(line.id, { units: event.target.value, chargeReviewed: false })} /></label>
                  <label className="mb-second-review-field"><span className="mb-second-review-label">Corrected modifiers</span><input className="mb-second-review-select" placeholder="95, 93 — or leave blank" value={draft.modifiers} onChange={(event) => patchLine(line.id, { modifiers: event.target.value, chargeReviewed: false })} /></label>
                  <label className="mb-second-review-field"><span className="mb-second-review-label">Corrected charge ($)</span><input className="mb-second-review-select" type="number" min="0" max="999999.99" step="0.01" value={draft.charge} onChange={(event) => patchLine(line.id, { charge: event.target.value, chargeReviewed: false })} /></label>
                </div>
                <label className="mb-second-review-check"><Checkbox checked={draft.chargeReviewed} onChange={(event) => patchLine(line.id, { chargeReviewed: event.target.checked })} />I reviewed the corrected charge</label>
                {correctionErrors[line.id] ? <p className="mb-second-review-correction-note" role="status">{correctionErrors[line.id]}</p> : null}
              </> : null}
            </> : null}
          </article>;
        })}
        {!selectableLines.length ? <div className="mb-second-review-error">This bill has no stable service-line identifiers. Refresh the bill before submitting a Second Review.</div> : null}
      </section>
      {getSuggestions ? <RelatedIbrDecisions state={suggestions.status} decisions={relatedDecisions} cited={cited} onCite={toggleCitation} disabled={submitting || preparing} /> : null}
      <fieldset className="mb-second-review-packet"><legend>Supporting packet</legend>{data.bill.attachments.map((attachment) => <label className="mb-second-review-document" key={attachment.id}><Checkbox checked={attachmentIds.includes(attachment.id)} onChange={(event) => setAttachmentIds((current) => event.target.checked ? [...current, attachment.id] : current.filter((id) => id !== attachment.id))} /><span><strong>{attachment.filename}</strong><small>{attachment.description || attachment.documentType}</small></span><button className="mb-second-review-link" type="button" onClick={() => void openAttachment(attachment).catch(() => undefined)}>View</button></label>)}<label className="mb-second-review-upload"><FileInput appearance="overlay" accept="application/pdf,.pdf" multiple onChange={addUploads} /><span><strong>Choose one or more PDF files</strong> to attach</span></label>{uploads.map((upload, index) => <div className="mb-second-review-uploaded" key={`${upload.file.name}-${index}`}><span>{upload.file.name}</span><button className="mb-second-review-link" type="button" onClick={() => setUploads((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>)}</fieldset>
      {(formError || error?.message) ? <div className="mb-second-review-error" role="alert">{formError || error?.message}</div> : null}
      <div className="mb-second-review-actions"><button className="mb-second-review-button secondary" type="button" disabled={submitting || preparing} onClick={onCancel}>Cancel</button><button className="mb-second-review-button primary" type="button" disabled={submitting || preparing || !selected.length || invalidReason || invalidCorrection} onClick={() => void continueToDelivery()}>{preparing ? "Preparing…" : "Continue to delivery"}</button></div>
    </section>
    {delivery ? <SendRouteDialog title="Confirm Second Review delivery" delivery={delivery} submitting={submitting || preparing} error={formError || error?.message || null} onCancel={() => setDelivery(null)} onConfirm={(route) => void submit(route)} /> : null}
  </>;
}

function ReasonHint({ state, suggestion, reason }: { state: SuggestionState["status"]; suggestion: SecondReviewLineSuggestion | undefined; reason: string }): ReactElement | null {
  if (state === "loading") return <p className="mb-second-review-hint" role="status">Matching a reason from the EOR…</p>;
  if (state === "error") return <p className="mb-second-review-hint" role="status">Suggested reasons are unavailable right now. Choose a reason template or enter the facts for this service.</p>;
  if (state !== "ready") return null;
  if (!suggestion?.reason) return <p className="mb-second-review-hint">The EOR does not identify a clear reason for this service. Enter the facts or choose a reason template.</p>;
  const edited = reason.trim() !== suggestion.reason.trim();
  const origin = suggestion.source === "saved" ? "Saved reason for this service." : `Prefilled from the EOR${suggestion.template ? `: ${suggestion.template.title}` : ""}.`;
  return <p className="mb-second-review-hint" data-tone={edited ? "edited" : undefined}>
    <strong>{edited ? "Edited. " : origin + " "}</strong>
    {edited ? "Your wording replaces the suggested reason." : suggestion.source === "saved" ? "Review it before sending." : suggestion.explanation ?? "Review it before sending."}
  </p>;
}

function decisionDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[2]}/${match[3]}/${match[1]}` : value;
}

function RelatedIbrDecisions({ state, decisions, cited, onCite, disabled }: { state: SuggestionState["status"]; decisions: SecondReviewIbrDecision[]; cited: string[]; onCite: (decision: SecondReviewIbrDecision, cite: boolean) => void; disabled: boolean }): ReactElement {
  return <section className="mb-second-review-ibr" aria-label="Related IBR decisions">
    <div><h4>Related IBR decisions</h4><p>Past Independent Bill Review determinations on the same codes and denial reasons. A cited decision is quoted in the reason, and MindBill encloses its original PDF when you send. Open a decision to check it before relying on it.</p></div>
    {state === "loading" ? <p className="mb-second-review-hint" role="status">Finding related IBR decisions…</p> : null}
    {state === "error" ? <p className="mb-second-review-hint" role="status">Related IBR decisions could not be loaded. You can still submit the Second Review.</p> : null}
    {state === "ready" && !decisions.length ? <p className="mb-second-review-hint">No past IBR decisions matched these codes and denial reasons.</p> : null}
    {state === "ready" && decisions.length ? <ul className="mb-second-review-ibr-list">{decisions.map((decision) => <li className="mb-second-review-ibr-item" key={decision.id}>
      <div className="mb-second-review-ibr-head">
        {decision.sourceUrl ? <a href={decision.sourceUrl} target="_blank" rel="noopener noreferrer">IBR {decision.id}</a> : <strong>IBR {decision.id}</strong>}
        {decision.outcome ? <span className="mb-second-review-badge" data-tone={decision.outcome === "Overturned" ? "good" : undefined}>{decision.outcome}</span> : null}
        {decision.recommended ? <span className="mb-second-review-badge" data-tone="accent">Recommended</span> : null}
        {decision.code ? <span>{decision.code}</span> : null}
        {decision.date ? <span>{decisionDate(decision.date)}</span> : null}
      </div>
      <span>{decision.issue}{decision.citation ? ` — ${decision.citation}` : ""}</span>
      {decision.matchedOn.length ? <small>Matched on {decision.matchedOn.join(" · ")}</small> : null}
      {decision.sourceUrl ? <label className="mb-second-review-check mb-second-review-cite"><Checkbox checked={cited.includes(decision.id)} disabled={disabled} onChange={(event) => onCite(decision, event.target.checked)} />{cited.includes(decision.id) ? `Cited · IBR_${decision.id}.pdf will be enclosed` : "Cite in the reason and enclose the decision"}</label> : null}
    </li>)}</ul> : null}
  </section>;
}
