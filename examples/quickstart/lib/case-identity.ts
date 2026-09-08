// Host-owned identities: these are not MindBill organization IDs or credentials.
export const HOST_WORKSPACE_ID = "review-desk-example";
export const CASE_ID = "synthetic-review-001";
export const CASE_IDS: readonly string[] = [CASE_ID];
export const CASE_CUSTOMERS: Readonly<Record<string, string>> = {
  [CASE_ID]: "example-review-customer",
};
