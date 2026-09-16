"use client";

import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import {
  createOrganizationClient,
  type OrganizationClaimsAdministrator,
  type OrganizationClaimsAdministratorInput,
  type OrganizationTeam,
  type OrganizationTeamRole,
} from "@mindbill/browser";
import { mindBillAppearanceStyle } from "./appearance";
import type { OrganizationOnboardingProps } from "./organization-onboarding";

const blank = (): OrganizationClaimsAdministratorInput => ({ name: "", fax: "", email: "", mailingAddress: "", notes: "" });
const css = `
.mbad{font:14px/1.5 var(--mb-font-family,system-ui);color:var(--mb-text,#172033);border:1px solid var(--mb-border,#dce2ea);border-radius:12px;padding:24px;background:var(--mb-surface,#fff)}
.mbad h2{margin:0 0 6px;font-size:20px}.mbad p{color:var(--mb-text-muted,#596579)}
.mbad-grid{display:grid;grid-template-columns:minmax(180px,1fr) minmax(240px,2fr);gap:24px}.mbad-list{display:flex;flex-direction:column;gap:8px;align-items:stretch}.mbad button,.mbad select,.mbad input,.mbad textarea{font:inherit;box-sizing:border-box;max-width:100%;border:1px solid var(--mb-border,#dce2ea);border-radius:6px;padding:8px 10px;background:var(--mb-surface,#fff);color:inherit}
.mbad button{cursor:pointer}.mbad button[aria-pressed=true]{border-color:var(--mb-primary,#3155d9);background:var(--mb-surface-alt,#eef2ff)}.mbad button:disabled{opacity:.55;cursor:default}.mbad label{display:flex;flex-direction:column;gap:4px;margin:0 0 14px}.mbad input,.mbad textarea,.mbad select{width:100%}.mbad-actions{display:flex;gap:8px;flex-wrap:wrap}.mbad .mbad-primary{background:var(--mb-primary,#3155d9);color:#fff;border-color:transparent}.mbad [role=alert]{color:var(--mb-danger,#a52222);margin:12px 0}.mbad-member{border-top:1px solid var(--mb-border,#dce2ea);padding:16px 0;display:grid;grid-template-columns:minmax(160px,2fr) minmax(130px,1fr) auto;gap:16px;align-items:center}.mbad-member small{display:block;overflow-wrap:anywhere}.mbad-member label{margin:0}.mbad button:focus-visible,.mbad input:focus-visible,.mbad select:focus-visible,.mbad textarea:focus-visible{outline:2px solid var(--mb-primary,#3155d9);outline-offset:2px}
@media(max-width:640px){.mbad{padding:16px}.mbad-grid,.mbad-member{grid-template-columns:1fr}}
`;

type Props = Omit<OrganizationOnboardingProps, "variant"> & { section: "team" | "claims" };

export function OrganizationAdministration({ section, sessionEndpoint, getSession, apiBaseUrl, fetch: fetcher, appearance, className = "", style, onError }: Props): ReactElement {
  const client = useMemo(() => createOrganizationClient({ ...(sessionEndpoint ? { sessionEndpoint } : {}), ...(getSession ? { getSession } : {}), ...(apiBaseUrl ? { apiBaseUrl } : {}), ...(fetcher ? { fetch: fetcher } : {}) }), [sessionEndpoint, getSession, apiBaseUrl, fetcher]);
  const connection = useMemo(() => ({ client, section }), [client, section]);
  const current = useRef(connection);
  current.current = connection;
  const errorHandler = useRef(onError);
  errorHandler.current = onError;
  const [loaded, setLoaded] = useState<typeof connection | null>(null);
  const [team, setTeam] = useState<OrganizationTeam | null>(null);
  const [administrators, setAdministrators] = useState<OrganizationClaimsAdministrator[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(null); setTeam(null); setAdministrators([]); setError(""); setNotice(""); setBusy(false); setSelected(null); setDraft(blank()); setConfirmDelete(false);
    const pending = section === "team" ? client.getTeam().then(set => { if (!cancelled) setTeam(set); }) : client.getClaimsAdministrators().then(rows => { if (!cancelled) setAdministrators(rows); });
    pending.then(() => { if (!cancelled) setLoaded(connection); }).catch((cause: unknown) => {
      if (cancelled) return;
      const problem = cause instanceof Error ? cause : new Error("Settings could not be loaded.");
      setError(problem.message); errorHandler.current?.(problem);
    });
    return () => { cancelled = true; };
  }, [client, section, connection, retry]);

  async function mutate(operation: () => Promise<void>) {
    if (busy) return;
    const started = connection;
    setBusy(true); setError(""); setNotice("");
    try { await operation(); if (current.current === started) setNotice("Saved to MindBill."); }
    catch (cause) { if (current.current !== started) return; const problem = cause instanceof Error ? cause : new Error("The change could not be saved."); setError(problem.message); errorHandler.current?.(problem); }
    finally { if (current.current === started) setBusy(false); }
  }
  const pick = (row?: OrganizationClaimsAdministrator) => {
    setSelected(row?.id ?? null); setDraft(row ? { name: row.name, fax: row.fax ?? "", email: row.email ?? "", mailingAddress: row.mailingAddress ?? "", notes: row.notes ?? "" } : blank()); setConfirmDelete(false); setNotice("");
  };
  const saveAdministrator = () => mutate(async () => {
    const saved = selected ? await client.updateClaimsAdministrator(selected, draft) : await client.createClaimsAdministrator(draft);
    if (current.current !== connection) return;
    setAdministrators(rows => [...rows.filter(row => row.id !== saved.id), saved]); pick(saved);
  });
  const removeAdministrator = () => mutate(async () => {
    if (!selected) return;
    await client.deleteClaimsAdministrator(selected);
    if (current.current !== connection) return;
    setAdministrators(rows => rows.filter(row => row.id !== selected)); pick();
  });
  const field = (key: keyof OrganizationClaimsAdministratorInput, label: string, multiline = false) => <label key={key}>{label}{multiline ? <textarea disabled={busy} value={draft[key] ?? ""} onChange={event => setDraft(value => ({ ...value, [key]: event.target.value }))} /> : <input disabled={busy} type={key === "email" ? "email" : "text"} value={draft[key] ?? ""} onChange={event => setDraft(value => ({ ...value, [key]: event.target.value }))} />}</label>;

  return <section className={`mbad ${className}`.trim()} style={{ ...mindBillAppearanceStyle(appearance), ...style }}>
    <style>{css}</style>
    <h2>{section === "team" ? "Team" : "Claims administrators"}</h2>
    <p>{section === "team" ? "Manage existing MindBill accounts. These roles do not change permissions in your partner application. Adding accounts is handled in MindBill." : "Add administrators missing from the shared directory. Saved administrators are available when creating claims and bills for this organization."}</p>
    {error ? <div role="alert">{error}{loaded !== connection ? <> <button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button><p>{section === "team" ? "Team access requires a separate team management permission. Ask your administrator to enable it." : "Organization management access is required."}</p></> : null}</div> : null}
    {loaded !== connection ? (!error ? <p role="status">Loading settings…</p> : null) : section === "team" ? <>
      {team?.members.length === 0 ? <p>No MindBill accounts are assigned to this organization.</p> : null}
      {team?.members.map(member => <div className="mbad-member" key={member.id}>
        <div><strong>{member.name || member.email}</strong><small>{member.email}</small><small>{member.active ? "Active" : "Inactive"}{!member.canManage ? " · Protected account" : ""}</small></div>
        <label>Role for {member.name || member.email}<select aria-label={`Role for ${member.name || member.email}`} value={member.role} disabled={busy || !team.capabilities.canManage || !member.canManage} onChange={event => { const role = event.target.value as OrganizationTeamRole; void mutate(async () => { const saved = await client.updateTeamMember(member.id, { role }); if (current.current === connection) setTeam(value => value ? { ...value, members: value.members.map(row => row.id === saved.id ? saved : row) } : value); }); }}>
          {!team.roles.some(role => role.id === member.role) ? <option value={member.role}>{member.role}</option> : null}
          {team.roles.map(role => <option key={role.id} value={role.id}>{role.label}</option>)}
        </select></label>
        <button type="button" disabled={busy || !team.capabilities.canManage || !member.canManage} onClick={() => void mutate(async () => { const saved = await client.updateTeamMember(member.id, { active: !member.active }); if (current.current === connection) setTeam(value => value ? { ...value, members: value.members.map(row => row.id === saved.id ? saved : row) } : value); })}>{member.active ? "Deactivate" : "Reactivate"}</button>
      </div>)}
    </> : <div className="mbad-grid">
      <div className="mbad-list"><button type="button" disabled={busy} aria-pressed={selected === null} onClick={() => pick()}>+ Add claims administrator</button>{administrators.filter(row => row.active).map(row => <button type="button" disabled={busy} aria-pressed={selected === row.id} key={row.id} onClick={() => pick(row)}>{row.name}</button>)}</div>
      <form onSubmit={event => { event.preventDefault(); void saveAdministrator(); }}>
        {field("name", "Administrator name")}{field("fax", "Fax")}{field("email", "Email")}{field("mailingAddress", "Mailing address", true)}{field("notes", "Notes", true)}
        <p>Provide at least one delivery method: fax, email, or mailing address.</p>
        <div className="mbad-actions"><button className="mbad-primary" type="submit" disabled={busy || !draft.name.trim() || ![draft.fax, draft.email, draft.mailingAddress].some(value => value?.trim())}>{busy ? "Saving…" : "Save claims administrator"}</button>{selected ? <button type="button" disabled={busy} onClick={() => setConfirmDelete(true)}>Remove administrator</button> : null}</div>
        {confirmDelete ? <div><p>Remove this administrator from future selections? Existing bills keep their saved details.</p><div className="mbad-actions"><button disabled={busy} type="button" onClick={() => void removeAdministrator()}>Confirm removal</button><button disabled={busy} type="button" onClick={() => setConfirmDelete(false)}>Cancel</button></div></div> : null}
      </form>
    </div>}
    {notice ? <p role="status">{notice}</p> : null}
  </section>;
}
