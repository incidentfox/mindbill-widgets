import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildBillReviewSaveInput,
  ensureTrailingProcedureLine,
  type BillReviewDraft,
} from "../packages/react/src/native-bill-review";
import { createBillStatusClient } from "../packages/react/src/connected-bill-status";
import {
  createBillLifecycleClient,
  openPdfFromUserGesture,
  shouldShowSandboxControls,
} from "../packages/react/src/connected-bill-lifecycle";
import {
  BILL_TASKS_AGING_BUCKETS,
  billTasksAgingBucketIndex,
  buildBillTasksDashboard,
  createBillReferenceClient,
  createBillSubmissionClient,
  reportBillStatusContacts,
  sanitizeBillReviewSaveInput,
  SECOND_REVIEW_REASON_TEMPLATE,
  secondReviewDeadline,
  type BillHistoryEntry,
  type BillTasksDashboardItem,
} from "../packages/browser/src/index";
import { BillTasksDashboard } from "../packages/react/src/bill-tasks-dashboard";
import {
  billSubmissionsRibbonDeliveryLabel,
  billSubmissionsRibbonFromHistory,
} from "../packages/react/src/bill-submissions-ribbon";
import { REPORT_BILL_STATUS_OPTIONS } from "../packages/react/src/report-bill-status-dialog";
import {
  mindBillAppearanceStyle,
  resolveMindBillAppearance,
} from "../packages/react/src/appearance";
import {
  extractSendRouteEmail,
  formatSendRouteFax,
  formatSendRouteFaxInput,
} from "../packages/react/src/send-route-dialog";
import {
  billActivityEventLabel,
  billRejectionIssueSummary,
  billLifecycleDisplayLabel,
  billLifecycleProgressSteps,
  billLifecycleStage,
  BillRejectionNotice,
  visibleBillLifecycleActions,
} from "../packages/react/src/bill-lifecycle-surfaces";
import {
  applyBillSubmissionEvaluationDiagnoses,
  applyBillSubmissionEvaluationModifiers,
  BILL_SUBMISSION_REPORT_TYPES,
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
  claimsAdministratorRecommendations,
  exactClaimsAdministratorMatch,
  MED_LEGAL_REPORT_TYPE_CODE,
  parseBillSubmissionDate,
  prepareBillSubmissionDocuments,
  type BillSubmissionInput,
  type CompleteBillSubmissionInput,
  validateBillSubmission,
} from "../packages/react/src/bill-submission-form";
import type { CreateBillRequest } from "../packages/node/src/index";
import {
  BILL_SUBMISSION_DIAGNOSIS_QUICK_PICKS,
  calculateBillSubmissionAllowedAmount,
  DEFAULT_BILL_SUBMISSION_MODIFIERS,
  DEFAULT_BILL_SUBMISSION_PROCEDURES,
  DEFAULT_BILL_SUBMISSION_TAXONOMIES,
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
  it("ships complete QME Companion, orange-bright, clinical-blue, and midnight-cyan presets", () => {
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
    expect(resolveMindBillAppearance({ preset: "midnight-cyan" })).toMatchObject({
      accentColor: "#05092e",
      backgroundColor: "#edf6ff",
      textColor: "#05092e",
      borderRadius: "0px",
      controlRadius: "999px",
      fontFamily: "Geist, Inter, ui-sans-serif, system-ui, sans-serif",
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

describe("sandbox lifecycle controls", () => {
  it("keeps simulation controls out of ordinary sandbox integrations", () => {
    expect(shouldShowSandboxControls("sandbox")).toBe(false);
    expect(shouldShowSandboxControls("sandbox", false)).toBe(false);
  });

  it("shows simulation controls only for an explicit sandbox playground", () => {
    expect(shouldShowSandboxControls("sandbox", true)).toBe(true);
    expect(shouldShowSandboxControls("live", true)).toBe(false);
  });
});

describe("billing catalogs", () => {
  it("ships searchable human-readable taxonomy options for common rendering providers", () => {
    expect(DEFAULT_BILL_SUBMISSION_TAXONOMIES).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "2084P0800X", description: expect.stringContaining("Psychiatry") }),
      expect.objectContaining({ code: "207X00000X", description: expect.stringContaining("Orthopaedic") }),
    ]));
  });
});

describe("atomic bill submission form contract", () => {
  const validBill = {
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
      employer: "Synthetic Foods",
      dateOfInjury: "2026-08-01",
      claimsAdministrator: { id: "payer_7", name: "Synthetic Claims Administrator" },
    },
    service: { date: "2026-08-24" },
    billingProvider: {
      name: "Synthetic Medical Group",
      taxId: "123456789",
      npi: "1234567890",
      phone: "9165550100",
      address: {
        line1: "200 Billing Avenue",
        city: "Sacramento",
        state: "CA",
        postalCode: "95814",
      },
    },
    renderingProvider: {
      name: "Ada Physician",
      npi: "1098765432",
      taxonomy: "2084P0800X",
    },
    serviceLocation: {
      name: "Sacramento Exam Office",
      placeOfServiceCode: "11",
      address: {
        line1: "300 Service Street",
        city: "Sacramento",
        state: "CA",
        postalCode: "95814",
      },
    },
    diagnoses: ["M79.641"],
    serviceLines: [{ code: "ML201", units: 1 }],
  } satisfies CompleteBillSubmissionInput;

  it("uses the same browser-safe bill shape as the server SDK", () => {
    const sdkInput: CreateBillRequest = validBill;
    const componentInput: BillSubmissionInput = sdkInput;

    expect(componentInput).toBe(validBill);
  });

  it("owns and exports required-field rules", () => {
    expect(BILL_SUBMISSION_REQUIRED_FIELDS).toContain("patient.dateOfBirth");
    expect(BILL_SUBMISSION_REQUIRED_FIELDS).toContain("patient.address.state");
    expect(BILL_SUBMISSION_REQUIRED_FIELDS).toContain("claim.employer");
    expect(BILL_SUBMISSION_REQUIRED_FIELDS).toContain("claim.dateOfInjury");
    expect(BILL_SUBMISSION_REQUIRED_FIELDS).toContain("claim.claimsAdministrator");
    expect(BILL_SUBMISSION_REQUIRED_FIELDS).toContain("billingProvider.taxId");
    expect(BILL_SUBMISSION_REQUIRED_FIELDS).toContain("renderingProvider.taxonomy");
    expect(BILL_SUBMISSION_REQUIRED_FIELDS).toContain("serviceLocation.address.line1");
    expect(BILL_SUBMISSION_REQUIRED_FIELDS).toContain("serviceLocation.placeOfServiceCode");
    expect(BILL_SUBMISSION_REQUIRED_FIELDS).toContain("diagnoses[]");
    expect(BILL_SUBMISSION_REQUIRED_FIELDS).toContain("serviceLines[].code");
    expect(validateBillSubmission(validBill)).toEqual({
      valid: true,
      fieldErrors: {},
    });
  });

  it("requires at least one ICD-10 diagnosis code", () => {
    expect(validateBillSubmission({ ...validBill, diagnoses: [] })).toEqual({
      valid: false,
      fieldErrors: {
        diagnoses: "Select at least one ICD-10 diagnosis code.",
      },
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

  it("seeds the Psych QME diagnosis without replacing a specific diagnosis", () => {
    expect(applyBillSubmissionEvaluationDiagnoses([], "psych_qme")).toEqual(["Z04.6"]);
    expect(applyBillSubmissionEvaluationDiagnoses(undefined, "psych_qme")).toEqual(["Z04.6"]);
    expect(applyBillSubmissionEvaluationDiagnoses(["F43.10"], "psych_qme")).toEqual(["F43.10"]);
    expect(applyBillSubmissionEvaluationDiagnoses([], "qme")).toEqual([]);
  });

  it("ships general workers-comp code choices and calculates med-legal fees", () => {
    expect(DEFAULT_BILL_SUBMISSION_PROCEDURES.map((item) => item.code)).toEqual(
      expect.arrayContaining(["ML201", "99205", "97110", "72148", "L0650"]),
    );
    expect(DEFAULT_BILL_SUBMISSION_MODIFIERS.map((item) => item.code)).toEqual(
      expect.arrayContaining(["95", "59", "XE", "XU"]),
    );
    expect(BILL_SUBMISSION_DIAGNOSIS_QUICK_PICKS.map((item) => item.label)).toEqual(
      expect.arrayContaining(["Psych", "Back", "Neck", "Left hand", "Right knee"]),
    );
    expect(BILL_SUBMISSION_DIAGNOSIS_QUICK_PICKS.find((item) => item.label === "Psych")?.code).toBe("Z04.6");
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

  it("previews delivery routes for a claims administrator before the bill exists", async () => {
    const preview = {
      payerName: "Zurich American Insurance Company",
      recommended: {
        route: "ebill", label: "e-bill via Clearinghouse", detail: "Payer ID Z1234",
        fallback: false, confidence: "server", payerName: "Zurich American Insurance Company",
      },
      options: [
        {
          route: "ebill", label: "e-bill via Clearinghouse", detail: "Payer ID Z1234",
          fallback: false, confidence: "server", payerName: "Zurich American Insurance Company",
        },
        {
          route: "mail", label: "manual mail to PO Box 100, Anytown, CA 90000", detail: "Manual override route.",
          fallback: true, confidence: "server", payerName: "Zurich American Insurance Company",
          target: "PO Box 100, Anytown, CA 90000",
        },
      ],
      contacts: { faxNumber: null, claimsEmail: "claims@example.com", mailingAddress: "PO Box 100, Anytown, CA 90000" },
    };
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ token: "short-lived-reference-token" }))
      .mockResolvedValueOnce(jsonResponse(preview));
    const client = createBillReferenceClient({ fetch: fetcher });

    await expect(client.getDeliveryPreview({ claimsAdministratorId: "pd:zurich", injuryState: "CA" }))
      .resolves.toMatchObject({ payerName: "Zurich American Insurance Company", recommended: { route: "ebill" } });
    expect(fetcher.mock.calls[1]?.[0]).toBe(
      "https://app.mindbill.org/partner/v2/browser/delivery-preview?claimsAdministratorId=pd%3Azurich&injuryState=CA",
    );
  });

  it("rejects an invalid delivery preview payload", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ token: "short-lived-reference-token" }))
      .mockResolvedValueOnce(jsonResponse({ nope: true }));
    const client = createBillReferenceClient({ fetch: fetcher });
    await expect(client.getDeliveryPreview({ claimsAdministratorId: "pd:zurich" }))
      .rejects.toThrow("invalid delivery options");
  });
});

describe("send-route dialog helpers", () => {
  it("extracts a sendable email from scraped payer contact strings", () => {
    expect(extractSendRouteEmail("Claim Inquiries: claims@example.com [mailto:claims@example.com]"))
      .toBe("claims@example.com");
    expect(extractSendRouteEmail("claims@example.com")).toBe("claims@example.com");
    expect(extractSendRouteEmail("call the adjuster")).toBeNull();
    expect(extractSendRouteEmail(null)).toBeNull();
  });

  it("formats US fax numbers for display without inventing digits", () => {
    expect(formatSendRouteFax("2135550199")).toBe("(213) 555-0199");
    expect(formatSendRouteFax("1-800-555-0199")).toBe("(800) 555-0199");
    expect(formatSendRouteFax("+442071234567")).toBe("+442071234567");
    expect(formatSendRouteFax(null)).toBe("");
  });

  it("live-formats the fax input as digits are typed or pasted", () => {
    expect(formatSendRouteFaxInput("223")).toBe("(223");
    expect(formatSendRouteFaxInput("2233331")).toBe("(223) 333-1");
    expect(formatSendRouteFaxInput("2233331232")).toBe("(223) 333-1232");
    expect(formatSendRouteFaxInput("(949) 757-0076")).toBe("(949) 757-0076");
    expect(formatSendRouteFaxInput("1-949-757-0076")).toBe("(949) 757-0076");
    expect(formatSendRouteFaxInput("+442071234567")).toBe("+442071234567");
    expect(formatSendRouteFaxInput("")).toBe("");
  });
});

describe("connected bill submission", () => {
  it("owns the canonical immutable Partner API request in the browser client", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ token: "short-lived-submit-token" }))
      .mockResolvedValueOnce(jsonResponse({ id: "bill_123", externalId: "case-item-123", state: "submitted" }));
    const client = createBillSubmissionClient({ fetch: fetcher });
    const input = {
      bill: {
        externalId: "case-item-123",
        patient: {
          firstName: "Synthetic",
          lastName: "Patient",
          dateOfBirth: "1980-01-02",
          address: { line1: "100 Test Street", city: "Sacramento", state: "CA", postalCode: "95814" },
        },
        claim: {
          claimNumber: "TEST-CLAIM-1",
          employer: "Synthetic Employer",
          dateOfInjury: "2026-08-01",
          claimsAdministrator: { id: "payer_123", name: "Synthetic Payer" },
        },
        service: { date: "2026-08-31" },
        billingProvider: {
          name: "Synthetic Medical Group",
          taxId: "123456789",
          npi: "1234567890",
          phone: "9165550100",
          address: { line1: "200 Billing Avenue", city: "Sacramento", state: "CA", postalCode: "95814" },
        },
        renderingProvider: { name: "Ada Physician", npi: "1098765432", taxonomy: "2084P0800X" },
        serviceLocation: {
          name: "Sacramento Exam Office",
          placeOfServiceCode: "11",
          address: { line1: "300 Service Street", city: "Sacramento", state: "CA", postalCode: "95814" },
        },
        diagnoses: ["M79.641"],
        serviceLines: [{ code: "ML201", units: 1 }],
      },
      documents: [{
        externalId: "document_123",
        filename: "synthetic-report.pdf",
        documentType: "final_report" as const,
        contentBase64: "JVBERi0xLjQ=",
      }],
    };

    await expect(client.submitBill(input, { idempotencyKey: "submission-123" })).resolves.toMatchObject({
      billId: "bill_123",
      bill: { state: "submitted" },
    });

    expect(fetcher).toHaveBeenNthCalledWith(2, "https://app.mindbill.org/partner/v2/browser/bills", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        authorization: "Bearer short-lived-submit-token",
        "idempotency-key": "submission-123",
      }),
    }));
    const request = JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body)) as Record<string, unknown>;
    expect(request).toEqual(input);
    expect(JSON.stringify(request)).not.toContain("fileName");
    expect(JSON.stringify(request)).not.toContain("contentType");
  });

  it("encodes source and uploaded PDFs without exposing the wire schema to the host", async () => {
    const pdf = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])], { type: "application/pdf" });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(pdf, { status: 200 }));
    const upload = new File([pdf], "extra.pdf", { type: "application/pdf" });

    await expect(prepareBillSubmissionDocuments({
      attachments: [{
        id: "source_123",
        fileName: "source.pdf",
        documentType: "final_report",
        previewUrl: "/source.pdf",
      }],
      selectedIds: ["source_123"],
      uploads: [{ file: upload, documentType: "medical_records" }],
      defaultReportTypeCode: MED_LEGAL_REPORT_TYPE_CODE,
      fetch: fetcher,
    })).resolves.toEqual([
      expect.objectContaining({ externalId: "source_123", filename: "source.pdf", documentType: "final_report", reportTypeCode: "OZ:J4" }),
      expect.objectContaining({ filename: "extra.pdf", documentType: "medical_records", reportTypeCode: "OZ:J4" }),
    ]);
  });

  it("ships the med-legal default and the complete treatment report-type catalog", () => {
    expect(MED_LEGAL_REPORT_TYPE_CODE).toBe("OZ:J4");
    expect(BILL_SUBMISSION_REPORT_TYPES).toEqual(expect.arrayContaining([
      { code: "OZ:J1", label: "Doctor's First Report (DLSR 5021)" },
      { code: "OZ:J9", label: "Itemized Statement" },
      { code: "RR", label: "Radiology Reports" },
      { code: "XP", label: "Photographs" },
    ]));
  });
});

describe("bill lifecycle surfaces", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reserves a PDF tab before awaiting the authenticated packet request", async () => {
    const order: string[] = [];
    const writes: string[] = [];
    const replace = vi.fn();
    const close = vi.fn();
    const document = {
      open: vi.fn(),
      write: vi.fn((html: string) => writes.push(html)),
      close: vi.fn(),
    };
    let resolvePacket!: (packet: Blob) => void;
    const packet = new Promise<Blob>((resolve) => {
      resolvePacket = resolve;
    });

    vi.stubGlobal("window", {
      open: vi.fn(() => {
        order.push("open");
        return { opener: null, document, location: { replace }, close };
      }),
      setTimeout: vi.fn(),
    });
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:synthetic-packet"),
      revokeObjectURL: vi.fn(),
    });

    const opening = openPdfFromUserGesture(() => {
      order.push("request");
      return packet;
    });
    expect(order).toEqual(["open", "request"]);

    resolvePacket(new Blob(["synthetic packet"], { type: "application/pdf" }));
    await opening;

    expect(order).toEqual(["open", "request"]);
    expect(writes.at(-1)).toContain("Preparing PDF preview");
    expect(replace).toHaveBeenCalledWith("blob:synthetic-packet");
    expect(close).not.toHaveBeenCalled();
  });

  it("closes the reserved tab when the packet request fails", async () => {
    const writes: string[] = [];
    const close = vi.fn();
    const document = {
      open: vi.fn(),
      write: vi.fn((html: string) => writes.push(html)),
      close: vi.fn(),
    };
    vi.stubGlobal("window", {
      open: vi.fn(() => ({ opener: null, document, location: { replace: vi.fn() }, close })),
      setTimeout: vi.fn(),
    });

    await expect(openPdfFromUserGesture(async () => {
      throw new Error("Packet unavailable");
    })).rejects.toThrow("Packet unavailable");
    expect(writes.at(-1)).toContain("Preparing PDF preview");
    expect(close).toHaveBeenCalledOnce();
  });

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

  it("renders rejection as a terminal exception rail instead of a pending happy path", () => {
    expect(billLifecycleProgressSteps("rejected")).toEqual([
      { id: "submitted", label: "Sent", status: "complete" },
      { id: "rejected", label: "Rejected", status: "current" },
    ]);
    expect(billLifecycleProgressSteps("accepted")).toHaveLength(4);
  });

  it("renders structured rejection feedback as a reusable alert surface", () => {
    const surface = BillRejectionNotice({
      rejection: {
        code: "A7:21",
        reason: "The payer could not match the submitted claim information.",
        issues: [
          { code: "A6:187", description: "From Date of Service cannot be in the future" },
          { code: "A6:88", description: "Thru Date of Service cannot be in the future" },
          { code: "A7:188", description: "Service From date cannot be in the future" },
          { code: "A7:188", description: "Service Thru date cannot be in the future" },
        ],
        source: "Clearinghouse acknowledgement",
      },
    });
    const props = surface.props as Record<string, unknown>;

    expect(props.role).toBe("alert");
    expect(props["aria-label"]).toBe("Bill rejection reasons");
    expect(props.className).toContain("mb-rejection-notice");
    expect(billRejectionIssueSummary({
      reason: "Correct the submitted dates.",
      source: "Jopari",
    }, 4)).toBe("4 validation errors returned by Jopari.");
    expect(billRejectionIssueSummary({
      reason: "Correct the submitted dates.",
      source: "Clearinghouse acknowledgement",
    }, 4)).toBe("4 clearinghouse validation errors.");
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
      billedAmount: 2015,
      expectedAmount: 2015,
      payerAllowedAmount: null,
      payerReportedPaid: null,
      postedPrincipal: 0,
      postedAdditional: 0,
      totalPostedCash: 0,
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
    const correctedBill = {
      externalId: "evaluation_123",
      billingMode: "med_legal",
      patient: { firstName: "Ada", lastName: "Example", dateOfBirth: "1980-01-02", address: { line1: "100 Main Street", city: "Sacramento", state: "CA", postalCode: "95814" } },
      claim: { claimNumber: "CLAIM-7", employer: "Synthetic Foods", dateOfInjury: "2026-08-01", claimsAdministrator: { id: "payer_7", name: "Synthetic Claims Administrator" } },
      service: { date: "2026-08-24" },
      billingProvider: { name: "Synthetic Medical Group", taxId: "123456789", npi: "1234567890", phone: "9165550100", address: { line1: "200 Billing Avenue", city: "Sacramento", state: "CA", postalCode: "95814" } },
      renderingProvider: { name: "Ada Physician", npi: "1098765432", taxonomy: "2084P0800X" },
      serviceLocation: { placeOfServiceCode: "11", address: { line1: "300 Service Street", city: "Sacramento", state: "CA", postalCode: "95814" } },
      diagnoses: ["M79.641"],
      serviceLines: [{ code: "ML201", units: 1 }],
    } satisfies CompleteBillSubmissionInput;
    await expect(client.resubmitBill({ reason: "Selected the correct payer route.", bill: correctedBill })).resolves.toMatchObject({
      lifecycle: { state: "submitted" },
    });

    expect(fetcher.mock.calls[1]?.[0]).toBe(
      "https://app.mindbill.org/partner/v2/browser/bills/bill_789/simulate",
    );
    expect(fetcher.mock.calls[1]?.[1]?.body).toBe(JSON.stringify({ scenario: "rejected" }));
    expect(fetcher.mock.calls[2]?.[1]?.body).toBe(JSON.stringify({
      action: "resubmit",
      reason: "Selected the correct payer route.",
      bill: correctedBill,
    }));
  });

  it("rejects a failed resubmit action with the server's reason so the dialog can show it", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({
        token: "short-lived-lifecycle-token",
        expiresAt: "2099-08-26T00:00:00.000Z",
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        type: "https://developers.mindbill.org/problems/duplicate_patient",
        title: "duplicate_patient",
        status: 409,
        detail: "A patient with this exact name and date of birth already exists.",
        code: "duplicate_patient",
      }), { status: 409, headers: { "content-type": "application/problem+json" } }));
    const client = createBillLifecycleClient({ billId: "bill_789", fetch: fetcher });

    await expect(client.resubmitBill({
      reason: "Corrected the patient details.",
      bill: { patient: { firstName: "Ada" } } as never,
    })).rejects.toThrow("A patient with this exact name and date of birth already exists.");
  });

  it("keeps the correction dialog open and surfaces the server error inline on a failed resubmit", () => {
    const source = readFileSync(
      new URL("../packages/react/src/connected-bill-lifecycle.tsx", import.meta.url),
      "utf8",
    );

    // The resubmit submit handler must catch the action-POST failure (never a
    // silent success), keep the form open, and render the message inline.
    const handler = source.slice(
      source.indexOf("const submitCorrection"),
      source.indexOf("const loadDuplicateDelivery"),
    );
    expect(handler).toContain("setCorrectionError(\"\")");
    expect(handler).toContain("catch (cause)");
    expect(handler).toContain("setCorrectionError(");
    expect(handler).toContain("return;");
    // Success is the only path that closes the panel.
    expect(handler.indexOf("setPanel(\"\")")).toBeGreaterThan(handler.indexOf("return;"));
    expect(source).toContain(
      "{correctionError ? <div className=\"mb-lifecycle-message error\" role=\"alert\">{correctionError}</div> : null}",
    );
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

  it("normalizes exact payer aliases and caps fuzzy confirmation choices at five", () => {
    const results = Array.from({ length: 7 }, (_, index) => ({
      id: `pd:route-${index}`,
      name: index === 0 ? "Zurich Insurance N.A. [Electronic]" : `Zurich Route ${index}`,
      recommended: index === 1,
      confidence: index === 1 ? "high" as const : "medium" as const,
      signals: [],
    }));

    expect(exactClaimsAdministratorMatch(results, " zurich insurance n.a. [electronic] ")?.id)
      .toBe("pd:route-0");
    expect(claimsAdministratorRecommendations(results)).toHaveLength(5);
    expect(claimsAdministratorRecommendations(results)[0]?.id).toBe("pd:route-1");
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

  it("sends a duplicate bill and reports a phoned bill status through the actions endpoint", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({
        token: "short-lived-lifecycle-token",
        expiresAt: "2099-08-26T00:00:00.000Z",
      }))
      .mockResolvedValueOnce(jsonResponse({ data: lifecycle }))
      .mockResolvedValueOnce(jsonResponse({ data: lifecycle }));
    const client = createBillLifecycleClient({ billId: "bill_789", fetch: fetcher });

    await expect(client.sendDuplicateBill({
      route: "fax",
      destination: { faxNumber: "(555) 010-2040" },
      attention: "Claims Intake",
    })).resolves.toMatchObject({ lifecycle: { state: "denied" } });
    await expect(client.reportBillStatus({
      status: "eor_pending",
      representativeName: "Sam Reviewer",
      callReference: "REF-42",
    })).resolves.toMatchObject({ lifecycle: { state: "denied" } });

    expect(fetcher.mock.calls[1]?.[0]).toBe(
      "https://app.mindbill.org/partner/v2/browser/bills/bill_789/actions",
    );
    expect(fetcher.mock.calls[1]?.[1]?.body).toBe(JSON.stringify({
      action: "send_duplicate",
      route: "fax",
      destination: { faxNumber: "(555) 010-2040" },
      attention: "Claims Intake",
    }));
    expect(fetcher.mock.calls[2]?.[0]).toBe(
      "https://app.mindbill.org/partner/v2/browser/bills/bill_789/actions",
    );
    expect(fetcher.mock.calls[2]?.[1]?.body).toBe(JSON.stringify({
      action: "report_bill_status",
      status: "eor_pending",
      representativeName: "Sam Reviewer",
      callReference: "REF-42",
    }));
  });
});

describe("bill tasks dashboard", () => {
  const sections = [
    { id: "payment_due", label: "Payment Due", agingBasisLabel: "Bill Sent Date", tone: "violet" as const },
    { id: "denials", label: "Denials", agingBasisLabel: "EOR Date", tone: "red" as const },
    { id: "drafts", label: "Drafts", agingBasisLabel: "Created Date", tone: "neutral" as const },
  ];
  const item = (overrides: Partial<BillTasksDashboardItem>): BillTasksDashboardItem => ({
    sectionId: "payment_due",
    rowId: "no_response",
    rowLabel: "No payer response",
    ageDays: 5,
    ...overrides,
  });

  it("buckets ages on exclusive-min/inclusive-max boundaries with day 0 in the first bucket", () => {
    expect(billTasksAgingBucketIndex(0)).toBe(0);
    expect(billTasksAgingBucketIndex(1)).toBe(0);
    expect(billTasksAgingBucketIndex(30)).toBe(0);
    expect(billTasksAgingBucketIndex(31)).toBe(1);
    expect(billTasksAgingBucketIndex(60)).toBe(1);
    expect(billTasksAgingBucketIndex(61)).toBe(2);
    expect(billTasksAgingBucketIndex(90)).toBe(2);
    expect(billTasksAgingBucketIndex(91)).toBe(3);
    expect(billTasksAgingBucketIndex(180)).toBe(3);
    expect(billTasksAgingBucketIndex(181)).toBe(4);
    expect(billTasksAgingBucketIndex(4000)).toBe(4);
    expect(BILL_TASKS_AGING_BUCKETS.map((bucket) => bucket.id)).toEqual([
      "1-30", "31-60", "61-90", "91-180", "181+",
    ]);
    expect(BILL_TASKS_AGING_BUCKETS[0]?.label).toBe("1-30 Days Ago");
    expect(BILL_TASKS_AGING_BUCKETS[4]?.maxDays).toBeNull();
  });

  it("keeps rows in first-seen order, renders empty sections, and collects refs", () => {
    const data = buildBillTasksDashboard([
      item({ rowId: "second_review", rowLabel: "Second Review due", ageDays: 30, ref: "bill_a" }),
      item({ ageDays: 31, ref: "bill_b" }),
      item({ ageDays: 200, ref: "bill_c" }),
      item({ sectionId: "denials", rowId: "denied", rowLabel: "Denied bills", ageDays: 45, ref: "bill_d" }),
      item({ ageDays: 33 }),
      item({ sectionId: "unknown_section", ageDays: 1, ref: "bill_ignored" }),
    ], sections);

    expect(data.sections.map((section) => section.id)).toEqual(["payment_due", "denials", "drafts"]);
    const paymentDue = data.sections[0]!;
    expect(paymentDue.rows.map((row) => row.id)).toEqual(["second_review", "no_response"]);
    expect(paymentDue.rows[0]?.counts).toEqual([1, 0, 0, 0, 0]);
    expect(paymentDue.rows[1]?.counts).toEqual([0, 2, 0, 0, 1]);
    expect(paymentDue.rows[1]?.total).toBe(3);
    expect(paymentDue.rows[1]?.refs).toEqual([[], ["bill_b"], [], [], ["bill_c"]]);
    expect(paymentDue.totals).toEqual([1, 2, 0, 0, 1]);
    expect(paymentDue.total).toBe(4);
    expect(paymentDue.empty).toBe(false);

    const drafts = data.sections[2]!;
    expect(drafts.empty).toBe(true);
    expect(drafts.rows).toEqual([]);
    expect(drafts.totals).toEqual([0, 0, 0, 0, 0]);

    expect(data.grandTotals).toEqual([1, 3, 0, 0, 1]);
    expect(data.grandTotal).toBe(5);
  });

  it("renders as a themed stateless surface", () => {
    const data = buildBillTasksDashboard([item({ ageDays: 2, ref: "bill_a" })], sections);
    const surface = BillTasksDashboard({ data, grandTotalLabel: "Bill Tasks Total" });
    const props = surface.props as Record<string, unknown>;
    expect(props.className).toContain("mbtk");
    expect(props.style).toMatchObject({
      "--mbtk-cols": "minmax(150px,1.6fr) repeat(5,minmax(84px,1fr)) minmax(84px,1fr)",
    });
  });
});

describe("bill submissions ribbon", () => {
  const entry = (overrides: Partial<BillHistoryEntry>): BillHistoryEntry => ({
    id: "hist_1",
    date: "2026-08-14T17:30:00.000Z",
    action: "Original Bill",
    kind: "submission",
    actor: "Casey Biller",
    summary: "Electronically sent to Acme Insurance Co.",
    tone: "submission",
    ...overrides,
  });

  it("maps only submission history entries into chips", () => {
    const items = billSubmissionsRibbonFromHistory([
      entry({}),
      entry({ id: "hist_2", kind: "ack", action: "277 Accept", summary: "Accepted by the clearinghouse." }),
      entry({ id: "hist_3", action: "Second Review", summary: "Faxed to (555) 010-2040.", date: "2026-09-01T08:00:00.000Z" }),
      entry({ id: "hist_4", kind: "note", action: "Note", tone: "note" }),
    ]);

    expect(items).toEqual([
      {
        id: "hist_1",
        label: "Original Bill",
        meta: [
          { label: "Delivery", value: "e-Bill (837)" },
          { label: "Sent", value: "08/14/2026" },
        ],
      },
      {
        id: "hist_3",
        label: "Second Review",
        meta: [
          { label: "Delivery", value: "Fax" },
          { label: "Sent", value: "09/01/2026" },
        ],
      },
    ]);
  });

  it("extracts the delivery route word from presented summaries", () => {
    expect(billSubmissionsRibbonDeliveryLabel("Electronically sent to Acme.")).toBe("e-Bill (837)");
    expect(billSubmissionsRibbonDeliveryLabel("Faxed to (555) 010-2040.")).toBe("Fax");
    expect(billSubmissionsRibbonDeliveryLabel("Emailed to claims@example.com.")).toBe("Email");
    expect(billSubmissionsRibbonDeliveryLabel("Mailed to PO Box 1234.")).toBe("Mail");
    expect(billSubmissionsRibbonDeliveryLabel("Hand delivered.")).toBe("Sent");
  });
});

describe("report bill status contacts", () => {
  it("derives claims-admin and bill-review call targets from the delivery block", () => {
    expect(reportBillStatusContacts({
      payerName: "Acme Claims Administration",
      contacts: { adjusterName: "Dana Adjuster", adjusterPhone: "(555) 010-3050" },
      directory: {
        hours: "Mon–Fri 8am–5pm PT",
        billReview: [{ name: "Acme Bill Review", phone: "(555) 010-3060" }],
      },
    })).toEqual({
      claimsAdmin: {
        name: "Acme Claims Administration",
        hoursOfOperation: "Mon–Fri 8am–5pm PT",
        phones: [{ label: "Adjuster (Dana Adjuster)", value: "(555) 010-3050" }],
      },
      billReview: { name: "Acme Bill Review", phone: "(555) 010-3060" },
    });
  });

  it("returns nulls when the delivery block has no usable call targets", () => {
    expect(reportBillStatusContacts({ payerName: "  ", contacts: {} }))
      .toEqual({ claimsAdmin: null, billReview: null });
    expect(reportBillStatusContacts({
      payerName: "Acme Claims Administration",
      contacts: {},
      directory: { billReview: [{ email: "review@payer.example" }] },
    })).toEqual({
      claimsAdmin: { name: "Acme Claims Administration", phones: [] },
      billReview: null,
    });
  });
});

describe("second review prefill and deadline", () => {
  it("ships an editable LC §4622 appeal template", () => {
    expect(SECOND_REVIEW_REASON_TEMPLATE).toBe(
      "This is an appeal of the invalid denial of this med-legal bill; per LC §4622 and the OMFS/MLFS, payment is due as billed.",
    );
  });

  it("anchors the 90-day window on the latest parseable denial/EOR date", () => {
    expect(secondReviewDeadline([])).toBeNull();
    expect(secondReviewDeadline([{ addedAt: "not-a-date" }])).toBeNull();
    expect(secondReviewDeadline([
      { addedAt: "2026-06-01T12:00:00.000Z" },
      { addedAt: "2026-07-01T12:00:00.000Z" },
      { addedAt: "garbage" },
    ])).toEqual({ eorDate: "2026-07-01", deadline: "2026-09-29" });
  });
});

describe("report bill status dialog", () => {
  it("ships the five daisy-worded status options", () => {
    expect(REPORT_BILL_STATUS_OPTIONS.map((option) => option.label)).toEqual([
      "Message Left Requesting Bill Payment Status",
      "Explanation of Review (EOR) Pending",
      "Explanation of Review (EOR) Sent",
      "Bill Not On File",
      "Bill Forwarded to Different Payer / Network",
    ]);
    expect(REPORT_BILL_STATUS_OPTIONS.map((option) => option.id)).toEqual([
      "message_left", "eor_pending", "eor_sent", "bill_not_on_file", "forwarded",
    ]);
    for (const option of REPORT_BILL_STATUS_OPTIONS) {
      expect(option.description).toContain("Claims Administrator/Bill Review");
    }
  });
});
