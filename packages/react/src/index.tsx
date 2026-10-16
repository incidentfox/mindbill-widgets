"use client";

export { MedicalProviderNetworkSelect } from "./medical-provider-network-select";
export type { MedicalProviderNetworkSelectProps } from "./medical-provider-network-select";
export type { MedicalProviderNetwork } from "@mindbill/browser";

export { FeeScheduleCalculator } from "./fee-schedule-calculator";
export type { FeeScheduleCalculatorProps } from "./fee-schedule-calculator";
export type { CaClaimFeeQuoteInput, CaClaimFeeQuoteResult } from "@mindbill/browser";

export { BillCourtesyCopyForm } from "./bill-courtesy-copy-form";
export type { BillCourtesyCopyFormProps, CourtesyCopyRecipientOption } from "./bill-courtesy-copy-form";
export type { BillFeeContext, BillCourtesyCopyInput, BillCourtesyCopyPreview, BillCourtesyCopyResult, BillTeamNote } from "@mindbill/browser";
export { organizationProfileOptions } from "./billing-profile-options";
export type { BillSubmissionProfileOptions, BillSubmissionProfileOption } from "./billing-profile-options";

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

export { BillStatusSummary, ensureTrailingProcedureLine } from "./native-bill-review";

export { BillReadOnlyForm } from "./bill-read-only-form";
export { BillDetailLayout, BillDetailSection } from "./bill-detail-layout";
export type { BillDetailLayoutProps, BillDetailSectionProps, BillDetailValidationIssue } from "./bill-detail-layout";
export type { BillReadOnlyFormProps, BillDetailNavigationProps, BillDetailSectionKey } from "./bill-read-only-form";

export {
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
  validateBillSubmission,
} from "./bill-submission-form";
export type {
  BillSubmissionAddress,
  BillSubmissionAttachmentReportTypeMode,
  BillSubmissionDiagnosisOption,
  BillSubmissionDocumentType,
  BillSubmissionEvaluationType,
  BillSubmissionFeeContext,
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
export { SendRouteDialog } from "./send-route-dialog";
export type { SendRouteDialogProps, SendRouteSubmission } from "./send-route-dialog";

export { calculateBillSubmissionAllowedAmount } from "./billing-catalog";
export type {
  BillReviewAttachment,
  BillReviewBillingProvider,
  BillReviewClinician,
  BillReviewData,
  BillReviewDocumentType,
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
  buildBillingReportCsv,
  buildBillingReportRows,
  summarizeBillingDashboard,
  medLegalCollectionFollowUpDueAt,
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

export { BillStatusAgingMatrix, buildBillStatusAgingCsv, buildBillStatusAgingMatrix } from "./status-aging-matrix";
export type {
  BillStatusAgingCell,
  BillStatusAgingMatrixData,
  BillStatusAgingMatrixProps,
  BillStatusAgingRow,
} from "./status-aging-matrix";

export { BillTasksDashboard, buildBillTasksDashboard } from "./bill-tasks-dashboard";
export type {
  BillTasksAgingBucket,
  BillTasksDashboardCell,
  BillTasksDashboardData,
  BillTasksDashboardItem,
  BillTasksDashboardProps,
  BillTasksDashboardRow,
  BillTasksDashboardSection,
  BillTasksDashboardSectionInput,
  BillTasksDashboardTone,
} from "./bill-tasks-dashboard";

export { BillSubmissionsRibbon, billSubmissionsRibbonFromHistory } from "./bill-submissions-ribbon";
export type {
  BillSubmissionRibbonItem,
  BillSubmissionsRibbonProps,
} from "./bill-submissions-ribbon";

export { REPORT_BILL_STATUS_OPTIONS, ReportBillStatusDialog } from "./report-bill-status-dialog";
export type {
  ReportBillStatusDialogProps,
  ReportBillStatusId,
  ReportBillStatusInput,
} from "./report-bill-status-dialog";

export { BillingSettings, OrganizationOnboarding } from "./organization-onboarding";
export { W9Upload } from "./w9-upload";
export type { W9UploadProps, W9ExtractionStatus } from "./w9-upload";
export { ConnectedPaymentReview } from "./payment-review";
export type { ConnectedPaymentReviewProps, PaymentReviewRange } from "./payment-review";
export type { PaymentReviewItem, PaymentReviewQuery, PaymentReviewResult } from "./billing-operations-client";
export type { OrganizationOnboardingProps } from "./organization-onboarding";

export { ConnectedNotificationSettings, NotificationSettings } from "./notification-settings";
export { ConnectedNotificationRecipientsSettings, NotificationRecipientsSettings } from "./notification-recipients";
export type { NotificationRecipient, NotificationRecipientInvitation, NotificationRecipientsAdapter, NotificationRecipientsSettingsProps, NotificationRecipientsSnapshot } from "./notification-recipients";
export type { NotificationReportDigest } from "./notification-settings";
export type {
  NotificationAgingDay,
  NotificationPreferences,
  NotificationSettingsAdapter,
  NotificationSettingsProps,
  NotificationSettingsSnapshot,
  NotificationSettingsUpdate,
} from "./notification-settings";

export {
  ConnectedBillStatus,
  createBillStatusClient,
  useBillStatus,
} from "./connected-bill-status";
export type {
  BillClaimsAdministratorSource,
  BillReviewPayerOption,
  BillReviewPayerSuggestion,
  BrowserBillSubmissionResult,
} from "@mindbill/browser";

export {
  BillActivityTimeline,
  BillExplanationOfReview,
  BillHistoryTable,
  BillLifecycleActions,
  BillLifecycleProgress,
  BillRejectionNotice,
  BillPaymentLedger,
  BillPayerContactCard,
  BillRemittanceCard,
  BillSnapshotSummary,
  billLifecycleDisplayLabel,
  billLifecycleStage,
} from "./bill-lifecycle-surfaces";
export type {
  BillActivityEvent,
  BillActivityTimelineProps,
  BillEorSubmission,
  BillEorContextItem,
  BillHistoryTableProps,
  BillExplanationOfReviewProps,
  BillLifecycleActionsProps,
  BillLifecycleProgressProps,
  BillLifecycleProgressStepsOptions,
  BillRejectionNoticeProps,
  BillLifecycleStage,
  BillPaymentLedgerProps,
  BillPayerContactCardProps,
  BillRemittanceCardProps,
  BillSnapshotSummaryProps,
} from "./bill-lifecycle-surfaces";

export { ConnectedBillLifecycle, createBillLifecycleClient, useBillLifecycle } from "./connected-bill-lifecycle";
export { ClaimsAdministratorDirectoryDialog } from "./claims-administrator-directory-dialog";
export type { ClaimsAdministratorDirectoryDialogProps } from "./claims-administrator-directory-dialog";
export { SecondReviewForm } from "./second-review-form";
export type { SecondReviewFormProps } from "./second-review-form";
export type {
  BillClaimsAdministratorContact,
  BillClaimsAdministratorDirectory,
  BillClaimsAdministratorMailingAddress,
  BillClaimsAdministratorPayer,
  BillClaimsAdministratorPattern,
  BillEorDocument,
  BillActivityRecord,
  BillLifecycleAction,
  BillLifecycleActionId,
  BillLifecycleClient,
  BillLifecycleClientOptions,
  BillLifecycleData,
  BillSubmissionDetail,
  HistoricalBillReviewData,
  BillLifecycleDelivery,
  BillLifecycleSession,
  BillLifecycleSessionProvider,
  BillLifecycleSessionRequest,
  BillPaymentRecord,
  BillRemittanceSummary,
  BillRejection,
  CloseBillInput,
  ConnectedBillLifecycleProps,
  PostBillPaymentInput,
  ReopenBillInput,
  ReportBillStatusContacts,
  SecondReviewDeadline,
  SendDuplicateBillInput,
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

export {
  ConnectedBillingWorkspace,
  ConnectedBillSearch,
  ConnectedBillTasksDashboard,
  ConnectedProductivityReport,
  ConnectedServiceLineItemsReport,
} from "./connected-billing-workspace";
export type {
  ConnectedBillingWorkspaceProps,
  ConnectedBillSearchProps,
  ConnectedBillTasksDashboardProps,
} from "./connected-billing-workspace";
export { createBillingOperationsClient } from "./billing-operations-client";
export type {
  BillingOperationsClient,
  BillingOperationsClientOptions,
  BillRegistryAge,
  BillRegistryItem,
  BillRegistryQuery,
  BillRegistryResult,
  BillRegistrySort,
  BillRegistryStatus,
  BillTasksResult,
  ProductivityReport,
  ServiceLineItemsReport,
} from "./billing-operations-client";

export { DentalDraftEditor, dentalDraftChargeSummary, parseDentalCharge, validateDentalDraftContent } from "./dental-draft-editor";
export type { DentalDraftContentInput, DentalDraftLineInput, DentalDraftEditorProps, DentalAttestationsInput, DentalConsentInput, DentalAdaFormInput, DentalOrthodonticsInput, DentalProsthesisInput } from "./dental-draft-editor";
export { RfaDraftForm, normalizeRfaDraft, validateRfaDraft } from "./rfa-draft-form";
export type { RfaDraftInput, RfaDraftItemInput, RfaDraftFormProps } from "./rfa-draft-form";

export type { RfaTreatmentTemplate, RfaTreatmentTemplateInput } from "./rfa-template-bar";

export { RfaAuthorizationDestination } from "./rfa-authorization-destination";
export type { RfaAuthorizationDestinationProps } from "./rfa-authorization-destination";
export type { BillClaimsAdministratorAuthorizationStatus, RfaAuthorizationDestinationOption } from "@mindbill/browser";

export { RfaDashboard } from "./rfa-dashboard";
export { ConnectedTreatmentBillForm } from "./connected-treatment-bill-form";
export type { ConnectedTreatmentBillFormProps } from "./connected-treatment-bill-form";
export type { RfaDashboardProps, RfaDashboardNavigation } from "./rfa-dashboard";

export type { RfaForwardContact } from "./rfa-duplicate-dialog";
export type { RfaRecord, RfaSigningPreview, RfaCreateDraftInput } from "@mindbill/browser";

export { RfaLifecycleControls } from "./rfa-lifecycle-controls";
export type { RfaLifecycleControlsProps } from "./rfa-lifecycle-controls";
export { ReportAutofill } from "./report-autofill";
export type { ReportAutofillProps } from "./report-autofill";

export { applyReportAutofill } from "./report-autofill-values";

export type { ClaimForm, BillFormValue, BillFormData, BillLineFormData, BilledDrug } from "@mindbill/browser";

export { RfaDraftActions } from "./rfa-draft-actions";
export type { RfaDraftActionsProps } from "./rfa-draft-actions";

export { RfaPacketsPanel } from "./rfa-packets";
export type { RfaPacketsPanelProps } from "./rfa-packets";

export { RfaTaskBoard } from "./rfa-task-board";
export type { RfaTaskBoardProps, RfaTaskQuery, RfaTaskState, RfaTaskAge } from "./rfa-task-board";

export type { RfaClaimSelectorProps, RfaProviderSelectorProps } from "./rfa-create-form";

export { BillUrDecisions, claimRfaCounts, claimRfaLifecycle, RelatedAuthorizationRecords, RfaClaimIndex, rfaReference } from "./rfa-records";
export type { BillUrDecisionsProps, RelatedAuthorizationRecordsProps, RfaClaimIndexProps } from "./rfa-records";
export type { BillUrDecision, BillUrDecisionsAttachInput, BillUrDecisionsAttachResult, BillUrDecisionsResult, ClaimRfaSummary, LinkedRfaEvidence, RelatedAuthorizationRecord, RelatedAuthorizationResult, RfaEvidenceState } from "@mindbill/browser";
