// @vitest-environment happy-dom
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { createBillReferenceClient, sanitizeBillReviewSaveInput, type MedicalProviderNetwork } from "../packages/browser/src/index";
import { MedicalProviderNetworkSelect } from "../packages/react/src/medical-provider-network-select";
import { BillSubmissionForm, BillSubmissionClaimSection, validateBillSubmission, type BillSubmissionInput } from "../packages/react/src/bill-submission-form";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const rows: MedicalProviderNetwork[] = [
  { id: "0001", name: "Sample Coast Network", applicantName: "Example Employer", status: "Approved" },
  { id: "0002", name: "Sample Valley Network", applicantName: "Demo Insurer", status: "Approved" },
  { id: "0003", name: "Terminated Example", applicantName: "Closed Employer", status: "Terminated" },
  { id: "0004", name: "Withdrawn Example", applicantName: "Closed Insurer", status: "Withdrawn" },
];
const loadOptions = async () => rows;
async function mount(element: React.ReactElement) {
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return { container, cleanup: async () => { await act(async () => root.unmount()); container.remove(); } };
}
async function type(input: HTMLInputElement, value: string) {
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
}
async function key(input: HTMLInputElement, value: string) { await act(async () => { input.dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true })); }); }
function Controlled({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return createElement("div", null, createElement(MedicalProviderNetworkSelect, { value, onChange: setValue, loadOptions }), createElement("output", null, value));
}
describe("medical provider network directory", () => {
  it("requests the full directory with the browser session and filters inactive/malformed records without dropping leading zeros", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ data: [...rows, { id: 5, status: "Approved" }], total: 4 }));
    const client = createBillReferenceClient({ apiBaseUrl: "https://api.example.test", getSession: async () => ({ token: "synthetic-session" }), fetch: fetcher });
    expect(await client.listMedicalProviderNetworks()).toEqual(rows.slice(0, 2));
    expect(fetcher.mock.calls[0]![0]).toBe("https://api.example.test/partner/v2/medical-provider-networks");
    expect(new Headers(fetcher.mock.calls[0]![1]!.headers).get("authorization")).toBe("Bearer synthetic-session");
    fetcher.mockResolvedValueOnce(Response.json({ data: {} }));
    await expect(client.listMedicalProviderNetworks()).rejects.toThrow("invalid response");
    fetcher.mockResolvedValueOnce(Response.json({ detail: "Unavailable" }, { status: 503 }));
    await expect(client.listMedicalProviderNetworks()).rejects.toThrow();
  });
  it("searches names, applicants and IDs, chooses with the keyboard, and clears without saving arbitrary text", async () => {
    const ui = await mount(createElement(Controlled));
    try {
      const input = ui.container.querySelector<HTMLInputElement>('[role="combobox"]')!;
      await act(async () => input.focus());
      expect(ui.container.querySelectorAll('[role="option"]')).toHaveLength(2);
      for (const query of ["Valley", "Demo Insurer", "0002"]) {
        await type(input, query);
        expect(ui.container.querySelectorAll('[role="option"]')).toHaveLength(1);
        expect(ui.container.querySelector('[role="option"]')!.textContent).toContain("Sample Valley");
      }
      expect(ui.container.querySelector("output")!.textContent).toBe("");
      await key(input, "Enter");
      expect(ui.container.querySelector("output")!.textContent).toBe("0002");
      expect(input.value).toBe("Sample Valley Network · 0002");
      await key(input, "ArrowDown"); await key(input, "ArrowDown"); await key(input, "ArrowUp"); await key(input, "Enter");
      expect(ui.container.querySelector("output")!.textContent).toBe("0001");
      await type(input, "arbitrary text"); await key(input, "Escape");
      expect(input.value).toBe("Sample Coast Network · 0001");
      await act(async () => ui.container.querySelector<HTMLButtonElement>('[aria-label="Clear medical provider network"]')!.click());
      expect(ui.container.querySelector("output")!.textContent).toBe("");
    } finally { await ui.cleanup(); }
  });
  it("preserves a historical saved ID while excluding inactive options", async () => {
    const ui = await mount(createElement(Controlled, { initial: "0003" }));
    try {
      const input = ui.container.querySelector<HTMLInputElement>("input")!;
      expect(input.value).toBe("MPN 0003");
      await act(async () => input.focus()); await type(input, "0003");
      expect(ui.container.querySelector('[role="option"]')).toBeNull();
      expect(ui.container.textContent).toContain("No active networks found");
      await key(input, "Escape"); expect(input.value).toBe("MPN 0003");
    } finally { await ui.cleanup(); }
  });
  it("keeps the optional field usable after a directory failure and offers retry", async () => {
    const loader = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(rows);
    const ui = await mount(createElement(MedicalProviderNetworkSelect, { value: "", onChange: vi.fn(), loadOptions: loader }));
    try {
      await act(async () => ui.container.querySelector<HTMLInputElement>("input")!.focus());
      expect(ui.container.textContent).toContain("could not be loaded");
      await act(async () => ui.container.querySelector<HTMLButtonElement>("button")!.click());
      expect(ui.container.querySelectorAll('[role="option"]')).toHaveLength(2);
    } finally { await ui.cleanup(); }
  });
  it("hydrates the bill-entry field and never requires an MPN", async () => {
    const bill: BillSubmissionInput = { patient: { firstName: "Synthetic", lastName: "Example", dateOfBirth: "2000-01-01", address: { line1: "1 Example St", city: "Example", state: "CA", postalCode: "90000" } }, claim: { claimNumber: "SYNTHETIC", medicalProviderNetworkId: "0002" }, service: { date: "2026-09-01" }, serviceLines: [] };
    const ui = await mount(createElement(BillSubmissionForm, { initialBill: bill, onSubmit: vi.fn(), profileOptions: {}, onLookupPostalCode: async () => null, onListMedicalProviderNetworks: loadOptions }, createElement(BillSubmissionClaimSection)));
    try {
      expect(ui.container.querySelector<HTMLInputElement>('.mb-mpn input')!.value).toBe("Sample Valley Network · 0002");
      expect(ui.container.querySelector('.mb-mpn label')!.textContent).toContain("optional");
      expect(validateBillSubmission({ ...bill, claim: { claimNumber: "SYNTHETIC" } }).fieldErrors).not.toHaveProperty("claim.medicalProviderNetworkId");
    } finally { await ui.cleanup(); }
  });
  it("preserves explicit clear and omission through the review request whitelist", () => {
    const saved = sanitizeBillReviewSaveInput({ claimsAdminId: "payer_synthetic", dos: "2026-09-01", lineItems: [], injuryOverrides: { medicalProviderNetworkId: null } });
    expect(saved.injuryOverrides).toEqual({ medicalProviderNetworkId: null });
    expect(sanitizeBillReviewSaveInput({ claimsAdminId: "payer_synthetic", dos: "2026-09-01", lineItems: [], injuryOverrides: {} }).injuryOverrides).not.toHaveProperty("medicalProviderNetworkId");
  });
});
