import { describe, expect, it } from "vitest";

import {
  billSubmissionFeeRequest,
  replaceBillSubmissionServiceLines,
  type BillSubmissionFeeContext,
  type BillSubmissionInput,
} from "../packages/react/src/bill-submission-form";

function fixture(): BillSubmissionInput {
  return {
    billingMode: "professional",
    patient: { firstName: "Synthetic", lastName: "Example", dateOfBirth: "1980-01-02", address: { line1: "100 Example Street", city: "Sacramento", state: "CA", postalCode: "95814" } },
    claim: { claimNumber: "SYNTHETIC-CLAIM" },
    service: { date: "2026-08-24" },
    serviceLocation: {
      placeOfServiceCode: "11",
      address: { line1: "100 Example Street", city: "Sacramento", state: "CA", postalCode: "95814" },
    },
    serviceLines: [{ code: "99213", units: 1, charge: 999, diagnosisPointers: [1] }],
    diagnoses: ["M54.50"],
  };
}

const physician: BillSubmissionFeeContext = {
  physicianContext: {
    providerKind: "physician",
    placeOfService: "11",
    standaloneService: true,
    globalPeriodApplies: false,
    hpsaBonusEligible: false,
  },
};

describe("treatment fee request identity", () => {
  it("normalizes the procedure and date without treating an old line charge as a new pricing input", () => {
    const bill = fixture();
    bill.service.date = "8/24/2026";
    const line = { ...bill.serviceLines[0]!, code: " 99213 " };
    expect(billSubmissionFeeRequest(bill, line)).toEqual({
      code: "99213", dateOfService: "2026-08-24", units: 1, modifiers: [], serviceZip: "95814",
    });
  });

  it("uses a line-specific service date before the claim-level service date", () => {
    const bill = fixture();
    const line = { ...bill.serviceLines[0]!, serviceDate: "8/25/2026" };
    const request = billSubmissionFeeRequest(bill, line);
    expect(request.dateOfService).toBe("2026-08-25");
    expect(billSubmissionFeeRequest({ ...bill, service: { date: "2026-08-26" } }, line)).toEqual(request);
  });

  it("leaves an invalid service date empty so it cannot request a quote for another date", () => {
    const bill = fixture();
    expect(billSubmissionFeeRequest(bill, { ...bill.serviceLines[0]!, serviceDate: "invalid" }).dateOfService).toBe("");
  });

  it.each([
    ["procedure", { code: "99214" }],
    ["units", { units: 2 }],
    ["modifiers", { modifiers: ["25"] }],
    ["line service date", { serviceDate: "2026-08-25" }],
  ] as Array<[string, Partial<BillSubmissionInput["serviceLines"][number]>]>)("changes the quote identity when %s changes", (_name, update) => {
    const bill = fixture();
    const line = bill.serviceLines[0]!;
    const before = billSubmissionFeeRequest(bill, line, physician);
    const after = billSubmissionFeeRequest(bill, { ...line, ...update }, physician);
    expect(JSON.stringify(after)).not.toBe(JSON.stringify(before));
  });

  it("changes the quote identity when the shared service date changes", () => {
    const bill = fixture();
    const line = bill.serviceLines[0]!;
    expect(billSubmissionFeeRequest({ ...bill, service: { date: "2026-08-25" } }, line))
      .not.toEqual(billSubmissionFeeRequest(bill, line));
  });

  it("changes the quote identity when location or verified service facts change", () => {
    const bill = fixture();
    const line = bill.serviceLines[0]!;
    const before = billSubmissionFeeRequest(bill, line, physician);
    const moved = structuredClone(bill);
    moved.serviceLocation!.address!.postalCode = "90012";
    expect(billSubmissionFeeRequest(moved, line, physician)).not.toEqual(before);
    expect(billSubmissionFeeRequest(bill, line, {
      physicianContext: { ...physician.physicianContext!, globalPeriodApplies: true },
    })).not.toEqual(before);
  });

  it("preserves supplied attestations exactly and leaves omitted attestations absent", () => {
    const bill = fixture();
    const line = bill.serviceLines[0]!;
    const context = { ...physician, hasFeeAgreement: true };
    const before = structuredClone({ bill, context });
    const request = billSubmissionFeeRequest(bill, line, context);
    expect(request.physicianContext).toEqual(context.physicianContext);
    expect(request.hasFeeAgreement).toBe(true);
    expect(request.physicianContext).not.toHaveProperty("incidentToPhysicianService");
    expect(request).not.toHaveProperty("therapyContext");
    expect(request).not.toHaveProperty("reportQualification");
    expect(billSubmissionFeeRequest(bill, line)).not.toHaveProperty("physicianContext");
    expect({ bill, context }).toEqual(before);
  });

  it("keeps diagnosis and RFA assignment changes separate from pricing inputs", () => {
    const bill = fixture();
    const line = bill.serviceLines[0]!;
    const request = billSubmissionFeeRequest(bill, line);
    const linked = { ...line, diagnosisPointers: [2], rfaItemId: "synthetic_rfa_item" };
    expect(billSubmissionFeeRequest(bill, linked)).toEqual(request);
  });
});


describe("same-day treatment fee restrictions", () => {
  it.each(["99214", "97110", "ML201"])("invalidates a standalone quote when another same-date %s line is added", (code) => {
    const bill = fixture();
    const line = bill.serviceLines[0]!;
    const single = billSubmissionFeeRequest(bill, line, physician);
    bill.serviceLines.push({ code, serviceDate: "8/24/2026", units: 1 });
    const multiple = billSubmissionFeeRequest(bill, line, physician);
    expect(multiple.physicianContext?.standaloneService).toBe(false);
    expect(JSON.stringify(multiple)).not.toBe(JSON.stringify(single));
    expect(physician.physicianContext?.standaloneService).toBe(true);
  });

  it("requires review of both therapy lines even with matching individual confirmations", () => {
    const bill = fixture();
    bill.serviceLines = [{ code: "97110", units: 1 }, { code: "97110", units: 1, serviceDate: "8/24/2026" }];
    const context: BillSubmissionFeeContext = { therapyContext: { providerKind: "physical_therapist", personallyPerformed: true, hospitalPatient: false, incidentToPhysicianService: false, assistantInvolved: false, placeOfService: "11", directOneOnOneMinutes: 15, totalVisitMinutes: 15, completeSameDayServices: true, otherSameDayServices: false, visitsOnDate: 1, globalPeriodApplies: false, hpsaBonusEligible: false } };
    for (const line of bill.serviceLines) {
      expect(billSubmissionFeeRequest(bill, line, context).therapyContext).toMatchObject({ otherSameDayServices: true });
    }
    expect(context.therapyContext?.otherSameDayServices).toBe(false);
  });

  it("ignores empty trailing rows and services on different dates", () => {
    const bill = fixture();
    bill.serviceLines.push({ code: "" }, { code: "97110", serviceDate: "2026-08-25" });
    expect(billSubmissionFeeRequest(bill, bill.serviceLines[0]!, physician).physicianContext?.standaloneService).toBe(true);
  });

  it("never creates attestations for an unconfirmed multi-service bill", () => {
    const bill = fixture();
    bill.serviceLines.push({ code: "97110" });
    const request = billSubmissionFeeRequest(bill, bill.serviceLines[0]!);
    expect(request).not.toHaveProperty("physicianContext");
    expect(request).not.toHaveProperty("therapyContext");
  });
});


describe("RFA authorization after editing service lines", () => {
  it.each(["replace", "remove"])("clears authorization when the last linked line is %s", (action) => {
    const bill = fixture();
    bill.service.authorizationNumber = "SYNTHETIC-RFA-AUTH";
    bill.serviceLines[0]!.rfaItemId = "synthetic-rfa-item";
    const lines = action === "replace" ? [{ code: "99214", units: 1 }, { code: "" }] : [{ code: "" }];
    const updated = replaceBillSubmissionServiceLines(bill, lines);
    expect(updated.service.authorizationNumber).toBeUndefined();
    expect(updated.service.date).toBe(bill.service.date);
    expect(updated.serviceLines).toEqual(lines);
    expect(bill.service.authorizationNumber).toBe("SYNTHETIC-RFA-AUTH");
  });

  it("preserves authorization while another RFA-linked line remains", () => {
    const bill = fixture();
    bill.service.authorizationNumber = "SYNTHETIC-RFA-AUTH";
    bill.serviceLines = [
      { code: "99213", rfaItemId: "synthetic-rfa-item-one" },
      { code: "97110", rfaItemId: "synthetic-rfa-item-two" },
    ];
    const updated = replaceBillSubmissionServiceLines(bill, [bill.serviceLines[1]!, { code: "" }]);
    expect(updated.service.authorizationNumber).toBe("SYNTHETIC-RFA-AUTH");
  });

  it("preserves explicit authorization on bills that never had an RFA link", () => {
    const bill = fixture();
    bill.service.authorizationNumber = "SYNTHETIC-EXPLICIT-AUTH";
    const updated = replaceBillSubmissionServiceLines(bill, [{ code: "99214" }, { code: "" }]);
    expect(updated.service.authorizationNumber).toBe("SYNTHETIC-EXPLICIT-AUTH");
  });
});
