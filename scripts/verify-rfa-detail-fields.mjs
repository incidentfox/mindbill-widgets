/* global document, innerWidth */
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
const result = await build({
 stdin:{contents:`
import React from 'react';import {createRoot} from 'react-dom/client';import {RfaDashboard} from './packages/react/dist/index.js';
const empty=new URLSearchParams(location.search).has('empty');
const row={id:'rfa_synthetic',contentRevision:1,claimId:'claim_synthetic',patientId:'patient_synthetic',renderingProviderId:'provider_synthetic',employeeName:'Sample patient',dateOfInjury:'2024-01-15',employeeDateOfBirth:empty?null:'1980-01-02',employer:empty?null:'Sample employer',providerName:'Sample physician',providerNpi:'1234567890',providerSpecialty:empty?null:'Physical Medicine & Rehabilitation',claimsAdminName:'Directory administrator',claimNumber:'SAMPLE-001',status:'draft',reviewType:'prospective',requestType:'new',writtenConfirmation:false,expedited:false,signedAt:null,submittedAt:null,receivedAt:null,createdAt:null,updatedAt:null,decisionDueAt:null,readiness:{ready:false,missing:[]},items:[{id:'service_synthetic',serviceDescription:'Physical therapy',diagnosisDescription:'Low back pain',diagnosisCode:'M54.50',procedureCode:'97110',outcome:'pending'}],documents:[],transmissions:[],informationRequests:[],events:[],requestingPractice:empty?{}:{name:'Sample practice',contactName:'Practice coordinator',address:'100 Example Street',city:'Sample City',state:'CA',zip:'90001',phone:'5555550100',fax:'5555550101',email:'practice@example.com'},authorizationContact:empty?{}:{name:'Saved administrator',contactName:'Claims coordinator',address:'200 Example Street',city:'Sample City',state:'CA',zip:'90002',phone:'5555550102',fax:'5555550103',email:'claims@example.com'}};
window.__reads=[];
const fetcher=async(input,init)=>{const path=new URL(String(input)).pathname;if((init?.method||'GET')!=='GET')throw Error('Unexpected mutation');window.__reads.push(path);if(path.endsWith('/creation-context'))throw Error('Unexpected creation permission dependency');if(path.endsWith('/packets'))return Response.json({data:{packets:[],transmissions:[]}});if(path.endsWith('/events')||path.endsWith('/scheduling')||path.endsWith('/rfa-follow-ups')||path.endsWith('/rfa-inbound-faxes'))return Response.json({data:[]});return Response.json({data:row});};
createRoot(document.getElementById('app')).render(React.createElement(RfaDashboard,{appearance:{preset:'mindbill'},getSession:async()=>({token:'synthetic_session'}),fetch:fetcher,permissions:[],layout:'simple',selectedRfaId:row.id,officialForm:true}));
`,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,minify:true,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"production"'},alias:{react:resolve(host.resolve('react/package.json'),'..'),'react-dom':resolve(host.resolve('react-dom/package.json'),'..')}
});
const server = createServer((req, res) => {
  res.setHeader("content-type", req.url === "/app.js" ? "text/javascript" : "text/html");
  res.end(req.url === "/app.js" ? result.outputFiles[0].text : '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic RFA detail verification</title></head><body style="margin:0;padding:20px;background:#f5f4ef;font-family:Arial"><main id="app" style="max-width:1250px;margin:auto"></main><script src="/app.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
const output = process.env.SCREENSHOT_DIR || "/tmp/mindbill-rfa-detail-fields-verification";
await mkdir(output, { recursive: true });
try {
 for(const empty of [false,true])for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:1100}});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  await page.goto(origin+(empty?'/?empty=1':'/'));await page.getByRole('heading',{name:'Employee Information',exact:true}).waitFor();
  const facts=await page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('.mbrfa-sheet')].filter(card=>card.querySelector('header h3')).map(card=>[card.querySelector('header h3').textContent,Object.fromEntries([...card.querySelectorAll('dt')].map(dt=>[dt.textContent,dt.nextElementSibling.textContent]))])));
  assert.equal(facts['Employee Information']['Employer'],empty?'—':'Sample employer');
  assert.equal(facts['Employee Information']['Date of Birth'],empty?'—':'01/02/1980');
  assert.equal(facts['Requesting Physician Information']['Contact Name'],empty?'—':'Practice coordinator');
  assert.equal(facts['Requesting Physician Information']['Specialty'],empty?'—':'Physical Medicine & Rehabilitation');
  assert.equal(facts['Claims Administrator Information']['Company Name'],empty?'—':'Saved administrator');
  assert.equal(facts['Claims Administrator Information']['E-mail Address'],empty?'—':'claims@example.com');
  assert.ok(!Object.hasOwn(facts['Request Information'],'Sent'));assert.ok(!Object.hasOwn(facts['Employee Information'],'Injury'));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  await page.screenshot({path:resolve(output,`${empty?'blank':'filled'}-${width}.png`),fullPage:true});
  await page.getByRole('tab',{name:'History & Activity'}).click();await page.getByRole('tab',{name:'RFA Details'}).click();
  await page.close();
 }
 console.log('PASS: synthetic read-only DWC fields, blank values, history tabs, desktop and mobile');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
