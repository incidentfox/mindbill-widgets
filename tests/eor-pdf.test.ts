import { expect, it, vi } from "vitest";
import { createBillLifecycleClient } from "../packages/browser/src/index";

const session = () => new Response(JSON.stringify({ token: "synthetic-token", expiresAt: "2099-01-01T00:00:00Z" }));
it("downloads electronic EOR with the bill-scoped browser credential", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(session())
    .mockResolvedValueOnce(new Response("%PDF-synthetic", { headers: { "content-type": "application/pdf" } }));
  const client = createBillLifecycleClient({ billId: "bill/synthetic", fetch: fetcher });
  expect(await (await client.getElectronicEorPdf()).text()).toBe("%PDF-synthetic");
  expect(String(fetcher.mock.calls[1]![0])).toContain("/bills/bill%2Fsynthetic/eor/pdf");
  expect(new Headers(fetcher.mock.calls[1]![1]?.headers).get("authorization")).toBe("Bearer synthetic-token");
});
it("reports EOR export failures instead of downloading an error response", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(session()).mockResolvedValueOnce(new Response("", { status: 404 }));
  await expect(createBillLifecycleClient({ billId: "bill-synthetic", fetch: fetcher }).getElectronicEorPdf()).rejects.toThrow();
});
