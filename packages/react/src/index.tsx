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
export function MindBillBillFromReport(
  props: MindBillWidgetProps,
): ReactElement {
  return widget("mindbill-bill-from-report", props);
}
export function MindBillCollections(props: MindBillWidgetProps): ReactElement {
  return widget("mindbill-collections", props);
}
export function MindBillOnboarding(props: MindBillWidgetProps): ReactElement {
  return widget("mindbill-onboarding", props);
}

export const HostedBillTimeline = MindBillBillTimeline;
export const HostedBillReview = MindBillBillReview;
export const HostedBillFromReport = MindBillBillFromReport;
export const HostedCollections = MindBillCollections;
export const HostedOnboarding = MindBillOnboarding;

export type {
  MindBillAppearance,
  MindBillErrorDetail,
  MindBillEventDetail,
} from "@mindbill/embed";

export {
  BillReviewForm,
  BillStatusSummary,
  buildBillReviewSaveInput,
} from "./native-bill-review";
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
  ConnectedBillStatus,
  createBillStatusClient,
  useBillStatus,
} from "./connected-bill-status";

export {
  ConnectedBillLifecycle,
  createBillLifecycleClient,
  useBillLifecycle,
} from "./connected-bill-lifecycle";
export type {
  BillEorDocument,
  BillLifecycleAction,
  BillLifecycleActionId,
  BillLifecycleClient,
  BillLifecycleClientOptions,
  BillLifecycleData,
  BillLifecycleSession,
  BillLifecycleSessionProvider,
  BillLifecycleSessionRequest,
  CloseBillInput,
  ConnectedBillLifecycleProps,
  PostBillPaymentInput,
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
