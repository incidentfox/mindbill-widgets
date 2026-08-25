import { describe, expect, it } from "vitest";

import {
  buildBillReviewSaveInput,
  type BillReviewDraft,
} from "../packages/react/src/native-bill-review";

describe("native bill review", () => {
  it("freezes editable values into the MindBill review contract", () => {
    const draft: BillReviewDraft = {
      dos: "2026-08-24",
      dosEnd: "",
      authorizationNumber: "  AUTH-7  ",
      billingProvider: {
        id: "provider-1",
        name: "Example Evaluators",
        taxId: "123456789",
        npi: "1234567890",
        billType: "Professional",
      },
      clinician: {
        id: "clinician-1",
        name: "Ada Example, MD",
        specialty: "Occupational medicine",
        npi: "1098765432",
      },
      location: {
        id: "location-1",
        name: "Downtown",
        street: "100 Main Street",
        city: "Sacramento",
        state: "CA",
        zip: "95814",
        posCode: "11",
      },
      lineItems: [
        {
          id: "line-1",
          code: " ml201 ",
          modifiers: ["95"],
          units: 1,
          charge: 2015,
        },
      ],
    };

    expect(buildBillReviewSaveInput(draft)).toEqual({
      dos: "2026-08-24",
      dosEnd: null,
      authorizationNumber: "AUTH-7",
      billingProviderId: "provider-1",
      billingProvider: {
        name: "Example Evaluators",
        taxId: "123456789",
        npi: "1234567890",
        billType: "Professional",
      },
      renderingProviderId: "clinician-1",
      renderingProvider: {
        name: "Ada Example, MD",
        specialty: "Occupational medicine",
        npi: "1098765432",
      },
      placeOfServiceId: "location-1",
      placeOfService: {
        name: "Downtown",
        street: "100 Main Street",
        city: "Sacramento",
        state: "CA",
        zip: "95814",
        posCode: "11",
      },
      lineItems: [
        { id: "line-1", code: "ML201", modifiers: ["95"], units: 1 },
      ],
    });
  });
});
