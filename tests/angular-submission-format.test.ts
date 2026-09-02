import { describe, expect, it } from "vitest";

import {
  formatMindBillSubmissionDate,
  parseMindBillSubmissionDate,
} from "../packages/angular/src/lib/submission-format";
import {
  formatBillSubmissionDate,
  parseBillSubmissionDate,
} from "../packages/react/src/bill-submission-form";
import { mindBillCustomProcedureOption } from "../packages/angular/src/lib/submission-format";

describe("Angular submission date helpers", () => {
  it("parses ISO, US, and bare-digit dates to ISO", () => {
    expect(parseMindBillSubmissionDate("1984-02-14")).toBe("1984-02-14");
    expect(parseMindBillSubmissionDate("02/14/1984")).toBe("1984-02-14");
    expect(parseMindBillSubmissionDate("2/14/1984")).toBe("1984-02-14");
    expect(parseMindBillSubmissionDate("02-14-1984")).toBe("1984-02-14");
    expect(parseMindBillSubmissionDate("02141984")).toBe("1984-02-14");
  });

  it("rejects impossible and partial dates", () => {
    expect(parseMindBillSubmissionDate("02/30/1984")).toBeUndefined();
    expect(parseMindBillSubmissionDate("13/01/1984")).toBeUndefined();
    expect(parseMindBillSubmissionDate("02/14/84")).toBeUndefined();
    expect(parseMindBillSubmissionDate("04/2")).toBeUndefined();
    expect(parseMindBillSubmissionDate("")).toBeUndefined();
  });

  it("formats to MM/DD/YYYY and round-trips", () => {
    expect(formatMindBillSubmissionDate("1984-02-14")).toBe("02/14/1984");
    expect(formatMindBillSubmissionDate("02141984")).toBe("02/14/1984");
    expect(formatMindBillSubmissionDate("garbage")).toBe("");
    expect(formatMindBillSubmissionDate(null)).toBe("");
  });

  it("matches the React helpers exactly", () => {
    for (const value of ["1984-02-14", "2/9/2026", "02141984", "02/30/1984", "junk", "12-31-1999"]) {
      expect(parseMindBillSubmissionDate(value)).toBe(parseBillSubmissionDate(value));
      expect(formatMindBillSubmissionDate(value)).toBe(formatBillSubmissionDate(value));
    }
  });
});

describe("Angular custom procedure option", () => {
  it("accepts CPT, HCPCS, and medical-legal codes", () => {
    expect(mindBillCustomProcedureOption("99213")?.id).toBe("99213");
    expect(mindBillCustomProcedureOption("g0463")?.id).toBe("G0463");
    expect(mindBillCustomProcedureOption("ml201")?.id).toBe("ML201");
    expect(mindBillCustomProcedureOption("mlprr")?.id).toBe("MLPRR");
  });

  it("rejects non-code queries", () => {
    expect(mindBillCustomProcedureOption("evaluation")).toBeNull();
    expect(mindBillCustomProcedureOption("992")).toBeNull();
    expect(mindBillCustomProcedureOption("")).toBeNull();
  });
});
