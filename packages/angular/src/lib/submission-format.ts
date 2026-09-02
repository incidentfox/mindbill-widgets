/** Date helpers shared by the Angular submission surfaces. Mirrors the React
 * package's parseBillSubmissionDate/formatBillSubmissionDate exactly so both
 * frameworks accept and render the same values. */

export function parseMindBillSubmissionDate(value: string): string | undefined {
  const trimmed = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  const us = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);
  const digits = /^(\d{2})(\d{2})(\d{4})$/.exec(trimmed.replace(/\D/g, ""));
  const match = iso ? [iso[2], iso[3], iso[1]] : us ? [us[1], us[2], us[3]] : digits ? [digits[1], digits[2], digits[3]] : null;
  if (!match) return undefined;
  const month = Number(match[0]);
  const day = Number(match[1]);
  const year = Number(match[2]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatMindBillSubmissionDate(value: string | null | undefined): string {
  const parsed = value ? parseMindBillSubmissionDate(value) : undefined;
  if (!parsed) return "";
  const [year, month, day] = parsed.split("-");
  return `${month}/${day}/${year}`;
}

export type MindBillProcedureComboOption = { id: string; label: string; detail?: string };

/** Accepts complete CPT (5 digits), HCPCS (letter + 4 digits), or California
 * medical-legal codes typed directly into the procedure picker. */
export function mindBillCustomProcedureOption(query: string): MindBillProcedureComboOption | null {
  const code = query.trim().toUpperCase().replace(/\s+/g, "");
  if (!/^(?:\d{5}|[A-Z]\d{4}|ML(?:20[0-5]|PRR))$/.test(code)) return null;
  return { id: code, label: code, detail: "Use this CPT, HCPCS, or medical-legal code" };
}
