/* global document, window, innerWidth, DataTransfer */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { resolve } from "node:path";

// Run after pnpm build. All records and writes are synthetic mock API operations.
const require = createRequire(import.meta.url);
const host = createRequire(resolve(process.env.BROWSER_DEPENDENCY_ROOT, "package.json"));
const { build } = createRequire(require.resolve("tsup/package.json"))("esbuild");
const { chromium } = host("playwright-core");
const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 4 0 R >>", "<< /Length 0 >>\nstream\n\nendstream"];
let pdf = "%PDF-1.4\n";
const offsets = [];
for (const [index, object] of objects.entries()) { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; }
const xref = pdf.length;
pdf += `xref\n0 5\n0000000000 65535 f \n${offsets.map(offset => String(offset).padStart(10, "0") + " 00000 n ").join("\n")}\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
const result = await build({
  stdin: { contents: `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {RfaDashboard} from './packages/react/dist/index.js';
const scenario=new URLSearchParams(location.search).get('scenario')||'valid';
const day=n=>new Date(Date.now()-n*86400000).toISOString();
const missingDocs=scenario.includes('documents');
let row={id:'RFA-SAMPLE-1001',contentRevision:1,claimId:'claim_sample',patientId:'patient_sample',renderingProviderId:'provider_sample',employeeName:'Sample patient',providerName:'Sample physician',claimsAdminName:'Example claims administrator',injuryDescription:'Lumbar injury',claimNumber:'SAMPLE-001',status:'draft',lifecycleStatus:'incomplete',reviewType:'prospective',expedited:false,createdAt:day(2),updatedAt:day(1),signedAt:null,submittedAt:null,receivedAt:null,readiness:{ready:!missingDocs,missing:missingDocs?['supporting_document']:[]},documents:missingDocs?[]:[{id:'report_existing',documentType:'clinical_report',filename:'existing-report.pdf',contentRevision:1,createdAt:day(1)}],transmissions:[],informationRequests:[],events:[],items:[{id:'therapy',serviceDescription:scenario.includes('fields')?'':'Physical therapy',diagnosisCode:'M54.50',diagnosisDescription:scenario.includes('diagnosis')?'':'Low back pain',procedureCode:'97110',outcome:'pending'}],requestingPractice:{name:'Sample practice',address:'100 Example St',city:'Sample City',state:'CA',zip:'90001',phone:'5555550100',fax:'5555550101'},authorizationContact:{name:'Sample administrator',fax:'+15555550102'}};
window.__probe={writes:[],documentReads:0,uploadAttempts:0};
let failed=false;
const fetcher=async(input,init)=>{
 const path=new URL(String(input)).pathname; const method=init?.method||'GET';
 if(method==='PATCH'&&path.endsWith('/draft')){
  const body=JSON.parse(init.body);if(body.expectedRevision!==row.contentRevision)throw Error('Stale draft revision');
  window.__probe.writes.push({kind:'draft',revision:body.expectedRevision});
  row={...row,...body,contentRevision:row.contentRevision+1,items:body.items.map((item,i)=>({...row.items[i],...item}))};return Response.json({data:row});
 }
 if(method==='POST'&&path.endsWith('/documents')){
  const revision=Number(init.body.get('contentRevision'));const file=init.body.get('file');
  if(revision!==row.contentRevision)throw Error('Stale upload revision');
  window.__probe.uploadAttempts++;
  if(scenario==='retry'&&window.__probe.uploadAttempts===2&&!failed){failed=true;return Response.json({error:{message:'Synthetic upload failure'}},{status:503});}
  window.__probe.writes.push({kind:'upload',filename:file.name,revision});
  row={...row,contentRevision:row.contentRevision+1,documents:[...row.documents,{id:'report_'+window.__probe.uploadAttempts,documentType:'clinical_report',filename:file.name,contentRevision:revision,createdAt:day(0)}]};return Response.json({data:row});
 }
 if(method!=='GET')throw Error('Unexpected synthetic mutation '+method+' '+path);
 if(path.endsWith('/billing-profile'))return Response.json({data:{billingProviders:[],locations:[]}});
 if(path.endsWith('/creation-context'))return Response.json({data:{claims:[],renderingProviders:[]}});
 if(path.includes('/documents/')){window.__probe.documentReads++;return new Response(${JSON.stringify(pdf)},{headers:{'content-type':'application/pdf'}});}
 if(path.endsWith('/packets'))return Response.json({data:{packets:[],transmissions:[]}});
 if(path.endsWith('/scheduling')||path.endsWith('/events'))return Response.json({data:[]});
 if(path.endsWith('/rfas/'+row.id))return Response.json({data:row});
 if(path.endsWith('/rfa-follow-ups'))return Response.json({data:[],nextCursor:null});
 if(path.endsWith('/rfas'))return Response.json({data:[row],nextCursor:null});
 throw Error('Unmocked verification route: '+path);
};
createRoot(document.getElementById('app')).render(React.createElement(RfaDashboard,{appearance:{preset:'mindbill'},getSession:async()=>({token:'synthetic_session'}),fetch:fetcher,permissions:['edit','send','sign','act'],actorReference:'synthetic_coordinator',environment:'live',layout:'simple',officialForm:true,selectedRfaId:row.id,...(scenario.startsWith('recovery')?{initialDetailAction:'send'}:{})}));
`, resolveDir: process.cwd(), loader: "jsx" },
  bundle: true, write: false, minify: true, format: "iife", platform: "browser",
  define: { "process.env.NODE_ENV": '"production"' },
  alias: { react: resolve(host.resolve("react/package.json"), ".."), "react-dom": resolve(host.resolve("react-dom/package.json"), "..") },
});
const server = createServer((req, res) => {
  res.setHeader("content-type", req.url === "/app.js" ? "text/javascript" : "text/html");
  res.end(req.url === "/app.js" ? result.outputFiles[0].text : '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic RFA draft verification</title></head><body style="margin:0;padding:20px;background:#f5f4ef;font-family:Arial"><main id="app" style="max-width:1250px;margin:auto"></main><script src="/app.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
const output = process.env.SCREENSHOT_DIR || "/tmp/mindbill-rfa-draft-edit-verification";
await mkdir(output, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.route("**/*", route => route.request().url().startsWith(origin) || ['blob:','chrome://','chrome-extension://'].some(prefix=>route.request().url().startsWith(prefix)) ? route.continue() : route.abort());
  const primary=()=>page.locator('.mbrfa-bottom-actions .mbtd-primary');
  const save=()=>page.getByRole('button',{name:'Save draft changes',exact:true});
  const cancel=()=>save().locator('..').getByRole('button',{name:'Cancel',exact:true});
  const visit=async scenario=>{await page.goto(origin+'/?scenario='+scenario);await page.getByText('Request for Authorization',{exact:true}).waitFor();};
  const drop=async names=>{
    const transfer=await page.evaluateHandle(({pdf,names})=>{const transfer=new DataTransfer();for(const name of names)transfer.items.add(new File([pdf],name,{type:'application/pdf'}));return transfer;},{pdf,names});
    await page.locator('.mbrfa-dropzone').dispatchEvent('drop',{dataTransfer:transfer});await transfer.dispose();
    for(const name of names)await page.getByRole('button',{name:'Remove '+name,exact:true}).waitFor();
  };
  for(const [scenario,label] of [['documents','Add documents'],['diagnosis','Edit request'],['fields','Edit request'],['valid','Send']]){
    await visit(scenario);assert.equal(await primary().textContent(),label);
    await page.screenshot({path:resolve(output,'rfa-'+scenario+'-desktop.png'),fullPage:true});
    await primary().click();
    if(scenario==='valid'){await page.getByRole('dialog',{name:'Send request for authorization'}).waitFor();await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();}
    else {await save().waitFor();await cancel().click();await primary().waitFor();}
  }
  for(const scenario of ['recovery-documents','recovery-diagnosis','recovery-fields']){
    await visit(scenario);const dialog=page.getByRole('dialog',{name:'Send request for authorization'});await dialog.waitFor();
    assert.equal(await dialog.getByRole('button',{name:'Send fax',exact:true}).isDisabled(),true);
    await dialog.getByRole('button',{name:scenario.includes('documents')?'Add documents':'Edit request',exact:true}).click();await save().waitFor();assert.equal(await dialog.count(),0);
  }
  await visit('valid');await page.getByRole('button',{name:'Edit request',exact:true}).click();await save().waitFor();
  assert.equal(await page.getByText('Discard edits and refresh',{exact:true}).count(),0);
  await cancel().waitFor();await page.locator('.mbrfa-dropzone').waitFor();
  await page.getByRole('button',{name:'View PDF',exact:true}).click();await page.locator('iframe[title="existing-report.pdf"]').waitFor();
  assert.equal(await page.evaluate(()=>window.__probe.documentReads),1);
  await drop(['cancelled-report.pdf']);assert.deepEqual(await page.evaluate(()=>window.__probe.writes),[]);
  await cancel().click();await primary().waitFor();await page.getByRole('button',{name:'Edit request',exact:true}).click();await save().waitFor();
  assert.equal(await page.getByRole('button',{name:'Remove cancelled-report.pdf',exact:true}).count(),0);
  await drop(['new-report.pdf']);await page.screenshot({path:resolve(output,'rfa-edit-desktop.png'),fullPage:true});
  await page.locator('fieldset').filter({has:page.locator('legend').filter({hasText:'Supporting documents'})}).screenshot({path:resolve(output,'rfa-supporting-documents-desktop.png')});
  await page.setViewportSize({width:390,height:844});await save().scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'mobile overflow');
  await page.screenshot({path:resolve(output,'rfa-edit-mobile.png'),fullPage:true});
  await page.screenshot({path:resolve(output,'rfa-actions-mobile.png')});
  await save().click();await primary().waitFor();assert.deepEqual((await page.evaluate(()=>window.__probe.writes)).map(write=>write.kind),['draft','upload']);
  await page.setViewportSize({width:1440,height:1100});await visit('retry');await page.getByRole('button',{name:'Edit request',exact:true}).click();await save().waitFor();await drop(['first-report.pdf','retry-report.pdf']);await save().click();
  await page.getByText(/remaining files are still selected/).waitFor();
  assert.equal(await page.getByRole('button',{name:'Remove first-report.pdf',exact:true}).count(),0);await page.getByRole('button',{name:'Remove retry-report.pdf',exact:true}).waitFor();
  await page.screenshot({path:resolve(output,'rfa-upload-retry-desktop.png'),fullPage:true});
  await save().click();await primary().waitFor();
  const writes=await page.evaluate(()=>window.__probe.writes);assert.deepEqual(writes.map(write=>write.kind),['draft','upload','draft','upload']);assert.deepEqual(writes.filter(write=>write.kind==='upload').map(write=>write.filename),['first-report.pdf','retry-report.pdf']);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,screenshots:output,scenarios:['primary readiness','send recovery','editor PDF review','queued upload and cancellation','save upload','partial failure retry','mobile layout']}));
} finally { await browser.close();await new Promise(resolve=>server.close(resolve)); }
