// @vitest-environment happy-dom
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { BillingSettings } from "../packages/react/src/organization-onboarding";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const getSession = async () => ({ token: "synthetic" });
const doctors = [
  { id: "rp_a", name: "Dr Synthetic A", npi: "1111111111", specialty: "QME", active: true, signatureConfigured: true, signatureOnClaimForm: true },
  { id: "rp_b", name: "Dr Synthetic B", npi: "2222222222", active: false, signatureConfigured: false, signatureOnClaimForm: false },
];
const profile = { organizationId: "synthetic", practiceIdentity: {}, billingProviders: [], renderingProviders: doctors, locations: [], w9: null, onboarding: { status: null, complete: false, checklist: [] } };

async function mounted(element: ReactElement, run: (container: HTMLDivElement) => Promise<void>) {
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  try { await act(async () => root.render(element)); await run(container); } finally { await act(async () => root.unmount()); container.remove(); }
}
const button = (container: HTMLElement, label: string) => [...container.querySelectorAll("button")].find((item) => item.textContent === label || item.getAttribute("aria-label") === label);

describe("rendering providers settings", () => {
  it("lists every doctor with Edit, marks inactive ones and signature status, and adds a provider", async () => {
    const puts: unknown[] = [];
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/signature")) return Response.json({ data: { providerId: "rp_a", signatureConfigured: true, signatureOnClaimForm: true, contentType: "image/png", contentBase64: "AA==" } });
      if (init?.method === "PUT") {
        const body = JSON.parse(String(init.body)); puts.push(body);
        return Response.json({ data: { ...profile, renderingProviders: [...doctors, { ...body.renderingProviders[0], id: "rp_new", signatureConfigured: false, signatureOnClaimForm: false }] } });
      }
      return Response.json({ data: profile });
    });
    await mounted(createElement(BillingSettings, { getSession, fetch: fetcher }), async (container) => {
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
      const list = container.querySelector("[aria-label='Saved rendering providers']")!;
      expect(list.querySelectorAll("li")).toHaveLength(2);
      expect(list.textContent).toContain("Inactive");
      expect(list.textContent).toContain("✓ Signature prints on bills");
      expect(list.textContent).toContain("No signature");
      expect(button(container, "Edit Dr Synthetic A")).toBeTruthy();

      await act(async () => button(container, "Edit Dr Synthetic A")!.click());
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
      expect(container.querySelector("img[alt='Saved signature for Dr Synthetic A']")?.getAttribute("src")).toBe("data:image/png;base64,AA==");
      expect(button(container, "Replace signature")).toBeTruthy();

      await act(async () => button(container, "+ Add provider")!.click());
      const editor = container.querySelector("[aria-label='Add provider']")!;
      const inputs = editor.querySelectorAll<HTMLInputElement>("input:not([type])");
      const setValue = (element: HTMLInputElement, value: string) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value);
        element.dispatchEvent(new Event("input", { bubbles: true }));
      };
      await act(async () => { setValue(inputs[0]!, "Dr Synthetic C"); setValue(inputs[1]!, "3333333333"); });
      await act(async () => button(editor as HTMLElement, "Add provider")!.click());
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
      expect(puts).toEqual([{ renderingProviders: [{ name: "Dr Synthetic C", npi: "3333333333", specialty: "", taxonomy: "", active: true }] }]);
      expect(container.textContent).toContain("Saved Dr Synthetic C. Add their signature below");
      expect(container.querySelector("[aria-label='Signature for Dr Synthetic C']")).toBeTruthy();
    });
  });
});
