import '@angular/compiler';
import { ChangeDetectorRef, Injector, runInInjectionContext, SimpleChange } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as browser from '../packages/browser/src/index';
import type { BrowserBillCreateInput } from '@mindbill/browser';
import { MindBillBillSubmissionComponent } from '../packages/angular/src/lib/bill-submission.component';

function syntheticBill(): BrowserBillCreateInput {
  const address = { line1: "100 Example Street", city: "Sacramento", state: "CA", postalCode: "95814" };
  return {
    billingMode: "professional",
    patient: { firstName: "Synthetic", lastName: "Example", dateOfBirth: "1980-01-02", address },
    claim: {
      claimNumber: "SYNTHETIC-CLAIM",
      employer: "Synthetic Employer",
      dateOfInjury: "2026-08-01",
      claimsAdministrator: { id: "synthetic_payer", name: "Synthetic Claims Administrator" },
    },
    service: { date: "2026-08-24" },
    billingProvider: { name: "Synthetic Medical Group", taxId: "123456789", npi: "1234567890", phone: "9165550100", address },
    renderingProvider: { name: "Synthetic Physician", npi: "1098765432", taxonomy: "207X00000X" },
    serviceLocation: { name: "Synthetic Office", placeOfServiceCode: "11", address },
    diagnoses: ["M54.50", "M54.2", "M79.641"],
    serviceLines: [
      { code: "99213", units: 1, charge: 100, diagnosisPointers: [1] },
      { code: "97110", units: 1, charge: 50, diagnosisPointers: [2] },
    ],
  };
}

const injector = Injector.create({ providers: [{ provide: ChangeDetectorRef, useValue: { markForCheck: vi.fn() } }] });
function form() { const component = runInInjectionContext(injector, () => new MindBillBillSubmissionComponent()); component.initialBill = syntheticBill(); component.ngOnChanges({ initialBill: new SimpleChange(undefined, component.initialBill, true) }); return component; }
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Angular treatment service selectors', () => {
  it('normalizes legacy medical-legal bills without pointers and supports shared and per-line selections', () => {
    const component = form(); component.initialBill = { ...syntheticBill(), billingMode: 'med_legal', serviceLines: [{ code: 'ML201', units: 1 }, { code: 'ML203', units: 1 }] };
    component.ngOnChanges({ initialBill: new SimpleChange(null, component.initialBill, false) });
    expect(component.isTreatment).toBe(false); expect(component.sharedDiagnoses).toBe(true);
    expect(component.serviceDiagnosisCodes(0)).toEqual(['M54.50', 'M54.2', 'M79.641']);
    component.removeDiagnosis('M79.641'); expect(component.serviceDiagnosisCodes(1)).toEqual(['M54.50', 'M54.2']);
    component.setSharedDiagnoses(false); component.selectServiceDiagnosis({ id: 'M25.531', label: 'M25.531' }, 1);
    component.removeServiceDiagnosis('M54.2', 0);
    expect(component.serviceDiagnosisCodes(0)).toEqual(['M54.50']); expect(component.serviceDiagnosisCodes(1)).toEqual(['M54.50', 'M54.2', 'M25.531']);
    component.setSharedDiagnoses(true); component.addDiagnosis({ code: 'M25.532', description: 'Left wrist pain' });
    expect(component.serviceDiagnosisCodes(0)).toEqual(['M54.50', 'M25.532']); expect(component.serviceDiagnosisCodes(1)).toEqual(['M54.50', 'M25.532']); component.ngOnDestroy();
  });
  it('selects and removes diagnoses by code without changing other line assignments', () => {
    const component = form();
    component.selectServiceDiagnosis({ id: 'M25.531', label: 'M25.531', detail: 'Right wrist pain' }, 1);
    expect(component.serviceDiagnosisCodes(0)).toEqual(['M54.50']);
    expect(component.serviceDiagnosisCodes(1)).toEqual(['M54.2', 'M25.531']);
    expect(component.diagnosisDescription('M25.531')).toBe('Right wrist pain');
    component.removeServiceDiagnosis('M54.2', 1);
    expect(component.serviceDiagnosisCodes(1)).toEqual(['M25.531']);
    expect(component.serviceDiagnosisCodes(0)).toEqual(['M54.50']); component.ngOnDestroy();
  });
  it('restores independent diagnoses across a toggle, but keeps intentional shared edits', () => {
    const component = form(); const selections = component.bill.serviceLines.map((_, index) => component.serviceDiagnosisCodes(index));
    component.setSharedDiagnoses(true); expect(component.bill.diagnoses).toEqual(['M54.50']);
    component.setSharedDiagnoses(false); expect(component.bill.serviceLines.map((_, index) => component.serviceDiagnosisCodes(index))).toEqual(selections);
    component.setSharedDiagnoses(true); component.selectServiceDiagnosis({ id: 'M25.531', label: 'M25.531' }); component.setSharedDiagnoses(false);
    expect(component.serviceDiagnosisCodes(0)).toEqual(['M54.50', 'M25.531']); expect(component.serviceDiagnosisCodes(1)).toEqual(['M54.50', 'M25.531']); component.ngOnDestroy();
  });
  it('enforces four per line and twelve unique diagnoses while allowing another line to reuse a code', () => {
    const component = form(); component.bill.diagnoses = Array.from({ length: 12 }, (_, i) => 'M25.' + (530 + i));
    component.bill.serviceLines = [0, 1, 2].map(i => ({ code: '99213', units: 1, diagnosisPointers: [1, 2, 3, 4].map(pointer => pointer + i * 4) }));
    component.selectServiceDiagnosis({ id: 'M54.2', label: 'M54.2' }, 0); expect(component.serviceDiagnosisCodes(0)).toHaveLength(4);
    component.bill.serviceLines.push({ code: '99214', units: 1, diagnosisPointers: [] });
    expect(component.canAddServiceDiagnosis('M54.2', 3)).toBe(false);
    component.selectServiceDiagnosis({ id: 'M25.530', label: 'M25.530' }, 3); expect(component.serviceDiagnosisCodes(3)).toEqual(['M25.530']);
    expect(component.bill.diagnoses).toHaveLength(12); component.ngOnDestroy();
  });
  it.each(['professional', 'med_legal'] as const)('retains descriptions and remote token matches in %s mode without dirtying a bill', async (billingMode) => {
    const reference = { searchProcedureCodes: vi.fn(async () => ({ results: [{ code: '99999', description: 'Office/outpatient established patient visit' }] })), searchDiagnosisCodes: vi.fn(async () => [{ code: 'M25.531', description: 'Pain in right wrist' }]) };
    vi.spyOn(browser, 'createBillReferenceClient').mockReturnValue(reference as unknown as browser.BillReferenceClient);
    const component = form(), changes = vi.fn(); component.initialBill = { ...syntheticBill(), billingMode }; component.ngOnChanges({ initialBill: new SimpleChange(null, component.initialBill, false) }); component.billChange.subscribe(changes);
    component.searchProcedures('office visit'); component.queryServiceDiagnoses('right wrist'); await vi.advanceTimersByTimeAsync(180);
    expect(component.procedureComboOptions).toContainEqual({ id: '99999', label: '99999', detail: 'Office/outpatient established patient visit' });
    expect(component.procedureComboOptions.some(option => option.id === 'ML200')).toBe(false);
    expect(component.serviceDiagnosisOptions(1)).toContainEqual({ id: 'M25.531', label: 'M25.531', detail: 'Pain in right wrist' });
    expect(changes).not.toHaveBeenCalled();
    component.searchProcedures('different'); expect(component.procedureDescription('99999')).toBe('Office/outpatient established patient visit'); component.ngOnDestroy();
  });
  it('ignores earlier diagnosis queries and procedure replies from a previous case', async () => {
    let diagnosisReply!: (rows: browser.BillDiagnosisCode[]) => void, procedureReply!: (page: { results: { code: string; description: string }[] }) => void;
    const reference = { searchDiagnosisCodes: vi.fn().mockImplementationOnce(() => new Promise(resolve => { diagnosisReply = resolve; })).mockResolvedValue([{ code: 'M25.532', description: 'Left wrist pain' }]), searchProcedureCodes: vi.fn(() => new Promise(resolve => { procedureReply = resolve; })) };
    vi.spyOn(browser, 'createBillReferenceClient').mockReturnValue(reference as unknown as browser.BillReferenceClient);
    const component = form(); component.queryServiceDiagnoses('right'); component.searchProcedures('office'); await vi.advanceTimersByTimeAsync(180);
    component.queryServiceDiagnoses('left'); await vi.advanceTimersByTimeAsync(160); diagnosisReply([{ code: 'M25.531', description: 'Right wrist pain' }]); await Promise.resolve();
    expect(component.diagnosisResults.map(item => item.code)).toEqual(['M25.532']);
    component.initialBill = { ...syntheticBill(), externalId: 'synthetic_other_case' }; component.ngOnChanges({ initialBill: new SimpleChange(null, component.initialBill, false) });
    procedureReply({ results: [{ code: '99999', description: 'Old result' }] }); await Promise.resolve(); expect(component.remoteProcedures).toEqual([]); expect(component.procedureBusy).toBe(false); component.ngOnDestroy();
  });
});
