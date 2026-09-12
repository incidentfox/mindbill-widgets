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
import {ConnectedBillStatus,BillLifecycleProgress,BillStatusAgingMatrix,BillList} from './packages/react/dist/index.js';
const appearance={preset:'mindbill'};
const bills=['accepted','accepted_no_response','processed'].map((state,index)=>({
  id:'synthetic_'+state,patientName:'Sample patient '+(index+1),billNumber:'DEMO-'+(index+1),
  payerName:'Sample payer',state,agingDays:70,totalCharge:100,totalPaid:0,balanceDue:100
}));
const fetcher=async()=>Response.json({data:{billId:'synthetic_overdue',state:'accepted',
  nativeStatus:'accepted_no_response',submittedAt:'2026-07-04T00:00:00Z',agingDays:70,totalCharge:100,totalPaid:0,balanceDue:100}});
const e=React.createElement;
createRoot(document.getElementById('app')).render(e('div',{style:{display:'grid',gridTemplateColumns:'minmax(0,1fr)',gap:24}},
  e('header',null,e('h1',null,'Payer response status'),e('p',null,'Synthetic verification · all sample bills are 70 days old')),
  e(ConnectedBillStatus,{billId:'synthetic_overdue',getSession:async()=>({token:'synthetic_session'}),fetch:fetcher,refreshInterval:0,appearance}),
  e(BillLifecycleProgress,{state:'accepted',nativeStatus:'accepted_no_response',submittedAt:'2026-07-04T00:00:00Z',agingDays:70,appearance}),
  e(BillStatusAgingMatrix,{bills,appearance}),
  e(BillList,{bills,appearance})
));
`, resolveDir: process.cwd(), loader: "jsx" },
  bundle: true, write: false, minify: true, format: "iife", platform: "browser",
  define: { "process.env.NODE_ENV": '"production"' },
  alias: { react: resolve(host.resolve("react/package.json"), ".."), "react-dom": resolve(host.resolve("react-dom/package.json"), "..") },
});
const server = createServer((req, res) => {
  res.setHeader("content-type", req.url === "/app.js" ? "text/javascript" : "text/html");
  res.end(req.url === "/app.js" ? result.outputFiles[0].text : '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sample payer response status</title></head><body style="margin:0;padding:20px;background:#f5f4ef;font-family:Arial"><main id="app" style="max-width:1050px;margin:auto"></main><script src="/app.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
const output = process.env.SCREENSHOT_DIR || "/tmp/mindbill-no-response-verification";
await mkdir(output, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1360, height: 1050 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.route("**/*", route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  await page.goto(origin);
  await page.locator(".mb-native-status h3").filter({ hasText: "Accepted – No Response" }).waitFor();
  assert.equal(await page.locator(".mb-progress header strong").textContent(), "Accepted – No Response");
  assert.equal(await page.locator('[aria-current="step"] b').textContent(), "Accepted");
  assert.deepEqual(await page.locator(".mb-progress-list .is-upcoming b").allTextContents(), ["Processed", "Closed"]);
  assert.deepEqual(await page.locator(".mbmx-state").allTextContents(), ["Accepted", "Accepted – No Response", "Processed"]);
  for (const [name, viewport] of [["desktop", { width: 1360, height: 1050 }], ["mobile", { width: 390, height: 844 }]]) {
    await page.setViewportSize(viewport);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.ok(await page.locator(".mbdash-state").filter({ hasText: "Accepted – No Response" }).count() > 0);
    await page.screenshot({ path: resolve(output, `no-response-${name}.png`), fullPage: true });
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, checks: ["connected native status", "accepted progress stage", "processed remains upcoming", "separate ordered matrix row", "list status label", "desktop and mobile overflow", "no browser errors"], screenshots: output }));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
