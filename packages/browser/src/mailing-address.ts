// Structured mailing-address helpers shared by the React and Angular send forms.
// The partner API still takes one `destination.mailingAddress` string; these
// split an on-file address into fields for editing and compose the fields back
// into the single-line form `line1[, line2], City, ST ZIP`.

/** One mailing address split into the fields a sender edits. */
export type MailingAddressParts = {
  line1: string;
  /** Suite, floor, PMB, or an attention/department line. */
  line2: string;
  city: string;
  /** Two-letter state code. */
  state: string;
  /** Five-digit ZIP or ZIP+4. */
  postalCode: string;
};

export type MailingAddressField = keyof MailingAddressParts;
export type MailingAddressErrors = Partial<Record<MailingAddressField, string>>;

export const EMPTY_MAILING_ADDRESS: MailingAddressParts = { line1: "", line2: "", city: "", state: "", postalCode: "" };

const STATE_ZIP = /^([A-Za-z]{2})\.?\s+(\d{5}(?:-?\d{4})?)$/;
const CITY_STATE_ZIP = /^(.+?)[\s,]+([A-Za-z]{2})\.?\s+(\d{5}(?:-?\d{4})?)$/;
const STREET_START = /^(?:\d|p\.?\s*o\.?\s*box\b|post\s+office\s+box\b|box\s+\d)/i;

function normalizePostalCode(zip: string): string {
  const digits = zip.replace(/\D/g, "");
  return digits.length === 9 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : zip.trim();
}

/**
 * Split a free-text address (comma- or newline-separated) into fields.
 * `complete` is false when no "City, ST ZIP" tail is found; the raw text is then
 * left in `line1` so the sender can fix it field by field.
 */
export function parseMailingAddress(raw: string | null | undefined): { parts: MailingAddressParts; complete: boolean } {
  const text = (raw ?? "").trim();
  if (!text) return { parts: { ...EMPTY_MAILING_ADDRESS }, complete: false };
  const segments = text.split(/[\n,]+/).map((segment) => segment.trim()).filter(Boolean);

  let tail = -1;
  for (let index = segments.length - 1; index >= 0; index--) {
    if (STATE_ZIP.test(segments[index]!) || CITY_STATE_ZIP.test(segments[index]!)) { tail = index; break; }
  }
  if (tail === -1) return { parts: { ...EMPTY_MAILING_ADDRESS, line1: segments.join(", ") }, complete: false };

  let city = "", state = "", postalCode = "", streetEnd = tail;
  const withCity = STATE_ZIP.test(segments[tail]!) ? null : CITY_STATE_ZIP.exec(segments[tail]!);
  if (withCity) {
    [, city, state, postalCode] = withCity as unknown as [string, string, string, string];
  } else {
    const stateZip = STATE_ZIP.exec(segments[tail]!)!;
    [, state, postalCode] = stateZip as unknown as [string, string, string];
    if (tail > 0) { city = segments[tail - 1]!; streetEnd = tail - 1; }
  }

  const street = segments.slice(0, streetEnd);
  // Lead with the street or PO box; a name/department line before it moves to line 2.
  const startIndex = street.findIndex((segment) => STREET_START.test(segment));
  const ordered = startIndex > 0 ? [...street.slice(startIndex), ...street.slice(0, startIndex)] : street;
  const parts: MailingAddressParts = {
    line1: ordered[0] ?? "",
    line2: ordered.slice(1).join(", "),
    city: city.trim(),
    state: state.toUpperCase(),
    postalCode: normalizePostalCode(postalCode),
  };
  return { parts, complete: Boolean(parts.line1 && parts.city) };
}

/** Field-level problems; an empty object means the address can be sent. */
export function validateMailingAddress(parts: MailingAddressParts): MailingAddressErrors {
  const errors: MailingAddressErrors = {};
  if (!parts.line1.trim()) errors.line1 = "Enter the street address or PO box.";
  else if (/,/.test(parts.line1) && /\b[A-Za-z]{2}\s+\d{5}/.test(parts.line1)) errors.line1 = "Put only the street or PO box here; enter city, state, and ZIP below.";
  if (!parts.city.trim()) errors.city = "Enter the city.";
  if (!/^[A-Za-z]{2}$/.test(parts.state.trim())) errors.state = "Use the 2-letter state code.";
  if (!/^\d{5}(?:-\d{4})?$/.test(parts.postalCode.trim())) errors.postalCode = "Enter a 5-digit ZIP or ZIP+4.";
  return errors;
}

export function isMailingAddressValid(parts: MailingAddressParts): boolean {
  return Object.keys(validateMailingAddress(parts)).length === 0;
}

/** Single-line `line1[, line2], City, ST ZIP` sent as `destination.mailingAddress`. */
export function composeMailingAddress(parts: MailingAddressParts): string {
  const clean = (value: string) => value.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").replace(/,+/g, " ").replace(/\s+/g, " ").trim();
  const street = [clean(parts.line1), clean(parts.line2)].filter(Boolean).join(", ");
  const tail = `${clean(parts.state).toUpperCase()} ${normalizePostalCode(clean(parts.postalCode))}`.trim();
  return [street, clean(parts.city), tail].filter(Boolean).join(", ");
}
