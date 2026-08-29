import { describe, expect, it } from "vitest";

import { ensureTrailingProcedureLine } from "../packages/angular/src/lib/procedure-lines";

describe("Angular procedure lines", () => {
  it("keeps one empty row after every entered row", () => {
    expect(ensureTrailingProcedureLine([])).toEqual([
      { code: "", modifiers: [], units: 1, charge: 0 },
    ]);

    expect(ensureTrailingProcedureLine([
      { code: "ML201", modifiers: ["95"], units: 1, charge: 2015 },
      { code: "MLPRR", modifiers: [], units: 3, charge: 0 },
      { code: "", modifiers: [], units: 1, charge: 0 },
      { code: "", modifiers: [], units: 1, charge: 0 },
    ])).toEqual([
      { code: "ML201", modifiers: ["95"], units: 1, charge: 2015 },
      { code: "MLPRR", modifiers: [], units: 3, charge: 0 },
      { code: "", modifiers: [], units: 1, charge: 0 },
    ]);
  });

  it("treats modifiers and non-default units as partial input", () => {
    expect(ensureTrailingProcedureLine([
      { code: "", modifiers: ["93"], units: 1, charge: 0 },
    ])).toHaveLength(2);
    expect(ensureTrailingProcedureLine([
      { code: "", modifiers: [], units: 2, charge: 0 },
    ])).toHaveLength(2);
  });
});
