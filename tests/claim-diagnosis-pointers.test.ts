// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  addBillSubmissionClaimDiagnosis,
  BillSubmissionForm,
  BillSubmissionServiceLinesSection,
  billSubmissionLineDiagnosisCodes,
  defaultBillSubmissionLinePointers,
  removeBillSubmissionClaimDiagnosis,
  setBillSubmissionLineDiagnoses,
  type BillSubmissionInput,
} from "../packages/react/src/bill-submission-form";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const address = { line1: "100 Synthetic Way", city: "Sacramento", state: "CA", postalCode: "95814" };
const caseDiagnoses = ["M25.561", "M22.2X1", "M22.2X2", "Z96.651", "M17.12", "Y99.0", "G89.29", "M25.562"];
const bill = (lines: BillSubmissionInput["serviceLines"]): BillSubmissionInput => ({
  externalId: "synthetic", billingMode: "professional",
  patient: { firstName: "Ada", lastName: "Example", dateOfBirth: "1980-01-02", address },
  claim: { claimNumber: "SYN-8", employer: "Synthetic Foods", dateOfInjury: "2026-08-01", injuryState: "CA" },
  service: { date: "2026-10-14" },
  billingProvider: { name: "Synthetic Practice", taxId: "123456789", npi: "1234567890", phone: "2135550100", address },
  renderingProvider: { name: "Ada Physician", npi: "1098765432", taxonomy: "208100000X" },
  serviceLocation: { name: "Sacramento", placeOfServiceCode: "11", address },
  diagnoses: caseDiagnoses, serviceLines: lines,
});

describe("claim diagnoses and line pointers", () => {
  it("keeps every claim diagnosis when one line's pointers change", () => {
    const updated = setBillSubmissionLineDiagnoses(bill([{ code: "99214", units: 1, diagnosisPointers: [1, 2, 3, 4] }]), 0, ["M25.561", "Y99.0"]);
    expect(updated.diagnoses).toEqual(caseDiagnoses);
    expect(updated.serviceLines[0]!.diagnosisPointers).toEqual([1, 6]);
  });

  it("appends a new code to the claim when a line picks it, and refuses a 13th", () => {
    const eleven = { ...bill([{ code: "99214", units: 1, diagnosisPointers: [1] }]), diagnoses: [...caseDiagnoses, "M54.50", "M54.2", "M79.641"] };
    const twelve = setBillSubmissionLineDiagnoses(eleven, 0, ["M25.561", "S83.511A"]);
    expect(twelve.diagnoses).toHaveLength(12);
    expect(billSubmissionLineDiagnosisCodes(twelve, 0)).toEqual(["M25.561", "S83.511A"]);
    expect(setBillSubmissionLineDiagnoses(twelve, 0, ["M25.561", "S83.511A", "M54.16"])).toBe(twelve);
    expect(addBillSubmissionClaimDiagnosis(twelve, "M54.16")).toBe(twelve);
  });

  it("removing a claim diagnosis removes only that pointer and keeps the others' meaning", () => {
    const start = bill([{ code: "99214", units: 1, diagnosisPointers: [1, 2, 5, 7] }]);
    const updated = removeBillSubmissionClaimDiagnosis(start, "M22.2X1");
    expect(updated.diagnoses).toEqual(caseDiagnoses.filter((code) => code !== "M22.2X1"));
    expect(billSubmissionLineDiagnosisCodes(updated, 0)).toEqual(["M25.561", "M17.12", "G89.29"]);
  });

  it("new lines point at the first four claim diagnoses", () => {
    expect(defaultBillSubmissionLinePointers(bill([]))).toEqual([1, 2, 3, 4]);
    expect(defaultBillSubmissionLinePointers({ diagnoses: ["M54.2", "M54.50"] })).toEqual([1, 2]);
    expect(defaultBillSubmissionLinePointers({ diagnoses: [] })).toEqual([]);
  });
});

it("shows the case's diagnoses A–L and toggles any four as a line's pointers", async () => {
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  await act(async () => root.render(createElement(BillSubmissionForm, {
    initialBill: bill([{ code: "", units: 1, diagnosisPointers: [1] }]), treatmentBilling: true, deliveryRoutePicker: "off",
    procedureOptions: [{ code: "99214", description: "Established patient office visit, level 4" }],
    fetch: async () => Response.json({}, { status: 503 }),
  } as never, createElement(BillSubmissionServiceLinesSection))));
  const list = [...container.querySelectorAll(".mbsf-claim-diagnosis-list li")].map((item) => item.textContent ?? "");
  expect(list).toHaveLength(8);
  expect(list[0]).toContain("A"); expect(list[0]).toContain("M25.561");
  const picks = () => [...container.querySelectorAll<HTMLButtonElement>('[aria-label="Diagnosis pointers for service line 1"] button')];
  expect(picks()).toHaveLength(8);
  expect(picks().map((button) => button.getAttribute("aria-pressed"))).toEqual(["true", "true", "true", "true", "false", "false", "false", "false"]);
  expect(picks()[5]!.disabled).toBe(true);
  await act(async () => picks()[3]!.click());
  await act(async () => picks()[5]!.click());
  expect(picks().map((button) => button.getAttribute("aria-pressed"))).toEqual(["true", "true", "true", "false", "false", "true", "false", "false"]);
  expect(container.querySelectorAll(".mbsf-claim-diagnosis-list li")).toHaveLength(8);
  await act(async () => root.unmount()); container.remove();
});

it("defaults a treatment bill's attachment report type to the PR-2 progress report (09)", async () => {
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  await act(async () => root.render(createElement(BillSubmissionForm, {
    initialBill: bill([{ code: "99214", units: 1, charge: 200, diagnosisPointers: [1] }]), treatmentBilling: true, deliveryRoutePicker: "off",
    initialUploads: [{ file: new File(["%PDF-1.7"], "pr2.pdf", { type: "application/pdf" }), documentType: "medical_records" }],
    fetch: async () => Response.json({}, { status: 503 }),
  } as never)));
  try {
    const reportType = container.querySelector<HTMLInputElement>('input[aria-label="Report type for pr2.pdf"]');
    expect(reportType, "report type picker for the attached PR-2").not.toBeNull();
    expect(reportType!.value).toMatch(/^09|PR2/);
    expect(container.textContent).toContain("pr2.pdf");
  } finally { await act(async () => root.unmount()); container.remove(); }
});
