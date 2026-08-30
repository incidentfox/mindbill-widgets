"use client";

import { ConnectedBillLifecycle } from "@mindbill/react";

const knownBillValues = {
  externalId: "synthetic-case-001",
  billingMode: "med_legal" as const,
  patient: {
    externalId: "synthetic-patient-001",
    firstName: "Alex",
    lastName: "Morgan",
    dateOfBirth: "1985-04-12",
    address: { line1: "100 Test Avenue", city: "Pasadena", state: "CA", postalCode: "91101" },
  },
  claim: {
    externalId: "synthetic-claim-001",
    claimNumber: "TEST-2026-001",
    employer: "Synthetic Employer",
    dateOfInjury: "2026-06-01",
    injuryState: "CA",
  },
  service: { date: "2026-08-01" },
  diagnoses: ["M25.512"],
  serviceLines: [{ code: "ML201", modifiers: ["95"], units: 1 }],
};

export function Billing() {
  return (
    <ConnectedBillLifecycle
      create={knownBillValues}
      sessionEndpoint="/api/mindbill/session"
      appearance={{ accentColor: "#17666b", fontFamily: "inherit" }}
      onBillCreated={(billId) => console.info("Created synthetic bill", billId)}
    />
  );
}
