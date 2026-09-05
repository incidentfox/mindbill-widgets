import { describe, expect, it } from "vitest";
import type { OrganizationProfileData } from "../packages/browser/src/index";
import { organizationProfileOptions } from "../packages/react/src/billing-profile-options";

const profile: OrganizationProfileData = {
  organizationId: "org-example", practiceIdentity: {},
  billingProviders: [{ id: "bp-1", name: "Example Practice", npi: "1111111111", taxId: "94-1234567", billingStreet: "1 Example St" }],
  renderingProviders: [
    { id: "rp-1", name: "Example Doctor", npi: "2222222222", isQME: true },
    { id: "rp-2", name: "Archived Doctor", npi: "3333333333", active: false },
  ],
  locations: [
    { id: "loc-1", name: "Example Office", nickname: "Main", street: "1 Example St", city: "Example", state: "CA", zip: "90000", posCode: "11" },
    { id: "loc-2", name: "Archived", street: "2 Example St", city: "Example", state: "CA", zip: "90000", active: false },
  ], w9: null, onboarding: { status: null, complete: false, checklist: [] },
};

describe("saved billing profile options", () => {
  it("adapts active profiles into editable bill snapshots, not stored references", () => {
    const options = organizationProfileOptions(profile);
    expect(options.renderingProviders).toHaveLength(1);
    expect(options.serviceLocations).toHaveLength(1);
    expect(options.renderingProviders?.[0]?.value).toEqual({ name: "Example Doctor", npi: "2222222222", isQme: true });
    expect(options.serviceLocations?.[0]?.label).toBe("Main");
    expect(options.serviceLocations?.[0]?.value.placeOfServiceCode).toBe("11");
    expect(options.billingProviders?.[0]?.value).not.toHaveProperty("id");
    expect(options.billingProviders?.[0]?.value.address).toEqual({ line1: "1 Example St", city: "", state: "", postalCode: "" });
  });

  it("does not mutate organization data and accepts older API responses", () => {
    const original = structuredClone(profile);
    const options = organizationProfileOptions(profile);
    options.billingProviders![0]!.value.name = "Edited bill only";
    expect(profile).toEqual(original);
    const olderProfile = { ...profile };
    delete olderProfile.renderingProviders;
    expect(organizationProfileOptions(olderProfile).renderingProviders).toEqual([]);
  });
});
