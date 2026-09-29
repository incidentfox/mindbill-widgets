/* global document, window */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { resolve } from "node:path";

// Run after pnpm build. The bill, payer, documents, and payments below are
// synthetic. Browser dependencies are loaded from an existing host checkout.
const require = createRequire(import.meta.url);
const host = createRequire(resolve(process.env.BROWSER_DEPENDENCY_ROOT, "package.json"));
const { build } = createRequire(require.resolve("tsup/package.json"))("esbuild");
const { chromium } = host("playwright-core");
const result = await build({
  stdin: { contents: `
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BillExplanationOfReview} from './packages/react/dist/index.js';
const payment=(id,reference,date)=>({id,method:'check',checkNumber:reference,status:'deposited',depositDate:date,
  checkReceived:true,receivedDate:date,amount:644,principalAmount:644,feeAmount:null,feeReason:null,
  source:'paper',postedAt:date+'T07:30:00Z',updatedAt:null,note:null});
function Preview(){
  const [action,setAction]=useState('');
  return React.createElement('main',null,
    React.createElement('h1',null,'EOR payment reconciliation'),
    React.createElement(BillExplanationOfReview,{
      appearance:{preset:'mindbill'},
      remittance:{billedAmount:2576,expectedAmount:2576,payerAllowedAmount:null,payerReportedPaid:1288,
        postedPrincipal:1288,postedAdditional:0,totalPostedCash:1288,balanceDue:1288,denialReason:null},
      context:[{label:'Payer',value:'Sample Claims Administrator'},{label:'Payee',value:'Sample Medical Evaluators, Inc.'}],
      submissions:[{id:'original',label:'Original bill',submittedAt:'2026-07-20T04:30:00Z',payerReportedPaid:1288,
        eors:[{id:'eor-1',filename:'Sample_EOR.pdf',description:null,addedAt:'2026-08-27T07:30:00Z',contentUrl:'/sample-eor'}],payments:[]}],
      eors:[],payments:[payment('payment-a','DEMO-A','2026-08-27'),payment('payment-b','DEMO-B','2026-09-10')],
      onPostPayment:()=>setAction('Payment flow opened'),
      onOpenEor:()=>setAction('EOR opened')
    }),
    React.createElement('output',{'data-testid':'action'},action)
  );
}
createRoot(document.getElementById('app')).render(React.createElement(Preview));
`, resolveDir: process.cwd(), loader: "jsx" },
  bundle: true, write: false, minify: true, format: "iife", platform: "browser",
  define: { "process.env.NODE_ENV": '"production"' },
  alias: { react: resolve(host.resolve("react/package.json"), ".."), "react-dom": resolve(host.resolve("react-dom/package.json"), "..") },
});
const server = createServer((req, res) => {
  res.setHeader("content-type", req.url === "/app.js" ? "text/javascript" : "text/html");
  res.end(req.url === "/app.js" ? result.outputFiles[0].text : '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>EOR payment reconciliation</title></head><body style="margin:0;padding:24px;background:#f5f4ef;font-family:Arial"><div id="app" style="max-width:1500px;margin:auto"></div><script src="/app.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
const output = process.env.SCREENSHOT_DIR || "/tmp/mindbill-eor-payment-ledger-verification";
await mkdir(output, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1050 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.route("**/*", route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  await page.goto(origin);
  await page.getByRole("heading", { name: "EOR payment reconciliation" }).waitFor();
  assert.equal(await page.getByText("Payer allowed").locator("..", { hasText: "Not reported" }).count(), 1);
  assert.equal(await page.getByRole("row").filter({ hasText: "DEMO-A" }).count(), 1);
  assert.equal(await page.getByRole("row").filter({ hasText: "DEMO-B" }).count(), 1);
  assert.equal(await page.locator(".mb-eor-payment-table tbody tr").count(), 2);
  const postPayment = page.getByRole("button", { name: "Post payment" });
  assert.equal(await postPayment.evaluate((button) => window.getComputedStyle(button).color), "rgb(255, 255, 255)");
  for (const [name, viewport] of [["desktop", { width: 1500, height: 1050 }], ["mobile", { width: 390, height: 844 }]]) {
    await page.setViewportSize(viewport);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    await page.screenshot({ path: resolve(output, `eor-payment-ledger-${name}.png`), fullPage: true });
  }
  await postPayment.click();
  assert.equal(await page.getByTestId("action").textContent(), "Payment flow opened");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, checks: ["two distinct payment ledger rows", "payer allowed not inferred", "post payment action", "desktop and mobile overflow", "no browser errors"], screenshots: output }));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
