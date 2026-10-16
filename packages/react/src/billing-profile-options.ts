import type { OrganizationProfileData } from "@mindbill/browser";
import type { BillSubmissionInput } from "./bill-submission-form";

export type BillSubmissionProfileOption<K extends "billingProvider" | "renderingProvider" | "serviceLocation"> = {
  id: string;
  label: string;
  value: NonNullable<BillSubmissionInput[K]>;
};

/** Supply host-owned snapshots or convert a MindBill organization profile. SSNs use server-resolved references. */
export type BillSubmissionProfileOptions = {
  billingProviders?: readonly BillSubmissionProfileOption<"billingProvider">[];
  renderingProviders?: readonly BillSubmissionProfileOption<"renderingProvider">[];
  serviceLocations?: readonly BillSubmissionProfileOption<"serviceLocation">[];
};

/** Explicit adapter: does not fetch, auto-select, persist, or mutate existing bills. */
export function organizationProfileOptions(profile: Pick<OrganizationProfileData, "billingProviders" | "renderingProviders" | "locations">): BillSubmissionProfileOptions {
  return {
    billingProviders: profile.billingProviders.map((provider) => ({
      id: provider.id, label: provider.name,
      value: { id: provider.id, name: provider.name,
        ...(provider.taxIdType === "SSN" ? { savedProviderId: provider.id, taxIdType: "SSN" as const, taxIdLast4: provider.taxIdLast4 ?? "" } : { taxId: provider.taxId ?? "", taxIdType: "EIN" as const }),
        npi: provider.npi, ...(provider.phone !== undefined ? { phone: provider.phone } : {}),
        address: { line1: provider.billingStreet ?? "", city: provider.billingCity ?? "", state: provider.billingState ?? "", postalCode: provider.billingZip ?? "" } },
    })),
    renderingProviders: (profile.renderingProviders ?? []).filter((provider) => provider.active !== false).map((provider) => ({
      id: provider.id, label: provider.name,
      value: { name: provider.name, npi: provider.npi,
        ...(provider.specialty !== undefined ? { specialty: provider.specialty } : {}),
        ...(provider.taxonomy !== undefined ? { taxonomy: provider.taxonomy } : {}),
        ...(provider.licenseNumber !== undefined ? { licenseNumber: provider.licenseNumber } : {}),
        ...(provider.licenseState !== undefined ? { licenseState: provider.licenseState } : {}),
        ...(provider.isQME !== undefined ? { isQme: provider.isQME } : {}),
        ...(provider.isAME !== undefined ? { isAme: provider.isAME } : {}) },
    })),
    serviceLocations: profile.locations.filter((location) => location.active !== false).map((location) => ({
      id: location.id, label: location.nickname || location.name,
      value: { name: location.name, placeOfServiceCode: location.posCode ?? "",
        address: { line1: location.street, city: location.city, state: location.state, postalCode: location.zip } },
    })),
  };
}

export type BillSubmissionProfileSection = "billingProvider" | "renderingProvider" | "serviceLocation";

/** Drops empty values ("", null, false, empty objects) and sorts keys, so equivalent snapshots compare equal. */
function meaningful(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(meaningful);
  if (value && typeof value === "object") {
    const entries = Object.entries(value).map(([key, entry]) => [key, meaningful(entry)] as const)
      .filter(([, entry]) => entry !== undefined).sort(([left], [right]) => left.localeCompare(right));
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  if (typeof value === "string") return value.trim() || undefined;
  return value === null || value === false ? undefined : value;
}

/**
 * The saved choice a bill's provider or location came from: the option with the same saved id
 * (`savedProviderId`, then `id`) or, without an id, the option whose value equals it. Undefined when the bill's
 * values were entered by hand or edited after choosing.
 */
export function matchingBillSubmissionProfileOption<K extends BillSubmissionProfileSection>(
  options: readonly BillSubmissionProfileOption<K>[] | undefined,
  value: BillSubmissionInput[K] | undefined,
): BillSubmissionProfileOption<K> | undefined {
  if (!options?.length || !value) return undefined;
  const ids = value as { savedProviderId?: string; id?: string };
  const id = ids.savedProviderId?.trim() || ids.id?.trim();
  if (id) {
    const byId = options.find((option) => {
      const saved = option.value as { savedProviderId?: string; id?: string };
      return option.id === id || saved.savedProviderId === id || saved.id === id;
    });
    if (byId) return byId;
  }
  const key = JSON.stringify(meaningful(value) ?? null);
  return options.find((option) => JSON.stringify(meaningful(option.value) ?? null) === key);
}

const lastFour = (value: string | undefined) => (value ?? "").replace(/\D/g, "").slice(-4);

/** One line describing a bill's billing provider, rendering provider or service location, for a collapsed saved choice. */
export function billSubmissionProfileSummary(section: BillSubmissionProfileSection, bill: Pick<BillSubmissionInput, BillSubmissionProfileSection>): string[] {
  if (section === "billingProvider") {
    const provider = bill.billingProvider ?? {};
    const last4 = provider.taxIdLast4 || lastFour(provider.taxId);
    const place = [provider.address?.city, provider.address?.state].filter(Boolean).join(", ");
    return [provider.name ?? "", last4 ? `${provider.taxIdType === "SSN" ? "SSN" : "EIN"} ••${last4}` : "", provider.npi ? `NPI ${provider.npi}` : "", place].filter(Boolean);
  }
  if (section === "renderingProvider") {
    const provider = bill.renderingProvider ?? {};
    return [provider.name ?? "", provider.npi ? `NPI ${provider.npi}` : "", provider.taxonomy ?? ""].filter(Boolean);
  }
  const location = bill.serviceLocation ?? {};
  const address = [location.address?.line1, location.address?.city].filter(Boolean).join(", ");
  return [location.name ?? "", location.placeOfServiceCode ? `POS ${location.placeOfServiceCode}` : "", address].filter(Boolean);
}
