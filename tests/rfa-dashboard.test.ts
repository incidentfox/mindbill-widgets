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
 await render("claim_synthetic");const review=[...container.querySelectorAll("button")].find(x=>x.textContent==="Review request")!;
 await act(async()=>review.click());expect(container.textContent).toContain("External fax delivery is disabled");expect(container.textContent).not.toContain("Send authorization fax");
 await render("claim_other_synthetic");expect(container.textContent).not.toContain("Review packet and send");expect(container.textContent).toContain("Review request");
 expect(fetcher.mock.calls.every(x=>(x[1]?.method??"GET")==="GET")).toBe(true);
 }finally{await act(async()=>root.unmount());container.remove();}
});
it("requires packet review and deliberate recipient confirmation before live send",async()=>{
 const fetcher=vi.fn<typeof fetch>(async(input)=>String(input).includes("?")?Response.json({data:[record],summary:{total:1,byStatus:{ready:1}},nextCursor:null}):Response.json({data:record}));
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container);
 try{
 await act(async()=>root.render(createElement(RfaDashboard,{getSession:async()=>({token:"synthetic_token"}),fetch:fetcher,environment:"live",permissions:["send"]})));
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
 await act(async()=>[...container.querySelectorAll("button")].find(x=>x.textContent==="Review request")!.click());
 const boxes=[...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
 const named=(name:string)=>boxes.find(box=>box.parentElement?.textContent?.includes(name))!;
 expect(named("Synthetic form.pdf").disabled).toBe(true);expect(named("Synthetic form.pdf").checked).toBe(false);
 expect(named("Earlier current form.pdf").checked).toBe(false);expect(named("Current form.pdf").checked).toBe(true);expect(named("Synthetic report.pdf").checked).toBe(true);
 await act(async()=>named("Earlier current form.pdf").click());expect(named("Current form.pdf").checked).toBe(false);
 }finally{await act(async()=>root.unmount());container.remove();}
});
