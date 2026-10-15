// @vitest-environment happy-dom
import { act, createElement, useState, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DateField, DateTimeField, MultiSelect, Select, TimeField, formatDateText, formatTimeText, parseDateText, parseTimeText } from "../packages/react/src/form-controls";
import { choose, optionValues, searchAndChoose, selectValue, typeInto } from "./form-control-helpers";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => { await cleanup?.(); cleanup = undefined; });
async function mount(element: ReactElement) {
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  cleanup = async () => { await act(async () => root.unmount()); container.remove(); };
  return container;
}
const key = (target: Element, name: string) => act(async () => { target.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true })); });
const formData = (container: HTMLElement) => new FormData(container.querySelector("form")!);
const options = [{ value: "fax", label: "Fax" }, { value: "mail", label: "Mail" }, { value: "email", label: "E-mail" }];

describe("Select", () => {
  it("writes the chosen value into the form and reports it", async () => {
    const onChange = vi.fn();
    const container = await mount(createElement("form", null, createElement(Select, { name: "channel", defaultValue: "fax", options, onChange })));
    expect(formData(container).get("channel")).toBe("fax");
    expect(container.querySelector(".mbctl-trigger")!.textContent).toContain("Fax");
    await choose(container.querySelector(".mbctl-select")!, "mail");
    expect(formData(container).get("channel")).toBe("mail");
    expect(onChange).toHaveBeenCalledWith("mail");
    expect(container.querySelector("[role=listbox]")).toBeNull();
  });
  it("reads <option> and <optgroup> children and falls back to the first option like a native select", async () => {
    const container = await mount(createElement("form", null, createElement(Select, { name: "kind" },
      createElement("optgroup", { label: "Common" }, createElement("option", { value: "a" }, "Alpha"), createElement("option", { value: "b", disabled: true }, "Beta")),
      createElement("option", { value: "c" }, "Gamma"))));
    expect(formData(container).get("kind")).toBe("a");
    const select = container.querySelector(".mbctl-select")!;
    expect(await optionValues(select)).toEqual(["a", "b", "c"]);
    await act(async () => select.querySelector<HTMLButtonElement>(".mbctl-trigger")!.click());
    expect(select.querySelector(".mbctl-group")?.textContent).toBe("Common");
    expect(select.querySelector('li[data-value="b"]')?.getAttribute("aria-disabled")).toBe("true");
  });
  it("is keyboard operable: arrows move, Enter picks, Escape closes without picking", async () => {
    const container = await mount(createElement("form", null, createElement(Select, { name: "channel", defaultValue: "fax", options })));
    const trigger = container.querySelector<HTMLButtonElement>(".mbctl-trigger")!;
    await key(trigger, "ArrowDown");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    await key(trigger, "ArrowDown");
    expect(container.querySelector("li[data-active]")?.getAttribute("data-value")).toBe("mail");
    await key(trigger, "Escape");
    expect(container.querySelector("[role=listbox]")).toBeNull();
    expect(formData(container).get("channel")).toBe("fax");
    await key(trigger, "ArrowDown"); await key(trigger, "ArrowDown"); await key(trigger, "ArrowDown"); await key(trigger, "Enter");
    expect(formData(container).get("channel")).toBe("email");
  });
  it("closes on a click outside", async () => {
    const container = await mount(createElement("div", null, createElement(Select, { options }), createElement("p", { id: "outside" }, "Outside")));
    await act(async () => container.querySelector<HTMLButtonElement>(".mbctl-trigger")!.click());
    expect(container.querySelector("[role=listbox]")).not.toBeNull();
    await act(async () => { container.querySelector("#outside")!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); });
    expect(container.querySelector("[role=listbox]")).toBeNull();
  });
  it("adds a search box to long lists and filters as you type", async () => {
    const many = Array.from({ length: 30 }, (_, index) => ({ value: `p${index}`, label: `Synthetic Physician ${index}` }));
    const container = await mount(createElement(Select, { options: many, label: "Physician" }));
    await act(async () => container.querySelector<HTMLButtonElement>(".mbctl-trigger")!.click());
    const search = container.querySelector<HTMLInputElement>(".mbctl-pop-search")!;
    expect(search).not.toBeNull();
    await typeInto(search, "physician 25");
    expect([...container.querySelectorAll<HTMLElement>("li[role=option]")].map(node => node.dataset.value)).toEqual(["p25"]);
    await typeInto(search, "nobody");
    expect(container.textContent).toContain("No matches for “nobody”");
  });
  it("accepts a typed value when allowCustom is set", async () => {
    const onChange = vi.fn();
    const container = await mount(createElement(Select, { options, searchable: true, allowCustom: true, allowEmpty: true, onChange }));
    await searchAndChoose(container.querySelector(".mbctl-select")!, "Courier");
    expect(onChange).toHaveBeenCalledWith("Courier");
    expect(container.querySelector(".mbctl-trigger")!.textContent).toContain("Courier");
  });
  it("supports controlled use", async () => {
    function Controlled(): ReactElement { const [value, setValue] = useState("mail"); return createElement("div", null, createElement(Select, { value, onChange: setValue, options }), createElement("output", null, value)); }
    const container = await mount(createElement(Controlled));
    expect(selectValue(container.querySelector(".mbctl-select")!)).toBe("mail");
    await choose(container.querySelector(".mbctl-select")!, "email");
    expect(container.querySelector("output")!.textContent).toBe("email");
  });
  it("blocks a required empty choice and says so", async () => {
    const container = await mount(createElement("form", null, createElement(Select, { name: "document", required: true, label: "UR decision letter", allowEmpty: true, options })));
    const form = container.querySelector("form")!;
    let valid = true; await act(async () => { valid = form.checkValidity(); });
    expect(valid).toBe(false);
    expect(container.querySelector(".mbctl-error")?.textContent).toBe("Choose ur decision letter.");
    expect(container.querySelector(".mbctl-trigger")!.getAttribute("aria-invalid")).toBe("true");
    await choose(container.querySelector(".mbctl-select")!, "fax");
    expect(form.checkValidity()).toBe(true);
    expect(container.querySelector(".mbctl-error")).toBeNull();
  });
  it("is disabled with its fieldset and leaves the value out of the form", async () => {
    const container = await mount(createElement("form", null, createElement(Select, { name: "channel", disabled: true, defaultValue: "fax", options })));
    expect(container.querySelector<HTMLButtonElement>(".mbctl-trigger")!.disabled).toBe(true);
    expect(formData(container).get("channel")).toBeNull();
  });
});

describe("MultiSelect", () => {
  it("submits each chosen value under the same name", async () => {
    const container = await mount(createElement("form", null, createElement(MultiSelect, { name: "documents", options })));
    const select = container.querySelector(".mbctl-select")!;
    await act(async () => select.querySelector<HTMLButtonElement>(".mbctl-trigger")!.click());
    await act(async () => select.querySelector<HTMLElement>('li[data-value="fax"]')!.click());
    await act(async () => select.querySelector<HTMLElement>('li[data-value="email"]')!.click());
    expect(formData(container).getAll("documents")).toEqual(["fax", "email"]);
    expect(select.querySelector(".mbctl-trigger")!.textContent).toContain("2 selected");
  });
});

describe("dates and times", () => {
  it("parses typed dates and times", () => {
    expect(parseDateText("09/17/2026")).toBe("2026-09-17");
    expect(parseDateText("9/7/2026")).toBe("2026-09-07");
    expect(parseDateText("2026-09-17")).toBe("2026-09-17");
    expect(parseDateText("09172026")).toBe("2026-09-17");
    expect(parseDateText("02/30/2026")).toBeNull();
    expect(parseDateText("9/7/26", true)).toBeNull();
    expect(parseDateText("9/7/26")).toMatch(/^\d{2}26-09-07$/);
    expect(formatDateText("2026-09-17")).toBe("09/17/2026");
    expect(parseTimeText("3:00 PM")).toBe("15:00");
    expect(parseTimeText("3pm")).toBe("15:00");
    expect(parseTimeText("12:15 am")).toBe("00:15");
    expect(parseTimeText("15:30")).toBe("15:30");
    expect(parseTimeText("1530")).toBe("15:30");
    expect(parseTimeText("13 pm")).toBeNull();
    expect(parseTimeText("9:75")).toBeNull();
    expect(formatTimeText("15:05")).toBe("3:05 PM");
    expect(formatTimeText("00:00")).toBe("12:00 AM");
  });
  it("commits a typed date and shows it formatted", async () => {
    const onChange = vi.fn();
    const container = await mount(createElement("form", null, createElement(DateField, { name: "from", onChange })));
    const input = container.querySelector<HTMLInputElement>(".mbctl-text")!;
    await typeInto(input, "09/17/2026");
    expect(onChange).toHaveBeenLastCalledWith("2026-09-17");
    expect(formData(container).get("from")).toBe("2026-09-17");
  });
  it("flags text that is not a date and blocks the form", async () => {
    const container = await mount(createElement("form", null, createElement(DateField, { name: "from", defaultValue: "2026-09-17" })));
    const input = container.querySelector<HTMLInputElement>(".mbctl-text")!;
    await typeInto(input, "13/45");
    await act(async () => { input.dispatchEvent(new FocusEvent("focusout", { bubbles: true })); input.dispatchEvent(new FocusEvent("blur")); });
    expect(container.querySelector(".mbctl-error")?.textContent).toBe("Enter a date as MM/DD/YYYY.");
    expect(formData(container).get("from")).toBe("");
    expect(container.querySelector("form")!.checkValidity()).toBe(false);
  });
  it("picks a date from the calendar and honours min and max", async () => {
    const container = await mount(createElement("form", null, createElement(DateField, { name: "on", defaultValue: "2026-09-10", min: "2026-09-05", max: "2026-09-20" })));
    await act(async () => container.querySelector<HTMLButtonElement>(".mbctl-icon")!.click());
    const day = (iso: string) => container.querySelector<HTMLButtonElement>(`button[data-iso="${iso}"]`)!;
    expect(day("2026-09-04").disabled).toBe(true);
    expect(day("2026-09-21").disabled).toBe(true);
    expect(day("2026-09-10").getAttribute("aria-pressed")).toBe("true");
    await act(async () => day("2026-09-15").click());
    expect(formData(container).get("on")).toBe("2026-09-15");
    expect(container.querySelector<HTMLInputElement>(".mbctl-text")!.value).toBe("09/15/2026");
    expect(container.querySelector("[role=dialog]")).toBeNull();
  });
  it("moves through the calendar with the keyboard", async () => {
    const container = await mount(createElement("form", null, createElement(DateField, { name: "on", defaultValue: "2026-09-10" })));
    await act(async () => container.querySelector<HTMLButtonElement>(".mbctl-icon")!.click());
    const grid = container.querySelector(".mbctl-cal-grid")!;
    await key(grid, "ArrowRight"); await key(grid, "ArrowDown");
    expect(container.querySelector('button[tabindex="0"]')?.getAttribute("data-iso")).toBe("2026-09-18");
    await key(grid, "PageDown");
    expect(container.querySelector('button[tabindex="0"]')?.getAttribute("data-iso")).toBe("2026-10-18");
  });
  it("combines a date and a typed time", async () => {
    const container = await mount(createElement("form", null, createElement(DateTimeField, { name: "at", label: "Appointment", required: true })));
    const [dateInput, timeInput] = [...container.querySelectorAll<HTMLInputElement>(".mbctl-text")];
    await typeInto(dateInput!, "09/18/2026");
    expect(formData(container).get("at")).toBe("");
    expect(container.querySelector("form")!.checkValidity()).toBe(false);
    await typeInto(timeInput!, "10:30 am");
    expect(formData(container).get("at")).toBe("2026-09-18T10:30");
    expect(container.querySelector("form")!.checkValidity()).toBe(true);
  });
  it("accepts a programmatic value on its form input", async () => {
    const container = await mount(createElement("form", null, createElement(DateTimeField, { name: "at" }), createElement(TimeField, { name: "time" })));
    const set = (name: string, value: string) => act(async () => { const input = container.querySelector<HTMLInputElement>(`[name="${name}"]`)!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("change", { bubbles: true })); });
    await set("at", "2026-09-18T15:00"); await set("time", "08:05");
    expect(formData(container).get("at")).toBe("2026-09-18T15:00");
    expect([...container.querySelectorAll<HTMLInputElement>(".mbctl-text")].map(input => input.value)).toEqual(["09/18/2026", "3:00 PM", "8:05 AM"]);
  });
});
