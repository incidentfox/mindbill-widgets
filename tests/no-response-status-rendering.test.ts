// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { ConnectedBillStatus } from "../packages/react/src/connected-bill-status";
import { BillLifecycleProgress } from "../packages/react/src/bill-lifecycle-surfaces";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it.each([
  { state: "accepted", nativeStatus: "accepted_no_response", label: "Accepted – No Response", stage: "Accepted" },
  { state: "accepted_no_response", nativeStatus: "accepted_no_response", label: "Accepted – No Response", stage: "Accepted" },
  { state: "accepted", nativeStatus: "accepted", label: "accepted", stage: "Accepted" },
  { state: "processed", nativeStatus: "accepted_no_response", label: "processed", stage: "Processed" },
])("renders $state / $nativeStatus from the status transport without advancing the rail", async ({ state, nativeStatus, label, stage }) => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ data: {
    billId: "synthetic_no_response", state, nativeStatus,
    submittedAt: "2026-01-01T00:00:00Z", agingDays: 70,
    totalCharge: 100, totalPaid: 0, balanceDue: 100,
  } }));
  try {
    await act(async () => root.render(createElement("div", null,
      createElement(ConnectedBillStatus, {
        billId: "synthetic_no_response", getSession: async () => ({ token: "synthetic_session" }),
        fetch: fetcher, refreshInterval: 0,
      }),
      createElement(BillLifecycleProgress, { state, nativeStatus }),
    )));
    expect(fetcher).toHaveBeenCalledOnce();
    expect(container.querySelector(".mb-native-status h3")?.textContent).toBe(label);
    expect(container.querySelector('[aria-current="step"] b')?.textContent).toBe(stage);
    if (stage === "Accepted") {
      expect(container.querySelectorAll(".mb-progress-list .is-upcoming b")[0]?.textContent).toBe("Processed");
    }
    if (label === "Accepted – No Response") {
      expect(container.querySelector(".mb-progress header strong")?.textContent).toBe(label);
    }
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
