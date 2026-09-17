// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { RfaDashboard } from "../packages/react/src/rfa-dashboard";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const context = { claims: [{ claimId: "claim_synthetic", patientId: "patient_synthetic", employeeName: "Synthetic Patient", claimNumber: "TEST-001", dateOfInjury: "2026-09-01", claimsAdminId: "admin_synthetic" }], renderingProviders: [{ id: "provider_synthetic", name: "Synthetic Physician", npi: "1234567890" }], nextCursor: null, renderingProvidersNextCursor: null };
const list = { data: [], summary: { total: 0, byStatus: {} }, nextCursor: null };
function harness() {
 const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
 return { container, root, button: (text: string) => [...container.querySelectorAll("button")].find(value => value.textContent === text)!,
  close: async () => { await act(async () => root.unmount()); container.remove(); } };
}
async function select(container: HTMLElement, label: string, value: string) {
 const input = [...container.querySelectorAll("select")].find(input => input.parentElement?.textContent?.startsWith(label))!;
 await act(async () => { input.value = value; input.dispatchEvent(new Event("change", { bubbles: true })); });
}
async function type(container: HTMLElement, label: string, value: string) {
 const input = [...container.querySelectorAll("input,textarea")].find(input => input.parentElement?.textContent === label)!;
 await act(async () => { const prototype = input instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype; Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
}
it("creates an unsigned draft from confirmed saved identities without a host initialDraft", async () => {
 const h = harness(); const onCreated = vi.fn();
 const saved = { id:"rfa_synthetic", ...context.claims[0], renderingProviderId:"provider_synthetic",providerName:"Synthetic Physician",status:"draft",reviewType:"prospective",items:[],documents:[],transmissions:[],events:[],informationRequests:[],readiness:{ready:false,missing:[]},contentRevision:1 };
 const fetcher=vi.fn<typeof fetch>(async(input,init)=> String(input).includes("creation-context") ? Response.json({data:context}) : init?.method === "POST" || String(input).endsWith("rfa_synthetic") ? Response.json({data:saved}) : Response.json(list));
 try {
  await act(async()=>h.root.render(createElement(RfaDashboard,{getSession:async()=>({token:"synthetic_token"}),fetch:fetcher,permissions:["create"],onCreated})));
  expect(fetcher.mock.calls.some(([url])=>String(url).includes("creation-context"))).toBe(false);
  await act(async()=>h.button("New authorization request").click());
  expect(h.button("Continue to treatment").disabled).toBe(true);
  await select(h.container,"Saved patient claim","claim_synthetic"); await select(h.container,"Saved rendering provider","provider_synthetic");
  expect(h.container.textContent).toContain("claim TEST-001");
  await act(async()=>h.button("Continue to treatment").click());
  await type(h.container,"Diagnosis code","M54.5"); await type(h.container,"Service description","Synthetic treatment service");
  await act(async()=>h.button("Back to patient and physician").click());
  expect(h.container.textContent).toContain("claim TEST-001");
  await act(async()=>h.button("Continue to treatment").click());
  expect((h.container.querySelector("textarea[maxlength=\"1000\"]") as HTMLTextAreaElement).value).toBe("Synthetic treatment service");
  await act(async()=>h.container.querySelector("form")!.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
  const posts=fetcher.mock.calls.filter(([,init])=>init?.method==="POST"); expect(posts).toHaveLength(1);
  const body=JSON.parse(String(posts[0]?.[1]?.body)); expect(body).toMatchObject({claimId:"claim_synthetic",patientId:"patient_synthetic",renderingProviderId:"provider_synthetic",employeeName:"Synthetic Patient",providerName:"Synthetic Physician",providerNpi:"1234567890",claimsAdminId:"admin_synthetic",dateOfInjury:"2026-09-01",items:[{diagnosisCode:"M54.5",serviceDescription:"Synthetic treatment service"}]});
  expect(body).not.toHaveProperty("signedAt"); expect(onCreated).toHaveBeenCalledOnce();
  expect(fetcher.mock.calls.some(([url])=>/\/(sign|fax)$/.test(String(url)))).toBe(false);
 } finally { await h.close(); }
});
it("keeps host-prepared drafts compatible and hides creation without permission",async()=>{
 const h=harness(); const fetcher=vi.fn<typeof fetch>().mockImplementation(async()=>Response.json(list));
 const getSession=async()=>({token:"synthetic_token"});
 try{
  await act(async()=>h.root.render(createElement(RfaDashboard,{getSession,fetch:fetcher})));
  expect(h.button("New authorization request")).toBeUndefined();
  await act(async()=>h.root.render(createElement(RfaDashboard,{getSession,fetch:fetcher,permissions:["create"],initialDraft:{...context.claims[0]!,renderingProviderId:"provider_synthetic",providerName:"Synthetic Physician",items:[]}})));
  await act(async()=>h.button("New authorization request").click());
  expect(h.button("Save RFA draft")).toBeDefined(); expect(fetcher.mock.calls.some(([url])=>String(url).includes("creation-context"))).toBe(false);
 }finally{await h.close();}
});
it("recovers load failures and explains empty choices",async()=>{
 const h=harness();let attempts=0;
 const fetcher=vi.fn<typeof fetch>(async(input)=>String(input).includes("creation-context") ? ++attempts===1 ? Response.json({}, {status:503}) : Response.json({data:{...context,claims:[],renderingProviders:[]}}) : Response.json(list));
 try{
  await act(async()=>h.root.render(createElement(RfaDashboard,{getSession:async()=>({token:"synthetic_token"}),fetch:fetcher,permissions:["create"]})));
  await act(async()=>h.button("New authorization request").click()); expect(h.container.querySelector('[role="alert"]')?.textContent).toContain("could not be loaded");
  expect(h.button("Continue to treatment").disabled).toBe(true); await act(async()=>h.button("Try again").click());
  expect(h.container.textContent).toContain("Add a patient claim"); expect(h.container.textContent).toContain("Add a rendering provider in Settings"); expect(h.button("Continue to treatment").disabled).toBe(true);
 }finally{await h.close();}
});
it("ignores older searches and paginates claims and physicians independently",async()=>{
 const h=harness();let resolveOld: ((response:Response)=>void)|undefined;
 const fetcher=vi.fn<typeof fetch>(async(input)=>{
  const url=new URL(String(input)); if(!url.pathname.includes("creation-context"))return Response.json(list);
  if(url.searchParams.get("search")==="Old")return new Promise<Response>(resolve=>{resolveOld=resolve;});
  return Response.json({data:{...context,nextCursor:"claims_next",renderingProvidersNextCursor:"providers_next"}});
 });
 try{
  await act(async()=>h.root.render(createElement(RfaDashboard,{getSession:async()=>({token:"synthetic_token"}),fetch:fetcher,permissions:["create"]})));
  await act(async()=>h.button("New authorization request").click());
  await select(h.container,"Saved patient claim","claim_synthetic"); await select(h.container,"Saved rendering provider","provider_synthetic");
  expect(h.button("Continue to treatment").disabled).toBe(false);
  await type(h.container,"Search patients or claim numbers","Old");await act(async()=>h.button("Search claims").click());
  await type(h.container,"Search patients or claim numbers","New");await act(async()=>h.button("Search claims").click());
  await act(async()=>resolveOld!(Response.json({data:{...context,claims:[{...context.claims[0],employeeName:"Stale Patient"}]}})));
  expect(h.container.textContent).not.toContain("Stale Patient");
  expect(h.button("Continue to treatment").disabled).toBe(true);
  await act(async()=>h.button("Next claims page").click());await act(async()=>h.button("Next physicians page").click());
  const last=new URL(String(fetcher.mock.calls.at(-1)?.[0]));expect(last.searchParams.get("search")).toBe("New");expect(last.searchParams.get("cursor")).toBe("claims_next");expect(last.searchParams.get("providerCursor")).toBe("providers_next");
 }finally{await h.close();}
});
it("preloads injury diagnoses, copies per-service choices, and clears treatment when changing patients",async()=>{
 const h=harness();
 const claims=[{...context.claims[0]!,diagnosisCodes:["M54.5","M25.5"]},{claimId:"claim_second",patientId:"patient_second",employeeName:"Second Synthetic",diagnosisCodes:["M54.2"]}];
 const fetcher=vi.fn<typeof fetch>(async input=>String(input).includes("creation-context")?Response.json({data:{...context,claims}}):Response.json(list));
 try{
  await act(async()=>h.root.render(createElement(RfaDashboard,{getSession:async()=>({token:"synthetic_token"}),fetch:fetcher,permissions:["create"]})));
  await act(async()=>h.button("New authorization request").click());
  await select(h.container,"Saved patient claim","claim_synthetic");await select(h.container,"Saved rendering provider","provider_synthetic");
  await act(async()=>h.button("Continue to treatment").click());
  const diagnosis=()=>[...h.container.querySelectorAll("input")].filter(input=>input.parentElement?.textContent?.startsWith("Diagnosis code"));
  expect(diagnosis()[0]?.value).toBe("M54.5");
  await select(h.container,"Use injury diagnosis","M25.5");expect(diagnosis()[0]?.value).toBe("M25.5");
  await type(h.container,"Service description","First patient treatment");
  await type(h.container,"Clinical rationale","First patient rationale");
  await act(async()=>h.button("Add requested service").click());
  await act(async()=>h.button("Copy diagnosis from first service").click());expect(diagnosis()[1]?.value).toBe("M25.5");
  await act(async()=>h.button("Back to patient and physician").click());
  await select(h.container,"Saved patient claim","claim_second");
  await act(async()=>h.button("Continue to treatment").click());
  expect(diagnosis()).toHaveLength(1);expect(diagnosis()[0]?.value).toBe("M54.2");
  expect([...h.container.querySelectorAll("textarea")].every(input=>input.value==="")).toBe(true);
  expect(h.container.textContent).not.toContain("TEST-001");
 }finally{await h.close();}
});
