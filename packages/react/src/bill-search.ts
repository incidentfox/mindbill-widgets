export type BillSearchDateField = "service" | "submitted";

/** Stable calendar-date aliases; never shift a service date through the browser timezone. */
export function billSearchDateText(value?: string | null): string {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value ?? "";
  const [, year, month, day] = match;
  return `${value} ${month}/${day}/${year} ${Number(month)}/${Number(day)}/${year}`;
}

/** Every word must occur, but words can match different bill fields. */
export function matchesBillSearch(query: string, values: Array<string | number | null | undefined>): boolean {
  const text = values.join(" ").toLowerCase().replaceAll("_", " ");
  return query.toLowerCase().replaceAll("_", " ").trim().split(/\s+/).every((word) => text.includes(word));
}

export function billDateInRange(value: string | null | undefined, from: string, to: string): boolean {
  if (!from && !to) return true;
  const date = value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  return Boolean(date && (!from || date >= from) && (!to || date <= to));
}
