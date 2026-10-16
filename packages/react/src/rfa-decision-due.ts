import type { RfaRecord } from "@mindbill/browser";

/** California review deadlines run on Pacific calendar days (the server stores 11:59:59 PM
 * Pacific). Every surface formats them here so a header, a table and a task never disagree
 * because one of them sliced the UTC string or used the viewer's own time zone. */
export const RFA_DEADLINE_TIME_ZONE = "America/Los_Angeles";
/** MM/DD/YYYY in Pacific time; a bare YYYY-MM-DD is already a calendar date and is kept as is. */
export function rfaPacificDate(value: string | null | undefined): string {
  if (!value) return "";
  const bare = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (bare) return `${bare[2]}/${bare[3]}/${bare[1]}`;
  if (!Number.isFinite(Date.parse(value))) return value;
  return new Intl.DateTimeFormat("en-US", { timeZone: RFA_DEADLINE_TIME_ZONE, month: "2-digit", day: "2-digit", year: "numeric" }).format(new Date(value));
}
/** Date and time in Pacific time with the zone shown, for task follow-up times. */
export function rfaPacificDateTime(value: string | null | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return new Intl.DateTimeFormat("en-US", { timeZone: RFA_DEADLINE_TIME_ZONE, month: "2-digit", day: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(value));
}

type DeadlineRecord = Pick<RfaRecord, "decisionDueAt" | "receivedAt" | "submittedAt" | "expedited" | "decisionDeadlineBasis">;
/** Display the server deadline in its governing timezone; never infer receipt or calculate a deadline here. */
export function rfaDecisionDueText(rfa: DeadlineRecord): string {
  if (rfa.decisionDueAt && Number.isFinite(Date.parse(rfa.decisionDueAt))) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: RFA_DEADLINE_TIME_ZONE, month: "short", day: "numeric", year: "numeric",
      ...(rfa.expedited ? { hour: "numeric", minute: "2-digit", timeZoneName: "short" } as const : {}),
    }).format(new Date(rfa.decisionDueAt));
  }
  if (rfa.decisionDeadlineBasis) return "Not calculated";
  if (!rfa.receivedAt) return rfa.submittedAt ? "Awaiting receipt" : "Not submitted";
  return "Not calculated";
}
