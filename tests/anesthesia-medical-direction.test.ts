import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CaMedicalDirection } from "../packages/browser/src/index";
import { anesthesiaCalculationContext, anesthesiaDetailsFromSaved } from "../packages/react/src/bill-anesthesia-context";
import { directionFromDraft, type DirectionDraft } from "../packages/react/src/anesthesia-direction-fields";
import { AnesthesiaCalculationDetails } from "../packages/react/src/anesthesia-calculation-details";
import { DEFAULT_BILL_SUBMISSION_MODIFIERS } from "../packages/react/src/billing-catalog";

// Synthetic transport records. The server is responsible for clinical eligibility.
const event = (minute: number) => ({ physicianRef: "physician-synthetic", recordRef: "record-synthetic", minute });
const presence = (startMinute: number, endMinute: number) => ({ physicianRef: "physician-synthetic", recordRef: "record-synthetic", startMinute, endMinute });
export const direction: CaMedicalDirection = {
  physicianRef: "physician-synthetic", groupPhysicianRefs: [], billedCaseRef: "case-a",
  rosterScope: "all_overlapping_cases_all_payers", rosterRecordRef: "roster-synthetic",
  cases: ["case-a", "case-b"].map((caseRef, i) => ({
    caseRef, anesthetistRole: "crna", qualificationRecordRef: "qualification-synthetic", procedure: "other",
    interval: { startMinute: 480 + i * 15, endMinute: 540 + i * 15 },
    activities: { preAnestheticEvaluation: event(450 + i), prescribedPlan: event(460 + i),
      demandingProcedures: [presence(480 + i * 15, 482 + i * 15)],
      induction: presence(480 + i * 15, 482 + i * 15), emergence: { applicability: "not_indicated", recordRef: "emergence-record" },
      qualifiedAnesthetistProcedures: event(481 + i * 15),
      frequentMonitoring: { recordRef: "monitoring-record", observations: [event(510 + i)] },
      indicatedPostAnesthesiaCare: event(570 + i),
    },
  })),
  physicalPresenceAndImmediateAvailability: [presence(480, 555)], otherPatientServices: [],
};
const draft = () => structuredClone(direction) as unknown as DirectionDraft;
const mac = { medicallyNecessary: "true", intraoperativePhysiologicalMonitoring: "true", preparedForGeneralAnesthesiaOrAdverseReaction: "true", perioperativeAnesthesiaCare: "true", underlyingProcedureProvider: "different_provider", underlyingProcedure: "other" };
describe("anesthesia direction and MAC public transport", () => {
  it("preserves all direction records across draft recovery and derives elapsed minutes", () => {
    const context = anesthesiaCalculationContext("22", { anesthesiaDocumentation: "directed", anesthesiaMinutes: "999", anesthesiaDirection: draft() });
    expect(context.anesthesiaContext).toMatchObject({ personallyPerformedAlone: false, actualMinutes: 60, medicalDirection: direction });
    expect(anesthesiaCalculationContext("22", anesthesiaDetailsFromSaved(context))).toEqual(context);
  });
  it("does not issue a replacement context for incomplete, ambiguous or invalid records", () => {
    const bad = [ { ...draft(), billedCaseRef: "missing" }, { ...draft(), physicianRef: " " }, { ...draft(), cases: [direction.cases[0], direction.cases[0]] },
      { ...draft(), physicalPresenceAndImmediateAvailability: [] },
      { ...draft(), cases: [{ ...direction.cases[0], interval: { startMinute: 480, endMinute: 480 } }] },
      { ...draft(), cases: [{ ...direction.cases[0], activities: { ...direction.cases[0]!.activities, frequentMonitoring: { recordRef: "record", observations: [] } } }] },
    ];
    for (const anesthesiaDirection of bad) expect(anesthesiaCalculationContext("22", { anesthesiaDocumentation: "directed", anesthesiaDirection })).toEqual({});
    expect(directionFromDraft(undefined)).toBeUndefined();
  });
  it("requires every MAC clinical fact and preserves it with personal or directed cases", () => {
    for (const anesthesiaDocumentation of ["verified", "directed"] as const) {
      const details = { anesthesiaDocumentation, anesthesiaMinutes: "60", anesthesiaDirection: draft(), anesthesiaCare: "monitored" as const, anesthesiaMonitoredFacts: mac };
      const context = anesthesiaCalculationContext("22", details);
      expect(context.anesthesiaContext?.monitoredCare?.underlyingProcedureProvider).toBe("different_provider");
      expect(anesthesiaCalculationContext("22", anesthesiaDetailsFromSaved(context))).toEqual(context);
      for (const key of Object.keys(mac)) expect(anesthesiaCalculationContext("22", { ...details, anesthesiaMonitoredFacts: { ...mac, [key]: "" } })).toEqual({});
      expect(anesthesiaCalculationContext("22", { ...details, anesthesiaMonitoredFacts: { ...mac, medicallyNecessary: "false" } })).toEqual({});
    }
  });
  it("offers AA, QK and QS modifiers and shows server calculation evidence", () => {
    expect(DEFAULT_BILL_SUBMISSION_MODIFIERS.map(item => item.code)).toEqual(expect.arrayContaining(["AA", "QK", "QS"]));
    const markup = renderToStaticMarkup(createElement(AnesthesiaCalculationDetails, { quote: {
      status: "priced", amountCents: 12345, scheduleMaximumCents: 12345, basis: "ca_anesthesia", notes: ["Monitored anesthesia care under the adopted rule."],
      provenance: [{ id: "Synthetic authority", url: "https://www.dir.ca.gov/dwc/", effectiveFrom: "2026-01-01", effectiveThrough: "2026-12-31" }],
      anesthesia: { actualMinutes: 60, baseUnits: 5, timeUnitsTenths: 40, conversionFactorCents: 8000, locality: "Synthetic locality", medicalDirection: { concurrentCases: 2, baseReductionPercent: 10, physicianPaymentPercent: 50 } },
    } }));
    expect(markup).toContain("Base units × 90% + time units");
    expect(markup).toContain("Physician payment share");
    expect(markup).toContain("Monitored anesthesia care under the adopted rule");
    expect(markup).toContain("https://www.dir.ca.gov/dwc/");
    expect(markup).toContain("2026-01-01–2026-12-31");
  });
});
