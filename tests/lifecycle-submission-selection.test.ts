import { describe, expect, it } from "vitest";
import type { BillLifecycleData, BillSubmissionDetail } from "../packages/browser/src/index";
import { billLifecycleSubmissionSelection } from "../packages/react/src/connected-bill-lifecycle";

const attempt = (id: string, isCurrent: boolean) => ({ id, billId: `synthetic-bill-${id}`, label: id, isCurrent });
const detail = (id: string): BillSubmissionDetail => ({
  attemptId: id, billId: `synthetic-bill-${id}`, source: "submission_snapshot", detail: null,
  artifacts: [{ id: `${id}-edi`, label: `${id}.837`, kind: "submitted_edi", contentType: "text/plain" }],
});
const data: Pick<BillLifecycleData, "attempts" | "submissionDetails"> = {
  attempts: [attempt("previous", false), attempt("current", true)],
  submissionDetails: [detail("previous"), detail("current")],
};

describe("lifecycle submission file selection", () => {
  it("finds retained files for the sole current attempt without presented history", () => {
    const selection = billLifecycleSubmissionSelection({ attempts: [attempt("current", true)], submissionDetails: [detail("current")] });
    expect(selection.historical).toBe(false);
    expect(selection.selectedAttempt?.id).toBe("current");
    expect(selection.selectedDetail?.artifacts?.[0]?.id).toBe("current-edi");
  });
  it("defaults to the current attempt among multiple submissions", () => {
    const selection = billLifecycleSubmissionSelection(data);
    expect(selection.selectedDetail?.attemptId).toBe("current");
    expect(selection.ribbonItems.filter((item) => item.active).map((item) => item.id)).toEqual(["current"]);
  });
  it("keeps previous submission files and read-only behavior when selected", () => {
    const selection = billLifecycleSubmissionSelection(data, "previous");
    expect(selection.historical).toBe(true);
    expect(selection.selectedDetail?.artifacts?.[0]?.id).toBe("previous-edi");
  });
  it("does not replace missing previous files with current files", () => {
    const selection = billLifecycleSubmissionSelection({ ...data, submissionDetails: [detail("current")] }, "previous");
    expect(selection.historical).toBe(true);
    expect(selection.selectedDetail).toBeUndefined();
  });
  it("rejects a detail belonging to another bill even when its attempt ID matches", () => {
    const selection = billLifecycleSubmissionSelection({ ...data, submissionDetails: [{ ...detail("current"), billId: "synthetic-unrelated-bill" }] });
    expect(selection.selectedDetail).toBeUndefined();
  });
  it("returns to current selection when a previously selected attempt disappears", () => {
    expect(billLifecycleSubmissionSelection(data, "removed-attempt").selectedDetail?.attemptId).toBe("current");
  });
  it("does not invent retained files for older APIs with no attempts", () => {
    const selection = billLifecycleSubmissionSelection({ submissionDetails: [detail("current")] });
    expect(selection.selectedAttempt).toBeUndefined();
    expect(selection.selectedDetail).toBeNull();
  });
});
