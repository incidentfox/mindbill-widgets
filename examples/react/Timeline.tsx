"use client";

import { MindBillBillTimeline, type MindBillEventDetail } from "@mindbill/react";

export function Timeline(props: { token: string; embedUrl: string }) {
  return (
    <MindBillBillTimeline
      sessionToken={props.token}
      embedUrl={props.embedUrl}
      appearance={{ theme: "system", accentColor: "#2563eb" }}
      style={{ minHeight: 620 }}
      onMindBill={(event: CustomEvent<MindBillEventDetail>) => {
        if (event.detail.event === "bill.updated") window.location.reload();
      }}
    />
  );
}
