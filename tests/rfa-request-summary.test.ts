// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { RfaRecord } from "@mindbill/browser";
import { RfaRequestSummary } from "../packages/react/src/rfa-request-summary";
import { RfaDashboard } from "../packages/react/src/rfa-dashboard";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const record: RfaRecord = { id: "rfa_synthetic", contentRevision: 1, claimId: "claim_synthetic", patientId: "patient_synthetic", renderingProviderId: "provider_synthetic", claimsAdminId: "admin_synthetic", employeeName: "Synthetic patient", providerName: "Synthetic physician", claimNumber: "SYNTHETIC-001", status: "received", requestType: "resubmission_material_change", reviewType: "prospective", expedited: true, writtenConfirmation: true, signedAt: "2026-09-01T00:00:00Z", submittedAt: "2026-09-01T00:00:00Z", receivedAt: null, createdAt: null, updatedAt: null, decisionDueAt: null, decisionDeadlineBasis: null, incompleteReason: null, deferredReason: null, closedReason: null, readiness: { ready: true, missing: [] }, dateOfInjury: "2026-08-01T00:00:00Z", providerNpi: "1234567890", providerPhone: "555-555-0100", providerFax: "555-555-0101", requestingPractice: { name: "Saved practice", address: "1 Synthetic Road", city: "Test City", state: "CA", zip: "90001", phone: "555-555-0102", fax: "555-555-0103", email: "practice@example.test" }, authorizationContact: { name: "Saved administrator", contactName: "Saved contact", email: "saved@example.test" }, rationale: "Synthetic rationale <script>alert(1)</script>", materialChange: "Synthetic changed facts", placeOfServiceCode: "11", items: [{ id: "item_synthetic", serviceDescription: "Synthetic therapy", diagnosisCode: "M54.50", diagnosisDescription: "Synthetic diagnosis", procedureCode: "97110", frequency: "Twice weekly", duration: "Six weeks", requestedFrom: "2026-09-01", requestedTo: "2026-10-15", quantity: 12, units: 0, outcome: "pending", authorizationNumber: null, decisionReason: null }], documents: [], transmissions: [], informationRequests: [], events: [] };
it("renders saved snapshots, request flags and complete requested service details without interpreting text as HTML", () => {
 const element = document.createElement("div"); element.innerHTML = renderToStaticMarkup(createElement(RfaRequestSummary, { rfa: record }));
 for (const text of ["rfa_synthetic", "SYNTHETIC-001", "2026-08-01", "1234567890", "555-555-0101", "Saved practice", "1 Synthetic Road", "practice@example.test", "Saved administrator", "Saved contact", "saved@example.test", "resubmission material change", "Synthetic changed facts", "Synthetic diagnosis", "Twice weekly", "Six weeks", "2026-10-15"]) expect(element.textContent).toContain(text);
 const value = (name: string) => [...element.querySelectorAll("dt")].find(el => el.textContent === name)?.nextElementSibling?.textContent;
 expect(value("Units")).toBe("0"); expect(value("Quantity")).toBe("12"); expect(value("Expedited review")).toBe("Yes"); expect(value("Written confirmation of prior oral request")).toBe("Yes");
 expect(element.querySelector("script")).toBeNull(); expect(element.textContent).toContain("<script>alert(1)</script>"); expect(element.querySelectorAll("button,input,select,textarea")).toHaveLength(0);
});
it("labels missing contact and claim values without inventing demographics", () => {
 const html = renderToStaticMarkup(createElement(RfaRequestSummary, { rfa: { ...record, claimNumber: null, dateOfInjury: null, requestingPractice: null, authorizationContact: null, items: [] } }));
 expect(html).toContain("Not recorded"); expect(html).toContain("No services recorded"); expect(html).not.toContain("Date of birth"); expect(html).not.toContain("View current claims administrator directory");
});
it("opens the current directory for a submitted request while retaining its saved contact", async () => {
 const fetcher = vi.fn<typeof fetch>(async input => {
  const path = new URL(String(input)).pathname;
  if (path.endsWith("/claims-administrators/admin_synthetic")) return Response.json({ data: { name: "Current administrator", telephoneNumbers: ["555-555-0199"] } });
  if (path.endsWith("/rfas")) return Response.json({ data: [record], summary: { total: 1, byStatus: { received: 1 } }, nextCursor: null });
  if (path.endsWith("/rfas/rfa_synthetic")) return Response.json({ data: record });
  if (path.endsWith("/packets")) return Response.json({ data: { packets: [], transmissions: [] } });
  if (path.endsWith("/billing-profile")) return Response.json({ data: { billingProviders: [], locations: [] } });
  return Response.json({ data: [] });
 });
 const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
 try {
  await act(async () => root.render(createElement(RfaDashboard, { getSession: async () => ({ token: "synthetic_token" }), fetch: fetcher })));
  await act(async () => [...container.querySelectorAll("button")].find(el => el.textContent === "Review request")!.click());
  expect(container.textContent).toContain("Saved administrator");
  await act(async () => [...container.querySelectorAll("button")].find(el => el.textContent === "View current claims administrator directory")!.click());
  expect(container.querySelector('[role="dialog"]')?.textContent).toContain("Current administrator");
  expect(container.querySelector('[aria-label="Saved request details"]')?.textContent).toContain("Saved administrator");
  expect(container.textContent).toContain("Current directory information may differ");
  expect(fetcher.mock.calls.every(([, init]) => !init?.method || init.method === "GET")).toBe(true);
 } finally { await act(async () => root.unmount()); container.remove(); }
});
