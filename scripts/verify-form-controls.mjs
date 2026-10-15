/* global document, innerWidth, innerHeight, window */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { resolve } from "node:path";

// Visual check for the shared form controls. Synthetic, read-only data; the mock rejects every mutation.
// Bundles the React source directly, so no build is needed:
//   BROWSER_DEPENDENCY_ROOT=<dir with react, react-dom, playwright-core> node scripts/verify-form-controls.mjs
// Opens the RFA dialogs at desktop and phone widths with each variant, a dropdown open and a calendar open; asserts that
// no native select or date/time input is on the page and that every open popover is fully visible (not clipped by a dialog).
const require = createRequire(import.meta.url);
const host = createRequire(resolve(process.env.BROWSER_DEPENDENCY_ROOT ?? "/home/factory/development/repos/mindbill", "package.json"));
const { build } = createRequire(require.resolve("tsup/package.json"))("esbuild");
const { chromium } = host("playwright-core");
const result = await build({
  stdin: { contents: `
import React from 'react';import {createRoot} from 'react-dom/client';import {RfaDashboard} from './packages/react/src/index.tsx';
const scene=location.hash.slice(1)||'detail';
const doc=(id,documentType,filename)=>({id,documentType,filename,sha256:'0',sizeBytes:1000,contentRevision:1,createdAt:'2026-10-07T13:14:00Z'});
const sent=scene==='detail';
const row={id:'rfa_synthetic',contentRevision:1,claimId:'claim_synthetic',patientId:'patient_synthetic',renderingProviderId:'provider_synthetic',employeeName:'Sample patient',dateOfInjury:'2025-06-01',providerName:'Sample physician, D.C.',providerNpi:'1234567890',claimsAdminName:'Sample administrator',claimNumber:'SAMPLE-001',status:sent?'under_review':'ready',reviewType:'prospective',requestType:'new',writtenConfirmation:false,expedited:false,signedAt:'2026-10-02T00:20:00Z',submittedAt:sent?'2026-10-02T00:30:00Z':null,receivedAt:sent?'2026-10-02T01:00:00Z':null,createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-07T13:20:00Z',decisionDueAt:sent?'2026-10-09T00:00:00Z':null,readiness:{ready:true,missing:[]},
 items:[{id:'item_approved',serviceDescription:'Chiropractic manipulative treatment, spinal, 3–4 regions',diagnosisCode:'M54.2',diagnosisDescription:'Cervicalgia',procedureCode:'98941',quantity:6,units:6,frequency:'1 visit per week',duration:'6 weeks',requestedFrom:'2026-10-03',requestedTo:'2026-11-27',outcome:sent?'approved':'pending',decidedAt:sent?'2026-10-07T13:14:00Z':null,authorizationNumber:sent?'SAMPLE-UR-001':null,authorizedProcedureCode:'98941',authorizedQuantity:6,authorizedUnits:6,effectiveFrom:'2026-10-07',effectiveTo:'2026-12-06',currentResponseDocumentId:sent?'doc_ur':null,currentDecisionEventId:sent?'event_1':null},
  {id:'item_pending',serviceDescription:'Therapeutic exercise',diagnosisCode:'M54.2',diagnosisDescription:'Cervicalgia',procedureCode:'97110',quantity:8,frequency:'2 visits per week',duration:'4 weeks',outcome:'pending'}],
 documents:[doc('doc_report','clinical_report','PR-2 progress report.pdf'),doc('doc_form','rfa_form','DWC-RFA-signed.pdf'),...(sent?[doc('doc_ur','ur_response','UR determination - Sample administrator.pdf'),doc('doc_ur2','ur_response','UR determination (corrected) - Sample administrator.pdf'),doc('doc_imr','imr_form','IMR application - blank.pdf')]:[])],
 transmissions:sent?[{id:'tx_sub',direction:'outbound',channel:'fax',status:'delivered',purpose:'submission',destination:'+15555550163',occurredAt:'2026-10-02T00:40:00Z',receivedAt:'2026-10-03T00:00:00Z',proofDocumentId:null,providerMessageId:'FAX-SAMPLE-1',packetId:'pkt_1'}]:[],informationRequests:[],events:[],requestingPractice:{},authorizationContact:{}};
const scheduling=[{itemId:'item_approved',serviceDescription:row.items[0].serviceDescription,outcome:'approved',eligible:true,authorizationToken:'token',version:0,disposition:'pending',current:true,appointmentAt:null,providerName:null,location:null,reason:null,updatedAt:null},{itemId:'item_pending',serviceDescription:'Therapeutic exercise',outcome:'pending',eligible:false,authorizationToken:'token2',version:0,disposition:'pending',current:true,appointmentAt:null,providerName:null,location:null,reason:null,updatedAt:null}];
const physicians=['Avery Sample, D.C.','Blake Example, M.D.','Casey Synthetic, D.O.','Devon Placeholder, M.D.','Emerson Test, P.T.','Finley Demo, M.D.','Gray Mock, D.C.','Harper Fixture, M.D.','Indigo Stub, D.O.','Jordan Dummy, M.D.','Kendall Fake, D.C.','Logan Trial, M.D.','Morgan Pilot, P.A.','Noel Draft, M.D.'].map((name,index)=>({id:'phys_'+index,name,npi:String(1000000000+index*7919),specialty:index%3?'Orthopedic surgery':'Chiropractic'}));
const locations=['Downtown clinic','Harbor office','Valley medical center','Northside therapy'].map((name,index)=>({id:'loc_'+index,billingProviderId:'bp_1',name,street:(100+index*11)+' Sample Street',city:'Example City',state:'CA',zip:'9000'+index,active:true}));
const profile={organizationId:'org_synthetic',practiceIdentity:{},billingProviders:[{id:'bp_1',name:'Sample Medical Group',npi:'1234567893',billingStreet:'1 Sample Plaza',billingCity:'Example City',billingState:'CA',billingZip:'90001'}],renderingProviders:physicians,locations,w9:null,onboarding:{status:null,complete:true,checklist:[]}};
const claims=[{claimId:'claim_synthetic',patientId:'patient_synthetic',employeeName:'Sample patient',claimNumber:'SAMPLE-001',dateOfInjury:'2025-06-01',claimsAdminId:null,claimsAdminName:'Sample administrator'}];
window.__writes=[];
const fetcher=async(input,init)=>{const url=new URL(String(input));const path=url.pathname;if((init?.method||'GET')!=='GET'){window.__writes.push(path);throw Error('Unexpected mutation');}
 if(path.endsWith('/creation-context')){const q=(url.searchParams.get('providerSearch')||'').toLowerCase();return Response.json({data:{claims,renderingProviders:physicians.filter(p=>!q||p.name.toLowerCase().includes(q)||p.npi.includes(q)),nextCursor:null,renderingProvidersNextCursor:null}});}
 if(path.endsWith('/billing-profile'))return Response.json({data:profile});
 if(path.endsWith('/packets'))return Response.json({data:{packets:[],transmissions:[]}});
 if(path.endsWith('/scheduling'))return Response.json({data:scheduling});
 if(path.endsWith('/rfa-follow-ups'))return Response.json({data:[],nextCursor:null});
 if(path.includes('/documents/')||path.includes('/packets/'))return new Response(new Blob(['%PDF-1.4\\n%%EOF'],{type:'application/pdf'}));
 if(path.endsWith('/events'))return Response.json({data:[]});
 if(path.endsWith('/rfa-inbound-faxes'))return Response.json({data:[]});
 if(path.endsWith('/rfas'))return Response.json({data:[],nextCursor:null});
 return Response.json({data:row});};
const props={appearance:{preset:'mindbill'},getSession:async()=>({token:'synthetic_session'}),fetch:fetcher,permissions:['act','edit','send','create'],layout:'simple',officialForm:scene!=='create'};
createRoot(document.getElementById('app')).render(React.createElement(RfaDashboard,scene==='create'?{...props,initialView:'create'}:{...props,selectedRfaId:row.id}));
`, resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, write: false, minify: true, format: "iife", platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
  alias: {
    react: resolve(host.resolve("react/package.json"), ".."), "react-dom": resolve(host.resolve("react-dom/package.json"), ".."),
    "@mindbill/browser": resolve("packages/browser/src/index.ts"), "@mindbill/embed": resolve("packages/embed/src/index.ts"),
  },
});
const server = createServer((req, res) => {
  res.setHeader("content-type", req.url === "/app.js" ? "text/javascript" : "text/html");
  res.end(req.url === "/app.js" ? result.outputFiles[0].text : '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic form controls</title></head><body style="margin:0;padding:20px;background:#f5f4ef;font-family:Arial"><main id="app" style="max-width:1250px;margin:auto"></main><script src="/app.js"></script></body></html>');
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
const output = process.env.SCREENSHOT_DIR || "/tmp/mindbill-form-controls-verification";
await mkdir(output, { recursive: true });
const NATIVE = "select, input[type=date], input[type=datetime-local], input[type=time], input[type=month], input[type=week]";
const shots = [];
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: width > 500 ? 1000 : 860 } }); const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    const shot = async (name) => {
      assert.equal(await page.locator(NATIVE).count(), 0, `${name}: native controls on the page`);
      // An open popover must be fully on screen and on top: its corners hit the popover itself, not a dialog edge.
      const clipped = await page.evaluate(() => [...document.querySelectorAll(".mbctl-pop")].flatMap(pop => {
        const box = pop.getBoundingClientRect(); if (box.top < 0 || box.left < 0 || box.bottom > innerHeight || box.right > innerWidth) return ["off-screen"];
        return [[box.left + 4, box.top + 4], [box.right - 4, box.top + 4], [box.left + 4, box.bottom - 4], [box.right - 4, box.bottom - 4]].filter(([x, y]) => !pop.contains(document.elementFromPoint(x, y))).map(String);
      }));
      assert.deepEqual(clipped, [], `${name}: popover clipped or covered`);
      const path = resolve(output, `${name}-${width}.png`); await page.screenshot({ path }); shots.push(path);
    };
    const dialog = () => page.locator(".mbrfa-modal [role=dialog]").last();
    const openSelect = async (label) => { await dialog().getByRole("combobox", { name: label }).first().click(); await page.locator(".mbctl-pop").waitFor(); };
    const openCalendar = async (label) => { await dialog().getByRole("button", { name: new RegExp(`Choose ${label}.* from a calendar`, "i") }).first().click(); await page.locator(".mbctl-cal").waitFor(); };
    const close = () => page.keyboard.press("Escape");

    // Treatment cards: Record UR decision, appointment and decision correction.
    await page.goto(`${origin}/#detail`); await page.locator(".mbrfa-tx").first().waitFor();
    assert.equal(await page.locator(NATIVE).count(), 0);
    await page.locator(".mbrfa-tx").nth(1).getByRole("button", { name: "Record decision" }).click();
    await page.getByRole("dialog", { name: /Record (UR|treatment) decision/ }).waitFor();
    for (const outcome of ["Approved", "Modified", "Denied", "Pending"]) {
      await dialog().getByRole("radio", { name: outcome }).first().click();
      await shot(`record-decision-${outcome.toLowerCase()}`);
    }
    await dialog().getByRole("radio", { name: "Modified" }).first().click();
    await openSelect(/Utilization review response/); await shot("record-decision-letter-open"); await close();
    await openCalendar("decision date"); await shot("record-decision-calendar-open"); await close();
    await openSelect(/IMR application/); await shot("record-decision-imr-open"); await close();
    await close(); await page.getByRole("dialog").waitFor({ state: "detached" });

    const approved = page.locator(".mbrfa-tx").first();
    await approved.getByRole("button", { name: "Schedule" }).click();
    await page.getByRole("dialog", { name: /Appointment/ }).waitFor();
    await shot("appointment-scheduled");
    await openSelect(/^Provider/); await shot("appointment-provider-open");
    await page.locator(".mbctl-pop-search").fill("Har"); await page.waitForTimeout(600); await shot("appointment-provider-search");
    await page.locator(".mbctl-pop li[role=option]").first().click();
    await openSelect(/^Location/); await shot("appointment-location-open");
    await page.locator('.mbctl-pop li[data-value="__other_location__"]').click();
    await dialog().getByPlaceholder("Clinic name and address").fill("Synthetic satellite office, 9 Example Road");
    await shot("appointment-other-location");
    await openCalendar("appointment date"); await shot("appointment-calendar-open"); await close();
    await openSelect(/^Disposition/); await shot("appointment-disposition-open");
    await page.locator('.mbctl-pop li[data-value="no_appointment"]').click(); await shot("appointment-no-appointment");
    await close(); await page.getByRole("dialog").waitFor({ state: "detached" });

    await approved.getByRole("button", { name: "Correct decision" }).click();
    await page.getByRole("dialog", { name: /Correct decision/ }).waitFor();
    for (const outcome of ["Approved", "Modified", "Denied"]) {
      await dialog().getByRole("radio", { name: outcome }).click();
      await shot(`correct-${outcome.toLowerCase()}`);
    }
    await openSelect(/^UR decision letter/); await shot("correct-letter-open"); await close();
    await openCalendar("decision date"); await shot("correct-calendar-open"); await close();
    await openSelect(/^IMR application/); await shot("correct-imr-open"); await close();
    await close(); await page.getByRole("dialog").waitFor({ state: "detached" });

    // Mark as sent on an RFA that was never sent.
    await page.goto(`${origin}/#unsent`); await page.reload(); await page.getByRole("button", { name: /Mark as sent/ }).first().waitFor();
    await page.getByRole("button", { name: /Mark as sent/ }).first().click();
    await page.getByRole("dialog", { name: /sent/i }).waitFor();
    await shot("mark-sent");
    await openSelect(/How it was sent/); await shot("mark-sent-channel-open"); await close();
    await openCalendar("sent on"); await shot("mark-sent-calendar-open"); await close();
    await dialog().getByText(/The claims administrator received it/).click(); await shot("mark-sent-received");
    await close();

    // Creating an RFA.
    await page.goto(`${origin}/#create`); await page.reload();
    await page.getByRole("combobox", { name: "Requesting physician" }).waitFor();
    await shot("create-form");
    await page.getByRole("combobox", { name: "Requesting physician" }).click(); await page.locator(".mbctl-pop").waitFor(); await shot("create-physician-open");
    await page.locator(".mbctl-pop li[role=option]").nth(1).click();
    await page.getByRole("combobox", { name: "Patient and claim" }).click(); await page.locator(".mbctl-pop li[role=option]").first().click();
    await page.waitForTimeout(300);
    const dateButton = page.getByRole("button", { name: /from a calendar/i }).first();
    if (await dateButton.count()) { await dateButton.scrollIntoViewIfNeeded(); await dateButton.click(); await page.locator(".mbctl-cal").waitFor(); await shot("create-calendar-open"); await close(); }
    const typeSelect = page.getByRole("combobox").filter({ hasText: /New request|Prospective|Standard/ }).first();
    if (await typeSelect.count()) { await typeSelect.scrollIntoViewIfNeeded(); await typeSelect.click(); await page.locator(".mbctl-pop").waitFor(); await shot("create-select-open"); await close(); }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no horizontal scroll");
    assert.deepEqual(errors, []); assert.deepEqual(await page.evaluate(() => window.__writes), []);
    await page.close();
  }
  console.log(`PASS: ${shots.length} screenshots, no native controls, no clipped popovers, no writes → ${output}`);
} finally { await browser.close(); await new Promise(done => server.close(done)); }
