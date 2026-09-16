"use client";

import type { ReactElement } from "react";

/** Shared keyboard navigation for the billing dashboard tab lists. */
export function DashboardTabs<T extends string>({ id, tabs, value, onChange, className, tabClassName }: {
  id: string;
  tabs: ReadonlyArray<readonly [T, string]>;
  value: T;
  onChange: (value: T) => void;
  className: string;
  tabClassName: string;
}): ReactElement {
  return <div className={className} role="tablist" aria-label="Billing views">
    {tabs.map(([key, label], index) => <button key={key} id={`${id}-tab-${key}`} type="button"
      className={`${tabClassName} ${value === key ? "active" : ""}`}
      role="tab" aria-selected={value === key} aria-controls={`${id}-panel-${key}`}
      tabIndex={value === key ? 0 : -1}
      onClick={() => onChange(key)}
      onKeyDown={(event) => {
        const next = event.key === "ArrowRight" ? (index + 1) % tabs.length
          : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length
          : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
        if (next === null) return;
        event.preventDefault();
        onChange(tabs[next]![0]);
        const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
        buttons?.[next]?.focus();
      }}>{label}</button>)}
  </div>;
}
