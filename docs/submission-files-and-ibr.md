# Historical files and Independent Bill Review

`ConnectedBillLifecycle` shows **Retained submission files** for the current submission, including a bill with only one attempt, and for a selected older submission. The section lists only the exact files persisted for that attempt. Older submissions open in read-only bill details. Missing historical files are shown as unavailable; the component never substitutes the current packet or a later Explanation of Review (EOR).

The browser client exposes `getSubmissionArtifact(attemptId, artifactId)`. Use the opaque artifact IDs from `submissionDetails[].artifacts`, and construct the lifecycle client with the original root bill ID. The authenticated endpoint returns a blob. Labels, IDs, and content types do not expose storage keys or signed URLs. Historic EOR association is not implied by this contract.

When a selected older submission was its own bill — for example the original bill before a Second Review or correction — `ConnectedBillLifecycle` also shows **Download packet**. It calls `getSubmissionPacket(attemptId)`, which returns that submission's complete PDF packet (proof, claim form as submitted, supporting documents, and W-9). An older transmission that shares the current bill record has no separate packet, so the button is hidden and the endpoint returns 404 rather than rebuilding it from current data.

React and Angular expose **Prepare IBR packet** when the backend permits Independent Bill Review. It prepares and downloads a PDF for self-filing. It does **not** file IBR, send a payer submission, or mark the bill filed. Eligibility and required determination evidence are checked by the server.

API-only browser integrations can call `client.prepareIbrPacket()` and download its returned `Blob`. The client authenticates both preparation and download, validates the returned packet path, and supports a root bill resolving to its current linked bill. Do not navigate directly to a protected packet URL without browser-session authorization.
