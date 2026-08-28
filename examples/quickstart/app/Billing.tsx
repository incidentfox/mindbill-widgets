"use client";

import { ConnectedBillLifecycle } from "@mindbill/react";

export function Billing({ billId }: { billId: string }) {
  return (
    <ConnectedBillLifecycle
      billId={billId}
      sessionEndpoint="/api/mindbill/billing-session"
      appearance={{ accentColor: "#17666b", fontFamily: "inherit" }}
    />
  );
}
