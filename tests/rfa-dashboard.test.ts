// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { RfaDashboard, rfaCanResend } from "../packages/react/src/rfa-dashboard";
import { rfaDuplicatePacket, rfaForwardContactOptions } from "../packages/react/src/rfa-duplicate-dialog";
import { rfaDecisionSummary, rfaFailureReason } from "../packages/react/src/rfa-detail-cards";
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
function taskResponse(input: RequestInfo | URL): Response | undefined {
 const url = String(input);
 if (url.includes("/rfa-follow-ups") || url.includes("/rfa-inbound-faxes")) return Response.json({ data: [], nextCursor: null, hasMore: false });
}
const record={id:"rfa_synthetic",contentRevision:1,claimId:"claim_synthetic",patientId:"patient_synthetic",renderingProviderId:"provider_synthetic",claimsAdminId:null,employeeName:"Synthetic patient",providerName:"Synthetic physician",claimNumber:"SYNTHETIC-001",status:"ready",reviewType:"prospective",expedited:false,signedAt:"2026-09-01T00:00:00Z",submittedAt:null,receivedAt:null,createdAt:null,updatedAt:null,decisionDueAt:null,decisionDeadlineBasis:null,incompleteReason:null,deferredReason:null,closedReason:null,readiness:{ready:true,missing:[]},items:[],documents:[{id:"form_synthetic",documentType:"rfa_form",filename:"Synthetic form.pdf",contentUrl:"",contentRevision:1,createdAt:null},{id:"clinical_synthetic",documentType:"clinical_report",filename:"Synthetic report.pdf",contentUrl:"",contentRevision:1,createdAt:null}],transmissions:[],informationRequests:[],events:[]};
it("keeps sandbox delivery disabled and clears selected records when the claim filter changes",async()=>{
 const fetcher=vi.fn<typeof fetch>(async(input)=>taskResponse(input) ?? (String(input).includes("?")?Response.json({data:[record],summary:{total:1,byStatus:{ready:1}},nextCursor:null}):Response.json({data:record})));
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container);const getSession=async()=>({token:"synthetic_token"});
 const render=async(claimId:string)=>act(async()=>root.render(createElement(RfaDashboard,{getSession,fetch:fetcher,claimId,permissions:["send"]})));
 try{
 await render("claim_synthetic");await act(async()=>[...container.querySelectorAll("button")].find(x=>x.textContent==="All RFAs")!.click());const review=[...container.querySelectorAll("button")].find(x=>x.textContent==="SYNTHETI")!;
 await act(async()=>review.click());expect(container.textContent).toContain("External fax delivery is disabled");expect(container.textContent).not.toContain("Send authorization fax");
 await render("claim_other_synthetic");await act(async()=>[...container.querySelectorAll("button")].find(x=>x.textContent==="All RFAs")!.click());expect(container.textContent).not.toContain("Review packet and send");expect(container.textContent).toContain("SYNTHETI");
 expect(fetcher.mock.calls.every(x=>(x[1]?.method??"GET")==="GET")).toBe(true);
 }finally{await act(async()=>root.unmount());container.remove();}
});
it("requires packet review and deliberate recipient confirmation before live send",async()=>{
 const fetcher=vi.fn<typeof fetch>(async(input)=>taskResponse(input) ?? (String(input).includes("?")?Response.json({data:[record],summary:{total:1,byStatus:{ready:1}},nextCursor:null}):Response.json({data:record})));
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container);
 try{
 await act(async()=>root.render(createElement(RfaDashboard,{getSession:async()=>({token:"synthetic_token"}),fetch:fetcher,environment:"live",permissions:["send"]})));
 await act(async()=>[...container.querySelectorAll("button")].find(x=>x.textContent==="All RFAs")!.click());
 await act(async()=>[...container.querySelectorAll("button")].find(x=>x.textContent==="SYNTHETI")!.click());
 const send=[...container.querySelectorAll("button")].find(x=>x.textContent==="Send authorization fax")!;expect(send.disabled).toBe(true);
 await act(async()=>send.click());expect(fetcher.mock.calls.some(x=>String(x[0]).endsWith("/fax"))).toBe(false);
 }finally{await act(async()=>root.unmount());container.remove();}
});
it("selects only the newest signed form for the current content revision",async()=>{
 const current={...record,contentRevision:2,documents:[...record.documents,{id:"form_current_old",documentType:"rfa_form",filename:"Earlier current form.pdf",contentUrl:"",contentRevision:2,createdAt:"2026-09-01T00:00:00Z"},{id:"form_current",documentType:"rfa_form",filename:"Current form.pdf",contentUrl:"",contentRevision:2,createdAt:"2026-09-02T00:00:00Z"}]};
 const fetcher=vi.fn<typeof fetch>(async(input)=>taskResponse(input) ?? (String(input).includes("?")?Response.json({data:[current],summary:{total:1,byStatus:{ready:1}},nextCursor:null}):Response.json({data:current})));
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container);
 try{
 await act(async()=>root.render(createElement(RfaDashboard,{getSession:async()=>({token:"synthetic_token"}),fetch:fetcher})));
 await act(async()=>[...container.querySelectorAll("button")].find(x=>x.textContent==="All RFAs")!.click());
 await act(async()=>[...container.querySelectorAll("button")].find(x=>x.textContent==="SYNTHETI")!.click());
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
  const empty = taskResponse(input); if (empty) return empty;
  if(init?.method==="PATCH")return stale?Response.json({error:{message:"Content revision changed"}},{status:409}):Response.json({data:{...current,...JSON.parse(String(init.body)),items:JSON.parse(String(init.body)).items.map((item:object)=>({...item,outcome:"pending"})),contentRevision:2,status:"draft",signedAt:null}});
  return String(input).includes("?")?Response.json({data:[current],summary:{total:1,byStatus:{ready:1}},nextCursor:null}):Response.json({data:current});
 });
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container);
 const button=(text:string)=>[...container.querySelectorAll("button")].find(x=>x.textContent===text)!;
 try{
 await act(async()=>root.render(createElement(RfaDashboard,{getSession:async()=>({token:"synthetic_token"}),fetch:fetcher,permissions:["edit"]})));
 await act(async()=>[...container.querySelectorAll("button")].find(x=>x.textContent==="All RFAs")!.click());
 await act(async()=>button("SYNTHETI").click());await act(async()=>button("Edit request draft").click());
 expect(container.textContent).toContain("clears its signature");expect(button("Refresh request")).toBeUndefined();
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
 const fetcher=vi.fn<typeof fetch>(async(input)=>taskResponse(input) ?? (String(input).includes("?")?Response.json({data:[current],summary:{total:1,byStatus:{ready:1}},nextCursor:null}):Response.json({data:current})));
 await act(async()=>root.render(createElement(RfaDashboard,{getSession:async()=>({token:"synthetic_token"}),fetch:fetcher,permissions})));
 await act(async()=>[...container.querySelectorAll("button")].find(x=>x.textContent==="All RFAs")!.click());
 await act(async()=>[...container.querySelectorAll("button")].find(x=>x.textContent==="SYNTHETI")!.click());expect(container.textContent).not.toContain("Edit request draft");
 }}finally{await act(async()=>root.unmount());container.remove();}
});

it("organizes status, details, and history into accessible tabs while automatically updating",async()=>{
 const current={...record,status:"submitted",submittedAt:"2026-09-15T09:00:00Z"};
 const fetcher=vi.fn<typeof fetch>(async(input)=>{
  const empty = taskResponse(input); if (empty) return empty;
  const url=String(input);
  if(url.endsWith("/events"))return Response.json({data:[{id:"event_one",sequence:1,eventType:"rfa.created",actor:"native-user:synthetic",occurredAt:"2026-09-15T09:00:00Z",payload:{}}]});
  if(url.endsWith("/scheduling")||url.endsWith("/packets"))return Response.json({data:[]});
  return url.includes("?")?Response.json({data:[current],summary:{total:1,byStatus:{submitted:1}},nextCursor:null}):Response.json({data:current});
 });
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container);
 const button=(text:string)=>[...container.querySelectorAll("button")].find(x=>x.textContent===text)!;
 try{
  await act(async()=>root.render(createElement(RfaDashboard,{getSession:async()=>({token:"synthetic_token"}),fetch:fetcher,permissions:["edit"]})));
  await act(async()=>button("All RFAs").click());await act(async()=>button("SYNTHETI").click());
  expect(container.querySelector('[aria-label="Authorization progress"] [aria-current="step"]')?.textContent).toContain("Sent");
  expect(button("Refresh request")).toBeUndefined();
  const details=button("RFA details");const history=button("History & activity");
  await act(async()=>details.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true})));
  expect(history.getAttribute("aria-selected")).toBe("true");expect(document.activeElement).toBe(history);
  expect(document.getElementById(details.getAttribute("aria-controls")!)?.hidden).toBe(true);
  expect([...container.querySelectorAll(".mbrfa-history-table th")].map(x=>x.textContent)).toEqual(["Date","Action","User","Details"]);
  expect(container.querySelector(".mbrfa-history-table")?.textContent).toContain("Team member");
  expect(container.querySelector(".mbrfa-history-table")?.textContent).not.toContain("native-user:");
  const note=container.querySelector<HTMLTextAreaElement>('textarea[name="note"]')!;
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")!.set!.call(note,"Unsaved synthetic note");note.dispatchEvent(new Event("input",{bubbles:true}));});
  const reads=fetcher.mock.calls.length;
  await act(async()=>window.dispatchEvent(new Event("focus")));
  expect(fetcher.mock.calls.length).toBeGreaterThan(reads);expect(note.isConnected).toBe(true);expect(note.value).toBe("Unsaved synthetic note");
  expect(fetcher.mock.calls.every(([,init])=>(init?.method??"GET")==="GET")).toBe(true);
 }finally{await act(async()=>root.unmount());container.remove();}
});
it("supports routed detail pages with readable links and a read-only DWC preview",async()=>{
 const current={...record,claimsAdminName:"Example administrator",items:[{id:"item_opaque",serviceDescription:"Knee rehabilitation",diagnosisCode:"M25.5",outcome:"pending"}]};
 const fetcher=vi.fn<typeof fetch>(async(input)=>taskResponse(input)??Response.json({data:current}));
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container);
 try{
 await act(async()=>root.render(createElement(RfaDashboard,{getSession:async()=>({token:"synthetic_token"}),fetch:fetcher,selectedRfaId:current.id,hideBackButton:true,hideHeading:true,formPreviewUrl:"/rfas/example/form",getPatientHref:()=>"/patients/example",getClaimHref:()=>"/injuries/example",getProviderHref:()=>"/providers/example"})));
 expect(container.textContent).toContain("Knee rehabilitation");expect(container.textContent).not.toContain(current.id);expect(container.textContent).not.toContain("All requests");
 for(const href of ["/patients/example","/injuries/example","/providers/example"])expect(container.querySelector(`a[href="${href}"]`)).not.toBeNull();
 expect(container.querySelector('a[href="/rfas/example/form"]')?.textContent).toBe("View DWC Form RFA");
 expect(container.querySelectorAll('[aria-label="Saved request details"]')).toHaveLength(1);
 expect(fetcher.mock.calls.every(([,init])=>!init?.method||init.method==="GET")).toBe(true);
 }finally{await act(async()=>root.unmount());container.remove();}
});

it("offers an opt-in focused layout while retaining deliberate sandbox delivery controls",async()=>{
 const fetcher=vi.fn<typeof fetch>(async(input)=>taskResponse(input) ?? (String(input).includes("?")?Response.json({data:[record],summary:{total:1,byStatus:{ready:1}},nextCursor:null}):Response.json({data:record})));
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container);
 const button=(text:string)=>[...container.querySelectorAll("button")].find(x=>x.textContent===text)!;
 const panel=(text:string)=>document.getElementById(button(text).getAttribute("aria-controls")!)!;
 try{
  await act(async()=>root.render(createElement(RfaDashboard,{getSession:async()=>({token:"synthetic_token"}),fetch:fetcher,layout:"simple",permissions:["send"]})));
  expect(button("SYNTHETI")).toBeDefined();
  await act(async()=>button("SYNTHETI").click());
  expect([...container.querySelectorAll('[role="tab"]')].map(tab=>tab.textContent)).toEqual(["RFA Details","History & Activity"]);
  expect([...container.querySelectorAll('[aria-label="Authorization progress"] li')].map(step=>[step.textContent!.replace(/^[\d✓]+/,""),step.getAttribute("data-state")])).toEqual([["Incomplete","current"],["Sent","todo"],["Received","todo"],["Closed","todo"]]);
  expect(panel("RFA Details").hidden).toBe(false);
  expect([...panel("RFA Details").querySelectorAll(".mbrfa-sheet > header h3")].map(title=>title.firstChild!.textContent)).toEqual(["Request Information","Employee Information","Requesting Physician Information","Claims Administrator Information","Requested Treatment","Documents"]);
  expect(container.querySelector("details")?.querySelector("summary")?.textContent).not.toBe("Patient, physician & claim details");
  expect(container.querySelector('[role="dialog"]')).toBeNull();
  await act(async()=>button("Send").click());
  const dialog=container.querySelector<HTMLElement>('[role="dialog"]')!;
  expect(dialog.textContent).toContain("nothing is faxed or e-mailed");expect(button("Send fax").disabled).toBe(true);
  await act(async()=>button("Cancel").click());expect(container.querySelector('[role="dialog"]')).toBeNull();
  expect(panel("RFA Details").textContent).toContain("Synthetic report.pdf");
  await act(async()=>button("RFA Details").dispatchEvent(new KeyboardEvent("keydown",{key:"End",bubbles:true})));
  expect(button("History & Activity").getAttribute("aria-selected")).toBe("true");expect(document.activeElement).toBe(button("History & Activity"));
  expect(panel("RFA Details").hidden).toBe(true);
  expect(fetcher.mock.calls.every(([,init])=>(init?.method??"GET")==="GET")).toBe(true);
 }finally{await act(async()=>root.unmount());container.remove();}
});

it("names what is being sent and offers the host's signature setup when the physician has none",async()=>{
 const unsigned={...record,signedAt:null,items:[{id:"item_opaque",serviceDescription:"Knee rehabilitation",diagnosisCode:"M25.5",procedureCode:"97110",quantity:6,outcome:"pending"}]};
 const fetcher=vi.fn<typeof fetch>(async(input)=>taskResponse(input) ?? Response.json({data:unsigned}));
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container);
 const button=(text:string)=>[...container.querySelectorAll("button")].find(x=>x.textContent===text)!;
 try{
  await act(async()=>root.render(createElement(RfaDashboard,{getSession:async()=>({token:"synthetic_token"}),fetch:fetcher,layout:"simple",selectedRfaId:unsigned.id,permissions:["send","sign"],renderSendSignatureSetup:({providerName})=>({missing:true,setup:createElement("button",{type:"button"},`Add signature for ${providerName}`)})})));
  await act(async()=>button("Send").click());
  const listed=container.querySelector<HTMLElement>('[role="dialog"] .mbrfa-send-contents')!;
  expect(listed.textContent).toContain("Knee rehabilitation · CPT/HCPCS 97110 · Qty 6 · Dx M25.5");expect(listed.textContent).toContain("Synthetic report.pdf");
  expect(container.querySelector('[role="dialog"]')!.textContent).not.toMatch(/\d+ (requested treatment|supporting document)/);
  expect(container.querySelector('[role="dialog"] .mbrfa-send-signature')?.textContent).toContain("Synthetic physician has no saved signature yet");
  expect(button("Add signature for Synthetic physician")).toBeDefined();expect(button("Send fax").disabled).toBe(true);
  expect(fetcher.mock.calls.every(([,init])=>(init?.method??"GET")==="GET")).toBe(true);
 }finally{await act(async()=>root.unmount());container.remove();}
});

it("offers Forward only after a request was sent, forwarding the packet that actually went out",async()=>{
 const packets=[{id:"p_download",source:"download" as const,sha256:"a",sizeBytes:1,contentRevision:1,createdAt:"2026-09-03T00:00:00Z"},{id:"p_failed",source:"submission" as const,sha256:"b",sizeBytes:1,contentRevision:1,createdAt:"2026-09-04T00:00:00Z"},{id:"p_sent",source:"submission" as const,sha256:"c",sizeBytes:1,contentRevision:1,createdAt:"2026-09-02T00:00:00Z"}];
 const sent=(packetId:string,status:string)=>({id:`t_${packetId}`,packetId,purpose:"submission" as const,channel:"fax",status,destination:"+18005550100",occurredAt:"2026-09-02T00:00:00Z",receivedAt:null});
 expect(rfaDuplicatePacket({packets,transmissions:[sent("p_failed","failed"),sent("p_sent","delivered")]})?.id).toBe("p_sent");
 expect(rfaDuplicatePacket({packets:packets.slice(0,2),transmissions:[sent("p_failed","failed")]})?.id).toBe("p_download");
 expect(rfaDuplicatePacket({packets:[packets[1]!],transmissions:[sent("p_failed","failed")]})).toBeNull();
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container);
 try{
  for(const [current,expected] of [[{...record,status:"received",submittedAt:"2026-09-02T00:00:00Z"},true],[record,false]] as const){
   const fetcher=vi.fn<typeof fetch>(async(input)=>taskResponse(input) ?? Response.json({data:current}));
   await act(async()=>root.render(createElement(RfaDashboard,{key:String(expected),getSession:async()=>({token:"synthetic_token"}),fetch:fetcher,layout:"simple",selectedRfaId:current.id,permissions:["send","act"]})));
   expect([...container.querySelectorAll("button")].filter(x=>x.textContent==="Forward").length).toBe(expected ? 2 : 0);
  }
 }finally{await act(async()=>root.unmount());container.remove();}
});

it("offers Send again, not a duplicate, when every attempt failed and nothing was received",()=>{
 const t=(status:string,purpose="submission")=>({id:`t_${status}_${purpose}`,purpose,direction:"outbound",channel:"fax",status,destination:"+18005550100",occurredAt:null,receivedAt:null,proofDocumentId:null,providerMessageId:null});
 const sent={status:"submitted",receivedAt:null};
 expect(rfaCanResend({...sent,transmissions:[t("failed"),t("failed")]})).toBe(true);
 expect(rfaCanResend({...sent,transmissions:[t("failed"),t("sent","forward")]})).toBe(true);
 expect(rfaCanResend({...sent,transmissions:[t("failed"),t("sent")]})).toBe(false);
 expect(rfaCanResend({...sent,transmissions:[]})).toBe(false);
 expect(rfaCanResend({...sent,receivedAt:"2026-09-02T00:00:00Z",transmissions:[t("failed")]})).toBe(false);
 expect(rfaCanResend({status:"received",receivedAt:null,transmissions:[t("failed")]})).toBe(false);
});

it("says what was decided, and flags a request the response only partly decided",()=>{
 const item=(outcome:string,closed=false)=>({outcome,decisionClosure:closed?{closed:true}:null}) as never;
 expect(rfaDecisionSummary({items:[item("pending")]})).toBeNull();
 expect(rfaDecisionSummary({items:[item("approved"),item("approved")]})).toEqual({label:"Approved",tone:"ok"});
 expect(rfaDecisionSummary({items:[item("denied")]})).toEqual({label:"Denied",tone:"bad"});
 expect(rfaDecisionSummary({items:[item("modified")]})).toEqual({label:"Modified",tone:"warn"});
 expect(rfaDecisionSummary({items:[item("approved"),item("denied")]})).toEqual({label:"Partially approved",tone:"warn"});
 expect(rfaDecisionSummary({items:[item("approved"),item("pending")]})).toEqual({label:"Partially decided",tone:"warn"});
 // A treatment closed without a decision is not being waited on.
 expect(rfaDecisionSummary({items:[item("approved"),item("pending",true)]})).toEqual({label:"Approved",tone:"ok"});
 const sent={id:"t",direction:"outbound",channel:"fax",destination:null,occurredAt:null,receivedAt:null,proofDocumentId:null,providerMessageId:null};
 expect(rfaFailureReason({...sent,status:"failed",metadata:{failureReason:"busy"}} as never)).toBe("The line was busy");
 expect(rfaFailureReason({...sent,status:"failed",metadata:{failureReason:"anything else"}} as never)).toBe("");
 expect(rfaFailureReason({...sent,status:"sent",metadata:{failureReason:"busy"}} as never)).toBe("");
});

it("opens response and treatment deep links on the details tab",async()=>{
 const fetcher=vi.fn<typeof fetch>(async(input)=>taskResponse(input) ?? Response.json({data:record}));
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container);
 const base={getSession:async()=>({token:"synthetic_token"}),fetch:fetcher,layout:"simple" as const,selectedRfaId:record.id};
 const selected=()=>container.querySelector('[role="tab"][aria-selected="true"]')?.textContent;
 try{
  await act(async()=>root.render(createElement(RfaDashboard,{...base,selectedResponseDocumentId:"response_synthetic"})));
  expect(selected()).toBe("RFA Details");
  await act(async()=>root.render(createElement(RfaDashboard,{...base,selectedTreatmentId:"treatment_synthetic"})));
  expect(selected()).toBe("RFA Details");
 }finally{await act(async()=>root.unmount());container.remove();}
});

it("composes an opt-in routed task list without the dashboard summary or inbox", async () => {
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container);const onSelectRfa=vi.fn();
 const fetcher=vi.fn<typeof fetch>(async input => String(input).includes("rfa-follow-ups") ? Response.json({data:[{id:"task_synthetic",rfaId:record.id,claimId:record.claimId,kind:"post_ur_decision",status:"open",createdAt:"2020-01-01",dueAt:"2020-01-01",responseDocumentId:"response_synthetic"}],nextCursor:null}) : Response.json({data:[record],summary:{total:1,byStatus:{ready:1}},nextCursor:null}));
 try {
  await act(async()=>root.render(createElement(RfaDashboard,{getSession:async()=>({token:"synthetic_token"}),fetch:fetcher,layout:"simple",initialOverviewView:"tasks",taskPresentation:"list",taskQuery:{state:"Due",kind:"post_ur_decision",bucket:"31+"},onSelectRfa,navigation:{tasksHref:"/tasks/rfas",getTaskHref:()=>"/tasks/rfas/list"},renderTaskIdentity:()=>createElement("small",{},"Synthetic patient")})));
  expect(container.querySelector("h2")?.textContent).toBe("RFA task list");
  expect(container.querySelector('a[href="/tasks/rfas"]')?.textContent).toBe("← RFA Tasks");
  expect(container.querySelectorAll('[aria-label="Selected tasks"] tbody tr')).toHaveLength(1);
  expect(container.querySelector(".mbrfa-task-group")).toBeNull();
  expect(container.querySelector(".mbrfa-match-disclosure")).toBeNull();
  expect(container.textContent).not.toContain("Requests awaiting decisions");
  await act(async()=>[...container.querySelectorAll("button")].find(button=>button.textContent==="Review response")!.click());
  expect(onSelectRfa).toHaveBeenCalledWith(record.id,{responseDocumentId:"response_synthetic"});
 } finally {await act(async()=>root.unmount());container.remove();}
});

for (const filled of [true, false]) it(`shows all DWC information rows for read-only users (${filled ? "filled" : "blank"})`, async()=>{
 const current={...record,employeeDateOfBirth:filled?"1980-01-02":null,employer:filled?"Sample employer":null,providerSpecialty:filled?"Physical Medicine":null,providerPhone:"5555550199",claimsAdminName:"Directory name",formContactDefaults:{requestingPractice:{name:"Directory practice",phone:"5555550198",email:"directory@example.com"},authorizationContact:{name:"Directory administrator",address:"Directory address",email:"directory-admin@example.com"}},requestingPractice:filled?{name:"Sample practice",contactName:"Sample contact",address:"100 Example St",city:"Sample City",state:"CA",zip:"90001",phone:"5555550100",fax:"5555550101",email:"practice@example.com"}:{phone:""},authorizationContact:filled?{name:"Saved administrator",contactName:"Claims contact",address:"200 Example St",city:"Sample City",state:"CA",zip:"90002",phone:"5555550102",fax:"5555550103",email:"claims@example.com"}:{name:""}};
 const fetcher=vi.fn<typeof fetch>(async(input)=>taskResponse(input)??Response.json({data:current}));
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container);
 try {
  await act(async()=>root.render(createElement(RfaDashboard,{getSession:async()=>({token:"synthetic_token"}),fetch:fetcher,layout:"simple",selectedRfaId:current.id,permissions:[]})));
  const card=(title:string)=>[...container.querySelectorAll(".mbrfa-sheet")].find(node=>node.querySelector("header h3")?.textContent===title)!;
  const facts=(title:string)=>Object.fromEntries([...card(title).querySelectorAll("dt")].map(dt=>[dt.textContent,dt.nextElementSibling?.textContent]));
  expect(Object.keys(facts("Employee Information"))).toEqual(["Name","Claim Number","Date of Injury","Date of Birth","Employer"]);
  expect(Object.keys(facts("Requesting Physician Information"))).toEqual(["Name","NPI Number","Specialty","Practice Name","Contact Name","Address","Phone","Fax Number","E-mail Address"]);
  expect(Object.keys(facts("Claims Administrator Information"))).toEqual(["Company Name","Contact Name","Address","Phone","Fax Number","E-mail Address"]);
  expect(facts("Request Information")).toMatchObject({"Request type":"New Request","Review":"Prospective","Written confirmation":"No"});
  expect(facts("Request Information")).not.toHaveProperty("Sent");
  if(filled){
   expect(facts("Employee Information")).toMatchObject({"Date of Birth":"01/02/1980","Employer":"Sample employer"});
   expect(facts("Requesting Physician Information")).toMatchObject({"Specialty":"Physical Medicine","Contact Name":"Sample contact","E-mail Address":"practice@example.com"});
   expect(facts("Claims Administrator Information")).toMatchObject({"Company Name":"Saved administrator","Contact Name":"Claims contact","E-mail Address":"claims@example.com"});
  } else {
   expect(facts("Employee Information")).toMatchObject({"Date of Birth":"—","Employer":"—"});
   expect(facts("Requesting Physician Information")).toMatchObject({"Contact Name":"—","Phone":"—","Specialty":"—"});
   expect(facts("Claims Administrator Information")).toMatchObject({"Company Name":"—","Address":"—","E-mail Address":"—"});
  }
  expect(fetcher.mock.calls.every(([input,init])=>(init?.method??"GET")==="GET"&&!String(input).includes("creation-context"))).toBe(true);
 }finally{await act(async()=>root.unmount());container.remove();}
});

it("uses the same directory defaults as the form for legacy requests without saved contacts", async()=>{
 const current={...record,requestingPractice:null,authorizationContact:null,formContactDefaults:{requestingPractice:{name:"Directory practice",address:"100 Example St",phone:"5555550100",email:"practice@example.com"},authorizationContact:{name:"Directory administrator",address:"200 Example St",phone:"5555550102",email:"claims@example.com"}}};
 const fetcher=vi.fn<typeof fetch>(async input=>taskResponse(input)??Response.json({data:current}));
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container);
 try{
  await act(async()=>root.render(createElement(RfaDashboard,{getSession:async()=>({token:"synthetic_token"}),fetch:fetcher,layout:"simple",selectedRfaId:current.id,permissions:[]})));
  const facts=(title:string)=>Object.fromEntries([...([...container.querySelectorAll(".mbrfa-sheet")].find(node=>node.querySelector("header h3")?.textContent===title)!).querySelectorAll("dt")].map(dt=>[dt.textContent,dt.nextElementSibling?.textContent]));
  expect(facts("Requesting Physician Information")).toMatchObject({"Practice Name":"Directory practice","Address":"100 Example St","E-mail Address":"practice@example.com"});
  expect(facts("Claims Administrator Information")).toMatchObject({"Company Name":"Directory administrator","Address":"200 Example St","E-mail Address":"claims@example.com"});
  expect(fetcher.mock.calls.every(([,init])=>(init?.method??"GET")==="GET")).toBe(true);
 }finally{await act(async()=>root.unmount());container.remove();}
});

it("turns host claim contacts into Forward destinations, one per fax and e-mail",()=>{
 expect(rfaForwardContactOptions([
  {name:"Synthetic Adjuster",role:"Adjuster",fax:"(800) 555-0100",email:"adjuster@example.invalid"},
  {name:"No route",role:"Attorney"},
  {name:"Bad email",role:"Other",email:"not-an-email"},
 ])).toEqual([
  {method:"fax",destination:"+18005550100",label:"Adjuster · Synthetic Adjuster",recipientName:"Synthetic Adjuster"},
  {method:"email",destination:"adjuster@example.invalid",label:"Adjuster · Synthetic Adjuster",recipientName:"Synthetic Adjuster"},
 ]);
});

it("removes an uploaded document from an unsent request, and offers no Remove once sent",async()=>{
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container);
 const removeButtons=()=>[...container.querySelectorAll("button")].filter(x=>x.getAttribute("title")==="Delete");
 const confirm=vi.spyOn(window,"confirm").mockReturnValue(true);
 try{
  const after={...record,documents:record.documents.filter(d=>d.id!=="clinical_synthetic")};
  const fetcher=vi.fn<typeof fetch>(async(input,init)=>taskResponse(input) ?? Response.json({data:init?.method==="DELETE"?after:record}));
  await act(async()=>root.render(createElement(RfaDashboard,{getSession:async()=>({token:"synthetic_token"}),fetch:fetcher,layout:"simple",selectedRfaId:record.id,permissions:["edit","send"]})));
  expect(removeButtons()).toHaveLength(1);
  await act(async()=>removeButtons()[0]!.click());
  const call=fetcher.mock.calls.find(([,init])=>init?.method==="DELETE")!;
  expect(String(call[0])).toContain("/rfa_synthetic/documents/clinical_synthetic");
  expect(new Headers(call[1]!.headers).get("idempotency-key")).toBeTruthy();
  expect(container.textContent).not.toContain("Synthetic report.pdf");
  const sent={...record,status:"received",submittedAt:"2026-09-02T00:00:00Z"};
  await act(async()=>root.render(createElement(RfaDashboard,{key:"sent",getSession:async()=>({token:"synthetic_token"}),fetch:vi.fn<typeof fetch>(async(input)=>taskResponse(input) ?? Response.json({data:sent})),layout:"simple",selectedRfaId:sent.id,permissions:["edit","send","act"]})));
  expect(removeButtons()).toHaveLength(0);
 }finally{confirm.mockRestore();await act(async()=>root.unmount());container.remove();}
});

it("lists documents daisyBill-style: Type, Source, File name, View, Delete; hides the signing preview",async()=>{
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container);
 try{
  const withSource={...record,documents:[{...record.documents[0]!,source:"mindbill"},{...record.documents[1]!,source:"upload"},{id:"preview_synthetic",documentType:"other",filename:"DWC-RFA-signing-preview.pdf",contentUrl:"",contentRevision:1,createdAt:null,source:"mindbill",internal:true}]};
  await act(async()=>root.render(createElement(RfaDashboard,{getSession:async()=>({token:"synthetic_token"}),fetch:vi.fn<typeof fetch>(async(input)=>taskResponse(input) ?? Response.json({data:withSource})),layout:"simple",selectedRfaId:record.id,permissions:["edit","send"]})));
  const table=container.querySelector(".mbrfa-documents-table")!;
  expect([...table.querySelectorAll("th")].map(th=>th.textContent)).toEqual(["Send","Type","Source","File name","View","Delete"]);
  expect(table.textContent).toContain("MindBill");expect(table.textContent).toContain("Upload");
  expect(table.textContent).not.toContain("signing-preview");
  expect(table.querySelectorAll('button[title="Delete"]')).toHaveLength(1);
 }finally{await act(async()=>root.unmount());container.remove();}
});
it("loads the dashboard counts once, as a single row, and shows them at once on return",async()=>{
 const summary={total:3,byStatus:{submitted:3},byLifecycleStatus:{sent:2,received:1},aging:{byBucket:{"0_5":3,"6_14":0,"15_30":0,"31_plus":0},byLifecycleStatus:{sent:{"0_5":2,"6_14":0,"15_30":0,"31_plus":0},received:{"0_5":1,"6_14":0,"15_30":0,"31_plus":0}}}};
 const fetcher=vi.fn<typeof fetch>(async(input)=>taskResponse(input) ?? Response.json({data:[record],summary,nextCursor:null}));
 const getSession=async()=>({token:"synthetic_token"});
 const mount=async(fetch:typeof globalThis.fetch)=>{const container=document.createElement("div");document.body.append(container);const root=createRoot(container);await act(async()=>root.render(createElement(RfaDashboard,{getSession,fetch,cacheKey:"org_synthetic",initialOverviewView:"tasks"})));return{container,close:async()=>{await act(async()=>root.unmount());container.remove();}};};
 const first=await mount(fetcher);
 try{
  const lists=fetcher.mock.calls.map(x=>String(x[0])).filter(url=>url.includes("/rfas?"));
  expect(lists).toHaveLength(1);expect(lists[0]).toContain("limit=1");
  expect(first.container.textContent).toContain("Awaiting a decision");expect(first.container.textContent).not.toContain("All requests");
 }finally{await first.close();}
 // Coming back, the last counts render before any request answers.
 const pending=vi.fn<typeof fetch>(()=>new Promise<Response>(()=>{}));
 const second=await mount(pending);
 try{expect(second.container.textContent).toContain("Awaiting a decision");expect(second.container.textContent).not.toContain("Loading authorization requests");}finally{await second.close();}
});
it("marks an unsent request as sent outside MindBill, and undoes it from History",async()=>{
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container);
 const confirm=vi.spyOn(window,"confirm").mockReturnValue(true);
 const sentAt="2026-09-10T16:00:00.000Z";
 const marked={...record,status:"submitted",submittedAt:sentAt,transmissions:[{id:"tx_outside",direction:"outbound",purpose:"submission",channel:"mail",status:"sent",destination:"Synthetic address",occurredAt:sentAt,receivedAt:null,proofDocumentId:null,providerMessageId:null,metadata:{sentOutsideMindBill:true}}]};
 let current:unknown=record;
 const fetcher=vi.fn<typeof fetch>(async(input,init)=>{
  const url=String(input);
  if(url.includes("/events"))return Response.json({data:[]});
  if(url.endsWith("/scheduling"))return Response.json({data:[]});
  if(url.endsWith("/sent-outside")&&init?.method==="POST"){current=marked;return Response.json({data:marked},{status:201});}
  if(url.includes("/sent-outside/")&&init?.method==="DELETE"){current=record;return Response.json({data:record});}
  return taskResponse(input) ?? Response.json({data:current});
 });
 const button=(text:string)=>[...container.querySelectorAll("button")].find(x=>x.textContent===text);
 try{
  await act(async()=>root.render(createElement(RfaDashboard,{getSession:async()=>({token:"synthetic_token"}),fetch:fetcher,layout:"simple",selectedRfaId:record.id,permissions:["edit","send","act"]})));
  await act(async()=>button("Mark as sent")!.click());
  const dialog=container.querySelector('[role="dialog"]')!;
  expect(dialog.getAttribute("aria-label")).toBe("Mark as sent");
  const set=(name:string,value:string)=>{const element=dialog.querySelector<HTMLInputElement|HTMLSelectElement>(`[name="${name}"]`)!;element.value=value;element.dispatchEvent(new Event("change",{bubbles:true}));};
  await act(async()=>{set("sentAt","2026-09-10T09:00");set("channel","mail");set("destination","Synthetic address");});
  await act(async()=>{dialog.querySelector("form")!.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));});
  const post=fetcher.mock.calls.find(([url,init])=>String(url).endsWith("/sent-outside")&&init?.method==="POST")!;
  expect(JSON.parse(String(post[1]!.body))).toEqual({sentAt:new Date("2026-09-10T09:00").toISOString(),channel:"mail",destination:"Synthetic address"});
  expect(container.querySelector('[role="dialog"]')).toBeNull();
  expect(button("Mark as sent")).toBeUndefined();
  await act(async()=>[...container.querySelectorAll("button")].find(x=>x.textContent?.startsWith("History"))!.click());
  expect(container.textContent).toContain("Sent outside MindBill");
  await act(async()=>button("Undo")!.click());
  expect(fetcher.mock.calls.some(([url,init])=>String(url).endsWith("/sent-outside/tx_outside")&&init?.method==="DELETE")).toBe(true);
 }finally{confirm.mockRestore();await act(async()=>root.unmount());container.remove();}
});
it("opens the decision dialog on an unsent request, which has no review section",async()=>{
 const withItem={...record,items:[{id:"item_synthetic",ordinal:1,procedureCode:"97110",serviceDescription:"Synthetic therapy",outcome:"pending",diagnosisCode:"M54.5",quantity:1,units:1,authorizationNumber:null,decisionReason:null}]};
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container);
 const fetcher=vi.fn<typeof fetch>(async(input)=>{const url=String(input);if(url.includes("/events")||url.endsWith("/scheduling"))return Response.json({data:[]});return taskResponse(input) ?? Response.json({data:withItem});});
 try{
  await act(async()=>root.render(createElement(RfaDashboard,{getSession:async()=>({token:"synthetic_token"}),fetch:fetcher,layout:"simple",selectedRfaId:record.id,permissions:["edit","send","act"]})));
  expect(container.querySelector('[id$="-review"]')).toBeNull();
  await act(async()=>[...container.querySelectorAll("button")].find(x=>x.textContent==="Record decision")!.click());
  expect(container.querySelector('[role="dialog"]')?.textContent).toContain("This RFA is not marked as sent");
 }finally{await act(async()=>root.unmount());container.remove();}
});
it("reads a document full-screen and switches to the request's other documents in place",async()=>{
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container);
 try{
  const fetcher=vi.fn<typeof fetch>(async(input)=>{const url=String(input);if(url.includes("/documents/"))return new Response("%PDF-synthetic",{headers:{"content-type":"application/pdf"}});return taskResponse(input) ?? Response.json({data:record});});
  await act(async()=>root.render(createElement(RfaDashboard,{getSession:async()=>({token:"synthetic_token"}),fetch:fetcher,layout:"simple",selectedRfaId:record.id,permissions:["edit","send"]})));
  const names=record.documents.map(document=>document.filename);
  await act(async()=>[...container.querySelectorAll<HTMLButtonElement>(".mbrfa-documents-table button")].find(button=>button.textContent===names[0])!.click());
  const dialog=()=>container.querySelector('[role="dialog"]');
  expect(dialog()?.getAttribute("aria-label")).toBe(names[0]);
  expect([...dialog()!.querySelectorAll(".mbrfa-viewer-list button")].map(button=>button.firstChild?.textContent)).toEqual(names);
  await act(async()=>[...dialog()!.querySelectorAll<HTMLButtonElement>(".mbrfa-viewer-list button")].find(button=>button.firstChild?.textContent===names[1])!.click());
  expect(dialog()?.getAttribute("aria-label")).toBe(names[1]);
 }finally{await act(async()=>root.unmount());container.remove();}
});
it("renders a request the host loaded with the page at once, then refreshes it quietly",async()=>{
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container);
 let release:(value:Response)=>void=()=>{};
 const fetcher=vi.fn<typeof fetch>(async(input)=>{const url=String(input);if(url.endsWith(`/rfas/${record.id}`))return new Promise<Response>(resolve=>{release=resolve;});return taskResponse(input) ?? Response.json({data:[]});});
 try{
  await act(async()=>root.render(createElement(RfaDashboard,{getSession:async()=>({token:"synthetic_token"}),fetch:fetcher,layout:"simple",selectedRfaId:record.id,initialRecord:record as never,permissions:["edit","send"]})));
  expect(container.textContent).not.toContain("Loading request");
  expect(container.querySelector(".mbrfa-detail-toolbar")).not.toBeNull();
  await act(async()=>release(Response.json({data:{...record,employeeName:"Refreshed Patient"}})));
  expect(container.textContent).toContain("Refreshed Patient");
 }finally{await act(async()=>root.unmount());container.remove();}
});
