// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { BillSubmissionForm, type BillSubmissionFormProps, type BillSubmissionInput } from "../packages/react/src/bill-submission-form";
import { billSubmissionProfileSummary, matchingBillSubmissionProfileOption, type BillSubmissionProfileOptions } from "../packages/react/src/billing-profile-options";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const address = { line1: "100 Example Way", city: "Sacramento", state: "CA", postalCode: "95814" };
const profileOptions: BillSubmissionProfileOptions = {
  billingProviders: [
    { id: "bp_synthetic", label: "Synthetic Spine Clinic", value: { id: "bp_synthetic", name: "Synthetic Spine Clinic", taxId: "12-3456789", taxIdType: "EIN", npi: "1234567893", phone: "9165550100", address } },
    { id: "bp_other", label: "Other Synthetic Group", value: { id: "bp_other", name: "Other Synthetic Group", taxId: "98-7654321", taxIdType: "EIN", npi: "1987654321", phone: "9165550111", address } },
  ],
  renderingProviders: [{ id: "rp_synthetic", label: "Avery Example, MD", value: { name: "Avery Example, MD", npi: "1098765432", taxonomy: "208VP0014X", specialty: "Pain medicine" } }],
  serviceLocations: [{ id: "loc_synthetic", label: "Example Spine Office", value: { name: "Example Spine Office", placeOfServiceCode: "11", address } }],
};
const bill: BillSubmissionInput = {
  externalId: "synthetic_saved_profiles", billingMode: "professional",
  patient: { firstName: "Ada", lastName: "Example", dateOfBirth: "1980-01-02", address },
  claim: { claimNumber: "SYNTHETIC-1", employer: "Synthetic Foods", dateOfInjury: "2026-08-01", claimsAdministrator: { id: "payer_synthetic", name: "Synthetic Claims Administrator" } },
  service: { date: "2026-10-08" },
  billingProvider: structuredClone(profileOptions.billingProviders![0]!.value),
  renderingProvider: structuredClone(profileOptions.renderingProviders![0]!.value),
  serviceLocation: structuredClone(profileOptions.serviceLocations![0]!.value),
  diagnoses: ["M54.50"],
  serviceLines: [{ code: "99213", units: 1, charge: 120, diagnosisPointers: [1] }],
};

async function render(props: Partial<BillSubmissionFormProps> = {}) {
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  const onSubmit = vi.fn();
  await act(async () => root.render(createElement(BillSubmissionForm, { initialBill: bill, profileOptions, onSubmit, deliveryRoutePicker: "off", ...props })));
  const field = (path: string) => container.querySelector<HTMLElement>(`[data-field-path="${path}"]`);
  const summary = (section: string) => container.querySelector<HTMLElement>(`[data-profile-summary="${section}"]`);
  const button = (label: string) => [...container.querySelectorAll<HTMLButtonElement>("button")].find(node => node.getAttribute("aria-label") === label || node.textContent === label);
  const type = async (input: HTMLInputElement, value: string) => act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  return { container, onSubmit, field, summary, button, type, unmount: async () => { await act(async () => root.unmount()); container.remove(); } };
}

describe("saved provider and location choices", () => {
  it("collapses each saved choice to a one-line summary with Edit", async () => {
    const view = await render();
    try {
      expect(view.summary("billingProvider")?.textContent).toContain("Synthetic Spine Clinic · EIN ••6789 · NPI 1234567893 · Sacramento, CA");
      expect(view.summary("renderingProvider")?.textContent).toContain("Avery Example, MD · NPI 1098765432 · 208VP0014X");
      expect(view.summary("serviceLocation")?.textContent).toContain("Example Spine Office · POS 11 · 100 Example Way, Sacramento");
      for (const path of ["billingProvider.npi", "billingProvider.address.line1", "renderingProvider.npi", "renderingProvider.taxonomy", "serviceLocation.placeOfServiceCode", "serviceLocation.address.line1"]) expect(view.field(path)).toBeNull();
      expect(view.container.textContent).not.toContain("Tax ID type");
      for (const label of ["Edit billing provider", "Edit rendering provider", "Edit service facility"]) expect(view.button(label)?.textContent).toBe("Edit");
    } finally { await view.unmount(); }
  });

  it("Edit expands only that section, and an edited value stays expanded", async () => {
    const view = await render();
    try {
      await act(async () => view.button("Edit rendering provider")!.click());
      expect(view.summary("renderingProvider")).toBeNull();
      expect(view.field("renderingProvider.npi")).not.toBeNull();
      expect(view.summary("billingProvider")).not.toBeNull(); expect(view.summary("serviceLocation")).not.toBeNull();
      expect(view.field("billingProvider.npi")).toBeNull();
      const npi = view.field("renderingProvider.npi")!.querySelector("input")!;
      await view.type(npi, "1555555555");
      // Edited: no longer the saved choice, so there is nothing to collapse back to.
      expect(view.button("Done editing rendering provider")).toBeUndefined();
      expect(view.field("renderingProvider.npi")).not.toBeNull();
      await view.type(npi, "1098765432");
      // Back to the saved values: the user may collapse it again.
      await act(async () => view.button("Done editing rendering provider")!.click());
      expect(view.summary("renderingProvider")?.textContent).toContain("NPI 1098765432");
    } finally { await view.unmount(); }
  });

  it("expands a section with no matching saved record, and every field without profile options", async () => {
    const custom = await render({ initialBill: { ...bill, renderingProvider: { name: "Hand Entered, DO", npi: "1222222222", taxonomy: "207R00000X" } } });
    try {
      expect(custom.summary("renderingProvider")).toBeNull();
      expect(custom.field("renderingProvider.npi")).not.toBeNull();
      expect(custom.summary("billingProvider")).not.toBeNull();
    } finally { await custom.unmount(); }
    const none = await render({ profileOptions: {} });
    try {
      expect(none.container.querySelector("[data-profile-summary]")).toBeNull();
      expect(none.field("billingProvider.npi")).not.toBeNull();
    } finally { await none.unmount(); }
    const expanded = await render({ profileDisplay: "expanded" });
    try {
      expect(expanded.container.querySelector("[data-profile-summary]")).toBeNull();
      expect(expanded.field("serviceLocation.placeOfServiceCode")).not.toBeNull();
    } finally { await expanded.unmount(); }
  });

  it("reveals and focuses an invalid field in a saved section, including host-flagged fields", async () => {
    // Saved by id, but the snapshot lacks the required phone: the section opens instead of hiding the gap.
    const view = await render({ initialBill: { ...bill, billingProvider: { ...bill.billingProvider!, phone: "" } } });
    try {
      expect(view.summary("billingProvider")).toBeNull();
      expect(view.summary("renderingProvider")).not.toBeNull();
      const frames: FrameRequestCallback[] = [];
      const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => { frames.push(callback); return frames.length; });
      await act(async () => { view.container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
      raf.mockRestore();
      // The next frame runs after the errors render.
      await act(async () => { for (const frame of frames) frame(0); });
      expect(view.onSubmit).not.toHaveBeenCalled();
      expect(view.field("billingProvider.phone")?.dataset.invalid).toBe("true");
      expect(document.activeElement).toBe(view.field("billingProvider.phone")!.querySelector("input"));
    } finally { await view.unmount(); }
    const flagged = await render({ attentionFields: ["serviceLocation.address.postalCode"] });
    try {
      expect(flagged.summary("serviceLocation")).toBeNull();
      expect(flagged.field("serviceLocation.address.postalCode")?.dataset.attention).toBe("true");
      expect(flagged.summary("billingProvider")).not.toBeNull();
    } finally { await flagged.unmount(); }
  });

  it("submits the collapsed saved values unchanged", async () => {
    const view = await render();
    try {
      await act(async () => { view.container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
      expect(view.onSubmit).toHaveBeenCalledTimes(1);
      const submitted = view.onSubmit.mock.calls[0]![0].bill as BillSubmissionInput;
      expect(submitted.renderingProvider).toEqual(bill.renderingProvider);
      expect(submitted.serviceLocation).toEqual(bill.serviceLocation);
      expect(submitted.billingProvider).toEqual(bill.billingProvider);
    } finally { await view.unmount(); }
  });
});

describe("saved choice matching", () => {
  it("matches by saved id, else by value ignoring empty fields", () => {
    expect(matchingBillSubmissionProfileOption(profileOptions.billingProviders, { id: "bp_other", name: "Edited name" })?.id).toBe("bp_other");
    expect(matchingBillSubmissionProfileOption(profileOptions.billingProviders, { savedProviderId: "bp_synthetic", taxIdType: "SSN" })?.id).toBe("bp_synthetic");
    expect(matchingBillSubmissionProfileOption(profileOptions.renderingProviders, { name: "Avery Example, MD", npi: "1098765432", taxonomy: "208VP0014X", specialty: "Pain medicine", licenseNumber: "", isQme: false })?.id).toBe("rp_synthetic");
    expect(matchingBillSubmissionProfileOption(profileOptions.renderingProviders, { name: "Avery Example, MD", npi: "1098765432", taxonomy: "207R00000X", specialty: "Pain medicine" })).toBeUndefined();
    expect(matchingBillSubmissionProfileOption(profileOptions.serviceLocations, { name: "Example Spine Office", placeOfServiceCode: "11", address: { ...address, line2: "" } })?.id).toBe("loc_synthetic");
    expect(matchingBillSubmissionProfileOption(undefined, bill.serviceLocation)).toBeUndefined();
  });

  it("summarizes SSN providers by their last four digits only", () => {
    expect(billSubmissionProfileSummary("billingProvider", { billingProvider: { name: "Solo Example", taxIdType: "SSN", taxIdLast4: "4321", savedProviderId: "bp_ssn", npi: "1234567893" } }).join(" · "))
      .toBe("Solo Example · SSN ••4321 · NPI 1234567893");
  });
});
