// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { RfaDraftForm } from "../packages/react/src/rfa-draft-form";
import { RfaCreateForm } from "../packages/react/src/rfa-create-form";
import type { RfaDraftInput } from "../packages/react/src/rfa-draft-form";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const initialDraft: RfaDraftInput = { claimId:"claim_synthetic", patientId:"patient_synthetic", renderingProviderId:"provider_synthetic", employeeName:"Synthetic Patient", providerName:"Synthetic Physician", requestingPractice:{fax:"(202) 555-0100"}, items:[{diagnosisCode:"M54.2",diagnosisDescription:"Synthetic neck pain",serviceDescription:"Synthetic therapy",quantity:6,frequency:"Twice weekly", metadata:{preserved:"synthetic"}}] };
it.each(["Review & submit", "Preview", "Save draft"])("official form preserves legacy data and routes %s once", async (label) => {
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container);
 const onSave=vi.fn().mockResolvedValue(undefined),onReview=vi.fn().mockResolvedValue(undefined),onPreview=vi.fn().mockResolvedValue(undefined);
 try {
  await act(async()=>root.render(createElement(RfaDraftForm,{initialDraft,officialForm:true,onSave,onReview,onPreview})));
  expect(container.querySelectorAll("input[readonly]")).toHaveLength(0);
  expect([...container.querySelectorAll(".mbrfa-saved > span")].map(el=>el.textContent)).toEqual(["Name (Last, First, Middle)","Date of Injury (MM/DD/YYYY)","Date of Birth (MM/DD/YYYY)","Claim Number","Employer","Physician Name","Specialty","NPI Number"]);
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
 const profile={organizationId:"org_synthetic",practiceIdentity:{},billingProviders:[{id:"practice_a",name:"Synthetic Practice A",npi:"1234567890",billingStreet:"Billing address"},{id:"practice_b",name:"Synthetic Practice B",npi:"1234567890"}],locations:[{id:"location_a",billingProviderId:"practice_a",name:"Synthetic Clinic A",street:"Clinic address",city:"Test City",state:"CA",zip:"90001",contact:{name:"Synthetic Contact",fax:"(202) 555-0177",email:"contact@example.test"}},{id:"location_b",billingProviderId:"practice_b",name:"Synthetic Clinic B",street:"Other address",city:"Test City",state:"CA",zip:"90002"}],w9:null,onboarding:{status:null,complete:false,checklist:[]}};
 try{
  await act(async()=>root.render(createElement(RfaDraftForm,{initialDraft,officialForm:true,onSave,organizationProfile:profile})));
  await act(async()=>container.querySelector<HTMLButtonElement>('button[aria-label="Saved practice"]')!.click());
  await act(async()=>[...container.querySelectorAll<HTMLButtonElement>('button[role="option"]')].find(el=>el.textContent==="Synthetic Practice A")!.click());
  const physician=[...container.querySelectorAll("form > fieldset")].find(el=>el.querySelector("legend")!.textContent==="Requesting Physician Information")!;
  const shown=(label:string)=>[...physician.querySelectorAll(".mbrfa-saved")].find(el=>el.firstChild!.textContent===label)!.querySelector("strong")!.textContent;
  // A chosen saved practice shows as information, not as boxes to type into.
  expect(physician.querySelectorAll(".mbrfa-form-grid input")).toHaveLength(0);
  expect([shown("Address"),shown("Contact Name"),shown("Fax Number *"),shown("E-mail Address")]).toEqual(["Clinic address","Synthetic Contact","(202) 555-0177","contact@example.test"]);
  // Saved records are edited through their own lookups, so this section has no manual-entry switch.
  expect([...physician.querySelectorAll("button")].some(el=>el.textContent==="Edit manually")).toBe(false);
  await act(async()=>container.querySelector<HTMLButtonElement>('button[aria-label="Practice location"]')!.click());
  expect([...container.querySelectorAll('[role="option"]')].map(el=>el.textContent).join(" ")).not.toContain("Synthetic Clinic B");
 }finally{await act(async()=>root.unmount());container.remove();}
});
it("follows the DWC Form RFA order and shows every printed field with saved values", async()=>{
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container);const onSave=vi.fn().mockResolvedValue(undefined);
 try{
  await act(async()=>root.render(createElement(RfaDraftForm,{initialDraft:{...initialDraft,claimNumber:"SYN-0001",dateOfInjury:"2026-01-02",providerNpi:"1234567890"},officialForm:true,onSave,
   formDetails:{employee:{formName:"Patient, Synthetic Q",dateOfBirth:"1980-03-04",employer:"Synthetic Employer"},physician:{specialty:"Orthopedic Surgery"}},organizationProfile:{organizationId:"org_synthetic",practiceIdentity:{},billingProviders:[],renderingProviders:[{id:"provider_synthetic",name:"Synthetic Physician",npi:"1234567890",email:"physician@example.test"}],locations:[],w9:null,onboarding:{status:null,complete:false,checklist:[]}},
   selectors:{claim:createElement("span",{id:"claim-lookup"}),physician:createElement("span",{id:"physician-lookup"})}})));
  expect([...container.querySelectorAll("form > fieldset > legend")].map(el=>el.textContent)).toEqual(["Request type","Employee Information","Requesting Physician Information","Claims Administrator Information","Requested Treatment"]);
  const section=(title:string)=>[...container.querySelectorAll("form > fieldset")].find(el=>el.querySelector("legend")!.textContent===title)!;
  const fields=(title:string)=>[...section(title).querySelectorAll<HTMLElement>(".mbrfa-form-grid label, .mbrfa-form-grid .mbrfa-saved")].map(el=>[el.firstChild!.textContent,el.matches(".mbrfa-saved")?el.querySelector("strong")!.textContent!.replace(/^—$/,""):el.querySelector<HTMLInputElement>("input,textarea")!.value]);
  expect(fields("Employee Information")).toEqual([["Name (Last, First, Middle)","Patient, Synthetic Q"],["Date of Injury (MM/DD/YYYY)","01/02/2026"],["Date of Birth (MM/DD/YYYY)","03/04/1980"],["Claim Number","SYN-0001"],["Employer","Synthetic Employer"]]);
  expect(fields("Requesting Physician Information")).toEqual([["Physician Name","Synthetic Physician"],["Practice Name",""],["Contact Name",""],["Address",""],["City",""],["State",""],["Zip Code",""],["Phone",""],["Fax Number *","(202) 555-0100"],["Specialty","Orthopedic Surgery"],["NPI Number","1234567890"],["E-mail Address","physician@example.test"]]);
  expect(fields("Claims Administrator Information").map(([label])=>label)).toEqual(["Company Name","Contact Name","Address","City","State","Zip Code","Phone","Fax Number","E-mail Address"]);
  expect(fields("Requested Treatment").map(([label])=>label)).toEqual(["Diagnosis *","ICD-Code *","Service/Good Requested *","CPT/HCPCS Code (If known)","Other Information: (Frequency, Duration, Quantity, etc.)"]);
  expect(section("Employee Information").querySelector("#claim-lookup")).not.toBeNull();
  expect([...section("Requesting Physician Information").querySelectorAll(".mbrfa-pickers > .mbrfa-picker > span:first-child")].map(el=>el.textContent)).toEqual(["Requesting physician *","Practice","Practice location"]);
 }finally{await act(async()=>root.unmount());container.remove();}
});
it("official creation is usable before a claim or physician is chosen and saving asks for them", async()=>{
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container);const onSave=vi.fn().mockResolvedValue(undefined);
 const client={getCreationContext:async()=>({claims:[],renderingProviders:[],nextCursor:null,renderingProvidersNextCursor:null})} as never;
 try{
  await act(async()=>root.render(createElement(RfaCreateForm,{client,onSave,draftFormProps:{officialForm:true}})));
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});
  const resubmission=[...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')][1]!;
  expect(resubmission.matches(":disabled")).toBe(false);
  await act(async()=>resubmission.click());expect(resubmission.checked).toBe(true);
  expect([...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].every(input=>!input.matches(":disabled"))).toBe(true);
  for (const field of container.querySelectorAll<HTMLInputElement|HTMLTextAreaElement>("[required]")) field.required=false;
  await act(async()=>[...container.querySelectorAll("button")].find(el=>el.textContent==="Save draft")!.click());
  expect(onSave).not.toHaveBeenCalled();expect(container.querySelector('[role="alert"]')!.textContent).toContain("Choose a patient claim and requesting physician");
 }finally{await act(async()=>root.unmount());container.remove();}
});
it("requires a requesting physician fax to review and fills it from the organization's line", async()=>{
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container);
 const onSave=vi.fn().mockResolvedValue(undefined),onReview=vi.fn().mockResolvedValue(undefined);
 const draft={...initialDraft,requestingPractice:null};
 const fax=()=>[...container.querySelectorAll("input")].find(el=>el.parentElement?.firstChild?.textContent==="Fax Number *")!;
 try{
  await act(async()=>root.render(createElement(RfaDraftForm,{initialDraft:draft,officialForm:true,onSave,onReview})));
  expect(fax().value).toBe("");
  await act(async()=>[...container.querySelectorAll("button")].find(el=>el.textContent==="Review & submit")!.click());
  expect(onReview).not.toHaveBeenCalled();expect(container.querySelector('[role="alert"]')!.textContent).toContain("fax number");
  await act(async()=>[...container.querySelectorAll("button")].find(el=>el.textContent==="Save draft")!.click());
  expect(onSave).toHaveBeenCalledOnce();
  await act(async()=>root.render(createElement(RfaDraftForm,{initialDraft:draft,officialForm:true,onSave,onReview,formDetails:{returnFax:"+12025550100",returnEmail:"synthetic-org@example.test"}})));
  expect(fax().value).toBe("(202) 555-0100");
  expect([...container.querySelectorAll("input")].find(el=>el.parentElement?.firstChild?.textContent==="E-mail Address")!.value).toBe("synthetic-org@example.test");
  await act(async()=>[...container.querySelectorAll("button")].find(el=>el.textContent==="Review & submit")!.click());
  expect(onReview).toHaveBeenCalledOnce();expect(onReview.mock.calls[0]![0].requestingPractice.fax).toBe("+12025550100");
 }finally{await act(async()=>root.unmount());container.remove();}
});
