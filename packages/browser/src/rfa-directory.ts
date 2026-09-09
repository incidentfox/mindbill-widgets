import type { BillClaimsAdministratorDirectory } from "./index";

export type RfaAuthorizationDestinationOption = {
  method: "fax" | "email";
  destination: string;
  label: string;
  phone?: string;
};

/** Accept fax numbers only, never telephone notes, email addresses, or extensions. */
export function normalizeRfaFax(value: string): string | null {
  const input = value.trim();
  if (/^\+[1-9]\d{7,14}$/.test(input)) return input;
  if (!/^\+?[\d ().-]+$/.test(input)) return null;
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10 && !input.startsWith("+")) return `+1${digits}`;
  return digits.length === 11 && digits.startsWith("1") ? `+${digits}` : null;
}

/** Returns choices only. Selecting or transmitting a destination is a separate user action. */
export function rfaAuthorizationDestinations(directory: BillClaimsAdministratorDirectory | null): RfaAuthorizationDestinationOption[] {
  if (!directory || ["adjuster_specific_required", "daisybill_unverified", "profile_not_published"].includes(directory.authorizationStatus ?? "")) return [];
  return (directory.authorization ?? []).flatMap((contact) => {
    const common = { label: contact.location || contact.name || "Authorization department", ...(contact.phone ? { phone: contact.phone } : {}) };
    const options: RfaAuthorizationDestinationOption[] = [];
    const fax = contact.fax ? normalizeRfaFax(contact.fax) : null;
    if (fax && contact.method !== "email") options.push({ ...common, method: "fax", destination: fax });
    if (contact.email?.trim() && contact.method !== "fax") options.push({ ...common, method: "email", destination: contact.email.trim() });
    return options;
  });
}

export function rfaAuthorizationGuidance(directory: BillClaimsAdministratorDirectory | null): string {
  switch (directory?.authorizationStatus) {
    case "central_fax": return "Select the central authorization fax after confirming it applies to this claim.";
    case "central_email": return "Authorization is routed by email. Download the signed packet and record delivery after sending it through your email service.";
    case "claim_handling_location_routes": return "Choose the office handling this claim. Authorization destinations vary by office.";
    case "adjuster_specific_required": return "Obtain the authorization destination from the handling adjuster.";
    case "daisybill_unverified": return "The directory has not verified an authorization destination. Confirm it with the handling adjuster.";
    case "profile_not_published": return "No authorization destination is currently published. Confirm a current destination with the handling adjuster.";
    default: return "Select an authorization contact or enter a fax confirmed with the handling adjuster.";
  }
}
