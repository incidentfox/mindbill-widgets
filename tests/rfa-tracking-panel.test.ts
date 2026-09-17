// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { RfaTrackingPanel, type RfaTrackingPanelProps } from "../packages/react/src/rfa-tracking-panel";
import type { RfaRecord, RfaScheduling } from "../packages/browser/src/index";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const record: RfaRecord = { patientId: "patient_synthetic", renderingProviderId: "provider_synthetic", claimsAdminId: null, employeeName: "Synthetic patient", providerName: "Synthetic physician", claimNumber: "SYNTHETIC", reviewType: "prospective", expedited: false, createdAt: null, updatedAt: null, signedAt: null, submittedAt: null, incompleteReason: null, deferredReason: null, closedReason: null, readiness: { ready: true, missing: [] }, transmissions: [{id:"transmission_one",direction:"outbound",channel:"fax",status:"sent",destination:"+15555550123",occurredAt:"2026-09-15T00:00:00Z",receivedAt:null,proofDocumentId:"proof_one",providerMessageId:"SYNTHETIC-REFERENCE"}], events: [], id: "rfa_synthetic", claimId: "claim_synthetic", contentRevision: 1, status: "approved", receivedAt: "2026-09-15T00:00:00Z", decisionDueAt: null, decisionDeadlineBasis: null, documents: [{ id: "ur_one", documentType: "ur_response", filename: "Synthetic response.pdf", contentUrl: "", contentRevision: 1, createdAt: null }, { id: "imr_one", documentType: "imr_form", filename: "Synthetic IMR.pdf", contentUrl: "", contentRevision: 1, createdAt: null }], informationRequests: [], items: [{ id: "item_one", procedureCode: "97110", serviceDescription: "Synthetic therapy", outcome: "approved", diagnosisCode: "M54.5", quantity: 1, units: 1, authorizationNumber: "SYNTHETIC-AUTH", decisionReason: null, currentDecisionEventId:"decision_one",currentResponseDocumentId:"ur_one",decidedAt:"2026-09-16T00:00:00Z" }] };
const appointment: RfaScheduling = {itemId:"item_one",serviceDescription:"Synthetic therapy",outcome:"approved",eligible:true,authorizationToken:"a".repeat(64),version:0,disposition:"pending",current:false,appointmentAt:null,providerName:null,location:null,reason:null,updatedAt:null};
const history = [{id:"event_one",sequence:1,eventType:"rfa.updated",actor:"Synthetic operator",occurredAt:"2026-09-16T00:00:00Z",payload:{action:"note_added",text:"Synthetic history note"}}];
const getSession = async () => ({token:"synthetic_token"});
async function setup(props: Partial<RfaTrackingPanelProps> = {}, override?: typeof fetch) {
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container);
 const fetcher=vi.fn<typeof fetch>(override ?? (async (url,init) => String(url).endsWith("/scheduling") ? Response.json({data:[appointment]}) : String(url).endsWith("/events") ? Response.json({data:init?.method ? history[0] : history}) : Response.json({data:record})));
 await act(async()=>root.render(createElement(RfaTrackingPanel,{rfa:record,options:{getSession,fetch:fetcher},...props})));
 return {container,fetcher,close:async()=>{await act(async()=>root.unmount());container.remove();}};
}
function set(container:HTMLElement,name:string,value:string){const element=container.querySelector<HTMLInputElement|HTMLSelectElement>(`[name="${name}"]`)!;element.value=value;element.dispatchEvent(new Event("change",{bubbles:true}));}
function submit(container:HTMLElement,button:string){[...container.querySelectorAll("button")].find(node=>node.textContent===button)!.closest("form")!.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));}
it("shows treatment decisions, actor-attributed notes and delivery evidence without mutation controls by default",async()=>{
 const view=await setup();try{expect(view.container.textContent).toContain("Synthetic history note");expect(view.container.textContent).toContain("Synthetic operator");expect(view.container.textContent).toContain("SYNTHETIC-REFERENCE");expect(view.container.textContent).not.toContain("Confirmed receipt:");expect(view.container.querySelector('button[type="submit"]')).toBeNull();expect(view.fetcher.mock.calls.every(call=>!call[1]?.method)).toBe(true);}finally{await view.close();}
});
it("saves an appointment using the loaded authorization token and version",async()=>{
 const onUpdated=vi.fn();const view=await setup({permissions:["edit"],onUpdated});try{
 await act(async()=>{set(view.container,"appointmentAt","2026-09-18T10:00");set(view.container,"providerName","Synthetic clinic");set(view.container,"location","Synthetic office");submit(view.container,"Save appointment");});
 const request=view.fetcher.mock.calls.find(call=>call[1]?.method==="PATCH");expect(JSON.parse(String(request?.[1]?.body))).toEqual({expectedVersion:0,authorizationToken:"a".repeat(64),disposition:"scheduled",appointmentAt:new Date("2026-09-18T10:00").toISOString(),providerName:"Synthetic clinic",location:"Synthetic office"});expect(onUpdated).toHaveBeenCalledWith(record);
 }finally{await view.close();}
});
it("requires a correction reason and preserves the prior decision concurrency reference",async()=>{
 const view=await setup({permissions:["act"]});try{
 await act(async()=>submit(view.container,"Save decision correction"));expect(view.container.textContent).toContain("Enter the correction reason");expect(view.fetcher.mock.calls.some(call=>call[1]?.method)).toBe(false);
 await act(async()=>{set(view.container,"reason","Corrected from the signed response");submit(view.container,"Save decision correction");});
 const request=view.fetcher.mock.calls.find(call=>String(call[0]).endsWith("/decision-corrections"));const body=JSON.parse(String(request?.[1]?.body));expect(body.expectedDecisionEventId).toBe("decision_one");expect(body.replacement.responseDocumentId).toBe("ur_one");expect(body.replacement.decisions).toEqual([{itemId:"item_one",outcome:"approved",authorizationNumber:"SYNTHETIC-AUTH"}]);
 }finally{await view.close();}
});
it("does not enable corrections when appointments are scheduled or fail to load",async()=>{
 for(const fail of [false,true]){const view=await setup({permissions:["act"]},async url=>String(url).endsWith("/scheduling") ? fail ? Response.json({detail:"Synthetic load failure"},{status:503}) : Response.json({data:[{...appointment,disposition:"scheduled",version:1}]}) : Response.json({data:history}));try{const button=[...view.container.querySelectorAll("button")].find(node=>node.textContent==="Save decision correction")!;expect(button.closest("fieldset")!.disabled).toBe(true);}finally{await view.close();}}
});
it("keeps note idempotency stable on uncertain retry and never sends a fax",async()=>{
 const view=await setup({permissions:["edit"]},async(url,init)=>init?.method==="POST"?Response.json({detail:"Synthetic temporary failure"},{status:503}):String(url).endsWith("/scheduling")?Response.json({data:[appointment]}):Response.json({data:history}));try{
 await act(async()=>{set(view.container,"note","Synthetic follow-up note");submit(view.container,"Save note");});await act(async()=>submit(view.container,"Save note"));
 const requests=view.fetcher.mock.calls.filter(call=>call[1]?.method==="POST");expect(requests).toHaveLength(2);expect(new Headers(requests[0]?.[1]?.headers).get("idempotency-key")).toBe(new Headers(requests[1]?.[1]?.headers).get("idempotency-key"));expect(JSON.parse(String(requests[0]?.[1]?.body))).toEqual({text:"Synthetic follow-up note"});expect(view.fetcher.mock.calls.some(call=>String(call[0]).endsWith("/fax"))).toBe(false);
 }finally{await view.close();}
});
it("requires a cancellation reason and keeps the current appointment version",async()=>{
 const view=await setup({permissions:["edit"]},async url=>String(url).endsWith("/scheduling")?Response.json({data:[{...appointment,version:4,disposition:"scheduled",current:true,appointmentAt:"2026-09-18T10:00:00Z",providerName:"Synthetic clinic",location:"Synthetic office"}]}):String(url).endsWith("/events")?Response.json({data:history}):Response.json({data:record}));try{
 const select=[...view.container.querySelectorAll("select")].find(node=>node.parentElement?.textContent?.startsWith("Disposition"))!;
 await act(async()=>{select.value="canceled";select.dispatchEvent(new Event("change",{bubbles:true}));});
 await act(async()=>submit(view.container,"Save appointment"));expect(view.container.textContent).toContain("Enter a reason");expect(view.fetcher.mock.calls.some(call=>call[1]?.method==="PATCH")).toBe(false);
 await act(async()=>{set(view.container,"reason","Synthetic cancellation request");submit(view.container,"Save appointment");});
 const request=view.fetcher.mock.calls.find(call=>call[1]?.method==="PATCH");expect(JSON.parse(String(request?.[1]?.body))).toEqual({expectedVersion:4,authorizationToken:"a".repeat(64),disposition:"canceled",reason:"Synthetic cancellation request"});
 }finally{await view.close();}
});
