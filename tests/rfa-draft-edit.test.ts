import { expect, it } from "vitest";
import type { RfaRecord } from "../packages/browser/src/index";
import { canEditRfaDraft, rfaDraftReplacement, rfaRecordToDraft } from "../packages/react/src/rfa-draft-edit";
const rfa = {
 id:"synthetic_rfa",contentRevision:3,claimId:"synthetic_claim",patientId:"synthetic_patient",renderingProviderId:"synthetic_provider",employeeName:"Synthetic patient",providerName:"Synthetic provider",status:"ready",reviewType:"prospective",expedited:false,signedAt:"2026-09-16T00:00:00Z",submittedAt:null,receivedAt:null,transmissions:[],metadata:{context:"synthetic"},providerFax:null,
 items:[{id:"synthetic_keep",diagnosisCode:"M54.5",serviceDescription:"Keep service",frequency:"Weekly",metadata:{context:"line"}},{id:"synthetic_remove",diagnosisCode:"M54.5",serviceDescription:"Remove service"}],
} as unknown as RfaRecord;
it("preserves retained service identity and metadata while replacing the exact edited collection",()=>{
 const draft=rfaRecordToDraft(rfa);
 draft.items=[{...draft.items[0]!,frequency:"Twice weekly"},{diagnosisCode:"M25.5",serviceDescription:"New service",externalId:"must_not_send"}];
 const replacement=rfaDraftReplacement(draft,3);
 expect(replacement.expectedRevision).toBe(3);expect(replacement.metadata).toEqual(rfa.metadata);
 expect(replacement.items).toEqual([{id:"synthetic_keep",diagnosisCode:"M54.5",serviceDescription:"Keep service",frequency:"Twice weekly",metadata:{context:"line"}},{diagnosisCode:"M25.5",serviceDescription:"New service"}]);
 for(const key of ["claimId","patientId","renderingProviderId","externalId","signedAt","providerFax"])expect(replacement).not.toHaveProperty(key);
 expect(rfa.items[0]?.frequency).toBe("Weekly");
});
it("allows signed unsent drafts but freezes content on receipt or attempted submission evidence",()=>{
 expect(canEditRfaDraft(rfa)).toBe(true);
 for(const changed of [{status:"submitted"},{submittedAt:"2026-09-16"},{receivedAt:"2026-09-16"},... ["queued","sent","delivered","received"].map(status=>({transmissions:[{purpose:"submission",direction:"outbound",status}]}))]){
 expect(canEditRfaDraft({...rfa,...changed} as RfaRecord)).toBe(false);
 }
 expect(canEditRfaDraft({...rfa,transmissions:[{purpose:"information_response",direction:"outbound",status:"delivered"}]} as RfaRecord)).toBe(true);
});
