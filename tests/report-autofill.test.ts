// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { createReportAutofillClient, type ReportAutofillResult } from "../packages/browser/src/report-autofill";
import { applyReportAutofill } from "../packages/react/src/report-autofill-values";
import { BillSubmissionForm, type BillSubmissionInput } from "../packages/react/src/bill-submission-form";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const none = { status: "none" as const, candidates: [] };
const result: ReportAutofillResult = { model: "gpt-5.6-luna", requiresReview: true, fields: Object.entries({ patientFirstName: "Synthetic", patientLastName: "Example", dob: "2000-01-02", addressLine: "10 Test St", city: "Example", state: "CA", zip: "90000", dos: "2026-09-01", doi: "2026-02-30", dxCode: "M54.50, M54.50, M25.5", billingProvider: "Synthetic practice", renderingProvider: "Synthetic doctor", renderingProviderNpi: "1234567893", evaluationLocation: "Synthetic clinic" }).map(([key, value]) => ({ key, value, sourceText: "Synthetic fixture", confidence: "high" as const })), matches: { patient: none, billingProvider: none, renderingProvider: none, serviceLocation: none }, warnings: ["Review all extracted details."] };
const blank: BillSubmissionInput = { patient: { firstName: "", lastName: "", dateOfBirth: "", address: { line1: "", city: "", state: "", postalCode: "" } }, claim: { claimNumber: "" }, service: { date: "" }, serviceLines: [{ code: "", units: 1 }] };
const pdf = () => new File(["%PDF-1.4 synthetic"], "synthetic-report.pdf", { type: "application/pdf" });
describe("report autofill", () => {
  it("sends a multipart report through its dedicated session and refreshes once on expiry", async () => {
    const session = vi.fn().mockResolvedValueOnce({ token: "synthetic-old" }).mockResolvedValue({ token: "synthetic-new", apiBaseUrl: "https://api.example.test/" });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null, { status: 401 })).mockResolvedValueOnce(Response.json({ data: result }));
    expect(await createReportAutofillClient({ getSession: session, fetch: fetcher }).analyze(pdf())).toEqual(result);
    expect(session).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1]?.[0]).toBe("https://api.example.test/partner/v2/report-autofill");
    expect(fetcher.mock.calls[1]?.[1]?.headers).toEqual({ authorization: "Bearer synthetic-new" });
    expect((fetcher.mock.calls[1]?.[1]?.body as FormData).get("report")).toBeInstanceOf(File);
  });
  it("rejects invalid uploads before minting and surfaces entitlement denial", async () => {
    const session = vi.fn().mockResolvedValue({ token: "synthetic-token" });
    const client = createReportAutofillClient({ getSession: session, fetch: async () => Response.json({ detail: "Report autofill requires a written agreement." }, { status: 403 }) });
    await expect(client.analyze(new File(["text"], "report.txt", { type: "text/plain" }))).rejects.toThrow("PDF");
    await expect(client.analyze(new File([], "empty.pdf", { type: "application/pdf" }))).rejects.toThrow("non-empty");
    expect(session).not.toHaveBeenCalled();
    await expect(client.analyze(pdf())).rejects.toThrow("written agreement");
    const malformed = createReportAutofillClient({ getSession: session, fetch: async () => Response.json({ data: { ...result, matches: {} } }) });
    await expect(malformed.analyze(pdf())).rejects.toThrow("invalid");
  });
  it("fills empty fields, maps the patient address, rejects impossible dates and never creates services", () => {
    const next = applyReportAutofill(blank, result);
    expect(next.patient).toMatchObject({ firstName: "Synthetic", dateOfBirth: "2000-01-02", address: { line1: "10 Test St", postalCode: "90000" } });
    expect(next.service.date).toBe("2026-09-01"); expect(next.claim.dateOfInjury).toBe("");
    expect(next.diagnoses).toEqual(["M54.50", "M25.5"]); expect(next.serviceLocation).toEqual({ name: "Synthetic clinic" });
    expect(next.serviceLines).toEqual(blank.serviceLines); expect(blank.patient.firstName).toBe("");
  });
  it("preserves entered values, selected identities, service charges and partial provider groups", () => {
    const bill = structuredClone(blank); bill.patient.firstName = "Entered"; bill.patient.id = "patient-existing";
    bill.renderingProvider = { name: "Entered doctor" }; bill.billingProvider = { id: "provider-existing" }; bill.diagnoses = ["Z00.0"];
    bill.serviceLines = [{ code: "99213", charge: 123, diagnosisPointers: [1] }];
    const next = applyReportAutofill(bill, { ...result, matches: { ...result.matches, patient: { status: "matched", selectedId: "other", candidates: [{ id: "other", name: "Other" }] } } });
    expect(next.patient.id).toBe("patient-existing"); expect(next.patient.firstName).toBe("Entered"); expect(next.renderingProvider).toEqual(bill.renderingProvider);
    expect(next.billingProvider).toEqual(bill.billingProvider); expect(next.diagnoses).toEqual(bill.diagnoses); expect(next.serviceLines).toEqual(bill.serviceLines);
  });
  it("hydrates only an unambiguous matching saved profile into an empty provider group", () => {
    const profiles = { billingProviders: [{ id: "provider-synthetic", label: "Saved", value: { id: "provider-synthetic", name: "Saved", savedProviderId: "provider-synthetic", taxIdType: "SSN" as const } }] };
    const suggestion = { ...result, matches: { ...result.matches, billingProvider: { status: "matched" as const, selectedId: "provider-synthetic", candidates: [{ id: "provider-synthetic", name: "Saved" }] } } };
    expect(applyReportAutofill(blank, suggestion, profiles).billingProvider).toEqual(profiles.billingProviders[0]!.value);
    expect(applyReportAutofill(blank, { ...suggestion, matches: { ...suggestion.matches, billingProvider: { ...suggestion.matches.billingProvider, status: "ambiguous" } } }, profiles).billingProvider?.savedProviderId).toBeUndefined();
  });
  it("is hidden by default and only applies suggestions after review without submitting or uploading attachments", async () => {
    const container = document.createElement("div"); const root = createRoot(container); const onSubmit = vi.fn();
    const session = vi.fn().mockResolvedValue({ token: "synthetic-report-token" }); const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ data: result }));
    const initialBill = structuredClone(blank); initialBill.patient.firstName = "Keep";
    const props = { initialBill, onSubmit, profileOptions: {}, resolvePostalCode: async () => [] };
    try {
      await act(async () => root.render(createElement(BillSubmissionForm, props)));
      expect(container.querySelector('[aria-label="Fill from report"]')).toBeNull();
      await act(async () => root.render(createElement(BillSubmissionForm, { ...props, reportAutofill: { getSession: session, fetch: fetcher } })));
      expect(session).not.toHaveBeenCalled();
      const input = container.querySelector<HTMLInputElement>('input[accept="application/pdf,.pdf"]')!;
      await act(async () => { Object.defineProperty(input, "files", { value: [pdf()], configurable: true }); input.dispatchEvent(new Event("change", { bubbles: true })); });
      const button = (label: string) => [...container.querySelectorAll("button")].find(item => item.textContent === label)!;
      await act(async () => button("Review report suggestions").click());
      expect(container.textContent).toContain("Review all extracted details.");
      expect(container.querySelector<HTMLInputElement>('[data-field-path="patient.lastName"] input')?.value).toBe("");
      await act(async () => button("Apply to empty bill fields").click());
      expect(container.querySelector<HTMLInputElement>('[data-field-path="patient.firstName"] input')?.value).toBe("Keep");
      expect(container.querySelector<HTMLInputElement>('[data-field-path="patient.lastName"] input')?.value).toBe("Example");
      expect(onSubmit).not.toHaveBeenCalled(); expect(fetcher).toHaveBeenCalledTimes(1);
    } finally { await act(async () => root.unmount()); }
  });
});
