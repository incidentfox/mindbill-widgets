import { describe, expect, it } from "vitest";

import {
  billSubmissionLineDiagnosisCodes,
  billSubmissionUsesSharedDiagnoses,
  setBillSubmissionDiagnosisAssignments,
  setBillSubmissionSharedDiagnoses,
  setBillSubmissionLineDiagnoses,
  remapBillSubmissionDiagnoses,
  setBillSubmissionLineDiagnosis,
} from "../packages/angular/src/lib/submission-treatment";

import type { BrowserBillCreateInput as BillSubmissionInput } from "@mindbill/browser";

function syntheticBill(): BillSubmissionInput {
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

describe("service line ICD-10 assignments", () => {
  it("assigns a newly searched diagnosis to only the selected line and leaves the input unchanged", () => {
    const original = syntheticBill();
    const before = structuredClone(original);
    const updated = setBillSubmissionLineDiagnosis(original, 1, 1, " m25.562 ");

    expect(updated.diagnoses).toEqual(["M54.50", "M54.2", "M79.641", "M25.562"]);
    expect(updated.serviceLines.map((line) => line.diagnosisPointers)).toEqual([[1], [2, 4]]);
    expect(original).toEqual(before);
  });

  it("replaces a diagnosis in one line without changing another line using that diagnosis", () => {
    const original = syntheticBill();
    original.serviceLines[1]!.diagnosisPointers = [1, 2];
    const updated = setBillSubmissionLineDiagnosis(original, 0, 0, "M79.641");

    expect(updated.serviceLines.map((line) => line.diagnosisPointers)).toEqual([[3], [1, 2]]);
    expect(updated.diagnoses).toEqual(original.diagnoses);
  });

  it("preserves the diagnosis meaning and priority of every line after removing and reordering claim diagnoses", () => {
    const original = syntheticBill();
    original.serviceLines[0]!.diagnosisPointers = [3, 1];
    original.serviceLines[1]!.diagnosisPointers = [2, 3];
    const updated = remapBillSubmissionDiagnoses(original, ["M79.641", "M54.50"]);

    expect(updated.serviceLines.map((line) => line.diagnosisPointers)).toEqual([[1, 2], [1]]);
    expect(original.serviceLines.map((line) => line.diagnosisPointers)).toEqual([[3, 1], [2, 3]]);
  });

  it("clears a line assignment when its claim diagnosis is removed instead of assigning the next diagnosis", () => {
    const updated = remapBillSubmissionDiagnoses(syntheticBill(), ["M54.2", "M79.641"]);

    expect(updated.serviceLines.map((line) => line.diagnosisPointers)).toEqual([[], [1]]);
  });

  it("removes a selected slot and keeps the remaining line diagnoses in order", () => {
    const original = syntheticBill();
    original.serviceLines[0]!.diagnosisPointers = [1, 2, 3];
    const updated = setBillSubmissionLineDiagnosis(original, 0, 1, "");

    expect(updated.serviceLines[0]!.diagnosisPointers).toEqual([1, 3]);
    expect(updated.serviceLines[1]!.diagnosisPointers).toEqual([2]);
    expect(updated.diagnoses).toEqual(original.diagnoses);
  });

  it("deduplicates a diagnosis chosen in multiple slots", () => {
    const original = syntheticBill();
    original.serviceLines[0]!.diagnosisPointers = [1, 2, 3];
    const updated = setBillSubmissionLineDiagnosis(original, 0, 1, "M54.50");

    expect(updated.serviceLines[0]!.diagnosisPointers).toEqual([1, 3]);
  });

  it("caps claim diagnoses at twelve and still permits existing diagnoses at the limit", () => {
    const codes = Array.from({ length: 13 }, (_, index) => `Z99.${index}`);
    const full = remapBillSubmissionDiagnoses(syntheticBill(), codes);

    expect(full.diagnoses).toEqual(codes.slice(0, 12));
    expect(setBillSubmissionLineDiagnosis(full, 0, 0, codes[12]!)).toBe(full);
    expect(setBillSubmissionLineDiagnosis(full, 0, 0, codes[11]!).serviceLines[0]!.diagnosisPointers).toEqual([12]);
  });

  it("preserves assignments while normalizing whitespace and case in initial diagnoses", () => {
    const bill = syntheticBill();
    bill.diagnoses = [" m54.50 ", "m54.2", "M79.641"];
    const updated = remapBillSubmissionDiagnoses(bill, ["M54.2", "M54.50"]);

    expect(updated.serviceLines.map((line) => line.diagnosisPointers)).toEqual([[2], [1]]);
  });

  it("allows four diagnoses on a line and rejects a fifth slot without adding a claim diagnosis", () => {
    const original = syntheticBill();
    original.serviceLines[0]!.diagnosisPointers = [1, 2, 3];
    const full = setBillSubmissionLineDiagnosis(original, 0, 3, "M25.562");

    expect(full.serviceLines[0]!.diagnosisPointers).toEqual([1, 2, 3, 4]);
    expect(setBillSubmissionLineDiagnosis(full, 0, 4, "M25.561")).toBe(full);
  });

});


describe("shared and individual diagnosis selections", () => {
  it("defaults fresh medlegal and treatment forms to shared while preserving saved independent lines", () => {
    for (const billingMode of ["professional", "med_legal"] as const) {
      const bill = { ...syntheticBill(), billingMode };
      expect(billSubmissionUsesSharedDiagnoses(bill)).toBe(false);
      bill.serviceLines = bill.serviceLines.map((line) => { const fresh = { ...line }; delete fresh.diagnosisPointers; return fresh; });
      expect(billSubmissionUsesSharedDiagnoses(bill)).toBe(true);
      const shared = setBillSubmissionSharedDiagnoses(bill, ["M54.50", "M54.2"]);
      expect(shared.serviceLines.map((line) => line.diagnosisPointers)).toEqual([[1, 2], [1, 2]]);
      expect(billSubmissionUsesSharedDiagnoses(shared)).toBe(true);
    }
  });
  it("removes from one multiselect without changing the diagnosis meaning on another line", () => {
    const shared = setBillSubmissionSharedDiagnoses(syntheticBill(), ["M54.50", "M54.2"]);
    const updated = setBillSubmissionLineDiagnoses(shared, 0, ["M54.2"]);
    expect(billSubmissionLineDiagnosisCodes(updated, 0)).toEqual(["M54.2"]);
    expect(billSubmissionLineDiagnosisCodes(updated, 1)).toEqual(["M54.50", "M54.2"]);
    expect(updated.serviceLines[0]!.diagnosisPointers).toEqual([2]);
    expect(shared.serviceLines[0]!.diagnosisPointers).toEqual([1, 2]);
  });
  it("restores saved independent selections by code after the shared catalog changes", () => {
    const original = syntheticBill();
    const saved = original.serviceLines.map((_, index) => billSubmissionLineDiagnosisCodes(original, index));
    const shared = setBillSubmissionSharedDiagnoses(original, ["M25.561"]);
    const restored = setBillSubmissionDiagnosisAssignments(shared, saved);
    expect(restored.serviceLines.map((_, index) => billSubmissionLineDiagnosisCodes(restored, index))).toEqual(saved);
    expect(restored.diagnoses).toEqual(["M54.50", "M54.2"]);
  });
  it("enforces four per line and twelve across the bill while permitting existing codes at the cap", () => {
    const bill = syntheticBill();
    expect(setBillSubmissionSharedDiagnoses(bill, ["A", "B", "C", "D", "E"])).toBe(bill);
    bill.serviceLines = Array.from({ length: 4 }, () => ({ code: "ML201", units: 1 }));
    const twelve = setBillSubmissionDiagnosisAssignments(bill, [["A", "B", "C", "D"], ["E", "F", "G", "H"], ["I", "J", "K", "L"], []]);
    expect(twelve.diagnoses).toHaveLength(12);
    expect(setBillSubmissionLineDiagnoses(twelve, 3, ["M"])).toBe(twelve);
    expect(billSubmissionLineDiagnosisCodes(setBillSubmissionLineDiagnoses(twelve, 3, ["L"]), 3)).toEqual(["L"]);
    expect(billSubmissionUsesSharedDiagnoses(twelve)).toBe(false);
  });
});
