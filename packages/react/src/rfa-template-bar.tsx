"use client";
import { useState, type ReactElement } from "react";
import { RfaIdentitySelect } from "./rfa-identity-select";
import { RfaPicker } from "./rfa-official-fields";
import type { RfaDraftItemInput } from "./rfa-draft-form";
import { Checkbox } from "./form-controls";

/** A saved set of requested treatments. Diagnoses stay with the claim, so templates do not carry them. */
export type RfaTreatmentTemplate = {
  id: string; name: string; description?: string;
  /** Offered only for this requesting physician when set. */
  renderingProviderId?: string;
  items: RfaDraftItemInput[];
};
export type RfaTreatmentTemplateInput = Omit<RfaTreatmentTemplate, "id">;

/** The reusable part of a requested treatment: what is requested, never whose it is or when. */
export function rfaTemplateItems(items: RfaDraftItemInput[]): RfaDraftItemInput[] {
  return items.filter(item => item.serviceDescription.trim()).map(item => {
    const other = typeof item.metadata?.otherInformation === "string" ? item.metadata.otherInformation.trim() : "";
    return {
      diagnosisCode: "", serviceDescription: item.serviceDescription.trim(),
      ...(item.procedureCode?.trim() ? { procedureCode: item.procedureCode.trim() } : {}),
      ...(item.quantity !== undefined ? { quantity: item.quantity } : {}), ...(item.units !== undefined ? { units: item.units } : {}),
      ...(item.frequency?.trim() ? { frequency: item.frequency.trim() } : {}), ...(item.duration?.trim() ? { duration: item.duration.trim() } : {}),
      ...(other ? { metadata: { otherInformation: other } } : {}),
    };
  });
}

/** Fills the requested treatments from a template, keeping the diagnoses already on the request. */
export function applyRfaTemplate(template: RfaTreatmentTemplate, current: RfaDraftItemInput[]): RfaDraftItemInput[] {
  return template.items.map((item, index) => {
    const kept = current[index]?.diagnosisCode ? current[index]! : current[0];
    return { ...item, diagnosisCode: item.diagnosisCode || kept?.diagnosisCode || "", ...(item.diagnosisDescription || kept?.diagnosisDescription ? { diagnosisDescription: item.diagnosisDescription || kept!.diagnosisDescription! } : {}) };
  });
}

export function RfaTemplateBar({ templates, items, renderingProviderId, physicianName, disabled, onApply, onSave, onManage }: {
  templates: RfaTreatmentTemplate[]; items: RfaDraftItemInput[]; renderingProviderId: string; physicianName?: string | undefined; disabled?: boolean;
  onApply: (items: RfaDraftItemInput[]) => void;
  onSave?: ((template: RfaTreatmentTemplateInput) => void | Promise<void>) | undefined; onManage?: (() => void) | undefined;
}): ReactElement {
  const [query, setQuery] = useState(""); const [applied, setApplied] = useState("");
  const [saving, setSaving] = useState(false); const [name, setName] = useState("");
  const [mine, setMine] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const offered = templates.filter(template => !template.renderingProviderId || template.renderingProviderId === renderingProviderId);
  const reusable = rfaTemplateItems(items);
  const save = async () => {
    if (!onSave || !name.trim() || !reusable.length) return;
    setBusy(true); setError("");
    try {
      await onSave({ name: name.trim(), ...(mine && renderingProviderId ? { renderingProviderId } : {}), items: reusable });
      setSaving(false); setName(""); setMine(false);
    } catch { setError("The template could not be saved. Try again."); } finally { setBusy(false); }
  };
  return <div className="mbrfa-pickers" data-columns="1">
    <RfaPicker label="RFA template">
      <RfaIdentitySelect label="RFA template" placeholder={offered.length ? "Choose a template to fill the requested treatments" : "No templates yet"} searchPlaceholder="Search templates" query={query} onSearch={setQuery} searchable disabled={disabled || !offered.length} value={applied}
        options={offered.filter(template => template.id === applied || `${template.name} ${template.description ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())).map(template => ({ id: template.id, label: template.name, detail: template.description || `${template.items.length} requested treatment${template.items.length === 1 ? "" : "s"}` }))}
        onSelect={id => { const template = offered.find(item => item.id === id); if (!template) return; setQuery(""); setApplied(id); onApply(applyRfaTemplate(template, items)); }} />
      {saving ? <div className="mbrfa-template-save">
        <label><span>Template name</span><input autoFocus maxLength={120} value={name} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void save(); } }} /></label>
        {renderingProviderId ? <label className="mbrfa-check"><Checkbox checked={mine} onChange={event => setMine(event.target.checked)} /><span>Only for {physicianName || "this physician"}</span></label> : null}
        <div className="mbrfa-section-actions"><button type="button" className="mbtd-primary" disabled={busy || !name.trim()} onClick={() => void save()}>{busy ? "Saving…" : "Save template"}</button><button type="button" disabled={busy} onClick={() => { setSaving(false); setError(""); }}>Cancel</button>{error ? <span role="alert">{error}</span> : <span>Saves the {reusable.length} requested treatment{reusable.length === 1 ? "" : "s"} below, without the diagnosis.</span>}</div>
      </div> : <span className="mbrfa-picker-links">
        {onSave ? <button type="button" className="mbrfa-link" disabled={disabled || !reusable.length} title={reusable.length ? undefined : "Enter a requested treatment first"} onClick={() => setSaving(true)}>Save as template</button> : null}
        {onManage ? <button type="button" className="mbrfa-link" onClick={onManage}>Manage templates</button> : null}
      </span>}
    </RfaPicker>
  </div>;
}
