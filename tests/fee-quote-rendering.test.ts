// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { BILL_FEE_QUOTE_BASES } from "../packages/browser/src/index";
import { BillSubmissionForm, type BillSubmissionInput } from "../packages/react/src/bill-submission-form";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const address = { line1: "100 Synthetic Way", city: "Sacramento", state: "CA", postalCode: "95814" };
const bill: BillSubmissionInput = {
  externalId: "synthetic_fee_rendering", billingMode: "professional",
  patient: { firstName: "Ada", lastName: "Example", dateOfBirth: "1980-01-02", address },
  claim: { claimNumber: "SYNTHETIC-7", employer: "Synthetic Foods", dateOfInjury: "2026-08-01",
    claimsAdministrator: { id: "payer_synthetic", name: "Synthetic Claims Administrator" } },
  service: { date: "2026-08-24" },
  billingProvider: { name: "Synthetic Medical Group", taxId: "123456789", npi: "1234567890", phone: "9165550100", address },
  renderingProvider: { name: "Ada Physician", npi: "1098765432", taxonomy: "2084P0800X" },
  serviceLocation: { name: "Synthetic Office", placeOfServiceCode: "11", address },
  diagnoses: ["M79.641"],
  serviceLines: [{ code: "99213", units: 2, serviceDate: "2026-08-24", diagnosisPointers: [1] }],
};

// Exercise the real browser response validator and React consumer together. These
// transport fixtures test rendering, not the server's clinical fee calculation.
it.each([...BILL_FEE_QUOTE_BASES, "unknown_fee_family"])("renders the API result for %s through the browser client", async (basis) => {
  vi.useFakeTimers();
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  const fetcher = vi.fn<typeof fetch>(async (url, init) => {
    if (String(url).endsWith("/partner/v2/fee-quotes")) {
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer synthetic_session");
      return Response.json({ data: { status: "priced", amountCents: 28246, scheduleMaximumCents: 30000,
        basis, provenance: [], notes: [] } });
    }
    return Response.json({ data: [] });
  });
  try {
    await act(async () => root.render(createElement(BillSubmissionForm, {
      initialBill: bill, getSession: async () => ({ token: "synthetic_session" }),
      fetch: fetcher, treatmentBilling: true, deliveryRoutePicker: "off",
    })));
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(fetcher.mock.calls.some(([url]) => String(url).endsWith("/partner/v2/fee-quotes"))).toBe(true);
    if (basis === "unknown_fee_family") {
      expect(container.querySelector(".mbsf-money")?.textContent).toBe("Needs review");
      expect(container.textContent).toContain("Fee lookup is unavailable. Retry the fee check.");
      expect(container.textContent).not.toContain("$282.46");
    } else {
      expect(container.querySelector(".mbsf-money")?.textContent).toBe("$282.46");
      expect(container.textContent).toContain("Fee estimate for this service date and the details above.");
      expect(container.textContent).not.toContain("Fee lookup is unavailable");
      expect(container.textContent).not.toContain("$564.92");
    }
  } finally {
    await act(async () => root.unmount()); container.remove(); vi.useRealTimers();
  }
});
