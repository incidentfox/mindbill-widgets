export type MindBillAngularThemePreset = "mindbill" | "qme-companion" | "orange-bright" | "clinical-blue";

export type MindBillAngularAppearance = {
  preset?: MindBillAngularThemePreset;
  accentColor?: string;
  accentTextColor?: string;
  backgroundColor?: string;
  surfaceColor?: string;
  textColor?: string;
  mutedColor?: string;
  borderColor?: string;
  borderRadius?: string;
  controlRadius?: string;
  fontFamily?: string;
  dangerColor?: string;
};

const THEMES: Record<MindBillAngularThemePreset, Required<MindBillAngularAppearance>> = {
  mindbill: { preset: "mindbill", accentColor: "#238dbd", accentTextColor: "#fff", backgroundColor: "#f3f8fa", surfaceColor: "#fff", textColor: "#203743", mutedColor: "#657982", borderColor: "#dbe6ea", borderRadius: "14px", controlRadius: "8px", fontFamily: "Inter,system-ui,sans-serif", dangerColor: "#b63d35" },
  "qme-companion": { preset: "qme-companion", accentColor: "#53b5dc", accentTextColor: "#173542", backgroundColor: "#f2f8fb", surfaceColor: "#fff", textColor: "#1d3440", mutedColor: "#617783", borderColor: "#d7e5eb", borderRadius: "12px", controlRadius: "8px", fontFamily: "Inter,system-ui,sans-serif", dangerColor: "#b83f3a" },
  "orange-bright": { preset: "orange-bright", accentColor: "#f4510b", accentTextColor: "#fff", backgroundColor: "#fffaf6", surfaceColor: "#fffefd", textColor: "#090f1f", mutedColor: "#626a73", borderColor: "#e7e1da", borderRadius: "16px", controlRadius: "10px", fontFamily: "Inter,system-ui,sans-serif", dangerColor: "#c4322b" },
  "clinical-blue": { preset: "clinical-blue", accentColor: "#1677ff", accentTextColor: "#fff", backgroundColor: "#f5f7fa", surfaceColor: "#fff", textColor: "#1f2d3d", mutedColor: "#66788a", borderColor: "#d9e2ec", borderRadius: "8px", controlRadius: "6px", fontFamily: "Inter,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif", dangerColor: "#d4380d" },
};

export function mindBillAngularAppearanceStyle(appearance: MindBillAngularAppearance = { preset: "mindbill" }): Record<string, string> {
  const base = THEMES[appearance.preset ?? "mindbill"];
  return {
    "--a": appearance.accentColor ?? base.accentColor,
    "--ac": appearance.accentTextColor ?? base.accentTextColor,
    "--bg": appearance.backgroundColor ?? base.backgroundColor,
    "--s": appearance.surfaceColor ?? base.surfaceColor,
    "--t": appearance.textColor ?? base.textColor,
    "--m": appearance.mutedColor ?? base.mutedColor,
    "--b": appearance.borderColor ?? base.borderColor,
    "--r": appearance.borderRadius ?? base.borderRadius,
    "--cr": appearance.controlRadius ?? base.controlRadius,
    "--font": appearance.fontFamily ?? base.fontFamily,
    "--danger": appearance.dangerColor ?? base.dangerColor,
  };
}
