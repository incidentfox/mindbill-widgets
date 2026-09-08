// Synthetic responses used ONLY by the production-browser acceptance script.
import type { BillLifecycleData, BillSubmissionInput } from "@mindbill/react";
type DemoState = { lifecycle: BillLifecycleData | null; input: BillSubmissionInput | null };
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


export { BILL_ID, PAYER, directory, deliveryOptions, initialProfile, makeLifecycle, registry, tasks };
