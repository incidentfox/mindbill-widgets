import type { RfaRecord } from "@mindbill/browser";

type DeadlineRecord = Pick<RfaRecord, "decisionDueAt" | "receivedAt" | "submittedAt" | "expedited" | "decisionDeadlineBasis">;
/** Display the server deadline in its governing timezone; never infer receipt or calculate a deadline here. */
export function rfaDecisionDueText(rfa: DeadlineRecord): string {
  if (rfa.decisionDueAt && Number.isFinite(Date.parse(rfa.decisionDueAt))) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles", month: "short", day: "numeric", year: "numeric",
      ...(rfa.expedited ? { hour: "numeric", minute: "2-digit", timeZoneName: "short" } as const : {}),
    }).format(new Date(rfa.decisionDueAt)) + (rfa.expedited ? "" : " (Pacific)");
  }
  if (rfa.decisionDeadlineBasis) return "Not calculated";
  if (!rfa.receivedAt) return rfa.submittedAt ? "Awaiting receipt" : "Not submitted";
  return "Not calculated";
}
