/* global document, innerWidth, window */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { resolve } from "node:path";

// Run after pnpm build. Synthetic, read-only: one approved and one pending treatment, a UR response and a follow-up.
// Opening a dialog must not write anything; the mock rejects every mutation.
const require = createRequire(import.meta.url);
const host = createRequire(resolve(process.env.BROWSER_DEPENDENCY_ROOT, "package.json"));
const { build } = createRequire(require.resolve("tsup/package.json"))("esbuild");
const { chromium } = host("playwright-core");
const result = await build({
 stdin:{contents:`
import React from 'react';import {createRoot} from 'react-dom/client';import {RfaDashboard} from './packages/react/dist/index.js';
const doc=(id,documentType,filename)=>({id,documentType,filename,sha256:'0',sizeBytes:1000,contentRevision:1,createdAt:'2026-10-07T13:14:00Z'});
const row={id:'rfa_synthetic',contentRevision:1,claimId:'claim_synthetic',patientId:'patient_synthetic',renderingProviderId:'provider_synthetic',employeeName:'Sample patient',dateOfInjury:'2025-06-01',providerName:'Sample physician, D.C.',providerNpi:'1234567890',claimsAdminName:'Sample administrator',claimNumber:'SAMPLE-001',status:'under_review',reviewType:'prospective',requestType:'new',writtenConfirmation:false,expedited:false,signedAt:'2026-10-02T00:20:00Z',submittedAt:'2026-10-02T00:30:00Z',receivedAt:'2026-10-02T01:00:00Z',createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-07T13:20:00Z',decisionDueAt:'2026-10-09T00:00:00Z',readiness:{ready:true,missing:[]},
 items:[{id:'item_approved',serviceDescription:'Chiropractic manipulative treatment, spinal, 3–4 regions',diagnosisCode:'M54.2',diagnosisDescription:'Cervicalgia',procedureCode:'98941',quantity:6,units:6,frequency:'1 visit per week',duration:'6 weeks',requestedFrom:'2026-10-03',requestedTo:'2026-11-27',outcome:'approved',decidedAt:'2026-10-07T13:14:00Z',authorizationNumber:'SAMPLE-UR-001',authorizedProcedureCode:'98941',authorizedQuantity:6,authorizedUnits:6,effectiveFrom:'2026-10-07',effectiveTo:'2026-12-06',currentResponseDocumentId:'doc_ur',currentDecisionEventId:'event_1'},
  {id:'item_pending',serviceDescription:'Therapeutic exercise',diagnosisCode:'M54.2',diagnosisDescription:'Cervicalgia',procedureCode:'97110',quantity:8,frequency:'2 visits per week',duration:'4 weeks',outcome:'pending'}],
 documents:[doc('doc_report','clinical_report','PR-2 progress report.pdf'),doc('doc_form','rfa_form','DWC-RFA-signed.pdf'),doc('doc_ur','ur_response','UR determination - Sample administrator.pdf')],
 transmissions:[{id:'tx_sub',direction:'outbound',channel:'fax',status:'delivered',purpose:'submission',destination:'+15555550163',occurredAt:'2026-10-02T00:40:00Z',receivedAt:'2026-10-03T00:00:00Z',proofDocumentId:null,providerMessageId:'FAX-SAMPLE-1',packetId:'pkt_1'},{id:'tx_fwd',direction:'outbound',channel:'fax',status:'sending',purpose:'forward',destination:'+15555550199',occurredAt:'2026-10-08T00:40:00Z',receivedAt:null,proofDocumentId:null,providerMessageId:null,packetId:'pkt_1'}],informationRequests:[],events:[],requestingPractice:{},authorizationContact:{}};
const scheduling=[{itemId:'item_approved',serviceDescription:row.items[0].serviceDescription,outcome:'approved',eligible:true,authorizationToken:'token',version:0,disposition:'pending',current:true,appointmentAt:null,providerName:null,location:null,reason:null,updatedAt:null},{itemId:'item_pending',serviceDescription:'Therapeutic exercise',outcome:'pending',eligible:false,authorizationToken:'token2',version:0,disposition:'pending',current:true,appointmentAt:null,providerName:null,location:null,reason:null,updatedAt:null}];
const task={id:'task_1',rfaId:row.id,claimId:row.claimId,responseDocumentId:'doc_ur',responseFilename:'UR determination - Sample administrator.pdf',kind:'post_ur_decision',status:'open',dueAt:'2026-10-08T09:30:00Z',assigneeReference:null,snoozedUntil:null,lastOutcome:null,lastNote:null,createdAt:'2026-10-07T13:20:00Z',updatedAt:'2026-10-07T13:20:00Z',resolvedAt:null};
window.__writes=[];
const fetcher=async(input,init)=>{const path=new URL(String(input)).pathname;if((init?.method||'GET')!=='GET'){window.__writes.push(path);throw Error('Unexpected mutation');}
 if(path.endsWith('/packets'))return Response.json({data:{packets:[],transmissions:[]}});
 if(path.endsWith('/scheduling'))return Response.json({data:scheduling});
 if(path.endsWith('/rfa-follow-ups'))return Response.json({data:[task],nextCursor:null});
 if(path.includes('/documents/'))return new Response(new Blob(['%PDF-1.4\\n%%EOF'],{type:'application/pdf'}));
 if(path.endsWith('/events'))return Response.json({data:[{id:'ev_1',sequence:1,eventType:'transmission_recorded',actor:'integration',payload:{transmissionId:'tx_sub',channel:'fax',destination:'+15555550163'},occurredAt:'2026-10-02T00:40:00Z'},{id:'ev_2',sequence:2,eventType:'followup_resolved',actor:'system:rfa-follow-ups',payload:{reason:'source_condition_cleared'},occurredAt:'2026-10-08T00:00:00Z'}]});
 if(path.includes('/packets/'))return new Response(new Blob(['%PDF-1.4\\n%%EOF'],{type:'application/pdf'}));
 if(path.endsWith('/rfa-inbound-faxes'))return Response.json({data:[]});
 return Response.json({data:row});};
createRoot(document.getElementById('app')).render(React.createElement(RfaDashboard,{appearance:{preset:'mindbill'},getSession:async()=>({token:'synthetic_session'}),fetch:fetcher,permissions:['act','edit','send'],layout:'simple',selectedRfaId:row.id,officialForm:true}));
`,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,minify:true,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"production"'},alias:{react:resolve(host.resolve('react/package.json'),'..'),'react-dom':resolve(host.resolve('react-dom/package.json'),'..')}
});
const server = createServer((req, res) => {
  res.setHeader("content-type", req.url === "/app.js" ? "text/javascript" : "text/html");
  res.end(req.url === "/app.js" ? result.outputFiles[0].text : '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic RFA treatment cards</title></head><body style="margin:0;padding:20px;background:#f5f4ef;font-family:Arial"><main id="app" style="max-width:1250px;margin:auto"></main><script src="/app.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
const output = process.env.SCREENSHOT_DIR || "/tmp/mindbill-rfa-treatment-cards-verification";
await mkdir(output, { recursive: true });
try {
 for (const width of [1440, 390]) {
  const page = await browser.newPage({ viewport: { width, height: 1100 } }); const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.route("**/*", route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  await page.goto(origin);
  await page.locator(".mbrfa-tx").first().waitFor();
  const cards = await page.locator(".mbrfa-tx").evaluateAll(nodes => nodes.map(node => ({ head: node.querySelector(".mbrfa-tx-head").innerText.replace(/\s+/g, " "), panels: [...node.querySelectorAll(".mbrfa-tx-panel h4")].map(h => h.textContent) })));
  assert.equal(cards.length, 2); assert.deepEqual(cards[0].panels, ["Utilization Review Decision", "Appointment"]);
  const approved = page.locator(".mbrfa-tx").first();
  assert.match(await approved.innerText(), /SAMPLE-UR-001/); assert.match(await approved.innerText(), /UR Decision Date/);
  assert.match(await page.locator(".mbrfa-tx").nth(1).innerText(), /UR Decision Due/);
  // No form is laid out on the page until a button asks for it.
  assert.equal(await page.locator(".mbrfa-tx form, .mbrfa-rows form").count(), 0);
  assert.equal(await page.locator("text=Response to review").count(), 0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: resolve(output, `cards-${width}.png`), fullPage: true });
  await approved.getByRole("button", { name: "Schedule" }).click();
  await page.getByRole("dialog", { name: /Appointment/ }).waitFor();
  await page.screenshot({ path: resolve(output, `appointment-dialog-${width}.png`) });
  await page.keyboard.press("Escape"); assert.equal(await page.getByRole("dialog").count(), 0);
  // A pending treatment records its own decision; the dialog lists it first and lets the decision PDF be attached in place.
  assert.equal(await approved.getByRole("button", { name: "Record decision" }).count(), 0);
  await page.locator(".mbrfa-tx").nth(1).getByRole("button", { name: "Record decision" }).click();
  const fromCard = page.getByRole("dialog", { name: /Record treatment decisions/ });
  await fromCard.waitFor();
  assert.match(await fromCard.locator("fieldset fieldset legend").first().innerText(), /Therapeutic exercise/);
  assert.equal(await fromCard.getByLabel(/attach a different UR decision/i).count(), 1);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Record decisions/ }).first().click();
  const decisions = page.getByRole("dialog", { name: /Record treatment decisions/ });
  await decisions.waitFor(); assert.equal(await decisions.locator("form").count(), 1);
  await page.screenshot({ path: resolve(output, `decisions-dialog-${width}.png`) });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Update" }).first().click();
  await page.getByRole("dialog", { name: /follow-up/ }).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "History & Activity" }).click();
  const delivery = page.getByRole("region", { name: "Delivery" });
  await delivery.waitFor();
  assert.equal(await delivery.getByRole("button", { name: "View PDF" }).count(), 2);
  assert.equal(await delivery.getByRole("button", { name: "Refresh status" }).count(), 1, "only the fax still sending offers a status refresh");
  assert.equal(await delivery.getByRole("button", { name: "Forward" }).count(), 0, "Forward lives in the title row and action bar");
  assert.equal(await page.getByText("Saved Packets", { exact: true }).count(), 0);
  assert.equal(await page.getByText("Check fax delivery status").count(), 0);
  assert.equal(await page.getByText("source_condition_cleared").count(), 0);
  await page.screenshot({ path: resolve(output, `history-${width}.png`), fullPage: true });
  assert.deepEqual(errors, []); assert.deepEqual(await page.evaluate(() => window.__writes), []);
  await page.close();
 }
 console.log(`PASS: treatment cards, dialogs, no inline forms, no writes, desktop and mobile → ${output}`);
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
