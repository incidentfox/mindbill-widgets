// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { RfaFilterBar } from "../packages/react/src/rfa-filter-bar";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ""; });
const phone = (matches: boolean) => vi.stubGlobal("matchMedia", (query: string) => ({ matches, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));

async function mount() {
  const onChange = vi.fn(); const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  await act(async () => root.render(createElement(RfaFilterBar, { filters: [{ key: "status", label: "Status", value: "", options: [{ value: "sent", label: "Sent" }, { value: "received", label: "Received" }], onChange }] })));
  await act(async () => container.querySelector<HTMLButtonElement>(".mbrfa-chip > button")!.click());
  return { container, onChange, root };
}

it("opens a filter chip as the shared bottom sheet on phones and picks from it", async () => {
  phone(true);
  const { container, onChange, root } = await mount();
  const sheet = container.querySelector(".mbctl-pop[data-sheet]");
  expect(sheet).not.toBeNull();
  expect(sheet!.querySelector(".mbctl-sheet-head")?.textContent).toContain("Status");
  expect(container.querySelector(".mbctl-scrim")).not.toBeNull();
  await act(async () => [...sheet!.querySelectorAll<HTMLElement>("li[role=option]")].find(item => item.textContent === "Received")!.click());
  expect(onChange).toHaveBeenCalledWith("received");
  expect(container.querySelector(".mbctl-pop")).toBeNull();
  await act(async () => root.unmount());
});

it("keeps the floating popover on wider screens", async () => {
  phone(false);
  const { container, root } = await mount();
  expect(container.querySelector(".mbrfa-chip-pop")).not.toBeNull();
  expect(container.querySelector(".mbctl-pop")).toBeNull();
  await act(async () => root.unmount());
});
