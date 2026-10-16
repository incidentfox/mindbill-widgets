import { expect, it, vi } from "vitest";
import { createRfaClient } from "../packages/browser/src/index";

const session = async () => ({ token: "mbes_synthetic", apiBaseUrl: "https://api.example.test" });
const calls = (fetch: ReturnType<typeof vi.fn>) => fetch.mock.calls.map(([url, init]) => [String(url), (init as RequestInit | undefined)?.method ?? "GET"]);

it("previews, response reading, templates and export use the canonical partner RFA routes", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
    const url = String(input);
    if (url.includes("response-reading")) return Response.json({ data: { status: "read", items: [{ itemId: "item_1", outcome: "approved", confident: true, authorizationNumber: "AUTH-1" }] } });
    if (url.includes("rfa-templates")) return url.endsWith("rfa-templates") || url.includes("?") ? Response.json({ data: [{ id: "tpl_1", name: "PT", billingProviderId: "bp_1", renderingProviderId: null, active: true, items: [] }] }) : Response.json({ data: { id: "tpl_1", name: "PT", billingProviderId: "bp_1", renderingProviderId: null, active: true, items: [] } });
    return new Response(new Blob(["%PDF-1.7"]), { headers: { "content-type": "application/pdf" } });
  });
  const client = createRfaClient({ getSession: session, fetch });
  await client.previewForm!("rfa_1", { packet: true });
  await client.previewDraft!({ claimId: "clm_1", items: [{ serviceDescription: "Physical therapy" }] });
  await expect(client.readResponse!("rfa_1", "doc_1")).resolves.toMatchObject({ status: "read" });
  await expect(client.listTemplates!("bp_1")).resolves.toHaveLength(1);
  await client.saveTemplate!({ id: "tpl_1", name: "PT", billingProviderId: "bp_1", items: [] }, "key-1");
  await client.exportCsv!({ claimId: "clm_1" });
  await client.getCreationContext({ claimId: "clm_1" }).catch(() => undefined);
  expect(calls(fetch)).toEqual([
    ["https://api.example.test/partner/v2/rfas/rfa_1/form-preview?packet=1", "GET"],
    ["https://api.example.test/partner/v2/rfas/draft-preview", "POST"],
    ["https://api.example.test/partner/v2/rfas/rfa_1/response-reading", "POST"],
    ["https://api.example.test/partner/v2/rfa-templates?billingProviderId=bp_1", "GET"],
    ["https://api.example.test/partner/v2/rfa-templates/tpl_1", "PATCH"],
    ["https://api.example.test/partner/v2/rfas/export?claimId=clm_1", "GET"],
    ["https://api.example.test/partner/v2/rfas/creation-context?claimId=clm_1", "GET"],
  ]);
});
