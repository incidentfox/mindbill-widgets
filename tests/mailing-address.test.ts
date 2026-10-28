// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { BillDeliveryOptions } from "@mindbill/browser";
import {
  composeMailingAddress,
  isMailingAddressValid,
  parseMailingAddress,
  validateMailingAddress,
} from "../packages/browser/src/mailing-address";
import { SendRouteDialog } from "../packages/react/src/send-route-dialog";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("mailing address helpers", () => {
  it.each([
    ["1515 Clay St, Fl 17, Oakland, CA 94612-1486", { line1: "1515 Clay St", line2: "Fl 17", city: "Oakland", state: "CA", postalCode: "94612-1486" }],
    ["320 West 4th Street, Suite 690, Los Angeles, CA 90013-2350", { line1: "320 West 4th Street", line2: "Suite 690", city: "Los Angeles", state: "CA", postalCode: "90013-2350" }],
    ["PO Box 14441, Lexington, KY 40512", { line1: "PO Box 14441", line2: "", city: "Lexington", state: "KY", postalCode: "40512" }],
    ["100 Synthetic Way, Sacramento, CA 958141234", { line1: "100 Synthetic Way", line2: "", city: "Sacramento", state: "CA", postalCode: "95814-1234" }],
  ])("splits and round-trips %s", (raw, parts) => {
    const parsed = parseMailingAddress(raw);
    expect(parsed).toEqual({ parts, complete: true });
    expect(isMailingAddressValid(parsed.parts)).toBe(true);
    const composed = composeMailingAddress(parsed.parts);
    expect(parseMailingAddress(composed).parts).toEqual(parts);
  });

  it("composes exactly line1[, line2], City, ST ZIP", () => {
    expect(composeMailingAddress({ line1: "1515 Clay St", line2: "Fl 17", city: "Oakland", state: "ca", postalCode: "94612-1486" }))
      .toBe("1515 Clay St, Fl 17, Oakland, CA 94612-1486");
    expect(composeMailingAddress({ line1: "PO Box 1", line2: "", city: "Sacramento", state: "CA", postalCode: "95814" }))
      .toBe("PO Box 1, Sacramento, CA 95814");
  });

  it("reads newline-separated text and moves a department line after the street", () => {
    expect(parseMailingAddress("Synthetic Claims Dept\nPO Box 1234\nAnytown, CA 90000").parts)
      .toEqual({ line1: "PO Box 1234", line2: "Synthetic Claims Dept", city: "Anytown", state: "CA", postalCode: "90000" });
    expect(parseMailingAddress("PO Box 1\nSacramento CA 95814").parts)
      .toEqual({ line1: "PO Box 1", line2: "", city: "Sacramento", state: "CA", postalCode: "95814" });
  });

  it("keeps unparseable text in line 1 and reports what is missing", () => {
    const parsed = parseMailingAddress("Call the adjuster for the address");
    expect(parsed.complete).toBe(false);
    expect(parsed.parts.line1).toBe("Call the adjuster for the address");
    expect(Object.keys(validateMailingAddress(parsed.parts)).sort()).toEqual(["city", "postalCode", "state"]);
    expect(validateMailingAddress({ line1: "1 Main", line2: "", city: "X", state: "California", postalCode: "123" }))
      .toEqual({ state: "Use the 2-letter state code.", postalCode: "Enter a 5-digit ZIP or ZIP+4." });
  });
});

describe("send-route dialog mail fields", () => {
  const delivery = {
    payerName: "Synthetic Claims",
    recommended: { route: "mail" },
    options: [{ route: "mail", label: "Mail" }],
    contacts: { mailingAddress: "Synthetic Claims Dept\nPO Box 1\nSacramento, CA 95814" },
  } as unknown as BillDeliveryOptions;

  async function mount(onConfirm: (value: unknown) => void, override?: BillDeliveryOptions) {
    const container = document.createElement("div"); document.body.append(container);
    const root = createRoot(container);
    await act(async () => { root.render(createElement(SendRouteDialog, { delivery: override ?? delivery, onCancel: () => undefined, onConfirm })); });
    return { container, unmount: async () => { await act(async () => root.unmount()); container.remove(); } };
  }
  const input = (container: HTMLElement, name: string) => container.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
  async function type(element: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => { setter.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); });
  }
  const sendButton = (container: HTMLElement) => container.querySelector<HTMLButtonElement>("button.mbrd-confirm")!;

  it("prefills separate fields and sends the composed single-line address", async () => {
    const onConfirm = vi.fn();
    const view = await mount(onConfirm);
    try {
      expect(input(view.container, "line1").value).toBe("PO Box 1");
      expect(input(view.container, "line2").value).toBe("Synthetic Claims Dept");
      expect(input(view.container, "city").value).toBe("Sacramento");
      expect(input(view.container, "state").value).toBe("CA");
      expect(input(view.container, "postalCode").value).toBe("95814");
      expect(view.container.querySelector("textarea")).toBeNull();
      const button = sendButton(view.container);
      expect(button.disabled).toBe(false);
      await act(async () => { button.click(); });
      expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ route: "mail", destination: { mailingAddress: "PO Box 1, Synthetic Claims Dept, Sacramento, CA 95814" } }));
    } finally { await view.unmount(); }
  });

  it("blocks sending until every required field is valid", async () => {
    const onConfirm = vi.fn();
    const view = await mount(onConfirm, { ...delivery, contacts: { mailingAddress: "Ask the adjuster" } } as unknown as BillDeliveryOptions);
    try {
      expect(sendButton(view.container).disabled).toBe(true);
      expect(view.container.textContent).toContain("Enter the city.");
      await type(input(view.container, "line1"), "1 Synthetic Plaza");
      await type(input(view.container, "city"), "Anytown");
      await type(input(view.container, "state"), "ca1");
      expect(input(view.container, "state").value).toBe("CA");
      await type(input(view.container, "postalCode"), "9000");
      expect(sendButton(view.container).disabled).toBe(true);
      await type(input(view.container, "postalCode"), "90000");
      expect(sendButton(view.container).disabled).toBe(false);
    } finally { await view.unmount(); }
  });
});
