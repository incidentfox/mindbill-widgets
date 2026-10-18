# Suggested reasons and related IBR decisions

When billing staff open **Submit Second Review** in `ConnectedBillLifecycle`, the form asks
MindBill for starting language on each service line and for related Independent Bill Review
(IBR) determinations. These are the same suggestions MindBill's own Second Review screen
shows:

- A reason already saved for the line is used first.
- Otherwise MindBill matches the line's EOR adjustment codes to a system reason template and
  fills in the bill facts it has (code, date of service, amounts). Lines with no clear match
  stay blank, with a note asking for the facts.
- Related IBR decisions are ranked by procedure code, claims administrator and denial reason.
  Decisions marked **Recommended** are favorable, same-code determinations.

Suggestions are rule-based and read-only. They only pre-fill reasons the reviewer has not
started typing; nothing is saved, attached or sent until the reviewer submits. If the
suggestions cannot be loaded, the form keeps working with the reason templates.

API-only integrations can request the same data:

```ts
const suggestions = await client.getSecondReviewSuggestions(["line-id"]);
for (const line of suggestions.lines) {
  console.log(line.lineItemId, line.source, line.reason);
}
for (const decision of suggestions.ibr.decisions) {
  console.log(decision.id, decision.outcome, decision.recommended, decision.sourceUrl);
}
```

The endpoint is `GET /partner/v2/bills/{billId}/second-review-suggestions?lineItemIds=a,b`
(server scope `bills:read`; browser permission `bills:read`). A custom form built on
`SecondReviewForm` opts in by passing `getSuggestions`.
