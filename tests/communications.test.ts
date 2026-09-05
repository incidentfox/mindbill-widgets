import { describe, expect, it, vi } from "vitest";
import { createBillLifecycleClient } from "../packages/browser/src/index";
import { billTeamNotes } from "../packages/react/src/connected-bill-lifecycle";

describe("bill communications", () => {
  it("requires a preview and reuses the caller's delivery identity on retries", async () => {
    const response = (data: unknown) => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({ token: "synthetic-token", expiresAt: "2099-01-01T00:00:00Z" }))
      .mockResolvedValueOnce(response({ packetHash: "hash", environment: "sandbox", pdfBase64: "", filename: "bill.pdf", documentCount: 1 }))
      .mockResolvedValueOnce(response({ ok: true, sent: false, simulated: true }))
      .mockResolvedValueOnce(response({ ok: true, sent: false, simulated: true }));
    const client = createBillLifecycleClient({ billId: "synthetic-bill", fetch: fetcher });
    const input = { to: ["recipient@example.com"], subject: "Courtesy copy", bodyText: "For your records." };
    await expect(client.previewCourtesyCopy(input)).resolves.toMatchObject({ packetHash: "hash" });
    await client.sendCourtesyCopy({ ...input, packetHash: "hash" }, "delivery-1");
    await client.sendCourtesyCopy({ ...input, packetHash: "hash" }, "delivery-1");
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toMatchObject({ mode: "preview", ...input });
    for (const index of [2, 3]) {
      expect(new Headers(fetcher.mock.calls[index]?.[1]?.headers).get("Idempotency-Key")).toBe("delivery-1");
      expect(JSON.parse(String(fetcher.mock.calls[index]?.[1]?.body))).toMatchObject({ mode: "send", packetHash: "hash" });
    }
    await expect(client.sendCourtesyCopy({ ...input, packetHash: "hash" }, "")).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("renders native and partner notes once while retaining legacy notes", () => {
    const notes = [{ id: "c-1", body: "Canonical note", author: "Synthetic teammate", createdAt: "2026-09-05T10:00:00Z", pinned: false }];
    const history = [
      { id: "bill:ev-c-1", kind: "note" as const, summary: "Canonical note", date: "2026-09-05T10:00:00Z" },
      { id: "legacy-1", kind: "note" as const, summary: "Older note", date: "2026-09-04T10:00:00Z" },
      { id: "sent-1", kind: "submission" as const, summary: "Sent", date: "2026-09-03T10:00:00Z" },
    ].map((entry) => ({ ...entry, action: "Activity", actor: "Synthetic team", tone: "neutral" as const }));
    expect(billTeamNotes({ notes, history }).map((note) => note.summary)).toEqual(["Canonical note", "Older note"]);
  });
});
