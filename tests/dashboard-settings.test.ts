// @vitest-environment happy-dom
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrganizationClientOptions, OrganizationProfileData } from "@mindbill/browser";
import { BillingDashboard } from "../packages/react/src/billing-dashboard";
import { ConnectedBillingWorkspace } from "../packages/react/src/connected-billing-workspace";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => vi.unstubAllGlobals());

const profile: OrganizationProfileData = {
  organizationId: "org_synthetic",
  practiceIdentity: { name: "Synthetic practice", legalName: "Synthetic practice LLC" },
  billingProviders: [],
  renderingProviders: [],
  locations: [],
  w9: null,
  onboarding: { status: null, complete: false, checklist: [] },
};

function operationsConnection() {
  const getSession = vi.fn(async () => ({ token: "synthetic_operations_token" }));
  const fetcher = vi.fn<typeof fetch>(async (input) => {
    const path = new URL(String(input)).pathname;
    if (path === "/partner/v2/bill-dashboard") {
      return Response.json({ data: { items: [], total: 0, balanceTotal: 0, page: 1, pageSize: 25 } });
    }
    if (path === "/partner/v2/bill-tasks") {
      return Response.json({ data: {
        dashboard: { sections: [], grandTotals: [], grandTotal: 0 },
        filters: { claimsAdministrators: [], renderingProviders: [] },
      } });
    }
    throw new Error(`Unexpected operations request: ${path}`);
  });
  return { apiBaseUrl: "https://operations.example.test", getSession, fetch: fetcher };
}

function settingsConnection(denied = false) {
  const getSession = vi.fn(async () => ({ token: "synthetic_settings_token" }));
  const savedProfile = { ...profile, practiceIdentity: { ...profile.practiceIdentity, name: "Saved synthetic practice" } };
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path === "/partner/v2/organization") {
      return denied
        ? Response.json({ detail: "Organization settings require org:manage permission." }, { status: 403 })
        : Response.json({ data: profile });
    }
    if (path === "/partner/v2/organization/billing-profile" && init?.method === "PUT") {
      return Response.json({ data: savedProfile });
    }
    throw new Error(`Unexpected settings request: ${path}`);
  });
  return { options: { apiBaseUrl: "https://settings.example.test", getSession, fetch: fetcher }, savedProfile };
}

function tab(container: HTMLElement, label: string) {
  return [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((element) => element.textContent === label);
}

async function mounted(element: ReactElement, run: (container: HTMLDivElement, render: (next: ReactElement) => Promise<void>) => Promise<void>) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = async (next: ReactElement) => { await act(async () => root.render(next)); };
  try {
    await render(element);
    await run(container, render);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
}

type SettingsProps = {
  billingSettings?: OrganizationClientOptions;
  showSettings?: boolean;
  onSettingsSaved?: (next: OrganizationProfileData) => void;
};

describe.each(["BillingDashboard", "ConnectedBillingWorkspace"] as const)("%s settings", (kind) => {
  function surface(props: SettingsProps, operations = operationsConnection()) {
    return kind === "BillingDashboard"
      ? createElement(BillingDashboard, { bills: [], ...props })
      : createElement(ConnectedBillingWorkspace, { ...operations, initialView: "bills", ...props });
  }

  it("shows Settings by default but only loads organization data after selection", async () => {
    const { options } = settingsConnection();
    await mounted(surface({ billingSettings: options }), async (container) => {
      expect(tab(container, "Settings")).toBeDefined();
      expect(options.getSession).not.toHaveBeenCalled();
      expect(options.fetch).not.toHaveBeenCalled();
      expect(container.textContent).not.toContain("Save billing profile");

      await act(async () => tab(container, "Settings")!.click());

      expect(tab(container, "Settings")!.getAttribute("aria-selected")).toBe("true");
      expect(options.getSession).toHaveBeenCalledTimes(1);
      expect(options.fetch).toHaveBeenCalledTimes(1);
      expect(container.textContent).toContain("Save billing profile");
      expect([...container.querySelectorAll("input")].some((input) => input.value === profile.practiceIdentity.name)).toBe(true);
    });
  });

  it("hides Settings and never requests organization credentials when disabled", async () => {
    const { options } = settingsConnection();
    await mounted(surface({ billingSettings: options, showSettings: false }), async (container) => {
      expect(tab(container, "Settings")).toBeUndefined();
      expect(container.textContent).not.toContain("Save billing profile");
      expect(options.getSession).not.toHaveBeenCalled();
      expect(options.fetch).not.toHaveBeenCalled();
    });
  });

  it("saves through the dedicated settings session and forwards the server profile", async () => {
    const { options, savedProfile } = settingsConnection();
    const operations = operationsConnection();
    const onSettingsSaved = vi.fn();
    await mounted(surface({ billingSettings: options, onSettingsSaved }, operations), async (container) => {
      await act(async () => tab(container, "Settings")!.click());
      expect(onSettingsSaved).not.toHaveBeenCalled();
      const save = [...container.querySelectorAll("button")].find((button) => button.textContent === "Save billing profile");
      expect(save).toBeDefined();
      await act(async () => save!.click());

      expect(onSettingsSaved).toHaveBeenCalledExactlyOnceWith(savedProfile);
      const request = options.fetch.mock.calls.find(([, init]) => init?.method === "PUT");
      expect(request?.[0]).toBe("https://settings.example.test/partner/v2/organization/billing-profile");
      expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({ practiceIdentity: profile.practiceIdentity });
      expect(options.fetch.mock.calls.every(([, init]) => new Headers(init?.headers).get("Authorization") === "Bearer synthetic_settings_token")).toBe(true);
      expect(operations.fetch.mock.calls.every(([url]) => !String(url).includes("/organization"))).toBe(true);
      expect(options.getSession).toHaveBeenCalledTimes(1);
      expect(container.textContent).toContain("Saved to MindBill.");
      expect([...container.querySelectorAll("input")].some((input) => input.value === savedProfile.practiceIdentity.name)).toBe(true);
    });
  });

  it("surfaces an organization permission failure without exposing save forms", async () => {
    const { options } = settingsConnection(true);
    const onSettingsSaved = vi.fn();
    await mounted(surface({ billingSettings: options, onSettingsSaved }), async (container) => {
      await act(async () => tab(container, "Settings")!.click());
      expect(container.querySelector('[role="alert"]')?.textContent).toContain("org:manage permission");
      expect(container.querySelectorAll("input, textarea, select")).toHaveLength(0);
      expect([...container.querySelectorAll("button")].some((button) => button.textContent?.startsWith("Save"))).toBe(false);
      expect(options.fetch.mock.calls.every(([, init]) => (init?.method ?? "GET") === "GET")).toBe(true);
      expect(onSettingsSaved).not.toHaveBeenCalled();
    });
  });
});

it("uses the standard session endpoint for standalone dashboard settings without connection props", async () => {
  const fetcher = vi.fn<typeof fetch>(async (input) => String(input) === "/api/mindbill/session"
    ? Response.json({ token: "synthetic_default_token" })
    : Response.json({ data: profile }));
  vi.stubGlobal("fetch", fetcher);
  await mounted(createElement(BillingDashboard, { bills: [] }), async (container) => {
    expect(fetcher).not.toHaveBeenCalled();
    await act(async () => tab(container, "Settings")!.click());
    expect(fetcher.mock.calls[0]?.[0]).toBe("/api/mindbill/session");
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: "POST", credentials: "same-origin" });
    expect(String(fetcher.mock.calls[1]?.[0])).toMatch(/\/partner\/v2\/organization$/);
    expect(new Headers(fetcher.mock.calls[1]?.[1]?.headers).get("Authorization")).toBe("Bearer synthetic_default_token");
    expect(container.textContent).toContain("Save billing profile");
  });
});

it("falls back to bill tasks when workspace initialView is settings but Settings is hidden", async () => {
  const operations = operationsConnection();
  const { options } = settingsConnection();
  await mounted(createElement(ConnectedBillingWorkspace, {
    ...operations, initialView: "settings", showSettings: false, billingSettings: options,
  }), async (container) => {
    expect(tab(container, "Settings")).toBeUndefined();
    expect(tab(container, "Bill tasks")!.getAttribute("aria-selected")).toBe("true");
    expect(operations.fetch.mock.calls.some(([url]) => String(url).includes("/partner/v2/bill-tasks"))).toBe(true);
    expect(options.getSession).not.toHaveBeenCalled();
    expect(options.fetch).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("Save billing profile");
  });
});

it("inherits the workspace connection when no separate settings connection is supplied", async () => {
  const { options } = settingsConnection();
  await mounted(createElement(ConnectedBillingWorkspace, { ...options, initialView: "settings" }), async (container) => {
    expect(options.getSession).toHaveBeenCalledTimes(1);
    expect(options.fetch.mock.calls[0]?.[0]).toBe("https://settings.example.test/partner/v2/organization");
    expect(container.textContent).toContain("Save billing profile");
  });
});
