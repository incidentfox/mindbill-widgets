# Historical submission details

`ConnectedBillLifecycle` opens **Bill details** when a submission card is selected. The history tab remains an explicit, separate choice.

The lifecycle response's optional `submissionDetails` collection is keyed by both `attemptId` and `billId`. Historical details are read-only, with one server-resolved status per attempt. They never expose current-bill actions, email sending, or document links that could refer to a newer packet.

- `submission_snapshot`: values captured for that submission, including patient/claim fields, units, modifiers, charges, and attachment metadata. Raw SSNs are excluded.
- `bill_record`: a legacy bill record, clearly labeled as not guaranteed to match the sent packet.
- `unavailable`: an older attempt has no recoverable detail snapshot; the component explains this instead of substituting the current bill.

Historical `totalPaid` and `balanceDue` can be `null` and display “Not recorded”: current accounting must not masquerade as submission-time values. The current bill retains its normal numeric totals and actions.

Existing packets are not rewritten or reconstructed. Upgrade both the backend lifecycle endpoint and the React package for full historical detail support. With an older backend, selecting an earlier card fails closed rather than showing another submission's data.
