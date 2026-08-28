import { randomUUID } from "node:crypto";
import { MindBillClient } from "@mindbill/node";

const mindbill = new MindBillClient({
  apiKey: process.env.MINDBILL_API_KEY,
  organizationId: process.env.MINDBILL_ORG_ID,
});

const bill = await mindbill.createBill({
  externalId: `synthetic-${randomUUID()}`,
  patient: {
    externalId: "patient-synthetic-001",
    firstName: "Alex",
    lastName: "Morgan",
    dateOfBirth: "1985-04-12",
    address: {
      line1: "100 Test Avenue",
      city: "Pasadena",
      state: "CA",
      postalCode: "91101"
    }
  },
  claim: {
    externalId: "claim-synthetic-001",
    claimNumber: "TEST-2026-001",
    employer: "Synthetic Employer",
    dateOfInjury: "2026-06-01",
    injuryState: "CA"
  },
  service: { date: "2026-08-01" },
  billingProvider: {
    name: "Synthetic Medical Evaluators",
    taxId: "000000000",
    npi: "1111111111",
    address: {
      line1: "200 Example Street",
      city: "Pasadena",
      state: "CA",
      postalCode: "91101"
    }
  },
  renderingProvider: {
    name: "Dr. Synthetic Example",
    npi: "1111111111",
    licenseNumber: "TEST0001",
    licenseState: "CA"
  },
  serviceLocation: {
    name: "Pasadena Test Office",
    placeOfServiceCode: "11",
    address: {
      line1: "200 Example Street",
      city: "Pasadena",
      state: "CA",
      postalCode: "91101"
    }
  },
  diagnoses: ["M25.512"],
  serviceLines: [{ code: "ML201", modifiers: ["95"], units: 1 }]
}, randomUUID());

console.log(`MINDBILL_SYNTHETIC_BILL_ID=${bill.id}`);
