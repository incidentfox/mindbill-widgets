// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { createBillDraftsClient } from "../packages/browser/src/index";
import { ConnectedTreatmentBillForm } from "../packages/react/src/connected-treatment-bill-form";
import type { BillSubmissionInput } from "../packages/react/src/bill-submission-form";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const address = { line1: "100 Synthetic Way", city: "Oakland", state: "CA", postalCode: "94612" };
const bill: BillSubmissionInput = {
  externalId: "synthetic_visit", billingMode: "professional",
  patient: { firstName: "Ada", lastName: "Example", dateOfBirth: "1980-01-02", address },
  claim: { claimNumber: "SYNTHETIC-9", employer: "Synthetic Foods", dateOfInjury: "2026-08-01", claimsAdministrator: { id: "payer_synthetic", name: "Synthetic Claims Administrator" } },
  service: { date: "2026-10-08" },
  billingProvider: { name: "Synthetic Spine Group", taxId: "123456789", npi: "1234567890", phone: "5105550100", address },
  renderingProvider: { name: "Sam Example, D.C.", npi: "1098765432", taxonomy: "111N00000X" },
  serviceLocation: { name: "Synthetic Office", placeOfServiceCode: "11", address },
  diagnoses: ["M54.50"],
  serviceLines: [{ code: "99213", units: 1, charge: 150, serviceDate: "2026-10-08", diagnosisPointers: [1] }],
};
const draft = (revision: number, extra: Record<string, unknown> = {}) => ({ id: "billdraft_1", externalId: null, status: "draft", revision, claimId: null, patientId: null,
  bill: { ...bill, serviceLines: [{ code: "99214", units: 1, charge: 210, serviceDate: "2026-10-08", diagnosisPointers: [1] }] },
  encounter: { renderingProviderId: "rp_saved", placeOfServiceId: "loc_saved" }, serviceLineCount: 1, submittedBillId: null,
  createdAt: "2026-10-16T00:00:00Z", updatedAt: "2026-10-16T00:00:00Z", submittedAt: null, ...extra });
const session = async () => ({ token: "mbes_synthetic", apiBaseUrl: "https://api.example.test" });

it("the drafts client uses /partner/v2/bill-drafts with revisions and idempotency keys", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async (_input, init) => init?.method === "DELETE" ? Response.json({ data: { id: "billdraft_1", deleted: true } }) : Response.json({ data: draft(2) }, { status: init?.method === "POST" ? 201 : 200 }));
  const client = createBillDraftsClient({ getSession: session, fetch });
  await client.create({ bill: { billingMode: "professional" }, encounter: { renderingProviderId: "rp" }, externalId: "visit-1" }, "key-1");
  await client.update("billdraft_1", 1, { bill: { billingMode: "professional" } }, "key-2");
  await client.get("billdraft_1");
  await client.remove("billdraft_1", 2, "key-3");
  const calls = fetch.mock.calls.map(([url, init]) => [String(url), init?.method ?? "GET", new Headers(init?.headers).get("idempotency-key"), init?.body ? JSON.parse(String(init.body)) : null]);
  expect(calls).toEqual([
    ["https://api.example.test/partner/v2/bill-drafts", "POST", "key-1", { bill: { billingMode: "professional" }, encounter: { renderingProviderId: "rp" }, externalId: "visit-1" }],
    ["https://api.example.test/partner/v2/bill-drafts/billdraft_1", "PATCH", "key-2", { expectedRevision: 1, bill: { billingMode: "professional" } }],
    ["https://api.example.test/partner/v2/bill-drafts/billdraft_1", "GET", null, null],
    ["https://api.example.test/partner/v2/bill-drafts/billdraft_1?expectedRevision=2", "DELETE", "key-3", null],
  ]);
});

async function render(props: Record<string, unknown>, fetch: typeof globalThis.fetch) {
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(createElement(ConnectedTreatmentBillForm, { initialBill: bill, encounter: {}, getSession: session, fetch, deliveryRoutePicker: "off", ...props })));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
  return { container, unmount: async () => { await act(async () => root.unmount()); container.remove(); } };
}

it("saves a new draft, then updates it at its new revision, without submitting", async () => {
  let revision = 0;
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const url = String(input);
    if (url.includes("/bill-drafts")) { revision += 1; return Response.json({ data: draft(revision) }, { status: init?.method === "POST" ? 201 : 200 }); }
    return Response.json({ data: [] });
  });
  const onDraftSaved = vi.fn();
  const view = await render({ drafts: true, encounter: { renderingProviderId: "rp_1", placeOfServiceId: "loc_1" }, onDraftSaved }, fetch);
  try {
    const button = [...view.container.querySelectorAll("button")].find(item => item.textContent === "Save draft")!;
    await act(async () => { button.click(); await new Promise(resolve => setTimeout(resolve, 20)); });
    await act(async () => { button.click(); await new Promise(resolve => setTimeout(resolve, 20)); });
    const draftCalls = fetch.mock.calls.filter(([url]) => String(url).includes("/bill-drafts"));
    expect(draftCalls.map(([, init]) => init?.method)).toEqual(["POST", "PATCH"]);
    expect(JSON.parse(String(draftCalls[0]![1]?.body)).encounter).toEqual({ renderingProviderId: "rp_1", placeOfServiceId: "loc_1" });
    expect(JSON.parse(String(draftCalls[1]![1]?.body)).expectedRevision).toBe(1);
    expect(onDraftSaved).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls.some(([url]) => String(url).endsWith("/partner/v2/bills"))).toBe(false);
  } finally { await view.unmount(); }
});

it("resumes a saved draft with its bill and pricing ids, and a submitted draft cannot be edited", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
    const url = String(input);
    if (url.includes("/bill-drafts/")) return Response.json({ data: draft(4) });
    if (url.endsWith("/fee-quotes/encounter")) return Response.json({ data: null }, { status: 503 });
    return Response.json({ data: [] });
  });
  const view = await render({ draftId: "billdraft_1", drafts: true }, fetch);
  try {
    expect((view.container.querySelector("[data-field-path='serviceLines.0.code'] input") as HTMLInputElement | null)?.value ?? view.container.textContent).toContain("99214");
    const quote = fetch.mock.calls.find(([url]) => String(url).endsWith("/fee-quotes/encounter"));
    expect(JSON.parse(String(quote![1]?.body))).toMatchObject({ renderingProviderId: "rp_saved", placeOfServiceId: "loc_saved" });
  } finally { await view.unmount(); }
  const submitted = vi.fn<typeof globalThis.fetch>(async () => Response.json({ data: draft(5, { status: "submitted", submittedBillId: "bill_9" }) }));
  const second = await render({ draftId: "billdraft_1" }, submitted);
  try { expect(second.container.textContent).toContain("already submitted as bill bill_9"); } finally { await second.unmount(); }
});
