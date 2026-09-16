import { expect, it, vi } from "vitest";
import { createRfaClient } from "../packages/browser/src/index";
it("refreshes expired RFA credentials once and retains the exact mutation key and body", async () => {
 const session = vi.fn().mockResolvedValueOnce({token:"synthetic_old"}).mockResolvedValue({token:"synthetic_new"});
 const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({}, {status:401})).mockResolvedValue(Response.json({data:{id:"rfa_synthetic"}}));
 const client=createRfaClient({getSession:session,fetch:fetcher});
 await client.sign("synthetic/id",{snapshotId:"snapshot_synthetic",contentHash:"synthetic_hash",renderingProviderId:"provider_synthetic",physicianAuthorized:true,actorReference:"user_synthetic"},"synthetic_retry_key");
 expect(session).toHaveBeenCalledTimes(2);
 const calls=fetcher.mock.calls;
 expect(String(calls[0]?.[0])).toContain("synthetic%2Fid/sign");
 expect(calls[0]?.[1]?.body).toBe(calls[1]?.[1]?.body);
 for(const call of calls) expect(new Headers(call[1]?.headers).get("idempotency-key")).toBe("synthetic_retry_key");
 expect(new Headers(calls[1]?.[1]?.headers).get("authorization")).toBe("Bearer synthetic_new");
});
it("requires signing attestation and never sends a JSON content type for multipart reports", async()=>{
 const fetcher=vi.fn<typeof fetch>().mockResolvedValue(Response.json({data:{id:"rfa_synthetic"}}));
 const client=createRfaClient({getSession:async()=>({token:"synthetic_token"}),fetch:fetcher});
 await expect(client.sign("rfa_synthetic",{snapshotId:"s",contentHash:"h",renderingProviderId:"p",actorReference:"",physicianAuthorized:true},"key")).rejects.toThrow("authorization");
 expect(fetcher).not.toHaveBeenCalled();
 await client.uploadDocument("rfa_synthetic",{file:new File(["%PDF-synthetic"],"synthetic.pdf",{type:"application/pdf"}),documentType:"clinical_report",contentRevision:3},"upload_synthetic");
 const init=fetcher.mock.calls[0]?.[1];expect(new Headers(init?.headers).has("content-type")).toBe(false);
 expect((init?.body as FormData).get("contentRevision")).toBe("3");
});
it("returns authenticated PDF bytes and preserves fax recipient and packet selections",async()=>{
 const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(new Response("%PDF-synthetic",{headers:{"content-type":"application/pdf"}})).mockResolvedValueOnce(Response.json({data:{id:"rfa_synthetic"}}));
 const client=createRfaClient({getSession:async()=>({token:"synthetic_token"}),fetch:fetcher});
 expect(await (await client.previewPacket("rfa_synthetic",["form_synthetic","clinical_synthetic"])).text()).toBe("%PDF-synthetic");
 await client.sendFax("rfa_synthetic",{to:"+18005550100",documentIds:["form_synthetic","clinical_synthetic"]},"send_synthetic");
 expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({to:"+18005550100",documentIds:["form_synthetic","clinical_synthetic"]});
});
it("replaces drafts with the exact expected revision and stable item IDs across an authentication retry", async () => {
 const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({}, {status:401})).mockResolvedValueOnce(Response.json({data:{id:"rfa_synthetic",contentRevision:4}}));
 const client=createRfaClient({getSession:async()=>({token:"synthetic_token"}),fetch:fetcher});
 const draft={expectedRevision:3,employeeName:"Synthetic patient",providerName:"Synthetic provider",items:[{id:"item_synthetic",externalId:"strip",diagnosisCode:"M54.5",serviceDescription:"Synthetic service",metadata:{host:"retained"}}],claimId:"immutable",signedAt:"must_not_sign"};
 await client.updateDraft("synthetic/id",draft,"edit_key");
 const calls=fetcher.mock.calls; expect(calls).toHaveLength(2);
 expect(String(calls[0]?.[0])).toContain("synthetic%2Fid/draft"); expect(calls[0]?.[1]?.method).toBe("PATCH");
 expect(calls[0]?.[1]?.body).toBe(calls[1]?.[1]?.body);
 const body=JSON.parse(String(calls[0]?.[1]?.body));expect(body.expectedRevision).toBe(3);expect(body.items[0].id).toBe("item_synthetic");expect(body.items[0].metadata).toEqual({host:"retained"});
 expect(body).not.toHaveProperty("claimId");expect(body).not.toHaveProperty("signedAt");expect(body.items[0]).not.toHaveProperty("externalId");
 for(const call of calls)expect(new Headers(call[1]?.headers).get("idempotency-key")).toBe("edit_key");
 await expect(client.updateDraft("rfa",{...draft,expectedRevision:0},"bad")).rejects.toThrow("revision");expect(fetcher).toHaveBeenCalledTimes(2);
});
