import { expect, it, vi } from "vitest";
import { createRfaClient } from "../packages/browser/src/index";
const result={patientId:"patient_synthetic",claimId:"claim_synthetic",patientExternalId:"patient_external",claimExternalId:"claim_external",created:{patient:true,claim:true}};
const input={patient:{externalId:"patient_external",firstName:"Synthetic",lastName:"Patient",dateOfBirth:"1980-01-01",address:{line1:"1 Test Lane",city:"Oakland",state:"CA",postalCode:"94601"}},claim:{externalId:"claim_external",claimNumber:"TEST-CLAIM",employer:"Synthetic employer",dateOfInjury:"2026-01-01",claimsAdministrator:{id:"admin_synthetic",name:"Synthetic administrator"},injuryState:"CA"}};
it("provisions a patient and injury without a bill using the unwrapped v2 result and stable authentication retry",async()=>{
 const getSession=vi.fn().mockResolvedValue({token:"synthetic_token"});
 const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({},{status:401})).mockResolvedValueOnce(Response.json(result,{status:201}));
 const client=createRfaClient({getSession,fetch:fetcher});
 expect(await client.provisionClaim!(input,{idempotencyKey:"setup_synthetic"})).toEqual(result);
 expect(getSession).toHaveBeenCalledTimes(2);expect(fetcher).toHaveBeenCalledTimes(2);
 for(const [url,init] of fetcher.mock.calls){expect(new URL(String(url)).pathname).toBe("/partner/v2/claims");expect(init?.method).toBe("POST");expect(JSON.parse(String(init?.body))).toEqual(input);expect(new Headers(init?.headers).get("idempotency-key")).toBe("setup_synthetic");}
});
it("saves a physician signature through the scoped browser endpoint without signing a request",async()=>{
 const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({data:{providerId:"provider/synthetic",signatureConfigured:true}}));
 const client=createRfaClient({getSession:async()=>({token:"synthetic_token"}),fetch:fetcher});
 const signature={contentBase64:"synthetic_png",physicianAuthorized:true as const,actorReference:"synthetic_staff"};
 expect(await client.saveProviderSignature!("provider/synthetic",signature,{idempotencyKey:"signature_synthetic"})).toEqual({providerId:"provider/synthetic",signatureConfigured:true});
 const [url,init]=fetcher.mock.calls[0]!;expect(new URL(String(url)).pathname).toBe("/partner/v2/browser/rfas/providers/provider%2Fsynthetic/signature");expect(JSON.parse(String(init?.body))).toEqual(signature);expect(new Headers(init?.headers).get("idempotency-key")).toBe("signature_synthetic");expect(fetcher).toHaveBeenCalledOnce();
});
it("rejects malformed setup responses instead of selecting an absent saved identity",async()=>{
 const client=createRfaClient({getSession:async()=>({token:"synthetic_token"}),fetch:vi.fn<typeof fetch>().mockImplementation(async()=>Response.json({data:{}}))});
 await expect(client.provisionClaim!(input,{idempotencyKey:"setup_synthetic"})).rejects.toThrow("response was invalid");
 await expect(client.saveProviderSignature!("provider",{contentBase64:"png",physicianAuthorized:true,actorReference:"staff"},{idempotencyKey:"signature_synthetic"})).rejects.toThrow("could not be confirmed");
});
