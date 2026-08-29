export type ProcedureLine = {
  id?: string;
  code: string;
  modifiers: string[];
  units: number;
  charge: number;
  feeSchedule?: number;
  serviceDate?: string | null;
  serviceDateEnd?: string | null;
  diagnosisPointers?: number[];
};

const EMPTY_PROCEDURE_LINE: ProcedureLine = {
  code: "",
  modifiers: [],
  units: 1,
  charge: 0,
};

export function isEmptyProcedureLine(line: ProcedureLine): boolean {
  return !line.code.trim()
    && line.modifiers.length === 0
    && line.units === 1
    && !line.serviceDate
    && !line.serviceDateEnd
    && !(line.diagnosisPointers?.length)
    && !line.charge;
}

/** Keeps completed/partial lines plus one keyboard-ready empty row. */
export function ensureTrailingProcedureLine(
  lines: readonly ProcedureLine[],
): ProcedureLine[] {
  const entered = lines
    .filter((line) => !isEmptyProcedureLine(line))
    .map((line) => ({ ...line, modifiers: [...line.modifiers] }));

  return entered.length < 50
    ? [...entered, { ...EMPTY_PROCEDURE_LINE, modifiers: [] }]
    : entered;
}
