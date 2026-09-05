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
export function organizationProfileOptions(profile: OrganizationProfileData): BillSubmissionProfileOptions {
  return {
    billingProviders: profile.billingProviders.map((provider) => ({
      id: provider.id, label: provider.name,
      value: { name: provider.name,
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
