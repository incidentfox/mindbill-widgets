// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BillSubmissionForm,
  completeBillSubmissionInput,
  diagnosisLimitNoticeText,
  isMedicalLegalBillSubmission,
  limitBillSubmissionDiagnoses,
  medicalLegalUploadDocumentType,
  setBillSubmissionCumulativeTrauma,
  submittedBillSubmissionClaim,
  suggestBillSubmissionPayer,
  validateBillSubmission,
  withDefaultBillSubmissionEvaluatorModifiers,
  withMedicalLegalLinePointers,
  type BillSubmissionFormValue,
  type BillSubmissionInput,
} from "../packages/react/src/bill-submission-form";
import { applyReportAutofill, reportAutofillInsuranceCarrier } from "../packages/react/src/report-autofill-values";
import { SendRouteDialog, sendRoutePacketSectionLabels } from "../packages/react/src/send-route-dialog";
import type { BillDeliveryOptions, BillReviewPayer, ReportAutofillResult } from "@mindbill/browser";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const address = { line1: "100 Synthetic Way", city: "Sacramento", state: "CA", postalCode: "95814" };
const codes = (count: number) => Array.from({ length: count }, (_, index) => `Z${String(index + 10).padStart(2, "0")}.0`);
const bill = (patch: Partial<BillSubmissionInput> = {}): BillSubmissionInput => ({
  externalId: "synthetic-docura", billingMode: "med_legal",
  patient: { firstName: "Ada", lastName: "Example", dateOfBirth: "1980-01-02", address },
  claim: { claimNumber: "SYN-1", employer: "Synthetic Foods", dateOfInjury: "2026-08-01", injuryState: "CA", claimsAdministrator: { id: "pd:synthetic", name: "Synthetic Claims" } },
  service: { date: "2026-10-14" },
  billingProvider: { name: "Synthetic Practice", taxId: "123456789", npi: "1234567890", phone: "2135550100", address },
  renderingProvider: { name: "Ada Evaluator", npi: "1098765432", taxonomy: "208100000X" },
  serviceLocation: { name: "Sacramento", placeOfServiceCode: "11", address },
  diagnoses: ["M54.50"], serviceLines: [{ code: "ML201", units: 1, modifiers: ["95"] }],
  ...patch,
});

async function render(element: ReturnType<typeof createElement>) {
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return { container, unmount: async () => { await act(async () => root.unmount()); container.remove(); } };
}
const submitForm = async (container: HTMLElement) => act(async () => {
  container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
});

afterEach(() => { vi.restoreAllMocks(); });

describe("diagnosis limits (Box 21 / 24E)", () => {
  it("keeps the first 12 diagnoses and each line's first 4 pointers, without shifting meaning", () => {
    const supplied = codes(23);
    const { bill: limited, notice } = limitBillSubmissionDiagnoses(bill({
      diagnoses: supplied,
      serviceLines: [
        { code: "ML201", units: 1, diagnosisPointers: Array.from({ length: 23 }, (_, index) => index + 1) },
        { code: "96130", units: 1, diagnosisPointers: [20, 3, 2] },
      ],
    }));
    expect(limited.diagnoses).toEqual(supplied.slice(0, 12));
    expect(limited.serviceLines[0]!.diagnosisPointers).toEqual([1, 2, 3, 4]);
    // Pointer 20 named a dropped code: it is removed, not re-pointed at another diagnosis.
    expect(limited.serviceLines[1]!.diagnosisPointers).toEqual([3, 2]);
    expect(notice).toEqual({ droppedDiagnoses: supplied.slice(12), trimmedLines: [0] });
    expect(diagnosisLimitNoticeText(notice!)).toContain("given 23 diagnoses");
    expect(diagnosisLimitNoticeText(notice!)).toContain("Service line 1 pointed to more than 4");
  });

  it("leaves a bill within the limits unchanged and reports nothing", () => {
    expect(limitBillSubmissionDiagnoses(bill({ diagnoses: codes(3) })).notice).toBeNull();
  });

  it("points every medical-legal line at the first four diagnoses", () => {
    const pointed = withMedicalLegalLinePointers(bill({ diagnoses: codes(6), serviceLines: [{ code: "ML201", units: 1, diagnosisPointers: [5, 6] }, { code: "96130", units: 1 }] }));
    expect(pointed.serviceLines.map((line) => line.diagnosisPointers)).toEqual([[1, 2, 3, 4], [1, 2, 3, 4]]);
    expect(isMedicalLegalBillSubmission({ serviceLines: [] })).toBe(true);
    expect(isMedicalLegalBillSubmission({ serviceLines: [{ code: "99214" }] }, true)).toBe(false);
    expect(isMedicalLegalBillSubmission({ serviceLines: [{ code: "ML201" }] }, true)).toBe(true);
  });

  it("caps host-supplied codes in the form, notes it, hides per-line pickers and submits A–D pointers", async () => {
    const onSubmit = vi.fn<(value: BillSubmissionFormValue) => void>();
    const view = await render(createElement(BillSubmissionForm, {
      initialBill: bill({ diagnoses: codes(23), serviceLines: [{ code: "ML201", units: 1, modifiers: ["94"], diagnosisPointers: Array.from({ length: 23 }, (_, index) => index + 1) }, { code: "ML202", units: 1, modifiers: ["95"], diagnosisPointers: [1, 2, 3, 4, 5] }] }),
      deliveryRoutePicker: "off", onSubmit, fetch: async () => Response.json({ data: [] }),
    }));
    try {
      expect(view.container.querySelectorAll(".mbsf-claim-diagnosis-list li")).toHaveLength(12);
      expect(view.container.querySelector('[data-diagnosis-limit="true"]')?.textContent).toContain("first 12 were kept");
      expect(view.container.querySelector('[aria-label^="Diagnosis pointers for service line"]')).toBeNull();
      expect(view.container.textContent).not.toContain("Apply the same diagnosis codes to all service lines");
      expect(view.container.querySelector('[aria-label="Evaluation type"]')).toBeNull();
      await submitForm(view.container);
      expect(onSubmit).toHaveBeenCalledTimes(1);
      const submitted = onSubmit.mock.calls[0]![0].bill;
      expect(submitted.diagnoses).toHaveLength(12);
      expect(submitted.serviceLines.map((line) => line.diagnosisPointers)).toEqual([[1, 2, 3, 4], [1, 2, 3, 4]]);
      // The supplied AME modifier is kept: the line's modifiers are the source of truth.
      expect(submitted.serviceLines[0]!.modifiers).toEqual(["94"]);
    } finally { await view.unmount(); }
  });

  it("report autofill proposes at most four diagnoses", () => {
    const result: ReportAutofillResult = { fields: [{ key: "dxCode", value: codes(9).join(", "), confidence: "high", sourceText: "synthetic" }], warnings: [], matches: { patient: { status: "none", candidates: [] }, billingProvider: { status: "none", candidates: [] }, renderingProvider: { status: "none", candidates: [] }, serviceLocation: { status: "none", candidates: [] } } } as unknown as ReportAutofillResult;
    expect(applyReportAutofill(bill({ diagnoses: [] }), result).diagnoses).toEqual(codes(4));
  });
});

describe("evaluator modifiers", () => {
  it("defaults an ML evaluation line without an evaluator modifier to -95 and never replaces one that is present", () => {
    expect(withDefaultBillSubmissionEvaluatorModifiers({ code: "ML201", modifiers: [] }).modifiers).toEqual(["95"]);
    expect(withDefaultBillSubmissionEvaluatorModifiers({ code: "ML201", modifiers: ["94"] }).modifiers).toEqual(["94"]);
    expect(withDefaultBillSubmissionEvaluatorModifiers({ code: "ML202", modifiers: ["93"] }).modifiers).toEqual(["95", "93"]);
    expect(withDefaultBillSubmissionEvaluatorModifiers({ code: "ML201", modifiers: [] }, "psych_qme").modifiers).toEqual(["95", "96"]);
    expect(withDefaultBillSubmissionEvaluatorModifiers({ code: "ML201", modifiers: ["94", "96"] }, "qme").modifiers).toEqual(["94", "96"]);
    expect(withDefaultBillSubmissionEvaluatorModifiers({ code: "99214", modifiers: ["25"] }).modifiers).toEqual(["25"]);
  });
});

describe("attachments on medical-legal bills", () => {
  it("maps every med-legal upload to the report document type, and a W-9 to w9", () => {
    expect(medicalLegalUploadDocumentType("Signed QME report.pdf")).toBe("final_report");
    expect(medicalLegalUploadDocumentType("proof-of-service.pdf")).toBe("final_report");
    expect(medicalLegalUploadDocumentType("Practice W-9 2026.pdf")).toBe("w9");
    expect(medicalLegalUploadDocumentType("w9.pdf")).toBe("w9");
    expect(medicalLegalUploadDocumentType("w90-summary.pdf")).toBe("final_report");
  });

  it("shows no document-purpose or report-type picker and does not block on a report type", async () => {
    const onSubmit = vi.fn<(value: BillSubmissionFormValue) => void>();
    const report = new File(["%PDF-1.4 synthetic"], "report.pdf", { type: "application/pdf" });
    const view = await render(createElement(BillSubmissionForm, {
      initialBill: (() => { const value = bill(); delete value.billingMode; return value; })(), initialUploads: [{ file: report, documentType: "final_report" }],
      deliveryRoutePicker: "off", onSubmit, fetch: async () => Response.json({ data: [] }),
    }));
    try {
      expect(view.container.textContent).not.toContain("Document purpose");
      expect(view.container.querySelector('[aria-label^="Report type for"]')).toBeNull();
      expect(view.container.textContent).toContain("Attach the signed report, proof of service, and any other supporting documents.");
      await submitForm(view.container);
      expect(view.container.textContent).not.toContain("Select a report type for every attachment");
      expect(onSubmit).toHaveBeenCalledTimes(1);
    } finally { await view.unmount(); }
  });

  it("keeps the document-purpose picker for treatment billing", async () => {
    const view = await render(createElement(BillSubmissionForm, {
      initialBill: bill({ billingMode: "professional", serviceLines: [{ code: "99214", units: 1, diagnosisPointers: [1] }] }), treatmentBilling: true,
      initialUploads: [{ file: new File(["%PDF-1.4"], "pr2.pdf", { type: "application/pdf" }), documentType: "other" }],
      deliveryRoutePicker: "off", fetch: async () => Response.json({ data: [] }),
    }));
    try { expect(view.container.textContent).toContain("Document purpose"); } finally { await view.unmount(); }
  });
});

describe("cumulative trauma", () => {
  it("sends injuryType and injuryEndDate only for a CT claim", () => {
    const ct = setBillSubmissionCumulativeTrauma(bill().claim, true);
    expect(submittedBillSubmissionClaim({ ...ct, dateOfInjury: "2020-01-01", injuryEndDate: "06/15/2023" })).toMatchObject({ injuryType: "cumulative", dateOfInjury: "2020-01-01", injuryEndDate: "2023-06-15" });
    const specific = submittedBillSubmissionClaim({ ...bill().claim, injuryType: "specific", injuryEndDate: "2023-06-15" });
    expect(specific).not.toHaveProperty("injuryType");
    expect(specific).not.toHaveProperty("injuryEndDate");
    expect(setBillSubmissionCumulativeTrauma(ct, false)).not.toHaveProperty("injuryType");
    expect(completeBillSubmissionInput(bill({ claim: { ...ct, injuryEndDate: "2023-06-15" } })).claim.claimsAdministrator).toEqual({ id: "pd:synthetic", name: "Synthetic Claims" });
  });

  it("requires a valid end date that is not before the start", () => {
    const errors = (claim: Partial<BillSubmissionInput["claim"]>) => validateBillSubmission(bill({ claim: { ...bill().claim, injuryType: "cumulative", ...claim } })).fieldErrors["claim.injuryEndDate"];
    expect(errors({})).toContain("end date");
    expect(errors({ dateOfInjury: "2023-06-15", injuryEndDate: "2020-01-01" })).toContain("cannot be before");
    expect(errors({ dateOfInjury: "2020-01-01", injuryEndDate: "2023-06-15" })).toBeUndefined();
  });

  it("autofill fills both CT dates into an empty claim", () => {
    const result = { fields: [
      { key: "doi", value: "2020-01-01", confidence: "high", sourceText: "CT 01/01/2020 – 06/15/2023" },
      { key: "ctStartDate", value: "2020-01-01", confidence: "high", sourceText: "CT 01/01/2020 – 06/15/2023" },
      { key: "ctEndDate", value: "2023-06-15", confidence: "high", sourceText: "CT 01/01/2020 – 06/15/2023" },
      { key: "insuranceCarrier", value: "Synthetic Mutual", confidence: "medium", sourceText: "Carrier: Synthetic Mutual" },
    ], warnings: [], matches: { patient: { status: "none", candidates: [] }, billingProvider: { status: "none", candidates: [] }, renderingProvider: { status: "none", candidates: [] }, serviceLocation: { status: "none", candidates: [] } } } as unknown as ReportAutofillResult;
    const filled = applyReportAutofill(bill({ claim: { ...bill().claim, dateOfInjury: "" } }), result);
    expect(filled.claim).toMatchObject({ injuryType: "cumulative", dateOfInjury: "2020-01-01", injuryEndDate: "2023-06-15" });
    expect(applyReportAutofill(bill(), result).claim.injuryType).toBeUndefined();
    expect(reportAutofillInsuranceCarrier(result)).toBe("Synthetic Mutual");
  });

  it("the CT toggle adds the end date field and the neutral helper text", async () => {
    const onSubmit = vi.fn<(value: BillSubmissionFormValue) => void>();
    const view = await render(createElement(BillSubmissionForm, {
      initialBill: bill({ claim: { ...bill().claim, injuryType: "cumulative", dateOfInjury: "2020-01-01", injuryEndDate: "2023-06-15" } }),
      deliveryRoutePicker: "off", onSubmit, fetch: async () => Response.json({ data: [] }),
    }));
    try {
      expect(view.container.querySelector<HTMLInputElement>('[aria-label="Cumulative trauma end date"]')?.value).toBe("06/15/2023");
      expect(view.container.textContent).toContain("The bill uses the end date unless the claims administrator has a different date of injury on file.");
      await submitForm(view.container);
      expect(onSubmit.mock.calls[0]![0].bill.claim).toMatchObject({ injuryType: "cumulative", dateOfInjury: "2020-01-01", injuryEndDate: "2023-06-15" });
    } finally { await view.unmount(); }
  });
});

describe("payer (subpayor) suggestion", () => {
  const payer = (patch: Partial<BillReviewPayer> = {}): BillReviewPayer => ({
    id: "pd:multi", name: "Synthetic TPA", payerSelectionRequired: true,
    payers: [{ id: "p1", label: "Synthetic Mutual" }, { id: "p2", label: "Example Casualty", aliases: ["Example Cas Co"] }, { id: "p3", label: "Sample Indemnity" }],
    ...patch,
  });
  it("prefers the only payer, then the only e-billable payer, then a carrier match, then the most used", () => {
    expect(suggestBillSubmissionPayer(payer({ payers: [{ id: "solo", label: "Only" }] }))).toEqual({ payerId: "solo", reason: "only_payer" });
    expect(suggestBillSubmissionPayer(payer({ suggestedPayerId: "p3", suggestedPayerReason: "single_ebill" }), ["Synthetic Mutual"])).toEqual({ payerId: "p3", reason: "single_ebill" });
    expect(suggestBillSubmissionPayer(payer({ suggestedPayerId: "p3", suggestedPayerReason: "most_used" }), ["Example Casualty Company"])).toEqual({ payerId: "p2", reason: "carrier_match" });
    expect(suggestBillSubmissionPayer(payer({ suggestedPayerId: "p3", suggestedPayerReason: "most_used" }), ["Unrelated Carrier"])).toEqual({ payerId: "p3", reason: "most_used" });
    expect(suggestBillSubmissionPayer(payer())).toBeNull();
    expect(suggestBillSubmissionPayer(payer({ suggestedPayerId: "gone", suggestedPayerReason: "most_used" }))).toBeNull();
  });

  it("a carried-over administrator loads its payers and shows the carried-over payer preselected", async () => {
    const list = vi.fn(async () => ({ results: [payer()], total: 1 }));
    const view = await render(createElement(BillSubmissionForm, {
      initialBill: bill({ claim: { ...bill().claim, claimsAdministrator: { id: "pd:multi", name: "Synthetic TPA", payerId: "p2" } } }),
      onListClaimsAdministrators: list, deliveryRoutePicker: "off", onSubmit: () => undefined, fetch: async () => Response.json({ data: [] }),
    }));
    try {
      await act(async () => { await Promise.resolve(); });
      expect(list).toHaveBeenCalledWith(expect.objectContaining({ query: "Synthetic TPA" }));
      expect(view.container.querySelector<HTMLInputElement>('[aria-label="Payer"]')?.value).toBe("Example Casualty");
      expect(view.container.textContent).toContain("Payer set:");
    } finally { await view.unmount(); }
  });

  it("a host administrator without a payer gets the suggested payer, shown as a suggestion", async () => {
    const list = vi.fn(async () => ({ results: [payer({ suggestedPayerId: "p3", suggestedPayerReason: "most_used" })], total: 1 }));
    const onSubmit = vi.fn<(value: BillSubmissionFormValue) => void>();
    const view = await render(createElement(BillSubmissionForm, {
      initialBill: bill({ claim: { ...bill().claim, claimsAdministrator: { id: "pd:multi", name: "Synthetic TPA" } } }),
      onListClaimsAdministrators: list, deliveryRoutePicker: "off", onSubmit, fetch: async () => Response.json({ data: [] }),
    }));
    try {
      await act(async () => { await Promise.resolve(); });
      expect(view.container.querySelector<HTMLInputElement>('[aria-label="Payer"]')?.value).toBe("Sample Indemnity");
      expect(view.container.querySelector('[data-suggested="true"]')?.textContent).toContain("most often billed");
      await submitForm(view.container);
      expect(onSubmit.mock.calls[0]![0].bill.claim.claimsAdministrator).toEqual({ id: "pd:multi", name: "Synthetic TPA", payerId: "p3" });
    } finally { await view.unmount(); }
  });
});

describe("packet preview in the delivery-route dialog", () => {
  const delivery = { payerName: "Synthetic Claims", recommended: { route: "fax" }, options: [{ route: "fax", label: "Fax" }, { route: "mail", label: "Mail" }], contacts: { faxNumber: "2135550100", mailingAddress: "PO Box 1\nSacramento, CA 95814" } } as unknown as BillDeliveryOptions;

  it("labels packet sections in order", () => {
    expect(sendRoutePacketSectionLabels(["cover", "claim_form", "document", "document", "w9_saved"], "fax")).toEqual(["Fax cover sheet", "CMS-1500", "Attachment 1", "Attachment 2", "W-9 (saved billing provider W-9)"]);
    expect(sendRoutePacketSectionLabels(["cover", "claim_form"], "mail")[0]).toBe("Mail cover sheet");
  });

  it("View packet opens the packet PDF in a new tab without confirming the send", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:synthetic-packet");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const tab = { closed: false, close: vi.fn(), location: { href: "" }, document: { title: "", body: { textContent: "" } } };
    const open = vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const onPreviewPacket = vi.fn(async () => ({ pdf: new Blob(["%PDF-1.4"], { type: "application/pdf" }), sections: ["cover", "claim_form"] }));
    const onConfirm = vi.fn();
    const view = await render(createElement(SendRouteDialog, { delivery, onCancel: () => undefined, onConfirm, onPreviewPacket }));
    try {
      const button = [...view.container.querySelectorAll("button")].find((item) => item.textContent === "View packet")!;
      await act(async () => { button.click(); });
      expect(open).toHaveBeenCalledWith("", "_blank");
      expect(tab.location.href).toBe("blob:synthetic-packet");
      expect(view.container.querySelector("iframe")).toBeNull();
      expect(onConfirm).not.toHaveBeenCalled();
      vi.runAllTimers();
      expect(revoke).toHaveBeenCalledWith("blob:synthetic-packet");
    } finally { vi.useRealTimers(); open.mockRestore(); await view.unmount(); }
  });

  it("closes the new tab when the packet cannot be built", async () => {
    const tab = { closed: false, close: vi.fn(), location: { href: "" }, document: { title: "", body: { textContent: "" } } };
    const open = vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    const onPreviewPacket = vi.fn(async () => { throw new Error("Synthetic packet failure"); });
    const view = await render(createElement(SendRouteDialog, { delivery, onCancel: () => undefined, onConfirm: () => undefined, onPreviewPacket }));
    try {
      const button = [...view.container.querySelectorAll("button")].find((item) => item.textContent === "View packet")!;
      await act(async () => { button.click(); });
      expect(tab.close).toHaveBeenCalled();
      expect(view.container.textContent).toContain("Synthetic packet failure");
    } finally { open.mockRestore(); await view.unmount(); }
  });

  it("shows the packet inline when the browser blocks the new tab", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("about:blank#synthetic-packet");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const onPreviewPacket = vi.fn(async () => ({ pdf: new Blob(["%PDF-1.4"], { type: "application/pdf" }), sections: ["cover", "claim_form", "document", "w9"] }));
    const onConfirm = vi.fn();
    const view = await render(createElement(SendRouteDialog, { delivery, onCancel: () => undefined, onConfirm, onPreviewPacket }));
    try {
      const button = [...view.container.querySelectorAll("button")].find((item) => item.textContent === "View packet")!;
      await act(async () => { button.click(); });
      expect(onPreviewPacket).toHaveBeenCalledWith({ route: "fax", destination: { faxNumber: "2135550100" } });
      expect(view.container.querySelector("iframe")?.getAttribute("src")).toBe("about:blank#synthetic-packet");
      expect([...view.container.querySelectorAll('[aria-label="Packet order"] li')].map((item) => item.textContent)).toEqual(["Fax cover sheet", "CMS-1500", "Attachment 1", "W-9"]);
      expect(onConfirm).not.toHaveBeenCalled();
      // Changing the route marks the preview out of date.
      const mail = [...view.container.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find((item) => item.textContent?.includes("Mail Bill"))!;
      await act(async () => { mail.click(); });
      expect(view.container.querySelector("iframe")).toBeNull();
      expect(view.container.textContent).toContain("Refresh packet");
    } finally { open.mockRestore(); await view.unmount(); }
  });

  it("hides the button when no packet preview is available", async () => {
    const view = await render(createElement(SendRouteDialog, { delivery, onCancel: () => undefined, onConfirm: () => undefined }));
    try { expect(view.container.textContent).not.toContain("View packet"); } finally { await view.unmount(); }
  });
});
