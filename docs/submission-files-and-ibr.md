# Historical files and Independent Bill Review

`ConnectedBillLifecycle` opens a selected older submission in read-only bill details. Its **Retained submission files** section lists only the exact files persisted for that attempt. Missing historical files are shown as unavailable; the component never substitutes the current packet or a later Explanation of Review (EOR).

The browser client exposes `getSubmissionArtifact(attemptId, artifactId)`. Use the opaque artifact IDs from `submissionDetails[].artifacts`, and construct the lifecycle client with the original root bill ID. The authenticated endpoint returns a blob. Labels, IDs, and content types do not expose storage keys or signed URLs. Historic EOR association is not implied by this contract.

React and Angular expose **Prepare IBR packet** when the backend permits Independent Bill Review. It prepares and downloads a PDF for self-filing. It does **not** file IBR, send a payer submission, or mark the bill filed. Eligibility and required determination evidence are checked by the server.

API-only browser integrations can call `client.prepareIbrPacket()` and download its returned `Blob`. The client authenticates both preparation and download, validates the returned packet path, and supports a root bill resolving to its current linked bill. Do not navigate directly to a protected packet URL without browser-session authorization.
