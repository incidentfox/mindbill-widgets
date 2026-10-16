import { expect, it } from "vitest";
import { rfaDecisionDueText } from "../packages/react/src/rfa-decision-due";
const base = { decisionDueAt: null, receivedAt: null, submittedAt: null, expedited: false, decisionDeadlineBasis: null };
it("keeps a Pacific end-of-day deadline on its legal date in any browser timezone", () => {
  expect(rfaDecisionDueText({ ...base, decisionDueAt: "2026-09-10T06:59:59.999Z" })).toBe("Sep 9, 2026");
  expect(rfaDecisionDueText({ ...base, decisionDueAt: "2026-12-11T07:59:59.999Z" })).toBe("Dec 10, 2026");
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
it("formats deadlines on the same Pacific calendar day everywhere (INC-2272)", async () => {
  const { rfaPacificDate, rfaPacificDateTime } = await import("../packages/react/src/rfa-decision-due");
  const { rfaCalendarDate } = await import("../packages/react/src/rfa-detail-cards");
  // 11:59:59 PM PDT on Oct 14 is Oct 15 in UTC; every surface must say Oct 14.
  const due = "2026-10-15T06:59:59.999Z";
  expect(rfaDecisionDueText({ ...base, decisionDueAt: due })).toBe("Oct 14, 2026");
  expect(rfaPacificDate(due)).toBe("10/14/2026");
  expect(rfaCalendarDate(due)).toBe("10/14/2026");
  expect(rfaPacificDateTime(due)).toBe("10/14/2026, 11:59 PM PDT");
  // A bare calendar date is never shifted.
  expect(rfaPacificDate("2026-10-15")).toBe("10/15/2026");
  expect(rfaCalendarDate("2026-10-15")).toBe("10/15/2026");
  expect(rfaPacificDate(null)).toBe("");
  expect(rfaPacificDateTime(undefined)).toBe("—");
});
it("shows a matched fax response as received when the fax arrived", async () => {
  const { rfaDocumentReceivedAt } = await import("../packages/react/src/rfa-detail-cards");
  expect(rfaDocumentReceivedAt({ createdAt: "2026-10-12T20:00:00Z", receivedAt: "2026-10-12T16:05:00Z" })).toBe("2026-10-12T16:05:00Z");
  expect(rfaDocumentReceivedAt({ createdAt: "2026-10-12T20:00:00Z" })).toBe("2026-10-12T20:00:00Z");
});
