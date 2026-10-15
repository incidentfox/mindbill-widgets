/* global document, innerWidth, innerHeight, getComputedStyle */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { resolve } from "node:path";

// Visual check for two phone details of the RFA pages. Synthetic, read-only data.
//   BROWSER_DEPENDENCY_ROOT=<dir with react, react-dom, playwright-core> SCREENSHOT_DIR=<dir> node scripts/verify-rfa-filter-sheet.mjs
// 1. All RFAs at 390x844: the search placeholder fits, and each filter chip (Status, Physician, Sent, Decision due) opens
//    as the shared bottom sheet (search on top for long lists, 48px rows), not a small floating popover.
// 2. Under a host's sticky 56px top bar, "Edit claims administrator or request" scrolls the claims administrator
//    section into view below the bar and focuses its picker.
// SOURCE_ROOT=<checkout> bundles another checkout's sources (for before/after screenshots); assertions then are skipped.
const require = createRequire(import.meta.url);
const host = createRequire(resolve(process.env.BROWSER_DEPENDENCY_ROOT ?? "/home/factory/development/repos/mindbill", "package.json"));
const { build } = createRequire(require.resolve("tsup/package.json"))("esbuild");
const { chromium } = host("playwright-core");
const source = resolve(process.env.SOURCE_ROOT ?? process.cwd());
const strict = !process.env.SOURCE_ROOT;
const label = process.env.SHOT_LABEL ?? "after";
const result = await build({
  stdin: { contents: `
import React from 'react';import {createRoot} from 'react-dom/client';import {RfaDashboard} from './packages/react/src/index.tsx';
const scene=location.hash.slice(1)||'list';
const doc=(id,documentType,filename)=>({id,documentType,filename,sha256:'0',sizeBytes:1000,contentRevision:1,createdAt:'2026-10-07T13:14:00Z'});
const make=(n,status,extra={})=>({id:'rfa_synthetic_'+n,contentRevision:1,claimId:'claim_synthetic',patientId:'patient_synthetic',renderingProviderId:'provider_synthetic',employeeName:'Sample patient '+n,dateOfInjury:'2025-06-01',providerName:'Sample physician, D.C.',claimsAdminName:'Sample administrator',claimNumber:'SAMPLE-00'+n,claimsAdminId:null,status,lifecycleStatus:status==='submitted'?'sent':'received',reviewType:'prospective',requestType:'new',expedited:false,signedAt:'2026-10-02T00:20:00Z',submittedAt:'2026-10-02T00:30:00Z',receivedAt:null,createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-07T13:20:00Z',decisionDueAt:null,readiness:{ready:true,missing:[]},
 items:[{id:'item_'+n,serviceDescription:'Therapeutic exercise',diagnosisCode:'M54.2',diagnosisDescription:'Cervicalgia',procedureCode:'97110',quantity:8,outcome:'pending'}],documents:[doc('doc_form','rfa_form','DWC-RFA-signed.pdf'),doc('doc_report','clinical_report','PR-2 progress report.pdf')],transmissions:[],informationRequests:[],events:[],requestingPractice:{name:'Sample Medical Group'},authorizationContact:{name:'Sample administrator',fax:'+15555550163'},...extra});
const failed=make(9,'submitted',{transmissions:[{id:'tx_failed',direction:'outbound',channel:'fax',status:'failed',purpose:'submission',destination:'+15555550163',occurredAt:'2026-10-02T00:40:00Z',receivedAt:null,proofDocumentId:null,providerMessageId:'FAX-SAMPLE-1',metadata:{failureReason:'busy'}}]});
const rows=[1,2,3].map(n=>make(n,n===2?'received':'submitted'));
const physicians=['Avery Sample, D.C.','Blake Example, M.D.','Casey Synthetic, D.O.','Devon Placeholder, M.D.','Emerson Test, P.T.','Finley Demo, M.D.','Gray Mock, D.C.','Harper Fixture, M.D.','Indigo Stub, D.O.','Jordan Dummy, M.D.','Kendall Fake, D.C.','Logan Trial, M.D.','Morgan Pilot, P.A.','Noel Draft, M.D.'].map((name,index)=>({id:'phys_'+index,name,npi:String(1000000000+index*7919)}));
const claims=[{claimId:'claim_synthetic',patientId:'patient_synthetic',employeeName:'Sample patient 9',claimNumber:'SAMPLE-009',dateOfInjury:'2025-06-01',claimsAdminId:null}];
const fetcher=async(input,init)=>{const url=new URL(String(input));const path=url.pathname;if((init?.method||'GET')!=='GET')throw Error('Unexpected mutation');
 if(path.endsWith('/creation-context'))return Response.json({data:{claims,renderingProviders:physicians,nextCursor:null,renderingProvidersNextCursor:null}});
 if(path.endsWith('/billing-profile'))return Response.json({data:{organizationId:'org_synthetic',practiceIdentity:{},billingProviders:[],renderingProviders:physicians,locations:[],w9:null,onboarding:{status:null,complete:true,checklist:[]}}});
 if(path.endsWith('/packets'))return Response.json({data:{packets:[],transmissions:[]}});
 if(path.endsWith('/scheduling'))return Response.json({data:[]});
 if(path.endsWith('/rfa-follow-ups'))return Response.json({data:[],nextCursor:null});
 if(path.endsWith('/rfa-inbound-faxes'))return Response.json({data:[]});
 if(path.endsWith('/events'))return Response.json({data:[]});
 if(path.includes('/documents/')||path.includes('/packets/'))return new Response(new Blob(['%PDF-1.4\\n%%EOF'],{type:'application/pdf'}));
 if(path.endsWith('/rfas'))return Response.json({data:rows,nextCursor:null,summary:{total:3,byStatus:{submitted:2,received:1},byLifecycleStatus:{sent:2,received:1}}});
 if(path.includes('/rfas/'))return Response.json({data:failed});
 return Response.json({data:[]});};
const props={appearance:{preset:'mindbill'},getSession:async()=>({token:'synthetic_session'}),fetch:fetcher,permissions:['act','edit','send','create'],layout:'simple',environment:'live',officialForm:true};
createRoot(document.getElementById('app')).render(React.createElement(RfaDashboard,scene==='edit'?{...props,selectedRfaId:failed.id}:props));
`, resolveDir: source, loader: "tsx" },
  bundle: true, write: false, minify: true, format: "iife", platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
  alias: {
    react: resolve(host.resolve("react/package.json"), ".."), "react-dom": resolve(host.resolve("react-dom/package.json"), ".."),
    "@mindbill/browser": resolve(source, "packages/browser/src/index.ts"), "@mindbill/embed": resolve(source, "packages/embed/src/index.ts"),
  },
});
// The host page has a sticky 56px top bar, as in the MindBill app.
const server = createServer((req, res) => {
  res.setHeader("content-type", req.url === "/app.js" ? "text/javascript" : "text/html");
  res.end(req.url === "/app.js" ? result.outputFiles[0].text : '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic RFA filters</title></head><body style="margin:0;background:#f5f4ef;font-family:Arial"><header style="position:sticky;top:0;z-index:50;height:56px;background:#17383a;color:#fff;display:flex;align-items:center;padding:0 16px">Host app bar</header><main id="app" style="max-width:1250px;margin:auto;padding:12px"></main><script src="/app.js"></script></body></html>');
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
const output = process.env.SCREENSHOT_DIR || "/tmp/mindbill-rfa-filter-sheet";
await mkdir(output, { recursive: true });
const shots = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  const shot = async (name) => { const path = resolve(output, `${name}-${label}-390x844.png`); await page.screenshot({ path }); shots.push(path); };

  await page.goto(`${origin}/#list`);
  await page.getByRole("button", { name: "All RFAs" }).first().click();
  const search = page.locator(".mbrfa-filterbar-search input");
  await search.waitFor(); await shot("all-rfas");
  if (strict) assert.ok(await search.evaluate(input => { const style = getComputedStyle(input); const canvas = document.createElement("canvas").getContext("2d"); canvas.font = `${style.fontSize} ${style.fontFamily}`; return canvas.measureText(input.placeholder).width <= input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight); }), "the search placeholder fits");
  const chips = page.locator(".mbrfa-chip > button");
  for (let index = 0; index < await chips.count(); index++) {
    const name = (await chips.nth(index).textContent())?.replace(/[^a-z ]/gi, "").trim().toLowerCase().replace(/\s+/g, "-") || `chip-${index}`;
    await chips.nth(index).click();
    await page.waitForTimeout(150);
    await shot(`filter-${name}-open`);
    if (strict) {
      const sheet = page.locator(".mbctl-pop[data-sheet]");
      assert.equal(await sheet.count(), 1, `${name}: opens as a bottom sheet`);
      const box = await sheet.boundingBox();
      assert.ok(box && Math.round(box.width) === 390 && Math.abs(box.y + box.height - 844) <= 1, `${name}: sheet spans the width at the bottom`);
      const rows = await sheet.locator("li[role=option]").evaluateAll(items => items.map(item => item.getBoundingClientRect().height));
      assert.ok(rows.length && rows.every(height => height >= 48), `${name}: 48px rows`);
      await sheet.getByRole("button", { name: "Close" }).click();
      await sheet.waitFor({ state: "detached" });
    } else await page.keyboard.press("Escape");
    await page.mouse.click(5, 300);
  }

  // A failed send: Send again, then "Edit claims administrator or request".
  await page.goto(`${origin}/#edit`); await page.reload();
  await page.getByRole("button", { name: "Send again" }).first().click();
  await page.getByRole("button", { name: "Edit claims administrator or request" }).click();
  const section = page.locator("#rfa-claims-administrator");
  await section.waitFor(); await page.waitForTimeout(1200);
  await shot("edit-claims-administrator");
  if (strict) {
    const top = await section.evaluate(element => element.getBoundingClientRect().top);
    assert.ok(top >= 56, `claims administrator heading below the 56px bar (top ${top})`);
    assert.ok(await section.evaluate(element => element.contains(document.activeElement) && document.activeElement !== element), "the claims administrator picker is focused");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && innerHeight > 0), "no horizontal scroll");
  }
  if (strict) assert.deepEqual(errors, []);
  console.log(`${strict ? "PASS" : "SHOTS"}: ${shots.length} screenshots → ${output}`);
} finally { await browser.close(); await new Promise(done => server.close(done)); }
