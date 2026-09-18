// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { RfaDashboard } from "../packages/react/src/rfa-dashboard";
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const record={id:"rfa_synthetic",contentRevision:1,claimId:"claim_synthetic",patientId:"patient_synthetic",renderingProviderId:"provider_synthetic",claimsAdminId:null,employeeName:"Synthetic patient",providerName:"Synthetic physician",claimNumber:"SYNTHETIC-001",status:"ready",reviewType:"prospective",expedited:false,signedAt:"2026-09-01T00:00:00Z",submittedAt:null,receivedAt:null,createdAt:null,updatedAt:null,decisionDueAt:null,decisionDeadlineBasis:null,incompleteReason:null,deferredReason:null,closedReason:null,readiness:{ready:true,missing:[]},items:[],documents:[{id:"form_synthetic",documentType:"rfa_form",filename:"Synthetic form.pdf",contentUrl:"",contentRevision:1,createdAt:null},{id:"clinical_synthetic",documentType:"clinical_report",filename:"Synthetic report.pdf",contentUrl:"",contentRevision:1,createdAt:null}],transmissions:[],informationRequests:[],events:[]};
it("keeps sandbox delivery disabled and clears selected records when the claim filter changes",async()=>{
 const fetcher=vi.fn<typeof fetch>(async(input)=>String(input).includes("?")?Response.json({data:[record],summary:{total:1,byStatus:{ready:1}},nextCursor:null}):Response.json({data:record}));
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container);const getSession=async()=>({token:"synthetic_token"});
 const render=async(claimId:string)=>act(async()=>root.render(createElement(RfaDashboard,{getSession,fetch:fetcher,claimId,permissions:["send"]})));
 try{
 await render("claim_synthetic");await act(async()=>[...container.querySelectorAll("button")].find(x=>x.textContent==="RFAs")!.click());const review=[...container.querySelectorAll("button")].find(x=>x.textContent==="Review request")!;
 await act(async()=>review.click());expect(container.textContent).toContain("External fax delivery is disabled");expect(container.textContent).not.toContain("Send authorization fax");
 await render("claim_other_synthetic");await act(async()=>[...container.querySelectorAll("button")].find(x=>x.textContent==="RFAs")!.click());expect(container.textContent).not.toContain("Review packet and send");expect(container.textContent).toContain("Review request");
 expect(fetcher.mock.calls.every(x=>(x[1]?.method??"GET")==="GET")).toBe(true);
 }finally{await act(async()=>root.unmount());container.remove();}
});
it("requires packet review and deliberate recipient confirmation before live send",async()=>{
 const fetcher=vi.fn<typeof fetch>(async(input)=>String(input).includes("?")?Response.json({data:[record],summary:{total:1,byStatus:{ready:1}},nextCursor:null}):Response.json({data:record}));
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container);
 try{
 await act(async()=>root.render(createElement(RfaDashboard,{getSession:async()=>({token:"synthetic_token"}),fetch:fetcher,environment:"live",permissions:["send"]})));
 await act(async()=>[...container.querySelectorAll("button")].find(x=>x.textContent==="RFAs")!.click());
 await act(async()=>[...container.querySelectorAll("button")].find(x=>x.textContent==="Review request")!.click());
 const send=[...container.querySelectorAll("button")].find(x=>x.textContent==="Send authorization fax")!;expect(send.disabled).toBe(true);
 await act(async()=>send.click());expect(fetcher.mock.calls.some(x=>String(x[0]).endsWith("/fax"))).toBe(false);
 }finally{await act(async()=>root.unmount());container.remove();}
});
it("selects only the newest signed form for the current content revision",async()=>{
 const current={...record,contentRevision:2,documents:[...record.documents,{id:"form_current_old",documentType:"rfa_form",filename:"Earlier current form.pdf",contentUrl:"",contentRevision:2,createdAt:"2026-09-01T00:00:00Z"},{id:"form_current",documentType:"rfa_form",filename:"Current form.pdf",contentUrl:"",contentRevision:2,createdAt:"2026-09-02T00:00:00Z"}]};
 const fetcher=vi.fn<typeof fetch>(async(input)=>String(input).includes("?")?Response.json({data:[current],summary:{total:1,byStatus:{ready:1}},nextCursor:null}):Response.json({data:current}));
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container);
 try{
 await act(async()=>root.render(createElement(RfaDashboard,{getSession:async()=>({token:"synthetic_token"}),fetch:fetcher})));
 await act(async()=>[...container.querySelectorAll("button")].find(x=>x.textContent==="RFAs")!.click());
 await act(async()=>[...container.querySelectorAll("button")].find(x=>x.textContent==="Review request")!.click());
 const boxes=[...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
 const named=(name:string)=>boxes.find(box=>box.parentElement?.textContent?.includes(name))!;
 expect(named("Synthetic form.pdf").disabled).toBe(true);expect(named("Synthetic form.pdf").checked).toBe(false);
 expect(named("Earlier current form.pdf").checked).toBe(false);expect(named("Current form.pdf").checked).toBe(true);expect(named("Synthetic report.pdf").checked).toBe(true);
 await act(async()=>named("Earlier current form.pdf").click());expect(named("Current form.pdf").checked).toBe(false);
 }finally{await act(async()=>root.unmount());container.remove();}
});
it("edits retained service rows without losing metadata, invalidates the signed form, and keeps stale edits visible",async()=>{
 const current={...record,metadata:{host:"request_context"},providerFax:"+18005550100",requestType:"new",items:[{id:"service_existing",diagnosisCode:"M54.5",serviceDescription:"Existing service",procedureCode:"97110",quantity:2,units:1,frequency:"Weekly",duration:"Two weeks",requestedFrom:"2026-09-01",requestedTo:"2026-09-15",metadata:{host:"service_context"},outcome:"pending",authorizationNumber:null,decisionReason:null}]};
 let stale=true;
 const fetcher=vi.fn<typeof fetch>(async(input,init)=>{
  if(init?.method==="PATCH")return stale?Response.json({error:{message:"Content revision changed"}},{status:409}):Response.json({data:{...current,...JSON.parse(String(init.body)),items:JSON.parse(String(init.body)).items.map((item:object)=>({...item,outcome:"pending"})),contentRevision:2,status:"draft",signedAt:null}});
  return String(input).includes("?")?Response.json({data:[current],summary:{total:1,byStatus:{ready:1}},nextCursor:null}):Response.json({data:current});
 });
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container);
 const button=(text:string)=>[...container.querySelectorAll("button")].find(x=>x.textContent===text)!;
 try{
 await act(async()=>root.render(createElement(RfaDashboard,{getSession:async()=>({token:"synthetic_token"}),fetch:fetcher,permissions:["edit"]})));
 await act(async()=>[...container.querySelectorAll("button")].find(x=>x.textContent==="RFAs")!.click());
 await act(async()=>button("Review request").click());await act(async()=>button("Edit request draft").click());
 expect(container.textContent).toContain("clears its signature");expect(button("Refresh request").disabled).toBe(true);
 const input=[...container.querySelectorAll("input")].find(x=>x.parentElement?.textContent==="Frequency")!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(input,"Twice weekly");input.dispatchEvent(new Event("input",{bubbles:true}));});
 await act(async()=>container.querySelector("form")!.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
 expect(container.textContent).toContain("Your edits are still here");expect(input.value).toBe("Twice weekly");
 stale=false;await act(async()=>container.querySelector("form")!.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
 const mutations=fetcher.mock.calls.filter(([,init])=>init?.method==="PATCH");expect(mutations).toHaveLength(2);
 expect(mutations[0]?.[1]?.body).toBe(mutations[1]?.[1]?.body);expect(new Headers(mutations[0]?.[1]?.headers).get("idempotency-key")).toBe(new Headers(mutations[1]?.[1]?.headers).get("idempotency-key"));
 const body=JSON.parse(String(mutations[0]?.[1]?.body));expect(body.expectedRevision).toBe(1);expect(body.items[0]).toMatchObject({id:"service_existing",frequency:"Twice weekly",duration:"Two weeks",metadata:{host:"service_context"}});expect(body.metadata).toEqual({host:"request_context"});
 expect(button("Save draft changes")).toBeUndefined();const oldForm=[...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find(x=>x.parentElement?.textContent?.includes("Synthetic form.pdf"))!;expect(oldForm.disabled).toBe(true);expect(oldForm.checked).toBe(false);expect(button("Prepare packet with cover sheet").disabled).toBe(true);
 }finally{await act(async()=>root.unmount());container.remove();}
});
it("does not expose content editing without permission or after submission",async()=>{
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container);
 try{for(const [permissions,current] of [[[],record],[["edit"],{...record,submittedAt:"2026-09-01T00:00:00Z"}]] as const){
 const fetcher=vi.fn<typeof fetch>(async(input)=>String(input).includes("?")?Response.json({data:[current],summary:{total:1,byStatus:{ready:1}},nextCursor:null}):Response.json({data:current}));
 await act(async()=>root.render(createElement(RfaDashboard,{getSession:async()=>({token:"synthetic_token"}),fetch:fetcher,permissions})));
 await act(async()=>[...container.querySelectorAll("button")].find(x=>x.textContent==="RFAs")!.click());
 await act(async()=>[...container.querySelectorAll("button")].find(x=>x.textContent==="Review request")!.click());expect(container.textContent).not.toContain("Edit request draft");
 }}finally{await act(async()=>root.unmount());container.remove();}
});
