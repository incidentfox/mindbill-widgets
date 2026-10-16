import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BillReviewLineItem, HistoricalBillReviewData } from "../packages/browser/src/index";
import { ensureTrailingProcedureLine } from "../packages/react/src/native-bill-review";
import { BillReadOnlyForm } from "../packages/react/src/bill-read-only-form";

const revenue: BillReviewLineItem = { code: "", modifiers: [], units: 1, charge: 150, serviceDate: "2026-09-01", formData: { institutional: { revenueCode: "0450" } } };
const drug: BillReviewLineItem = { code: "", modifiers: [], units: 2.5, charge: 25, serviceDate: "2026-09-01", drug: { ndcNumber: "00000000001", metricQuantity: "2.5", unitOfMeasure: "GR" }, formData: { pharmacy: { prescriptionNumber: "123456", compoundCode: "2" } } };
const dental: BillReviewLineItem = { code: "D2392", modifiers: [], units: 1, charge: 100, serviceDate: "2026-09-01", formData: { dental: { toothNumber: "2", toothSurfaces: ["M", "O"] } } };

describe("specialty review round trips", () => {
  it("retains partially entered metadata in the editor", () => {
    const partial = { code: "", modifiers: [], units: 1, charge: 0, formData: { dental: { toothNumber: "2" } } };
    expect(ensureTrailingProcedureLine([partial])).toHaveLength(2);
  });
  it.each([["ub04", "UB-04", revenue, "Revenue 0450"], ["ncpdp", "NCPDP", drug, "NDC 00000000001"], ["ada", "ADA", dental, "Tooth 2"]] as const)("shows the %s form and line identifiers", (claimForm, label, line, identifier) => {
    const data: HistoricalBillReviewData = { bill: { id: "bill_synthetic", billNumber: "SYNTHETIC", status: "draft", billingMode: "professional", claimForm, dos: "2026-09-01", lineItems: [line], attachments: [], totalCharge: line.charge, totalPaid: 0, balanceDue: line.charge }, patient: { name: "Synthetic Example" }, injury: {} };
    const html = renderToStaticMarkup(createElement(BillReadOnlyForm, { data }));
    expect(html).toContain(label);
    expect(html).toContain(identifier);
  });
});
