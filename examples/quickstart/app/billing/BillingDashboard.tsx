"use client";
import { ConnectedBillingWorkspace } from "@mindbill/react";
import { appearance, getSession } from "./session";

export function BillingDashboard({ openBill }: { openBill(): void }) {
  return <>
    <div className="page-heading"><div><p className="eyebrow">BILLING</p>
      <h1>Billing dashboard</h1><p className="page-description">Bills across your workspace.</p>
    </div><button className="primary-button" onClick={openBill}>Open example case →</button></div>
    <div className="sdk-surface dashboard-surface"><ConnectedBillingWorkspace
      initialView="bills" getSession={getSession} appearance={appearance}
      onCreateBill={openBill} style={{ height: 770 }}
    /></div>
  </>;
}
