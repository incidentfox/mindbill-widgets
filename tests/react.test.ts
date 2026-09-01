import { describe, expect, it, vi } from "vitest";

import {
  buildBillReviewSaveInput,
  ensureTrailingProcedureLine,
  type BillReviewDraft,
} from "../packages/react/src/native-bill-review";
import { createBillStatusClient } from "../packages/react/src/connected-bill-status";
import { createBillLifecycleClient } from "../packages/react/src/connected-bill-lifecycle";
import { createBillReferenceClient, sanitizeBillReviewSaveInput } from "../packages/browser/src/index";
import {
  mindBillAppearanceStyle,
  resolveMindBillAppearance,
} from "../packages/react/src/appearance";
import {
  billActivityEventLabel,
  billLifecycleDisplayLabel,
  billLifecycleStage,
  visibleBillLifecycleActions,
} from "../packages/react/src/bill-lifecycle-surfaces";
import {
  applyBillSubmissionEvaluationModifiers,
  BILL_SUBMISSION_REQUIRED_FIELDS,
  BillSubmissionActions,
  BillSubmissionAttachmentsSection,
  BillSubmissionClaimSection,
  BillSubmissionHeader,
  BillSubmissionPatientSection,
  BillSubmissionProvidersSection,
  BillSubmissionServiceLinesSection,
  ensureTrailingBillSubmissionLine,
  formatBillSubmissionDate,
  parseBillSubmissionDate,
  type BillSubmissionInput,
  validateBillSubmission,
} from "../packages/react/src/bill-submission-form";
import type { CreateBillRequest } from "../packages/node/src/index";
import {
  BILL_SUBMISSION_DIAGNOSIS_QUICK_PICKS,
  calculateBillSubmissionAllowedAmount,
  DEFAULT_BILL_SUBMISSION_MODIFIERS,
  DEFAULT_BILL_SUBMISSION_PROCEDURES,
} from "../packages/react/src/billing-catalog";
import {
  billAgingBucket,
  buildBillingReportCsv,
  buildBillingReportRows,
  summarizeBillingDashboard,
  type BillingDashboardBill,
} from "../packages/react/src/billing-dashboard";

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
      accentColor: "#f4510b",
      textColor: "#090f1f",
      controlRadius: "10px",
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
      "--mb-control-radius": "10px",
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

  it("exports composable sections backed by the form's shared state", () => {
    expect([
      BillSubmissionHeader,
      BillSubmissionPatientSection,
      BillSubmissionClaimSection,
      BillSubmissionProvidersSection,
      BillSubmissionServiceLinesSection,
      BillSubmissionAttachmentsSection,
      BillSubmissionActions,
    ].every((component) => typeof component === "function")).toBe(true);
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

  it("ships general workers-comp code choices and calculates med-legal fees", () => {
    expect(DEFAULT_BILL_SUBMISSION_PROCEDURES.map((item) => item.code)).toEqual(
      expect.arrayContaining(["ML201", "99205", "97110", "72148", "L0650"]),
    );
    expect(DEFAULT_BILL_SUBMISSION_MODIFIERS.map((item) => item.code)).toEqual(
      expect.arrayContaining(["95", "59", "XE", "XU"]),
    );
    expect(BILL_SUBMISSION_DIAGNOSIS_QUICK_PICKS.map((item) => item.label)).toEqual(
      expect.arrayContaining(["Back", "Neck", "Left hand", "Right knee"]),
    );
    expect(calculateBillSubmissionAllowedAmount({
      code: "ML203",
      modifiers: ["93", "95"],
      units: 1,
    })).toBe(715);
    expect(calculateBillSubmissionAllowedAmount({
      code: "ML201",
      modifiers: ["96"],
      units: 2,
    })).toBe(8060);
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
      "patient.firstName": "Enter the patient's first name.",
      "patient.address.state": "Use a 2-letter state code",
      "serviceLines.0.units": "Enter at least 1 unit",
      "serviceLines.0.charge": "Enter the billed charge",
    });
  });
});

describe("billing dashboard and reports", () => {
  const bills: BillingDashboardBill[] = [
    {
      id: "bill_1",
      billNumber: 1001,
      patientName: "Alex Example",
      claimNumber: "SYN-1001",
      payerName: "Example Claims Administrator",
      state: "submitted",
      agingDays: 12,
      totalCharge: 1_000,
      totalPaid: 0,
      balanceDue: 1_000,
    },
    {
      id: "bill_2",
      billNumber: 1002,
      patientName: "Jordan Example",
      payerName: "Example Claims Administrator",
      state: "processed",
      agingDays: 65,
      totalCharge: 2_000,
      totalPaid: 500,
      balanceDue: 1_500,
    },
    {
      id: "bill_3",
      patientName: "Morgan Example",
      payerName: "Second Synthetic Payer",
      state: "closed",
      agingDays: 120,
      totalCharge: 750,
      totalPaid: 750,
      balanceDue: 0,
    },
  ];

  it("calculates standard receivable aging and omits closed zero balances", () => {
    expect(billAgingBucket(bills[0]!)).toBe("current");
    expect(billAgingBucket(bills[1]!)).toBe("61-90");
    expect(summarizeBillingDashboard(bills)).toMatchObject({
      totalBilled: 3_750,
      totalPaid: 1_250,
      outstanding: 2_500,
      openCount: 2,
      bills: 3,
      aging: [
        { id: "current", count: 1, balance: 1_000 },
        { id: "31-60", count: 0, balance: 0 },
        { id: "61-90", count: 1, balance: 1_500 },
        { id: "91+", count: 0, balance: 0 },
      ],
    });
  });

  it("groups reporting data and exports spreadsheet-ready CSV", () => {
    expect(buildBillingReportRows(bills, "payer")).toEqual([
      {
        key: "Example Claims Administrator",
        label: "Example Claims Administrator",
        billCount: 2,
        totalBilled: 3_000,
        totalPaid: 500,
        balanceDue: 2_500,
      },
      {
        key: "Second Synthetic Payer",
        label: "Second Synthetic Payer",
        billCount: 1,
        totalBilled: 750,
        totalPaid: 750,
        balanceDue: 0,
      },
    ]);
    expect(buildBillingReportCsv(bills, "status")).toContain(
      '"Submitted","1","1000.00","0.00","1000.00"',
    );
  });
});

describe("pre-submission reference data", () => {
  it("uses one authenticated browser session for payer, ICD-10, and ZIP lookups", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ token: "short-lived-reference-token" }))
      .mockResolvedValueOnce(jsonResponse({
        results: [{ id: "pd:zurich", name: "Zurich American Insurance Company", hasElectronic: true }],
      }))
      .mockResolvedValueOnce(jsonResponse({
        results: [{ code: "M25.562", description: "Pain in left knee" }],
      }))
      .mockResolvedValueOnce(jsonResponse({
        results: [{ code: "B00.1", description: "Vesicular dermatitis" }],
      }))
      .mockResolvedValueOnce(jsonResponse({ postalCode: "94403", city: "San Mateo", state: "CA" }));
    const client = createBillReferenceClient({ fetch: fetcher });

    await expect(client.searchClaimsAdministrators("Zurich", "TEST-1")).resolves.toMatchObject([
      { id: "pd:zurich", name: "Zurich American Insurance Company", hasElectronic: true },
    ]);
    await expect(client.searchDiagnosisCodes("left knee")).resolves.toEqual([
      { code: "M25.562", description: "Pain in left knee" },
    ]);
    await expect(client.searchDiagnosisCodes("", 100, 100)).resolves.toEqual([
      { code: "B00.1", description: "Vesicular dermatitis" },
    ]);
    await expect(client.lookupPostalCode("94403")).resolves.toEqual({ city: "San Mateo", state: "CA" });

    expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
      "/api/mindbill/session",
      "https://app.mindbill.org/partner/v2/browser/claims-administrators?q=Zurich&claimNumber=TEST-1",
      "https://app.mindbill.org/partner/v2/browser/diagnosis-codes?q=left+knee&limit=30",
      "https://app.mindbill.org/partner/v2/browser/diagnosis-codes?q=&limit=100&offset=100",
      "https://app.mindbill.org/partner/v2/browser/postal-codes?postalCode=94403",
    ]);
    expect(fetcher.mock.calls.slice(1).map((call) => new Headers(call[1]?.headers).get("authorization"))).toEqual([
      "Bearer short-lived-reference-token",
      "Bearer short-lived-reference-token",
      "Bearer short-lived-reference-token",
      "Bearer short-lived-reference-token",
    ]);
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
    expect(billLifecycleStage("rejected")).toBe("submitted");
    expect(billLifecycleStage("second_review")).toBe("submitted");
    expect(billLifecycleStage("processed")).toBe("processed");
    expect(billLifecycleStage("denied")).toBe("processed");
    expect(billLifecycleStage("paid")).toBe("processed");
    expect(billLifecycleStage("closed")).toBe("closed");
  });

  it("uses human labels while preserving immutable API states", () => {
    expect(billLifecycleDisplayLabel("submitted", "SENT")).toBe("Sent");
    expect(billLifecycleDisplayLabel("second_review", "appealing")).toBe("Second Review sent");
    expect(billLifecycleDisplayLabel("partially_paid")).toBe("Partially paid");
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
    environment: "sandbox",
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

  it("simulates sandbox payer responses and resubmits a rejected bill", async () => {
    const rejected = {
      ...lifecycle,
      lifecycle: { ...lifecycle.lifecycle, state: "rejected", nativeStatus: "REJECTED" },
    };
    const submitted = {
      ...lifecycle,
      lifecycle: { ...lifecycle.lifecycle, state: "submitted", nativeStatus: "SENT" },
    };
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({
        token: "short-lived-lifecycle-token",
        expiresAt: "2099-08-26T00:00:00.000Z",
      }))
      .mockResolvedValueOnce(jsonResponse({ data: rejected }))
      .mockResolvedValueOnce(jsonResponse({ data: submitted }));
    const client = createBillLifecycleClient({ billId: "bill_789", fetch: fetcher });

    await expect(client.simulateSandbox({ scenario: "rejected" })).resolves.toMatchObject({
      lifecycle: { state: "rejected" },
    });
    await expect(client.resubmitBill({ reason: "Selected the correct payer route." })).resolves.toMatchObject({
      lifecycle: { state: "submitted" },
    });

    expect(fetcher.mock.calls[1]?.[0]).toBe(
      "https://app.mindbill.org/partner/v2/browser/bills/bill_789/simulate",
    );
    expect(fetcher.mock.calls[1]?.[1]?.body).toBe(JSON.stringify({ scenario: "rejected" }));
    expect(fetcher.mock.calls[2]?.[1]?.body).toBe(JSON.stringify({
      action: "resubmit",
      reason: "Selected the correct payer route.",
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
