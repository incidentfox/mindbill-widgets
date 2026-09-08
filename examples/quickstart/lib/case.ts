import type { BillSubmissionInput } from "@mindbill/react";

// Hand-authored fictional data. This is not a real patient or a clinical assessment.
import { CASE_ID } from "./case-identity";
export { CASE_ID } from "./case-identity";
const address = { line1: "100 Example Avenue", city: "Pasadena", state: "CA", postalCode: "91101" };
export const exampleBill: BillSubmissionInput = {
  externalId: CASE_ID,
  billingMode: "med_legal",
  patient: {
    externalId: "synthetic-patient-001", firstName: "Alex", lastName: "Morgan",
    dateOfBirth: "1985-04-12", gender: "X", address,
  },
  claim: {
    externalId: "synthetic-claim-001", claimNumber: "TEST-2026-001",
    employer: "Example Workshop", dateOfInjury: "2026-06-01", injuryState: "CA",
    // Choose a canonical claims administrator from MindBill before submitting.
  },
  billingProvider: { name: "Example Review Practice", npi: "1234567893", taxId: "000000000", phone: "2025550100", address },
  renderingProvider: { name: "Dr. Jamie Example", npi: "1234567893", taxonomy: "208100000X", isQme: true },
  serviceLocation: { name: "Example Review Practice", address, placeOfServiceCode: "11" },
  service: { date: "2026-08-01" },
  diagnoses: ["M25.512"],
  serviceLines: [{ code: "ML201", units: 1, charge: 2015 }],
};

export const records = [
  { id: "initial", title: "Initial evaluation", date: "Jun 3, 2026", kind: "Office visit", file: "/records/initial-evaluation.txt",
    text: "FICTIONAL RECORD — SOFTWARE DEMONSTRATION ONLY\n\nPatient: Alex Morgan (synthetic-patient-001)\nDate: June 3, 2026\nAuthor: Dr. Jamie Example, Example Review Practice\n\nHistory\nThe fictional patient reports left shoulder discomfort after lifting a box at Example Workshop on June 1. Overhead reaching is described as uncomfortable.\n\nExamination\nThe sample note describes limited active shoulder elevation and localized tenderness. No measurements or findings in this example represent a real examination.\n\nPlan documented in the sample\nA follow-up visit and physical therapy assessment are recorded. This fixture is not medical advice." },
  { id: "therapy", title: "Physical therapy progress", date: "Jun 24, 2026", kind: "Progress note", file: "/records/therapy-progress.txt",
    text: "FICTIONAL RECORD — SOFTWARE DEMONSTRATION ONLY\n\nPatient: Alex Morgan (synthetic-patient-001)\nDate: June 24, 2026\nAuthor: Casey Example, Example Therapy\n\nInterval history\nThe fictional patient describes improved comfort with activities below shoulder level, with continued difficulty reaching overhead.\n\nProgress\nThe sample note records participation in three therapy sessions. It does not include standardized functional scores.\n\nNext review\nThe fictional reviewer should reconcile the remaining functional limitations with the later follow-up note. This fixture is not medical advice." },
  { id: "followup", title: "Follow-up evaluation", date: "Jul 15, 2026", kind: "Office visit", file: "/records/follow-up.txt",
    text: "FICTIONAL RECORD — SOFTWARE DEMONSTRATION ONLY\n\nPatient: Alex Morgan (synthetic-patient-001)\nDate: July 15, 2026\nAuthor: Dr. Jamie Example, Example Review Practice\n\nInterval history\nThe fictional patient reports continued improvement and occasional discomfort with overhead tasks.\n\nRecords reviewed\nThe June 3 evaluation and June 24 therapy note are referenced. The sample documents do not include imaging or a final impairment determination.\n\nReview status\nPrepared for a fictional August 1 med-legal evaluation. This fixture is not a clinical report or medical advice." },
] as const;
