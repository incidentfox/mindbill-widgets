// Presentation only. The quote status, amounts and submission checks remain authoritative.
const messages: Record<string, string> = {
  therapy_initial_evaluation_episode_history_requires_review: "The initial evaluation history for this care episode needs review, including evaluations on earlier dates.",
  therapy_initial_evaluation_one_unit_required: "An initial PT evaluation requires one unit; duration does not determine units.",
  therapy_initial_evaluation_sole_service_required: "An initial PT evaluation with other same-day services requires fee review.",
  therapy_evaluation_date_outside_verified_coverage: "This initial PT evaluation date is outside the currently verified schedule coverage.",
  therapy_no_fee_agreement_confirmation_required: "The therapy service details and any fee agreement need review before an estimate is available.",
  therapy_modifiers_not_supported: "These therapy modifiers need fee review before an estimate is available.",
  therapy_procedure_ground_rules_not_implemented: "This therapy service needs fee review before an estimate is available.",
  therapy_one_to_four_units_required: "Enter one to four therapy units for this estimate, or request fee review.",
  therapy_exact_fifteen_minute_units_required: "The therapy minutes and units need review before an estimate is available.",
  ordinary_office_physical_therapist_context_required: "Confirm the treating provider and service setting before requesting a therapy estimate.",
  complete_single_visit_same_day_therapy_context_required: "The other therapy services provided during this visit need fee review.",
  conflicting_therapy_context: "The therapy service details conflict and need review.",
  invalid_date_of_service: "Enter a valid service date to estimate the fee.",
  invalid_or_nonpositive_charge: "Enter a positive charge to estimate the fee.",
  telehealth_modifier_requires_ground_rule_review: "This telehealth modifier needs fee review for the service date.",
  conflicting_telehealth_modifiers: "Review the telehealth modifiers; the selected modes conflict.",
  telehealth_modifier_93_not_adopted_for_date: "Audio-only modifier 93 is not adopted for this service date. Review the dated telehealth rules.",
  telehealth_modifier_required: "Select the telehealth modifier that matches the service and its date.",
  timed_testing_add_on_requires_primary_service: "Add the first-hour or first-30-minute testing code for the same date; this code is billed only with it.",
  timed_testing_units_exceed_adopted_mue: "The units are above the daily limit for this code. Lower the units, or submit with documentation for review.",
  timed_testing_unit_limit_unverified: "The daily unit limit for this code could not be confirmed for this service date.",
  timed_testing_indicators_or_modifiers_require_review: "Remove the modifiers from this testing code to get an automatic fee, or submit it for review.",
  modifier_requires_ground_rule_review: "This modifier changes how the fee is calculated and needs review.",
  physician_service_context_required_or_adjustment_not_supported: "This service is billed with other same-day services and needs fee review.",
  separate_schedule_or_payment_formula_required: "This code is paid under a separate schedule and needs fee review.",
};

export function feeReviewMessage(reason: string | undefined): string {
  if (!reason) return "Checking the fee schedule…";
  if (Object.prototype.hasOwnProperty.call(messages, reason)) return messages[reason]!;
  // Future API reason codes must not become long, unexplained identifiers in the UI.
  if (/^[a-z][a-z0-9]*_[a-z0-9_]+$/i.test(reason)) return "This service needs fee review before an estimate is available.";
  return reason;
}
