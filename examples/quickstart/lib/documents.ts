import type { BillSubmissionSourceAttachment } from "@mindbill/react";

// Fictional PDFs owned by the host app. No shared organization profile is needed.
export const caseAttachments: BillSubmissionSourceAttachment[] = [
  { id: "example-report", fileName: "example-report.pdf",
    documentType: "final_report", reportTypeCode: "J4",
    previewUrl: "/documents/example-report.pdf" },
  { id: "example-w9", fileName: "example-w9.pdf",
    documentType: "w9", previewUrl: "/documents/example-w9.pdf" },
];
