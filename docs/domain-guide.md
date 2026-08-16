# Medical-legal billing lifecycle

A billing integration is a lifecycle, not a single “submit bill” call.

1. **Configuration** — Organization identity, billing and rendering providers, NPI/TIN, locations/place of service, billing address, signatures, users, and routing determine how a bill is produced and where it goes.
2. **Draft and validation** — A report, services, claim/payer identifiers, fee schedule inputs, and required attachments become a draft. Validate insurer identity and required fields before submission.
3. **Submission** — Submission creates a transmission attempt, not proof of payer acceptance. Preserve the idempotency key across retries.
4. **Acknowledgements and rejections** — Clearinghouse acknowledgements may accept or reject the transaction. A rejection generally requires correction and resubmission before adjudication.
5. **Adjudication and EOR** — The payer may pay, partially pay, or deny line items and return an Explanation of Review. Documents can arrive through clearinghouse portals or other channels and must be attached to the correct bill.
6. **Collections** — Underpayments and denials may require SBR, IBR, or other follow-up. Deadlines, supporting documents, reason codes, and proof of action matter.
7. **Payments** — Post payments and adjustments to the right bill and line items. Do not close AR merely because a remittance exists; reconcile the expected and received amounts.
8. **Reporting** — AR aging, exception queues, reconciliation, submission status, collections outcomes, and payment reporting give operators the full picture.

The bill timeline widget is the simplest way to expose this state without recreating every workflow. API-first partners can consume events and reporting endpoints, but should still build explicit exception queues for rejection, denial, missing attachment, deadline, and payment mismatches.

Statuses and deadlines are governed by the current API contract and applicable rules. Do not hard-code legal conclusions from this overview.
