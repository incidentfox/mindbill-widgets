import type {
  BillSubmissionDiagnosisOption,
  BillSubmissionModifierOption,
  BillSubmissionProcedureOption,
  BillSubmissionTaxonomyOption,
} from "./bill-submission-form";

/** Public-domain and MindBill-owned metadata. CPT descriptions are intentionally limited to the curated catalog. */
export const DEFAULT_BILL_SUBMISSION_PROCEDURES: BillSubmissionProcedureOption[] = [
  { code: "ML200", description: "Missed appointment for a medical-legal evaluation", allowedAmount: 503.75 },
  { code: "ML201", description: "Comprehensive medical-legal evaluation", allowedAmount: 2015 },
  { code: "ML202", description: "Follow-up medical-legal evaluation", allowedAmount: 1316.25 },
  { code: "ML203", description: "Supplemental medical-legal evaluation", allowedAmount: 650 },
  { code: "ML204", description: "Medical-legal testimony", allowedAmount: 113.75 },
  { code: "ML205", description: "Review of sub rosa recordings", allowedAmount: 81.25 },
  { code: "MLPRR", description: "Medical-legal record review", allowedAmount: 3 },
  { code: "90791", description: "Psychiatric diagnostic evaluation" },
  { code: "90792", description: "Psychiatric diagnostic evaluation with medical services" },
  { code: "90832", description: "Psychotherapy, 30 minutes" },
  { code: "90834", description: "Psychotherapy, 45 minutes" },
  { code: "90837", description: "Psychotherapy, 60 minutes" },
  { code: "90846", description: "Family psychotherapy without patient" },
  { code: "90847", description: "Family psychotherapy with patient" },
  { code: "90853", description: "Group psychotherapy" },
  { code: "90785", description: "Interactive complexity" },
  { code: "90833", description: "Psychotherapy add-on, 30 minutes" },
  { code: "90836", description: "Psychotherapy add-on, 45 minutes" },
  { code: "90838", description: "Psychotherapy add-on, 60 minutes" },
  { code: "99202", description: "New patient office visit, level 2" },
  { code: "99203", description: "New patient office visit, level 3" },
  { code: "99204", description: "New patient office visit, level 4" },
  { code: "99205", description: "New patient office visit, level 5", allowedAmount: 349.48 },
  { code: "99211", description: "Established patient office visit, level 1" },
  { code: "99212", description: "Established patient office visit, level 2" },
  { code: "99213", description: "Established patient office visit, level 3" },
  { code: "99214", description: "Established patient office visit, level 4" },
  { code: "99215", description: "Established patient office visit, level 5" },
  { code: "96130", description: "Psychological testing evaluation, first hour" },
  { code: "96131", description: "Psychological testing evaluation, each additional hour", allowedAmount: 131.96 },
  { code: "96136", description: "Psychological or neuropsychological testing, first 30 minutes" },
  { code: "96137", description: "Psychological or neuropsychological testing, each additional 30 minutes" },
  { code: "97161", description: "Physical therapy evaluation, low complexity" },
  { code: "97162", description: "Physical therapy evaluation, moderate complexity" },
  { code: "97163", description: "Physical therapy evaluation, high complexity" },
  { code: "97110", description: "Therapeutic exercises" },
  { code: "97112", description: "Neuromuscular reeducation" },
  { code: "97140", description: "Manual therapy techniques" },
  { code: "97530", description: "Therapeutic activities" },
  { code: "98940", description: "Chiropractic manipulative treatment, 1-2 regions" },
  { code: "98941", description: "Chiropractic manipulative treatment, 3-4 regions" },
  { code: "98942", description: "Chiropractic manipulative treatment, 5 regions" },
  { code: "72100", description: "Spine radiograph, lumbosacral, 2-3 views" },
  { code: "73030", description: "Shoulder radiograph, complete" },
  { code: "72141", description: "MRI cervical spine without contrast" },
  { code: "72148", description: "MRI lumbar spine without contrast" },
  { code: "73721", description: "MRI lower-extremity joint without contrast" },
  { code: "20610", description: "Major joint injection or aspiration" },
  { code: "20552", description: "Trigger point injection, 1-2 muscles" },
  { code: "64483", description: "Transforaminal epidural injection, lumbar or sacral" },
  { code: "64635", description: "Destruction by neurolytic agent, paravertebral facet joint nerve" },
  { code: "99070", description: "Supplies and materials" },
  { code: "L0650", description: "Lumbar orthosis" },
  { code: "A4556", description: "Electrodes" },
];

export const DEFAULT_BILL_SUBMISSION_MODIFIERS: BillSubmissionModifierOption[] = [
  { code: "92", description: "Primary Treating Physician evaluation" },
  { code: "93", description: "Interpreter required" },
  { code: "94", description: "Agreed Medical Evaluator" },
  { code: "95", description: "Qualified Medical Evaluator" },
  { code: "96", description: "Psychiatric/psychological evaluation" },
  { code: "97", description: "Toxicology evaluation" },
  { code: "98", description: "Oncology evaluation" },
  { code: "AA", description: "Anesthesia personally performed by the physician" },
  { code: "QK", description: "Physician medical direction of concurrent anesthesia cases" },
  { code: "QS", description: "Monitored anesthesia care" },
  { code: "25", description: "Significant, separately identifiable same-day evaluation and management service" },
  { code: "GP", description: "Services under a physical therapy plan of care" },
  { code: "GO", description: "Services under an occupational therapy plan of care" },
  { code: "GN", description: "Services under a speech-language pathology plan of care" },
  { code: "CQ", description: "Physical therapist assistant services (with GP)" },
  { code: "CO", description: "Occupational therapy assistant services (with GO)" },
  { code: "26", description: "Professional component" },
  { code: "TC", description: "Technical component" },
  { code: "NU", description: "New equipment purchase" },
  { code: "UE", description: "Used equipment purchase" },
  { code: "RR", description: "Equipment rental" },
  { code: "KH", description: "Initial equipment purchase or first rental month" },
  { code: "KI", description: "Second or third rental month" },
  { code: "KJ", description: "Subsequent rental months" },
  { code: "59", description: "Distinct procedural service" },
  { code: "XE", description: "Separate encounter" },
  { code: "XS", description: "Separate structure" },
  { code: "XP", description: "Separate practitioner" },
  { code: "XU", description: "Unusual non-overlapping service" },
];

/**
 * CPT and HCPCS Level II modifiers offered on treatment (professional) lines in addition to the defaults:
 * anatomic (LT/RT, digits, eyelids, coronary), surgical, repeat/distinct, drug waste (JW/JZ), telehealth and
 * payer-liability modifiers. Medical-legal lines keep only the medical-legal defaults.
 */
export const BILL_SUBMISSION_PROFESSIONAL_MODIFIERS: BillSubmissionModifierOption[] = [
  { code: "22", description: "Increased procedural services" },
  { code: "23", description: "Unusual anesthesia" },
  { code: "24", description: "Unrelated E/M service during a postoperative period" },
  { code: "27", description: "Multiple outpatient hospital E/M encounters on the same date" },
  { code: "32", description: "Mandated services" },
  { code: "33", description: "Preventive services" },
  { code: "47", description: "Anesthesia by surgeon" },
  { code: "50", description: "Bilateral procedure" },
  { code: "51", description: "Multiple procedures" },
  { code: "52", description: "Reduced services" },
  { code: "53", description: "Discontinued procedure" },
  { code: "54", description: "Surgical care only" },
  { code: "55", description: "Postoperative management only" },
  { code: "56", description: "Preoperative management only" },
  { code: "57", description: "Decision for surgery" },
  { code: "58", description: "Staged or related procedure during the postoperative period" },
  { code: "62", description: "Two surgeons" },
  { code: "63", description: "Procedure performed on infants less than 4 kg" },
  { code: "66", description: "Surgical team" },
  { code: "76", description: "Repeat procedure by the same physician" },
  { code: "77", description: "Repeat procedure by another physician" },
  { code: "78", description: "Unplanned return to the operating room during the postoperative period" },
  { code: "79", description: "Unrelated procedure during the postoperative period" },
  { code: "80", description: "Assistant surgeon" },
  { code: "81", description: "Minimum assistant surgeon" },
  { code: "82", description: "Assistant surgeon (qualified resident surgeon not available)" },
  { code: "90", description: "Reference (outside) laboratory" },
  { code: "91", description: "Repeat clinical diagnostic laboratory test" },
  { code: "99", description: "Multiple modifiers" },
  { code: "AS", description: "Physician assistant, nurse practitioner or clinical nurse specialist assistant at surgery" },
  { code: "AT", description: "Acute treatment (chiropractic manipulation)" },
  { code: "CR", description: "Catastrophe or disaster related" },
  { code: "CS", description: "Cost-sharing waived for specified COVID-19 testing-related services" },
  { code: "E1", description: "Upper left eyelid" },
  { code: "E2", description: "Lower left eyelid" },
  { code: "E3", description: "Upper right eyelid" },
  { code: "E4", description: "Lower right eyelid" },
  { code: "FA", description: "Left hand, thumb" },
  { code: "F1", description: "Left hand, second digit" },
  { code: "F2", description: "Left hand, third digit" },
  { code: "F3", description: "Left hand, fourth digit" },
  { code: "F4", description: "Left hand, fifth digit" },
  { code: "F5", description: "Right hand, thumb" },
  { code: "F6", description: "Right hand, second digit" },
  { code: "F7", description: "Right hand, third digit" },
  { code: "F8", description: "Right hand, fourth digit" },
  { code: "F9", description: "Right hand, fifth digit" },
  { code: "GA", description: "Waiver of liability statement issued as required by payer policy" },
  { code: "GC", description: "Performed in part by a resident under the direction of a teaching physician" },
  { code: "GE", description: "Performed by a resident without a teaching physician present (primary care exception)" },
  { code: "GT", description: "Interactive audio and video telecommunications" },
  { code: "GX", description: "Notice of liability issued, voluntary under payer policy" },
  { code: "GY", description: "Statutorily excluded or not a defined benefit" },
  { code: "GZ", description: "Expected to be denied as not reasonable and necessary" },
  { code: "JA", description: "Drug administered intravenously" },
  { code: "JB", description: "Drug administered subcutaneously" },
  { code: "JW", description: "Drug amount discarded, not administered to any patient" },
  { code: "JZ", description: "Zero drug amount discarded" },
  { code: "KX", description: "Requirements in the medical policy have been met" },
  { code: "LT", description: "Left side" },
  { code: "RT", description: "Right side" },
  { code: "LC", description: "Left circumflex coronary artery" },
  { code: "LD", description: "Left anterior descending coronary artery" },
  { code: "LM", description: "Left main coronary artery" },
  { code: "RC", description: "Right coronary artery" },
  { code: "RI", description: "Ramus intermedius coronary artery" },
  { code: "Q5", description: "Substitute physician, reciprocal billing arrangement" },
  { code: "Q6", description: "Substitute physician, fee-for-time arrangement (locum tenens)" },
  { code: "QW", description: "CLIA-waived test" },
  { code: "SA", description: "Nurse practitioner rendering service in collaboration with a physician" },
  { code: "SB", description: "Nurse midwife" },
  { code: "SH", description: "Second concurrently administered infusion therapy" },
  { code: "TA", description: "Left foot, great toe" },
  { code: "T1", description: "Left foot, second digit" },
  { code: "T2", description: "Left foot, third digit" },
  { code: "T3", description: "Left foot, fourth digit" },
  { code: "T4", description: "Left foot, fifth digit" },
  { code: "T5", description: "Right foot, great toe" },
  { code: "T6", description: "Right foot, second digit" },
  { code: "T7", description: "Right foot, third digit" },
  { code: "T8", description: "Right foot, fourth digit" },
  { code: "T9", description: "Right foot, fifth digit" },
  { code: "UN", description: "Two patients served" },
  { code: "UP", description: "Three patients served" },
  { code: "UQ", description: "Four patients served" },
  { code: "UR", description: "Five patients served" },
  { code: "US", description: "Six or more patients served" },
];

/** Common NUCC provider taxonomies. Consumers can extend this catalog through taxonomyOptions. */
export const DEFAULT_BILL_SUBMISSION_TAXONOMIES: BillSubmissionTaxonomyOption[] = [
  { code: "103G00000X", description: "Clinical Neuropsychologist" },
  { code: "103T00000X", description: "Psychologist" },
  { code: "111N00000X", description: "Chiropractor" },
  { code: "122300000X", description: "Dentist" },
  { code: "133V00000X", description: "Dietitian, Registered" },
  { code: "163W00000X", description: "Registered Nurse" },
  { code: "183500000X", description: "Pharmacist" },
  { code: "207L00000X", description: "Anesthesiology" },
  { code: "207P00000X", description: "Emergency Medicine" },
  { code: "207Q00000X", description: "Family Medicine" },
  { code: "207R00000X", description: "Internal Medicine" },
  { code: "207RC0000X", description: "Cardiovascular Disease" },
  { code: "207RN0300X", description: "Nephrology" },
  { code: "207RP1001X", description: "Pulmonary Disease" },
  { code: "207RR0500X", description: "Rheumatology" },
  { code: "207T00000X", description: "Neurological Surgery" },
  { code: "207X00000X", description: "Orthopaedic Surgery" },
  { code: "207XS0117X", description: "Orthopaedic Surgery of the Spine" },
  { code: "207Y00000X", description: "Otolaryngology" },
  { code: "208000000X", description: "Pediatrics" },
  { code: "208100000X", description: "Physical Medicine & Rehabilitation" },
  { code: "2083X0100X", description: "Occupational Medicine" },
  { code: "2084N0400X", description: "Neurology" },
  { code: "2084P0800X", description: "Psychiatry" },
  { code: "2084P0802X", description: "Addiction Psychiatry" },
  { code: "2084P0804X", description: "Child & Adolescent Psychiatry" },
  { code: "2084S0012X", description: "Sleep Medicine" },
  { code: "2085R0202X", description: "Diagnostic Radiology" },
  { code: "208600000X", description: "Surgery" },
  { code: "2086S0105X", description: "Surgery of the Hand" },
  { code: "208D00000X", description: "General Practice" },
  { code: "208M00000X", description: "Hospitalist" },
  { code: "208VP0000X", description: "Pain Medicine" },
  { code: "213E00000X", description: "Podiatrist" },
  { code: "225100000X", description: "Physical Therapist" },
  { code: "225X00000X", description: "Occupational Therapist" },
  { code: "363A00000X", description: "Physician Assistant" },
  { code: "363L00000X", description: "Nurse Practitioner" },
];

export const BILL_SUBMISSION_DIAGNOSIS_QUICK_PICKS: Array<BillSubmissionDiagnosisOption & { label: string }> = [
  { label: "Psych", code: "Z04.6", description: "General psychiatric examination requested by authority" },
  { label: "Back", code: "M54.50", description: "Low back pain, unspecified" },
  { label: "Neck", code: "M54.2", description: "Cervicalgia" },
  { label: "Left hand", code: "M79.642", description: "Pain in left hand" },
  { label: "Right hand", code: "M79.641", description: "Pain in right hand" },
  { label: "Left knee", code: "M25.562", description: "Pain in left knee" },
  { label: "Right knee", code: "M25.561", description: "Pain in right knee" },
];

const COMPOSITE_MULTIPLIERS: Record<string, number> = {
  "93+94+96": 2.45, "93+94+97": 1.95, "93+94+98": 1.95,
  "92+93": 1.1, "93+95": 1.1, "93+94": 1.45, "93+96": 2.1,
  "93+97": 1.6, "93+98": 1.6, "94+96": 2.35, "94+97": 1.85, "94+98": 1.85,
};

const MED_LEGAL_MODIFIER_MULTIPLIERS: Record<string, number> = {
  "92": 1,
  "93": 1.1,
  "94": 1.35,
  "95": 1,
  "96": 2,
  "97": 1.5,
  "98": 1.5,
};

/** 8 CCR §9795(d): the procedure codes each medical-legal modifier may modify. */
export const MED_LEGAL_MODIFIER_CODES: Readonly<Record<string, readonly string[]>> = {
  "92": ["ML201", "ML202", "ML203"],
  // Interpreter: "This modifier shall only be applicable to ML-201 and ML-202."
  "93": ["ML201", "ML202"],
  "94": ["ML201", "ML202", "ML203"],
  // Identification only; ML200 and MLPRR carry it by established billing practice.
  "95": ["ML200", "ML201", "ML202", "ML203", "MLPRR"],
  "96": ["ML201", "ML202", "ML203"],
  "97": ["ML201", "ML202", "ML203"],
  "98": ["ML201", "ML202", "ML203"],
};

/** Modifiers outside the table (CPT modifiers) are not restricted here. */
export function medicalLegalModifierApplies(modifier: string, code: string): boolean {
  const codes = MED_LEGAL_MODIFIER_CODES[modifier.replace(/^-/, "").toUpperCase()];
  return !codes || codes.includes(code.trim().toUpperCase());
}

function medicalLegalMultiplier(modifiers: string[]): number {
  const priced = modifiers.filter((item) => MED_LEGAL_MODIFIER_MULTIPLIERS[item] !== 1);
  if (priced.length === 0) return 1;
  const composite = COMPOSITE_MULTIPLIERS[priced.join("+")];
  if (composite != null) return composite;
  return priced.reduce((total, item) => total * (MED_LEGAL_MODIFIER_MULTIPLIERS[item] ?? 1), 1);
}

export function calculateBillSubmissionAllowedAmount(
  line: { code: string; modifiers?: string[]; units?: number },
  procedures: BillSubmissionProcedureOption[] = DEFAULT_BILL_SUBMISSION_PROCEDURES,
): number | undefined {
  const procedure = procedures.find((item) => item.code.toUpperCase() === line.code.trim().toUpperCase());
  if (procedure?.allowedAmount == null) return undefined;
  const code = procedure.code.toUpperCase();
  const units = Math.max(1, line.units ?? 1);
  const normalized = [...new Set((line.modifiers ?? []).map((item) => item.replace(/^-/, "").toUpperCase()))]
    .filter((item) => medicalLegalModifierApplies(item, code)).sort();
  const multiplier = ["ML200", "ML201", "ML202", "ML203"].includes(code)
    ? medicalLegalMultiplier(normalized)
    : 1;
  return Math.round(procedure.allowedAmount * units * multiplier * 100) / 100;
}

/** Internal form catalog: supplied descriptions override the contextual defaults. */
export function billSubmissionModifierOptions(
  medicalLegal: boolean,
  serviceDate: string | undefined,
  supplied: BillSubmissionModifierOption[] | undefined,
): BillSubmissionModifierOption[] {
  const historicalTelehealth = !!serviceDate && /^\d{4}-\d{2}-\d{2}$/.test(serviceDate) && serviceDate < "2025-02-01";
  const defaults = [...DEFAULT_BILL_SUBMISSION_MODIFIERS, ...(medicalLegal ? [] : BILL_SUBMISSION_PROFESSIONAL_MODIFIERS)]
    .filter((item) => medicalLegal || !["92", "94", "98"].includes(item.code))
    .map((item) => {
      if (medicalLegal) return item;
      if (item.code === "93") return { ...item, description: "Audio-only telehealth (from February 1, 2025)" };
      if (item.code === "96") return { ...item, description: "Habilitative services" };
      if (item.code === "97") return { ...item, description: "Rehabilitative services" };
      if (item.code === "95") return { ...item, description: historicalTelehealth
        ? "Telehealth — audio-only or audio/video, subject to service eligibility"
        : serviceDate ? "Real-time audio/video telehealth" : "Telehealth — modality depends on the service date" };
      return item;
    });
  const options = new Map(defaults.map((item) => [item.code.toUpperCase(), item]));
  supplied?.forEach((item) => options.set(item.code.toUpperCase(), item));
  return [...options.values()];
}
