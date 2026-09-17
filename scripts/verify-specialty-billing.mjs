/* global document, innerWidth */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { resolve } from "node:path";

// Run after pnpm build. Read existing React/Playwright dependencies from a host
// checkout; all status responses and bills below are synthetic and local only.
const require = createRequire(import.meta.url);
const host = createRequire(resolve(process.env.BROWSER_DEPENDENCY_ROOT, "package.json"));
const { build } = createRequire(require.resolve("tsup/package.json"))("esbuild");
const { chromium } = host("playwright-core");
const result = await build({
  stdin: { contents: `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {BillReadOnlyForm} from './packages/react/dist/index.js';
const e=React.createElement;
const examples=[
 ['ub04','Institutional',{code:'',modifiers:[],units:1,charge:150,formData:{institutional:{revenueCode:'0450'}}}],
 ['ada','Dental',{code:'D2392',modifiers:[],units:1,charge:100,formData:{dental:{toothNumber:'2',toothSurfaces:['M','O']}}}],
 ['ncpdp','Pharmacy compound',{code:'',modifiers:[],units:2.5,charge:25,drug:{ndcNumber:'00000000001',metricQuantity:'2.5',unitOfMeasure:'GR'},formData:{pharmacy:{prescriptionNumber:'123456'}}}]
];
createRoot(document.getElementById('app')).render(e('div',null,
 e('h1',null,'Specialty bill review'), e('p',null,'Synthetic examples — no claims are submitted'),
 ...examples.map(([claimForm,label,line])=>e('section',{key:claimForm,'data-form':claimForm,style:{marginBottom:24}},
 e('h2',null,label),e(BillReadOnlyForm,{appearance:{preset:'mindbill'},data:{
 bill:{id:'bill_synthetic_'+claimForm,billNumber:'SYNTHETIC',status:'draft',billingMode:'professional',claimForm,dos:'2026-09-01',lineItems:[line],attachments:[],totalCharge:line.charge,totalPaid:0,balanceDue:line.charge},
 patient:{name:'Synthetic Example'},injury:{claimNumber:'SYNTHETIC',employer:'Sample employer'}
 }})))
));
`, resolveDir: process.cwd(), loader: "jsx" },
  bundle: true, write: false, minify: true, format: "iife", platform: "browser",
  define: { "process.env.NODE_ENV": '"production"' },
  alias: { react: resolve(host.resolve("react/package.json"), ".."), "react-dom": resolve(host.resolve("react-dom/package.json"), "..") },
});
const server = createServer((req, res) => {
  res.setHeader("content-type", req.url === "/app.js" ? "text/javascript" : "text/html");
  res.end(req.url === "/app.js" ? result.outputFiles[0].text : '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic specialty bill review</title></head><body style="margin:0;padding:20px;background:#f5f4ef;font-family:Arial"><main id="app" style="max-width:1050px;margin:auto"></main><script src="/app.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
const output = process.env.SCREENSHOT_DIR || "/tmp/mindbill-specialty-verification";
await mkdir(output, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1360, height: 1050 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.route("**/*", route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  await page.goto(origin);
  await page.locator('[data-form="ub04"] .mb-claim-line-summary').waitFor();
  assert.match(await page.locator('[data-form="ub04"]').textContent(), /UB-04/);
  assert.match(await page.locator('[data-form="ub04"]').textContent(), /Revenue 0450/);
  assert.match(await page.locator('[data-form="ada"]').textContent(), /Tooth 2.*M, O/);
  assert.match(await page.locator('[data-form="ncpdp"]').textContent(), /NDC 00000000001.*2.5 GR.*Rx 123456/);
  for (const [name, viewport] of [["desktop", { width: 1360, height: 1050 }], ["mobile", { width: 390, height: 844 }]]) {
    await page.setViewportSize(viewport);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: resolve(output, `specialty-${name}.png`), fullPage: true });
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, checks: ["institutional revenue line", "dental tooth and surfaces", "pharmacy prescription and quantity", "desktop and mobile overflow", "no browser errors"], screenshots: output }));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
