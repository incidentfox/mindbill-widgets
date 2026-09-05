# Correcting service lines during second review

React and Angular lifecycle components let billing staff select the service lines to
dispute and give a reason for each selected line. Corrections are opt-in: an appeal
without the correction checkbox preserves the original units, modifiers, and charge.

For each corrected line, enter whole-number units (1–10,000), up to four unique
two-character modifiers, and the complete corrected charge in dollars and cents.
An empty modifier field removes all modifiers. Staff must confirm the charge;
the component does not recalculate it from changed units or modifiers. Editing
those fields clears that confirmation.

Both frameworks use `parseSecondReviewCorrection` from `@mindbill/browser`.
API-only integrations send the same optional `lineItems[].correction` object:

```ts
await client.submitSecondReview({
  route: "ebill",
  attachmentIds: ["attachment-id"],
  lineItems: [{
    lineItemId: "line-id",
    reason: "The billed service quantity needs correction.",
    correction: { units: 2, modifiers: ["95"], charge: 200 },
  }],
});
```

Use real line and document IDs returned for the bill. Do not invent a payer claim
control number; the server resolves it from the bill. Submitting a review creates
a new attempt; it does not rewrite the original submitted values.
