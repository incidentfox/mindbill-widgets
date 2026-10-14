import { expect, it } from "vitest";
import type { RfaRecord } from "../packages/browser/src/index";
import { rfaSendFix } from "../packages/react/src/rfa-send-fix";
const record = {
  status: "draft", transmissions: [],
  claimId: "synthetic_claim", patientId: "synthetic_patient", renderingProviderId: "synthetic_provider",
  employeeName: "Synthetic patient", providerName: "Synthetic provider", reviewType: "prospective",
  items: [{ id: "synthetic_item", diagnosisCode: "M54.5", diagnosisDescription: "Low back pain", serviceDescription: "Rehabilitation" }],
  documents: [{ id: "synthetic_report", documentType: "clinical_report" }],
} as unknown as RfaRecord;
it("offers document recovery only for selected supporting reports", () => {
  expect(rfaSendFix(record, [], {})?.label).toBe("Add documents");
  expect(rfaSendFix({ ...record, documents: [{ id: "synthetic_form", documentType: "rfa_form" }] } as RfaRecord, ["synthetic_form"], {})?.label).toBe("Add documents");
  expect(rfaSendFix(record, ["synthetic_report"], {})).toBeNull();
});
it("offers editing for invalid services and missing diagnosis descriptions", () => {
  expect(rfaSendFix({ ...record, items: [] }, ["synthetic_report"], {})).toMatchObject({ label: "Edit request", message: "Include between 1 and 100 requested services." });
  expect(rfaSendFix(record, ["synthetic_report"], { synthetic_item: "" })).toMatchObject({ label: "Edit request", message: "Add the diagnosis for M54.5 before sending." });
});
