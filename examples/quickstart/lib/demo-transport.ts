import { randomUUID } from "node:crypto";
import type { BillLifecycleData, BillSubmissionInput } from "@mindbill/react";

/** Local, fictional API responses for the starter. Never forwards a request to MindBill. */
const COOKIE = "mindbill_starter_demo";
const TTL = 8 * 60 * 60 * 1000;
const MAX_REQUEST_BYTES = 12 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const BILL_ID = "synthetic-bill-001";
const PAYER = { id: "synthetic-payer-001", name: "Example Claims Administrator", hasElectronic: true, states: ["CA"], payerSelectionRequired: false };
const directory = { ...PAYER, description: "Fictional directory entry for this local demo. No delivery takes place.", aliases: [], payers: [] };
const delivery = {
  route: "ebill", label: "Simulated electronic delivery", detail: "Local demo only. Nothing is sent.",
  fallback: false, confidence: "high", payerName: PAYER.name,
};
const deliveryOptions = { payerName: PAYER.name, recommended: delivery, options: [delivery], contacts: {} };

function initialProfile() {
  return {
    organizationId: "synthetic-organization-001",
    practiceIdentity: { name: "Example Review Practice", legalName: "Example Review Practice", taxId: "000000000", taxIdType: "EIN", npi: "1234567893", phone: "2025550100", email: "practice@example.com" },
    billingProviders: [{ id: "synthetic-provider-001", name: "Example Review Practice", taxId: "000000000", npi: "1234567893", billType: "Professional", phone: "2025550100", billingStreet: "100 Example Avenue", billingCity: "Pasadena", billingState: "CA", billingZip: "91101" }],
    renderingProviders: [{ id: "synthetic-clinician-001", name: "Dr. Jamie Example", npi: "1234567893", specialty: "Physical medicine and rehabilitation", taxonomy: "208100000X", licenseNumber: "EXAMPLE", licenseState: "CA", isQME: true, isAME: false, email: "reviewer@example.com", active: true }],
    locations: [{ id: "synthetic-location-001", name: "Example Review Practice", street: "100 Example Avenue", city: "Pasadena", state: "CA", zip: "91101", posCode: "11", isPrimary: true, active: true }],
    w9: null as { filename: string; addDate: string; taxYear?: number } | null,
    onboarding: { status: "demo", complete: true, checklist: [{ id: "demo", label: "Fictional practice profile", complete: true }] },
  };
}

type DemoState = {
  touched: number;
  profile: ReturnType<typeof initialProfile>;
  input: BillSubmissionInput | null;
  lifecycle: BillLifecycleData | null;
  files: Map<string, { filename: string; base64: string }>;
};
// Per-process demo state survives page reloads. Restarting the server clears it.
const sessions = new Map<string, DemoState>();
function newState(): DemoState {
  return { touched: Date.now(), profile: initialProfile(), input: null, lifecycle: null, files: new Map() };
}
function json(value: unknown, status = 200, cookie?: string) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", ...(cookie ? { "Set-Cookie": cookie } : {}) } });
}
function failure(message: string, status = 400) { return json({ error: message }, status); }
function matches(value: unknown, query: string) { return JSON.stringify(value).toLowerCase().includes(query.toLowerCase()); }
function pageNumber(value: string | null, fallback: number, cap = 1000) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.min(cap, Math.floor(number)) : fallback;
}

function makeLifecycle(input: BillSubmissionInput, documents: Array<Record<string, unknown>>): BillLifecycleData {
  const now = new Date().toISOString();
  const total = input.serviceLines.reduce((sum, line) => sum + (line.charge ?? 0), 0);
  const provider = input.billingProvider;
  const address = provider?.address;
  const clinician = input.renderingProvider;
  const location = input.serviceLocation;
  return {
    environment: "sandbox",
    bill: {
      id: BILL_ID, billNumber: "DEMO-001", status: "submitted", transmissionState: "sent", billingMode: input.billingMode ?? "med_legal", dos: input.service.date,
      dosEnd: input.service.endDate, authorizationNumber: input.service.authorizationNumber,
      billingSnapshot: {
        billingProvider: { name: provider?.name ?? "Example Review Practice", taxId: provider?.taxId ?? "000000000", npi: provider?.npi ?? "1234567893", billType: "Professional", phone: provider?.phone, billingStreet: address?.line1, billingCity: address?.city, billingState: address?.state, billingZip: address?.postalCode },
        renderingProvider: { name: clinician?.name ?? "Dr. Jamie Example", specialty: clinician?.specialty ?? "", npi: clinician?.npi ?? "1234567893", taxonomy: clinician?.taxonomy, isQME: clinician?.isQme, isAME: clinician?.isAme },
        placeOfService: { name: location?.name ?? "Example Review Practice", street: location?.address?.line1 ?? "", city: location?.address?.city ?? "", state: location?.address?.state ?? "", zip: location?.address?.postalCode ?? "", posCode: location?.placeOfServiceCode },
      },
      lineItems: input.serviceLines.map((line, index) => ({ ...line, id: `synthetic-line-${index + 1}`, modifiers: line.modifiers ?? [], units: line.units ?? 1, charge: line.charge ?? 0 })),
      attachments: documents.map((document, index) => ({ id: `synthetic-document-${index + 1}`, filename: String(document.filename ?? "synthetic-document.pdf"), documentType: String(document.documentType ?? "other"), description: typeof document.description === "string" ? document.description : null, addedAt: now })),
      totalCharge: total, totalPaid: 0, balanceDue: total,
    },
    patient: { name: `${input.patient.firstName} ${input.patient.lastName}`, firstName: input.patient.firstName, lastName: input.patient.lastName, dob: input.patient.dateOfBirth, phone: input.patient.phone, address: input.patient.address },
    injury: { claimNumber: input.claim.claimNumber, employer: input.claim.employer, doi: input.claim.dateOfInjury, adjNumber: input.claim.adjNumber, claimsAdminId: PAYER.id, claimsAdminName: PAYER.name, diagnosisCodes: input.diagnoses ?? [], diagnoses: (input.diagnoses ?? []).map(code => ({ code, description: code === "M25.512" ? "Pain in left shoulder" : "Demo diagnosis" })) },
    lifecycle: { state: "submitted", nativeStatus: "submitted", submittedAt: now, updatedAt: now, agingDays: 0, actions: [{ id: "close", label: "Close bill", enabled: true }] },
    eors: [], payments: [], notes: [],
    activity: [{ id: "synthetic-activity-001", type: "submitted", createdAt: now, title: "Demo bill created", description: "Simulated submission. No payer was contacted.", actor: "Demo reviewer", delivery: "ebill", amount: null, accepted: null, stcCategory: null }],
    history: [{ id: "synthetic-history-001", date: now, action: "Demo submission", kind: "submission", actor: "Demo reviewer", summary: "Created locally. No payer was contacted.", tone: "submission" }],
    remittance: { billedAmount: total, expectedAmount: total, payerAllowedAmount: null, payerReportedPaid: null, postedPrincipal: 0, postedAdditional: 0, totalPostedCash: 0, balanceDue: total, denialReason: null },
    delivery: { payerName: PAYER.name, contacts: {}, directory }, rejection: null,
  };
}

function registry(state: DemoState, params: URLSearchParams) {
  const data = state.lifecycle;
  const input = state.input;
  let items = data && input ? [{
    id: BILL_ID, billNumber: String(data.bill.billNumber), externalId: input.externalId ?? null,
    patientName: data.patient.name, claimNumber: input.claim.claimNumber, claimsAdministrator: PAYER.name,
    status: { id: data.lifecycle.state === "closed" ? "closed" : "sent", label: data.lifecycle.state === "closed" ? "Closed" : "Submitted (demo)", tone: "info" },
    dateOfService: input.service.date, procedureCodes: input.serviceLines.map(line => line.code),
    billingProviderId: "synthetic-provider-001", renderingProviderId: "synthetic-clinician-001", renderingProviderName: input.renderingProvider?.name ?? "Dr. Jamie Example",
    submittedAt: data.lifecycle.submittedAt ?? null, arAgeDays: 0, totalCharge: data.bill.totalCharge, totalPaid: 0, balanceDue: data.bill.balanceDue,
  }] : [];
  const q = params.get("q") ?? "";
  const status = params.get("status");
  const age = params.get("age");
  items = items.filter(item => matches(item, q)
    && (!status || status === "all" || item.status.id === status)
    && (!age || age === "all" || age === "0-30")
    && (!params.get("claimsAdminId") || params.get("claimsAdminId") === PAYER.id)
    && (!params.get("billingProviderId") || params.get("billingProviderId") === item.billingProviderId)
    && (!params.get("renderingProviderId") || params.get("renderingProviderId") === item.renderingProviderId)
    && (!params.get("taskKind") || params.get("taskKind") === "submitted"));
  const page = pageNumber(params.get("page"), 1);
  const pageSize = pageNumber(params.get("pageSize"), 25, 100);
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, balanceTotal: items.reduce((sum, item) => sum + item.balanceDue, 0), page, pageSize, filters: { renderingProviders: [{ id: "synthetic-clinician-001", name: "Dr. Jamie Example" }] } };
}

function tasks(state: DemoState) {
  const empty = { sections: [], grandTotals: [0, 0, 0, 0, 0], grandTotal: 0, grandBalanceTotals: [0, 0, 0, 0, 0], grandBalanceTotal: 0 };
  const bill = state.lifecycle;
  const count = bill && bill.lifecycle.state !== "closed" ? 1 : 0;
  const balance = count ? bill!.bill.balanceDue : 0;
  const counts = [count, 0, 0, 0, 0];
  const balances = [balance, 0, 0, 0, 0];
  return {
    dashboard: empty,
    waiting: count ? { sections: [{ id: "waiting", label: "Waiting for payer (simulated)", agingBasisLabel: "Days since submission", tone: "blue", rows: [{ id: "submitted", label: "Submitted", counts, total: count, balances, balanceTotal: balance, refs: [[BILL_ID], [], [], [], []] }], totals: counts, total: count, balanceTotals: balances, balanceTotal: balance, empty: false }], grandTotals: counts, grandTotal: count, grandBalanceTotals: balances, grandBalanceTotal: balance } : empty,
    filters: { claimsAdministrators: [{ id: PAYER.id, name: PAYER.name }], renderingProviders: [{ id: "synthetic-clinician-001", name: "Dr. Jamie Example" }] },
  };
}

/** A deliberately small fake API, not an authentication or persistence implementation. */
export async function handleDemoRequest(request: Request): Promise<Response> {
  if (process.env.MINDBILL_MODE === "sandbox") return failure("Not found.", 404);
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/demo/, "").replace(/\/$/, "");
  const method = request.method.toUpperCase();
  // Next may reconstruct request.url with its bind hostname; Host retains the browser-facing authority.
  if (!["GET", "HEAD"].includes(method) && request.headers.get("origin") !== `${url.protocol}//${request.headers.get("host") ?? url.host}`) return failure("Origin not allowed.", 403);
  const now = Date.now();
  for (const [key, state] of sessions) if (now - state.touched > TTL) sessions.delete(key);
  const sessionId = request.headers.get("cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  let state = sessionId ? sessions.get(sessionId) : undefined;
  if (path === "/state" && method === "GET") {
    if (!state) {
      if (sessions.size >= 100) sessions.delete(sessions.keys().next().value!);
      const id = randomUUID();
      state = newState();
      sessions.set(id, state);
      return json({ billId: null }, 200, `${COOKIE}=${id}; Path=/api/demo; HttpOnly; SameSite=Strict; Max-Age=${TTL / 1000}${url.protocol === "https:" ? "; Secure" : ""}`);
    }
    state.touched = now;
    return json({ billId: state.lifecycle?.bill.id ?? null });
  }
  if (!state || !sessionId) return failure("Initialize this local demo with GET /api/demo/state first.", 401);
  state.touched = now;
  if (path === "/reset" && method === "POST") { sessions.set(sessionId, newState()); return json({ billId: null }); }
  let body: Record<string, unknown> = {};
  if (!["GET", "HEAD"].includes(method)) {
    try {
      if (Number(request.headers.get("content-length")) > MAX_REQUEST_BYTES) return failure("This local demo accepts at most 12 MB per request.", 413);
      const reader = request.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > MAX_REQUEST_BYTES) {
              await reader.cancel();
              return failure("This local demo accepts at most 12 MB per request.", 413);
            }
            chunks.push(value);
          }
        } finally { reader.releaseLock(); }
      }
      const text = Buffer.concat(chunks, size).toString("utf8");
      const parsed: unknown = text ? JSON.parse(text) : {};
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return failure("Expected a JSON object.");
      body = parsed as Record<string, unknown>;
    } catch { return failure("Invalid JSON."); }
  }
  if (path === "/partner/v2/organization" || path === "/partner/v2/organization/billing-profile") {
    if (method === "GET") return json({ data: state.profile });
    if (method === "PUT" && path.endsWith("billing-profile")) {
      if (body.practiceIdentity && typeof body.practiceIdentity === "object") state.profile.practiceIdentity = { ...state.profile.practiceIdentity, ...body.practiceIdentity };
      if (Array.isArray(body.billingProviders)) state.profile.billingProviders = body.billingProviders;
      if (Array.isArray(body.renderingProviders)) state.profile.renderingProviders = body.renderingProviders;
      return json({ data: state.profile });
    }
  }
  if (path === "/partner/v2/organization/locations" && method === "PUT") {
    if (!Array.isArray(body.locations)) return failure("locations must be an array.");
    state.profile.locations = body.locations;
    return json({ data: state.profile });
  }
  if (path === "/partner/v2/organization/w9" && method === "PUT") {
    if (typeof body.filename !== "string") return failure("A filename is required.");
    state.profile.w9 = { filename: body.filename, addDate: new Date().toISOString(), ...(typeof body.taxYear === "number" ? { taxYear: body.taxYear } : {}) };
    return json({ data: state.profile });
  }
  if (method === "GET") {
    const q = url.searchParams.get("q") ?? "";
    if (path === "/partner/v2/claims-administrators") {
      const results = matches(PAYER, q) && !Number(url.searchParams.get("offset")) ? [PAYER] : [];
      return json({ results, total: matches(PAYER, q) ? 1 : 0 });
    }
    if (path === `/partner/v2/claims-administrators/${PAYER.id}`) return json({ data: directory });
    if (path === "/partner/v2/diagnosis-codes") return json({ results: [{ code: "M25.512", description: "Pain in left shoulder" }].filter(item => matches(item, q) && !Number(url.searchParams.get("offset"))) });
    if (path === "/partner/v2/procedure-codes") {
      const results = [{ code: "ML201" }, { code: "ML202" }, { code: "ML203" }].filter(item => matches(item, q));
      return json({ results, total: results.length, limit: pageNumber(url.searchParams.get("limit"), 30, 100), jurisdiction: "CA", catalogAsOf: null });
    }
    if (path === "/partner/v2/postal-codes") return url.searchParams.get("postalCode") === "91101" ? json({ city: "Pasadena", state: "CA" }) : failure("ZIP code is not included in the demo.", 404);
    if (path === "/partner/v2/delivery-preview") return json({ data: deliveryOptions });
    if (path === "/partner/v2/bill-dashboard") return json({ data: registry(state, url.searchParams) });
    if (path === "/partner/v2/bill-tasks") return json({ data: tasks(state) });
    if (path === "/partner/v2/reports/payments") return json({ data: { items: [], total: 0, page: 1, pageSize: 25, summary: { postedTotal: 0, entryCount: 0, uniquePatients: 0 } } });
    if (path.startsWith("/partner/v2/reports/")) {
      const from = url.searchParams.get("from") ?? new Date().toISOString().slice(0, 10);
      const to = url.searchParams.get("to") ?? from;
      const bill = state.lifecycle;
      const day = bill?.lifecycle.submittedAt?.slice(0, 10) ?? "";
      const inRange = !!bill && day >= from && day <= to;
      if (path.endsWith("/service-line-items")) {
        const lines = inRange ? bill!.bill.lineItems : [];
        return json({ data: { from, to, windowLabel: `${from} – ${to}`, cptRows: lines.map(line => ({ code: line.code, bills: 1, lines: 1, billed: line.charge })), billRows: inRange ? [{ billId: BILL_ID, billNumber: "DEMO-001", submittedDate: day, dos: bill!.bill.dos, patient: bill!.patient.name, claim: state.input!.claim.claimNumber, claimsAdmin: PAYER.name, codes: lines.map(line => line.code), billed: bill!.bill.totalCharge, status: bill!.lifecycle.state }] : [], totalBills: inRange ? 1 : 0, totalLines: lines.length, totalBilled: inRange ? bill!.bill.totalCharge : 0 } });
      }
      if (path.endsWith("/productivity")) {
        const count = inRange ? 1 : 0;
        return json({ data: { lo: from, hi: to, dayKeys: inRange ? [day] : [], billers: inRange ? [{ name: "Demo reviewer", initials: "DR" }] : [], created: inRange ? { "Demo reviewer": { [day]: 1 } } : {}, sent: inRange ? { "Demo reviewer": { [day]: 1 } } : {}, createdTotal: inRange ? { "Demo reviewer": 1 } : {}, sentTotal: inRange ? { "Demo reviewer": 1 } : {}, submittedTotal: inRange ? { "Demo reviewer": 1 } : {}, cleanTotal: {}, totalCreated: count, totalSent: count, totalSubmitted: count, totalClean: 0 } });
      }
    }
  }
  if (path === "/partner/v2/fee-quotes" && method === "POST") return json({ data: { status: "requires_review", reason: "The offline demo has no fee schedule. Keep or enter the fictional example charge.", provenance: [] } });
  if (path === "/partner/v2/bills" && method === "POST") {
    if (state.lifecycle) return json({ data: { id: BILL_ID, externalId: state.input?.externalId, state: state.lifecycle.lifecycle.state } });
    const input = body.bill as BillSubmissionInput | undefined;
    if (!input?.patient?.firstName || !input.claim?.claimNumber || !input.service?.date || !Array.isArray(input.serviceLines) || !input.serviceLines.length || input.serviceLines.some(line => !line || typeof line.code !== "string" || typeof line.charge !== "number" || !Number.isFinite(line.charge) || line.charge < 0)) return failure("A patient, claim, service date, and valid service lines are required.");
    const documents = Array.isArray(body.documents) ? body.documents as Array<Record<string, unknown>> : [];
    if (documents.length > 10) return failure("This local demo accepts at most 10 PDF attachments.", 413);
    let documentBytes = 0;
    for (const document of documents) {
      if (!document || typeof document.filename !== "string" || typeof document.contentBase64 !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(document.contentBase64)) return failure("Attachments must contain a filename and base64 PDF content.");
      const content = Buffer.from(document.contentBase64, "base64");
      documentBytes += content.byteLength;
      if (documentBytes > MAX_DOCUMENT_BYTES) return failure("This local demo accepts at most 8 MB of PDF attachments in total.", 413);
      if (content.subarray(0, 5).toString("ascii") !== "%PDF-") return failure("Only PDF attachments are supported in this local demo.");
    }
    state.input = input;
    state.lifecycle = makeLifecycle(input, documents);
    documents.forEach((document, index) => {
      if (typeof document.contentBase64 === "string") state!.files.set(`synthetic-document-${index + 1}`, { filename: String(document.filename ?? "synthetic-document.pdf"), base64: document.contentBase64 });
    });
    return json({ data: { id: BILL_ID, externalId: input.externalId, state: "submitted" } }, 201);
  }
  const billPath = `/partner/v2/bills/${BILL_ID}`;
  if (path.startsWith(`${billPath}/`)) {
    const data = state.lifecycle;
    if (!data) return failure("Create the fictional bill first.", 404);
    if (path === `${billPath}/lifecycle` && method === "GET") return json({ data });
    if (path === `${billPath}/delivery-options` && method === "GET") return json({ data: deliveryOptions });
    if (path.startsWith(`${billPath}/documents/`) && method === "GET") {
      const file = state.files.get(path.slice(`${billPath}/documents/`.length));
      if (!file) return failure("This attachment is not available in the local demo.", 404);
      return new Response(Buffer.from(file.base64, "base64"), { headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store", "Content-Disposition": "inline" } });
    }
    if (path === `${billPath}/actions` && method === "POST") {
      const action = body.action;
      if (!["add_note", "close", "reopen"].includes(String(action))) return failure("This action is not implemented in the offline demo. Use a sandbox to try it.", 501);
      const description = action === "add_note" ? body.note : body.reason;
      if (typeof description !== "string" || !description.trim() || description.length > 5000) return failure("Enter a note or reason of at most 5,000 characters.");
      if ((data.history?.length ?? 0) >= 100) return failure("Reset the local demo to add more activity.", 413);
      const date = new Date().toISOString();
      const id = `synthetic-${randomUUID()}`;
      const actor = typeof body.actorName === "string" ? body.actorName : "Demo reviewer";
      if (action === "add_note") data.notes = [...(data.notes ?? []), { id, body: description, author: actor, createdAt: date, pinned: false }];
      else {
        const closed = action === "close";
        data.bill.status = closed ? "closed" : "submitted";
        data.lifecycle.state = data.bill.status;
        data.lifecycle.nativeStatus = data.bill.status;
        data.lifecycle.actions = [{ id: closed ? "reopen" : "close", label: closed ? "Reopen bill" : "Close bill", enabled: true }];
      }
      data.lifecycle.updatedAt = date;
      data.history = [...(data.history ?? []), { id, date, action: action === "add_note" ? "Note" : action === "close" ? "Closed" : "Reopened", kind: action === "add_note" ? "note" : action === "close" ? "close" : "reopen", actor, summary: description, tone: "note" }];
      return json({ data });
    }
  }
  return failure(`The offline demo does not implement ${method} ${path}. No external request was made.`, 501);
}
