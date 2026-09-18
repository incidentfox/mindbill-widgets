// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { RfaTrackingPanel, type RfaTrackingPanelProps } from "../packages/react/src/rfa-tracking-panel";
import type { RfaHistoryEvent, RfaRecord, RfaScheduling } from "../packages/browser/src/index";
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

it.each(["no_appointment", "canceled"] as const)("preserves saved %s disposition and reason when reopened",async disposition=>{
 const view=await setup({permissions:["edit"]},async url=>String(url).endsWith("/scheduling")?Response.json({data:[{...appointment,version:3,disposition,current:true,reason:"Synthetic saved reason"}]}):String(url).endsWith("/events")?Response.json({data:history}):Response.json({data:record}));try{
 const select=[...view.container.querySelectorAll("select")].find(node=>node.parentElement?.textContent?.startsWith("Disposition"))!;expect(select.value).toBe(disposition);expect(view.container.querySelector<HTMLTextAreaElement>('textarea[name="reason"]')?.value).toBe("Synthetic saved reason");
 await act(async()=>submit(view.container,"Save appointment"));const request=view.fetcher.mock.calls.find(call=>call[1]?.method==="PATCH");expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({disposition,reason:"Synthetic saved reason",expectedVersion:3});
 }finally{await view.close();}
});

function event(payload: Record<string, unknown>, eventType = "rfa.updated"): RfaHistoryEvent {
 return {id:"event_synthetic",sequence:1,eventType,actor:"Synthetic operator",occurredAt:"2026-09-16T00:00:00Z",payload};
}
const historyFetch = (events: RfaHistoryEvent[]): typeof fetch => async url => String(url).endsWith("/scheduling") ? Response.json({data:[appointment]}) : String(url).endsWith("/events") ? Response.json({data:events}) : new Response("synthetic PDF",{headers:{"content-type":"application/pdf"}});

it("expands historical delivery details without substituting the transmission's current status or inventing a receipt", async()=>{
 const view=await setup({},historyFetch([event({transmissionId:"transmission_one",status:"queued",purpose:"forward",packetId:"packet_one",recipientName:"Synthetic adjuster",message:"Synthetic cover message",actorId:"PRIVATE-ACTOR",binding:"PRIVATE-BINDING",packetSha256:"PRIVATE-HASH"},"rfa.transmission_recorded")]));
 try {
  const details=[...view.container.querySelectorAll("summary")].find(node=>node.textContent==="Event details")!.parentElement as HTMLDetailsElement;
  expect(details.open).toBe(false); await act(async()=>{details.open=true;});
  expect(details.textContent).toContain("Statusqueued");expect(details.textContent).not.toContain("Statussent");
  expect(details.textContent).toContain("Recipient+15555550123");expect(details.textContent).toContain("Synthetic adjuster");expect(details.textContent).toContain("Synthetic cover message");
  expect(details.textContent).toContain("SYNTHETIC-REFERENCE");expect(details.textContent).not.toContain("Confirmed receipt");expect(details.textContent).not.toContain("Number of pages");
  expect(view.container.textContent).not.toMatch(/PRIVATE-(ACTOR|BINDING|HASH)/);
 } finally {await view.close();}
});

it("shows appointment history and its treatment without exposing concurrency metadata",async()=>{
 const view=await setup({},historyFetch([event({action:"scheduling_updated",itemId:"item_one",disposition:"scheduled",details:{appointmentAt:"2026-09-20T10:00:00Z",providerName:"Synthetic appointment physician",location:"Synthetic treatment office",authorizationToken:"PRIVATE-TOKEN",expectedVersion:12}})]));
 try {
  const details=[...view.container.querySelectorAll("summary")].find(node=>node.textContent==="Event details")!.parentElement as HTMLDetailsElement;
  expect(details.textContent).toContain("Appointment details");expect(details.textContent).toContain("Synthetic appointment physician");expect(details.textContent).toContain("Synthetic treatment office");
  expect(view.container.querySelector('a[href="#rfa-treatment-item_one"]')?.textContent).toBe("Treatment 1: Synthetic therapy");
  expect(view.container.textContent).not.toContain("PRIVATE-TOKEN");expect(details.textContent).not.toContain("expectedVersion");
 }finally{await view.close();}
});

it("preserves original and corrected treatment decisions with evidence and excludes unknown changed fields",async()=>{
 const view=await setup({},historyFetch([event({itemId:"item_one",reason:"Synthetic documented correction",changedFields:["items","authorizationToken","PRIVATE-FIELD"],before:{decidedAt:"2026-09-15T00:00:00Z",responseDocumentId:"ur_original",decisions:[{itemId:"item_one",outcome:"denied",decisionReason:"Synthetic original reason",reviewerName:"Synthetic reviewer"}]},replacement:{decidedAt:"2026-09-16T00:00:00Z",responseDocumentId:"ur_one",decisions:[{itemId:"item_one",outcome:"approved",authorizationNumber:"SYNTHETIC-UPDATED",authorizedQuantity:4,effectiveFrom:"2026-09-18",effectiveTo:"2026-10-18"}]}},"rfa.decision_corrected")]));
 try {
  const content=view.container.textContent!;
  expect(content).toContain("Recorded by Synthetic operator");expect(content).toContain("Synthetic documented correction");expect(content).toContain("Original decision");expect(content).toContain("Corrected decision");
  expect(content).toContain("Synthetic original reason");expect(content).toContain("SYNTHETIC-UPDATED");expect(content).toContain("Authorized quantity4");
  expect(content).toContain("Changed fields: Requested treatments");expect(content).not.toContain("PRIVATE-FIELD");expect(content).not.toContain("authorizationToken");
  expect(content).toContain("Original: Download decision evidence");expect(content).toContain("Corrected: Download decision evidence: Synthetic response.pdf");
 }finally{await view.close();}
});

it("downloads exact retained packets and documents through the authenticated RFA client",async()=>{
 const createUrl=vi.spyOn(URL,"createObjectURL").mockReturnValue("blob:synthetic-evidence");const click=vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(()=>undefined);
 const view=await setup({},historyFetch([event({packetId:"packet_one",responseDocumentId:"ur_one"},"rfa.transmission_recorded")]));
 try {
  for(const label of ["Download retained submission PDF","Download decision evidence: Synthetic response.pdf"]){await act(async()=>{[...view.container.querySelectorAll("button")].find(button=>button.textContent===label)!.click();});}
  const downloads=view.fetcher.mock.calls.filter(call=>/\/(packets|documents)\//.test(String(call[0])));
  expect(downloads).toHaveLength(2);expect(String(downloads[0]![0])).toContain("/rfas/rfa_synthetic/packets/packet_one");expect(String(downloads[1]![0])).toContain("/rfas/rfa_synthetic/documents/ur_one");
  for(const [,init] of downloads){expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer synthetic_token");expect(init?.method).toBeUndefined();}
  expect(click).toHaveBeenCalledTimes(2);expect(createUrl).toHaveBeenCalledTimes(2);
 }finally{await view.close();click.mockRestore();createUrl.mockRestore();}
});

it("surfaces evidence download failures without leaving the RFA history",async()=>{
 const fetcher=historyFetch([event({packetId:"packet_missing"},"rfa.transmission_recorded")]);
 const view=await setup({},async(url,init)=>String(url).includes("/packets/")?Response.json({detail:"Synthetic packet unavailable"},{status:404}):fetcher(url,init));
 try{await act(async()=>{[...view.container.querySelectorAll("button")].find(button=>button.textContent==="Download retained submission PDF")!.click();});expect(view.container.querySelector('[role="alert"]')?.textContent).toContain("Synthetic packet unavailable");expect(view.container.textContent).toContain("History and notes");}finally{await view.close();}
});

const pendingRecord: RfaRecord = {...record, status:"under_review", items:[{...record.items[0]!, outcome:"pending", decidedAt:null, currentDecisionEventId:null}, {...record.items[0]!, id:"item_two"}]};
it("closes only an undecided treatment with a reason and can reopen it without changing the clinical outcome",async()=>{
 let current=pendingRecord;const onUpdated=vi.fn();
 const view=await setup({rfa:current,permissions:["edit"],onUpdated},async(url,init)=>{
  if(String(url).endsWith("/closure")){const body=JSON.parse(String(init?.body));current={...current,items:current.items.map((item,index)=>index===0?{...item,decisionClosure:{closed:body.closed,reason:body.reason,version:body.expectedVersion+1,updatedAt:"2026-09-18T12:00:00Z",updatedBy:"Synthetic operator"}}:item)};return Response.json({data:current});}
  return Response.json({data:String(url).endsWith("/events")?history:[]});
 });
 try{
  expect(view.container.querySelectorAll('[name="closureReason"]')).toHaveLength(1);
  await act(async()=>submit(view.container,"Close treatment"));expect(view.container.textContent).toContain("Enter");expect(onUpdated).not.toHaveBeenCalled();
  await act(async()=>{set(view.container,"closureReason","Patient no longer requests treatment");submit(view.container,"Close treatment");});
  expect(current.items[0]?.outcome).toBe("pending");expect(current.items[1]?.outcome).toBe("approved");
  expect(view.container.textContent).toContain("Closed by Synthetic operator");expect(view.container.textContent).toContain("Patient no longer requests treatment");
  await act(async()=>{set(view.container,"closureReason","Patient requests follow-up again");submit(view.container,"Reopen treatment");});
  const calls=view.fetcher.mock.calls.filter(call=>String(call[0]).endsWith("/closure"));expect(calls).toHaveLength(2);
  expect(JSON.parse(String(calls[0]?.[1]?.body))).toEqual({closed:true,reason:"Patient no longer requests treatment",expectedVersion:0});
  expect(JSON.parse(String(calls[1]?.[1]?.body))).toEqual({closed:false,reason:"Patient requests follow-up again",expectedVersion:1});
  expect(view.container.textContent).toContain("Reopened by Synthetic operator");expect(onUpdated).toHaveBeenCalledTimes(2);
 }finally{await view.close();}
});
it("hides administrative closure without edit permission and for draft or decided treatments",async()=>{
 for(const props of [{rfa:pendingRecord},{rfa:{...pendingRecord,status:"draft" as const},permissions:["edit"] as const},{rfa:record,permissions:["edit"] as const}]){
  const view=await setup(props);try{expect(view.container.querySelector('[name="closureReason"]')).toBeNull();}finally{await view.close();}
 }
});
it("keeps closure retry idempotent and leaves treatment open on a failed mutation",async()=>{
 const view=await setup({rfa:pendingRecord,permissions:["edit"]},async(url,init)=>init?.method==="PATCH"?Response.json({detail:"Synthetic conflict; refresh the treatment"},{status:409}):Response.json({data:String(url).endsWith("/events")?history:[]}));
 try{
  await act(async()=>{set(view.container,"closureReason","Synthetic administrative reason");submit(view.container,"Close treatment");});
  await act(async()=>submit(view.container,"Close treatment"));
  const calls=view.fetcher.mock.calls.filter(call=>call[1]?.method==="PATCH");expect(calls).toHaveLength(2);
  expect(new Headers(calls[0]?.[1]?.headers).get("idempotency-key")).toBe(new Headers(calls[1]?.[1]?.headers).get("idempotency-key"));
  expect(view.container.textContent).toContain("Synthetic conflict");expect(view.container.textContent).not.toContain("Reopen treatment follow-up");
 }finally{await view.close();}
});
it("shows actor-attributed closure and reopening reasons in history",async()=>{
 const view=await setup({},historyFetch([event({action:"treatment_closed",itemId:"item_one",reason:"Synthetic closure reason",version:1}),{...event({action:"treatment_reopened",itemId:"item_one",reason:"Synthetic reopen reason",version:2}),id:"event_reopened"}]));
 try{expect(view.container.textContent).toContain("Treatment closed — decision no longer required");expect(view.container.textContent).toContain("Treatment follow-up reopened");expect(view.container.textContent).toContain("Synthetic closure reason");expect(view.container.textContent).toContain("Synthetic reopen reason");expect(view.container.textContent).toContain("Synthetic operator");}finally{await view.close();}
});
