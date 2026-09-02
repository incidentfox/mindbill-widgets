"use client";

import "@mindbill/embed";
import type { CSSProperties, ReactElement } from "react";
import { createElement, useEffect, useRef } from "react";
import type {
  MindBillAppearance,
  MindBillErrorDetail,
  MindBillEventDetail,
} from "@mindbill/embed";

export type MindBillWidgetProps = {
  sessionToken: string;
  embedUrl: string;
  appearance?: MindBillAppearance;
  className?: string;
  style?: CSSProperties;
  onMindBill?: (event: CustomEvent<MindBillEventDetail>) => void;
  onMindBillError?: (event: CustomEvent<MindBillErrorDetail>) => void;
};

function widget(tagName: string, props: MindBillWidgetProps): ReactElement {
  const ref = useRef<HTMLElement | null>(null);
  const { onMindBill, onMindBillError } = props;
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const handleEvent = (event: Event) =>
      onMindBill?.(event as CustomEvent<MindBillEventDetail>);
    const handleError = (event: Event) =>
      onMindBillError?.(event as CustomEvent<MindBillErrorDetail>);
    element.addEventListener("mindbill", handleEvent);
    element.addEventListener("mindbill-error", handleError);
    return () => {
      element.removeEventListener("mindbill", handleEvent);
      element.removeEventListener("mindbill-error", handleError);
    };
  }, [onMindBill, onMindBillError]);

  return createElement(tagName, {
    ref,
    "session-token": props.sessionToken,
    "embed-url": props.embedUrl,
    theme: props.appearance?.theme,
    "accent-color": props.appearance?.accentColor,
    "background-color": props.appearance?.backgroundColor,
    "surface-color": props.appearance?.surfaceColor,
    "text-color": props.appearance?.textColor,
    "muted-color": props.appearance?.mutedColor,
    "border-color": props.appearance?.borderColor,
    "font-family": props.appearance?.fontFamily,
    "border-radius": props.appearance?.borderRadius,
    locale: props.appearance?.locale,
    class: props.className,
    style: props.style,
  });
}

export function MindBillBillTimeline(props: MindBillWidgetProps): ReactElement {
  return widget("mindbill-bill-timeline", props);
}
export function MindBillBillReview(props: MindBillWidgetProps): ReactElement {
  return widget("mindbill-bill-review", props);
}


export type {
  MindBillAppearance,
  MindBillErrorDetail,
  MindBillEventDetail,
} from "@mindbill/embed";

export {
  mindBillAppearanceStyle,
  mindBillThemePresets,
  resolveMindBillAppearance,
} from "./appearance";
export type {
  MindBillReactAppearance,
  MindBillThemePreset,
} from "./appearance";

export {
  BillReviewForm,
  BillStatusSummary,
  buildBillReviewSaveInput,
  ensureTrailingProcedureLine,
} from "./native-bill-review";

export { BillReadOnlyForm } from "./bill-read-only-form";
export type { BillReadOnlyFormProps } from "./bill-read-only-form";

export {
  applyBillSubmissionEvaluationDiagnoses,
  applyBillSubmissionEvaluationModifiers,
  BILL_SUBMISSION_DOCUMENT_TYPES,
  BILL_SUBMISSION_REPORT_TYPES,
  BILL_SUBMISSION_REQUIRED_FIELDS,
  BillSubmissionActions,
  BillSubmissionAttachmentsSection,
  BillSubmissionClaimSection,
  BillSubmissionForm,
  BillSubmissionHeader,
  BillSubmissionPatientSection,
  BillSubmissionProvidersSection,
  BillSubmissionServiceLinesSection,
  ensureTrailingBillSubmissionLine,
  exactClaimsAdministratorMatch,
  formatBillSubmissionDate,
  claimsAdministratorRecommendations,
  MED_LEGAL_REPORT_TYPE_CODE,
  normalizeClaimsAdministratorName,
  parseBillSubmissionDate,
  prepareBillSubmissionDocuments,
  PSYCH_QME_DEFAULT_DIAGNOSIS,
  validateBillSubmission,
} from "./bill-submission-form";
export type {
  BillSubmissionAddress,
  BillSubmissionAttachmentReportTypeMode,
  BillSubmissionDiagnosisOption,
  BillSubmissionDocumentType,
  BillSubmissionEvaluationType,
  BillSubmissionFormProps,
  BillSubmissionFormValue,
  BillSubmissionInput,
  BillSubmissionModifierOption,
  BillSubmissionPostalPlace,
  BillSubmissionProcedureOption,
  BillSubmissionReportTypeOption,
  BillSubmissionSectionId,
  BillSubmissionSourceAttachment,
  BillSubmissionTaxonomyOption,
  BillSubmissionUpload,
  BillSubmissionValidation,
} from "./bill-submission-form";
export {
  BILL_SUBMISSION_DIAGNOSIS_QUICK_PICKS,
  calculateBillSubmissionAllowedAmount,
  DEFAULT_BILL_SUBMISSION_MODIFIERS,
  DEFAULT_BILL_SUBMISSION_PROCEDURES,
  DEFAULT_BILL_SUBMISSION_TAXONOMIES,
} from "./billing-catalog";
export type {
  BillReviewAttachment,
  BillReviewBillingProvider,
  BillReviewClinician,
  BillReviewData,
  BillReviewDocumentType,
  BillReviewDraft,
  BillReviewFormProps,
  BillReviewFeatures,
  BillReviewLineItem,
  BillReviewLocation,
  BillReviewPayer,
  BillReviewSaveInput,
  BillStatusSummaryProps,
  BillStatusAction,
  BillSubmissionRoute,
} from "./native-bill-review";

export {
  BillAgingSummary,
  BillingDashboard,
  BillingReport,
  BillList,
  billAgingBucket,
  billAgingDays,
  buildBillingReportCsv,
  buildBillingReportRows,
  summarizeBillingDashboard,
} from "./billing-dashboard";
export type {
  BillAgingBucket,
  BillAgingBucketId,
  BillAgingSummaryProps,
  BillingComponentProps,
  BillingDashboardBill,
  BillingDashboardProps,
  BillingDashboardSummary,
  BillingReportDimension,
  BillingReportProps,
  BillingReportRow,
  BillListProps,
} from "./billing-dashboard";

export {
  BILL_STATUS_AGING_BUCKETS,
  BillStatusAgingMatrix,
  buildBillStatusAgingCsv,
  buildBillStatusAgingMatrix,
} from "./status-aging-matrix";
export type {
  BillStatusAgingCell,
  BillStatusAgingMatrixData,
  BillStatusAgingMatrixProps,
  BillStatusAgingRow,
} from "./status-aging-matrix";

export {
  ConnectedBillStatus,
  createBillStatusClient,
  useBillStatus,
} from "./connected-bill-status";
export type { BrowserBillSubmissionResult } from "@mindbill/browser";

export {
  BillActivityTimeline,
  BillExplanationOfReview,
  BillLifecycleActions,
  BillLifecycleProgress,
  BillPaymentLedger,
  BillPayerContactCard,
  BillRemittanceCard,
  BillSnapshotSummary,
  billActivityEventLabel,
  billLifecycleDisplayLabel,
  billLifecycleStage,
  visibleBillLifecycleActions,
} from "./bill-lifecycle-surfaces";
export type {
  BillActivityEvent,
  BillActivityTimelineProps,
  BillExplanationOfReviewProps,
  BillLifecycleActionsProps,
  BillLifecycleProgressProps,
  BillLifecycleStage,
  BillPaymentLedgerProps,
  BillPayerContactCardProps,
  BillRemittanceCardProps,
  BillSnapshotSummaryProps,
} from "./bill-lifecycle-surfaces";

export {
  ConnectedBillLifecycle,
  createBillLifecycleClient,
  useBillLifecycle,
} from "./connected-bill-lifecycle";
export type {
  BillClaimsAdministratorContact,
  BillClaimsAdministratorDirectory,
  BillClaimsAdministratorMailingAddress,
  BillClaimsAdministratorPattern,
  BillEorDocument,
  BillActivityRecord,
  BillLifecycleAction,
  BillLifecycleActionId,
  BillLifecycleClient,
  BillLifecycleClientOptions,
  BillLifecycleData,
  BillLifecycleDelivery,
  BillLifecycleSession,
  BillLifecycleSessionProvider,
  BillLifecycleSessionRequest,
  BillPaymentRecord,
  BillRemittanceSummary,
  CloseBillInput,
  ConnectedBillLifecycleProps,
  PostBillPaymentInput,
  ReopenBillInput,
  SubmitSecondReviewInput,
  UseBillLifecycleOptions,
  UseBillLifecycleResult,
} from "./connected-bill-lifecycle";
export type {
  BillStatusClient,
  BillStatusClientOptions,
  BillStatusData,
  BillStatusSession,
  BillStatusSessionProvider,
  BillStatusSessionRequest,
  ConnectedBillStatusProps,
  UseBillStatusOptions,
  UseBillStatusResult,
} from "./connected-bill-status";
