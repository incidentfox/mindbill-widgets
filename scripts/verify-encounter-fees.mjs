/* global window */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { resolve } from "node:path";

// Run after pnpm build. Local-only synthetic fixture for the encounter fee columns
// (Charge | Expected (OMFS) | Difference + totals); the quote callback is synthetic.
const require = createRequire(import.meta.url);
const host = createRequire(resolve(process.env.BROWSER_DEPENDENCY_ROOT, "package.json"));
const { build } = createRequire(require.resolve("tsup/package.json"))("esbuild");
const { chromium } = host("playwright-core");
const result = await build({
  stdin: { contents: `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {BillSubmissionForm} from './packages/react/dist/index.js';
const address={line1:'100 Synthetic Way',city:'Oakland',state:'CA',postalCode:'94612'};
const line=(code,charge,units=1,modifiers)=>({code,units,charge,serviceDate:'2026-10-08',diagnosisPointers:[1],...(modifiers?{modifiers}:{})});
const bill={externalId:'synthetic_encounter',billingMode:'professional',patient:{firstName:'Ada',lastName:'Example',dateOfBirth:'1980-01-02',address},claim:{claimNumber:'SYNTHETIC-9',employer:'Synthetic Foods',dateOfInjury:'2026-08-01',claimsAdministrator:{id:'payer_synthetic',name:'Synthetic Claims Administrator'}},service:{date:'2026-10-08'},billingProvider:{name:'Synthetic Spine Group',taxId:'123456789',npi:'1234567890',phone:'5105550100',address},renderingProvider:{name:'Sam Example, D.C.',npi:'1098765432',taxonomy:'111N00000X'},serviceLocation:{name:'Synthetic Office',placeOfServiceCode:'11',address},diagnoses:['M54.50'],
 serviceLines:[line('99213',250,1,['25']),line('98941',120),line('97140',90,1,['59']),line('97110',180,2),line('G0283',45),line('97014',50)]};
const amounts={'99213':18168,'98941':5559,'97140':3871,'97110':8113,'G0283':1730};
const descriptions={'99213':'Office visit, established patient, low complexity','98941':'Chiropractic manipulation, 3-4 regions','97140':'Manual therapy techniques, each 15 minutes','97110':'Therapeutic exercise, each 15 minutes','G0283':'Electrical stimulation, unattended','97014':'Electrical stimulation, unattended (not payable in CA)'};
window.calls=0;
const onQuoteEncounter=async(inputs)=>{ window.calls++; return inputs.map(input=>input.code==='97014'
  ?{status:'not_separately_payable',reason:'code_not_payable_use_g0283',provenance:[],message:"97014 is not payable in California workers' comp. Bill G0283 for unattended electrical stimulation."}
  :{status:'priced',amountCents:amounts[input.code],scheduleMaximumCents:amounts[input.code],basis:'ca_physician_rbrvs',provenance:[],notes:[],...(input.code==='99213'?{findings:[{code:'modifier_conditional_estimate',message:'Modifier 25 requires a significant, separately identifiable visit in the record.'}]}:{})}); };
createRoot(document.getElementById('app')).render(React.createElement(BillSubmissionForm,{initialBill:bill,treatmentBilling:true,editableTreatmentCharges:true,onQuoteEncounter,describeProcedureCode:c=>descriptions[c],appearance:{preset:'mindbill'},deliveryRoutePicker:'off'}));
`, resolveDir: process.cwd(), loader: "jsx" },
  bundle: true, write: false, minify: true, format: "iife", platform: "browser",
  define: { "process.env.NODE_ENV": '"production"' },
  alias: { react: resolve(host.resolve("react/package.json"), ".."), "react-dom": resolve(host.resolve("react-dom/package.json"), "..") },
});
const server = createServer((req, res) => {
  res.setHeader("content-type", req.url === "/app.js" ? "text/javascript" : "text/html");
  res.end(req.url === "/app.js" ? result.outputFiles[0].text : '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Encounter fees</title></head><body style="margin:0;padding:16px;background:#f5f4ef;font-family:Arial"><main id="app" style="max-width:1240px;margin:auto"></main><script src="/app.js"></script></body></html>');
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
const output = process.env.SCREENSHOT_DIR || "/tmp/mindbill-encounter-fees";
await mkdir(output, { recursive: true });
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    await page.goto(origin);
    await page.locator(".mbsf-encounter-total").waitFor();
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => window.calls), 1);
    const totals = await page.locator(".mbsf-encounter-total").textContent();
    assert.match(totals, /\$735\.00/); assert.match(totals, /\$374\.41/); assert.match(totals, /\$360\.59/);
    await page.locator(".mbsf-lines").scrollIntoViewIfNeeded();
    await page.locator(".mbsf-lines").screenshot({ path: `${output}/encounter-lines-${width}.png` });
    assert.deepEqual(errors, []);
    await page.close();
  }
} finally { await browser.close(); server.close(); }
console.log(`Encounter fee screenshots: ${output}`);
