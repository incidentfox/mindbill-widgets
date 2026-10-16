// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { RfaCreateForm } from "../packages/react/src/rfa-create-form";
import type { RfaClient } from "../packages/browser/src/index";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it("a prepared official draft still shows the saved employee details and return e-mail", async () => {
  const getCreationContext = vi.fn(async () => ({
    claims: [{ claimId: "clm_1", patientId: "pat_1", employeeName: "Ada Example", employeeFormName: "Example, Ada", dateOfBirth: "1980-01-02", employer: "Synthetic Foods", claimNumber: "SYN-1" }],
    renderingProviders: [{ id: "rp_1", name: "Sam Example, MD", specialty: "Orthopedic Surgery" }],
    returnEmail: "rfa-returns@example.test", nextCursor: null, providerNextCursor: null,
  }));
  const client = { getCreationContext } as unknown as RfaClient;
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  const initialDraft = { claimId: "clm_1", patientId: "pat_1", renderingProviderId: "rp_1", employeeName: "Ada Example", providerName: "Sam Example, MD",
    items: [{ diagnosisCode: "M54.2", serviceDescription: "Chiropractic manipulation", procedureCode: "98940", quantity: 6 }] };
  await act(async () => root.render(createElement(RfaCreateForm, { client, initialDraft, draftFormProps: { officialForm: true }, onSave: async () => undefined } as never)));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  try {
    expect(getCreationContext).toHaveBeenCalledWith({ claimId: "clm_1", renderingProviderId: "rp_1", limit: 1 });
    expect(container.textContent).toContain("Synthetic Foods");
    const values = [...container.querySelectorAll("input")].map(input => (input as HTMLInputElement).value);
    expect(values).toContain("rfa-returns@example.test");
  } finally { await act(async () => root.unmount()); container.remove(); }
});
