import { describe, expect, it } from "vitest";
import { DEFAULT_BILL_SUBMISSION_MODIFIERS } from "../packages/react/src/billing-catalog";

describe("fee modifier dropdown defaults", () => {
  it("allows anesthesia, equipment and component workflows without custom modifier options", () => {
    const codes = DEFAULT_BILL_SUBMISSION_MODIFIERS.map(({ code }) => code);
    expect(codes).toEqual(expect.arrayContaining(["AA", "26", "TC", "NU", "UE", "RR", "KH", "KI", "KJ"]));
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toEqual(expect.arrayContaining(["95", "96", "59"]));
  });
});
