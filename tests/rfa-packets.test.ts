// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { createRfaPacketsClient, type RfaRecord, type RfaPacketHistory } from "@mindbill/browser";
import { RfaPacketsPanel, type RfaPacketsPanelProps } from "../packages/react/src/rfa-packets";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const record: RfaRecord = { id: "rfa_synthetic", contentRevision: 1, claimId: "claim_synthetic", patientId: "patient_synthetic", renderingProviderId: "provider_synthetic", claimsAdminId: null, employeeName: "Synthetic patient", providerName: "Synthetic physician", claimNumber: "SYNTHETIC-001", status: "sent", reviewType: "prospective", expedited: false, signedAt: null, submittedAt: null, receivedAt: null, createdAt: null, updatedAt: null, decisionDueAt: null, decisionDeadlineBasis: null, incompleteReason: null, deferredReason: null, closedReason: null, readiness: { ready: false, missing: [] }, items: [], documents: [], transmissions: [], informationRequests: [], events: [] };

const history: RfaPacketHistory = { packets: [{id:"packet_synthetic",source:"submission",sha256:"synthetic_digest",sizeBytes:10,contentRevision:1,createdAt:"2026-09-01T00:00:00Z"}], transmissions:[{id:"transmission_synthetic",packetId:"packet_synthetic",purpose:"submission",channel:"fax",status:"sent",destination:"+15555550100",occurredAt:"2026-09-01T00:00:00Z",receivedAt:null}] };
const getSession = async () => ({ token: "synthetic_token" });
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); vi.restoreAllMocks(); });
function fetcherFor(data = history) { return vi.fn<typeof fetch>(async (url, init) => {
  if (init?.method === "POST") return Response.json({data:{packetId:"packet_synthetic",transmissionId:"forward_synthetic"}});
  if (String(url).endsWith("/packets")) return Response.json({data});
  return new Response("%PDF-synthetic", {headers:{"content-type":"application/pdf"}});
}); }
async function mount(props: Partial<RfaPacketsPanelProps> = {}) {
  vi.spyOn(URL,"createObjectURL").mockReturnValue("about:blank"); vi.spyOn(URL,"revokeObjectURL").mockImplementation(() => undefined);
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  const render = async (extra: Partial<RfaPacketsPanelProps> = {}) => act(async () => root.render(createElement(RfaPacketsPanel, { rfa:record,getSession,permissions:["act"],environment:"live",...props,...extra })));
  const button = (text: string) => [...container.querySelectorAll("button")].find(item => item.textContent === text);
  const click = async (text: string) => act(async () => { const target = button(text); expect(target).toBeDefined(); target!.click(); });
  const select = async (index:number,value:string) => act(async () => { const target=container.querySelectorAll("select")[index]!;target.value=value;target.dispatchEvent(new Event("change",{bubbles:true})); });
  const recipient = async (value:string) => act(async () => { const target=container.querySelector('input[type="tel"],input[type="email"]') as HTMLInputElement; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(target,value);target.dispatchEvent(new Event("input",{bubbles:true})); });
  const confirm = async () => act(async () => { for (const target of container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) target.click(); });
  cleanups.push(async () => { await act(async () => root.unmount());container.remove(); });
  await render(); return {container,render,button,click,select,recipient,confirm};
}
it("retrieves retained PDF bytes, preserving encoded IDs and session refresh",async()=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null,{status:401})).mockResolvedValueOnce(new Response("%PDF-synthetic",{headers:{"content-type":"application/pdf"}}));
  const sessions=vi.fn(getSession); const client=createRfaPacketsClient({getSession:sessions,fetch:fetcher});
  expect(await (await client.get("rfa/synthetic","packet/synthetic")).text()).toBe("%PDF-synthetic");
  expect(String(fetcher.mock.calls[1]![0])).toContain("rfa%2Fsynthetic/packets/packet%2Fsynthetic");expect(sessions).toHaveBeenCalledTimes(2);
});
it("forwards only the immutable packet reference with a stable key through auth refresh",async()=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null,{status:401})).mockResolvedValueOnce(Response.json({data:{packetId:"packet_synthetic",transmissionId:"forward_synthetic"}}));
  const client=createRfaPacketsClient({getSession,fetch:fetcher});
  await client.forward(record.id,{packetId:"packet_synthetic",channel:"email",to:" SYNTHETIC@example.test "},"synthetic_key");
  for(const [,init] of fetcher.mock.calls){expect(new Headers(init?.headers).get("idempotency-key")).toBe("synthetic_key");expect(JSON.parse(String(init?.body))).toEqual({packetId:"packet_synthetic",channel:"email",to:"synthetic@example.test"});}
});
it("rejects invalid recipients and invalid PDF responses",async()=>{
  const fetcher=vi.fn<typeof fetch>(async()=>Response.json({data:{}}));const client=createRfaPacketsClient({getSession,fetch:fetcher});
  await expect(client.forward(record.id,{packetId:"packet_synthetic",channel:"fax",to:"555"},"synthetic_key")).rejects.toThrow("valid recipient");expect(fetcher).not.toHaveBeenCalled();
  await expect(client.get(record.id,"packet_synthetic")).rejects.toThrow("not a PDF");
});
it("requires saved PDF review and recipient confirmation before forwarding",async()=>{
  const fetcher=fetcherFor();const onForwarded=vi.fn();const ui=await mount({fetch:fetcher,onForwarded});
  await ui.select(0,"packet_synthetic");await ui.recipient("+15555550123");expect(ui.button("Forward packet by fax")?.disabled).toBe(true);
  await ui.click("View saved PDF");expect(ui.container.querySelector('a[download]')?.getAttribute("href")).toBe("about:blank");
  await ui.confirm();expect(ui.button("Forward packet by fax")?.disabled).toBe(false);
  await ui.click("Forward packet by fax");expect(onForwarded).toHaveBeenCalledExactlyOnceWith({packetId:"packet_synthetic",transmissionId:"forward_synthetic"});expect(ui.container.textContent).toContain("Check delivery history for receipt confirmation");expect(ui.button("Forward packet by fax")?.disabled).toBe(true);
});
it("resets review on recipient changes and preserves retry keys after uncertain failures",async()=>{
  const fetcher=fetcherFor();const base=fetcher.getMockImplementation()!;let attempts=0;
  fetcher.mockImplementation(async(url,init)=>{if(init?.method==="POST" && ++attempts===1)throw new Error("Forwarding could not be confirmed");return base(url,init);});
  const ui=await mount({fetch:fetcher});await ui.select(0,"packet_synthetic");await ui.click("View saved PDF");await ui.recipient("+15555550123");await ui.confirm();
  await ui.recipient("+15555550124");expect(ui.button("Forward packet by fax")?.disabled).toBe(true);await ui.confirm();await ui.click("Forward packet by fax");expect(ui.container.textContent).toContain("could not be confirmed");await ui.click("Forward packet by fax");
  const mutations=fetcher.mock.calls.filter(([,init])=>init?.method==="POST");expect(mutations).toHaveLength(2);expect(new Headers(mutations[0]![1]?.headers).get("idempotency-key")).toBe(new Headers(mutations[1]![1]?.headers).get("idempotency-key"));
});
it("blocks sandbox, missing permissions, and packets without successful submission",async()=>{
  const fetcher=fetcherFor();const ui=await mount({fetch:fetcher,environment:"sandbox"});await ui.select(0,"packet_synthetic");expect(ui.button("Forward packet by fax")).toBeUndefined();expect(ui.container.textContent).toContain("External forwarding is disabled");
  await ui.render({permissions:[],environment:"live"});expect(ui.button("Forward packet by fax")).toBeUndefined();
  await ui.render({environment:"live",fetch:fetcherFor({...history,transmissions:[]})});await ui.select(0,"packet_synthetic");expect(ui.container.textContent).toContain("not eligible for forwarding");
});
it("surfaces disabled email delivery truthfully",async()=>{
  const fetcher=fetcherFor();const base=fetcher.getMockImplementation()!;fetcher.mockImplementation(async(url,init)=>init?.method==="POST"?Response.json({detail:"rfa_email_live_disabled"},{status:409}):base(url,init));
  const ui=await mount({fetch:fetcher});await ui.select(0,"packet_synthetic");await ui.click("View saved PDF");await ui.select(1,"email");await ui.recipient("synthetic@example.test");await ui.confirm();await ui.click("Forward packet by email");expect(ui.container.querySelector('[role="alert"]')?.textContent).toContain("rfa_email_live_disabled");expect(ui.container.textContent).not.toContain("Forwarding recorded");
});
it("discards a pending PDF when switching requests",async()=>{
  let resolve!:(response:Response)=>void;const fetcher=fetcherFor();const base=fetcher.getMockImplementation()!;fetcher.mockImplementation((url,init)=>String(url).endsWith("/packets/packet_synthetic")?new Promise(done=>{resolve=done;}):base(url,init));
  const ui=await mount({fetch:fetcher});await ui.select(0,"packet_synthetic");await ui.click("View saved PDF");await ui.render({rfa:{...record,id:"rfa_synthetic_other"}});await act(async()=>resolve(new Response("%PDF-synthetic",{headers:{"content-type":"application/pdf"}})));expect(ui.container.querySelector("iframe")).toBeNull();
});

it("ignores a stale forwarding callback after switching requests",async()=>{
  let resolve!:(response:Response)=>void;const fetcher=fetcherFor();const base=fetcher.getMockImplementation()!;fetcher.mockImplementation((url,init)=>init?.method==="POST"?new Promise(done=>{resolve=done;}):base(url,init));const onForwarded=vi.fn();
  const ui=await mount({fetch:fetcher,onForwarded});await ui.select(0,"packet_synthetic");await ui.click("View saved PDF");await ui.recipient("+15555550123");await ui.confirm();await ui.click("Forward packet by fax");await ui.render({rfa:{...record,id:"rfa_synthetic_other"}});await act(async()=>resolve(Response.json({data:{packetId:"packet_synthetic",transmissionId:"forward_synthetic"}})));expect(onForwarded).not.toHaveBeenCalled();expect(ui.container.textContent).not.toContain("Forwarding recorded");
});
it("does not repeat a forward already recorded or pending",async()=>{
  const data={...history,transmissions:[...history.transmissions,{...history.transmissions[0]!,id:"forward_synthetic",purpose:"forward" as const,status:"queued",destination:"+15555550123"}]};const fetcher=fetcherFor(data);const ui=await mount({fetch:fetcher});await ui.select(0,"packet_synthetic");await ui.click("View saved PDF");await ui.recipient("+15555550123");await ui.confirm();expect(ui.button("Forward packet by fax")?.disabled).toBe(true);expect(fetcher.mock.calls.filter(([,init])=>init?.method==="POST")).toHaveLength(0);
});
it("lets a failed packet list load retry without exposing forwarding",async()=>{
  const fetcher=fetcherFor();fetcher.mockRejectedValueOnce(new Error("Connection interrupted"));const ui=await mount({fetch:fetcher});expect(ui.button("Forward packet by fax")).toBeUndefined();expect(ui.container.textContent).toContain("Connection interrupted");await ui.click("Retry loading packets");expect(ui.container.querySelector("select")).not.toBeNull();
});
