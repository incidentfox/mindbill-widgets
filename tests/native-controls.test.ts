// @vitest-environment happy-dom
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { BillSubmissionForm, type BillSubmissionInput } from "../packages/react/src/bill-submission-form";
import { Checkbox, FileInput, Radio } from "../packages/react/src/form-controls";
import { BillingSettings } from "../packages/react/src/organization-onboarding";
import { RfaSentOutsideFields } from "../packages/react/src/rfa-sent-outside";
import { W9Upload } from "../packages/react/src/w9-upload";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

/** Native inputs may exist only underneath a styled control (`mbctl-native`) or as a `hidden` picker opened by a styled button. */
function visibleNativeControls(root: ParentNode): string[] {
  return [
    ...[...root.querySelectorAll("select")].map(() => "select"),
    ...[...root.querySelectorAll<HTMLInputElement>('input[type="checkbox"], input[type="radio"], input[type="file"]')]
      .filter((input) => !input.classList.contains("mbctl-native") && !input.hidden).map((input) => `input[type=${input.type}]`),
  ];
}

async function mounted(element: ReactElement, run: (container: HTMLElement) => Promise<void> | void) {
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  try { await act(async () => root.render(element)); await act(async () => {}); await run(container); } finally { await act(async () => root.unmount()); container.remove(); }
}

const address = { line1: "100 Example Way", city: "Sacramento", state: "CA", postalCode: "95814" };
const bill: BillSubmissionInput = {
  externalId: "synthetic_controls", billingMode: "professional",
  patient: { firstName: "Ada", lastName: "Example", dateOfBirth: "1980-01-02", address },
  claim: { claimNumber: "SYNTHETIC-1", employer: "Synthetic Foods", dateOfInjury: "2026-08-01", claimsAdministrator: { id: "payer_synthetic", name: "Synthetic Claims Administrator" } },
  service: { date: "2026-10-08" },
  billingProvider: { name: "Synthetic Spine Clinic", taxId: "123456789", npi: "1234567893", phone: "9165550100", address },
  renderingProvider: { name: "Avery Example, MD", npi: "1098765432", taxonomy: "208VP0014X" },
  serviceLocation: { name: "Example Spine Office", placeOfServiceCode: "11", address },
  diagnoses: ["M54.50"], serviceLines: [{ code: "99213", units: 1, charge: 120, diagnosisPointers: [1] }],
};

describe("no visible native form controls", () => {
  it("styled Checkbox, Radio and FileInput keep the native input's behavior underneath", async () => {
    const onChange = vi.fn(); const onFile = vi.fn();
    await mounted(createElement("form", null,
      createElement("label", null, createElement(Checkbox, { name: "agree", onChange }), "I agree"),
      createElement("label", null, createElement(Radio, { name: "method", value: "fax", defaultChecked: true }), "Fax"),
      createElement("label", null, createElement(Radio, { name: "method", value: "email" }), "E-mail"),
      createElement("label", null, "Proof", createElement(FileInput, { name: "proof", accept: "application/pdf", onChange: onFile }))), async (container) => {
      expect(visibleNativeControls(container)).toEqual([]);
      expect(container.querySelectorAll(".mbctl-check .mbctl-tick")).toHaveLength(3);
      expect(container.querySelector('.mbctl-check[data-kind="radio"]')).not.toBeNull();
      const box = container.querySelector<HTMLInputElement>('input[name="agree"]')!;
      await act(async () => box.click());
      expect(box.checked).toBe(true); expect(onChange).toHaveBeenCalledTimes(1);
      const email = container.querySelector<HTMLInputElement>('input[value="email"]')!;
      await act(async () => email.closest("label")!.click());
      expect(new FormData(container.querySelector("form")!).get("method")).toBe("email");
      const file = container.querySelector<HTMLInputElement>('input[type="file"]')!;
      expect(container.querySelector(".mbctl-file-btn")?.textContent).toBe("Choose file");
      Object.defineProperty(file, "files", { configurable: true, value: [new File(["%PDF-1.4"], "proof.pdf", { type: "application/pdf" })] });
      await act(async () => { file.dispatchEvent(new Event("change", { bubbles: true })); });
      expect(onFile).toHaveBeenCalledTimes(1);
      expect(container.querySelector(".mbctl-file-name")?.textContent).toBe("proof.pdf");
    });
  });

  it("the bill form, W-9 upload, sent-outside fields and billing settings render only styled controls", async () => {
    await mounted(createElement(BillSubmissionForm, { initialBill: bill, onSubmit: vi.fn(), profileOptions: {}, deliveryRoutePicker: "off" }), (container) => {
      expect(container.querySelector(".mbctl-check")).not.toBeNull();
      expect(visibleNativeControls(container)).toEqual([]);
    });
    await mounted(createElement(W9Upload, { onUpload: async () => undefined }), (container) => {
      expect(container.querySelector(".mbctl-file")).not.toBeNull();
      expect(visibleNativeControls(container)).toEqual([]);
    });
    await mounted(createElement("form", null, createElement(RfaSentOutsideFields, {})), (container) => {
      expect(visibleNativeControls(container)).toEqual([]);
    });
    const profile = { organizationId: "synthetic", practiceIdentity: {}, billingProviders: [], renderingProviders: [], locations: [], w9: null, onboarding: { status: null, complete: false, checklist: [] } };
    await mounted(createElement(BillingSettings, { getSession: async () => ({ token: "synthetic" }), fetch: vi.fn<typeof fetch>(async () => Response.json({ data: profile })) }), (container) => {
      for (const details of container.querySelectorAll("details")) details.open = true;
      expect(visibleNativeControls(container)).toEqual([]);
    });
  });

  it("no widget source renders a native select, checkbox, radio or visible file input", () => {
    const dir = resolve(__dirname, "../packages/react/src");
    const offenders = readdirSync(dir).filter((file) => file.endsWith(".tsx") && file !== "form-controls.tsx").flatMap((file) => {
      const source = readFileSync(resolve(dir, file), "utf8");
      return [...source.matchAll(/<select[\s>]|<input\b[\s\S]*?\/>/g)]
        .filter((match) => match[0].startsWith("<select") || /\stype="(?:checkbox|radio)"/.test(match[0]) || (/\stype="file"/.test(match[0]) && !/\shidden[\s/>]/.test(match[0])))
        .map((match) => `${file}: ${match[0].slice(0, 60)}`);
    });
    expect(offenders).toEqual([]);
  });
});
