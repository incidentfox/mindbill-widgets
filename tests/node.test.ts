import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  compareMindBillEventSequence,
  createDeveloperSandbox,
  MINDBILL_SCOPES,
  MINDBILL_TERMS_VERSION,
  MindBillClient,
  MindBillError,
  verifyMindBillWebhookSignature,
} from "../packages/node/src/index.js";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("@mindbill/node", () => {
  it("creates a sandbox without sending authorization", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        partnerId: "partner_1",
        partnerSlug: "example",
        accountId: "account_1",
        credentialId: "credential_1",
        apiKey: "mb_sandbox_secret",
        environment: "sandbox",
      }),
    );
    await createDeveloperSandbox(
      {
        companyName: "Example",
        contactName: "Developer",
        email: "developer@example.test",
        termsAccepted: true,
      },
      { fetch: fetcher },
    );

    const [, request] = fetcher.mock.calls[0]!;
    const headers = new Headers(request?.headers);
    expect(headers.has("authorization")).toBe(false);
    expect(JSON.parse(String(request?.body))).toMatchObject({
      termsVersion: MINDBILL_TERMS_VERSION,
    });
  });

  it("applies bearer auth, organization context, and idempotency", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        patientId: "patient_1",
        injuryId: "injury_1",
        billId: "bill_1",
        billNumber: 1001,
      }),
    );
    const client = new MindBillClient({
      apiKey: "mb_sandbox_secret",
      organizationId: "org_1",
      baseUrl: "https://example.test/partner/v1/",
      fetch: fetcher,
    });
    const result = await client.createBill(
      {
        patient: { kind: "new" },
        fields: { externalId: "example-1" },
      },
      "example-idempotency-key",
    );

    const [url, request] = fetcher.mock.calls[0]!;
    const headers = new Headers(request?.headers);
    expect(url).toBe("https://example.test/partner/v1/bills");
    expect(headers.get("authorization")).toBe("Bearer mb_sandbox_secret");
    expect(headers.get("x-mindbill-org-id")).toBe("org_1");
    expect(headers.get("idempotency-key")).toBe("example-idempotency-key");
    expect(result).toEqual({
      patientId: "patient_1",
      injuryId: "injury_1",
      billId: "bill_1",
      billNumber: 1001,
    });
  });

  it("provisions a managed organization without an invitation by default", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          organizationId: "org_managed_1",
          status: "configuring",
          accessMode: "managed",
        },
        { status: 201 },
      ),
    );
    const client = new MindBillClient({
      apiKey: "mb_sandbox_secret",
      baseUrl: "https://example.test/partner/v1",
      fetch: fetcher,
    });

    const result = await client.provisionOrganization(
      { name: "Synthetic QME Practice" },
      "provision-synthetic-qme",
    );

    expect(result).toEqual({
      organizationId: "org_managed_1",
      status: "configuring",
      accessMode: "managed",
    });
    const [url, request] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://example.test/partner/v1/orgs");
    expect(new Headers(request?.headers).get("idempotency-key")).toBe(
      "provision-synthetic-qme",
    );
    expect(JSON.parse(String(request?.body))).toEqual({
      name: "Synthetic QME Practice",
    });
  });

  it("grants optional MindBill user access explicitly", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          organizationId: "org_managed_1",
          status: "pending_activation",
          accessMode: "invite",
          activationUrl:
            "https://app.mindbill.org/invite/synthetic-one-time-token",
          activationEmailSent: true,
        },
        { status: 201 },
      ),
    );
    const client = new MindBillClient({
      apiKey: "mb_sandbox_secret",
      fetch: fetcher,
    });

    const result = await client.grantOrganizationUserAccess(
      "org_managed_1",
      { adminName: "Synthetic Owner", adminEmail: "owner@example.test" },
      "grant-synthetic-access",
    );

    expect(result.accessMode).toBe("invite");
    const [url, request] = fetcher.mock.calls[0]!;
    expect(url).toBe(
      "https://app.mindbill.org/partner/v1/orgs/org_managed_1/user-access",
    );
    expect(new Headers(request?.headers).get("idempotency-key")).toBe(
      "grant-synthetic-access",
    );
    expect(JSON.parse(String(request?.body))).toEqual({
      adminName: "Synthetic Owner",
      adminEmail: "owner@example.test",
    });
  });

  it("exposes the quote scope and typed quote request", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        currency: "USD",
        totalAllowed: 625,
      }),
    );
    const client = new MindBillClient({
      apiKey: "mb_sandbox_secret",
      fetch: fetcher,
    });
    const quote = await client.quote(
      {
        lineItems: [{ code: "ML200", modifiers: ["-95"], units: 1 }],
      },
      "quote-idempotency-key",
    );

    expect(MINDBILL_SCOPES).toContain("bills:quote");
    expect(quote.totalAllowed).toBe(625);
    const [url, request] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://app.mindbill.org/partner/v1/quote");
    expect(JSON.parse(String(request?.body))).toEqual({
      lineItems: [{ code: "ML200", modifiers: ["-95"], units: 1 }],
    });
  });

  it("returns the documented sandbox submission variant", async () => {
    const response = {
      ok: true as const,
      sandbox: true as const,
      billId: "bill_1",
      controlNumber: "sandbox-control-1",
      state: "paid" as const,
      acknowledgments: [
        { type: "999" as const, status: "accepted" as const },
        { type: "277CA" as const, status: "accepted" as const },
      ],
      eor: { id: "eor_1", reportedPaid: 625 },
      payments: [{ id: "payment_1", amount: 625 }],
      balanceDue: 0 as const,
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(response, { status: 202 }));
    const client = new MindBillClient({
      apiKey: "mb_sandbox_secret",
      fetch: fetcher,
    });
    const result = await client.submitBill(
      "bill_1",
      {},
      "submit-idempotency-key",
    );

    expect(result).toEqual(response);
    expect("sandbox" in result && result.sandbox).toBe(true);
  });

  it("returns the documented live submission variant", async () => {
    const response = {
      bill: { id: "bill_1", status: "submitted" },
      transmissionState: "uploaded",
      dryRun: false,
      liveTransmit: true,
      clearinghouse: "synthetic-clearinghouse",
      billFilename: "synthetic-claim.edi",
      uploaded: ["synthetic-claim.edi"],
      artifactPath: "/synthetic/artifacts",
      attachmentAdvisories: [
        { id: "synthetic-advisory", message: "Synthetic advisory" },
      ],
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(response));
    const client = new MindBillClient({
      apiKey: "mb_live_secret",
      fetch: fetcher,
    });
    const result = await client.submitBill(
      "bill_1",
      { route: "ebill" },
      "submit-live-idempotency-key",
    );

    expect(result).toEqual(response);
    expect("bill" in result && result.uploaded).toEqual([
      "synthetic-claim.edi",
    ]);
  });

  it("reads the compact bill status and EOR", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            billId: "bill_1",
            externalId: "ime_42",
            state: "denied",
            nativeStatus: "denied",
            totalCharge: 1200,
            totalPaid: 0,
            balanceDue: 1200,
            lastEventId: "event_7",
            updatedAt: "2026-08-25T23:00:00.000Z",
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            billId: "bill_1",
            reportedPaid: 0,
            totalPaid: 0,
            balanceDue: 1200,
            payment: null,
            payments: [],
            lineItems: [],
          },
        }),
      );
    const client = new MindBillClient({
      apiKey: "mb_sandbox_secret",
      fetch: fetcher,
    });

    expect((await client.getBillStatus("bill_1")).data.state).toBe("denied");
    expect((await client.getBillEor("bill_1")).data.balanceDue).toBe(1200);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "https://app.mindbill.org/partner/v1/bills/bill_1/status",
      "https://app.mindbill.org/partner/v1/bills/bill_1/eor",
    ]);
  });

  it("uploads and removes a billing attachment with idempotency", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: "attachment_1",
            externalId: "report_42",
            filename: "final-report.pdf",
            description: "Final report",
            documentType: "final_report",
            reportType: null,
            reportTypeCode: null,
            source: "partner",
            addedAt: "2026-08-25T23:00:00.000Z",
            contentUrl: "/partner/v1/bills/bill_1/attachments/attachment_1/content",
          },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = new MindBillClient({
      apiKey: "mb_sandbox_secret",
      fetch: fetcher,
    });

    const uploaded = await client.uploadBillAttachment(
      "bill_1",
      {
        file: new Blob(["synthetic pdf"], { type: "application/pdf" }),
        filename: "final-report.pdf",
        documentType: "final_report",
        externalId: "report_42",
      },
      "attach-report-42",
    );
    expect(uploaded.data.id).toBe("attachment_1");
    const [, uploadRequest] = fetcher.mock.calls[0]!;
    const uploadHeaders = new Headers(uploadRequest?.headers);
    expect(uploadHeaders.get("idempotency-key")).toBe("attach-report-42");
    expect(uploadHeaders.has("content-type")).toBe(false);
    expect(uploadRequest?.body).toBeInstanceOf(FormData);
    const uploadBody = uploadRequest?.body as FormData;
    expect(uploadBody.get("documentType")).toBe("final_report");
    expect(uploadBody.get("externalId")).toBe("report_42");

    await client.deleteBillAttachment(
      "bill_1",
      "attachment_1",
      "remove-report-42",
    );
    const [deleteUrl, deleteRequest] = fetcher.mock.calls[1]!;
    expect(deleteUrl).toBe(
      "https://app.mindbill.org/partner/v1/bills/bill_1/attachments/attachment_1",
    );
    expect(deleteRequest?.method).toBe("DELETE");
  });

  it("creates and submits a second review", async () => {
    const review = {
      data: {
        id: "review_1",
        billId: "bill_1",
        originalBillId: "bill_1",
        externalId: "sbr_42",
        type: "second_review" as const,
        state: "draft" as const,
        reason: "Payment does not match the allowed amount.",
        disputedAmount: 1200,
        payerClaimControlNumber: "payer_control_42",
        attachmentIds: ["attachment_1"],
        submittedAt: null,
        createdAt: "2026-08-25T23:00:00.000Z",
        updatedAt: "2026-08-25T23:00:00.000Z",
      },
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(review, { status: 201 }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: { ...review.data, state: "submitted", submittedAt: review.data.updatedAt },
        }),
      );
    const client = new MindBillClient({
      apiKey: "mb_sandbox_secret",
      fetch: fetcher,
    });

    const created = await client.createBillReview(
      "bill_1",
      {
        externalId: "sbr_42",
        type: "second_review",
        reason: review.data.reason,
        disputedAmount: 1200,
        payerClaimControlNumber: "payer_control_42",
        attachmentIds: ["attachment_1"],
      },
      "create-sbr-42",
    );
    expect(created.data.type).toBe("second_review");
    const submitted = await client.submitBillReview(
      "bill_1",
      "review_1",
      "submit-sbr-42",
    );
    expect(submitted.data.state).toBe("submitted");
    expect(fetcher.mock.calls[1]?.[0]).toBe(
      "https://app.mindbill.org/partner/v1/bills/bill_1/reviews/review_1/submit",
    );
  });

  it("surfaces RFC 9457-style API errors with request IDs", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse(
          { title: "Invalid request", detail: "The bill is invalid" },
          {
            status: 422,
            headers: {
              "content-type": "application/problem+json",
              "x-request-id": "req_123",
            },
          },
        ),
      );
    const client = new MindBillClient({
      apiKey: "mb_sandbox_secret",
      fetch: fetcher,
    });
    const error = await client
      .getBill("bill_1")
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MindBillError);
    expect(error).toMatchObject({
      status: 422,
      requestId: "req_123",
      message: "The bill is invalid",
    });
  });

  it("requires billId for a timeline embed before making a request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = new MindBillClient({
      apiKey: "mb_sandbox_secret",
      fetch: fetcher,
    });
    expect(() =>
      client.createEmbedSession({
        component: "bill-timeline",
        allowedOrigin: "https://partner.example.test",
      }),
    ).toThrow("billId is required");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("requires billId for a bill review embed before making a request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = new MindBillClient({
      apiKey: "mb_sandbox_secret",
      fetch: fetcher,
    });
    expect(() =>
      client.createEmbedSession({
        component: "bill-review",
        allowedOrigin: "https://partner.example.test",
      }),
    ).toThrow("billId is required for bill-review sessions");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("normalizes an exact embed origin and submits a bounded expiry", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        sessionId: "session_1",
        component: "collections",
        token: "single-use-session-token",
        embedUrl: "https://embed.mindbill.org/v1/collections",
        mindBillUrl: "https://app.mindbill.org/bills/synthetic_bill_1",
        expiresAt: "2026-08-16T01:00:00.000Z",
      }),
    );
    const client = new MindBillClient({
      apiKey: "mb_sandbox_secret",
      fetch: fetcher,
    });
    const session = await client.createEmbedSession({
      component: "collections",
      allowedOrigin: "https://partner.example.test",
      expiresIn: 300,
    });

    const [url, request] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://app.mindbill.org/partner/v1/embed/sessions");
    expect(JSON.parse(String(request?.body))).toEqual({
      component: "collections",
      allowedOrigin: "https://partner.example.test",
      expiresIn: 300,
    });
    expect(session.mindBillUrl).toBe(
      "https://app.mindbill.org/bills/synthetic_bill_1",
    );
  });

  it("rejects invalid embed origins and expiries before making a request", () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = new MindBillClient({
      apiKey: "mb_sandbox_secret",
      fetch: fetcher,
    });
    expect(() =>
      client.createEmbedSession({
        component: "collections",
        allowedOrigin: "https://partner.example.test/path",
      }),
    ).toThrow("allowedOrigin must be an exact HTTPS origin");
    expect(() =>
      client.createEmbedSession({
        component: "collections",
        allowedOrigin: "https://partner.example.test",
        expiresIn: 59,
      }),
    ).toThrow("expiresIn must be an integer from 60 through 3600 seconds");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("verifies webhook signatures against the exact raw body", () => {
    const secret = "synthetic_webhook_secret";
    const timestamp = 1_800_000_000;
    const rawBody = new TextEncoder().encode(
      '{"id":"event_1","sequence":"9007199254740993"}',
    );
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.`)
      .update(rawBody)
      .digest("hex");
    const header = `t=${timestamp},v1=${"0".repeat(64)},v1=${signature}`;

    expect(
      verifyMindBillWebhookSignature(rawBody, header, secret, {
        now: timestamp,
      }),
    ).toBe(true);
    expect(
      verifyMindBillWebhookSignature(
        new TextEncoder().encode("{}"),
        header,
        secret,
        { now: timestamp },
      ),
    ).toBe(false);
    expect(
      verifyMindBillWebhookSignature(rawBody, header, secret, {
        now: timestamp + 301,
      }),
    ).toBe(false);
    expect(
      verifyMindBillWebhookSignature(rawBody, "t=not-a-time,v1=bad", secret, {
        now: timestamp,
      }),
    ).toBe(false);
  });

  it("compares arbitrary-length decimal event sequences without Number coercion", () => {
    expect(
      compareMindBillEventSequence("9007199254740993", "9007199254740992"),
    ).toBe(1);
    expect(compareMindBillEventSequence("00042", "42")).toBe(0);
    expect(compareMindBillEventSequence("99", "100")).toBe(-1);
    expect(() => compareMindBillEventSequence("42.1", "43")).toThrow(
      "decimal digits only",
    );
  });
});
