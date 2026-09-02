import type { BillRejection, BillRejectionIssue } from "@mindbill/browser";

export function billRejectionIssues(rejection: BillRejection): BillRejectionIssue[] {
  return rejection.issues?.length
    ? [...rejection.issues]
    : [{ code: rejection.code ?? null, description: rejection.reason }];
}

export function billRejectionIssueSummary(rejection: BillRejection, count: number): string {
  const noun = count === 1 ? "validation error" : "validation errors";
  const source = rejection.source?.trim().replace(/\.$/, "");
  if (!source) return `${count} ${noun}.`;
  if (/acknowledg/i.test(source)) return `${count} clearinghouse ${noun}.`;
  return `${count} ${noun} returned by ${source}.`;
}
