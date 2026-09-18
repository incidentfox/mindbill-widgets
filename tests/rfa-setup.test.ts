// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { RfaClient } from "../packages/browser/src/index";
import { RfaClaimSetup } from "../packages/react/src/rfa-claim-setup";
import { RfaProviderSignatureSetup } from "../packages/react/src/rfa-provider-signature-setup";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
function harness() {
 const container=document.createElement("div"); document.body.append(container); const root=createRoot(container);
 return {container,root,button:(text:string)=>[...container.querySelectorAll("button")].find(value=>value.textContent===text)!,close:async()=>{await act(async()=>root.unmount());container.remove();}};
}
async function type(container:HTMLElement,label:string,value:string) {
 const input=[...container.querySelectorAll("input")].find(input=>input.parentElement?.textContent===label)!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(input,value);input.dispatchEvent(new Event("input",{bubbles:true}));});
}
async function select(container:HTMLElement,label:string,value:string) {
 const input=[...container.querySelectorAll("select")].find(input=>input.parentElement?.textContent?.startsWith(label))!;
 await act(async()=>{input.value=value;input.dispatchEvent(new Event("change",{bubbles:true}));});
}
it("requires a selected administrator and active payer, then retries with stable patient/claim identities and idempotency",async()=>{
 const h=harness();const onCreated=vi.fn();const provisionClaim=vi.fn().mockRejectedValueOnce(new Error("connection lost")).mockResolvedValue({patientId:"patient_synthetic",claimId:"claim_synthetic"});
 const client={provisionClaim,searchClaimsAdministrators:vi.fn().mockResolvedValue([{id:"admin_synthetic",name:"Test Administrator",payerSelectionRequired:true,payers:[{id:"inactive",label:"Inactive payer",active:false},{id:"payer_synthetic",label:"Test payer",active:true}]}])} as unknown as RfaClient;
 try {
  await act(async()=>h.root.render(createElement(RfaClaimSetup,{client,onCreated,onCancel:vi.fn()})));
  expect(h.button("Save patient and injury").disabled).toBe(true);
  for(const [label,value] of Object.entries({"Patient first name":"Synthetic","Patient last name":"Patient","Date of birth":"1980-01-01","Patient street address":"100 Test St","Patient city":"Test City","Patient ZIP code":"90001","Claim number":"TEST-001","Employer":"Synthetic Employer","Date of injury":"2026-01-01"}))await type(h.container,label,value);
  await type(h.container,"Search claims administrators","Test");await act(async()=>new Promise(resolve=>setTimeout(resolve,350)));
  await select(h.container,"Claims administrator","admin_synthetic");expect(h.button("Save patient and injury").disabled).toBe(true);expect(h.container.textContent).not.toContain("Inactive payer");
  await select(h.container,"Payer","payer_synthetic");

  await act(async()=>h.container.querySelector("form")!.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
  expect(h.container.textContent).toContain("could not be saved");
  await act(async()=>h.container.querySelector("form")!.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
  expect(provisionClaim).toHaveBeenCalledTimes(2);expect(provisionClaim.mock.calls[0]).toEqual(provisionClaim.mock.calls[1]);
  expect(provisionClaim.mock.calls[0]?.[0]).toMatchObject({patient:{externalId:expect.stringMatching(/^rfa-patient-/)},claim:{externalId:expect.stringMatching(/^rfa-claim-/),claimsAdministrator:{id:"admin_synthetic",payerId:"payer_synthetic"}}});
  expect(onCreated).toHaveBeenCalledOnce();
 }finally{await h.close();}
});
it("requires explicit physician authorization and clears uploaded identity when physician changes",async()=>{
 const h=harness();const saveProviderSignature=vi.fn().mockResolvedValue({signatureConfigured:true});const client={saveProviderSignature} as unknown as RfaClient;const onSaved=vi.fn();
 try {
  const render=async(id:string)=>act(async()=>h.root.render(createElement(RfaProviderSignatureSetup,{client,renderingProviderId:id,onSaved})));
  await render("provider_one");expect(h.button("Save physician signature").disabled).toBe(true);
  const upload=h.container.querySelector('input[type="file"]') as HTMLInputElement;
  await act(async()=>{Object.defineProperty(upload,"files",{configurable:true,value:[new File(["synthetic-png-bytes"],"signature.png",{type:"image/png"})]});upload.dispatchEvent(new Event("change",{bubbles:true}));});
  await type(h.container,"Your name or staff reference","synthetic-staff");expect(h.button("Save physician signature").disabled).toBe(true);
  await act(async()=> (h.container.querySelector('input[type="checkbox"]') as HTMLInputElement).click());
  expect(h.button("Save physician signature").disabled).toBe(false);
  await act(async()=>{h.container.querySelector("form")!.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));await new Promise(resolve=>setTimeout(resolve,20));});
  expect(saveProviderSignature).toHaveBeenCalledWith("provider_one",{contentBase64:btoa("synthetic-png-bytes"),physicianAuthorized:true,actorReference:"synthetic-staff"},{idempotencyKey:expect.any(String)});expect(onSaved).toHaveBeenCalledOnce();
  await render("provider_two");expect(h.button("Save physician signature").disabled).toBe(true);expect((h.container.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(false);
 }finally{await h.close();}
});
