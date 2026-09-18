import { expect, it } from "vitest";
import { rfaDecisionDueText } from "../packages/react/src/rfa-decision-due";
const base = { decisionDueAt: null, receivedAt: null, submittedAt: null, expedited: false, decisionDeadlineBasis: null };
it("keeps a Pacific end-of-day deadline on its legal date in any browser timezone", () => {
  expect(rfaDecisionDueText({ ...base, decisionDueAt: "2026-09-10T06:59:59.999Z" })).toBe("Sep 9, 2026 (Pacific)");
  expect(rfaDecisionDueText({ ...base, decisionDueAt: "2026-12-11T07:59:59.999Z" })).toBe("Dec 10, 2026 (Pacific)");
});
it("shows the precise expedited cutoff and timezone", () => {
  expect(rfaDecisionDueText({ ...base, expedited: true, decisionDueAt: "2026-09-04T16:00:00Z" })).toBe("Sep 4, 2026, 9:00 AM PDT");
});
it("distinguishes missing submission, receipt and calculation without inventing a deadline", () => {
  expect(rfaDecisionDueText(base)).toBe("Not submitted");
  expect(rfaDecisionDueText({ ...base, submittedAt: "2026-09-01T16:00:00Z" })).toBe("Awaiting receipt");
  expect(rfaDecisionDueText({ ...base, receivedAt: "2026-09-01T16:00:00Z" })).toBe("Not calculated");
  expect(rfaDecisionDueText({ ...base, decisionDeadlineBasis: "calendar_unavailable" })).toBe("Not calculated");
});
