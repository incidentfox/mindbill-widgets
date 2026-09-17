/* global document, innerWidth, window */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { resolve } from "node:path";

// Run after pnpm build. This local-only fixture verifies input/transport and UI,
// not the server's fee calculation. No network calls leave the local preview.
const require = createRequire(import.meta.url);
const host = createRequire(resolve(process.env.BROWSER_DEPENDENCY_ROOT, "package.json"));
const { build } = createRequire(require.resolve("tsup/package.json"))("esbuild");
const { chromium } = host("playwright-core");
const result = await build({
  stdin: { contents: `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {BillSubmissionForm,BillSubmissionServiceLinesSection} from './packages/react/dist/index.js';
const address={line1:'100 Synthetic Way',city:'Los Angeles',state:'CA',postalCode:'90001'};
const bill={externalId:'synthetic_therapy',billingMode:'professional',patient:{firstName:'Ada',lastName:'Example',dateOfBirth:'1980-01-02',address},claim:{claimNumber:'SYNTHETIC-7',employer:'Synthetic Foods',dateOfInjury:'2026-08-01',claimsAdministrator:{id:'payer_synthetic',name:'Synthetic Claims Administrator'}},service:{date:'2026-09-17'},billingProvider:{name:'Synthetic Medical Group',taxId:'123456789',npi:'1234567890',phone:'2135550100',address},renderingProvider:{name:'Ada Therapist',npi:'1098765432',taxonomy:'225100000X'},serviceLocation:{name:'Synthetic Office',placeOfServiceCode:'11',address},diagnoses:['M79.641'],serviceLines:[{code:'97110',units:4,serviceDate:'2026-09-17',diagnosisPointers:[1],modifiers:['GP']}]};
window.calls=[];
const onQuoteFee=async(input)=>{
 window.calls.push(input);
 return input.hasFeeAgreement || input.therapyContext?.assistantInvolved
 ? {status:'requires_review',reason:'therapy_no_fee_agreement_confirmation_required',provenance:[]}
 : {status:'priced',amountCents:16066,scheduleMaximumCents:16066,basis:'ca_omfs_therapy',provenance:[],notes:[]};
};
const e=React.createElement;
createRoot(document.getElementById('app')).render(e(BillSubmissionForm,{initialBill:bill,treatmentBilling:true,onQuoteFee,appearance:{preset:'mindbill'},deliveryRoutePicker:'off',procedureOptions:[{code:'97110',description:'Therapeutic exercises'}]},e(BillSubmissionServiceLinesSection)));
`, resolveDir: process.cwd(), loader: "jsx" },
  bundle: true, write: false, minify: true, format: "iife", platform: "browser",
  define: { "process.env.NODE_ENV": '"production"' },
  alias: { react: resolve(host.resolve("react/package.json"), ".."), "react-dom": resolve(host.resolve("react-dom/package.json"), "..") },
});
const server = createServer((req, res) => {
  res.setHeader("content-type", req.url === "/app.js" ? "text/javascript" : "text/html");
  res.end(req.url === "/app.js" ? result.outputFiles[0].text : '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Therapy service details</title></head><body style="margin:0;padding:16px;background:#f5f4ef;font-family:Arial"><main id="app" style="max-width:1100px;margin:auto"></main><script src="/app.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
const output = process.env.SCREENSHOT_DIR || "/tmp/mindbill-therapy-verification";
await mkdir(output, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1360, height: 1050 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.route("**/*", route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  await page.goto(origin);
  await page.getByLabel("Therapy pricing basis for line 1", { exact: true }).waitFor();
  await page.waitForTimeout(350);
  assert.equal(await page.evaluate(() => window.calls.length), 0);
  assert.equal(await page.locator(".mbsf-money").first().textContent(), "Needs review");
  assert.match(await page.locator('[role="status"]').first().textContent(), /Enter therapy details/);
  for (const [label, value] of [["Provider type", "physical_therapist"], ["Therapy pricing basis", "omfs"], ["Therapy care delivery", "10"], ["Therapy billing arrangement", "false"], ["Therapy patient setting", "false"], ["Therapy payment adjustments", "00"]]) {
    await page.getByLabel(`${label} for line 1`, { exact: true }).selectOption(value);
  }
  for (const [label, value] of [["Direct one-on-one minutes", "60"], ["Total visit minutes", "60"], ["Therapy visits", "1"]]) {
    await page.getByLabel(`${label} for line 1`, { exact: true }).fill(value);
  }
  await page.waitForFunction(() => document.querySelector(".mbsf-money")?.textContent === "$160.66");
  const request = await page.evaluate(() => window.calls.at(-1));
  assert.equal(request.hasFeeAgreement, false);
  assert.deepEqual(request.therapyContext, { providerKind: "physical_therapist", personallyPerformed: true, assistantInvolved: false, hospitalPatient: false, incidentToPhysicianService: false, globalPeriodApplies: false, hpsaBonusEligible: false, placeOfService: "11", directOneOnOneMinutes: 60, totalVisitMinutes: 60, visitsOnDate: 1, completeSameDayServices: true, otherSameDayServices: false });
  const count = await page.evaluate(() => window.calls.length);
  await page.getByLabel("Therapy care delivery for line 1", { exact: true }).selectOption("");
  await page.waitForTimeout(350);
  assert.equal(await page.evaluate(() => window.calls.length), count);
  assert.equal(await page.locator(".mbsf-money").first().textContent(), "Needs review");
  await page.getByLabel("Therapy care delivery for line 1", { exact: true }).selectOption("10");
  await page.waitForFunction(() => document.querySelector(".mbsf-money")?.textContent === "$160.66");
  for (const [name, width] of [["desktop", 1360], ["mobile", 390], ["small-mobile", 320]]) {
    await page.setViewportSize({ width, height: 1050 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: resolve(output, `therapy-${name}.png`), fullPage: true });
  }
  await page.getByLabel("Therapy pricing basis for line 1", { exact: true }).selectOption("agreement");
  await page.waitForFunction(() => window.calls.at(-1)?.hasFeeAgreement === true);
  assert.equal(await page.locator(".mbsf-money").first().textContent(), "Needs review");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, checks: ["partial draft does not quote", "explicit documented context", "clearing removes stale price", "negotiated agreement remains review", "desktop and mobile overflow", "no browser errors"], screenshots: output }));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
