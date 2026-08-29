import type { CSSProperties } from "react";
import type { MindBillAppearance } from "@mindbill/embed";

export type MindBillThemePreset = "mindbill" | "qme-companion" | "orange-bright";

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
  "orange-bright": {
    accentColor: "#ff4f0a",
    accentTextColor: "#ffffff",
    backgroundColor: "#fffaf6",
    surfaceColor: "#ffffff",
    inputBackgroundColor: "#ffffff",
    textColor: "#111827",
    mutedColor: "#626a73",
    borderColor: "#e5e1dc",
    borderRadius: "8px",
    controlRadius: "6px",
    shadow: "0 4px 18px rgba(17,24,39,.06)",
    dangerColor: "#b42318",
    successColor: "#16794f",
    warningColor: "#9a5b13",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
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
    ...style,
  } as CSSProperties;
}
