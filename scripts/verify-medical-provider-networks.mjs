/* global document, innerWidth */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { resolve } from "node:path";

// Uses built public packages and entirely synthetic local data; no API writes.
const require = createRequire(import.meta.url);
const host = createRequire(resolve(process.env.BROWSER_DEPENDENCY_ROOT, "package.json"));
const { build } = createRequire(require.resolve("tsup/package.json"))("esbuild");
const { chromium } = host("playwright-core");
const result = await build({
  stdin: { contents: `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {BillSubmissionForm,BillSubmissionClaimSection} from './packages/react/dist/index.js';
const e=React.createElement;
const networks=[
{id:'0001',name:'Sample Coast Network',applicantName:'Example Employer',status:'Approved'},
{id:'0002',name:'Sample Valley Network',applicantName:'Demo Insurer',status:'Approved'},
{id:'0003',name:'Terminated Example',applicantName:'Closed Employer',status:'Terminated'},
{id:'0004',name:'Withdrawn Example',applicantName:'Closed Insurer',status:'Withdrawn'}];
const loadNetworks=async()=>networks;
const address={line1:'1 Example St',city:'Example',state:'CA',postalCode:'90000'};
const bill={billingMode:'med_legal',patient:{firstName:'Synthetic',lastName:'Example',dateOfBirth:'2000-01-01',address},
claim:{claimNumber:'SYNTHETIC',employer:'Example Employer',dateOfInjury:'2026-08-01',claimsAdministrator:{id:'payer_synthetic',name:'Sample Administrator'},medicalProviderNetworkId:'0001'},
service:{date:'2026-09-01'},billingProvider:{savedProviderId:'provider_synthetic'},
renderingProvider:{name:'Synthetic Clinician',npi:'0000000000',taxonomy:'207Q00000X'},serviceLocation:{address,placeOfServiceCode:'11'},diagnoses:['M54.50'],serviceLines:[{code:'ML201',units:1,charge:100}]};
function Demo(){const[saved,setSaved]=React.useState('Not saved');return e('div',null,
e('h1',null,'Bill entry'),e('p',null,'Synthetic demo · Optional medical provider network'),
e(BillSubmissionForm,{initialBill:bill,appearance:{preset:'mindbill'},profileOptions:{},onLookupPostalCode:async()=>null,onListMedicalProviderNetworks:loadNetworks,deliveryRoutePicker:'off',onSubmit:value=>setSaved(JSON.stringify(value.bill.claim.medicalProviderNetworkId))},
e(BillSubmissionClaimSection),e('button',{type:'submit',style:{marginTop:20,padding:'10px 16px'}},'Review draft')),
e('p',null,'Saved MPN: ',e('output',{'data-testid':'saved'},saved)));}
createRoot(document.getElementById('app')).render(e(Demo));
`, resolveDir: process.cwd(), loader: "jsx" },
  bundle: true, write: false, minify: true, format: "iife", platform: "browser",
  define: { "process.env.NODE_ENV": '"production"' },
  alias: { react: resolve(host.resolve("react/package.json"), ".."), "react-dom": resolve(host.resolve("react-dom/package.json"), "..") },
});
const server = createServer((req, res) => {
  res.setHeader("content-type", req.url === "/app.js" ? "text/javascript" : "text/html");
  res.end(req.url === "/app.js" ? result.outputFiles[0].text : '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic MPN bill entry</title></head><body style="margin:0;padding:20px;background:#f5f4ef;font-family:Arial"><main id="app" style="max-width:900px;margin:auto"></main><script src="/app.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
const output = process.env.SCREENSHOT_DIR || "/tmp/mindbill-mpn-verification";
await mkdir(output, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1360, height: 1050 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.route("**/*", route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  await page.goto(origin);
  const input = page.getByRole("combobox", { name: "Medical provider network (optional)" });
  await page.waitForFunction(() => document.querySelector('.mb-mpn input')?.value === 'Sample Coast Network · 0001');
  await input.focus();
  assert.equal(await page.getByRole("option").count(), 2);
  for (const query of ["Valley", "Demo Insurer", "0002"]) {
    await input.fill(query);
    assert.equal(await page.getByRole("option").count(), 1);
    assert.match(await page.getByRole("option").textContent(), /Sample Valley/);
  }
  await input.press("Enter");
  assert.equal(await input.inputValue(), "Sample Valley Network · 0002");
  await input.click();
  assert.equal(await page.getByRole("option").count(), 2);
  await input.press("Escape");
  await page.getByRole("button", { name: "Review draft", exact: true }).click();
  await page.waitForFunction(() => document.querySelector('output')?.textContent === '"0002"');
  await page.getByRole("button", { name: "Clear medical provider network" }).click();
  await input.press("Escape");
  await page.getByRole("button", { name: "Review draft", exact: true }).click();
  await page.waitForFunction(() => document.querySelector('output')?.textContent === 'null');
  await input.focus(); await input.fill("0003");
  assert.equal(await page.getByRole("option").count(), 0);
  assert.equal(await page.getByText("No active networks found.").count(), 1);
  await input.fill("");
  for (const [name, viewport] of [["desktop", { width: 1360, height: 1050 }], ["mobile", { width: 390, height: 844 }]]) {
    await page.setViewportSize(viewport);
    await input.scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: resolve(output, `mpn-${name}.png`), fullPage: true });
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, checks: ["saved value hydration", "active-only directory", "name applicant ID search", "keyboard selection", "submission saves selected ID", "clear submits null", "optional blank valid", "desktop and mobile overflow", "no browser errors"], screenshots: output }));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
