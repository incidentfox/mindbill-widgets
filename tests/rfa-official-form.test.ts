// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { RfaDraftForm } from "../packages/react/src/rfa-draft-form";
import type { RfaDraftInput } from "../packages/react/src/rfa-draft-form";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const initialDraft: RfaDraftInput = { claimId:"claim_synthetic", patientId:"patient_synthetic", renderingProviderId:"provider_synthetic", employeeName:"Synthetic Patient", providerName:"Synthetic Physician", items:[{diagnosisCode:"M54.2",diagnosisDescription:"Synthetic neck pain",serviceDescription:"Synthetic therapy",quantity:6,frequency:"Twice weekly", metadata:{preserved:"synthetic"}}] };
it.each(["Review & submit", "Preview", "Save draft"])("official form preserves legacy data and routes %s once", async (label) => {
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container);
 const onSave=vi.fn().mockResolvedValue(undefined),onReview=vi.fn().mockResolvedValue(undefined),onPreview=vi.fn().mockResolvedValue(undefined);
 try {
  await act(async()=>root.render(createElement(RfaDraftForm,{initialDraft,officialForm:true,onSave,onReview,onPreview})));
  expect([...container.querySelectorAll("input[readonly]")]).toHaveLength(0);
  expect([...container.querySelectorAll("label")].some(el=>el.textContent==="Quantity")).toBe(false);
  const other=[...container.querySelectorAll("textarea")].find(el=>el.parentElement?.textContent?.startsWith("Other Information"))!;
  expect(other.value).toContain("Quantity: 6; Twice weekly");
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")!.set!.call(other,"Six visits over three weeks");other.dispatchEvent(new Event("input",{bubbles:true}));});
  await act(async()=>[...container.querySelectorAll("button")].find(el=>el.textContent===label)!.click());
  const expected=label==="Preview"?onPreview:label==="Review & submit"?onReview:onSave;
  expect(expected).toHaveBeenCalledOnce();expect(onSave.mock.calls.length+onReview.mock.calls.length+onPreview.mock.calls.length).toBe(1);
  expect(expected.mock.calls[0]![0].items[0]).toMatchObject({quantity:6,frequency:"Twice weekly",metadata:{preserved:"synthetic",otherInformation:"Six visits over three weeks"}});
 }finally{await act(async()=>root.unmount());container.remove();}
});
it("practice selection prefers its unique location and excludes another practice's locations", async()=>{
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container);const onSave=vi.fn().mockResolvedValue(undefined);
 const profile={organizationId:"org_synthetic",practiceIdentity:{},billingProviders:[{id:"practice_a",name:"Synthetic Practice A",npi:"1234567890",billingStreet:"Billing address"},{id:"practice_b",name:"Synthetic Practice B",npi:"1234567890"}],locations:[{id:"location_a",billingProviderId:"practice_a",name:"Synthetic Clinic A",street:"Clinic address",city:"Test City",state:"CA",zip:"90001"},{id:"location_b",billingProviderId:"practice_b",name:"Synthetic Clinic B",street:"Other address",city:"Test City",state:"CA",zip:"90002"}],w9:null,onboarding:{status:null,complete:false,checklist:[]}};
 try{
  await act(async()=>root.render(createElement(RfaDraftForm,{initialDraft,officialForm:true,onSave,organizationProfile:profile})));
  await act(async()=>container.querySelector<HTMLButtonElement>('button[aria-label="Saved practice"]')!.click());
  await act(async()=>[...container.querySelectorAll<HTMLButtonElement>('button[role="option"]')].find(el=>el.textContent==="Synthetic Practice A")!.click());
  const address=[...container.querySelectorAll("input")].find(el=>el.parentElement?.textContent==="Address")!;expect(address.value).toBe("Clinic address");
  await act(async()=>container.querySelector<HTMLButtonElement>('button[aria-label="Practice location"]')!.click());
  expect([...container.querySelectorAll('[role="option"]')].map(el=>el.textContent).join(" ")).not.toContain("Synthetic Clinic B");
 }finally{await act(async()=>root.unmount());container.remove();}
});
