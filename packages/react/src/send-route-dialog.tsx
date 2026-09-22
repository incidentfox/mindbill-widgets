"use client";

// Delivery-method picker shown when a bill is submitted: one
// card per route (e-bill / email / fax / mail), the selected card expands
// inline with its destination sub-form, and the primary button names the
// channel. Rendered by BillSubmissionForm by default in connected mode; also
// exported for hosts that submit through their own server.

import type { ReactElement, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type { BillDeliveryOptions, BillSubmissionRoute, SubmitBillInput } from "@mindbill/browser";

const EMAIL_RE = /[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;

/** First plausible email address inside a raw contact string, or null. */
export function extractSendRouteEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = raw.match(EMAIL_RE);
  return match ? match[0] : null;
}

/** "(213) 555-0199" for 10/11-digit US numbers; anything else trimmed as-is. */
export function formatSendRouteFax(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (ten.length === 10) return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
  return raw.trim();
}

/**
 * Live format-as-you-type for the fax input: digits render progressively as
 * "(213) 555-0199" whether typed bare or pasted pre-formatted. A leading "+"
 * (international) or an overflowing value is left as typed.
 */
export function formatSendRouteFaxInput(raw: string): string {
  const trimmed = raw.trimStart();
  if (trimmed.startsWith("+")) return raw;
  const all = trimmed.replace(/\D/g, "");
  const digits = all.length === 11 && all.startsWith("1") ? all.slice(1) : all;
  if (digits.length > 10 || (all.length === 11 && !all.startsWith("1")) || all.length > 11) return raw;
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export type SendRouteSubmission = Pick<
  SubmitBillInput,
  "route" | "destination" | "attention" | "subject" | "note" | "cc"
>;

export type SendRouteDialogProps = {
  /** Dialog heading, e.g. "Send bill". */
  title?: ReactNode;
  delivery: BillDeliveryOptions;
  submitting?: boolean;
  /** Disables the confirm button while the caller uploads documents. */
  disabled?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (submission: SendRouteSubmission) => void;
};

const css = `
.mbrd-overlay{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px;background:rgba(15,30,40,.45)}
.mbrd{display:grid;gap:16px;width:min(560px,100%);max-height:min(86vh,860px);overflow:auto;overscroll-behavior:contain;padding:24px;border:1px solid var(--mb-border);border-radius:var(--mb-radius);background:var(--mb-surface);color:var(--mb-text);font-family:var(--mb-font);font-size:15px;box-shadow:0 24px 60px rgba(17,38,49,.28)}
.mbrd *{box-sizing:border-box}
.mbrd-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.mbrd-title{margin:0;font-size:20px;font-weight:760}
.mbrd-copy{margin:4px 0 0;color:var(--mb-muted);font-size:14px}
.mbrd-close{border:0;background:transparent;color:var(--mb-muted);font-size:22px;line-height:1;cursor:pointer}
.mbrd-cards{display:grid;gap:10px}
.mbrd-card{border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-surface);transition:border-color .12s ease,background .12s ease}
.mbrd-card[data-selected=true]{border-color:var(--mb-accent);background:color-mix(in srgb,var(--mb-accent) 5%,var(--mb-surface))}
.mbrd-card[data-disabled=true]{opacity:.55}
.mbrd-card-main{display:flex;align-items:center;gap:12px;width:100%;padding:13px 14px;border:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.mbrd-card[data-disabled=true] .mbrd-card-main{cursor:not-allowed}
.mbrd-radio{flex:0 0 auto;width:18px;height:18px;border:2px solid var(--mb-border);border-radius:50%;display:grid;place-items:center}
.mbrd-card[data-selected=true] .mbrd-radio{border-color:var(--mb-accent)}
.mbrd-card[data-selected=true] .mbrd-radio:after{content:"";width:9px;height:9px;border-radius:50%;background:var(--mb-accent)}
.mbrd-card-text{min-width:0;flex:1}
.mbrd-card-title{font-weight:700;line-height:1.3;overflow-wrap:anywhere}
.mbrd-card-detail{margin-top:2px;color:var(--mb-muted);font-size:13px;line-height:1.35;overflow-wrap:anywhere}
.mbrd-badges{display:flex;flex:0 0 auto;gap:6px}
.mbrd-badge{padding:2px 8px;border:1px solid var(--mb-border);border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
.mbrd-badge[data-tone=verified]{border-color:color-mix(in srgb,#159447 45%,var(--mb-border));background:color-mix(in srgb,#159447 8%,var(--mb-surface));color:#0c7a48}
.mbrd-badge[data-tone=auto]{border-color:color-mix(in srgb,var(--mb-accent) 45%,var(--mb-border));background:color-mix(in srgb,var(--mb-accent) 10%,var(--mb-surface));color:var(--mb-accent)}
.mbrd-sub{display:grid;gap:12px;padding:12px 14px;border-top:1px solid var(--mb-border);background:color-mix(in srgb,var(--mb-accent) 2%,var(--mb-surface));border-radius:0 0 var(--mb-control-radius) var(--mb-control-radius)}
.mbrd-choice{border:1px solid var(--mb-border);border-radius:calc(var(--mb-control-radius) - 2px);background:var(--mb-surface)}
.mbrd-choice[data-selected=true]{border-color:var(--mb-accent)}
.mbrd-choice[data-disabled=true]{opacity:.55}
.mbrd-choice-main{display:flex;align-items:center;gap:10px;width:100%;padding:9px 11px;border:0;background:transparent;color:inherit;font:inherit;font-size:13px;text-align:left;cursor:pointer}
.mbrd-choice[data-disabled=true] .mbrd-choice-main{cursor:not-allowed}
.mbrd-choice-title{font-weight:650;overflow-wrap:anywhere}
.mbrd-choice-detail{margin-top:1px;color:var(--mb-muted);font-size:12px}
.mbrd-choice-body{display:grid;gap:8px;padding:10px 11px;border-top:1px solid var(--mb-border)}
.mbrd-field{display:grid;gap:5px;font-size:13px}
.mbrd-label{font-weight:650}
.mbrd-star{color:var(--mb-danger)}
.mbrd-input,.mbrd-textarea{width:100%;padding:9px 11px;border:1px solid var(--mb-border);border-radius:calc(var(--mb-control-radius) - 2px);background:var(--mb-input);color:var(--mb-text);font:inherit;font-size:14px}
.mbrd-textarea{resize:vertical;min-height:74px}
.mbrd-input:focus,.mbrd-textarea:focus{outline:3px solid color-mix(in srgb,var(--mb-accent) 22%,transparent);border-color:var(--mb-accent)}
.mbrd-error{color:var(--mb-danger);font-size:12px}
.mbrd-help{color:var(--mb-muted);font-size:12px}
.mbrd-alert{padding:10px 12px;border-radius:var(--mb-control-radius);background:color-mix(in srgb,var(--mb-danger) 10%,transparent);color:var(--mb-danger);font-size:13px}
.mbrd-actions{display:flex;justify-content:flex-end;gap:10px}
.mbrd-cancel{min-height:42px;padding:9px 16px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-surface);color:var(--mb-text);font:inherit;font-weight:680;cursor:pointer}
.mbrd-confirm{min-height:42px;min-width:130px;padding:9px 18px;border:0;border-radius:var(--mb-control-radius);background:var(--mb-accent);color:var(--mb-accent-contrast);font:inherit;font-weight:760;cursor:pointer}
.mbrd-confirm:disabled,.mbrd-cancel:disabled{opacity:.6;cursor:not-allowed}
`;

const CONFIRM_LABELS: Record<BillSubmissionRoute, string> = {
  ebill: "Send Bill",
  email: "Email Bill",
  fax: "Fax Bill",
  mail: "Mail Bill",
};

function RouteCard({
  selected,
  disabled,
  title,
  detail,
  badges,
  onSelect,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  title: ReactNode;
  detail?: ReactNode;
  badges?: ReactNode;
  onSelect: () => void;
  children?: ReactNode;
}): ReactElement {
  return (
    <div className="mbrd-card" data-selected={selected} data-disabled={Boolean(disabled)}>
      <button
        className="mbrd-card-main"
        type="button"
        role="radio"
        aria-checked={selected}
        disabled={disabled}
        onClick={onSelect}
      >
        <span className="mbrd-radio" aria-hidden />
        <span className="mbrd-card-text">
          <span className="mbrd-card-title">{title}</span>
          {detail ? <span className="mbrd-card-detail" style={{ display: "block" }}>{detail}</span> : null}
        </span>
        {badges ? <span className="mbrd-badges">{badges}</span> : null}
      </button>
      {selected && children ? <div className="mbrd-sub">{children}</div> : null}
    </div>
  );
}

function RecipientChoice({
  selected,
  disabled,
  title,
  detail,
  onSelect,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  title: ReactNode;
  detail?: ReactNode;
  onSelect: () => void;
  children?: ReactNode;
}): ReactElement {
  return (
    <div className="mbrd-choice" data-selected={selected} data-disabled={Boolean(disabled)}>
      <button
        className="mbrd-choice-main"
        type="button"
        role="radio"
        aria-checked={selected}
        disabled={disabled}
        onClick={onSelect}
      >
        <span className="mbrd-radio" aria-hidden style={{ width: 15, height: 15 }} />
        <span className="mbrd-card-text">
          <span className="mbrd-choice-title">{title}</span>
          {detail ? <span className="mbrd-choice-detail" style={{ display: "block" }}>{detail}</span> : null}
        </span>
      </button>
      {selected && children ? <div className="mbrd-choice-body">{children}</div> : null}
    </div>
  );
}

export function SendRouteDialog({
  title = "Send bill",
  delivery,
  submitting = false,
  disabled = false,
  error = null,
  onCancel,
  onConfirm,
}: SendRouteDialogProps): ReactElement {
  const ebillOption = delivery.options.find((option) => option.route === "ebill");
  const mailOption = delivery.options.find((option) => option.route === "mail");
  const recommendedRoute = delivery.recommended.route;
  const onFileEmail = extractSendRouteEmail(delivery.contacts.claimsEmail);
  const onFileFax = delivery.contacts.faxNumber?.trim() || null;
  const onFileFaxDisplay = formatSendRouteFax(onFileFax);
  const onFileMail = delivery.contacts.mailingAddress?.trim() || "";

  const [route, setRoute] = useState<BillSubmissionRoute>(recommendedRoute);
  const [emailMode, setEmailMode] = useState<"onfile" | "alt">(onFileEmail ? "onfile" : "alt");
  const [faxMode, setFaxMode] = useState<"onfile" | "alt">(onFileFax ? "onfile" : "alt");
  const [emailTo, setEmailTo] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [ccInput, setCcInput] = useState("");
  const [faxTo, setFaxTo] = useState("");
  const [attention, setAttention] = useState("");
  const [mailTo, setMailTo] = useState(onFileMail);

  useEffect(() => {
    setRoute(recommendedRoute);
    setEmailMode(onFileEmail ? "onfile" : "alt");
    setFaxMode(onFileFax ? "onfile" : "alt");
    setMailTo(onFileMail);
  }, [recommendedRoute, onFileEmail, onFileFax, onFileMail]);

  // Close on Escape (unless a submit is in flight — the caller owns that state).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, submitting]);

  const effectiveEmail = emailMode === "onfile" && onFileEmail ? onFileEmail : emailTo.trim();
  const effectiveFax = faxMode === "onfile" && onFileFax ? onFileFax : faxTo;
  const faxDigits = effectiveFax.replace(/\D/g, "");
  const emailValid = EMAIL_RE.test(effectiveEmail);
  const ccList = ccInput.split(/[,;]/).map((entry) => entry.trim()).filter(Boolean);
  const ccValid = ccList.every((entry) => EMAIL_RE.test(entry));
  const faxValid = faxDigits.length >= 10;
  const mailValid = mailTo.trim().length > 2;
  const confirmDisabled =
    submitting
    || disabled
    || (route === "email" && (!emailValid || !ccValid))
    || (route === "fax" && !faxValid)
    || (route === "mail" && !mailValid);

  const submission = useMemo((): SendRouteSubmission => {
    if (route === "email") {
      return {
        route,
        destination: { email: effectiveEmail },
        ...(subject.trim() ? { subject: subject.trim() } : {}),
        ...(message.trim() ? { note: message.trim() } : {}),
        ...(ccList.length ? { cc: ccList } : {}),
      };
    }
    if (route === "fax") {
      return {
        route,
        destination: { faxNumber: effectiveFax.trim() },
        ...(attention.trim() ? { attention: attention.trim() } : {}),
      };
    }
    if (route === "mail") {
      return { route, destination: { mailingAddress: mailTo.trim() } };
    }
    return { route };
    // ccList derives from ccInput.
  }, [route, effectiveEmail, subject, message, ccInput, effectiveFax, attention, mailTo]);

  return (
    <div className="mbrd-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onCancel(); }}>
      <style>{css}</style>
      <div className="mbrd" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : "Send bill"}>
        <div className="mbrd-head">
          <div>
            <h3 className="mbrd-title">{title}</h3>
            <p className="mbrd-copy">Select the delivery method.</p>
          </div>
          <button className="mbrd-close" type="button" aria-label="Close" disabled={submitting} onClick={onCancel}>×</button>
        </div>

        <div className="mbrd-cards" role="radiogroup" aria-label="Delivery method">
          {(() => {
            const ebillCard = ebillOption ? (
              <RouteCard
                key="ebill"
                selected={route === "ebill"}
                title={ebillOption.printAndMail ? ebillOption.label : `e-Bill to ${ebillOption.payerName || delivery.payerName}`}
                detail={[
                  ebillOption.detail || null,
                  !ebillOption.printAndMail && ebillOption.label.startsWith("e-bill ")
                    ? ebillOption.label.slice("e-bill ".length)
                    : null,
                ].filter(Boolean).join(" · ")}
                badges={<>
                  {!ebillOption.fallback ? <span className="mbrd-badge" data-tone="verified">Verified Route</span> : null}
                  {recommendedRoute === "ebill" ? <span className="mbrd-badge" data-tone="auto">Auto</span> : null}
                </>}
                onSelect={() => setRoute("ebill")}
              />
            ) : null;

            const emailCard = (
              <RouteCard
                key="email"
                selected={route === "email"}
                title="Email Bill"
                detail={onFileEmail ?? "No claims email on file — enter a recipient."}
                badges={recommendedRoute === "email" ? <span className="mbrd-badge" data-tone="auto">Auto</span> : null}
                onSelect={() => setRoute("email")}
              >
                <div role="radiogroup" aria-label="Email recipient" style={{ display: "grid", gap: 8 }}>
                  <RecipientChoice
                    selected={emailMode === "onfile"}
                    disabled={!onFileEmail}
                    title={onFileEmail ?? "Claims email on file"}
                    detail={onFileEmail ? "Claims contact on file" : "No claims email exists on file for this payer."}
                    onSelect={() => setEmailMode("onfile")}
                  />
                  <RecipientChoice
                    selected={emailMode === "alt"}
                    title="Alternative email recipient"
                    onSelect={() => setEmailMode("alt")}
                  >
                    <label className="mbrd-field">
                      <span className="mbrd-label">Alternative email address <span className="mbrd-star">*</span></span>
                      <input className="mbrd-input" type="email" value={emailTo} placeholder="user@mail.com" onChange={(event) => setEmailTo(event.target.value)} />
                      {emailTo.trim() && !EMAIL_RE.test(emailTo.trim()) ? <span className="mbrd-error">Enter a valid email address.</span> : null}
                    </label>
                  </RecipientChoice>
                </div>
                <label className="mbrd-field">
                  <span className="mbrd-label">Cc — optional</span>
                  <input className="mbrd-input" value={ccInput} placeholder="adjuster@payer.com, supervisor@payer.com" onChange={(event) => setCcInput(event.target.value)} />
                  {!ccValid ? <span className="mbrd-error">Each Cc entry must be a valid email address (separate with commas).</span> : null}
                </label>
                <label className="mbrd-field">
                  <span className="mbrd-label">Email subject — optional</span>
                  <input className="mbrd-input" value={subject} maxLength={255} onChange={(event) => setSubject(event.target.value)} />
                </label>
                <label className="mbrd-field">
                  <span className="mbrd-label">Message — optional</span>
                  <textarea className="mbrd-textarea" value={message} maxLength={5000} placeholder="Added at the top of the email body, above the bill summary." onChange={(event) => setMessage(event.target.value)} />
                </label>
              </RouteCard>
            );

            const faxCard = (
              <RouteCard
                key="fax"
                selected={route === "fax"}
                title="Fax Bill"
                detail={onFileFax ? `${onFileFaxDisplay} — payer fax on file` : "No fax on file — enter a number."}
                badges={recommendedRoute === "fax" ? <span className="mbrd-badge" data-tone="auto">Auto</span> : null}
                onSelect={() => setRoute("fax")}
              >
                <div role="radiogroup" aria-label="Fax recipient" style={{ display: "grid", gap: 8 }}>
                  <RecipientChoice
                    selected={faxMode === "onfile"}
                    disabled={!onFileFax}
                    title={onFileFax ? onFileFaxDisplay : "Payer fax on file"}
                    detail={onFileFax ? "Payer fax on file" : "No fax number exists on file for this payer."}
                    onSelect={() => setFaxMode("onfile")}
                  />
                  <RecipientChoice
                    selected={faxMode === "alt"}
                    title="Alternative fax recipient"
                    onSelect={() => setFaxMode("alt")}
                  >
                    <label className="mbrd-field">
                      <span className="mbrd-label">Alternative fax number <span className="mbrd-star">*</span></span>
                      <input className="mbrd-input" inputMode="tel" value={faxTo} placeholder="(000) 000-0000" onChange={(event) => setFaxTo(formatSendRouteFaxInput(event.target.value))} />
                      {faxTo.trim() && faxTo.replace(/\D/g, "").length < 10 ? <span className="mbrd-error">Enter a valid fax number (10 digits).</span> : null}
                    </label>
                  </RecipientChoice>
                </div>
                <label className="mbrd-field">
                  <span className="mbrd-label">Attention — optional</span>
                  <input className="mbrd-input" value={attention} maxLength={120} placeholder="Recipient name" onChange={(event) => setAttention(event.target.value)} />
                  <span className="mbrd-help">Printed as ATTENTION on the fax cover sheet.</span>
                </label>
              </RouteCard>
            );

            const mailCard = (
              <RouteCard
                key="mail"
                selected={route === "mail"}
                title="Mail Bill"
                detail={onFileMail ? onFileMail.replace(/\n/g, ", ") : "Physical mail — enter the payer's mailing address."}
                badges={recommendedRoute === "mail" ? <span className="mbrd-badge" data-tone="auto">Auto</span> : null}
                onSelect={() => setRoute("mail")}
              >
                <label className="mbrd-field">
                  <span className="mbrd-label">Mailing address <span className="mbrd-star">*</span></span>
                  <textarea className="mbrd-textarea" value={mailTo} placeholder={"Payer Claims Dept\nPO Box 1234\nCity, ST 00000"} onChange={(event) => setMailTo(event.target.value)} />
                  {!mailValid ? <span className="mbrd-error">Enter a mailing address.</span> : null}
                  <span className="mbrd-help">
                    {mailOption?.printAndMail
                      ? mailOption.detail
                      : "Sent as physical mail — printed and mailed to this address."}
                  </span>
                </label>
              </RouteCard>
            );

            // Preference order: ebill (only when the payer has an e-route) → fax
            // and email WITH a contact on file → mail (always) → the rest last.
            const cards: ReactNode[] = [];
            if (ebillCard) cards.push(ebillCard);
            if (onFileFax) cards.push(faxCard);
            if (onFileEmail) cards.push(emailCard);
            cards.push(mailCard);
            if (!onFileFax) cards.push(faxCard);
            if (!onFileEmail) cards.push(emailCard);
            return cards;
          })()}
        </div>

        {error ? <div className="mbrd-alert" role="alert">{error}</div> : null}

        <div className="mbrd-actions">
          <button className="mbrd-cancel" type="button" disabled={submitting} onClick={onCancel}>Cancel</button>
          <button
            className="mbrd-confirm"
            type="button"
            disabled={confirmDisabled}
            onClick={() => onConfirm(submission)}
          >
            {submitting ? "Submitting…" : CONFIRM_LABELS[route]}
          </button>
        </div>
      </div>
    </div>
  );
}
