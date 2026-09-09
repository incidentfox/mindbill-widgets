import '@angular/compiler';
import { ChangeDetectorRef, Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import type { RfaRecord, RfaDraftInput, RfaWorkflowClient, RfaSigningPreview } from '../packages/browser/src/index';
import { canEditRfa, rfaRecordDraft, rfaEditInput, validateRfaDecision, validateRfaTransmission } from '../packages/angular/src/lib/rfa-workflow-state';
import { MindBillConnectedRfaComponent } from '../packages/angular/src/lib/connected-rfa.component';
import { MindBillRfaAuthorizationDestinationComponent } from '../packages/angular/src/lib/rfa-authorization-destination.component';
import { RfaDraftFormComponent } from '../packages/angular/src/lib/rfa-draft-form.component';

const draft: RfaDraftInput = { claimId: 'claim_synthetic', patientId: 'patient_synthetic', renderingProviderId: 'provider_synthetic', employeeName: 'Demo Patient', providerName: 'Demo Physician', externalId: 'request_synthetic', items: [{ diagnosisCode: 'M25.531', serviceDescription: 'Office visit', procedureCode: '99213' }] };
function record(overrides: Partial<RfaRecord> = {}): RfaRecord { return { ...draft, id: 'rfa_synthetic', status: 'draft', contentRevision: 1, items: [{ ...draft.items[0]!, id: 'item_synthetic', ordinal: 1, outcome: 'pending' }], documents: [], transmissions: [], readiness: { ready: false, missing: [] }, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z', events: [], ...overrides }; }
const injector = Injector.create({ providers: [{ provide: ChangeDetectorRef, useValue: { markForCheck: vi.fn() } }] });
function instance<T>(factory: () => T) { return runInInjectionContext(injector, factory); }
function client(overrides: Partial<RfaWorkflowClient> = {}): RfaWorkflowClient { return { clearSession: vi.fn(), list: vi.fn(async () => ({ data: [], nextCursor: null })), get: vi.fn(async () => record()), create: vi.fn(async () => record()), updateDraft: vi.fn(async () => record()), getDirectory: vi.fn(), ...overrides } as unknown as RfaWorkflowClient; }
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }

describe('native Angular RFA workflow', () => {
  it('retains item IDs and strips lifecycle fields / immutable edit identities', () => {
    const original = record({ signedAt: '2026-09-02T00:00:00Z' });
    const projected = rfaRecordDraft(original);
    expect(projected.items[0]?.id).toBe('item_synthetic'); expect(projected).not.toHaveProperty('signedAt');
    const editable = rfaEditInput(projected, 3);
    expect(editable.expectedRevision).toBe(3); expect(editable).not.toHaveProperty('claimId'); expect(editable).not.toHaveProperty('externalId');
    expect(editable.items[0]).not.toHaveProperty('externalId');
    expect(canEditRfa(original)).toBe(false); expect(canEditRfa(record({ status: 'submitted' }))).toBe(false); expect(canEditRfa(record())).toBe(true);
  });
  it('requires actual transmission evidence and receipt chronology', () => {
    expect(validateRfaTransmission({ direction: 'outbound', channel: 'fax', status: 'sent', occurredAt: '' })).toMatch(/actual event/);
    expect(validateRfaTransmission({ direction: 'outbound', channel: 'fax', status: 'sent', occurredAt: '2026-09-02', destination: '+14155550100' })).toMatch(/evidence/);
    expect(validateRfaTransmission({ direction: 'inbound', channel: 'fax', status: 'received', occurredAt: '2026-09-02', providerMessageId: 'receipt_synthetic' })).toMatch(/receipt time/);
  });
  it('never invents an approval or accepts a denial without supporting response', () => {
    expect(validateRfaDecision({ decidedAt: '2026-09-02', responseDocumentId: 'doc_synthetic', decisions: [] })).toMatch(/at least one/);
    expect(validateRfaDecision({ decidedAt: '2026-09-02', responseDocumentId: 'doc_synthetic', decisions: [{ itemId: 'item_synthetic', outcome: 'approved' }] })).toMatch(/authorization number/);
    expect(validateRfaDecision({ decidedAt: '2026-09-02', responseDocumentId: 'doc_synthetic', decisions: [{ itemId: 'item_synthetic', outcome: 'denied' }] })).toMatch(/IMR/);
  });
  it('reconciles a request by stable external ID across all claim list pages', async () => {
    const workflow = client({ list: vi.fn().mockResolvedValueOnce({ data: [record({ id: 'other', externalId: 'other' })], nextCursor: 'next' }).mockResolvedValueOnce({ data: [record()], nextCursor: null }) });
    const component = instance(() => new MindBillConnectedRfaComponent()); component.initialDraft = draft; component.client = workflow; component.ngOnChanges(); await settle();
    expect(component.record?.id).toBe('rfa_synthetic'); expect(workflow.list).toHaveBeenCalledTimes(2); expect(workflow.create).not.toHaveBeenCalled();
  });
  it('blocks duplicate writes after an ambiguous save and reuses the host create key', async () => {
    const workflow = client({ create: vi.fn().mockRejectedValue(new Error('Connection lost')) });
    const component = instance(() => new MindBillConnectedRfaComponent()); component.initialDraft = draft; component.client = workflow; component.createIdempotencyKey = 'stable-request-synthetic'; component.ngOnChanges(); await settle();
    await expect(component.saveDraft(draft)).rejects.toThrow('Connection lost');
    expect(component.reconcileRequired).toBe(true);
    await expect(component.saveDraft(draft)).rejects.toThrow('Reload');
    expect(workflow.create).toHaveBeenCalledTimes(1); expect(workflow.create).toHaveBeenCalledWith(draft, { idempotencyKey: 'stable-request-synthetic' });
  });
  it('ignores a stale load after switching cases', async () => {
    let complete!: (value: { data: RfaRecord[]; nextCursor: null }) => void;
    const workflow = client({ list: vi.fn().mockReturnValueOnce(new Promise(resolve => { complete = resolve; })).mockResolvedValue({ data: [], nextCursor: null }) });
    const component = instance(() => new MindBillConnectedRfaComponent()); component.client = workflow; component.initialDraft = draft; component.ngOnChanges();
    component.initialDraft = { ...draft, claimId: 'claim_other', externalId: 'request_other' }; component.ngOnChanges(); await settle(); complete({ data: [record()], nextCursor: null }); await settle();
    expect(component.record).toBeNull(); expect(component.draft?.claimId).toBe('claim_other');
  });
  it('does not carry a manual destination confirmation into another case or changed number', () => {
    const component = new MindBillRfaAuthorizationDestinationComponent(); component.contextKey = 'case_one'; component.ngOnChanges(); component.choose('manual'); component.setManualFax('+14155550100'); component.confirmManual(true);
    expect(component.selected?.destination).toBe('+14155550100'); component.setManualFax('+14155550101'); expect(component.selected).toBeNull(); component.confirmManual(true); component.contextKey = 'case_two'; component.ngOnChanges(); expect(component.selected).toBeNull(); expect(component.manualConfirmed).toBe(false);
  });
  it('does not emit a saved draft from the previous case', async () => {
    let complete!: () => void;
    const component = instance(() => new RfaDraftFormComponent()); component.initialDraft = draft; component.onSave = () => new Promise<void>(resolve => { complete = resolve; }); component.ngOnChanges(); const saved = vi.fn(); component.saved.subscribe(saved);
    const pending = component.save(); component.initialDraft = { ...draft, claimId: 'claim_other' }; component.ngOnChanges(); complete(); await pending;
    expect(saved).not.toHaveBeenCalled(); expect(component.success).toBe(false);
  });
  it('requires saved content, matching exact preview, and explicit physician authorization before sign', async () => {
    const workflow = client({ sign: vi.fn(async () => record({ signedAt: '2026-09-02T00:00:00Z' })) });
    const component = instance(() => new MindBillConnectedRfaComponent()); component.initialDraft = draft; component.client = workflow; component.actorReference = 'actor_synthetic'; component.ngOnChanges(); await settle();
    component.record = record(); component.preview = { id: 'snapshot_synthetic', contentHash: 'hash_synthetic', contentRevision: 1, renderingProviderId: draft.renderingProviderId, previewDocumentId: 'preview_synthetic', expiresAt: '2099-01-01T00:00:00Z' };
    await component.sign(); expect(workflow.sign).not.toHaveBeenCalled();
    component.previewReviewed = true; component.dirty = true; await component.sign(); expect(workflow.sign).not.toHaveBeenCalled();
    component.dirty = false; component.preview.contentRevision = 2; await component.sign(); expect(workflow.sign).not.toHaveBeenCalled();
    component.preview.contentRevision = 1; await component.sign(); expect(workflow.sign).toHaveBeenCalledWith('rfa_synthetic', expect.objectContaining({ snapshotId: 'snapshot_synthetic', contentHash: 'hash_synthetic', physicianAuthorized: true, actorReference: 'actor_synthetic' }), expect.any(Object));
  });
  it('does not request an old case preview document after context changes', async () => {
    let complete!: (preview: { id: string; contentHash: string; contentRevision: number; renderingProviderId: string; previewDocumentId: string; expiresAt: string }) => void;
    const workflow = client({ signingPreview: vi.fn(() => new Promise<RfaSigningPreview>(resolve => { complete = resolve; })), downloadDocument: vi.fn() });
    const component = instance(() => new MindBillConnectedRfaComponent()); component.initialDraft = draft; component.client = workflow; component.ngOnChanges(); await settle();
    component.record = record(); component.diagnosisDescriptions['item_synthetic'] = 'Right wrist pain'; const pending = component.preparePreview();
    component.initialDraft = { ...draft, claimId: 'claim_other' }; component.ngOnChanges();
    complete({ id: 'snapshot_synthetic', contentHash: 'hash_synthetic', contentRevision: 1, renderingProviderId: draft.renderingProviderId, previewDocumentId: 'preview_synthetic', expiresAt: '2099-01-01T00:00:00Z' }); await pending;
    expect(workflow.downloadDocument).not.toHaveBeenCalled(); expect(component.preview).toBeNull();
  });

  it('loads and attaches a host document only on an explicit action using the current revision', async () => {
    const workflow = client({ list: vi.fn(async () => ({ data: [record({ contentRevision: 4 })], nextCursor: null })), uploadDocument: vi.fn(async () => record({ contentRevision: 4 })) });
    const pdf = new Blob(['%PDF-1.4 synthetic fixture'], { type: 'application/pdf' });
    const source = { id: 'source_synthetic', label: 'Case report', filename: 'report.pdf', documentType: 'clinical_report' as const, loadBlob: vi.fn(async () => pdf) };
    const component = instance(() => new MindBillConnectedRfaComponent()); component.initialDraft = draft; component.client = workflow; component.sourceDocuments = [source]; component.ngOnChanges(); await settle();
    expect(source.loadBlob).not.toHaveBeenCalled(); expect(workflow.uploadDocument).not.toHaveBeenCalled();
    await component.attachSource(source);
    expect(source.loadBlob).toHaveBeenCalledTimes(1);
    expect(workflow.uploadDocument).toHaveBeenCalledWith('rfa_synthetic', { file: pdf, filename: 'report.pdf', documentType: 'clinical_report', contentRevision: 4 }, expect.objectContaining({ idempotencyKey: expect.any(String) }));
  });
  it('never uploads a host document after switching cases while its bytes load', async () => {
    let complete!: (blob: Blob) => void;
    const workflow = client({ uploadDocument: vi.fn() });
    const source = { id: 'source_synthetic', label: 'Case report', filename: 'report.pdf', documentType: 'clinical_report' as const, loadBlob: vi.fn(() => new Promise<Blob>(resolve => { complete = resolve; })) };
    const component = instance(() => new MindBillConnectedRfaComponent()); component.initialDraft = draft; component.client = workflow; component.sourceDocuments = [source]; component.ngOnChanges(); await settle(); component.record = record();
    const pending = component.attachSource(source);
    component.initialDraft = { ...draft, claimId: 'claim_other' }; component.ngOnChanges(); await settle();
    complete(new Blob(['%PDF-1.4 synthetic fixture'])); await pending;
    expect(workflow.uploadDocument).not.toHaveBeenCalled(); expect(component.record).toBeNull(); expect(component.reconcileRequired).toBe(false);
  });

});
