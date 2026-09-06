import { describe, expect, it } from "vitest";
import { dentalDraftChargeSummary, parseDentalCharge, validateDentalDraftContent, type DentalDraftContentInput } from "../packages/react/src/dental-draft-editor";
import { normalizeRfaDraft, validateRfaDraft, type RfaDraftInput } from "../packages/react/src/rfa-draft-form";
const dental = (): DentalDraftContentInput => ({ renderingProviderId: "provider_demo", diagnosisCodes: [], notes: null, lines: [{ code: "D0120", description: "Synthetic service", editionYear: 2026, serviceDate: "2026-09-06", quantity: 4, chargeCents: 20000, chargeReference: "Practice charge", teeth: ["19"], surfaces: ["O"], oralCavity: null, prosthesisNotes: null }] });
const rfa = (): RfaDraftInput => ({ claimId: "claim_demo", patientId: "patient_demo", renderingProviderId: "provider_demo", employeeName: "Synthetic Employee", providerName: "Synthetic Provider", items: [{ diagnosisCode: "M25.561", serviceDescription: "Synthetic requested service", units: 4, requestedFrom: "2026-09-06", requestedTo: "2026-09-30" }] });
describe("dental draft charge semantics", () => {
  it("keeps unknown charges distinct and never multiplies an extended amount", () => {
    expect(dentalDraftChargeSummary(dental().lines)).toEqual({ knownChargeCents: 20000, totalChargeCents: 20000 });
    expect(dentalDraftChargeSummary([...dental().lines, { chargeCents: null }])).toEqual({ knownChargeCents: 20000, totalChargeCents: null });
    expect(parseDentalCharge("")).toBeNull(); expect(parseDentalCharge("125.05")).toBe(12505);
  });
  it.each(["0", "0.00", "-1", "1.001", "1e2", "NaN", "Infinity", "10000000.01"])("rejects invalid charge %s", (value) => expect(() => parseDentalCharge(value)).toThrow());
  it("permits incomplete code/price draft but rejects invalid known values", () => {
    const draft = dental(); expect(validateDentalDraftContent(draft)).toBeNull();
    draft.lines[0]!.code = null; draft.lines[0]!.chargeCents = null; expect(validateDentalDraftContent(draft)).toBeNull();
    draft.lines[0]!.code = "99213"; expect(validateDentalDraftContent(draft)).toMatch(/D followed/);
    draft.lines[0]!.code = "D0120"; draft.lines[0]!.serviceDate = "2026-02-30"; expect(validateDentalDraftContent(draft)).toMatch(/date/);
  });
});
describe("unsigned RFA preparation", () => {
  it("preserves identifiers, metadata, explicit fax clearing and host quantities without mutating input", () => {
    const draft = { ...rfa(), providerFax: "", metadata: { source: "synthetic" }, signedAt: "2026-09-06T12:00:00Z" };
    const result = normalizeRfaDraft(draft); expect(result).not.toHaveProperty("signedAt"); expect(draft).toHaveProperty("signedAt");
    expect(result.providerFax).toBe(""); expect(result.items[0]?.units).toBe(4); expect(result.metadata).toEqual({ source: "synthetic" }); expect(validateRfaDraft(result)).toBeNull();
  });
  it("requires material change for resubmission", () => {
    const draft = { ...rfa(), requestType: "resubmission_material_change" as const };
    expect(validateRfaDraft(draft)).toMatch(/material change/); expect(validateRfaDraft({ ...draft, materialChange: "New clinical evidence" })).toBeNull();
  });
  it("rejects invalid date ranges and nonexistent dates", () => {
    const draft = rfa(); draft.items[0]!.requestedFrom = "2026-10-01"; expect(validateRfaDraft(draft)).toMatch(/dates/);
    draft.items[0]!.requestedFrom = "2026-02-30"; expect(validateRfaDraft(draft)).toMatch(/dates/);
    delete draft.items[0]!.requestedFrom; expect(validateRfaDraft(draft)).toMatch(/dates/);
  });
  it("normalizes cleared optional fields and rejects zero units or malformed fax", () => {
    const draft = rfa(); draft.items[0]!.procedureCode = ""; draft.items[0]!.requestedTo = "";
    expect(validateRfaDraft(normalizeRfaDraft(draft))).toBeNull(); draft.items[0]!.units = 0; expect(validateRfaDraft(normalizeRfaDraft(draft))).toMatch(/units/);
    expect(validateRfaDraft({ ...rfa(), providerFax: "555" })).toMatch(/fax/);
  });
});
