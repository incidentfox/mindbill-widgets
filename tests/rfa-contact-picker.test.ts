// @vitest-environment happy-dom
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { BillClaimsAdministratorDirectory, RfaContact } from "../packages/browser/src/index";
import { RfaContactPicker } from "../packages/react/src/rfa-contact-picker";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
it("preserves saved contact on load, supports keyboard directory selection and autofills the selected office", async () => {
 const host=document.createElement("div");document.body.append(host);const root=createRoot(host);
 const changes=vi.fn(); const search=vi.fn(async()=>[{id:"synthetic_new",name:"Synthetic administrator"}]);
 const directory=vi.fn(async(id:string)=>({name:id,authorizationStatus:"claim_handling_location_routes",authorization:[{name:"Synthetic authorization",location:"Synthetic office",fax:"2125550100",phone:"2125550199"}]} as BillClaimsAdministratorDirectory));
 function Harness(){const[id,setId]=useState("synthetic_old");const[contact,setContact]=useState<RfaContact|null>({name:"Saved custom",fax:"2125550188"});return createElement(RfaContactPicker,{administratorId:id,contextKey:"synthetic_claim",value:contact,disabled:false,searchClaimsAdministrators:search,getClaimsAdministratorDirectory:directory,onChange:(next,value)=>{changes(next,value);setId(next!);setContact(value);}});}
 try {
 await act(async()=>root.render(createElement(Harness)));
 expect(host.textContent).toContain("Saved custom");expect(changes).not.toHaveBeenCalled();
 const input=host.querySelector<HTMLInputElement>('[role="combobox"]')!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(input,"Synthetic");input.dispatchEvent(new Event("input",{bubbles:true}));});
 await act(async()=>{await new Promise(resolve=>setTimeout(resolve,330));});
 await act(async()=>{input.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowDown",bubbles:true}));});
 expect(input.getAttribute("aria-activedescendant")).toBeTruthy();
 await act(async()=>input.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true})));
 expect(changes).toHaveBeenCalledWith("synthetic_new",null);expect(host.textContent).not.toContain("Saved custom");
 const select=host.querySelector<HTMLSelectElement>("select")!;
 expect(select.options.length).toBeGreaterThan(1);
 await act(async()=>{select.value=select.options[1]!.value;select.dispatchEvent(new Event("change",{bubbles:true}));});
 expect(changes.mock.lastCall?.[1]).toMatchObject({name:"synthetic_new",fax:"+12125550100",phone:"2125550199"});
 expect(host.querySelector("details")?.open).toBe(false);
 }finally{await act(async()=>root.unmount());host.remove();}
});
it("ignores stale directory results after switching the claim and reports failed current lookups",async()=>{
 const host=document.createElement("div");const root=createRoot(host);let resolveOld!:(value:BillClaimsAdministratorDirectory)=>void;
 const directory=vi.fn((id:string)=>id==="synthetic_old"?new Promise<BillClaimsAdministratorDirectory>(resolve=>{resolveOld=resolve;}):Promise.reject(new Error("unavailable")));
 const change=vi.fn();const render=(id:string)=>createElement(RfaContactPicker,{administratorId:id,contextKey:id,value:null,disabled:false,getClaimsAdministratorDirectory:directory,onChange:change});
 try{
 await act(async()=>root.render(render("synthetic_old")));await act(async()=>root.render(render("synthetic_new")));
 await act(async()=>resolveOld({name:"Stale administrator",authorization:[{fax:"2125550100"}]}));
 expect(host.textContent).not.toContain("Stale administrator");expect(host.textContent).toContain("Directory details are unavailable");expect(host.querySelectorAll("option")).toHaveLength(3);expect(change).not.toHaveBeenCalled();
 }finally{await act(async()=>root.unmount());}
});
