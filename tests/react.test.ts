import { describe, expect, it, vi } from "vitest";

import {
  buildBillReviewSaveInput,
  type BillReviewDraft,
} from "../packages/react/src/native-bill-review";
import { createBillStatusClient } from "../packages/react/src/connected-bill-status";
import { createBillLifecycleClient } from "../packages/react/src/connected-bill-lifecycle";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("native bill review", () => {
  it("freezes editable values into the MindBill review contract", () => {
    const draft: BillReviewDraft = {
      patientFirstName: "Ada",
      patientMiddleName: "",
      patientLastName: "Example",
      patientDob: "1980-01-01",
      claimNumber: "CLAIM-7",
      employer: "Example Employer",
      doi: "2026-08-01",
      injuryEndDate: "",
      cumulativeTrauma: false,
      adjNumber: "ADJ1234567",
      dos: "2026-08-24",
      dosEnd: "",
      authorizationNumber: "  AUTH-7  ",
      claimsAdminId: "payer-1",
      claimsAdminName: "Example Claims Administrator",
      billingProvider: {
        id: "provider-1",
        name: "Example Evaluators",
        taxId: "123456789",
        npi: "1234567890",
        billType: "Professional",
      },
      clinician: {
        id: "clinician-1",
        name: "Ada Example, MD",
        specialty: "Occupational medicine",
        npi: "1098765432",
      },
      location: {
        id: "location-1",
        name: "Downtown",
        street: "100 Main Street",
        city: "Sacramento",
        state: "CA",
        zip: "95814",
        posCode: "11",
      },
      lineItems: [
        {
          id: "line-1",
          code: " ml201 ",
          modifiers: ["95"],
          units: 1,
          charge: 2015,
        },
      ],
    };

    expect(buildBillReviewSaveInput(draft)).toEqual({
      patientOverrides: {
        firstName: "Ada",
        lastName: "Example",
        dob: "1980-01-01",
      },
      injuryOverrides: {
        claimNumber: "CLAIM-7",
        employer: "Example Employer",
        doi: "2026-08-01",
        cumulativeTrauma: false,
        adjNumber: "ADJ1234567",
      },
      dos: "2026-08-24",
      dosEnd: null,
      authorizationNumber: "AUTH-7",
      claimsAdminId: "payer-1",
      billingProviderId: "provider-1",
      billingProvider: {
        name: "Example Evaluators",
        taxId: "123456789",
        npi: "1234567890",
        billType: "Professional",
      },
      renderingProviderId: "clinician-1",
      renderingProvider: {
        name: "Ada Example, MD",
        specialty: "Occupational medicine",
        npi: "1098765432",
      },
      placeOfServiceId: "location-1",
      placeOfService: {
        name: "Downtown",
        street: "100 Main Street",
        city: "Sacramento",
        state: "CA",
        zip: "95814",
        posCode: "11",
      },
      lineItems: [
        { id: "line-1", code: "ML201", modifiers: ["95"], units: 1 },
      ],
    });
  });
});

describe("connected bill status", () => {
  it("mints one browser session and reads status directly from MindBill", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({
        token: "short-lived-session-token",
        expiresAt: "2099-08-26T00:00:00.000Z",
      }))
      .mockImplementation(async () => jsonResponse({
        data: {
          billId: "bill_123",
          state: "processed",
          nativeStatus: "PROCESSED",
          submittedAt: "2026-08-12T00:00:00.000Z",
          agingDays: 14,
          updatedAt: "2026-08-26T00:00:00.000Z",
          totalCharge: 2015,
          totalPaid: 0,
          balanceDue: 2015,
        },
      }));
    const client = createBillStatusClient({
      billId: "bill_123",
      fetch: fetcher,
    });

    await expect(client.getStatus()).resolves.toMatchObject({
      billId: "bill_123",
      state: "processed",
      balanceDue: 2015,
    });
    await client.getStatus();

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[0]?.[0]).toBe("/api/mindbill/status-session");
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      credentials: "same-origin",
      body: JSON.stringify({ billId: "bill_123" }),
    });
    expect(fetcher.mock.calls[1]?.[0]).toBe(
      "https://app.mindbill.org/embed/api/bill-timeline",
    );
    expect(fetcher.mock.calls[1]?.[1]?.headers).toEqual({
      authorization: "Bearer short-lived-session-token",
    });
  });

  it("renews an expired browser session once after a 401", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ token: "expired-session-token" }))
      .mockResolvedValueOnce(jsonResponse({ error: "expired" }, 401))
      .mockResolvedValueOnce(jsonResponse({ token: "renewed-session-token" }))
      .mockResolvedValueOnce(jsonResponse({
        data: {
          state: "paid",
          totalCharge: 500,
          totalPaid: 500,
          balanceDue: 0,
        },
      }));
    const client = createBillStatusClient({
      billId: "bill_456",
      fetch: fetcher,
    });

    await expect(client.getStatus()).resolves.toMatchObject({
      billId: "bill_456",
      state: "paid",
      nativeStatus: "paid",
      balanceDue: 0,
    });
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(fetcher.mock.calls[3]?.[1]?.headers).toEqual({
      authorization: "Bearer renewed-session-token",
    });
  });
});

describe("connected bill lifecycle", () => {
  const lifecycle = {
    bill: {
      id: "bill_789",
      billNumber: 789,
      status: "denied",
      totalCharge: 2015,
      totalPaid: 0,
      balanceDue: 2015,
      attachments: [],
    },
    patient: { name: "Synthetic Patient" },
    injury: { claimNumber: "TEST-CLAIM" },
    lifecycle: {
      state: "denied",
      nativeStatus: "DENIED",
      submittedAt: "2026-08-01T12:00:00.000Z",
      agingDays: 25,
      updatedAt: "2026-08-04T12:00:00.000Z",
      actions: [
        { id: "second_review", label: "Submit Second Review", enabled: true },
        { id: "close", label: "Close bill", enabled: true },
      ],
    },
    eors: [],
  };

  it("owns session exchange, lifecycle reads, and status-specific actions", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({
        token: "short-lived-lifecycle-token",
        expiresAt: "2099-08-26T00:00:00.000Z",
      }))
      .mockResolvedValueOnce(jsonResponse({ data: lifecycle }))
      .mockResolvedValueOnce(jsonResponse({ data: lifecycle }));
    const client = createBillLifecycleClient({
      billId: "bill_789",
      fetch: fetcher,
    });

    await expect(client.getLifecycle()).resolves.toMatchObject({
      lifecycle: {
        state: "denied",
        submittedAt: "2026-08-01T12:00:00.000Z",
        agingDays: 25,
        updatedAt: "2026-08-04T12:00:00.000Z",
      },
    });
    await expect(client.submitSecondReview({
      reason: "The report supports the billed service.",
      payerClaimControlNumber: "TEST-PCN-7",
      disputedAmount: 2015,
      attachmentIds: ["doc_1"],
      route: "ebill",
    })).resolves.toMatchObject({ lifecycle: { state: "denied" } });

    expect(fetcher.mock.calls[0]?.[0]).toBe("/api/mindbill/bill-session");
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ billId: "bill_789", component: "bill-review" }),
    });
    expect(fetcher.mock.calls[1]?.[0]).toBe(
      "https://app.mindbill.org/embed/api/bill-lifecycle",
    );
    expect(fetcher.mock.calls[2]?.[0]).toBe(
      "https://app.mindbill.org/embed/api/bill-lifecycle/actions",
    );
    const actionHeaders = new Headers(fetcher.mock.calls[2]?.[1]?.headers);
    expect(actionHeaders.get("authorization")).toBe(
      "Bearer short-lived-lifecycle-token",
    );
    expect(actionHeaders.get("idempotency-key")).toBeTruthy();
    expect(fetcher.mock.calls[2]?.[1]?.body).toBe(JSON.stringify({
      action: "second_review",
      reason: "The report supports the billed service.",
      payerClaimControlNumber: "TEST-PCN-7",
      disputedAmount: 2015,
      attachmentIds: ["doc_1"],
      route: "ebill",
    }));
  });

  it("switches to the replacement ID returned for a correction draft", async () => {
    const replacement = {
      ...lifecycle,
      bill: { ...lifecycle.bill, id: "bill_790", status: "incomplete" },
      lifecycle: {
        state: "incomplete",
        nativeStatus: "INCOMPLETE",
        actions: [],
      },
    };
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ token: "correction-session-token" }))
      .mockResolvedValueOnce(jsonResponse({
        replacementBillId: "bill_790",
        data: replacement,
      }));
    const client = createBillLifecycleClient({
      billId: "bill_789",
      fetch: fetcher,
    });

    await expect(client.startCorrection()).resolves.toMatchObject({
      replacementBillId: "bill_790",
      data: { bill: { id: "bill_790", status: "incomplete" } },
    });
  });
});
