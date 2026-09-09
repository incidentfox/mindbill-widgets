import '@angular/compiler';
import { ChangeDetectorRef, Injector, runInInjectionContext } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as browser from '../packages/browser/src/index';
import { MindBillConnectedRfaComponent } from '../packages/angular/src/lib/connected-rfa.component';
import type { RfaDraftInput } from '../packages/browser/src/index';
import { RfaDraftFormComponent } from '../packages/angular/src/lib/rfa-draft-form.component';
import { RfaCodeLookup, customRfaDiagnosis, customRfaProcedure, type MindBillRfaCodeOption } from '../packages/angular/src/lib/rfa-code-lookup';
import { MindBillComboBoxComponent } from '../packages/angular/src/lib/submission-controls';

const draft: RfaDraftInput = { claimId: 'claim_synthetic', patientId: 'patient_synthetic', renderingProviderId: 'provider_synthetic', employeeName: 'Demo Patient', providerName: 'Demo Physician', items: [{ diagnosisCode: 'M25.531', procedureCode: '99213', serviceDescription: 'Clinical request from the host' }] };
const injector = Injector.create({ providers: [{ provide: ChangeDetectorRef, useValue: { markForCheck: vi.fn() } }] });
function form() { const component = runInInjectionContext(injector, () => new RfaDraftFormComponent()); component.initialDraft = draft; component.ngOnChanges(); return component; }
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('RFA code searches', () => {
  it('matches dropdown codes and descriptions and offers valid custom codes only', () => {
    const combo = new MindBillComboBoxComponent(); combo.options = [{ id: '99213', label: '99213', detail: 'Office follow-up visit' }];
    combo.query = 'follow-up'; expect(combo.visible.map(item => item.id)).toEqual(['99213']);
    combo.query = '99213'; expect(combo.visible.map(item => item.id)).toEqual(['99213']);
    expect(customRfaDiagnosis('m25.531')?.id).toBe('M25.531'); expect(customRfaDiagnosis('wrist pain')).toBeNull();
    expect(customRfaProcedure('99213')?.id).toBe('99213'); expect(customRfaProcedure('a0428')?.id).toBe('A0428'); expect(customRfaProcedure('office visit')).toBeNull();
  });
  it('preserves remote token matches without changing default local filtering or duplicating custom codes', () => {
    const combo = new MindBillComboBoxComponent(); combo.options = [{ id: '99213', label: '99213', detail: 'Office/outpatient established patient visit' }];
    combo.query = 'office visit'; expect(combo.visible).toEqual([]);
    combo.filterOptions = false; expect(combo.visible).toEqual(combo.options);
    combo.createOption = customRfaProcedure; combo.query = '99213'; expect(combo.visible).toHaveLength(1);
    combo.query = '99214'; expect(combo.visible.map(item => item.id)).toEqual(['99213', '99214']);
  });
  it('debounces queries and ignores an earlier response that arrives last', async () => {
    let resolveFirst!: (options: MindBillRfaCodeOption[]) => void;
    const search = vi.fn().mockImplementationOnce(() => new Promise< MindBillRfaCodeOption[]>(resolve => { resolveFirst = resolve; })).mockResolvedValue([{ code: 'M25.532', description: 'Left wrist pain' }]);
    const lookup = new RfaCodeLookup(vi.fn());
    lookup.search('wrist', search); await vi.advanceTimersByTimeAsync(180);
    lookup.search('left wrist', search); await vi.advanceTimersByTimeAsync(180);
    resolveFirst([{ code: 'M25.531', description: 'Right wrist pain' }]); await Promise.resolve();
    expect(lookup.options).toEqual([{ id: 'M25.532', label: 'M25.532', detail: 'Left wrist pain' }]); expect(lookup.loading).toBe(false);
  });
  it('does not dirty or alter the draft while typing, loading, or inspecting search results', async () => {
    const component = form(); component.searchDiagnoses = vi.fn(async () => [{ code: 'M25.532', description: 'Left wrist pain' }]); component.ngOnChanges();
    const dirty = vi.fn(); component.dirtyChange.subscribe(dirty); const item = component.draft!.items[0]!;
    component.searchCode(item, 'diagnosis', 'w'); component.searchCode(item, 'diagnosis', 'wrist');
    await vi.advanceTimersByTimeAsync(180);
    expect(component.searchDiagnoses).toHaveBeenCalledTimes(1); expect(dirty).not.toHaveBeenCalled(); expect(item.diagnosisCode).toBe('M25.531');
    component.selectCode(item, 'diagnosis', component.lookup(item, 'diagnosis').options[0]!);
    expect(item.diagnosisCode).toBe('M25.532'); expect(dirty).toHaveBeenCalledOnce();
    component.ngOnDestroy();
  });
  it('preserves a clinician description and fills an empty description only from a selected catalog result', async () => {
    const component = form(); component.searchProcedures = async () => [{ code: '99214', description: 'Office visit, established patient' }]; component.ngOnChanges();
    const item = component.draft!.items[0]!; component.searchCode(item, 'procedure', 'office'); await vi.advanceTimersByTimeAsync(180);
    component.selectCode(item, 'procedure', component.lookup(item, 'procedure').options[0]!);
    expect(item.procedureCode).toBe('99214'); expect(item.serviceDescription).toBe('Clinical request from the host');
    item.serviceDescription = ''; component.selectCode(item, 'procedure', component.lookup(item, 'procedure').options[0]!); expect(item.serviceDescription).toBe('Office visit, established patient');
    item.serviceDescription = ''; component.selectCode(item, 'procedure', customRfaProcedure('99215')!); expect(item.serviceDescription).toBe(''); component.ngOnDestroy();
  });
  it('discards in-flight results after a case change and prevents old-row selection', async () => {
    let finish!: (results: MindBillRfaCodeOption[]) => void;
    const component = form(); component.searchDiagnoses = () => new Promise(resolve => { finish = resolve; }); component.ngOnChanges();
    const old = component.draft!.items[0]!, oldLookup = component.lookup(old, 'diagnosis'); component.searchCode(old, 'diagnosis', 'wrist'); await vi.advanceTimersByTimeAsync(180);
    component.initialDraft = { ...draft, claimId: 'claim_other' }; component.ngOnChanges(); finish([{ code: 'M25.532', description: 'Left wrist pain' }]); await Promise.resolve();
    expect(oldLookup.options).toEqual([]); expect(component.lookup(component.draft!.items[0]!, 'diagnosis').options).toEqual([]);
    component.selectCode(old, 'diagnosis', customRfaDiagnosis('M25.532')!); expect(component.draft!.items[0]!.diagnosisCode).toBe('M25.531'); component.ngOnDestroy();
  });
  it('disposes searches for removed rows and on destruction', async () => {
    let finish!: (results: MindBillRfaCodeOption[]) => void;
    const component = form(); component.addItem(); component.searchProcedures = vi.fn(() => new Promise<MindBillRfaCodeOption[]>(resolve => { finish = resolve; })); component.ngOnChanges();
    const item = component.draft!.items[0]!, lookup = component.lookup(item, 'procedure'); component.searchCode(item, 'procedure', 'visit'); await vi.advanceTimersByTimeAsync(180);
    component.removeItem(0); finish([{ code: '99213', description: 'Office visit' }]); await Promise.resolve(); expect(lookup.options).toEqual([]);
    const remaining = component.draft!.items[0]!; component.searchCode(remaining, 'procedure', 'follow-up'); component.ngOnDestroy(); await vi.advanceTimersByTimeAsync(180); expect(component.searchProcedures).toHaveBeenCalledTimes(1);
  });
  it('retains valid custom-code selection when the optional lookup fails', async () => {
    const component = form(); component.searchDiagnoses = async () => { throw new Error('Unavailable'); }; component.ngOnChanges(); const item = component.draft!.items[0]!;
    component.searchCode(item, 'diagnosis', 'M25.532'); await vi.advanceTimersByTimeAsync(180); expect(component.lookup(item, 'diagnosis').error).toMatch(/Search is unavailable/);
    component.selectCode(item, 'diagnosis', customRfaDiagnosis('M25.532')!); expect(item.diagnosisCode).toBe('M25.532'); component.ngOnDestroy();
  });
  it('connects code-description lookups to the current authenticated reference client and clears it on context change', async () => {
    const reference = { searchDiagnosisCodes: vi.fn(async () => [{ code: 'M25.531', description: 'Right wrist pain' }]), searchProcedureCodes: vi.fn(async () => ({ results: [{ code: '99213', description: 'Office visit' }] })), clearSession: vi.fn() };
    const create = vi.spyOn(browser, 'createBillReferenceClient').mockReturnValue(reference as unknown as browser.BillReferenceClient);
    const component = runInInjectionContext(injector, () => new MindBillConnectedRfaComponent()); component.initialDraft = draft; component.sessionEndpoint = '/api/case-rfa-session';
    component.client = { clearSession: vi.fn(), list: vi.fn(async () => ({ data: [], nextCursor: null })) } as unknown as browser.RfaWorkflowClient;
    component.ngOnChanges();
    expect(await component.searchDiagnoses('wrist')).toEqual([{ code: 'M25.531', description: 'Right wrist pain' }]);
    expect(await component.searchProcedures('office')).toEqual([{ code: '99213', description: 'Office visit' }]);
    expect(create).toHaveBeenCalledOnce(); expect(create).toHaveBeenCalledWith({ sessionEndpoint: '/api/case-rfa-session' });
    expect(reference.searchDiagnosisCodes).toHaveBeenCalledWith('wrist', 60); expect(reference.searchProcedureCodes).toHaveBeenCalledWith({ query: 'office', limit: 100, jurisdiction: 'CA' });
    component.initialDraft = { ...draft, claimId: 'claim_other' }; component.ngOnChanges(); expect(reference.clearSession).toHaveBeenCalledOnce();
    await component.searchProcedures('99213'); expect(create).toHaveBeenCalledTimes(2); component.ngOnDestroy();
  });

});
