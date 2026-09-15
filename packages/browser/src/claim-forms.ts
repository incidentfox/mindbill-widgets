/** Public claim capture contracts. These types do not certify clearinghouse acceptance. */
export type ClaimForm = "cms1500" | "ub04" | "ada" | "ncpdp";
export const CLAIM_FORM_LABELS: Record<ClaimForm, string> = {
  cms1500: "CMS-1500 · Professional", ub04: "UB-04 · Institutional",
  ada: "ADA · Dental", ncpdp: "NCPDP · Pharmacy",
};
export type ClaimProvider = { firstName: string; lastName: string; npi: string };
export type ClaimDiagnosis = { code: string; presentOnAdmission?: "Y" | "N" | "U" | "W" | "1" };
export type InstitutionalFormData = {
  typeOfBill?: string; statementFrom?: string; statementTo?: string;
  medicalRecordNumber?: string; facilityMedicareId?: string; facilityLicenseNumber?: string;
  admissionDate?: string; admissionHour?: string; admissionType?: string; admissionSource?: string;
  dischargeHour?: string; patientStatus?: string; creationDate?: string;
  principalDiagnosis?: ClaimDiagnosis; admittingDiagnosis?: string; otherDiagnoses?: ClaimDiagnosis[];
  patientReasonForVisit?: string[]; externalCauseOfInjury?: string[]; ppsCode?: string;
  attendingProvider?: ClaimProvider; operatingProvider?: ClaimProvider; otherProviders?: ClaimProvider[];
  employerDivision?: string; employerWorkAddress?: string; attachmentCodes?: string[];
  conditionCodes?: string[]; occurrenceCodes?: { code: string; date: string }[];
  occurrenceSpans?: { code: string; from: string; to: string }[];
  valueCodes?: { code: string; amount: number }[];
  procedures?: { code: string; date: string; principal?: boolean }[];
};
export type DentalFormData = {
  diagnosisCodes?: string[]; treatmentStartDate?: string; treatmentCompletionDate?: string;
  orthodontic?: boolean; appliancePlacementDate?: string; monthsOfTreatment?: number;
  remainingTreatmentMonths?: number; replacementProsthesis?: boolean; priorProsthesisDate?: string;
  missingTeeth?: string[]; employerStreet?: string; employerCity?: string; employerState?: string;
  employerZip?: string; employerPhone?: string; providerSignatureDate?: string;
};
/** Keep decimal strings intact, including trailing zeros and all three decimal places. */
export type CompoundIngredient = {
  name?: string; ndcNumber?: string; metricQuantity?: string; ingredientCost?: string;
  basisOfCostDetermination?: string;
};
export type PharmacyCompound = {
  name?: string; dosageFormCode?: string; dispensingUnitCode?: string; routeOfAdministration?: string;
  metricQuantity?: string; unitOfMeasure?: "UN" | "ML" | "GR"; ingredients?: CompoundIngredient[];
};
export type PharmacyFormData = {
  prescriber?: ClaimProvider & { street?: string; city?: string; state?: string; zip?: string; phone?: string };
  pharmacyServiceType?: string; creationDate?: string; priorAuthorizationType?: string;
  otherCoverageCode?: string; providerSignatureDate?: string;
  employerStreet?: string; employerCity?: string; employerState?: string; employerZip?: string;
  paperPricing?: {
    ingredientCost?: number; dispensingFee?: number; otherAmount?: number; salesTax?: number;
    patientPaid?: number; otherPayerPaid?: number; otherPayerPatientResponsibility?: number;
  };
  paperDetails?: {
    employerPhone?: string; employerContactName?: string; originalManufacturerNdc?: string;
    submissionClarificationCode?: string; prescriptionOriginCode?: string; productStrength?: string;
    delayReasonCode?: string; otherPayerId?: string; otherPayerIdQualifier?: string; otherPayerDate?: string;
    otherPayerRejectCodes?: string[]; reasonForServiceCode?: string; professionalServiceCode?: string;
    resultOfServiceCode?: string; levelOfEffort?: string;
  };
};
export type BillFormData = {
  institutional?: InstitutionalFormData; dental?: DentalFormData; pharmacy?: PharmacyFormData;
};
export type BillItemFormData = {
  institutional?: { revenueCode?: string; unitCode?: "UN" | "DA"; nonCoveredCharge?: number; dawCode?: string };
  dental?: { diagnosisCodes?: string[]; oralCavity?: string; toothNumber?: string; toothSurfaces?: string[]; prosthesis?: "I" | "R" };
  pharmacy?: {
    prescriptionNumber?: string; fillNumber?: number; daysSupply?: number; fillsRemaining?: number;
    dispensedDate?: string; writtenDate?: string; dawCode?: string; compoundCode?: "1" | "2";
    usualAndCustomaryCharge?: number; basisOfCostDetermination?: string; compound?: PharmacyCompound;
  };
};

export type BilledDrug = {
  ndcNumber: string;
  metricQuantity: string;
  unitOfMeasure: "UN" | "ML" | "GR";
  administered?: {
    drugName: string;
    administeredAmount: string;
    doseUnit: "mg" | "mcg" | "g" | "mL" | "units";
    hcpcsCode: string;
    amountPerHcpcsUnit: string;
    amountPerNdcUnit: string;
    hcpcsUnitSource: string;
    productLabelSource: string;
    unitDefinitionsVerified: true;
  };
};
