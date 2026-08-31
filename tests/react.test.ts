import { describe, expect, it, vi } from "vitest";

import {
  buildBillReviewSaveInput,
  ensureTrailingProcedureLine,
  type BillReviewDraft,
} from "../packages/react/src/native-bill-review";
import { createBillStatusClient } from "../packages/react/src/connected-bill-status";
import { createBillLifecycleClient } from "../packages/react/src/connected-bill-lifecycle";
import { sanitizeBillReviewSaveInput } from "../packages/browser/src/index";
import {
  mindBillAppearanceStyle,
  resolveMindBillAppearance,
} from "../packages/react/src/appearance";
import {
  billActivityEventLabel,
  billLifecycleStage,
  visibleBillLifecycleActions,
} from "../packages/react/src/bill-lifecycle-surfaces";
import {
  applyBillSubmissionEvaluationModifiers,
  BILL_SUBMISSION_REQUIRED_FIELDS,
  ensureTrailingBillSubmissionLine,
  formatBillSubmissionDate,
  parseBillSubmissionDate,
  type BillSubmissionInput,
  validateBillSubmission,
} from "../packages/react/src/bill-submission-form";
import type { CreateBillRequest } from "../packages/node/src/index";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("partner appearance presets", () => {
  it("ships complete QME Companion, orange-bright, and clinical-blue presets", () => {
    expect(resolveMindBillAppearance({ preset: "qme-companion" })).toMatchObject({
      accentColor: "#53b5dc",
      textColor: "#1d3440",
      borderRadius: "12px",
    });
    expect(resolveMindBillAppearance({ preset: "orange-bright" })).toMatchObject({
      accentColor: "#ff4f0a",
      textColor: "#111827",
      controlRadius: "6px",
    });
    expect(resolveMindBillAppearance({ preset: "clinical-blue" })).toMatchObject({
      accentColor: "#1677ff",
      backgroundColor: "#f5f7fa",
      textColor: "#1f2d3d",
      controlRadius: "6px",
    });
  });

  it("layers explicit tokens over the selected preset", () => {
    const style = mindBillAppearanceStyle({
      preset: "orange-bright",
      accentColor: "#f97316",
      borderRadius: "4px",
    });

    expect(style).toMatchObject({
      "--mb-accent": "#f97316",
      "--mb-accent-contrast": "#ffffff",
      "--mb-radius": "4px",
      "--mb-control-radius": "6px",
    });
  });
});

describe("atomic bill submission form contract", () => {
  const validBill: BillSubmissionInput = {
    externalId: "evaluation_123",
    billingMode: "med_legal",
    patient: {
      firstName: "Ada",
      lastName: "Example",
      dateOfBirth: "1980-01-02",
      address: {
        line1: "100 Main Street",
        city: "Sacramento",
        state: "CA",
        postalCode: "95814",
      },
    },
    claim: {
      claimNumber: "CLAIM-7",
      claimsAdministrator: { id: "payer_7", name: "Synthetic Claims Administrator" },
    },
    service: { date: "2026-08-24" },
    serviceLines: [{ code: "ML201", units: 1 }],
  };

  it("uses the same browser-safe bill shape as the server SDK", () => {
    const sdkInput: CreateBillRequest = validBill;
    const componentInput: BillSubmissionInput = sdkInput;

    expect(componentInput).toBe(validBill);
  });

  it("owns and exports required-field rules", () => {
    expect(BILL_SUBMISSION_REQUIRED_FIELDS).toContain("patient.dateOfBirth");
    expect(BILL_SUBMISSION_REQUIRED_FIELDS).toContain("patient.address.state");
    expect(BILL_SUBMISSION_REQUIRED_FIELDS).toContain("claim.claimsAdministrator");
    expect(BILL_SUBMISSION_REQUIRED_FIELDS).toContain("serviceLines[].code");
    expect(validateBillSubmission(validBill)).toEqual({
      valid: true,
      fieldErrors: {},
    });
  });

  it("requires the claims administrator to come from the payer directory", () => {
    const result = validateBillSubmission({
      ...validBill,
      claim: { ...validBill.claim, claimsAdministrator: { name: "Arbitrary payer text" } },
    });

    expect(result.fieldErrors["claim.claimsAdministrator"]).toBe(
      "Select a claims administrator from the payer directory.",
    );
  });

  it("accepts paste-friendly US dates and rejects impossible dates", () => {
    expect(parseBillSubmissionDate("01/26/1985")).toBe("1985-01-26");
    expect(parseBillSubmissionDate("01261985")).toBe("1985-01-26");
    expect(formatBillSubmissionDate("1985-01-26")).toBe("01/26/1985");
    expect(parseBillSubmissionDate("02/30/1985")).toBeUndefined();
  });

  it("keeps one automatic empty service line without submitting it", () => {
    expect(ensureTrailingBillSubmissionLine([{ code: "ML201", units: 1 }])).toEqual([
      { code: "ML201", modifiers: [], units: 1 },
      { code: "", modifiers: [], units: 1 },
    ]);

    const result = validateBillSubmission({
      ...validBill,
      serviceLines: ensureTrailingBillSubmissionLine(validBill.serviceLines),
    });
    expect(result.valid).toBe(true);
  });

  it("applies the evaluation modifier while preserving other modifiers", () => {
    const lines = [{ code: "ML203", modifiers: ["93", "95"], units: 1 }];
    expect(applyBillSubmissionEvaluationModifiers(lines, "ame")[0]?.modifiers).toEqual([
      "94",
      "93",
    ]);
    expect(applyBillSubmissionEvaluationModifiers(lines, "psych_qme")[0]?.modifiers).toEqual([
      "96",
      "93",
    ]);
  });

  it("rejects missing required values and invalid professional charges", () => {
    const result = validateBillSubmission({
      ...validBill,
      billingMode: "professional",
      patient: {
        ...validBill.patient,
        firstName: "",
        address: { ...validBill.patient.address, state: "California" },
      },
      serviceLines: [{ code: "ML201", units: 0 }],
    });

    expect(result.valid).toBe(false);
    expect(result.fieldErrors).toMatchObject({
      "patient.firstName": "Required",
      "patient.address.state": "Use a 2-letter state code",
      "serviceLines.0.units": "Enter at least 1 unit",
      "serviceLines.0.charge": "Enter the billed charge",
    });
  });
});

describe("bill lifecycle surfaces", () => {
  it("shows only enabled server-authoritative actions by default", () => {
    const actions = [
      { id: "view_eor", label: "View EOR", enabled: true },
      { id: "second_review", label: "Second Bill Review", enabled: false, reason: "No EOR yet" },
    ] as const;

    expect(visibleBillLifecycleActions(actions)).toEqual([actions[0]]);
    expect(visibleBillLifecycleActions(actions, true)).toEqual(actions);
  });

  it("labels known and future event types", () => {
    expect(billActivityEventLabel("bill.denied")).toBe("Bill denied");
    expect(billActivityEventLabel("bill.custom_follow_up")).toBe("Bill Custom Follow Up");
  });

  it("maps native lifecycle states into the compact progress rail", () => {
    expect(billLifecycleStage("submitted")).toBe("submitted");
    expect(billLifecycleStage("accepted")).toBe("accepted");
    expect(billLifecycleStage("rejected")).toBe("processed");
    expect(billLifecycleStage("processed")).toBe("processed");
    expect(billLifecycleStage("paid")).toBe("processed");
    expect(billLifecycleStage("closed")).toBe("closed");
  });
});

describe("bill review mutation snapshots", () => {
  it("removes display-only lifecycle fields before a v2 save", () => {
    const input = {
      claimsAdminId: "payer-1",
      dos: "2026-08-24",
      billingProvider: {
        id: "provider-1",
        name: "Example Evaluators",
        taxId: "123456789",
        npi: "1234567890",
        billType: "Professional",
      },
      renderingProvider: {
        id: "clinician-1",
        qmeSpecialty: "Psychiatry",
        name: "Ada Example, MD",
        specialty: "Psychiatry",
        npi: "1098765432",
      },
      placeOfService: {
        id: "location-1",
        billingProviderId: "provider-1",
        name: "Downtown",
        street: "100 Main Street",
        city: "Sacramento",
        state: "CA",
        zip: "95814",
      },
      lineItems: [{
        id: "line-1",
        feeSchedule: 2015,
        code: "ML201",
        modifiers: ["95"],
        units: 1,
      }],
    } as unknown as Parameters<typeof sanitizeBillReviewSaveInput>[0];

    expect(sanitizeBillReviewSaveInput(input)).toEqual({
      claimsAdminId: "payer-1",
      dos: "2026-08-24",
      billingProvider: {
        name: "Example Evaluators",
        taxId: "123456789",
        npi: "1234567890",
        billType: "Professional",
      },
      renderingProvider: {
        name: "Ada Example, MD",
        specialty: "Psychiatry",
        npi: "1098765432",
      },
      placeOfService: {
        billingProviderId: "provider-1",
        name: "Downtown",
        street: "100 Main Street",
        city: "Sacramento",
        state: "CA",
        zip: "95814",
      },
      lineItems: [{
        id: "line-1",
        code: "ML201",
        modifiers: ["95"],
        units: 1,
      }],
    });
  });
});

describe("native bill review", () => {
  it("keeps exactly one keyboard-ready procedure row", () => {
    expect(ensureTrailingProcedureLine([])).toEqual([
      { code: "", modifiers: [], units: 1, charge: 0 },
    ]);

    expect(ensureTrailingProcedureLine([
      { code: "ML201", modifiers: ["95"], units: 1, charge: 2015 },
      { code: "", modifiers: [], units: 1, charge: 0 },
      { code: "", modifiers: [], units: 1, charge: 0 },
    ])).toEqual([
      { code: "ML201", modifiers: ["95"], units: 1, charge: 2015 },
      { code: "", modifiers: [], units: 1, charge: 0 },
    ]);
  });

  it("grows when the current row is partially entered", () => {
    for (const partial of [
      { code: "ML201", modifiers: [], units: 1, charge: 0 },
      { code: "", modifiers: ["95"], units: 1, charge: 0 },
      { code: "", modifiers: [], units: 2, charge: 0 },
    ]) {
      const lines = ensureTrailingProcedureLine([partial]);
      expect(lines).toHaveLength(2);
      expect(lines.at(-1)).toEqual({
        code: "",
        modifiers: [],
        units: 1,
        charge: 0,
      });
    }
  });

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
        name: "Example Evaluators",
        taxId: "123456789",
        npi: "1234567890",
        billType: "Professional",
      },
      clinician: {
        name: "Ada Example, MD",
        specialty: "Occupational medicine",
        npi: "1098765432",
      },
      location: {
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
        { code: "", modifiers: [], units: 1, charge: 0 },
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
      billingProvider: {
        name: "Example Evaluators",
        taxId: "123456789",
        npi: "1234567890",
        billType: "Professional",
      },
      renderingProvider: {
        name: "Ada Example, MD",
        specialty: "Occupational medicine",
        npi: "1098765432",
      },
      placeOfService: {
        name: "Downtown",
        street: "100 Main Street",
        city: "Sacramento",
        state: "CA",
        zip: "95814",
        posCode: "11",
      },
      lineItems: [
        { id: "line-1", code: "ML201", modifiers: ["95"], units: 1, charge: 2015 },
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
    expect(fetcher.mock.calls[0]?.[0]).toBe("/api/mindbill/session");
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      credentials: "same-origin",
      body: JSON.stringify({}),
    });
    expect(fetcher.mock.calls[1]?.[0]).toBe(
      "https://app.mindbill.org/partner/v2/browser/bills/bill_123/status",
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
    activity: [],
    payments: [],
    remittance: {
      payerReportedPaid: null,
      totalPaid: 0,
      balanceDue: 2015,
      denialReason: "Synthetic denial reason",
    },
    delivery: {
      payerName: "Synthetic Claims Administrator",
      contacts: {},
    },
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

    expect(fetcher.mock.calls[0]?.[0]).toBe("/api/mindbill/session");
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({}),
    });
    expect(fetcher.mock.calls[1]?.[0]).toBe(
      "https://app.mindbill.org/partner/v2/browser/bills/bill_789/lifecycle",
    );
    expect(fetcher.mock.calls[2]?.[0]).toBe(
      "https://app.mindbill.org/partner/v2/browser/bills/bill_789/actions",
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

  it("downloads the immutable submission packet and reopens a closed bill", async () => {
    const packet = new Blob(["synthetic packet"], { type: "application/pdf" });
    const reopened = {
      ...lifecycle,
      lifecycle: { ...lifecycle.lifecycle, state: "processed", nativeStatus: "PROCESSED" },
    };
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({
        token: "short-lived-lifecycle-token",
        expiresAt: "2099-08-26T00:00:00.000Z",
      }))
      .mockResolvedValueOnce(new Response(packet, { headers: { "content-type": "application/pdf" } }))
      .mockResolvedValueOnce(jsonResponse({ data: reopened }));
    const client = createBillLifecycleClient({ billId: "bill_789", fetch: fetcher });

    await expect(client.getPacket()).resolves.toBeInstanceOf(Blob);
    await expect(client.reopenBill({ reason: "Continue payer follow-up." })).resolves.toMatchObject({
      lifecycle: { state: "processed" },
    });
    expect(fetcher.mock.calls[1]?.[0]).toBe(
      "https://app.mindbill.org/partner/v2/browser/bills/bill_789/packet",
    );
    expect(fetcher.mock.calls[2]?.[1]?.body).toBe(JSON.stringify({
      action: "reopen",
      reason: "Continue payer follow-up.",
    }));
  });

  it("passes claim context through payer search and preserves recommendation reasons", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({
        token: "short-lived-payer-session-token",
        expiresAt: "2099-08-26T00:00:00.000Z",
      }))
      .mockResolvedValueOnce(jsonResponse({
        recommendedId: "pd:example-claims",
        results: [{
          id: "pd:example-claims",
          name: "Example Claims Services",
          hasElectronic: true,
          states: ["CA"],
          confidence: "high",
          recommended: true,
          signals: [
            {
              kind: "name",
              state: "match",
              label: "Exact directory alias match.",
            },
            {
              kind: "claim_number",
              state: "warning",
              label: "This claim number does not match the payer's usual format; selection is still allowed.",
            },
          ],
        }],
      }));
    const client = createBillLifecycleClient({
      billId: "bill_789",
      fetch: fetcher,
    });

    await expect(
      client.searchClaimsAdministrators("Example TPA", "OTHER123"),
    ).resolves.toEqual([{
      id: "pd:example-claims",
      name: "Example Claims Services",
      hasElectronic: true,
      states: ["CA"],
      confidence: "high",
      recommended: true,
      signals: [
        {
          kind: "name",
          state: "match",
          label: "Exact directory alias match.",
        },
        {
          kind: "claim_number",
          state: "warning",
          label: "This claim number does not match the payer's usual format; selection is still allowed.",
        },
      ],
    }]);
    expect(fetcher.mock.calls[1]?.[0]).toBe(
      "https://app.mindbill.org/partner/v2/browser/claims-administrators?q=Example+TPA&claimNumber=OTHER123",
    );
  });

  it("reads the direct delivery-options response returned by the v2 browser endpoint", async () => {
    const deliveryOptions = {
      payerName: "Example Claims Services",
      recommended: {
        route: "ebill",
        label: "E-bill",
        detail: "Electronic submission through the payer connection.",
      },
      options: [
        {
          route: "ebill",
          label: "E-bill",
          detail: "Electronic submission through the payer connection.",
        },
        {
          route: "fax",
          label: "Fax",
          detail: "Send to the payer fax number.",
          target: "(555) 010-2040",
        },
      ],
      contacts: {
        fax: "(555) 010-2040",
      },
    };
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({
        token: "short-lived-delivery-session-token",
        expiresAt: "2099-08-26T00:00:00.000Z",
      }))
      .mockResolvedValueOnce(jsonResponse(deliveryOptions));
    const client = createBillLifecycleClient({
      billId: "bill_789",
      fetch: fetcher,
    });

    await expect(client.getDeliveryOptions()).resolves.toEqual(deliveryOptions);
    expect(fetcher.mock.calls[1]?.[0]).toBe(
      "https://app.mindbill.org/partner/v2/browser/bills/bill_789/delivery-options",
    );
  });

  it("requires a submitted bill ID", () => {
    expect(() => createBillLifecycleClient({ billId: "", fetch: vi.fn<typeof fetch>() })).toThrow(
      "billId is required",
    );
  });
});
