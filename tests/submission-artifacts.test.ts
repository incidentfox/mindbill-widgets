import { describe, expect, it, vi } from "vitest";
import { createBillLifecycleClient } from "../packages/browser/src/index";

const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
const session = () => json({ token: "synthetic-token", expiresAt: "2099-01-01T00:00:00Z" });

describe("retained submission files and IBR preparation", () => {
  it("downloads an exact attempt artifact under the original root bill, never the current packet", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(session()).mockResolvedValueOnce(new Response("immutable bytes"));
    const client = createBillLifecycleClient({ billId: "root-bill", fetch: fetcher });
    expect(await (await client.getSubmissionArtifact("attempt/old", "attachment-0")).text()).toBe("immutable bytes");
    expect(String(fetcher.mock.calls[1]![0])).toContain("/bills/root-bill/submissions/attempt%2Fold/artifacts/attachment-0");
    expect(new Headers(fetcher.mock.calls[1]![1]?.headers).get("authorization")).toBe("Bearer synthetic-token");
  });

  it.each(["/partner/v2/browser/bills", "/partner/v2/bills"])("prepares and securely downloads a self-filing IBR packet via %s without submitting second review", async (prefix) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(session())
      .mockResolvedValueOnce(json({ ok: true, packetUrl: `${prefix}/current-linked-bill/ibr-packet` }))
      .mockResolvedValueOnce(new Response("pdf bytes", { headers: { "content-type": "application/pdf" } }));
    const client = createBillLifecycleClient({ billId: "root-bill", fetch: fetcher });
    expect(await (await client.prepareIbrPacket()).text()).toBe("pdf bytes");
    expect(JSON.parse(String(fetcher.mock.calls[1]![1]?.body))).toEqual({ action: "independent_bill_review" });
    expect(new Headers(fetcher.mock.calls[1]![1]?.headers).get("idempotency-key")).toBeTruthy();
    expect(String(fetcher.mock.calls[2]![0])).toContain("/bills/current-linked-bill/ibr-packet");
    expect(new Headers(fetcher.mock.calls[2]![1]?.headers).get("authorization")).toBe("Bearer synthetic-token");
  });

  it.each([
    "https://untrusted.example/ibr-packet",
    "//untrusted.example/ibr-packet",
    "/partner/v2/bills/current-linked-bill/ibr-packet?token=exfiltrate",
    "/partner/v2/bills/current-linked-bill/ibr-packet#fragment",
    "/partner/v2/bills/current-linked-bill/../ibr-packet",
    "/partner/v2/bills/%2e%2e/ibr-packet",
    "/partner/v2/bills/current-linked-bill/documents/ibr-packet",
    "/partner/v2/bills/current-linked-bill/ibr-packet/extra",
    "/partner/v2/browser/bills/current-linked-bill/packet",
  ])("rejects unsafe response path %s before disclosing browser credentials", async (packetUrl) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(session())
      .mockResolvedValueOnce(json({ packetUrl }));
    const client = createBillLifecycleClient({ billId: "root-bill", fetch: fetcher });
    await expect(client.prepareIbrPacket()).rejects.toThrow("invalid IBR packet path");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not substitute current files when retained artifacts are missing", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(session())
      .mockResolvedValueOnce(new Response("", { status: 404 }));
    const client = createBillLifecycleClient({ billId: "root-bill", fetch: fetcher });
    await expect(client.getSubmissionArtifact("old", "attachment-0")).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
