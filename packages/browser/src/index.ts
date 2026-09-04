export const DEFAULT_API_BASE_URL = "https://app.mindbill.org";
export const DEFAULT_SESSION_ENDPOINT = "/api/mindbill/session";

export type BillReviewDocumentType =
  | "final_report"
  | "letter_of_attestation"
  | "proof_of_service"
  | "form_122"
  | "return_to_work_voucher"
  | "w9"
  | "medical_records"
  | "appeal"
  | "other";

export type BillReviewBillingProvider = {
  name: string;
  taxId: string;
  npi: string;
  billType: "Professional" | "Institutional";
  phone?: string;
  billingStreet?: string;
  billingCity?: string;
  billingState?: string;
  billingZip?: string;
};

export type BillReviewClinician = {
  name: string;
  specialty: string;
  npi: string;
  taxonomy?: string;
  licenseNumber?: string;
  licenseState?: string;
  signaturePng?: string;
  signatureKey?: string;
  isQME?: boolean;
  isAME?: boolean;
  email?: string;
  active?: boolean;
};

export type BillReviewLocation = {
  billingProviderId?: string;
  name: string;
  nickname?: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  county?: string;
  posCode?: string;
  isPrimary?: boolean;
  active?: boolean;
};

export type BillReviewLineItem = {
  id?: string;
  code: string;
  modifiers: string[];
  units: number;
  charge: number;
  feeSchedule?: number;
  serviceDate?: string | null;
  serviceDateEnd?: string | null;
  diagnosisPointers?: number[];
};

export type BillReviewAttachment = {
  id: string;
  filename: string;
  description?: string | null;
  documentType: string;
  reportType?: string | null;
  source?: string;
  addedAt?: string;
  contentUrl?: string;
};

/** One selectable payer (subpayor) under a claims administrator. */
export type BillReviewPayerOption = {
  id: string;
  label: string;
  /** Directory-provided default marker. Interactive forms still require an explicit choice. */
  default?: boolean;
  active?: boolean;
  aliases?: string[];
  hint?: string | null;
  affiliatedEntities?: string[];
  route?: string | null;
  optionType?: string | null;
  deliveryType?: string | null;
  clearinghouse?: string | null;
  payerId?: string | null;
  /** Original directory route when live delivery uses a replacement clearinghouse. */
  sourceClearinghouse?: string | null;
  /** Original directory payer ID when live delivery uses a replacement route. */
  sourcePayerId?: string | null;
  clearinghousePayerIds?: Record<string, string>;
  preferredClearinghouse?: string | null;
};

export type BillReviewPayer = {
  id: string;
  name: string;
  hasElectronic?: boolean;
  states?: string[];
  confidence?: "high" | "medium" | "directory";
  recommended?: boolean;
  signals?: Array<{
    kind: "name" | "claim_number";
    state: "match" | "warning";
    label: string;
  }>;
  /** True when a bill for this claims administrator must name one of `payers`. */
  payerSelectionRequired?: boolean;
  /** Selectable payers (subpayors) under this claims administrator. */
  payers?: BillReviewPayerOption[];
  aliases?: string[];
  affiliatedEntities?: string[];
  claimNumberHint?: string | null;
  claimNumberPatterns?: BillClaimsAdministratorPattern[];
  route?: string | null;
};

/** A directory suggestion derived from host-provided evidence. Suggestions are never auto-applied. */
export type BillReviewPayerSuggestion = BillReviewPayer & {
  deterministic: boolean;
  reason: string;
  /** A uniquely proven routing payer under a multi-payer claims administrator. */
  selectedPayerId?: string;
};

/** Host-system evidence shown alongside claims-administrator suggestions. */
export type BillClaimsAdministratorSource = {
  source: "eams" | "report" | string;
  label: string;
  name: string;
  url?: string;
};

/**
 * The directory-marked default payer option, or null when none is marked.
 * Interactive forms should still require an explicit routing-payer choice.
 */
export function defaultBillReviewPayerOption(
  payer: Pick<BillReviewPayer, "payerSelectionRequired" | "payers">,
): BillReviewPayerOption | null {
  if (!payer.payerSelectionRequired) return null;
  return payer.payers?.find((option) => option.default) ?? null;
}

export type BillPostalPlace = { city: string; state: string };
export type BillDiagnosisCode = { code: string; description: string };

export type BillReviewFeatures = {
  authorizationNumber?: boolean;
  serviceDateRange?: boolean;
  wcabNumber?: boolean;
  codingPresets?: boolean;
};

export type BillReviewClaimPatternStatus = {
  state: "match" | "warning" | "unknown";
  label: string;
  detail?: string;
  suggestion?: string;
};

export type BillReviewData = {
  bill: {
    id: string;
    billNumber: string | number;
    status: string;
    transmissionState?: string;
    billingMode: "med_legal" | "professional";
    dos: string;
    dosEnd?: string | null;
    authorizationNumber?: string | null;
    billingSnapshot?: {
      billingProvider?: BillReviewBillingProvider;
      renderingProvider?: BillReviewClinician;
      placeOfService?: BillReviewLocation;
    } | null;
    lineItems: BillReviewLineItem[];
    attachments: BillReviewAttachment[];
    totalCharge: number;
    totalPaid: number;
    balanceDue: number;
  };
  patient: {
    name: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    dob?: string;
    phone?: string;
    address?: {
      line1?: string;
      city?: string;
      state?: string;
      postalCode?: string;
    };
  };
  injury: {
    claimNumber?: string;
    employer?: string;
    doi?: string;
    injuryEndDate?: string;
    cumulativeTrauma?: boolean;
    adjNumber?: string;
    claimsAdminId?: string;
    claimsAdminName?: string;
    injuryDescription?: string;
    /** Diagnosis codes enriched with their human-readable ICD-10 descriptions. */
    diagnoses?: BillDiagnosisCode[];
    /** @deprecated Prefer diagnoses so users can understand each code. */
    diagnosisCodes?: string[];
    claimPatternStatus?: BillReviewClaimPatternStatus;
  };
};

export type BillReviewSaveInput = {
  claimsAdminId: string;
  /** The chosen payer (subpayor) when the claims administrator requires payer selection. */
  payerId?: string;
  patientOverrides?: {
    firstName: string;
    middleName?: string;
    lastName: string;
    dob?: string;
  };
  injuryOverrides?: {
    claimNumber?: string;
    employer?: string;
    doi?: string;
    injuryEndDate?: string;
    cumulativeTrauma?: boolean;
    adjNumber?: string;
  };
  dos: string;
  dosEnd?: string | null;
  authorizationNumber?: string | null;
  billingProvider?: BillReviewBillingProvider;
  renderingProvider?: BillReviewClinician;
  placeOfService?: BillReviewLocation;
  lineItems: Array<{
    id?: string;
    code: string;
    modifiers: string[];
    units: number;
    charge?: number;
    serviceDate?: string | null;
    serviceDateEnd?: string | null;
    diagnosisPointers?: number[];
  }>;
};

function pickDefined(
  source: object,
  keys: readonly string[],
): Record<string, unknown> {
  const record = source as Record<string, unknown>;
  return Object.fromEntries(
    keys.flatMap((key) => record[key] === undefined ? [] : [[key, record[key]]]),
  );
}

/**
 * Removes read-only snapshot metadata before a review mutation is sent.
 * Lifecycle reads can include display-only fields such as entity IDs; the v2
 * write contract accepts only the values that should be frozen onto the bill.
 */
export function sanitizeBillReviewSaveInput(
  input: BillReviewSaveInput,
): BillReviewSaveInput {
  return {
    claimsAdminId: input.claimsAdminId,
    ...(input.payerId !== undefined ? { payerId: input.payerId } : {}),
    ...(input.patientOverrides ? {
      patientOverrides: pickDefined(input.patientOverrides, [
        "firstName", "middleName", "lastName", "dob",
      ]) as NonNullable<BillReviewSaveInput["patientOverrides"]>,
    } : {}),
    ...(input.injuryOverrides ? {
      injuryOverrides: pickDefined(input.injuryOverrides, [
        "claimNumber", "employer", "doi", "injuryEndDate",
        "cumulativeTrauma", "adjNumber",
      ]) as NonNullable<BillReviewSaveInput["injuryOverrides"]>,
    } : {}),
    dos: input.dos,
    ...(input.dosEnd !== undefined ? { dosEnd: input.dosEnd } : {}),
    ...(input.authorizationNumber !== undefined
      ? { authorizationNumber: input.authorizationNumber }
      : {}),
    ...(input.billingProvider ? {
      billingProvider: pickDefined(input.billingProvider, [
        "name", "taxId", "npi", "billType", "phone", "billingStreet",
        "billingCity", "billingState", "billingZip",
      ]) as BillReviewBillingProvider,
    } : {}),
    ...(input.renderingProvider ? {
      renderingProvider: pickDefined(input.renderingProvider, [
        "name", "specialty", "npi", "taxonomy", "licenseNumber",
        "licenseState", "signaturePng", "signatureKey", "isQME", "isAME",
        "email", "active",
      ]) as BillReviewClinician,
    } : {}),
    ...(input.placeOfService ? {
      placeOfService: pickDefined(input.placeOfService, [
        "billingProviderId", "name", "nickname", "street", "city", "state",
        "zip", "county", "posCode", "isPrimary", "active",
      ]) as BillReviewLocation,
    } : {}),
    lineItems: input.lineItems.map((line) => pickDefined(line, [
      "id", "code", "modifiers", "units", "charge", "serviceDate",
      "serviceDateEnd", "diagnosisPointers",
    ]) as BillReviewSaveInput["lineItems"][number]),
  };
}

export type BillSubmissionRoute = "ebill" | "fax" | "mail" | "email";
export type BillDeliveryOption = {
  route: BillSubmissionRoute;
  label: string;
  detail: string;
  fallback: boolean;
  confidence: string;
  payerName: string;
  target?: string;
  chKey?: string;
  payerId?: string;
  printAndMail?: boolean;
  costUsd?: number;
};
export type BillDeliveryOptions = {
  payerName: string;
  recommended: BillDeliveryOption;
  options: BillDeliveryOption[];
  contacts: {
    faxNumber?: string | null;
    claimsEmail?: string | null;
    portalUrl?: string | null;
    mailingAddress?: string | null;
    adjusterName?: string | null;
    adjusterPhone?: string | null;
    adjusterEmail?: string | null;
  };
};
export type BillActorInput = {
  /** Human-readable name shown for user-initiated audit history. */
  actorName?: string;
};

export type SubmitBillInput = BillActorInput & {
  route: BillSubmissionRoute;
  destination?: {
    faxNumber?: string;
    email?: string;
    mailingAddress?: string;
  };
  attention?: string;
  subject?: string;
  note?: string;
  /** CC recipients for the email route (at most 10). */
  cc?: string[];
};
export type BillLifecycleActionId =
  | "resubmit"
  | "second_review"
  | "independent_bill_review"
  | "view_eor"
  | "post_payment"
  | "close"
  | "reopen"
  | "send_duplicate"
  | "report_bill_status"
  | "submit_new_bill";

export type BillLifecycleAction = {
  id: BillLifecycleActionId;
  label: string;
  enabled: boolean;
  primary?: boolean;
  reason?: string;
};

export type BillEorDocument = {
  id: string;
  filename: string;
  description: string | null;
  addedAt: string;
  contentUrl: string;
};

export type BillActivityRecord = {
  id: string;
  type: string;
  createdAt: string;
  title?: string;
  description: string;
  actor: string | null;
  delivery: BillSubmissionRoute | null;
  amount: number | null;
  accepted: boolean | null;
  stcCategory: string | null;
};

/** One user-facing bill history row (Date / Action / User / Details).
 *  Server-presented: the wording is authored by MindBill so every surface (MindBill
 *  app, React, Angular, embeds) reads identically. */
export type BillHistoryEntry = {
  id: string;
  /** ISO timestamp for ordering and the Date column. */
  date: string;
  /** Short Action label — "Original Bill", "277 Accept", "Payment", "Note", … */
  action: string;
  kind:
    | "created"
    | "submission"
    | "ack"
    | "eor"
    | "payment"
    | "review"
    | "close"
    | "reopen"
    | "note"
    | "portal"
    | "task"
    | "system";
  /** Who acted: a biller name, MindBill automation, or the responding clearinghouse. */
  actor: string | null;
  /** The one-line Details column. */
  summary: string;
  /** Drives row highlighting: submissions are pale blue, notes pale yellow. */
  tone: "submission" | "note" | "neutral" | "problem" | "success";
  amount?: number;
  /** Expandable content; absent → the row is not expandable. */
  details?: {
    rows?: Array<{ label: string; value: string }>;
    documents?: Array<{ id: string; filename: string }>;
    complianceDueDates?: Array<{ date: string; text: string }>;
    codes?: Array<{ code: string; text: string }>;
    text?: string;
  };
};

export type BillPaymentRecord = {
  id: string;
  method: "check" | "eft";
  checkNumber: string;
  status: string | null;
  depositDate: string | null;
  checkReceived: boolean | null;
  receivedDate: string | null;
  amount: number;
  principalAmount: number;
  feeAmount: number | null;
  feeReason: string | null;
  source: "paper" | "835" | "portal";
  postedAt: string;
  updatedAt: string | null;
  note: string | null;
};

export type BillRemittanceSummary = {
  billedAmount: number;
  expectedAmount: number;
  payerAllowedAmount: number | null;
  payerReportedPaid: number | null;
  postedPrincipal: number;
  postedAdditional: number;
  totalPostedCash: number;
  balanceDue: number;
  denialReason: string | null;
};

export type BillLifecycleDelivery = {
  payerName: string;
  contacts: BillDeliveryOptions["contacts"];
  /**
   * Partner-safe directory details. `id` is an opaque MindBill directory ID;
   * Values are safe, partner-facing directory details; internal database identifiers are opaque.
   */
  directory?: BillClaimsAdministratorDirectory | null;
};

export type BillClaimsAdministratorContact = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  fax?: string | null;
  portalUrl?: string | null;
  address?: string | null;
  note?: string | null;
};

export type BillClaimsAdministratorMailingAddress = {
  company?: string | null;
  address: string;
  notes?: string | null;
  submissionTypes?: string[];
  billTreatmentTypes?: string[];
};

export type BillClaimsAdministratorPattern = {
  length?: number | string | null;
  pattern: string;
  example?: string | null;
  matches?: boolean | null;
};

export type BillClaimsAdministratorPayer = {
  name: string;
  route?: string | null;
  aliases?: string[];
  hint?: string | null;
  affiliatedEntities?: string[];
  optionType?: string | null;
  deliveryType?: string | null;
  clearinghouse?: string | null;
  payerId?: string | null;
  sourceClearinghouse?: string | null;
  sourcePayerId?: string | null;
  clearinghousePayerIds?: Record<string, string>;
  preferredClearinghouse?: string | null;
};

export type BillReviewPayerPage = {
  results: BillReviewPayer[];
  suggestions?: BillReviewPayerSuggestion[];
  total: number;
  nextOffset?: number;
  recommendedId?: string;
};

export type BillReviewPayerListInput = {
  query?: string;
  claimNumber?: string;
  sourceClaimsAdministratorName?: string;
  employerName?: string;
  limit?: number;
  offset?: number;
};

export type BillClaimsAdministratorDirectory = {
  id?: string;
  name?: string;
  type?: string | null;
  description?: string | null;
  website?: string | null;
  aliases?: string[];
  affiliatedEntities?: string[];
  hours?: string | null;
  claimNumberHint?: string | null;
  billProcessingWorkflow?: string | null;
  billProcessingWorkflowNotes?: string | null;
  telephoneNumbers?: string[];
  emailAddresses?: string[];
  webPortals?: string[];
  payers?: BillClaimsAdministratorPayer[];
  authorizationNotice?: string | null;
  billReview?: BillClaimsAdministratorContact[];
  authorization?: BillClaimsAdministratorContact[];
  mailingAddresses?: BillClaimsAdministratorMailingAddress[];
  claimNumberPatterns?: BillClaimsAdministratorPattern[];
};

/** End-user-safe details explaining why the latest submission was rejected. */
export type BillRejectionIssue = {
  code?: string | null;
  description: string;
  /** Bill-submission field paths implicated by this issue. */
  fieldPaths?: string[];
};

export type BillRejection = {
  reason: string;
  code?: string | null;
  issues?: BillRejectionIssue[];
  receivedAt?: string | null;
  source?: string | null;
};

export type BillLifecycleData = BillReviewData & {
  environment: "sandbox" | "live";
  lifecycle: {
    state: string;
    nativeStatus: string;
    submittedAt?: string | null;
    agingDays?: number | null;
    updatedAt?: string | null;
    actions: BillLifecycleAction[];
  };
  eors: BillEorDocument[];
  activity: BillActivityRecord[];
  /** Presented history rows. Optional: absent when the API
   *  predates the presented-history rollout — fall back to `activity`. */
  history?: BillHistoryEntry[];
  payments: BillPaymentRecord[];
  remittance: BillRemittanceSummary;
  delivery: BillLifecycleDelivery;
  rejection?: BillRejection | null;
};

export type BillLifecycleSession = {
  token: string;
  expiresAt?: string;
  apiBaseUrl?: string;
};

export type BillLifecycleSessionRequest = {
  signal: AbortSignal;
};

export type BillLifecycleSessionProvider = (
  request: BillLifecycleSessionRequest,
) => Promise<BillLifecycleSession>;

export type CloseBillInput = BillActorInput & { reason: string };
export type ReopenBillInput = BillActorInput & { reason: string };
export type PostBillPaymentInput = BillActorInput & {
  amount: number;
  penaltyAmount?: number;
  interestAmount?: number;
  method: "check" | "eft";
  checkNumber?: string;
  depositDate: string;
  note?: string;
};
export type SubmitSecondReviewInput = BillActorInput & {
  reason: string;
  payerClaimControlNumber: string;
  disputedAmount: number | undefined;
  attachmentIds: string[];
  route: BillSubmissionRoute;
  /** Optional subset of disputed line items; omitted = the whole bill. */
  lineItemIds?: string[];
  /** SBR-1 box: whether the disputed service was authorized. */
  serviceAuthorized?: boolean;
};

export type ReportBillStatusId =
  | "message_left"
  | "eor_pending"
  | "eor_sent"
  | "bill_not_on_file"
  | "forwarded";

export type ReportBillStatusOption = {
  id: ReportBillStatusId;
  label: string;
  description: string;
};

/** The five supported outcomes of a bill payment-status phone call. */
export const REPORT_BILL_STATUS_OPTIONS: ReportBillStatusOption[] = [
  {
    id: "message_left",
    label: "Message Left Requesting Bill Payment Status",
    description: "Claims Administrator/Bill Review representative unavailable.",
  },
  {
    id: "eor_pending",
    label: "Explanation of Review (EOR) Pending",
    description: "Claims Administrator/Bill Review reported the bill is still in process and an EOR has not been generated or sent.",
  },
  {
    id: "eor_sent",
    label: "Explanation of Review (EOR) Sent",
    description: "Claims Administrator/Bill Review reported sending an EOR to the provider.",
  },
  {
    id: "bill_not_on_file",
    label: "Bill Not On File",
    description: "Claims Administrator/Bill Review reported not receiving the bill.",
  },
  {
    id: "forwarded",
    label: "Bill Forwarded to Different Payer / Network",
    description: "Claims Administrator/Bill Review reported forwarding the bill to a different payer.",
  },
];

/**
 * Outcome of a phone call to the Claims Administrator / Bill Review vendor
 * about an outstanding bill, recorded through the lifecycle actions endpoint.
 */
export type ReportBillStatusInput = BillActorInput & {
  status: ReportBillStatusId;
  company?: string;
  representativeName?: string;
  representativeRole?: string;
  phone?: string;
  callReference?: string;
  note?: string;
};

/**
 * Payload for the "report_bill_status" lifecycle action: records the outcome
 * of a phone call to the Claims Administrator / Bill Review vendor about an
 * outstanding bill. Posted through the generic lifecycle actions endpoint.
 */
export type ReportBillStatusActionInput = ReportBillStatusInput & {
  action: "report_bill_status";
};

/**
 * Payload for the "send_duplicate" lifecycle action: resends the immutable
 * submission packet, unchanged, over the selected delivery route — typically
 * after the payer reports the bill is not on file.
 */
export type SendDuplicateBillInput = BillActorInput & {
  route: BillSubmissionRoute;
  destination?: SubmitBillInput["destination"];
  attention?: string;
  subject?: string;
  note?: string;
  /** CC recipients for the email route (at most 10). */
  cc?: string[];
};

export type ReportBillStatusContacts = {
  claimsAdmin: {
    name: string;
    hoursOfOperation?: string;
    phones: Array<{ label: string; value: string }>;
  } | null;
  billReview: { name: string; phone?: string } | null;
};

/**
 * Partner-safe "who to call" summary for the Report Bill Status flow, derived
 * from the lifecycle delivery block (payer contacts + optional directory).
 */
export function reportBillStatusContacts(
  delivery: BillLifecycleDelivery,
): ReportBillStatusContacts {
  const payerName = delivery.payerName?.trim();
  const directory = delivery.directory ?? null;
  const phones: Array<{ label: string; value: string }> = [];
  const adjusterPhone = delivery.contacts.adjusterPhone?.trim();
  if (adjusterPhone) {
    const adjusterName = delivery.contacts.adjusterName?.trim();
    phones.push({
      label: adjusterName ? `Adjuster (${adjusterName})` : "Adjuster",
      value: adjusterPhone,
    });
  }
  const hours = directory?.hours?.trim();
  const claimsAdmin = payerName
    ? {
        name: payerName,
        ...(hours ? { hoursOfOperation: hours } : {}),
        phones,
      }
    : null;
  const billReviewContact = (directory?.billReview ?? []).find(
    (contact) => contact.name?.trim() || contact.phone?.trim(),
  );
  const billReview = billReviewContact
    ? {
        name: billReviewContact.name?.trim() || "Bill Review",
        ...(billReviewContact.phone?.trim() ? { phone: billReviewContact.phone.trim() } : {}),
      }
    : null;
  return { claimsAdmin, billReview };
}

/**
 * Default Second Bill Review dispute reason for an invalid med-legal denial.
 * Prefilled (editable) in the SBR panel.
 */
export const SECOND_REVIEW_REASON_TEMPLATE =
  "This is an appeal of the invalid denial of this med-legal bill; per LC §4622 and the OMFS/MLFS, payment is due as billed.";

/** Days allowed to request Second Review after service of the denial EOR. */
export const SECOND_REVIEW_WINDOW_DAYS = 90;

export type SecondReviewDeadline = {
  /** ISO date (yyyy-mm-dd) of the latest denial/EOR document. */
  eorDate: string;
  /** ISO date (yyyy-mm-dd) 90 days after the EOR date. */
  deadline: string;
};

/**
 * The 90-day Second Review window anchored on the latest EOR date, or null
 * when the lifecycle data provides no parseable denial/EOR date.
 */
export function secondReviewDeadline(
  eors: Array<Pick<BillEorDocument, "addedAt">>,
): SecondReviewDeadline | null {
  const times = eors
    .map((eor) => Date.parse(eor.addedAt))
    .filter((time) => Number.isFinite(time));
  if (!times.length) return null;
  const eorTime = Math.max(...times);
  const isoDate = (time: number): string => new Date(time).toISOString().slice(0, 10);
  return {
    eorDate: isoDate(eorTime),
    deadline: isoDate(eorTime + SECOND_REVIEW_WINDOW_DAYS * 86_400_000),
  };
}
/**
 * A corrected immutable snapshot submitted as the next attempt on the same bill.
 * The logical bill ID remains stable; only the submission/control-number attempt advances.
 */
export type ResubmitBillInput = BillActorInput & {
  reason?: string;
  bill: BrowserBillCreateInput;
  documents?: BrowserBillSubmissionDocument[];
};
/**
 * "Submit New Bill" from a CLOSED bill: the same snapshot payload shape as a
 * resubmission, but the server creates a FRESH original bill linked to the closed
 * predecessor — the closed bill stays closed and keeps its record, and the
 * submissions ribbon/timeline chains both records.
 */
export type SubmitNewBillInput = ResubmitBillInput;
export type SandboxSimulationScenario = "accepted" | "rejected" | "processed" | "denied" | "partial_payment" | "paid";
export type SimulateSandboxBillInput = {
  scenario: SandboxSimulationScenario;
  amount?: number;
  reasonCode?: string;
};

export type BrowserBillAddress = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
};

/** Complete bill snapshot accepted by the browser create endpoint. */
export type BrowserBillCreateInput = {
  externalId?: string;
  billingMode?: "med_legal" | "professional";
  patient: {
    id?: string;
    externalId?: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    dateOfBirth: string;
    ssn?: string;
    gender?: "M" | "F" | "X";
    phone?: string;
    address: BrowserBillAddress;
  };
  claim: {
    id?: string;
    externalId?: string;
    claimNumber: string;
    adjNumber?: string;
    employer: string;
    dateOfInjury: string;
    injuryState?: string;
    description?: string;
    claimsAdministrator: {
      id: string;
      name: string;
      /** The chosen payer (subpayor) when the claims administrator requires payer selection. */
      payerId?: string;
    };
  };
  service: { date: string; endDate?: string | null; authorizationNumber?: string | null };
  billingProvider: { name: string; taxId: string; npi: string; phone: string; address: BrowserBillAddress };
  renderingProvider: {
    name: string;
    specialty?: string;
    npi: string;
    taxonomy: string;
    licenseNumber?: string;
    licenseState?: string;
    isQme?: boolean;
    isAme?: boolean;
  };
  serviceLocation: { name?: string; address: BrowserBillAddress; placeOfServiceCode: string };
  diagnoses: string[];
  serviceLines: Array<{
    code: string;
    modifiers?: string[];
    units?: number;
    charge?: number;
    serviceDate?: string;
    serviceDateEnd?: string | null;
    diagnosisPointers?: number[];
  }>;
};

/** Canonical immutable PDF snapshot sent with a bill submission. */
export type BrowserBillSubmissionDocument = {
  externalId?: string;
  filename: string;
  description?: string;
  documentType: BillReviewDocumentType;
  /** Opaque PWK report-type code selected by the component (for example OZ:J4). */
  reportTypeCode?: string;
  contentBase64: string;
};

export type BrowserBillSubmissionInput = BillActorInput & {
  bill: BrowserBillCreateInput;
  submission?: {
    route?: BillSubmissionRoute;
    destination?: SubmitBillInput["destination"];
    attention?: string;
    subject?: string;
    note?: string;
    cc?: string[];
  };
  documents?: BrowserBillSubmissionDocument[];
};

export type BrowserSubmittedBill = Record<string, unknown> & {
  id: string;
  externalId?: string | null;
  state?: string;
};

export type BrowserBillSubmissionResult = {
  billId: string;
  bill: BrowserSubmittedBill;
};

export type BillLifecycleClientOptions = {
  /** ID of an already-submitted bill. Bills are created only by the atomic server API. */
  billId: string;
  sessionEndpoint?: string | undefined;
  getSession?: BillLifecycleSessionProvider | undefined;
  apiBaseUrl?: string | undefined;
  fetch?: typeof globalThis.fetch | undefined;
};

/** Browser-session options for pre-submission reference-data lookups. */
export type BillReferenceClientOptions = Omit<BillLifecycleClientOptions, "billId">;

/** Browser-session options for an atomic immutable bill submission. */
export type BillSubmissionClientOptions = BillReferenceClientOptions;

export type BillSubmissionClient = {
  submitBill: (
    input: BrowserBillSubmissionInput,
    options?: { idempotencyKey?: string },
  ) => Promise<BrowserBillSubmissionResult>;
  clearSession: () => void;
};

/** Input for the pre-submission delivery preview keyed on a payer-directory id. */
export type BillDeliveryPreviewInput = {
  claimsAdministratorId: string;
  /** Two-letter state; defaults to CA server-side. */
  injuryState?: string;
};

export type BillReferenceClient = {
  listClaimsAdministrators: (input?: BillReviewPayerListInput) => Promise<BillReviewPayerPage>;
  searchClaimsAdministrators: (query: string, claimNumber?: string) => Promise<BillReviewPayer[]>;
  getClaimsAdministratorDirectory: (id: string, injuryState?: string) => Promise<BillClaimsAdministratorDirectory>;
  searchDiagnosisCodes: (query: string, limit?: number, offset?: number) => Promise<BillDiagnosisCode[]>;
  lookupPostalCode: (postalCode: string) => Promise<BillPostalPlace | null>;
  /**
   * Delivery-route preview (recommended route + selectable options + payer
   * contacts) for a claims administrator BEFORE the bill exists — powers the
   * send-route picker shown at submit time.
   */
  getDeliveryPreview: (input: BillDeliveryPreviewInput) => Promise<BillDeliveryOptions>;
  clearSession: () => void;
};

export type BillLifecycleClient = {
  getBillId: () => string;
  getLifecycle: (signal?: AbortSignal) => Promise<BillLifecycleData>;
  listClaimsAdministrators: (input?: BillReviewPayerListInput) => Promise<BillReviewPayerPage>;
  searchClaimsAdministrators: (query: string, claimNumber?: string) => Promise<BillReviewPayer[]>;
  getClaimsAdministratorDirectory: (id: string, injuryState?: string) => Promise<BillClaimsAdministratorDirectory>;
  searchDiagnosisCodes: (query: string, limit?: number, offset?: number) => Promise<BillDiagnosisCode[]>;
  lookupPostalCode: (postalCode: string) => Promise<BillPostalPlace | null>;
  getDeliveryOptions: () => Promise<BillDeliveryOptions>;
  getDeliveryPreview: (input: BillDeliveryPreviewInput) => Promise<BillDeliveryOptions>;
  getAttachment: (attachmentId: string) => Promise<Blob>;
  getEor: (documentId: string) => Promise<Blob>;
  getPacket: () => Promise<Blob>;
  closeBill: (input: CloseBillInput) => Promise<BillLifecycleData>;
  reopenBill: (input: ReopenBillInput) => Promise<BillLifecycleData>;
  postPayment: (input: PostBillPaymentInput) => Promise<BillLifecycleData>;
  submitSecondReview: (input: SubmitSecondReviewInput) => Promise<BillLifecycleData>;
  resubmitBill: (input: ResubmitBillInput) => Promise<BillLifecycleData>;
  submitNewBill: (input: SubmitNewBillInput) => Promise<BillLifecycleData>;
  sendDuplicateBill: (input: SendDuplicateBillInput) => Promise<BillLifecycleData>;
  reportBillStatus: (input: ReportBillStatusInput) => Promise<BillLifecycleData>;
  simulateSandbox: (input: SimulateSandboxBillInput) => Promise<BillLifecycleData>;
  clearSession: () => void;
};

async function responseError(response: Response, fallback: string): Promise<Error> {
  const body: unknown = await response.json().catch(() => null);
  const detail = body && typeof body === "object"
    ? (body as { detail?: unknown; message?: unknown; error?: unknown }).detail
      ?? (body as { message?: unknown }).message
      ?? (body as { error?: unknown }).error
    : null;
  return new Error(typeof detail === "string" ? detail : fallback);
}

function isSessionFresh(session: BillLifecycleSession | null): boolean {
  if (!session) return false;
  if (!session.expiresAt) return true;
  const expiresAt = new Date(session.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt > Date.now() + 30_000;
}

function normalizeSession(value: unknown): BillLifecycleSession {
  if (!value || typeof value !== "object") {
    throw new Error("The billing session endpoint returned an invalid response.");
  }
  const candidate = value as { token?: unknown; expiresAt?: unknown; apiBaseUrl?: unknown; session?: unknown; data?: unknown };
  const nested = candidate.session ?? candidate.data;
  const session = nested && typeof nested === "object" ? nested as typeof candidate : candidate;
  if (typeof session.token !== "string" || session.token.length < 8) {
    throw new Error("The billing session endpoint did not return a browser session token.");
  }
  return {
    token: session.token,
    ...(typeof session.expiresAt === "string" ? { expiresAt: session.expiresAt } : {}),
    ...(typeof session.apiBaseUrl === "string" ? { apiBaseUrl: session.apiBaseUrl } : {}),
  };
}

function normalizeLifecycle(value: unknown): BillLifecycleData {
  if (!value || typeof value !== "object") {
    throw new Error("The billing service returned an invalid bill lifecycle.");
  }
  const data = value as Partial<BillLifecycleData>;
  if (
    !["sandbox", "live"].includes(data.environment ?? "")
    || !data.bill
    || !data.patient
    || !data.injury
    || !data.lifecycle
    || !Array.isArray(data.lifecycle.actions)
    || !Array.isArray(data.eors)
    || !Array.isArray(data.activity)
    || !Array.isArray(data.payments)
    || !data.remittance
    || typeof data.remittance !== "object"
    || !data.delivery
    || typeof data.delivery !== "object"
    || !data.delivery.contacts
    || typeof data.delivery.contacts !== "object"
    || (data.rejection != null && (
      typeof data.rejection !== "object"
      || typeof data.rejection.reason !== "string"
      || (data.rejection.issues != null && (
        !Array.isArray(data.rejection.issues)
        || data.rejection.issues.some((issue) => (
          !issue
          || typeof issue !== "object"
          || typeof issue.description !== "string"
          || (issue.code != null && typeof issue.code !== "string")
        ))
      ))
    ))
  ) {
    throw new Error("The billing service returned an invalid bill lifecycle.");
  }
  return data as BillLifecycleData;
}

function normalizeDeliveryOptions(value: unknown): BillDeliveryOptions {
  if (!value || typeof value !== "object") {
    throw new Error("The billing service returned invalid delivery options.");
  }
  const data = value as Partial<BillDeliveryOptions>;
  if (
    typeof data.payerName !== "string"
    || !data.recommended
    || typeof data.recommended !== "object"
    || !["ebill", "fax", "mail", "email"].includes(data.recommended.route ?? "")
    || !Array.isArray(data.options)
    || !data.contacts
  ) {
    throw new Error("The billing service returned invalid delivery options.");
  }
  return data as BillDeliveryOptions;
}

function idempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `mb-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Browser-safe client for one atomic create-and-submit operation.
 *
 * The browser session is short-lived and origin-bound. The host application
 * never needs the Partner API document schema or a long-lived API key.
 */
export function createBillSubmissionClient({
  sessionEndpoint = DEFAULT_SESSION_ENDPOINT,
  getSession,
  apiBaseUrl = DEFAULT_API_BASE_URL,
  fetch: fetchOverride,
}: BillSubmissionClientOptions = {}): BillSubmissionClient {
  const fetcher = fetchOverride ?? globalThis.fetch;
  if (typeof fetcher !== "function") throw new Error("A Fetch API implementation is required.");
  let session: BillLifecycleSession | null = null;
  let sessionRequest: Promise<BillLifecycleSession> | null = null;

  const mintSession = async (signal: AbortSignal, force = false): Promise<BillLifecycleSession> => {
    if (!force && isSessionFresh(session)) return session as BillLifecycleSession;
    if (!force && sessionRequest) return sessionRequest;
    const pending = getSession
      ? getSession({ signal })
      : fetcher(sessionEndpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
        signal,
      }).then(async (response) => {
        if (!response.ok) throw await responseError(response, "The billing session could not be created.");
        return response.json();
      });
    const request = Promise.resolve(pending).then(normalizeSession).then((nextSession) => {
      session = nextSession;
      return nextSession;
    }).finally(() => {
      if (sessionRequest === request) sessionRequest = null;
    });
    sessionRequest = request;
    return request;
  };

  const submitBill = async (
    input: BrowserBillSubmissionInput,
    options: { idempotencyKey?: string } = {},
  ): Promise<BrowserBillSubmissionResult> => {
    const controller = new AbortController();
    const requestIdempotencyKey = options.idempotencyKey ?? idempotencyKey();
    let browserSession = await mintSession(controller.signal);
    const perform = (current: BillLifecycleSession) => {
      const base = (current.apiBaseUrl ?? apiBaseUrl).replace(/\/$/, "");
      return fetcher(`${base}/partner/v2/browser/bills`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${current.token}`,
          "content-type": "application/json",
          "idempotency-key": requestIdempotencyKey,
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
    };
    let response = await perform(browserSession);
    if (response.status === 401) {
      session = null;
      browserSession = await mintSession(controller.signal, true);
      response = await perform(browserSession);
    }
    if (!response.ok) throw await responseError(response, "The bill could not be submitted.");
    const body: unknown = await response.json().catch(() => null);
    const envelope = body && typeof body === "object" && "data" in body
      ? (body as { data?: unknown }).data
      : body;
    if (!envelope || typeof envelope !== "object" || typeof (envelope as { id?: unknown }).id !== "string") {
      throw new Error("The billing service submitted the bill but returned an invalid bill ID.");
    }
    const bill = envelope as BrowserSubmittedBill;
    return { billId: bill.id, bill };
  };

  return {
    submitBill,
    clearSession() { session = null; sessionRequest = null; },
  };
}

/** Browser-safe, framework-neutral client for an already-submitted bill. */
export function createBillLifecycleClient({
  billId,
  sessionEndpoint = DEFAULT_SESSION_ENDPOINT,
  getSession,
  apiBaseUrl = DEFAULT_API_BASE_URL,
  fetch: fetchOverride,
}: BillLifecycleClientOptions): BillLifecycleClient {
  const fetcher = fetchOverride ?? globalThis.fetch;
  if (typeof fetcher !== "function") throw new Error("A Fetch API implementation is required.");
  let session: BillLifecycleSession | null = null;
  let sessionRequest: Promise<BillLifecycleSession> | null = null;
  const currentBillId = billId.trim();
  if (!currentBillId) throw new Error("billId is required for the submitted-bill lifecycle client.");

  const mintSession = async (signal: AbortSignal, force = false): Promise<BillLifecycleSession> => {
    if (!force && isSessionFresh(session)) return session as BillLifecycleSession;
    if (!force && sessionRequest) return sessionRequest;
    const pending = getSession
      ? getSession({ signal })
      : fetcher(sessionEndpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
        signal,
      }).then(async (response) => {
        if (!response.ok) throw await responseError(response, "The billing session could not be created.");
        return response.json();
      });
    const request = Promise.resolve(pending).then(normalizeSession).then((nextSession) => {
      session = nextSession;
      return nextSession;
    }).finally(() => {
      if (sessionRequest === request) sessionRequest = null;
    });
    sessionRequest = request;
    return request;
  };

  const request = async (path: string, init: RequestInit = {}, providedSignal?: AbortSignal): Promise<Response> => {
    const controller = providedSignal ? null : new AbortController();
    const signal = providedSignal ?? controller?.signal;
    if (!signal) throw new Error("An AbortSignal could not be created.");
    let browserSession = await mintSession(signal);
    const perform = (current: BillLifecycleSession) => {
      const base = (current.apiBaseUrl ?? apiBaseUrl).replace(/\/$/, "");
      const headers = new Headers(init.headers);
      headers.set("authorization", `Bearer ${current.token}`);
      return fetcher(`${base}${path}`, { ...init, headers, signal });
    };
    let response = await perform(browserSession);
    if (response.status === 401) {
      session = null;
      browserSession = await mintSession(signal, true);
      response = await perform(browserSession);
    }
    return response;
  };

  const billPath = (suffix = ""): string =>
    `/partner/v2/browser/bills/${encodeURIComponent(currentBillId)}${suffix}`;

  const loadLifecycle = async (signal?: AbortSignal) => {
    const response = await request(billPath("/lifecycle"), {}, signal);
    if (!response.ok) throw await responseError(response, "Bill lifecycle could not be loaded.");
    const body = await response.json() as { data?: unknown };
    return normalizeLifecycle(body.data);
  };

  const listClaimsAdministrators = async (input: BillReviewPayerListInput = {}): Promise<BillReviewPayerPage> => {
    const params = new URLSearchParams();
    if (input.query?.trim()) params.set("q", input.query.trim());
    if (input.claimNumber?.trim()) params.set("claimNumber", input.claimNumber.trim());
    if (input.sourceClaimsAdministratorName?.trim()) params.set("sourceClaimsAdministratorName", input.sourceClaimsAdministratorName.trim());
    if (input.employerName?.trim()) params.set("employerName", input.employerName.trim());
    const limit = Math.max(1, Math.min(100, Math.floor(input.limit ?? 50)));
    const offset = Math.max(0, Math.floor(input.offset ?? 0));
    params.set("limit", String(limit));
    if (offset) params.set("offset", String(offset));
    const response = await request(`/partner/v2/browser/claims-administrators?${params.toString()}`);
    if (!response.ok) throw await responseError(response, "Claims administrator search is unavailable.");
    const body = await response.json() as { results?: unknown; suggestions?: unknown; total?: unknown; nextOffset?: unknown; recommendedId?: unknown };
    if (!Array.isArray(body.results)) throw new Error("Claims administrator search returned an invalid response.");
    const normalizePayer = (value: unknown): BillReviewPayer | null => {
      if (!value || typeof value !== "object") return null;
      const payer = value as Record<string, unknown>;
      if (typeof payer.id !== "string" || typeof payer.name !== "string") return null;
      const payers = Array.isArray(payer.payers) ? payer.payers.flatMap((option): BillReviewPayerOption[] => {
        if (!option || typeof option !== "object") return [];
        const candidate = option as Record<string, unknown>;
        const id = typeof candidate.id === "string" ? candidate.id : typeof candidate.key === "string" ? candidate.key : null;
        if (!id || typeof candidate.label !== "string") return [];
        return [{
          id,
          label: candidate.label,
          ...(typeof candidate.default === "boolean" ? { default: candidate.default } : {}),
          ...(typeof candidate.active === "boolean" ? { active: candidate.active } : {}),
          ...(Array.isArray(candidate.aliases) ? { aliases: candidate.aliases.filter((item): item is string => typeof item === "string") } : {}),
          ...(typeof candidate.hint === "string" ? { hint: candidate.hint } : {}),
          ...(Array.isArray(candidate.affiliatedEntities) ? { affiliatedEntities: candidate.affiliatedEntities.filter((item): item is string => typeof item === "string") } : {}),
          ...(typeof candidate.route === "string" ? { route: candidate.route } : {}),
          ...(typeof candidate.optionType === "string" ? { optionType: candidate.optionType } : {}),
          ...(typeof candidate.deliveryType === "string" ? { deliveryType: candidate.deliveryType } : {}),
          ...(typeof candidate.clearinghouse === "string" ? { clearinghouse: candidate.clearinghouse } : {}),
          ...(typeof candidate.payerId === "string" ? { payerId: candidate.payerId } : {}),
          ...(typeof candidate.sourceClearinghouse === "string" ? { sourceClearinghouse: candidate.sourceClearinghouse } : {}),
          ...(typeof candidate.sourcePayerId === "string" ? { sourcePayerId: candidate.sourcePayerId } : {}),
          ...(candidate.clearinghousePayerIds && typeof candidate.clearinghousePayerIds === "object" && !Array.isArray(candidate.clearinghousePayerIds)
            ? { clearinghousePayerIds: Object.fromEntries(Object.entries(candidate.clearinghousePayerIds).filter((entry): entry is [string, string] => typeof entry[1] === "string")) }
            : {}),
          ...(typeof candidate.preferredClearinghouse === "string" ? { preferredClearinghouse: candidate.preferredClearinghouse } : {}),
        }];
      }) : undefined;
      const claimNumberPatterns = Array.isArray(payer.claimNumberPatterns) ? payer.claimNumberPatterns.flatMap((value): BillClaimsAdministratorPattern[] => {
        if (!value || typeof value !== "object") return [];
        const pattern = value as Record<string, unknown>;
        if (typeof pattern.pattern !== "string") return [];
        return [{
          pattern: pattern.pattern,
          ...(typeof pattern.length === "string" || typeof pattern.length === "number" ? { length: pattern.length } : {}),
          ...(typeof pattern.example === "string" ? { example: pattern.example } : {}),
          ...(typeof pattern.matches === "boolean" || pattern.matches === null ? { matches: pattern.matches as boolean | null } : {}),
        }];
      }) : undefined;
      return {
        id: payer.id,
        name: payer.name,
        ...(typeof payer.hasElectronic === "boolean" ? { hasElectronic: payer.hasElectronic } : {}),
        ...(Array.isArray(payer.states) ? { states: payer.states.filter((state): state is string => typeof state === "string") } : {}),
        ...(["high", "medium", "directory"].includes(String(payer.confidence)) ? { confidence: payer.confidence as NonNullable<BillReviewPayer["confidence"]> } : {}),
        ...(typeof payer.recommended === "boolean" ? { recommended: payer.recommended } : {}),
        ...(typeof payer.payerSelectionRequired === "boolean" ? { payerSelectionRequired: payer.payerSelectionRequired } : {}),
        ...(payers ? { payers } : {}),
        ...(Array.isArray(payer.aliases) ? { aliases: payer.aliases.filter((item): item is string => typeof item === "string") } : {}),
        ...(Array.isArray(payer.affiliatedEntities) ? { affiliatedEntities: payer.affiliatedEntities.filter((item): item is string => typeof item === "string") } : {}),
        ...(typeof payer.claimNumberHint === "string" ? { claimNumberHint: payer.claimNumberHint } : {}),
        ...(claimNumberPatterns ? { claimNumberPatterns } : {}),
        ...(typeof payer.route === "string" ? { route: payer.route } : {}),
        ...(Array.isArray(payer.signals) ? { signals: payer.signals.flatMap((signal) => {
          if (!signal || typeof signal !== "object") return [];
          const candidate = signal as Record<string, unknown>;
          if (!["name", "claim_number"].includes(String(candidate.kind)) || !["match", "warning"].includes(String(candidate.state)) || typeof candidate.label !== "string") return [];
          return [{ kind: candidate.kind as "name" | "claim_number", state: candidate.state as "match" | "warning", label: candidate.label }];
        }) } : {}),
      };
    };
    const results = body.results.flatMap((value): BillReviewPayer[] => {
      const payer = normalizePayer(value);
      return payer ? [payer] : [];
    });
    const suggestions = Array.isArray(body.suggestions) ? body.suggestions.flatMap((value): BillReviewPayerSuggestion[] => {
      const payer = normalizePayer(value);
      if (!payer || !value || typeof value !== "object") return [];
      const suggestion = value as Record<string, unknown>;
      if (typeof suggestion.deterministic !== "boolean" || typeof suggestion.reason !== "string") return [];
      return [{ ...payer, deterministic: suggestion.deterministic, reason: suggestion.reason, ...(typeof suggestion.selectedPayerId === "string" ? { selectedPayerId: suggestion.selectedPayerId } : {}) }];
    }) : [];
    const total = typeof body.total === "number" && Number.isFinite(body.total) ? Math.max(results.length, Math.floor(body.total)) : offset + results.length;
    return {
      results,
      ...(suggestions.length ? { suggestions } : {}),
      total,
      ...(typeof body.nextOffset === "number" && Number.isFinite(body.nextOffset) ? { nextOffset: Math.floor(body.nextOffset) } : {}),
      ...(typeof body.recommendedId === "string" ? { recommendedId: body.recommendedId } : {}),
    };
  };

  const searchClaimsAdministrators = async (query: string, claimNumber?: string): Promise<BillReviewPayer[]> =>
    (await listClaimsAdministrators({ query, ...(claimNumber ? { claimNumber } : {}) })).results;

  const getClaimsAdministratorDirectory = async (id: string, injuryState?: string): Promise<BillClaimsAdministratorDirectory> => {
    const params = new URLSearchParams();
    if (injuryState?.trim()) params.set("injuryState", injuryState.trim());
    const response = await request(`/partner/v2/browser/claims-administrators/${encodeURIComponent(id)}${params.size ? `?${params}` : ""}`);
    if (!response.ok) throw await responseError(response, "Claims administrator details are unavailable.");
    const body = await response.json() as { data?: unknown };
    if (!body.data || typeof body.data !== "object") throw new Error("Claims administrator details returned an invalid response.");
    return body.data as BillClaimsAdministratorDirectory;
  };

  const searchDiagnosisCodes = async (query: string, limit = 30, offset = 0): Promise<BillDiagnosisCode[]> => {
    const params = new URLSearchParams({ q: query.trim(), limit: String(Math.max(1, Math.min(100, limit))) });
    if (offset > 0) params.set("offset", String(Math.max(0, Math.floor(offset))));
    const response = await request(`/partner/v2/browser/diagnosis-codes?${params.toString()}`);
    if (!response.ok) throw await responseError(response, "Diagnosis-code search is unavailable.");
    const body = await response.json() as { results?: unknown };
    if (!Array.isArray(body.results)) throw new Error("Diagnosis-code search returned an invalid response.");
    return body.results.flatMap((value): BillDiagnosisCode[] => {
      if (!value || typeof value !== "object") return [];
      const candidate = value as { code?: unknown; description?: unknown };
      return typeof candidate.code === "string" && typeof candidate.description === "string"
        ? [{ code: candidate.code, description: candidate.description }]
        : [];
    });
  };

  const lookupPostalCode = async (postalCode: string): Promise<BillPostalPlace | null> => {
    const params = new URLSearchParams({ postalCode: postalCode.trim() });
    const response = await request(`/partner/v2/browser/postal-codes?${params.toString()}`);
    if (response.status === 404) return null;
    if (!response.ok) throw await responseError(response, "ZIP lookup is unavailable.");
    const body = await response.json() as { city?: unknown; state?: unknown };
    if (typeof body.city !== "string" || typeof body.state !== "string") {
      throw new Error("ZIP lookup returned an invalid response.");
    }
    return { city: body.city, state: body.state };
  };

  const mutation = async (path: string, init: RequestInit, fallback: string) => {
    const headers = new Headers(init.headers);
    headers.set("idempotency-key", idempotencyKey());
    const response = await request(path, { ...init, headers });
    if (!response.ok) throw await responseError(response, fallback);
    return response;
  };
  const action = async (input: Record<string, unknown>, fallback: string): Promise<BillLifecycleData> => {
    const response = await mutation(billPath("/actions"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }, fallback);
    const body = await response.json() as { data?: unknown };
    return normalizeLifecycle(body.data);
  };
  const simulateSandbox = async (input: SimulateSandboxBillInput): Promise<BillLifecycleData> => {
    const response = await mutation(billPath("/simulate"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }, "Sandbox lifecycle could not be simulated.");
    const body = await response.json() as { data?: unknown };
    return normalizeLifecycle(body.data);
  };
  return {
    getBillId() { return currentBillId; },
    clearSession() { session = null; sessionRequest = null; },
    getLifecycle: loadLifecycle,
    listClaimsAdministrators,
    searchClaimsAdministrators,
    getClaimsAdministratorDirectory,
    searchDiagnosisCodes,
    lookupPostalCode,
    async getDeliveryOptions() {
      const response = await request(billPath("/delivery-options"));
      if (!response.ok) throw await responseError(response, "Delivery options could not be loaded.");
      const body = await response.json() as { data?: unknown };
      return normalizeDeliveryOptions(body.data ?? body);
    },
    async getDeliveryPreview(input) {
      const params = new URLSearchParams({ claimsAdministratorId: input.claimsAdministratorId.trim() });
      if (input.injuryState?.trim()) params.set("injuryState", input.injuryState.trim());
      const response = await request(`/partner/v2/browser/delivery-preview?${params.toString()}`);
      if (!response.ok) throw await responseError(response, "Delivery routes could not be loaded.");
      const body = await response.json() as { data?: unknown };
      return normalizeDeliveryOptions(body.data ?? body);
    },
    async getAttachment(attachmentId) {
      const response = await request(billPath(`/documents/${encodeURIComponent(attachmentId)}`));
      if (!response.ok) throw await responseError(response, "Document could not be opened.");
      return response.blob();
    },
    async getEor(documentId) {
      const response = await request(billPath(`/eors/${encodeURIComponent(documentId)}`));
      if (!response.ok) throw await responseError(response, "EOR could not be opened.");
      return response.blob();
    },
    async getPacket() {
      const response = await request(billPath("/packet"));
      if (!response.ok) throw await responseError(response, "Submission packet could not be downloaded.");
      return response.blob();
    },
    closeBill(input) { return action({ action: "close", ...input }, "Bill could not be closed."); },
    reopenBill(input) { return action({ action: "reopen", ...input }, "Bill could not be reopened."); },
    postPayment(input) { return action({ action: "post_payment", penaltyAmount: 0, interestAmount: 0, ...input, checkNumber: input.checkNumber ?? "" }, "Payment could not be posted."); },
    submitSecondReview(input) { return action({ action: "second_review", ...input }, "Second Review could not be submitted."); },
    resubmitBill(input) { return action({ action: "resubmit", ...input }, "Bill could not be resubmitted."); },
    submitNewBill(input) { return action({ action: "submit_new_bill", ...input }, "The new bill could not be submitted."); },
    sendDuplicateBill(input) { return action({ action: "send_duplicate", ...input }, "Duplicate bill could not be sent."); },
    reportBillStatus(input) { return action({ action: "report_bill_status", ...input }, "Bill status could not be reported."); },
    simulateSandbox,
  };
}

/**
 * Browser-safe client for reference data needed before a bill exists.
 *
 * Partners can pass the same short-lived session provider used by the submitted-bill
 * lifecycle without inventing a draft bill or exposing payer directory credentials.
 */
export function createBillReferenceClient(
  options: BillReferenceClientOptions = {},
): BillReferenceClient {
  const lifecycle = createBillLifecycleClient({
    ...options,
    billId: "pre-submission-reference-data",
  });
  return {
    listClaimsAdministrators: lifecycle.listClaimsAdministrators,
    searchClaimsAdministrators: lifecycle.searchClaimsAdministrators,
    getClaimsAdministratorDirectory: lifecycle.getClaimsAdministratorDirectory,
    searchDiagnosisCodes: lifecycle.searchDiagnosisCodes,
    lookupPostalCode: lifecycle.lookupPostalCode,
    getDeliveryPreview: lifecycle.getDeliveryPreview,
    clearSession: lifecycle.clearSession,
  };
}

// ---------------------------------------------------------------------------
// Organization profile client (INC-1470): backs the embeddable
// OrganizationOnboarding / BillingSettings components. Requires a browser
// session minted with the OPTIONAL organization:manage permission; sessions
// without it are rejected by the API and nothing else changes.

export type OrganizationPracticeIdentity = {
  name?: string; legalName?: string; taxId?: string; npi?: string;
  phone?: string; email?: string; website?: string;
};

export type OrganizationBillingProviderInput = {
  id?: string; externalId?: string; name: string; taxId: string; npi: string;
  billType?: "Professional" | "Institutional"; phone?: string;
  billingStreet?: string; billingCity?: string; billingState?: string; billingZip?: string;
};

export type OrganizationLocationInput = {
  id?: string; externalId?: string; name: string; street: string; city: string;
  state: string; zip: string; nickname?: string; posCode?: string;
  isPrimary?: boolean; active?: boolean;
};

export type OrganizationChecklistItem = { id: string; label: string; complete: boolean };

export type OrganizationProfileData = {
  organizationId: string;
  practiceIdentity: OrganizationPracticeIdentity;
  billingProviders: Array<OrganizationBillingProviderInput & { id: string }>;
  locations: Array<OrganizationLocationInput & { id: string }>;
  w9: { filename: string; addDate: string; taxYear?: number } | null;
  onboarding: { status: string | null; complete: boolean; checklist: OrganizationChecklistItem[] };
};

export type OrganizationClientOptions = {
  sessionEndpoint?: string;
  getSession?: BillLifecycleSessionProvider;
  apiBaseUrl?: string;
  fetch?: typeof globalThis.fetch;
};

export type OrganizationClient = {
  getOrganization: () => Promise<OrganizationProfileData>;
  saveBillingProfile: (input: {
    practiceIdentity?: OrganizationPracticeIdentity;
    billingProviders?: OrganizationBillingProviderInput[];
  }) => Promise<OrganizationProfileData>;
  saveLocations: (locations: OrganizationLocationInput[]) => Promise<OrganizationProfileData>;
  saveW9: (input: { filename: string; contentBase64: string; taxYear?: number }) => Promise<OrganizationProfileData>;
};

export function createOrganizationClient({
  sessionEndpoint = DEFAULT_SESSION_ENDPOINT,
  getSession,
  apiBaseUrl = DEFAULT_API_BASE_URL,
  fetch: fetchOverride,
}: OrganizationClientOptions = {}): OrganizationClient {
  const fetcher = fetchOverride ?? globalThis.fetch;
  if (typeof fetcher !== "function") throw new Error("A Fetch API implementation is required.");
  let session: BillLifecycleSession | null = null;

  const mintSession = async (force = false): Promise<BillLifecycleSession> => {
    if (!force && isSessionFresh(session)) return session as BillLifecycleSession;
    const pending = getSession
      ? getSession({ signal: new AbortController().signal })
      : fetcher(sessionEndpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }).then(async (response) => {
        if (!response.ok) throw await responseError(response, "The organization session could not be created.");
        return response.json();
      });
    session = normalizeSession(await Promise.resolve(pending));
    return session;
  };

  const request = async (path: string, init: RequestInit = {}): Promise<OrganizationProfileData> => {
    let current = await mintSession();
    const perform = (active: BillLifecycleSession) => {
      const base = (active.apiBaseUrl ?? apiBaseUrl).replace(/\/$/, "");
      const headers = new Headers(init.headers);
      headers.set("authorization", `Bearer ${active.token}`);
      if (init.body) headers.set("content-type", "application/json");
      return fetcher(`${base}${path}`, { ...init, headers });
    };
    let response = await perform(current);
    if (response.status === 401) {
      current = await mintSession(true);
      response = await perform(current);
    }
    if (!response.ok) throw await responseError(response, "The organization request failed.");
    const body = (await response.json()) as { data?: OrganizationProfileData };
    if (!body.data || typeof body.data !== "object") {
      throw new Error("The organization response was invalid.");
    }
    return body.data;
  };

  return {
    getOrganization: () => request("/partner/v2/browser/organization"),
    saveBillingProfile: (input) =>
      request("/partner/v2/browser/organization/billing-profile", { method: "PUT", body: JSON.stringify(input) }),
    saveLocations: (locations) =>
      request("/partner/v2/browser/organization/locations", { method: "PUT", body: JSON.stringify({ locations }) }),
    saveW9: (input) =>
      request("/partner/v2/browser/organization/w9", { method: "PUT", body: JSON.stringify(input) }),
  };
}

// ---------------------------------------------------------------------------
// Bill Tasks dashboard: a pure, framework-neutral
// aggregation shared by the React and Angular components. Hosts flatten their
// own work items and get back per-section rows bucketed by age in days.

export type BillTasksAgingBucket = {
  id: string;
  label: string;
  /** Exclusive lower bound in days. The first bucket also admits day 0. */
  minDays: number;
  /** Inclusive upper bound in days; null means unbounded. */
  maxDays: number | null;
};

export const BILL_TASKS_AGING_BUCKETS: BillTasksAgingBucket[] = [
  { id: "1-30", label: "1-30 Days Ago", minDays: 0, maxDays: 30 },
  { id: "31-60", label: "31-60 Days Ago", minDays: 30, maxDays: 60 },
  { id: "61-90", label: "61-90 Days Ago", minDays: 60, maxDays: 90 },
  { id: "91-180", label: "91-180 Days Ago", minDays: 90, maxDays: 180 },
  { id: "181+", label: "181+ Days Ago", minDays: 180, maxDays: null },
];

export type BillTasksDashboardItem = {
  sectionId: string;
  rowId: string;
  rowLabel: string;
  ageDays: number;
  balanceDue?: number;
  /** Opaque bill reference echoed back in click-through payloads. */
  ref?: string;
};

export type BillTasksDashboardRow = {
  id: string;
  label: string;
  /** One count per aging bucket, in bucket order. */
  counts: number[];
  total: number;
  /** Collected item refs per aging bucket, in bucket order. */
  refs: string[][];
};

export type BillTasksDashboardTone = "violet" | "red" | "blue" | "green" | "amber" | "neutral";

export type BillTasksDashboardSectionInput = {
  id: string;
  label: string;
  /** Shown under the section label as "by {agingBasisLabel}". */
  agingBasisLabel: string;
  tone: BillTasksDashboardTone;
};

export type BillTasksDashboardSection = BillTasksDashboardSectionInput & {
  rows: BillTasksDashboardRow[];
  /** Per-bucket totals across the section's rows. */
  totals: number[];
  total: number;
  empty: boolean;
};

export type BillTasksDashboardData = {
  sections: BillTasksDashboardSection[];
  grandTotals: number[];
  grandTotal: number;
};

/**
 * Bucket index for an item age: a bucket admits `minDays < ageDays <= maxDays`
 * (`maxDays: null` = unbounded) and the first bucket also admits day 0.
 * Ages beyond every bucket clamp into the last bucket.
 */
export function billTasksAgingBucketIndex(
  ageDays: number,
  buckets: BillTasksAgingBucket[] = BILL_TASKS_AGING_BUCKETS,
): number {
  const days = Math.max(0, Math.floor(ageDays));
  const index = buckets.findIndex((bucket, position) =>
    (bucket.maxDays === null || days <= bucket.maxDays)
    && (days > bucket.minDays || position === 0));
  return index === -1 ? buckets.length - 1 : index;
}

/**
 * Aggregates flat work items into the Bill Tasks dashboard.
 * Sections render in the given order even when empty; rows appear in
 * first-seen item order within their section.
 */
export function buildBillTasksDashboard(
  items: BillTasksDashboardItem[],
  sections: BillTasksDashboardSectionInput[],
  buckets: BillTasksAgingBucket[] = BILL_TASKS_AGING_BUCKETS,
): BillTasksDashboardData {
  const zeros = () => buckets.map(() => 0);
  const built = sections.map((section): BillTasksDashboardSection => ({
    ...section,
    rows: [],
    totals: zeros(),
    total: 0,
    empty: true,
  }));
  const sectionById = new Map(built.map((section) => [section.id, section]));
  const rowByKey = new Map<string, BillTasksDashboardRow>();
  const grandTotals = zeros();
  let grandTotal = 0;

  for (const item of items) {
    const section = sectionById.get(item.sectionId);
    if (!section) continue;
    const key = `${item.sectionId}\u0000${item.rowId}`;
    let row = rowByKey.get(key);
    if (!row) {
      row = {
        id: item.rowId,
        label: item.rowLabel,
        counts: zeros(),
        total: 0,
        refs: buckets.map(() => []),
      };
      rowByKey.set(key, row);
      section.rows.push(row);
      section.empty = false;
    }
    const bucketIndex = billTasksAgingBucketIndex(item.ageDays, buckets);
    row.counts[bucketIndex] = (row.counts[bucketIndex] ?? 0) + 1;
    row.total += 1;
    if (item.ref) row.refs[bucketIndex]?.push(item.ref);
    section.totals[bucketIndex] = (section.totals[bucketIndex] ?? 0) + 1;
    section.total += 1;
    grandTotals[bucketIndex] = (grandTotals[bucketIndex] ?? 0) + 1;
    grandTotal += 1;
  }

  return { sections: built, grandTotals, grandTotal };
}
