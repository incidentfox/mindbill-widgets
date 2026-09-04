"use client";

// "Report Bill Status" dialog: call the Claims Administrator /
// Bill Review vendor (contacts in section 1), verify the submission receipt
// the host renders in section 2, then record the reported payment status plus
// the call details in section 3. Presentational: the host posts the resulting
// ReportBillStatusInput through its own lifecycle action call.

import type { CSSProperties, ReactElement, ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  REPORT_BILL_STATUS_OPTIONS,
  type ReportBillStatusId,
  type ReportBillStatusInput,
} from "@mindbill/browser";

import { mindBillAppearanceStyle, type MindBillReactAppearance } from "./appearance";

// The five status options and their input shape are framework-neutral and live
// in @mindbill/browser; re-exported here so existing imports keep working.
export { REPORT_BILL_STATUS_OPTIONS } from "@mindbill/browser";
export type { ReportBillStatusId, ReportBillStatusInput } from "@mindbill/browser";

type SurfaceProps = {
  appearance?: MindBillReactAppearance;
  className?: string;
  style?: CSSProperties;
};

export type ReportBillStatusDialogProps = SurfaceProps & {
  title?: ReactNode;
  claimsAdmin?: {
    name: string;
    hoursOfOperation?: string;
    phones?: Array<{ label: string; value: string }>;
  };
  billReview?: { name: string; phone?: string };
  /** Host renders its submission receipt, e.g. a BillHistoryTable. */
  receipt?: ReactNode;
  submitting?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSave: (input: ReportBillStatusInput) => void;
};

const css = `
.mbbs-overlay{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px;background:rgba(15,30,40,.45)}
.mbbs{display:grid;gap:18px;width:min(860px,100%);max-height:min(90vh,960px);overflow:auto;overscroll-behavior:contain;padding:24px;border:1px solid var(--mb-border);border-radius:var(--mb-radius);background:var(--mb-surface);color:var(--mb-text);font-family:var(--mb-font);font-size:14px;box-shadow:0 24px 60px rgba(17,38,49,.28)}
.mbbs *{box-sizing:border-box}
.mbbs-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.mbbs-title{margin:0;font-size:20px;font-weight:760}
.mbbs-close{border:0;background:transparent;color:var(--mb-muted);font-size:22px;line-height:1;cursor:pointer}
.mbbs-section h4{margin:0 0 4px;font-size:15px}
.mbbs-copy{margin:0 0 10px;color:var(--mb-muted);font-size:13px}
.mbbs-contacts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.mbbs-contact{border:1px solid var(--mb-border);border-left:4px solid var(--mb-accent);border-radius:var(--mb-control-radius);background:color-mix(in srgb,var(--mb-accent) 3%,var(--mb-surface));padding:12px 14px}
.mbbs-contact h5{margin:0 0 6px;color:var(--mb-muted);font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase}
.mbbs-contact dl{display:grid;gap:4px;margin:0}
.mbbs-contact dl>div{display:grid;grid-template-columns:130px minmax(0,1fr);gap:10px}
.mbbs-contact dt{color:var(--mb-muted);font-size:12.5px}
.mbbs-contact dd{margin:0;font-weight:700;overflow-wrap:anywhere}
.mbbs-receipt{border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);padding:10px}
.mbbs-report{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:18px}
.mbbs-options{display:grid;gap:8px;align-content:start}
.mbbs-option{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-surface);cursor:pointer}
.mbbs-option[data-selected=true]{border-color:var(--mb-accent);background:color-mix(in srgb,var(--mb-accent) 5%,var(--mb-surface))}
.mbbs-option input{margin-top:3px;accent-color:var(--mb-accent)}
.mbbs-option-label{display:block;font-weight:750;line-height:1.35}
.mbbs-option-copy{display:block;margin-top:2px;color:var(--mb-muted);font-size:12.5px;line-height:1.4}
.mbbs-fields{display:grid;gap:10px;align-content:start}
.mbbs-field{display:grid;gap:5px;font-size:13px}
.mbbs-label{font-weight:650}
.mbbs-input,.mbbs-textarea{width:100%;padding:9px 11px;border:1px solid var(--mb-border);border-radius:calc(var(--mb-control-radius) - 2px);background:var(--mb-input);color:var(--mb-text);font:inherit;font-size:14px}
.mbbs-textarea{resize:vertical;min-height:74px}
.mbbs-input:focus,.mbbs-textarea:focus{outline:3px solid color-mix(in srgb,var(--mb-accent) 22%,transparent);border-color:var(--mb-accent)}
.mbbs-alert{padding:10px 12px;border-radius:var(--mb-control-radius);background:color-mix(in srgb,var(--mb-danger) 10%,transparent);color:var(--mb-danger);font-size:13px}
.mbbs-actions{display:flex;justify-content:flex-end;gap:10px}
.mbbs-cancel{min-height:42px;padding:9px 16px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-surface);color:var(--mb-text);font:inherit;font-weight:680;cursor:pointer}
.mbbs-save{min-height:42px;min-width:130px;padding:9px 18px;border:0;border-radius:var(--mb-control-radius);background:var(--mb-accent);color:var(--mb-accent-contrast);font:inherit;font-weight:760;cursor:pointer}
.mbbs-save:disabled,.mbbs-cancel:disabled{opacity:.6;cursor:not-allowed}
@media(max-width:700px){.mbbs-contacts,.mbbs-report{grid-template-columns:1fr}}
`;

export function ReportBillStatusDialog({
  title = "Report Bill Status",
  claimsAdmin,
  billReview,
  receipt,
  submitting = false,
  error = null,
  onCancel,
  onSave,
  appearance,
  className = "",
  style,
}: ReportBillStatusDialogProps): ReactElement {
  const [status, setStatus] = useState<ReportBillStatusId | null>(null);
  const [company, setCompany] = useState("");
  const [representativeName, setRepresentativeName] = useState("");
  const [representativeRole, setRepresentativeRole] = useState("");
  const [phone, setPhone] = useState("");
  const [callReference, setCallReference] = useState("");
  const [note, setNote] = useState("");

  // Close on Escape (unless a save is in flight — the caller owns that state).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, submitting]);

  const save = () => {
    if (!status) return;
    onSave({
      status,
      ...(company.trim() ? { company: company.trim() } : {}),
      ...(representativeName.trim() ? { representativeName: representativeName.trim() } : {}),
      ...(representativeRole.trim() ? { representativeRole: representativeRole.trim() } : {}),
      ...(phone.trim() ? { phone: phone.trim() } : {}),
      ...(callReference.trim() ? { callReference: callReference.trim() } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    });
  };

  const field = (
    label: string,
    value: string,
    onChange: (next: string) => void,
  ): ReactElement => (
    <label className="mbbs-field" key={label}>
      <span className="mbbs-label">{label}</span>
      <input className="mbbs-input" value={value} disabled={submitting} onChange={(event) => onChange(event.target.value)} />
    </label>
  );

  return (
    <div
      className="mbbs-overlay"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onCancel(); }}
    >
      <style>{css}</style>
      <div
        className={`mbbs ${className}`.trim()}
        style={mindBillAppearanceStyle(appearance, style)}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : "Report Bill Status"}
      >
        <div className="mbbs-head">
          <h3 className="mbbs-title">{title}</h3>
          <button className="mbbs-close" type="button" aria-label="Close" disabled={submitting} onClick={onCancel}>×</button>
        </div>

        {claimsAdmin || billReview ? (
          <div className="mbbs-section">
            <h4>1. Call Claims Administrator or Bill Review</h4>
            <p className="mbbs-copy">Contact the payer to request the payment status of this bill.</p>
            <div className="mbbs-contacts">
              {claimsAdmin ? (
                <div className="mbbs-contact">
                  <h5>Claims Admin</h5>
                  <dl>
                    <div><dt>Name</dt><dd>{claimsAdmin.name}</dd></div>
                    {claimsAdmin.hoursOfOperation ? <div><dt>Hours of Operation</dt><dd>{claimsAdmin.hoursOfOperation}</dd></div> : null}
                    {(claimsAdmin.phones ?? []).map((entry) => (
                      <div key={`${entry.label}-${entry.value}`}><dt>{entry.label}</dt><dd>{entry.value}</dd></div>
                    ))}
                  </dl>
                </div>
              ) : null}
              {billReview ? (
                <div className="mbbs-contact">
                  <h5>Bill Review</h5>
                  <dl>
                    <div><dt>Name</dt><dd>{billReview.name}</dd></div>
                    {billReview.phone ? <div><dt>Phone</dt><dd>{billReview.phone}</dd></div> : null}
                  </dl>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {receipt ? (
          <div className="mbbs-section">
            <h4>2. Review Bill Submission Receipt</h4>
            <p className="mbbs-copy">Reference the submission receipt below when the payer asks how and when the bill was sent.</p>
            <div className="mbbs-receipt">{receipt}</div>
          </div>
        ) : null}

        <div className="mbbs-section">
          <h4>3. Report Bill Payment Status</h4>
          <p className="mbbs-copy">Select the status reported by the payer, then record who provided it.</p>
          <div className="mbbs-report">
            <div className="mbbs-options" role="radiogroup" aria-label="Reported bill payment status">
              {REPORT_BILL_STATUS_OPTIONS.map((option) => (
                <label key={option.id} className="mbbs-option" data-selected={status === option.id}>
                  <input
                    type="radio"
                    name="mbbs-status"
                    value={option.id}
                    checked={status === option.id}
                    disabled={submitting}
                    onChange={() => setStatus(option.id)}
                  />
                  <span>
                    <span className="mbbs-option-label">{option.label}</span>
                    <span className="mbbs-option-copy">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="mbbs-fields">
              {field("Company", company, setCompany)}
              {field("Name", representativeName, setRepresentativeName)}
              {field("Role", representativeRole, setRepresentativeRole)}
              {field("Phone Number", phone, setPhone)}
              {field("Call Reference Number", callReference, setCallReference)}
              <label className="mbbs-field">
                <span className="mbbs-label">Message Note</span>
                <textarea className="mbbs-textarea" value={note} disabled={submitting} onChange={(event) => setNote(event.target.value)} />
              </label>
            </div>
          </div>
        </div>

        {error ? <div className="mbbs-alert" role="alert">{error}</div> : null}

        <div className="mbbs-actions">
          <button className="mbbs-cancel" type="button" disabled={submitting} onClick={onCancel}>Cancel</button>
          <button className="mbbs-save" type="button" disabled={submitting || !status} onClick={save}>
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
