import type {
  BillTasksAgingBucket,
  BillTasksDashboardRow,
  BillTasksDashboardSection,
  BillTasksDashboardTone,
} from "@mindbill/browser";

// Pure helpers behind <mindbill-bill-tasks-dashboard>; the aggregation itself
// (buildBillTasksDashboard) is shared from @mindbill/browser.

export type MindBillBillTasksCell = {
  sectionId: string;
  rowId: string;
  /** Null for a row's "Task Total" cell (all buckets). */
  bucketId: string | null;
  refs: string[];
  count: number;
};

export const MINDBILL_BILL_TASKS_TONES: Record<BillTasksDashboardTone, string> = {
  violet: "#7c53c3",
  red: "#cf4437",
  blue: "#2f7fd1",
  green: "#2c9a5b",
  amber: "#d9931f",
  neutral: "#8195a1",
};

export const MINDBILL_BILL_TASKS_PILL_BASES = ["#2c9a5b", "#1f9aa8", "#dcbb28", "#e08a2e", "#d75d8a"];

export function mindBillBillTasksTone(tone: BillTasksDashboardTone): string {
  return MINDBILL_BILL_TASKS_TONES[tone] ?? MINDBILL_BILL_TASKS_TONES.neutral;
}

export function mindBillBillTasksPillBase(index: number): string {
  return MINDBILL_BILL_TASKS_PILL_BASES[index % MINDBILL_BILL_TASKS_PILL_BASES.length]!;
}

/** Click-through payload for a bucket cell (bucketIndex) or a row total (null). */
export function mindBillBillTasksCell(
  section: BillTasksDashboardSection,
  row: BillTasksDashboardRow,
  bucketIndex: number | null,
  buckets: BillTasksAgingBucket[],
): MindBillBillTasksCell {
  if (bucketIndex === null) {
    return {
      sectionId: section.id,
      rowId: row.id,
      bucketId: null,
      refs: row.refs.flat(),
      count: row.total,
    };
  }
  return {
    sectionId: section.id,
    rowId: row.id,
    bucketId: buckets[bucketIndex]?.id ?? null,
    refs: row.refs[bucketIndex] ?? [],
    count: row.counts[bucketIndex] ?? 0,
  };
}
