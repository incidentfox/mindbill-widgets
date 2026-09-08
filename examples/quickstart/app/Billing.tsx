"use client";

import { useCallback } from "react";
import { BillSubmissionForm, ConnectedBillLifecycle } from "@mindbill/react";
import { CASE_ID, exampleBill } from "../lib/case";
import { caseAttachments } from "../lib/documents";
import { appearance, getCaseSession } from "./billing/session";
import { useCaseBill } from "./billing/useCaseBill";

export function Billing() {
  const { billId, creationKey, loading, error, linkError, reload, saveBill } = useCaseBill(CASE_ID);
  const getSession = useCallback(({ signal }: { signal: AbortSignal }) =>
    getCaseSession(CASE_ID, signal), []);

  if (loading) return <p role="status">Checking this case’s saved bill…</p>;
  if (error) return <div role="alert" className="error-message">
    {error}<button onClick={() => void reload()}>Retry</button>
  </div>;

  return <>
    <div className="surface-intro">
      <div><h2>{billId ? "The bill for this case" : "Create this case’s first bill"}</h2>
        <p>{billId ? "Track progress and take action on this case’s bill."
          : "Review the prefilled patient, claim, provider, and service details."}</p></div>
      {billId && <span className="subtle-badge">Bill ID: {billId}</span>}
    </div>
    {linkError && <div role="alert" className="error-message">
      {linkError}<button onClick={() => billId && void saveBill(billId)}>Retry saving link</button>
    </div>}
    <div className="sdk-surface">
      {billId ? <ConnectedBillLifecycle
        billId={billId} getSession={getSession} appearance={appearance} style={{ height: 730 }}
      /> : <BillSubmissionForm
        initialBill={exampleBill}
        attachments={caseAttachments}
        idempotencyKey={creationKey}
        getSession={getSession}
        onSubmitted={(result) => saveBill(result.bill.id)}
        appearance={appearance}
        profileDisplay="compact"
        heading="New bill"
        description="Choose the claims administrator and review the attachments."
        submitLabel="Create sandbox bill"
      />}
    </div>
  </>;
}
