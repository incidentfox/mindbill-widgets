// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { ConnectedBillLifecycle } from "../packages/react/src/connected-bill-lifecycle";
import { typeInto } from "./form-control-helpers";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const record = {
  environment: "sandbox",
  bill: { id: "synthetic_bill", billingMode: "professional", dos: "2026-09-28", attachments: [], lineItems: [], totalCharge: 2015, balanceDue: 2015 },
  patient: { name: "Synthetic Patient" }, injury: {},
  lifecycle: { state: "accepted", actions: [{ id: "post_payment", label: "Post payment", enabled: true }] },
  remittance: { payerReportedPaid: null, postedPrincipal: 0 },
  eors: [], payments: [], activity: [], history: [], delivery: { contacts: {} },
};

async function openPaymentDialog(respond: (body: Record<string, unknown>) => Response) {
  const posted: Record<string, unknown>[] = [];
  const fetch = async (_url: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      posted.push(body);
      return respond(body);
    }
    return Response.json({ data: record });
  };
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(createElement(ConnectedBillLifecycle, { billId: "synthetic_bill", refreshInterval: 0, getSession: async () => ({ token: "synthetic-only" }), fetch })));
  const open = [...container.querySelectorAll("button")].find(button => button.textContent === "Post payment")!;
  await act(async () => open.click());
  const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;
  const depositDate = [...dialog.querySelectorAll("label")].find(label => label.textContent?.startsWith("Deposit date"))!.querySelector<HTMLInputElement>(".mbctl-text")!;
  const submit = () => act(async () => [...dialog.querySelectorAll("button")].find(button => button.textContent === "Post payment")!.click());
  return { container, dialog, depositDate, submit, posted, unmount: () => act(async () => { root.unmount(); container.remove(); }) };
}

it("sends a deposit date typed as MM/DD/YYYY in the ISO format the API requires", async () => {
  const view = await openPaymentDialog(() => Response.json({ data: record }));
  try {
    await typeInto(view.depositDate, "10/17/2026");
    await view.submit();
    expect(view.posted).toHaveLength(1);
    expect(view.posted[0]).toMatchObject({ action: "post_payment", amount: 2015, depositDate: "2026-10-17" });
  } finally { await view.unmount(); }
});

it("shows a rejected payment inside the dialog instead of behind it", async () => {
  const view = await openPaymentDialog(() => Response.json({ error: "payment_exceeds_balance", message: "The payment is more than the open balance." }, { status: 409 }));
  try {
    await view.submit();
    expect(view.container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(view.dialog.querySelector('[role="alert"]')?.textContent).toBeTruthy();
  } finally { await view.unmount(); }
});
