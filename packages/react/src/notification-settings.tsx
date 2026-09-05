"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactElement } from "react";
import { mindBillAppearanceStyle, type MindBillReactAppearance } from "./appearance";

export type NotificationAgingDay = 30 | 60 | 90;
export type NotificationPreferences = {
  enabled: boolean;
  statusUpdates: boolean;
  agingDays: NotificationAgingDay[];
  quietHours: boolean;
};

/** A projection from the host's authenticated server, not the raw administrative API. */
export type NotificationSettingsSnapshot = {
  preferences: NotificationPreferences | null;
  /** Display only. The server selects and verifies this address. */
  email: string;
  audience: "practice" | "assigned_bills";
  environment: "live" | "sandbox";
  canEnable: boolean;
};

/** Deliberately excludes identity, address, audience, verification and bill assignments. */
export type NotificationSettingsUpdate = NotificationPreferences & { consent: boolean };
export type NotificationSettingsAdapter = {
  load: () => Promise<NotificationSettingsSnapshot>;
  save: (update: NotificationSettingsUpdate) => Promise<NotificationSettingsSnapshot>;
  unsubscribe: () => Promise<NotificationSettingsSnapshot>;
};
export type NotificationSettingsProps = {
  /** Change on host user, practice or environment changes. Never an authorization credential. */
  identityKey: string;
  /** Memoize this adapter. Every method calls the host's authenticated server. */
  adapter: NotificationSettingsAdapter;
  appearance?: MindBillReactAppearance;
  className?: string;
  style?: CSSProperties;
  onSaved?: (snapshot: NotificationSettingsSnapshot) => void;
};

export function defaultNotificationPreferences(): NotificationPreferences {
  return { enabled: false, statusUpdates: false, agingDays: [], quietHours: true };
}

/** Allowlist the browser payload even when callers supply objects with extra properties. */
export function notificationSettingsUpdate(preferences: NotificationPreferences, consent: boolean): NotificationSettingsUpdate {
  return {
    enabled: preferences.enabled === true,
    statusUpdates: preferences.statusUpdates === true,
    agingDays: ([30, 60, 90] as const).filter(day => preferences.agingDays.includes(day)),
    quietHours: preferences.quietHours === true,
    consent: consent === true,
  };
}

export function notificationSettingsNeedsConsent(previous: NotificationPreferences | null, next: NotificationPreferences): boolean {
  if (!next.enabled) return false;
  if (!previous?.enabled || previous.statusUpdates !== next.statusUpdates || previous.quietHours !== next.quietHours) return true;
  return JSON.stringify(notificationSettingsUpdate(previous, false).agingDays) !== JSON.stringify(notificationSettingsUpdate(next, false).agingDays);
}

const css = `
.mbns{color:var(--mb-text);font-family:var(--mb-font);font-size:14px;line-height:1.5;min-width:0}.mbns *{box-sizing:border-box}.mbns h2,.mbns p{margin:0}.mbns-card{padding:24px;background:var(--mb-surface);border:1px solid var(--mb-border);border-radius:var(--mb-radius);box-shadow:var(--mb-shadow)}
.mbns-header{display:flex;gap:16px;align-items:flex-start;justify-content:space-between;margin-bottom:24px}.mbns h2{font-size:20px;line-height:1.3;font-weight:700}.mbns-muted{color:var(--mb-muted)}.mbns-header p{margin-top:6px;max-width:56ch}.mbns-badge{flex-shrink:0;background:var(--mb-soft);color:var(--mb-muted);padding:4px 9px;border-radius:var(--mb-control-radius);font-size:12px;font-weight:650}
.mbns-account{padding:14px 16px;background:var(--mb-soft);border-radius:var(--mb-control-radius);margin-bottom:20px;overflow-wrap:anywhere}.mbns-account strong{display:block;font-weight:650}.mbns-account p{margin-top:3px;font-size:13px}
.mbns-check{display:flex;gap:12px;align-items:flex-start;cursor:pointer;min-height:44px;padding:8px 0}.mbns-check input{flex-shrink:0;margin:3px 0 0;width:18px;height:18px;accent-color:var(--mb-accent)}.mbns-check strong{display:block;font-weight:650}.mbns-check small{display:block;color:var(--mb-muted);font-size:13px;margin-top:2px}.mbns fieldset{margin:14px 0 0;padding:16px 0 0;border:0;border-top:1px solid var(--mb-border);min-width:0}.mbns legend{padding:0 8px 0 0;font-size:13px;font-weight:650}.mbns-days{display:flex;flex-wrap:wrap;gap:8px 24px}.mbns-consent{border-top:1px solid var(--mb-border);margin-top:16px;padding-top:16px}.mbns-actions{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-top:24px;padding-top:20px;border-top:1px solid var(--mb-border)}
.mbns button{font:inherit;min-height:44px;padding:10px 16px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-surface);color:var(--mb-text);font-weight:650;cursor:pointer}.mbns button.mbns-save{background:var(--mb-accent);border-color:var(--mb-accent);color:var(--mb-accent-contrast)}.mbns button:disabled{opacity:.5;cursor:not-allowed}.mbns input:focus-visible,.mbns button:focus-visible{outline:2px solid var(--mb-accent);outline-offset:3px}.mbns-notice{margin-top:16px!important;color:var(--mb-muted)}.mbns-error{color:var(--mb-danger)}.mbns :disabled+span{opacity:.6}@media(max-width:540px){.mbns-card{padding:18px}.mbns-header{gap:8px}.mbns-actions button{flex:1 1 auto}.mbns-days{gap:4px 18px}}
`;

/** Drop into a host settings page. Identity changes remount and discard stale UI state. */
export function NotificationSettings(props: NotificationSettingsProps): ReactElement {
  return <NotificationSettingsSession key={props.identityKey} {...props} />;
}

/** The same connected, host-adapter surface; no permanent key or browser enrollment endpoint. */
export const ConnectedNotificationSettings = NotificationSettings;

function NotificationSettingsSession({ adapter, appearance, className, style, onSaved }: NotificationSettingsProps): ReactElement {
  const titleId = useId();
  const [snapshot, setSnapshot] = useState<NotificationSettingsSnapshot | null>(null);
  const [draft, setDraft] = useState(defaultNotificationPreferences);
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [notice, setNotice] = useState("");
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const request = useRef(0);

  useEffect(() => {
    const current = ++request.current;
    setPhase("loading");
    setSnapshot(null);
    setDraft(defaultNotificationPreferences());
    setConsent(false);
    setNotice("");
    setFailed(false);
    void Promise.resolve().then(() => adapter.load()).then(result => {
      if (current !== request.current) return;
      setSnapshot(result);
      setDraft(result.preferences ?? defaultNotificationPreferences());
      setPhase("ready");
    }).catch(() => {
      if (current !== request.current) return;
      setPhase("error");
    });
    return () => { request.current++; };
  }, [adapter, reload]);

  const needsConsent = notificationSettingsNeedsConsent(snapshot?.preferences ?? null, draft);
  const hasCategory = draft.statusUpdates || draft.agingDays.length > 0;
  const changed = JSON.stringify(notificationSettingsUpdate(draft, false)) !== JSON.stringify(notificationSettingsUpdate(snapshot?.preferences ?? defaultNotificationPreferences(), false));
  const busy = phase !== "ready";
  const canSave = !busy && changed && (!draft.enabled || (!!snapshot?.canEnable && hasCategory && (!needsConsent || consent)));

  const update = (value: Partial<NotificationPreferences>) => {
    setDraft(previous => ({ ...previous, ...value }));
    setConsent(false);
    setNotice("");
    setFailed(false);
  };
  const save = async (unsubscribe: boolean) => {
    if (busy || (!unsubscribe && !canSave)) return;
    const current = ++request.current;
    setPhase("saving");
    setNotice("");
    setFailed(false);
    try {
      const result = await (unsubscribe ? adapter.unsubscribe() : adapter.save(notificationSettingsUpdate(draft, consent)));
      if (current !== request.current) return;
      setSnapshot(result);
      setDraft(result.preferences ?? defaultNotificationPreferences());
      setConsent(false);
      setPhase("ready");
      setNotice(result.preferences?.enabled ? "Notification preferences saved." : "Email notifications are off.");
      // Consumer observers must not turn a confirmed server save into a retry prompt.
      try { onSaved?.(result); } catch { /* Persistence succeeded; host callback failures are separate. */ }
    } catch {
      if (current !== request.current) return;
      setPhase("ready");
      setFailed(true);
      setNotice("We couldn't confirm your changes. Retry, or reload settings to check their current state.");
    }
  };

  return <section className={`mbns ${className ?? ""}`} style={{ ...mindBillAppearanceStyle(appearance), ...style }} aria-labelledby={titleId} aria-busy={phase === "loading" || phase === "saving"}>
    <style>{css}</style>
    <div className="mbns-card">
      <header className="mbns-header"><div><h2 id={titleId}>Email notifications</h2><p className="mbns-muted">Choose which billing updates reach your inbox. Notifications are off until you opt in.</p></div><span className="mbns-badge">{!snapshot ? "—" : snapshot.preferences?.enabled ? "On" : "Off"}</span></header>
      {phase === "loading" ? <p role="status" className="mbns-muted">Loading notification preferences…</p> : phase === "error" ? <div><p role="alert" className="mbns-error">We couldn't load your preferences. No settings have been changed.</p><div className="mbns-actions"><button type="button" onClick={() => setReload(value => value + 1)}>Retry loading</button></div></div> : snapshot ? <>
        <div className="mbns-account"><strong>{snapshot.email || "No verified email address"}</strong><p className="mbns-muted">{snapshot.audience === "practice" ? "Updates for this practice's bills" : "Updates only for bills assigned to you"}. Your application manages this address and access.</p></div>
        {snapshot.environment === "sandbox" && <p className="mbns-notice">Sandbox preview only. No notification emails will be sent.</p>}
        {!snapshot.canEnable && <p className="mbns-notice">Notifications aren't available for this account yet. Ask your administrator to confirm email verification, billing access and notification availability. You can still turn existing notifications off.</p>}
        <label className="mbns-check"><input type="checkbox" checked={draft.enabled} disabled={busy || (!snapshot.canEnable && !draft.enabled)} onChange={event => update({ enabled: event.target.checked })} /><span><strong>Send me billing updates</strong><small>Emails contain a general alert, not patient details or attachments.</small></span></label>
        <fieldset disabled={busy || !draft.enabled || !snapshot.canEnable}><legend>Updates to receive</legend>
          <label className="mbns-check"><input type="checkbox" checked={draft.statusUpdates} onChange={event => update({ statusUpdates: event.target.checked })} /><span><strong>Bill status changes</strong><small>Follow accepted, rejected, processed and payment updates.</small></span></label>
          <p className="mbns-muted">Remind me when a bill is still waiting for a payer:</p><div className="mbns-days">{([30, 60, 90] as const).map(day => <label key={day} className="mbns-check"><input type="checkbox" checked={draft.agingDays.includes(day)} onChange={event => update({ agingDays: event.target.checked ? [...draft.agingDays, day] : draft.agingDays.filter(value => value !== day) })} /><span>{day} days</span></label>)}</div>
          <label className="mbns-check"><input type="checkbox" checked={draft.quietHours} onChange={event => update({ quietHours: event.target.checked })} /><span><strong>Quiet hours</strong><small>Hold emails from 7 pm to 7 am Pacific time.</small></span></label>
        </fieldset>
        {draft.enabled && !hasCategory && <p className="mbns-notice">Select at least one update type to enable notifications.</p>}
        {needsConsent && <label className="mbns-check mbns-consent"><input type="checkbox" checked={consent} disabled={busy || !snapshot.canEnable} onChange={event => setConsent(event.target.checked)} /><span>I agree to receive the selected billing emails {snapshot.audience === "practice" ? "for this practice" : "for bills assigned to me"} at the address above. I can unsubscribe at any time.</span></label>}
        <div className="mbns-actions"><button type="button" className="mbns-save" disabled={!canSave} onClick={() => void save(false)}>{phase === "saving" ? "Saving…" : "Save preferences"}</button>{snapshot.preferences?.enabled && <button type="button" disabled={busy} onClick={() => void save(true)}>Unsubscribe from all</button>}{failed && <button type="button" disabled={busy} onClick={() => setReload(value => value + 1)}>Reload settings</button>}</div>
        {notice && <p className={`mbns-notice ${failed ? "mbns-error" : ""}`} role={failed ? "alert" : "status"}>{notice}</p>}
      </> : null}
    </div>
  </section>;
}
