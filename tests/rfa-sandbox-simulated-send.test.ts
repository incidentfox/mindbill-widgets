// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { RfaSendDialog } from "../packages/react/src/rfa-send-dialog";
import { isEstimateOnlyFeeContext } from "../packages/react/src/bill-submission-form";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const signed = {
  id: "rfa_synthetic", contentRevision: 1, claimId: "claim_synthetic", patientId: "patient_synthetic", renderingProviderId: "provider_synthetic",
  claimsAdminId: null, employeeName: "Synthetic patient", providerName: "Synthetic physician", claimNumber: "SYNTHETIC-001", status: "ready",
  reviewType: "prospective", expedited: false, signedAt: "2026-09-01T00:00:00Z", submittedAt: null, receivedAt: null, createdAt: null, updatedAt: null,
  decisionDueAt: null, decisionDeadlineBasis: null, incompleteReason: null, deferredReason: null, closedReason: null, readiness: { ready: true, missing: [] },
  authorizationContact: { name: "Synthetic Claims", fax: "5105550100" },
  items: [{ id: "item_synthetic", diagnosisCode: "M54.16", diagnosisDescription: "Radiculopathy, lumbar region", serviceDescription: "Synthetic injection", procedureCode: "64483", outcome: "pending", quantity: null, units: null, authorizationNumber: null, decisionReason: null }],
  documents: [{ id: "clinical_synthetic", documentType: "clinical_report", filename: "Synthetic report.pdf", contentUrl: "", contentRevision: 1, createdAt: null }],
  transmissions: [], informationRequests: [], events: [],
};

async function render(props: Record<string, unknown>) {
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(createElement(RfaSendDialog, {
    rfa: signed as never, client: {} as never, documentIds: ["clinical_synthetic"], diagnosisDescriptions: { item_synthetic: "Radiculopathy, lumbar region" }, directory: null,
    directoryLoading: false, directoryError: null, environment: "sandbox", canSend: true, canSign: true, actorReference: "user_synthetic",
    onUpdated: vi.fn(), onSent: vi.fn(), onClose: vi.fn(), ...props,
  })));
  return { container, unmount: async () => { await act(async () => root.unmount()); container.remove(); } };
}

it("keeps sandbox sending blocked unless the host can record a simulated send", async () => {
  const view = await render({});
  try {
    expect(view.container.textContent).toContain("This is a sandbox: nothing is faxed or e-mailed.");
    const send = [...view.container.querySelectorAll("button")].find((button) => button.textContent === "Send fax")!;
    expect(send.disabled).toBe(true);
  } finally { await view.unmount(); }
});

it("records a simulated sandbox send without faxing, after the user confirms", async () => {
  const recordSimulatedSend = vi.fn(async () => ({ ...signed, submittedAt: "2026-09-02T00:00:00Z" }));
  const onSent = vi.fn();
  const view = await render({ recordSimulatedSend, onSent });
  try {
    expect(view.container.textContent).toContain("recorded in History as a simulation");
    const button = () => [...view.container.querySelectorAll("button")].find((item) => item.textContent === "Record simulated send")!;
    expect(button().disabled).toBe(true);
    const confirm = view.container.querySelector<HTMLInputElement>(".mbrfa-send-confirm input")!;
    await act(async () => confirm.click());
    await act(async () => button().click());
    expect(recordSimulatedSend).toHaveBeenCalledTimes(1);
    const [rfaId, input] = recordSimulatedSend.mock.calls[0] as unknown as [string, { channel: string; destination: string; sentAt: string }];
    expect(rfaId).toBe("rfa_synthetic");
    expect(input.channel).toBe("fax");
    expect(input.destination).toContain("5105550100");
    expect(Number.isFinite(Date.parse(input.sentAt))).toBe(true);
    expect(onSent).toHaveBeenCalledTimes(1);
  } finally { await view.unmount(); }
});

it("treats only standard estimate assumptions as replaceable by the encounter quote", () => {
  expect(isEstimateOnlyFeeContext(undefined)).toBe(true);
  expect(isEstimateOnlyFeeContext({ hasFeeAgreement: false, physicianContext: { providerKind: "physician", placeOfService: "11", standaloneService: true, globalPeriodApplies: false, hpsaBonusEligible: false } } as never)).toBe(true);
  expect(isEstimateOnlyFeeContext({ hasFeeAgreement: true } as never)).toBe(false);
  expect(isEstimateOnlyFeeContext({ catalogContext: { codingRequirementsSatisfied: true } } as never)).toBe(false);
  expect(isEstimateOnlyFeeContext({ therapyContext: {} } as never)).toBe(false);
});

it("submits encounter-priced lines without the form's estimate assumptions, so the bill prices as quoted", async () => {
  vi.useFakeTimers();
  const { BillSubmissionForm } = await import("../packages/react/src/bill-submission-form");
  const address = { line1: "100 Synthetic Way", city: "Oakland", state: "CA", postalCode: "94612" };
  const onSubmit = vi.fn();
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(BillSubmissionForm, {
      initialBill: {
        billingMode: "professional",
        patient: { firstName: "Ada", lastName: "Example", dateOfBirth: "1980-01-02", address },
        claim: { claimNumber: "SYNTHETIC-9", employer: "Synthetic Foods", dateOfInjury: "2026-08-01", injuryState: "CA",
          claimsAdministrator: { id: "payer_synthetic", name: "Synthetic Claims Administrator" } },
        service: { date: "2026-10-08" },
        billingProvider: { name: "Synthetic Spine Group", taxId: "123456789", npi: "1234567893", phone: "5105550100", address },
        renderingProvider: { name: "Sam Example, MD", npi: "1245319599", taxonomy: "208VP0014X" },
        serviceLocation: { name: "Synthetic Office", placeOfServiceCode: "11", address },
        diagnoses: ["M54.16"],
        serviceLines: [{ code: "64483", units: 1, charge: 650, serviceDate: "2026-10-08", diagnosisPointers: [1] }],
      },
      getSession: async () => ({ token: "synthetic_session" }), fetch: vi.fn<typeof fetch>(async () => Response.json({ data: [] })),
      treatmentBilling: true, editableTreatmentCharges: true, deliveryRoutePicker: "off",
      onQuoteEncounter: async () => [{ status: "priced" as const, amountCents: 45834, scheduleMaximumCents: 45834, basis: "ca_physician_rbrvs" as const, provenance: [], notes: [] }],
      onSubmit,
    })));
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    const form = container.querySelector("form")!;
    await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const line = (onSubmit.mock.calls[0]![0] as { bill: { serviceLines: Array<{ code: string; charge?: number; feeContext?: unknown }> } }).bill.serviceLines[0]!;
    expect(line.code).toBe("64483");
    expect(line.charge).toBe(650);
    expect(line.feeContext).toBeUndefined();
  } finally {
    await act(async () => root.unmount()); container.remove(); vi.useRealTimers();
  }
});

it("asks for a line's coding confirmation when MindBill requires it, then resubmits with the confirmed facts", async () => {
  const { attestationRequest, attestedFeeContext, lineAttestationText } = await import("../packages/react/src/bill-submission-form");
  const lines = [{ code: "", units: 1 }, { code: "64483", units: 1, charge: 650 }, { code: "", units: 1 }];
  const request = attestationRequest("Service line 1: complete_surgical_package_required", lines as never);
  expect(request).toEqual({ index: 1, position: 1, code: "64483", reason: "complete_surgical_package_required" });
  expect(attestationRequest("Service line 1: claims_administrator_required", lines as never)).toBeNull();
  expect(lineAttestationText({ code: "64483", reasons: ["code_specific_coding_requirements_not_confirmed", "complete_surgical_package_required"] }))
    .toBe("I confirm the documentation meets the coding requirements for 64483, and the complete procedure, including its global surgical package, was performed.");
  const context = attestedFeeContext({ hasFeeAgreement: false, physicianContext: { providerKind: "physician", placeOfService: "11", standaloneService: true, globalPeriodApplies: false, hpsaBonusEligible: false } } as never,
    { reasons: ["code_specific_coding_requirements_not_confirmed", "complete_surgical_package_required"] }, false) as Record<string, Record<string, unknown>>;
  expect(context.catalogContext).toEqual({ codingRequirementsSatisfied: true, completeSurgicalPackage: true });
  expect(context.physicianContext!.standaloneService).toBe(false);
});
