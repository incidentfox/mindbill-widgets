"use client";
import { BillingSettings } from "@mindbill/react";
import { appearance, getSettingsSession } from "./session";

export function PracticeSettings() {
  return <>
    <div className="page-heading"><div><p className="eyebrow">WORKSPACE</p>
      <h1>Reusable billing details</h1>
      <p className="page-description">Optional shared provider and location profiles.</p>
    </div><span className="subtle-badge">Administrator</span></div>
    <div className="sdk-surface settings-surface"><BillingSettings
      getSession={getSettingsSession} appearance={appearance}
      heading="Shared billing profile" description="Save details to reuse across workspace bills."
    /></div>
  </>;
}
