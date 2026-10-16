/* global document, window */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { resolve } from "node:path";

// Visual check for RfaClaimIndex, RelatedAuthorizationRecords and BillUrDecisions. Synthetic data; an in-page mock
// answers every request, nothing leaves the page. Bundles the React source directly, so no build is needed:
//   BROWSER_DEPENDENCY_ROOT=<dir with react, react-dom, playwright-core> SCREENSHOT_DIR=<dir> node scripts/verify-rfa-records.mjs
// Shoots each scene at 1440x900 and 390x844 and asserts no native select/date inputs and no horizontal page overflow.
const require = createRequire(import.meta.url);
const host = createRequire(resolve(process.env.BROWSER_DEPENDENCY_ROOT ?? "/home/factory/development/repos/mindbill", "package.json"));
const { build } = createRequire(require.resolve("tsup/package.json"))("esbuild");
const { chromium } = host("playwright-core");
const result = await build({
  stdin: { contents: `
import React from 'react';import {createRoot} from 'react-dom/client';import {RfaClaimIndex,RelatedAuthorizationRecords,BillUrDecisions} from './packages/react/src/index.tsx';
const scene=location.hash.slice(1)||'claim';
const item=(id,service,code,outcome,extra={})=>({id,diagnosisCode:'M54.50',serviceDescription:service,procedureCode:code,frequency:'2x/week',duration:'4 weeks',outcome,quantity:8,units:null,
 authorizationNumber:outcome==='approved'||outcome==='modified'?'SYN-AUTH-'+id:null,decisionReason:null,decidedAt:outcome==='pending'?null:'2026-09-10T17:00:00Z',...extra});
const rfa=(id,status,lifecycleStatus,provider,created,submitted,items,extra={})=>({id,status,lifecycleStatus,renderingProviderId:'rp_'+provider.length,providerName:provider,expedited:false,requestType:'initial',
 contentRevision:1,claimId:'claim_synthetic',patientId:'patient_synthetic',claimsAdminId:null,employeeName:'Sample patient',claimNumber:'SYN-0001',reviewType:'prospective',
 createdAt:created,updatedAt:created,signedAt:submitted,submittedAt:submitted,receivedAt:null,decisionDueAt:submitted?'2026-09-20T00:00:00Z':null,decisionDeadlineBasis:null,incompleteReason:null,deferredReason:null,closedReason:null,
 readiness:{ready:true,missing:[]},items,documents:[],...extra});
const rows=[
 rfa('rfa_5f2c91aa01','approved','closed','Sample Physician, MD','2026-08-20T10:00:00Z','2026-08-21T10:00:00Z',[item('a1','Physical therapy, lumbar spine','97110','approved'),item('a2','Lumbar MRI without contrast','72148','denied')]),
 rfa('rfa_7b13e0cc02','submitted','sent','Second Sample Physician, DO','2026-09-12T10:00:00Z','2026-09-13T10:00:00Z',[item('b1','Chiropractic manipulative treatment, spinal, 3-4 regions','98941','pending'),item('b2','Therapeutic exercise follow-up with a deliberately long description to check wrapping','97110','pending',{decisionClosure:{closed:true}})],{expedited:true}),
 rfa('rfa_9d44a1ee03','draft','incomplete','Sample Physician, MD','2026-09-15T10:00:00Z',null,[item('c1','Acupuncture, 1 or more needles','97810','pending')]),
];
const related={claimId:'claim_synthetic',hasMore:false,data:[
 {id:'bill_1',label:'Bill #1042',treatments:['Physical therapy, lumbar spine'],relationship:'Linked authorization',status:'submitted',serviceDate:'2026-09-12'},
 {id:'bill_2',label:'Bill #1031',treatments:['Office visit, established patient'],relationship:'Same injury',status:'paid',serviceDate:'2026-08-30'}]};
const decisions={editable:true,linked:[
 {rfaId:'rfa_5f2c91aa01',rfaItemId:'a1',service:'Physical therapy, lumbar spine',form:{state:'attached'},decision:{state:'attached',authorizationNumber:'SYN-AUTH-a1'}},
 {rfaId:'rfa_7b13e0cc02',rfaItemId:'b1',service:'Chiropractic manipulative treatment, spinal, 3-4 regions',form:{state:'attached'},decision:{state:'unavailable',message:'The stored document failed validation.'}}],
 decisions:[
 {documentId:'doc_1',rfaId:'rfa_5f2c91aa01',filename:'ur-decision.pdf',decidedAt:'2026-09-10T17:00:00Z',attached:false,matchesBill:true,treatments:[{service:'Physical therapy, lumbar spine',code:'97110',outcome:'approved',authorizationNumber:'SYN-AUTH-a1',effectiveFrom:'2026-09-10',effectiveTo:'2026-10-10'},{service:'Lumbar MRI without contrast',code:'72148',outcome:'denied',authorizationNumber:null,effectiveFrom:null,effectiveTo:null}]},
 {documentId:'doc_2',rfaId:'rfa_7b13e0cc02',filename:'ur-decision-2.pdf',decidedAt:null,attached:true,matchesBill:false,treatments:[{service:'Office visit',code:'99213',outcome:'modified',authorizationNumber:'SYN-AUTH-x',effectiveFrom:'2026-09-01',effectiveTo:'2026-09-30'}]}]};
const fetcher=async(input,init)=>{const url=new URL(String(input));const path=url.pathname;
 if((init?.method||'GET')!=='GET')return Response.json({data:{attached:1}});
 if(path.endsWith('/rfas/related'))return Response.json(related);
 if(path.endsWith('/ur-decisions'))return Response.json({data:decisions});
 if(path.endsWith('/rfas'))return Response.json({data:rows,nextCursor:null,summary:{total:rows.length,byStatus:{}}});
 throw Error('Unexpected '+path);};
const common={appearance:{preset:'mindbill'},getSession:async()=>({token:'synthetic_session'}),fetch:fetcher,getRfaHref:id=>'#rfa-'+id};
const element=scene==='claim'?React.createElement(RfaClaimIndex,{...common,claimId:'claim_synthetic',canCreate:true,createHref:'#create'})
 :scene==='treatments'?React.createElement(RfaClaimIndex,{...common,claimId:'claim_synthetic',canCreate:true,createHref:'#create'})
 :scene==='related'?React.createElement(RelatedAuthorizationRecords,{...common,rfaId:'rfa_5f2c91aa01',getBillHref:id=>'#bill-'+id,getClaimHref:id=>'#claim-'+id})
 :React.createElement(BillUrDecisions,{...common,billId:'bill_1',canEdit:true});
createRoot(document.getElementById('app')).render(element);
`, resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, write: false, minify: true, format: "iife", platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
  alias: {
    react: resolve(host.resolve("react/package.json"), ".."), "react-dom": resolve(host.resolve("react-dom/package.json"), ".."),
    "@mindbill/browser": resolve("packages/browser/src/index.ts"), "@mindbill/embed": resolve("packages/embed/src/index.ts"),
  },
});
const server = createServer((req, res) => {
  res.setHeader("content-type", req.url === "/app.js" ? "text/javascript" : "text/html");
  res.end(req.url === "/app.js" ? result.outputFiles[0].text : '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic RFA records</title></head><body style="margin:0;padding:16px;background:#f5f2e9"><div id="app"></div><script src="/app.js"></script></body></html>');
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
const output = process.env.SCREENSHOT_DIR || "/tmp/mindbill-rfa-records-verification";
await mkdir(output, { recursive: true });
const NATIVE = "select, input[type=date], input[type=datetime-local], input[type=time], input[type=month], input[type=week]";
const shots = [];
try {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    for (const scene of ["claim", "treatments", "related", "decisions"]) {
      const page = await browser.newPage({ viewport: { width, height } }); const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("**/*", route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
      await page.goto(`${origin}/#${scene}`);
      await page.waitForSelector(".mbrr-card");
      if (scene === "treatments") await page.getByRole("tab", { name: /Requested treatments/ }).click();
      if (scene === "related") await page.locator("details summary").click();
      if (scene === "decisions") await page.getByRole("checkbox").first().check();
      assert.equal(await page.locator(NATIVE).count(), 0, `${scene}: native controls on the page`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      assert.equal(overflow, false, `${scene} at ${width}: page scrolls horizontally`);
      assert.deepEqual(errors, [], `${scene}: page errors`);
      const file = resolve(output, `rfa-records-${scene}-${width}.png`);
      await page.screenshot({ path: file, fullPage: true }); shots.push(file);
      await page.close();
    }
  }
} finally { await browser.close(); server.close(); }
process.stdout.write(`${shots.join("\n")}\n`);
