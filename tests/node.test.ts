import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  compareMindBillEventSequence,
  MindBillClient,
  MindBillError,
  verifyMindBillWebhookSignature,
} from "../packages/node/src/index.js";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...Object.fromEntries(new Headers(init.headers)),
    },
  });
}

const bill = {
  id: "bill_1",
  externalId: "report_42",
  state: "draft",
  billingMode: "med_legal" as const,
  billNumber: 1001,
  patient: {
    firstName: "Alex",
    middleName: null,
    lastName: "Morgan",
    dateOfBirth: "1980-01-01",
    ssn: null,
    gender: null,
    phone: null,
    address: {
      line1: "100 Test Way",
      city: "Pasadena",
      state: "CA",
      postalCode: "91101",
    },
  },
  claim: {
    claimNumber: "TEST-1001",
    adjNumber: null,
    employer: "Synthetic Employer",
    dateOfInjury: "2026-08-01",
    injuryState: "CA",
    description: null,
    diagnoses: ["M25.512"],
    claimsAdministrator: { id: "payer_1", name: "Synthetic Payer" },
  },
  service: {
    date: "2026-08-20",
    endDate: null,
    authorizationNumber: null,
  },
  billingProvider: null,
  renderingProvider: null,
  serviceLocation: null,
  serviceLines: [{ id: "line_1", code: "ML201", modifiers: ["-95"], units: 1, allowed: 2015 }],
  documents: [],
  amounts: { charged: 2015, paid: 0, balance: 2015 },
};

describe("@mindbill/node v2", () => {
  it("creates a bill with server auth, org context, and idempotency", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(bill, { status: 201 }));
    const client = new MindBillClient({
      apiKey: "mb_sandbox_secret",
      organizationId: "org_1",
      baseUrl: "https://example.test/",
      fetch: fetcher,
    });

    const created = await client.createBill(
      {
        externalId: "report_42",
        patient: {
          firstName: "Alex",
          lastName: "Morgan",
          address: bill.patient.address,
        },
        claim: { claimNumber: "TEST-1001" },
        service: { date: "2026-08-20" },
      },
      "create-report-42",
    );

    const [url, request] = fetcher.mock.calls[0]!;
    const headers = new Headers(request?.headers);
    expect(url).toBe("https://example.test/partner/v2/bills");
    expect(headers.get("authorization")).toBe("Bearer mb_sandbox_secret");
    expect(headers.get("x-mindbill-org-id")).toBe("org_1");
    expect(headers.get("idempotency-key")).toBe("create-report-42");
    expect(created).toEqual(bill);
  });

  it("updates nested snapshots and lists bills by partner IDs", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(bill))
      .mockResolvedValueOnce(jsonResponse({ data: [bill], nextCursor: null }));
    const client = new MindBillClient({ apiKey: "mb_test", fetch: fetcher });

    await client.updateBill(
      "bill_1",
      { patient: { address: { city: "Long Beach" } }, claim: { employer: "Updated Employer" } },
      "update-report-42",
    );
    const page = await client.listBills({ externalId: "report_42", patientExternalId: "patient_7", limit: 10 });

    expect(page.data).toHaveLength(1);
    expect(fetcher.mock.calls[0]?.[0]).toBe("https://app.mindbill.org/partner/v2/bills/bill_1");
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      patient: { address: { city: "Long Beach" } },
      claim: { employer: "Updated Employer" },
    });
    expect(fetcher.mock.calls[1]?.[0]).toBe(
      "https://app.mindbill.org/partner/v2/bills?externalId=report_42&patientExternalId=patient_7&limit=10",
    );
  });

  it("uploads an explicit payer document without forcing a multipart content type", async () => {
    const document = {
      id: "document_1",
      externalId: "final-report-42",
      filename: "final-report.pdf",
      description: "Final report",
      documentType: "final_report",
      reportType: null,
      reportTypeCode: null,
      source: "partner",
      addedAt: "2026-08-25T23:00:00.000Z",
      contentUrl: "/partner/v2/bills/bill_1/documents/document_1",
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: document }, { status: 201 }));
    const client = new MindBillClient({ apiKey: "mb_test", fetch: fetcher });

    const result = await client.uploadBillDocument(
      "bill_1",
      {
        file: new Blob(["synthetic pdf"], { type: "application/pdf" }),
        filename: "final-report.pdf",
        documentType: "final_report",
        externalId: "final-report-42",
        description: "Final report",
      },
      "attach-final-report-42",
    );

    const [, request] = fetcher.mock.calls[0]!;
    const headers = new Headers(request?.headers);
    const form = request?.body as FormData;
    expect(headers.has("content-type")).toBe(false);
    expect(headers.get("idempotency-key")).toBe("attach-final-report-42");
    expect(form.get("documentType")).toBe("final_report");
    expect(form.get("externalId")).toBe("final-report-42");
    expect(result.data.id).toBe("document_1");
  });

  it("submits, reads status and EOR PDFs, and performs lifecycle actions", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        sandbox: true,
        billId: "bill_1",
        controlNumber: "sandbox-control-1",
        state: "submitted",
        acknowledgments: [{ type: "999", status: "accepted" }],
      }, { status: 202 }))
      .mockResolvedValueOnce(jsonResponse({ data: {
        billId: "bill_1", externalId: "report_42", state: "processed", nativeStatus: "processed",
        totalCharge: 2015, totalPaid: 0, balanceDue: 2015, lastEventId: "event_7", updatedAt: "2026-08-25T23:00:00.000Z",
      } }))
      .mockResolvedValueOnce(jsonResponse({ data: {
        billId: "bill_1", reportedPaid: 0, totalPaid: 0, balanceDue: 2015,
        payment: null, payments: [], lineItems: [],
        documents: [{ id: "eor_1", filename: "eor.pdf", contentType: "application/pdf", addedAt: "2026-08-25T23:00:00.000Z", contentUrl: "/partner/v2/bills/bill_1/eor/eor_1" }],
      } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, data: { state: "closed" } }));
    const client = new MindBillClient({ apiKey: "mb_test", fetch: fetcher });

    const submission = await client.submitBill("bill_1", { route: "ebill" }, "submit-bill-1");
    const status = await client.getBillStatus("bill_1");
    const eor = await client.getBillEor("bill_1");
    const closed = await client.performBillAction("bill_1", { action: "close", reason: "Resolved" }, "close-bill-1");

    expect("sandbox" in submission && submission.state).toBe("submitted");
    expect(status.data.state).toBe("processed");
    expect(eor.data.documents[0]?.filename).toBe("eor.pdf");
    expect(closed.ok).toBe(true);
  });

  it("creates and submits a Second Bill Review with selected attachments", async () => {
    const review = {
      id: "review_1", billId: "bill_1", originalBillId: "bill_1", externalId: "sbr_42",
      type: "second_review" as const, state: "draft" as const,
      reason: "Payment does not match the allowed amount.", disputedAmount: 1200,
      payerClaimControlNumber: "payer-control-42", attachmentIds: ["document_1"], submittedAt: null,
      createdAt: "2026-08-25T23:00:00.000Z", updatedAt: "2026-08-25T23:00:00.000Z",
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ data: review }, { status: 201 }))
      .mockResolvedValueOnce(jsonResponse({ data: { ...review, state: "submitted", submittedAt: review.updatedAt } }));
    const client = new MindBillClient({ apiKey: "mb_test", fetch: fetcher });

    const created = await client.createBillReview(
      "bill_1",
      {
        externalId: "sbr_42",
        type: "second_review",
        reason: review.reason,
        disputedAmount: 1200,
        payerClaimControlNumber: "payer-control-42",
        attachmentIds: ["document_1"],
      },
      "create-sbr-42",
    );
    const submitted = await client.submitBillReview("bill_1", created.data.id, "submit-sbr-42");

    expect(created.data.originalBillId).toBe("bill_1");
    expect(submitted.data.state).toBe("submitted");
  });

  it("mints only exact-origin, bill-scoped browser sessions", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      sessionId: "session_1",
      component: "bill-review",
      token: "short-lived-token",
      embedUrl: "https://app.mindbill.org/embed/bill-review",
      expiresAt: "2026-08-28T12:15:00.000Z",
    }));
    const client = new MindBillClient({ apiKey: "mb_test", fetch: fetcher });

    expect(() => client.createBrowserSession({
      component: "bill-review",
      billId: "bill_1",
      allowedOrigin: "https://partner.example.test/path",
    })).toThrow("allowedOrigin must be an exact HTTPS origin");
    const session = await client.createBrowserSession({
      component: "bill-review",
      billId: "bill_1",
      allowedOrigin: "https://partner.example.test",
      expiresIn: 300,
    });

    expect(session.token).toBe("short-lived-token");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      component: "bill-review",
      billId: "bill_1",
      allowedOrigin: "https://partner.example.test",
      expiresIn: 300,
    });
  });

  it("surfaces structured API errors with request IDs", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(
      { title: "Invalid request", detail: "The bill is invalid" },
      { status: 422, headers: { "content-type": "application/problem+json", "x-request-id": "req_123" } },
    ));
    const client = new MindBillClient({ apiKey: "mb_test", fetch: fetcher });

    await expect(client.getBill("bill_1")).rejects.toMatchObject({
      name: "MindBillError",
      status: 422,
      requestId: "req_123",
      message: "The bill is invalid",
    } satisfies Partial<MindBillError>);
  });

  it("verifies signed events and compares arbitrary-length sequence cursors", () => {
    const secret = "synthetic_webhook_secret";
    const timestamp = 1_800_000_000;
    const rawBody = new TextEncoder().encode('{"id":"event_1","sequence":"9007199254740993"}');
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.`)
      .update(rawBody)
      .digest("hex");

    expect(verifyMindBillWebhookSignature(rawBody, `t=${timestamp},v1=${signature}`, secret, { now: timestamp })).toBe(true);
    expect(compareMindBillEventSequence("9007199254740993", "9007199254740992")).toBe(1);
    expect(compareMindBillEventSequence("00042", "42")).toBe(0);
    expect(() => compareMindBillEventSequence("42.1", "43")).toThrow("decimal digits only");
  });
});
