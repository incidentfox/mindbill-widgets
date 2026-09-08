# California equipment and interpretation details

`BillSubmissionForm` with `treatmentBilling` enabled keeps the existing service-line and diagnosis controls. For California equipment and parenteral/enteral nutrition codes, it adds worker residence ZIP, continuous rental month, and actual prior payments only when the selected code and modifiers need them.

Residence is entered independently of the service address. An empty payment field is unknown; enter `0` only when no payments were made for that item. Changing or clearing an input rebuilds the quote context, so a previously calculated amount cannot supply missing facts.

The browser input and submitted line `feeContext` accept:

```ts
{
  dmeposContext: {
    residenceZip: "90704",
    rentalMonth: 4,
    // priorPaymentsCents: 0, // Only for an item with an applicable purchase cap.
  }
}
```

The bundled catalog contains only public CMS code, modifier, and payment-category metadata from the 2026 January, April, and July DMEPOS files and January PEN file. It contains no fee amounts and does not determine reimbursement. Sources: [CMS DMEPOS files](https://www.cms.gov/medicare/payment/fee-schedules/dmepos/dmepos-fee-schedule), [California adoption orders](https://www.dir.ca.gov/dwc/OMFS9904.htm). Backend source editions, exact modifier matching, residence classification, rental limits, and purchase caps remain authoritative. Oxygen, dialysis, ambiguous rows, unadopted codes, and incomplete contexts may require fee review even when an input is shown.

For a professional component, the same form asks for interpretation location and documented circumstances within **Fee schedule details**. Select the provider type, confirm the actual physical interpretation location, and select standard circumstances only when the stated coding and service conditions are documented. Different interpretation addresses and nonstandard circumstances remain subject to review.

```ts
{
  professionalComponentContext: {
    interpretationLocation: "same_as_patient_service",
  }
}
```

Location alone is insufficient: the server also validates physician, coding, same-day service, and adjustment facts. Clearing a confirmation or changing the procedure/modifier removes stale interpretation facts. A signed report belongs with the bill attachments; these fee inputs do not replace clinical documentation or authorization requirements.

The default modifier dropdown includes 26, TC, NU, UE, RR, KH, KI, and KJ; applications do not need to supply `modifierOptions` to select these. The backend still validates each code/modifier combination.
