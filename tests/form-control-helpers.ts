import { act } from "react";

/** Test helpers that drive the shared `Select` the way a person would: open it, then click an option. */

/** Every Select on the page, in document order. */
export function selects(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(".mbctl-select")];
}

/** The Select whose label (or accessible name) starts with `label`. */
export function selectByLabel(root: ParentNode, label: string): HTMLElement {
  const found = selects(root).find(node => node.closest("label")?.textContent?.startsWith(label) || node.parentElement?.textContent?.startsWith(label)
    || node.querySelector(".mbctl-trigger")?.getAttribute("aria-label")?.startsWith(label));
  if (!found) throw new Error(`No select labelled ${label}`);
  return found;
}

/** The value a Select currently holds. */
export const selectValue = (select: Element): string => (select as HTMLElement).dataset.value ?? "";

const trigger = (select: Element) => select.querySelector<HTMLButtonElement>(".mbctl-trigger")!;

/** The option values a Select lists. */
export async function optionValues(select: Element): Promise<string[]> {
  await act(async () => trigger(select).click());
  const values = [...select.querySelectorAll<HTMLElement>("li[role=option]")].map(option => option.dataset.value ?? "");
  await act(async () => trigger(select).click());
  return values;
}

/** Open a Select and click the option with `value`. */
export async function choose(select: Element, value: string): Promise<void> {
  await act(async () => trigger(select).click());
  const option = [...select.querySelectorAll<HTMLElement>("li[role=option]")].find(node => node.dataset.value === value);
  if (!option) throw new Error(`No option ${value}; have ${[...select.querySelectorAll<HTMLElement>("li[role=option]")].map(node => node.dataset.value).join(", ")}`);
  await act(async () => option.click());
}

/** Type into a typed field (date, time or search box) the way a person would. */
export async function typeInto(input: HTMLInputElement, text: string): Promise<void> {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** The option labels a Select lists. */
export async function optionLabels(select: Element): Promise<string[]> {
  await act(async () => trigger(select).click());
  const labels = [...select.querySelectorAll<HTMLElement>("li[role=option]")].map(option => option.firstElementChild?.textContent ?? "");
  await act(async () => trigger(select).click());
  return labels;
}

type Control = HTMLElement;
/** A form control by aria-label or label text: a shared Select root, or a typed input (date fields resolve to their text box). */
export function control(root: ParentNode, label: string): Control {
  const found = [...root.querySelectorAll<HTMLElement>(".mbctl-select, input:not(.mbctl-proxy), select, textarea")].find(item => item.getAttribute("aria-label") === label
    || item.querySelector(".mbctl-trigger")?.getAttribute("aria-label") === label || item.closest("label")?.textContent?.startsWith(label));
  if (!found) throw new Error(`No control labelled ${label}`);
  return found;
}

/** Set a control's value the way a person would: pick from a Select, or type into an input. */
export async function setControl(element: Control, value: string): Promise<void> {
  if (element.classList.contains("mbctl-select")) return choose(element, value);
  if (element instanceof HTMLInputElement) return typeInto(element, value);
  await act(async () => {
    const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLTextAreaElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}

/** The current value of a Select root or input. */
export const controlValue = (element: Control): string => element.classList.contains("mbctl-select") ? selectValue(element) : (element as HTMLInputElement).value;

/** Whether a Select lists `value` as unavailable. */
export async function optionDisabled(select: Element, value: string): Promise<boolean> {
  await act(async () => trigger(select).click());
  const option = [...select.querySelectorAll<HTMLElement>("li[role=option]")].find(node => node.dataset.value === value);
  const disabled = option?.getAttribute("aria-disabled") === "true";
  await act(async () => trigger(select).click());
  return disabled;
}

/** Open a searchable Select, type `text`, and pick the option whose value or label matches it (or the "Use …" choice for a typed value). */
export async function searchAndChoose(select: Element, text: string): Promise<void> {
  await act(async () => trigger(select).click());
  const search = select.querySelector<HTMLInputElement>(".mbctl-pop-search");
  if (!search) throw new Error("This select has no search box");
  await typeInto(search, text);
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  const options = [...select.querySelectorAll<HTMLElement>("li[role=option]")];
  const option = options.find(node => node.dataset.value === text) ?? options.find(node => node.firstElementChild?.firstChild?.textContent === text);
  if (!option) throw new Error(`No option for ${text}; have ${options.map(node => node.dataset.value).join(", ")}`);
  await act(async () => option.click());
}
