/* global document, innerWidth */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { resolve } from "node:path";

// Run after pnpm build. Uses local synthetic records only; no API writes or fax sends.
const require = createRequire(import.meta.url);
const host = createRequire(resolve(process.env.BROWSER_DEPENDENCY_ROOT, "package.json"));
const { build } = createRequire(require.resolve("tsup/package.json"))("esbuild");
const { chromium } = host("playwright-core");
const pdfObjects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 4 0 R >>",
  "<< /Length 0 >>\nstream\n\nendstream",
];
let syntheticPdf = "%PDF-1.4\n";
const offsets = [0];
for (const [index, object] of pdfObjects.entries()) { offsets.push(syntheticPdf.length); syntheticPdf += `${index + 1} 0 obj\n${object}\nendobj\n`; }
const xref = syntheticPdf.length;
syntheticPdf += `xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(offset => String(offset).padStart(10, "0") + " 00000 n ").join("\n")}\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
const result = await build({
  stdin: { contents: `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {RfaDashboard} from './packages/react/dist/index.js';
const day=n=>new Date(Date.now()-n*86400000).toISOString();
const row={id:'RFA-SAMPLE-1001',contentRevision:1,claimId:'claim_sample',patientId:'patient_sample',renderingProviderId:'provider_sample',employeeName:'Sample patient',providerName:'Sample physician',claimNumber:'SAMPLE-001',status:'received',lifecycleStatus:'received',reviewType:'prospective',expedited:false,createdAt:day(20),updatedAt:day(1),signedAt:day(20),submittedAt:day(18),receivedAt:day(17),decisionDueAt:day(10),readiness:{ready:true,missing:[]},documents:[{id:'response_first',documentType:'ur_response',filename:'earlier-response.pdf'},{id:'response_exact',documentType:'ur_response',filename:'review-this-response.pdf'}],transmissions:[],informationRequests:[],events:[],items:[{id:'therapy',serviceDescription:'Physical therapy',diagnosisCode:'M54.50',procedureCode:'97110',outcome:'pending'},{id:'imaging',serviceDescription:'Lumbar imaging',diagnosisCode:'M54.50',procedureCode:'72148',outcome:'pending'}]};
const kinds=['document_required','send_rfa','transmission_failed','transmission_unconfirmed','no_response','clock_review','post_ur_decision','information_requested','schedule_treatment'];
const tasks=kinds.map((kind,i)=>({id:'task_'+i,rfaId:row.id,claimId:row.claimId,kind,status:'open',createdAt:day([2,9,20,40][i%4]),updatedAt:day(1),dueAt:day(1),snoozedUntil:null,resolvedAt:null,assigneeReference:'Sample coordinator',...(kind==='post_ur_decision'?{createdAt:day(9),responseDocumentId:'response_exact',responseFilename:'review-this-response.pdf'}:{})}));
tasks.push({...tasks[0],id:'task_scheduled',dueAt:day(-3)} ,{...tasks[1],id:'task_completed',status:'resolved',resolvedAt:day(1)});
const summary={total:6,byStatus:{received:2,sent:1,closed:1,draft:2},byLifecycleStatus:{received:2,sent:1,closed:1,incomplete:2},aging:{byBucket:{'0_5':1,'6_14':0,'15_30':2,'31_plus':0},byLifecycleStatus:{sent:{'0_5':1,'6_14':0,'15_30':0,'31_plus':0},received:{'0_5':0,'6_14':0,'15_30':2,'31_plus':0}}}};
const fetcher=async(input,init)=>{
 if(init?.method && init.method!=='GET') throw Error('Browser verification must remain read-only');
 const url=new URL(String(input)); const path=url.pathname;
 if(path.endsWith('/rfa-follow-ups')) return Response.json(url.searchParams.has('cursor')?{data:tasks.slice(5),nextCursor:null}:{data:tasks.slice(0,5),nextCursor:'synthetic-page-2'});
 if(path.endsWith('/rfa-inbound-faxes')) return Response.json({data:[{id:'fax_sample',receivedAt:day(1),fromFax:'+15555550100',fromName:'Sample reviewer',pages:2,suggestedRfaIds:[row.id]}],nextCursor:null,hasMore:false});
 if(path.includes('/documents/')) return new Response(${JSON.stringify(syntheticPdf)},{headers:{'content-type':'application/pdf'}});
 if(path.endsWith('/packets')) return Response.json({data:{packets:[],transmissions:[]}});
 if(path.endsWith('/scheduling')||path.endsWith('/events')) return Response.json({data:[]});
 if(path.endsWith('/rfas/'+row.id)) return Response.json({data:row});
 if(path.endsWith('/rfas')) return Response.json({data:[row],nextCursor:null,summary});
 throw Error('Unmocked verification route: '+path);
};
createRoot(document.getElementById('app')).render(React.createElement(RfaDashboard,{appearance:{preset:'mindbill'},getSession:async()=>({token:'synthetic_session'}),fetch:fetcher,permissions:['act']}));
`, resolveDir: process.cwd(), loader: "jsx" },
  bundle: true, write: false, minify: true, format: "iife", platform: "browser",
  define: { "process.env.NODE_ENV": '"production"' },
  alias: { react: resolve(host.resolve("react/package.json"), ".."), "react-dom": resolve(host.resolve("react-dom/package.json"), "..") },
});
const server = createServer((req, res) => {
  res.setHeader("content-type", req.url === "/app.js" ? "text/javascript" : "text/html");
  res.end(req.url === "/app.js" ? result.outputFiles[0].text : '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic RFA dashboard verification</title></head><body style="margin:0;padding:20px;background:#f5f4ef;font-family:Arial"><main id="app" style="max-width:1250px;margin:auto"></main><script src="/app.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
const output = process.env.SCREENSHOT_DIR || "/tmp/mindbill-rfa-task-dashboard-verification";
await mkdir(output, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()+" "+message.location().url); });
  await page.route("**/*", route => route.request().url().startsWith(origin) || ['blob:','chrome://','chrome-extension://'].some(prefix=>route.request().url().startsWith(prefix)) ? route.continue() : route.abort());
  await page.goto(origin);
  await page.getByRole('button', {name:'Due (9)',exact:true}).waitFor();
  assert.equal(await page.locator('.mbrfa-task-group').count(),5);
  await page.getByText('Match UR · Incoming responses (1)',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Received · 15–30 days since submission: 2 requests',exact:true}).waitFor();
  await page.screenshot({path:resolve(output,'rfa-tasks-desktop.png'),fullPage:true});
  await page.getByRole('button',{name:'Post UR, 6–14 days: 1 due tasks',exact:true}).click();
  const selected=page.getByRole('region',{name:'Selected tasks',exact:true});
  assert.equal(await selected.locator('tbody tr').count(),1);
  await selected.getByText('review-this-response.pdf',{exact:true}).waitFor();
  await selected.screenshot({path:resolve(output,'rfa-post-ur-drilldown.png')});
  await selected.getByRole('button',{name:'Review response',exact:true}).click();
  await page.getByRole('region',{name:'Response document review',exact:true}).waitFor();
  assert.equal(await page.getByRole('region',{name:'Response document review',exact:true}).locator('select').inputValue(),'response_exact');
  await page.getByRole('button',{name:'← All requests',exact:true}).click();
  await page.getByRole('button',{name:'All RFAs',exact:true}).click();
  await page.getByRole('region',{name:'RFA table',exact:true}).locator('tbody tr').first().waitFor();
  assert.equal(await page.getByRole('region',{name:'RFA table',exact:true}).locator('tbody tr').count(),1);
  await page.locator('.mbrfa-list-mode select').selectOption('treatments');
  await page.getByRole('region',{name:'Requested treatments table',exact:true}).locator('tbody tr').nth(1).waitFor();
  assert.equal(await page.getByRole('region',{name:'Requested treatments table',exact:true}).locator('tbody tr').count(),2);
  await page.screenshot({path:resolve(output,'rfa-treatments-desktop.png'),fullPage:true});
  await page.locator('input[type=search]').fill('Sample');
  await page.waitForTimeout(400);
  await page.getByRole('button',{name:'RFA tasks',exact:true}).click();
  await page.getByRole('button',{name:'Received · 15–30 days since submission: 2 requests',exact:true}).click();
  assert.equal(await page.locator('input[type=search]').inputValue(),'');
  await page.getByRole('button',{name:'RFA tasks',exact:true}).click();
  await page.getByRole('button',{name:'Scheduled (1)',exact:true}).click();
  assert.equal(await page.locator('.mbrfa-task-group').count(),1);
  await page.getByRole('button',{name:'Completed (1)',exact:true}).click();
  assert.equal(await page.locator('.mbrfa-task-group').count(),1);
  await page.getByRole('button',{name:'Due (9)',exact:true}).click();
  await page.getByText('Match UR · Incoming responses (1)',{exact:true}).click();
  await page.getByRole('button',{name:'Review fax',exact:true}).waitFor();
  await page.getByText('Match UR · Incoming responses (1)',{exact:true}).click();
  for (const [name, viewport] of [['desktop',{width:1440,height:1100}],['mobile',{width:390,height:844}]]) {
    await page.setViewportSize(viewport);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false, name+' page overflow');
    await page.screenshot({path:resolve(output,'rfa-tasks-'+name+'.png'),fullPage:true});
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,checks:['paginated task totals','five next-action aging groups','submission-age summary','Post UR exact response selection','one request versus two treatments','scheduled and completed views','Match UR access','summary clears stale search','desktop and mobile overflow','no browser errors'],screenshots:output}));
} finally {
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
