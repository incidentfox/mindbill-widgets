import { describe, expect, it } from "vitest";
import { mindBillAppearanceStyle, mindBillThemePresets } from "../packages/react/src/appearance";
import { BillTasksDashboard } from "../packages/react/src/bill-tasks-dashboard";
import { buildBillTasksDashboard } from "../packages/browser/src/index";
import { isValidElement, type ReactElement } from "react";

describe("dashboard appearance", () => {
  it("supports bill labels without changing task defaults", () => {
    const data = buildBillTasksDashboard([{ sectionId: "waiting", rowId: "sent", rowLabel: "Sent", ageDays: 2, ref: "bill_synthetic" }], [
      { id: "waiting", label: "Waiting", tone: "blue", agingBasisLabel: "Date of Service" },
    ]);
    const collect = (node: unknown): string[] => {
      if (Array.isArray(node)) return node.flatMap(collect);
      if (typeof node === "string") return [node];
      if (!isValidElement<Record<string, unknown>>(node)) return [];
      if (typeof node.type === "function") return collect((node.type as (props: Record<string, unknown>) => ReactElement)(node.props));
      return [...collect(node.props.children), ...(typeof node.props["aria-label"] === "string" ? [node.props["aria-label"]] : [])];
    };
    const taskLabels = collect(BillTasksDashboard({ data, onSelectCell: () => undefined }));
    expect(taskLabels).toContain("Task Total");
    expect(taskLabels).toContain("Sent · all ages: 1 tasks · $0.00 due");
    const billLabels = collect(BillTasksDashboard({ data, totalLabel: "Bill Total", itemLabel: "bills", onSelectCell: () => undefined }));
    expect(billLabels).toContain("Bill Total");
    expect(billLabels).toContain("Sent · all ages: 1 bills · $0.00 due");
    expect(billLabels).not.toContain("Task Total");
  });
  it.each(Object.keys(mindBillThemePresets) as (keyof typeof mindBillThemePresets)[])(
    "%s derives dashboard colors from the active theme",
    (preset) => {
      expect(mindBillAppearanceStyle({ preset })).toMatchObject({
        "--mbtk-border": "var(--mb-border)",
        "--mbtk-border-width": "1px",
        "--mbtk-blue": "var(--mb-accent)",
        "--mbtk-red": "var(--mb-danger)",
        "--mbtk-link": "var(--mb-text)",
        "--mbtk-aging-text": "var(--mb-text)",
        "--mbtk-aging-1": "color-mix(in srgb,var(--mb-accent) 6%,var(--mb-surface))",
        "--mbtk-aging-5": "color-mix(in srgb,var(--mb-accent) 22%,var(--mb-surface))",
      });
    },
  );

  it("allows partial palette and geometry overrides without losing other defaults", () => {
    expect(mindBillAppearanceStyle({ preset: "midnight-cyan", dashboard: {
      borderColor: "#dddddd", borderWidth: "0px", borderRadius: "4px",
      sectionGap: "12px", rowMinHeight: "48px", linkColor: "#123456",
      agingColors: ["#eef0f4"], agingTextColor: "#203040", agingRadius: "3px",
      sectionColors: { violet: "#6b55a0" },
    } })).toMatchObject({
      "--mb-control-radius": "6px",
      "--mbtk-border": "#dddddd", "--mbtk-border-width": "0px", "--mbtk-radius": "4px",
      "--mbtk-section-gap": "12px", "--mbtk-row-height": "48px", "--mbtk-link": "#123456",
      "--mbtk-aging-1": "#eef0f4", "--mbtk-aging-text": "#203040", "--mbtk-aging-radius": "3px",
      "--mbtk-aging-2": "color-mix(in srgb,var(--mb-accent) 10%,var(--mb-surface))",
      "--mbtk-violet": "#6b55a0", "--mbtk-red": "var(--mb-danger)",
    });
  });

  it("preserves host style precedence", () => {
    expect(mindBillAppearanceStyle({ dashboard: { borderWidth: "1px" } }, {
      "--mbtk-border-width": "2px",
    } as Parameters<typeof mindBillAppearanceStyle>[1])).toMatchObject({ "--mbtk-border-width": "2px" });
  });

  it.each(Object.entries(mindBillThemePresets))(
    "%s keeps dashboard text above WCAG AA normal-text contrast on every aging tint",
    (_, preset) => {
      const rgb = (hex: string) => hex.slice(1).match(/../g)!.map((pair) => parseInt(pair, 16));
      const luminance = (channels: number[]) => channels.map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
      const text = luminance(rgb(preset.textColor));
      const accent = rgb(preset.accentColor);
      const surface = rgb(preset.surfaceColor);
      for (const weight of [0.06, 0.10, 0.14, 0.18, 0.22]) {
        const background = luminance(surface.map((channel, index) => channel * (1 - weight) + accent[index]! * weight));
        expect((Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
});
