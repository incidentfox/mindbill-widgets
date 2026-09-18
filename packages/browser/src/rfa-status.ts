import type { RfaRecord } from "./index";

export type RfaLifecycleStatus = "incomplete" | "sent" | "failed" | "received" | "closed" | "canceled";
export const RFA_LIFECYCLE_LABELS: Readonly<Record<RfaLifecycleStatus, string>> = {
  incomplete: "Incomplete", sent: "Sent", failed: "Failed", received: "Received", closed: "Closed", canceled: "Canceled",
};
type LifecycleRecord = Pick<RfaRecord, "status"> & Partial<Pick<RfaRecord, "lifecycleStatus" | "submittedAt" | "receivedAt" | "transmissions">>;
const timestamp = (value: string | null | undefined): number => value ? Date.parse(value) || 0 : 0;

/** Prefer the API lifecycle. Older responses are derived from the current submission's evidence. */
export function getRfaLifecycleStatus(rfa: LifecycleRecord): RfaLifecycleStatus {
  if (rfa.lifecycleStatus && Object.hasOwn(RFA_LIFECYCLE_LABELS, rfa.lifecycleStatus)) return rfa.lifecycleStatus;
  if (rfa.status === "canceled") return "canceled";
  if (["closed", "approved", "modified", "denied", "mixed"].includes(rfa.status)) return "closed";
  const submissions = (rfa.transmissions ?? []).filter(value => !value.purpose || value.purpose === "submission");
  const latest = submissions.filter(value => value.direction === "outbound").sort((a, b) =>
    timestamp(b.occurredAt) - timestamp(a.occurredAt) || b.id.localeCompare(a.id))[0];
  if (latest) {
    const received = latest.receivedAt || submissions.some(value => value.direction === "inbound" && value.status === "received"
      && timestamp(value.receivedAt ?? value.occurredAt) >= timestamp(latest.occurredAt));
    if (received) return "received";
    return latest.status === "failed" ? "failed" : "sent";
  }
  if (rfa.receivedAt || ["received", "under_review", "information_requested"].includes(rfa.status)) return "received";
  if (rfa.submittedAt || rfa.status === "submitted") return "sent";
  return "incomplete";
}
