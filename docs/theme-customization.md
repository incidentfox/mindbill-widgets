# React theme customization

Pass one `appearance` object to `ConnectedBillingWorkspace`, `ConnectedBillLifecycle`, or the individual React surfaces. Start with a preset and override only what differs from your application. These are presentation settings, not billing-data settings; no database migration is needed.

```tsx
import type { MindBillReactAppearance } from "@mindbill/react";

const appearance = {
  preset: "midnight-cyan",
  accentColor: "#123e62",
  accentTextColor: "#ffffff",
  textColor: "#182d3d",
  backgroundColor: "#f4f7fa",
  surfaceColor: "#ffffff",
  inputBackgroundColor: "#ffffff",
  borderColor: "#d9e2e8",
  borderRadius: "10px",       // cards and panels
  controlRadius: "6px",       // inputs and buttons; independent from cards
  shadow: "none",
  fontFamily: "Inter, system-ui, sans-serif",
  dashboard: {
    borderWidth: "1px",
    sectionGap: "12px",
    rowMinHeight: "44px",
    agingRadius: "4px",
  },
} satisfies MindBillReactAppearance;

// <ConnectedBillingWorkspace {...sessionProps} appearance={appearance} />
// <ConnectedBillLifecycle {...billProps} appearance={appearance} />
```

The dashboard uses neutral card outlines, small semantic status markers, and increasingly strong tints of your accent color for aging. Age labels remain visible; color is never the only age or status indicator. Count links and aging labels use the theme text color, so light accent presets remain readable. `midnight-cyan` uses 10px panels and 6px controls by default; opt back into pill controls with `controlRadius: "999px"` if desired.

## Dashboard-specific tokens

All fields are optional under `appearance.dashboard`. Partial overrides retain the remaining defaults.

| Field | CSS custom property | Default |
| --- | --- | --- |
| `borderColor` | `--mbtk-border` | Theme border |
| `borderWidth` | `--mbtk-border-width` | `1px` |
| `borderRadius` | `--mbtk-radius` | Theme panel radius |
| `sectionGap` | `--mbtk-section-gap` | `16px` |
| `rowMinHeight` | `--mbtk-row-height` | `44px` |
| `linkColor` | `--mbtk-link` | Theme text |
| `sectionColors` | `--mbtk-violet`, `--mbtk-red`, `--mbtk-blue`, `--mbtk-green`, `--mbtk-amber`, `--mbtk-neutral` | Accent/danger/accent/success/warning/muted |
| `agingColors` | `--mbtk-aging-1` through `--mbtk-aging-5` | Accent mixed into the surface at 6%, 10%, 14%, 18%, 22% |
| `agingTextColor` | `--mbtk-aging-text` | Theme text |
| `agingRadius` | `--mbtk-aging-radius` | Theme control radius |

For example, `dashboard: { sectionColors: { red: "#9f2d26" }, agingColors: ["#f1f5f8"] }` changes the rejected marker and first aging header only. The remaining aging headers keep the theme-derived defaults. Custom bucket sets longer than five use the fifth color for subsequent buckets.

Typed appearance is the recommended integration contract. For fine-grained exceptions, the surface's `style` prop is applied last and supports CSS custom properties (cast the object to `React.CSSProperties` when using custom property keys). Scoped `.mbtk-*` class selectors can adjust typography/layout, but are implementation details and should be regression-tested after upgrades. The stable token interface avoids needing package patches for routine styling changes.

When reusing `BillTasksDashboard` for a waiting-bills summary, use `totalLabel="Bill Total"`, `itemLabel="bills"`, `grandTotalLabel="Waiting Bills Total"`, and `emptyLabel="No bills"`. Task dashboards retain their existing labels by default; neither presentation option changes counts or cell-selection payloads.

When overriding palettes, check text contrast, focus indicators, and disabled states in your actual host application. Built-in dashboard aging text is tested at WCAG AA normal-text contrast; custom colors need your own contrast check. Keep interactive targets at least 44px, and avoid host-wide button/input resets that erase focus styles.
