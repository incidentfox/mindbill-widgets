import type { CSSProperties } from "react";
import type { MindBillAppearance } from "@mindbill/embed";

export type MindBillThemePreset =
  | "mindbill"
  | "qme-companion"
  | "calm-clinical"
  | "orange-bright"
  | "clinical-blue"
  | "midnight-cyan";

export type MindBillReactAppearance = MindBillAppearance & {
  /** A complete starting point. Individual tokens below always win. */
  preset?: MindBillThemePreset;
  accentTextColor?: string;
  inputBackgroundColor?: string;
  controlRadius?: string;
  shadow?: string;
  dangerColor?: string;
  successColor?: string;
  warningColor?: string;
  /** Dashboard-only overrides. Omitted values follow the selected brand palette. */
  dashboard?: {
    borderColor?: string;
    borderWidth?: string;
    borderRadius?: string;
    sectionGap?: string;
    rowMinHeight?: string;
    linkColor?: string;
    /** Small status markers, not full-card border colors. */
    sectionColors?: Partial<Record<"violet" | "red" | "blue" | "green" | "amber" | "neutral", string>>;
    /** Backgrounds in bucket order; omitted entries use progressively stronger accent tints. */
    agingColors?: readonly string[];
    agingTextColor?: string;
    agingRadius?: string;
  };
};

export const mindBillThemePresets = {
  mindbill: {
    accentColor: "#238dbd",
    accentTextColor: "#ffffff",
    backgroundColor: "#f3f8fa",
    surfaceColor: "#ffffff",
    inputBackgroundColor: "#ffffff",
    textColor: "#203743",
    mutedColor: "#657982",
    borderColor: "#dbe6ea",
    borderRadius: "14px",
    controlRadius: "8px",
    shadow: "0 8px 24px rgba(28,58,72,.04)",
    dangerColor: "#b63d35",
    successColor: "#217449",
    warningColor: "#8a5c17",
  },
  "qme-companion": {
    accentColor: "#53b5dc",
    accentTextColor: "#173542",
    backgroundColor: "#f2f8fb",
    surfaceColor: "#ffffff",
    inputBackgroundColor: "#ffffff",
    textColor: "#1d3440",
    mutedColor: "#617783",
    borderColor: "#d7e5eb",
    borderRadius: "12px",
    controlRadius: "8px",
    shadow: "0 1px 2px rgba(29,52,64,.05)",
    dangerColor: "#b83f3a",
    successColor: "#21835d",
    warningColor: "#9a6418",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  },
  "calm-clinical": {
    accentColor: "#52b4d7",
    accentTextColor: "#173542",
    backgroundColor: "#f2f8fb",
    surfaceColor: "#ffffff",
    inputBackgroundColor: "#ffffff",
    textColor: "#20323c",
    mutedColor: "#687b84",
    borderColor: "#d8e4e9",
    borderRadius: "12px",
    controlRadius: "8px",
    shadow: "0 1px 2px rgba(32,50,60,.05)",
    dangerColor: "#b83f3a",
    successColor: "#21835d",
    warningColor: "#9a6418",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  },
  "orange-bright": {
    accentColor: "#f4510b",
    accentTextColor: "#ffffff",
    backgroundColor: "#fffaf6",
    surfaceColor: "#fffefd",
    inputBackgroundColor: "#ffffff",
    textColor: "#090f1f",
    mutedColor: "#626a73",
    borderColor: "#e7e1da",
    borderRadius: "16px",
    controlRadius: "10px",
    shadow: "0 12px 36px rgba(244,81,11,.08), 0 1px 2px rgba(9,15,31,.05)",
    dangerColor: "#c4322b",
    successColor: "#16835b",
    warningColor: "#a65f00",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  },
  "clinical-blue": {
    accentColor: "#1677ff",
    accentTextColor: "#ffffff",
    backgroundColor: "#f5f7fa",
    surfaceColor: "#ffffff",
    inputBackgroundColor: "#ffffff",
    textColor: "#1f2d3d",
    mutedColor: "#66788a",
    borderColor: "#d9e2ec",
    borderRadius: "8px",
    controlRadius: "6px",
    shadow: "0 2px 8px rgba(31,45,61,.06)",
    dangerColor: "#d4380d",
    successColor: "#389e0d",
    warningColor: "#d48806",
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  "midnight-cyan": {
    accentColor: "#05092e",
    accentTextColor: "#ffffff",
    backgroundColor: "#edf6ff",
    surfaceColor: "#ffffff",
    inputBackgroundColor: "#ffffff",
    textColor: "#05092e",
    mutedColor: "#596078",
    borderColor: "#d9dae1",
    borderRadius: "10px",
    controlRadius: "6px",
    shadow: "0 1px 2px rgba(5,9,46,.04)",
    dangerColor: "#b42318",
    successColor: "#167a58",
    warningColor: "#9a6418",
    fontFamily: "Geist, Inter, ui-sans-serif, system-ui, sans-serif",
  },
} as const satisfies Record<MindBillThemePreset, MindBillReactAppearance>;

export function resolveMindBillAppearance(
  appearance: MindBillReactAppearance | undefined,
): MindBillReactAppearance {
  const preset = appearance?.preset ?? "mindbill";
  return { ...mindBillThemePresets[preset], ...appearance, preset };
}

export function mindBillAppearanceStyle(
  appearance: MindBillReactAppearance | undefined,
  style?: CSSProperties,
): CSSProperties {
  const resolved = resolveMindBillAppearance(appearance);
  const dashboard = resolved.dashboard;
  return {
    "--mb-accent": resolved.accentColor,
    "--mb-accent-contrast": resolved.accentTextColor,
    "--mb-text": resolved.textColor,
    "--mb-muted": resolved.mutedColor,
    "--mb-border": resolved.borderColor,
    "--mb-soft": resolved.backgroundColor,
    "--mb-surface": resolved.surfaceColor,
    "--mb-input": resolved.inputBackgroundColor,
    "--mb-font": resolved.fontFamily,
    "--mb-radius": resolved.borderRadius,
    "--mb-control-radius": resolved.controlRadius,
    "--mb-shadow": resolved.shadow,
    "--mb-danger": resolved.dangerColor,
    "--mb-success": resolved.successColor,
    "--mb-warning": resolved.warningColor,
    "--mbtk-border": dashboard?.borderColor ?? "var(--mb-border)",
    "--mbtk-border-width": dashboard?.borderWidth ?? "1px",
    "--mbtk-radius": dashboard?.borderRadius ?? "var(--mb-radius)",
    "--mbtk-section-gap": dashboard?.sectionGap ?? "16px",
    "--mbtk-row-height": dashboard?.rowMinHeight ?? "44px",
    // Brand accents can be intentionally pale. Counts remain legible on a surface.
    "--mbtk-link": dashboard?.linkColor ?? "var(--mb-text)",
    "--mbtk-violet": dashboard?.sectionColors?.violet ?? "var(--mb-accent)",
    "--mbtk-red": dashboard?.sectionColors?.red ?? "var(--mb-danger)",
    "--mbtk-blue": dashboard?.sectionColors?.blue ?? "var(--mb-accent)",
    "--mbtk-green": dashboard?.sectionColors?.green ?? "var(--mb-success)",
    "--mbtk-amber": dashboard?.sectionColors?.amber ?? "var(--mb-warning)",
    "--mbtk-neutral": dashboard?.sectionColors?.neutral ?? "var(--mb-muted)",
    "--mbtk-aging-text": dashboard?.agingTextColor ?? "var(--mb-text)",
    "--mbtk-aging-radius": dashboard?.agingRadius ?? "var(--mb-control-radius)",
    ...Object.fromEntries(Array.from({ length: 5 }, (_, index) => [
      `--mbtk-aging-${index + 1}`,
      dashboard?.agingColors?.[index] ?? `color-mix(in srgb,var(--mb-accent) ${6 + index * 4}%,var(--mb-surface))`,
    ])),
    ...style,
  } as CSSProperties;
}
