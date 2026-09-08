// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DentalDraftEditor, type DentalDraftContentInput } from "../packages/react/src/dental-draft-editor";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
});

const fixture = (): DentalDraftContentInput => ({
  renderingProviderId: "provider_demo", billingProviderId: "billing_demo",
  diagnosisCodes: ["K02.9", "K08.409"], notes: "Synthetic draft",
  attestations: { providerSignatureOnFile: true, providerAcceptAssignment: "A", benefitsAssignment: "Y", releaseOfInformation: "I", evidenceReference: "synthetic-attestations" },
  adaForm: {
    patientConsent: { mode: "signature_on_file", signerName: "Synthetic Patient", signedDate: "2026-09-01", evidenceReference: "synthetic-consent" },
    directPaymentAuthorization: { mode: "signature_on_file", signerName: "Synthetic Patient", signedDate: "2026-09-01", evidenceReference: "synthetic-payment-consent" },
    providerCertification: { printedName: "Synthetic Dentist", signedDate: "2026-09-06", evidenceReference: "synthetic-certification" },
    treatingLicenseNumber: "SYNTHETIC", treatmentLocation: { line1: "1 Example Street", city: "Example", state: "CA", postalCode: "90001" }, treatingPhone: "2025550100",
  },
  authorizationNumber: "AUTH-DEMO", orthodontics: { appliancePlacementDate: "2026-01-01", totalMonths: 12, remainingMonths: 6 }, missingTeeth: ["1", "16"],
  lines: [
    { code: "D0120", description: "Synthetic first service", editionYear: 2026, serviceDate: "2026-09-06", quantity: 1, chargeCents: 10000, chargeReference: "Demo practice", teeth: ["19"], surfaces: ["O"], oralCavity: null, prosthesisNotes: null, prosthesis: { placement: "I" }, diagnosisPointers: [1] },
    { code: "D2750", description: "Synthetic second service", editionYear: 2026, serviceDate: "2026-09-06", quantity: 2, chargeCents: 20000, chargeReference: "Demo practice", teeth: ["20"], surfaces: ["M"], oralCavity: null, prosthesisNotes: "Synthetic replacement", prosthesis: { placement: "R", priorPlacementDate: "2020-01-01" }, diagnosisPointers: [2, 1] },
  ],
});

async function mount(content: DentalDraftContentInput) {
  const container = document.createElement("div"); document.body.append(container);
  const onSave = vi.fn<(updated: DentalDraftContentInput) => Promise<void>>().mockResolvedValue(undefined);
  root = createRoot(container);
  await act(async () => root!.render(createElement(DentalDraftEditor, { initialContent: content, onSave })));
  return { container, onSave };
}

async function edit(container: HTMLElement, label: string, value: string) {
  const field = Array.from(container.querySelectorAll("label")).find((node) => node.textContent?.startsWith(label))?.querySelector("input, textarea");
  expect(field).toBeTruthy();
  const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(field, value);
    field!.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("dental editor full-content saves", () => {
  it("retains recorded clinical details and evidence while editing without mutating input", async () => {
    const original = fixture(); const snapshot = structuredClone(original);
    const { container, onSave } = await mount(original);
    await edit(container, "Notes", "Updated synthetic notes");
    await edit(container, "Service description", "Updated synthetic service");
    await edit(container, "Extended line charge", "125.50");
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0]![0]).toEqual({ ...snapshot, notes: "Updated synthetic notes", lines: [{ ...snapshot.lines[0]!, description: "Updated synthetic service", chargeCents: 12550 }, snapshot.lines[1]!] });
    expect(original).toEqual(snapshot);
  });

  it("keeps clinical details on their service when preceding lines are removed and new lines added", async () => {
    const original = fixture(); const { container, onSave } = await mount(original);
    for (const text of ["Remove service 1", "Add dental service"]) {
      await act(async () => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === text)!.click());
    }
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(onSave).toHaveBeenCalledOnce();
    const saved = onSave.mock.calls[0]![0];
    expect(saved).toMatchObject({ ...original, lines: [original.lines[1]!, { code: null, chargeCents: null, teeth: [], surfaces: [] }] });
    expect(saved.lines).toHaveLength(2);
    expect(saved.lines[1]).not.toHaveProperty("prosthesis");
    expect(saved.lines[1]).not.toHaveProperty("diagnosisPointers");
    expect(original.lines).toHaveLength(2);
  });
});
