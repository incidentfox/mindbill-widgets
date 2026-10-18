// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { normalizeSecondReviewSuggestions, type BillLifecycleData, type SecondReviewSuggestions } from "../packages/browser/src/index";
import { SecondReviewForm } from "../packages/react/src/second-review-form";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const data = {
  bill: {
    id: "bill_synthetic", status: "denied", balanceDue: 2155, totalCharge: 2155, totalPaid: 0,
    lineItems: [
      { id: "line_exam", code: "ML201", modifiers: ["95"], units: 1, charge: 2015 },
      { id: "line_testing", code: "ML202", modifiers: [], units: 1, charge: 140 },
    ],
    attachments: [],
  },
} as unknown as BillLifecycleData;

const suggestions: SecondReviewSuggestions = {
  billId: "bill_synthetic",
  lines: [
    { lineItemId: "line_exam", code: "ML201-95", reasonCodes: ["CO45"], reason: "Synthetic fee schedule reason for ML201-95.", source: "system_template", template: { id: "ar-fee-schedule", title: "Fee schedule incorrectly applied", citation: "8 CCR 9795" }, explanation: "Suggested from CARC 45. Review the EOR." },
    { lineItemId: "line_testing", code: "ML202", reasonCodes: [], reason: null, source: "none", template: null, explanation: null },
  ],
  ibr: {
    criteria: { codes: ["ML201"], administrator: "Synthetic Administrator", issues: ["Medical-Legal Fee Schedule"] },
    decisions: [
      { id: "CB26-0000001", date: "2026-07-01", code: "ML201", issue: "Medical-legal fee schedule payment calculation", citation: "8 CCR 9795", outcome: "Overturned", awardedAmount: 100, sourceUrl: "https://www.dir.ca.gov/dwc/IBR/IBR-decisions/synthetic.pdf", matchedOn: ["Same code ML201"], recommended: true, lineItemIds: ["line_exam"] },
    ],
  },
};

const props = (getSuggestions?: (ids: string[]) => Promise<SecondReviewSuggestions>) => ({
  data, getDeliveryOptions: vi.fn(), openAttachment: vi.fn(), onCancel: vi.fn(), onSubmit: vi.fn(),
  ...(getSuggestions ? { getSuggestions } : {}),
});

async function render(element: ReturnType<typeof createElement>) {
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => root.render(element));
  await act(async () => { await Promise.resolve(); });
  return { container, root };
}

it("prefills matched reasons, flags lines without a match and lists related IBR decisions", async () => {
  const getSuggestions = vi.fn<(ids: string[]) => Promise<SecondReviewSuggestions>>(async () => suggestions);
  const { container, root } = await render(createElement(SecondReviewForm, props(getSuggestions)));
  try {
    expect(getSuggestions).toHaveBeenCalledOnce();
    expect(getSuggestions.mock.calls[0]?.[0]).toEqual(["line_exam", "line_testing"]);
    const reasons = [...container.querySelectorAll("textarea")];
    expect(reasons[0]?.value).toBe("Synthetic fee schedule reason for ML201-95.");
    expect(reasons[1]?.value).toBe("");
    expect(container.textContent).toContain("Prefilled from the EOR: Fee schedule incorrectly applied.");
    expect(container.textContent).toContain("The EOR does not identify a clear reason for this service.");
    const decision = container.querySelector('[aria-label="Related IBR decisions"] a');
    expect(decision?.textContent).toBe("IBR CB26-0000001");
    expect(decision?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(container.textContent).toContain("Recommended");
  } finally { await act(async () => root.unmount()); }
});

it("never overwrites reviewer text and marks edited suggestions", async () => {
  let resolve!: (value: SecondReviewSuggestions) => void;
  const pending = new Promise<SecondReviewSuggestions>((done) => { resolve = done; });
  const { container, root } = await render(createElement(SecondReviewForm, props(() => pending)));
  try {
    expect(container.textContent).toContain("Matching a reason from the EOR…");
    expect(container.textContent).toContain("Finding related IBR decisions…");
    await act(async () => resolve({ ...suggestions, ibr: { ...suggestions.ibr, decisions: [] } }));
    expect(container.textContent).toContain("No past IBR decisions matched these codes and denial reasons.");
    const reason = container.querySelector("textarea")!;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    await act(async () => { setter.call(reason, "Reviewer wording."); reason.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(container.textContent).toContain("Edited.");
  } finally { await act(async () => root.unmount()); }
});

it("falls back to templates when suggestions fail, and stays blank without a loader", async () => {
  const failing = await render(createElement(SecondReviewForm, props(async () => { throw new Error("unavailable"); })));
  try {
    expect(failing.container.textContent).toContain("Suggested reasons are unavailable right now.");
    expect(failing.container.textContent).toContain("Related IBR decisions could not be loaded.");
    expect(failing.container.querySelector("textarea")?.value).toBe("");
  } finally { await act(async () => failing.root.unmount()); }
  const plain = await render(createElement(SecondReviewForm, props()));
  try {
    expect(plain.container.querySelector('[aria-label="Related IBR decisions"]')).toBeNull();
    expect(plain.container.textContent).not.toContain("Prefilled");
  } finally { await act(async () => plain.root.unmount()); }
});

it("normalizes suggestion payloads defensively", () => {
  const normalized = normalizeSecondReviewSuggestions({
    billId: "bill_synthetic",
    lines: [{ lineItemId: "a", reason: "  ", source: "system_template" }, { reason: "orphan" }],
    ibr: { decisions: [{ id: "CB1", sourceUrl: "javascript:alert(1)", recommended: "yes" }, { issue: "no id" }] },
  });
  expect(normalized.lines).toEqual([{ lineItemId: "a", code: "", reasonCodes: [], reason: null, source: "none", template: null, explanation: null }]);
  expect(normalized.ibr.decisions).toHaveLength(1);
  expect(normalized.ibr.decisions[0]).toMatchObject({ id: "CB1", sourceUrl: null, recommended: false });
  expect(normalizeSecondReviewSuggestions(null).lines).toEqual([]);
});
