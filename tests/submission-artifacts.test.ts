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

  it("prepares and securely downloads a self-filing IBR packet without submitting second review", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(session())
      .mockResolvedValueOnce(json({ ok: true, packetUrl: "/partner/v2/browser/bills/current-linked-bill/ibr-packet" }))
      .mockResolvedValueOnce(new Response("pdf bytes", { headers: { "content-type": "application/pdf" } }));
    const client = createBillLifecycleClient({ billId: "root-bill", fetch: fetcher });
    expect(await (await client.prepareIbrPacket()).text()).toBe("pdf bytes");
    expect(JSON.parse(String(fetcher.mock.calls[1]![1]?.body))).toEqual({ action: "independent_bill_review" });
    expect(new Headers(fetcher.mock.calls[1]![1]?.headers).get("idempotency-key")).toBeTruthy();
    expect(String(fetcher.mock.calls[2]![0])).toContain("/bills/current-linked-bill/ibr-packet");
    expect(new Headers(fetcher.mock.calls[2]![1]?.headers).get("authorization")).toBe("Bearer synthetic-token");
  });

  it("rejects arbitrary response URLs before disclosing browser credentials", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(session())
      .mockResolvedValueOnce(json({ packetUrl: "https://untrusted.example/ibr-packet" }));
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
