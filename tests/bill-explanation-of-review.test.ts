import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BillExplanationOfReview } from "../packages/react/src/bill-lifecycle-surfaces";

describe("BillExplanationOfReview", () => {
  it("separates payer-reported amounts from individual posted payments", () => {
    const html = renderToStaticMarkup(createElement(BillExplanationOfReview, {
      remittance: {
        billedAmount: 2576,
        expectedAmount: 2576,
        payerAllowedAmount: null,
        payerReportedPaid: 1288,
        postedPrincipal: 1288,
        postedAdditional: 0,
        totalPostedCash: 1288,
        balanceDue: 1288,
        denialReason: null,
      },
      eors: [{ id: "eor-1", filename: "Synthetic_EOR.pdf", description: null, addedAt: "2026-08-27T07:30:00Z", contentUrl: "/eor-1" }],
      payments: [
        { id: "payment-a", method: "check", checkNumber: "DEMO-A", status: "deposited", depositDate: "2026-08-27", checkReceived: true, receivedDate: "2026-08-27", amount: 644, principalAmount: 644, feeAmount: null, feeReason: null, source: "paper", postedAt: "2026-08-27T07:30:00Z", updatedAt: null, note: null },
        { id: "payment-b", method: "check", checkNumber: "DEMO-B", status: "deposited", depositDate: "2026-09-10", checkReceived: true, receivedDate: "2026-09-10", amount: 644, principalAmount: 644, feeAmount: null, feeReason: null, source: "paper", postedAt: "2026-09-10T07:30:00Z", updatedAt: null, note: null },
      ],
      submittedAt: "2026-07-20T04:30:00Z",
      onPostPayment: () => undefined,
    }));

    expect(html).toContain("Payer response history");
    expect(html).toContain("Payments posted");
    expect(html).toContain("Post payment");
    expect(html).toContain("Expected under MLFS");
    expect(html).toContain("Not reported");
    expect(html.match(/DEMO-A/g)).toHaveLength(1);
    expect(html.match(/DEMO-B/g)).toHaveLength(1);
    expect(html.match(/\$644\.00/g)).toHaveLength(4);
  });

  it("supports legacy callers that provide payments only on submissions", () => {
    const payment = { id: "payment-a", method: "check", checkNumber: "DEMO-A", status: "deposited", depositDate: "2026-08-27", checkReceived: true, receivedDate: "2026-08-27", amount: 644, principalAmount: 644, feeAmount: null, feeReason: null, source: "paper", postedAt: "2026-08-27T07:30:00Z", updatedAt: null, note: null } as const;
    const html = renderToStaticMarkup(createElement(BillExplanationOfReview, {
      remittance: {
        billedAmount: 2576,
        expectedAmount: 2576,
        payerAllowedAmount: null,
        payerReportedPaid: 644,
        postedPrincipal: 644,
        postedAdditional: 0,
        totalPostedCash: 644,
        balanceDue: 1932,
        denialReason: null,
      },
      eors: [],
      payments: [],
      submissions: [{
        id: "original",
        label: "Original bill",
        submittedAt: "2026-07-20T04:30:00Z",
        payerReportedPaid: 644,
        eors: [],
        payments: [payment],
      }],
    }));

    expect(html).toContain("Payments posted");
    expect(html.match(/DEMO-A/g)).toHaveLength(1);
  });
});
