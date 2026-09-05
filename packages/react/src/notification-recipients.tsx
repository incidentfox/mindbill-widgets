"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactElement } from "react";
import { mindBillAppearanceStyle, type MindBillReactAppearance } from "./appearance";
import { defaultNotificationPreferences, notificationSettingsUpdate, type NotificationAgingDay } from "./notification-settings";

export type NotificationRecipientInvitation = {
  requestId: string;
  email: string;
  audience: "practice" | "assigned_bills";
  statusUpdates: boolean;
  agingDays: NotificationAgingDay[];
  quietHours: boolean;
};
export type NotificationRecipient = Omit<NotificationRecipientInvitation, "requestId"> & {
  externalUserId: string;
  enabled: boolean;
  state: "active" | "pending_confirmation" | "expired" | "off" | "unavailable";
  assignedBillCount: number;
  deliveryStatus?: "sending" | "sent" | "unknown" | "sandbox_preview" | "suppressed";
};
export type NotificationRecipientsSnapshot = {
  available: boolean;
  environment: "live" | "sandbox";
  recipients: NotificationRecipient[];
  hasMore: boolean;
};
/** Every operation goes through the host's authenticated, practice-admin server. */
export type NotificationRecipientsAdapter = {
  load: (offset: number) => Promise<NotificationRecipientsSnapshot>;
  /** The host resolves a stable opaque recipient ID, never treats an email as bill access. */
  invite: (input: NotificationRecipientInvitation) => Promise<{ deliveryStatus: string }>;
  disable: (externalUserId: string) => Promise<void>;
};
export type NotificationRecipientsSettingsProps = {
  identityKey: string;
  adapter: NotificationRecipientsAdapter;
  appearance?: MindBillReactAppearance;
  className?: string;
  style?: CSSProperties;
};

/** No consent, enabled flag, verification timestamp or tenant identity is emitted. */
export function notificationRecipientInvitation(input: Omit<NotificationRecipientInvitation, "requestId">, requestId: string): NotificationRecipientInvitation {
  const preferences = notificationSettingsUpdate({ ...input, enabled: false }, false);
  return { requestId, email: input.email.trim().toLowerCase(), audience: input.audience,
    statusUpdates: preferences.statusUpdates, agingDays: preferences.agingDays, quietHours: preferences.quietHours };
}

const css = `
.mbnr{font:14px/1.5 var(--mb-font);color:var(--mb-text);min-width:0}.mbnr *{box-sizing:border-box}.mbnr h2,.mbnr h3,.mbnr p{margin:0}.mbnr h2{font-size:20px}.mbnr h3{font-size:15px}.mbnr-card{border:1px solid var(--mb-border);border-radius:var(--mb-radius);background:var(--mb-surface);padding:24px}.mbnr header{display:flex;gap:16px;justify-content:space-between;align-items:start;margin-bottom:24px}.mbnr-muted{color:var(--mb-muted)}.mbnr header p{margin-top:6px;max-width:65ch}.mbnr-badge{background:var(--mb-soft);padding:4px 9px;border-radius:var(--mb-control-radius);white-space:nowrap;font-size:12px}.mbnr-form{display:grid;gap:16px;padding:20px;background:var(--mb-soft);border-radius:var(--mb-control-radius)}.mbnr-fields{display:grid;grid-template-columns:1fr 1fr;gap:16px}.mbnr label{display:block}.mbnr label>span{display:block;font-weight:600;margin-bottom:6px}.mbnr input[type=email],.mbnr select{width:100%;min-height:44px;background:var(--mb-surface);color:var(--mb-text);font:inherit;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);padding:10px 12px}.mbnr-check{display:flex!important;gap:10px;align-items:center;min-height:36px}.mbnr input[type=checkbox]{width:17px;height:17px;accent-color:var(--mb-accent)}.mbnr fieldset{border:0;margin:0;padding:0;min-width:0}.mbnr legend{font-weight:600;margin-bottom:6px}.mbnr-days{display:flex;gap:20px;flex-wrap:wrap}.mbnr button{font:inherit;font-weight:600;min-height:44px;padding:10px 14px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-surface);color:var(--mb-text);cursor:pointer}.mbnr button:disabled{opacity:.5;cursor:not-allowed}.mbnr button.mbnr-primary{background:var(--mb-accent);border-color:var(--mb-accent);color:var(--mb-accent-contrast)}.mbnr :is(input,button,select):focus-visible{outline:2px solid var(--mb-accent);outline-offset:3px}.mbnr-actions{display:flex;gap:12px;flex-wrap:wrap;align-items:center}.mbnr-list{margin-top:28px;display:grid;gap:12px}.mbnr-recipient{border-top:1px solid var(--mb-border);padding-top:16px;display:flex;gap:16px;justify-content:space-between;align-items:start}.mbnr-email{overflow-wrap:anywhere;font-weight:600}.mbnr-state{display:flex;gap:10px;align-items:center;flex-shrink:0}.mbnr-error{color:var(--mb-danger)}.mbnr-notice{margin-top:16px!important}.mbnr-pagination{margin-top:20px}.mbnr-empty{padding:20px 0;color:var(--mb-muted)}@media(max-width:600px){.mbnr-card{padding:18px}.mbnr-form{padding:16px}.mbnr-fields{grid-template-columns:1fr}.mbnr-recipient{flex-direction:column}.mbnr-state{width:100%;justify-content:space-between}.mbnr header{flex-wrap:wrap}}
`;

/** Administrative recipient invitations, distinct from a user's own NotificationSettings. */
export function NotificationRecipientsSettings(props: NotificationRecipientsSettingsProps): ReactElement {
  return <RecipientSettingsSession key={props.identityKey} {...props} />;
}
export const ConnectedNotificationRecipientsSettings = NotificationRecipientsSettings;

function RecipientSettingsSession({ adapter, appearance, className, style }: NotificationRecipientsSettingsProps): ReactElement {
  const titleId = useId();
  const [snapshot, setSnapshot] = useState<NotificationRecipientsSnapshot | null>(null);
  const [email, setEmail] = useState("");
  const [audience, setAudience] = useState<"practice" | "assigned_bills">("assigned_bills");
  const [preferences, setPreferences] = useState(defaultNotificationPreferences);
  const [offset, setOffset] = useState(0);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState("");
  const [failed, setFailed] = useState(false);
  const [hasReceipt, setHasReceipt] = useState(false);
  const generation = useRef(0);
  // Retain request ID after uncertain transport failures; retry cannot duplicate an email.
  const pending = useRef<{ payload: string; id: string } | null>(null);

  useEffect(() => {
    const current = ++generation.current;
    setBusy(true);
    setSnapshot(null);
    void Promise.resolve().then(() => adapter.load(offset)).then(result => {
      if (current !== generation.current) return;
      setSnapshot(result); setBusy(false);
    }).catch(() => {
      if (current !== generation.current) return;
      setBusy(false); setFailed(true); setNotice("Could not load recipients. No settings have been changed.");
    });
    return () => { generation.current++; };
  }, [adapter, offset, reload]);

  async function mutate(action: () => Promise<string>, invitation = false) {
    if (busy) return;
    const current = ++generation.current;
    setBusy(true); setNotice(""); setFailed(false);
    try {
      const message = await action();
      if (current !== generation.current) return;
      if (invitation) setHasReceipt(true);
      setNotice(message);
      setReload(value => value + 1);
    } catch {
      if (current !== generation.current) return;
      setBusy(false); setFailed(true);
      setNotice("We couldn't confirm the request. Retry unchanged to check the same invitation, or reload recipients. Do not assume an email was sent.");
    }
  }

  const canInvite = !busy && !!snapshot?.available && !!email.trim() && (preferences.statusUpdates || preferences.agingDays.length > 0);
  return <section className={`mbnr ${className ?? ""}`} style={{ ...mindBillAppearanceStyle(appearance), ...style }} aria-labelledby={titleId} aria-busy={busy}>
    <style>{css}</style><div className="mbnr-card">
      <header><div><h2 id={titleId}>Notification recipients</h2><p className="mbnr-muted">Add any email address for billing alerts. No MindBill console account is needed. Notifications stay off until the recipient confirms.</p></div><span className="mbnr-badge">Default off</span></header>
      {snapshot?.environment === "sandbox" && <p className="mbnr-notice mbnr-muted">Sandbox preview. No emails are sent.</p>}
      {snapshot && !snapshot.available && <p className="mbnr-notice mbnr-muted">Email invitations are not available yet. Existing notifications can still be disabled.</p>}
      <form className="mbnr-form" onSubmit={event => {
        event.preventDefault();
        if (!canInvite) return;
        const input = notificationRecipientInvitation({ email, audience, ...preferences }, "");
        const payload = JSON.stringify(input);
        if (pending.current?.payload !== payload) pending.current = { payload, id: crypto.randomUUID() };
        const requestId = pending.current.id;
        void mutate(async () => {
          const result = await adapter.invite({ ...input, requestId });
          // Keep the receipt even after success, so repeated clicks remain the same request.
          return result.deliveryStatus === "sandbox_preview" ? "Sandbox invitation prepared. Notifications remain off until recipient confirmation."
            : result.deliveryStatus === "sent" ? "Invitation sent. Notifications remain off until the recipient confirms."
            : "Invitation recorded, but email delivery is not confirmed. Notifications remain off. Reload recipients before requesting a new invitation.";
        }, true);
      }}>
        <div className="mbnr-fields"><label><span>Recipient email</span><input type="email" autoComplete="email" required maxLength={254} value={email} disabled={busy || !snapshot?.available} placeholder="doctor@example.com" onChange={event => setEmail(event.target.value)} /></label>
          <label><span>Billing access scope</span><select value={audience} disabled={busy || !snapshot?.available} onChange={event => setAudience(event.target.value as typeof audience)}><option value="assigned_bills">Assigned bills only</option><option value="practice">All bills in this practice</option></select></label></div>
        <p className="mbnr-muted">{audience === "assigned_bills" ? "Your application must assign bills on the server. Without assignments, this recipient receives no alerts." : "The invitation asks for alerts about all bills in this practice, including future bills."} This does not grant access to the app.</p>
        <fieldset disabled={busy || !snapshot?.available}><legend>Alerts to request</legend>
          <label className="mbnr-check"><input type="checkbox" checked={preferences.statusUpdates} onChange={event => setPreferences(value => ({ ...value, statusUpdates: event.target.checked }))} />Bill status and payment updates</label>
          <p className="mbnr-muted">Reminders while a bill waits for a payer:</p><div className="mbnr-days">{([30,60,90] as const).map(day => <label className="mbnr-check" key={day}><input type="checkbox" checked={preferences.agingDays.includes(day)} onChange={event => setPreferences(value => ({ ...value, agingDays: event.target.checked ? [...value.agingDays, day] : value.agingDays.filter(item => item !== day) }))} />{day} days</label>)}</div>
          <label className="mbnr-check"><input type="checkbox" checked={preferences.quietHours} onChange={event => setPreferences(value => ({ ...value, quietHours: event.target.checked }))} />Quiet hours · 7 pm–7 am Pacific</label>
        </fieldset>
        <p className="mbnr-muted">Emails contain general alerts, not patient details, reports or attachments. The recipient reviews these choices and can unsubscribe at any time.</p>
        <div className="mbnr-actions"><button type="submit" className="mbnr-primary" disabled={!canInvite}>{busy ? "Please wait…" : "Send confirmation invitation"}</button>{hasReceipt && <button type="button" disabled={busy} onClick={() => {
          pending.current = null; setHasReceipt(false); setEmail(""); setPreferences(defaultNotificationPreferences());
          setNotice("New invitation form. Reinviting the same recipient replaces their previous confirmation link and turns notifications off until they confirm again.");
        }}>Start another invitation</button>}</div>
      </form>
      {notice && <p className={`mbnr-notice ${failed ? "mbnr-error" : "mbnr-muted"}`} role={failed ? "alert" : "status"}>{notice}</p>}
      <div className="mbnr-list"><h3>Recipients</h3>
        {!snapshot && busy ? <p role="status">Loading recipients…</p> : snapshot?.recipients.length === 0 ? <p className="mbnr-empty">No recipients yet. Nothing is sent until someone accepts an invitation.</p> : snapshot?.recipients.map(recipient => <div className="mbnr-recipient" key={recipient.externalUserId}><div><p className="mbnr-email">{recipient.email}</p><p className="mbnr-muted">{recipient.audience === "practice" ? "Practice-wide" : `${recipient.assignedBillCount} assigned bills`} · {recipient.statusUpdates ? "Status and payment updates" : "Reminders only"}{recipient.agingDays.length ? ` · ${recipient.agingDays.join(" / ")} day reminders` : ""}</p>{recipient.deliveryStatus === "unknown" && <p className="mbnr-muted">Invitation delivery unconfirmed. No automatic resend.</p>}</div><div className="mbnr-state"><span className="mbnr-badge">{{ active: "On", pending_confirmation: "Pending confirmation · off", expired: "Invitation expired · off", off: "Off", unavailable: "Delivery unavailable" }[recipient.state]}</span>{recipient.state !== "off" && <button type="button" disabled={busy} onClick={() => void mutate(async () => { await adapter.disable(recipient.externalUserId); return "Notifications disabled and pending invitations revoked."; })}>Disable</button>}</div></div>)}
      </div>
      <div className="mbnr-actions mbnr-pagination"><button type="button" disabled={busy} onClick={() => { setNotice(""); setFailed(false); setReload(value => value + 1); }}>Reload recipients</button>{offset > 0 && <button type="button" disabled={busy} onClick={() => setOffset(value => Math.max(0,value-100))}>Previous</button>}{snapshot?.hasMore && <button type="button" disabled={busy} onClick={() => setOffset(value => value+100)}>Next</button>}</div>
    </div>
  </section>;
}
