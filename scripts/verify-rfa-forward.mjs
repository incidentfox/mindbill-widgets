/* global document, innerWidth, window, getComputedStyle, DataTransfer */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { resolve } from "node:path";

// Visual check for the Forward RFA dialog. Synthetic data; an in-page mock answers uploads and forwards, nothing leaves the page.
// Bundles the React source directly, so no build is needed:
//   BROWSER_DEPENDENCY_ROOT=<dir with react, react-dom, playwright-core> SCREENSHOT_DIR=<dir> node scripts/verify-rfa-forward.mjs
// Shoots every state at 1440x900, 390x844 and 390x430: fax and e-mail, with and without a saved packet, an attachment dragged
// over, uploading and added, nothing chosen (Forward disabled), the destination list open, ready, forwarding and done.
// Asserts no native select, no clipped popover, no horizontal overflow, and a Forward button whose size never changes.
const require = createRequire(import.meta.url);
const host = createRequire(resolve(process.env.BROWSER_DEPENDENCY_ROOT ?? "/home/factory/development/repos/mindbill", "package.json"));
const { build } = createRequire(require.resolve("tsup/package.json"))("esbuild");
const { chromium } = host("playwright-core");
const result = await build({
  stdin: { contents: `
import React from 'react';import {createRoot} from 'react-dom/client';import {RfaDashboard} from './packages/react/src/index.tsx';
const scene=location.hash.slice(1)||'nopacket';
const doc=(id,documentType,filename,sizeBytes=184000)=>({id,documentType,filename,sha256:'0',sizeBytes,contentRevision:1,createdAt:'2026-10-07T13:14:00Z'});
const row={id:'rfa_synthetic',contentRevision:1,claimId:'claim_synthetic',patientId:'patient_synthetic',renderingProviderId:'provider_synthetic',employeeName:'Sample patient',dateOfInjury:'2025-06-01',providerName:'Sample physician, D.C.',claimsAdminName:'Sample administrator',claimNumber:'SAMPLE-001',claimsAdminId:null,status:'under_review',reviewType:'prospective',requestType:'new',expedited:false,signedAt:null,submittedAt:'2026-10-02T00:30:00Z',receivedAt:'2026-10-02T01:00:00Z',createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-07T13:20:00Z',decisionDueAt:'2026-10-09T00:00:00Z',readiness:{ready:true,missing:[]},
 items:[{id:'item_1',serviceDescription:'Chiropractic manipulative treatment, spinal, 3–4 regions',diagnosisCode:'M54.2',procedureCode:'98941',quantity:6,outcome:'pending'}],
 documents:[doc('doc_report','clinical_report','PR-2 progress report - sample with a deliberately long file name to check wrapping.pdf',2400000),doc('doc_form','rfa_form','DWC-RFA-signed.pdf',96000),doc('doc_record','supporting_record','Imaging summary.pdf'),doc('doc_ur','ur_response','UR determination - Sample administrator.pdf')],
 transmissions:[{id:'tx_sub',direction:'outbound',channel:'fax',status:'sent',purpose:'submission',destination:'+15555550163',occurredAt:'2026-10-02T00:40:00Z',receivedAt:null,proofDocumentId:null,providerMessageId:null,metadata:{sentOutsideMindBill:true}}],
 informationRequests:[],events:[],requestingPractice:{},authorizationContact:{name:'Sample administrator',contactName:'Sample UR unit',fax:'+15555550163',email:'ur@example.test'}};
const packets=scene==='packet'?{packets:[{id:'pkt_sent',source:'submission',sha256:'0'.repeat(64),sizeBytes:412000,contentRevision:1,createdAt:'2026-10-02T00:30:00Z'}],transmissions:[{id:'tx_sub',packetId:'pkt_sent',purpose:'submission',channel:'fax',status:'delivered',destination:'+15555550163',occurredAt:'2026-10-02T00:40:00Z',receivedAt:null}]}:{packets:[],transmissions:[]};
const gate=()=>{let open;const wait=new Promise(done=>{open=done;});return {wait,open};};
window.__upload=gate();window.__forward=gate();window.__writes=[];
const fetcher=async(input,init)=>{const url=new URL(String(input));const path=url.pathname;const method=init?.method||'GET';
 if(method!=='GET'){window.__writes.push(method+' '+path);
  if(path.endsWith('/documents')&&method==='POST'){await window.__upload.wait;const file=init.body.get('file');row.documents=[...row.documents,doc('doc_attached','other',file.name,file.size)];return Response.json({data:row},{status:201});}
  if(path.endsWith('/forwards')){await window.__forward.wait;return Response.json({data:{packetId:'pkt_forward',transmissionId:'tx_forward'}});}
  throw Error('Unexpected mutation');}
 if(path.endsWith('/packets'))return Response.json({data:packets});
 if(path.endsWith('/scheduling'))return Response.json({data:[]});
 if(path.endsWith('/rfa-follow-ups'))return Response.json({data:[],nextCursor:null});
 if(path.includes('/documents/')||path.includes('/packets/'))return new Response(new Blob(['%PDF-1.4\\n%%EOF'],{type:'application/pdf'}));
 if(path.endsWith('/events'))return Response.json({data:[]});
 if(path.endsWith('/rfa-inbound-faxes'))return Response.json({data:[]});
 if(path.endsWith('/rfas'))return Response.json({data:[],nextCursor:null});
 return Response.json({data:row});};
const forwardContacts=[{name:'Sample Adjuster',role:'Adjuster',fax:'+15555550170',email:'adjuster@example.test'},{name:'Sample Defense Attorney',role:'Defense attorney',email:'counsel@example.test'}];
createRoot(document.getElementById('app')).render(React.createElement(RfaDashboard,{appearance:{preset:'mindbill'},getSession:async()=>({token:'synthetic_session'}),fetch:fetcher,permissions:['act','edit','send','create'],layout:'simple',environment:'live',selectedRfaId:row.id,forwardContacts}));
`, resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, write: false, minify: true, format: "iife", platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
  alias: {
    react: resolve(host.resolve("react/package.json"), ".."), "react-dom": resolve(host.resolve("react-dom/package.json"), ".."),
    "@mindbill/browser": resolve("packages/browser/src/index.ts"), "@mindbill/embed": resolve("packages/embed/src/index.ts"),
  },
});
const server = createServer((req, res) => {
  res.setHeader("content-type", req.url === "/app.js" ? "text/javascript" : "text/html");
  res.end(req.url === "/app.js" ? result.outputFiles[0].text : '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic forward</title></head><body style="margin:0;padding:20px;background:#f5f4ef;font-family:Arial"><main id="app" style="max-width:1250px;margin:auto"></main><script src="/app.js"></script></body></html>');
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
const output = process.env.SCREENSHOT_DIR || "/tmp/mindbill-rfa-forward-verification";
await mkdir(output, { recursive: true });
const NATIVE = "select, input[type=date], input[type=datetime-local], input[type=time], input[type=month], input[type=week]";
const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const shots = [];
try {
  for (const [width, height] of [[1440, 900], [390, 844], [390, 430]]) {
    const page = await browser.newPage({ viewport: { width, height } }); const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    const dialog = page.getByRole("dialog", { name: "Forward RFA" });
    const submit = dialog.locator(".mbrfa-fwd-submit");
    const sizes = new Set(); // Forward and Forwarding… only; Done replaces both buttons.
    const shot = async (name, { bottom = false } = {}) => {
      await dialog.locator(".mbrfa-send-body").evaluate((body, end) => { body.scrollTop = end ? body.scrollHeight : 0; }, bottom);
      assert.equal(await page.locator(NATIVE).count(), 0, `${name}: native controls on the page`);
      const clipped = await page.evaluate(() => [...document.querySelectorAll(".mbctl-pop")].flatMap(pop => {
        const box = pop.getBoundingClientRect(); if (box.top < 0 || box.left < 0 || box.bottom > window.innerHeight || box.right > innerWidth) return ["off-screen"];
        return [[box.left + 4, box.top + 4], [box.right - 4, box.top + 4], [box.left + 4, box.bottom - 4], [box.right - 4, box.bottom - 4]].filter(([x, y]) => !pop.contains(document.elementFromPoint(x, y))).map(String);
      }));
      assert.deepEqual(clipped, [], `${name}: popover clipped or covered`);
      // Nothing in the dialog may be wider than the dialog, and the page never scrolls sideways.
      const overflow = await dialog.evaluate(section => [section, ...section.querySelectorAll("*")].filter(node => node.getBoundingClientRect().right > section.getBoundingClientRect().right + 0.5 && node.getBoundingClientRect().width > 0 && !node.closest(".mbctl-pop") && !node.hidden && getComputedStyle(node).position !== "absolute").map(node => node.className || node.tagName));
      assert.deepEqual(overflow, [], `${name}: content wider than the dialog`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: horizontal page scroll`);
      const box = /Forward/.test(await submit.textContent() ?? "") ? await submit.boundingBox() : null; if (box) sizes.add(`${Math.round(box.width)}x${Math.round(box.height)}`);
      const path = resolve(output, `${name}-${width}x${height}.png`); await page.screenshot({ path }); shots.push(path);
    };
    const open = async (scene) => {
      await page.goto(`${origin}/#${scene}`); await page.reload();
      await page.getByRole("button", { name: "Forward", exact: true }).first().click(); await dialog.waitFor();
      await dialog.locator(".mbrfa-fwd-doc").first().waitFor();
    };
    const tall = height > 500;

    // Without a saved packet: the request's own documents, signed form chosen. Fax, then e-mail.
    await open("nopacket");
    assert.equal(await dialog.getByText(/send them yourself|cannot be forwarded/i).count(), 0);
    assert.ok(await dialog.locator(".mbrfa-fwd-doc", { hasText: "DWC-RFA-signed.pdf" }).locator("input").isChecked());
    await shot("forward-nopacket-fax"); if (!tall) await shot("forward-nopacket-fax-bottom", { bottom: true });
    await dialog.getByRole("radio", { name: "E-mail" }).check(); await shot("forward-nopacket-email", { bottom: !tall });
    await dialog.getByRole("radio", { name: "Fax" }).check();
    // Nothing chosen: Forward is disabled and says why.
    await dialog.locator(".mbrfa-fwd-doc", { hasText: "DWC-RFA-signed.pdf" }).locator("input").uncheck();
    assert.ok(await submit.isDisabled()); await dialog.getByText("Choose at least one document.").waitFor();
    await shot("forward-validation-disabled");
    await dialog.locator(".mbrfa-fwd-doc", { hasText: "DWC-RFA-signed.pdf" }).locator("input").check();
    // An attachment dragged over the zone, uploading, then added and chosen.
    await dialog.locator(".mbrfa-fwd-drop").scrollIntoViewIfNeeded();
    await dialog.locator(".mbrfa-fwd-drop").dispatchEvent("dragover", { dataTransfer: await page.evaluateHandle(() => new DataTransfer()) });
    await page.screenshot({ path: resolve(output, `forward-attachment-dragover-${width}x${height}.png`) }); shots.push(resolve(output, `forward-attachment-dragover-${width}x${height}.png`));
    await dialog.locator(".mbrfa-fwd-drop").dispatchEvent("dragleave");
    await dialog.locator('input[type="file"]').setInputFiles({ name: "Sample attachment.pdf", mimeType: "application/pdf", buffer: pdf });
    await dialog.getByText("Uploading…").waitFor(); await shot("forward-attachment-uploading");
    await page.evaluate(() => window.__upload.open());
    await dialog.locator(".mbrfa-fwd-doc", { hasText: "Sample attachment.pdf" }).locator("input:checked").waitFor();
    await shot("forward-attachment-added");
    // The destination list open (shared Select, never native).
    const destination = dialog.locator(".mbrfa-send-to").getByRole("combobox").first();
    await destination.scrollIntoViewIfNeeded(); await destination.click(); await page.locator(".mbctl-pop").waitFor();
    await page.screenshot({ path: resolve(output, `forward-destination-open-${width}x${height}.png`) }); shots.push(resolve(output, `forward-destination-open-${width}x${height}.png`));
    await page.keyboard.press("Escape"); await page.locator(".mbctl-pop").waitFor({ state: "detached" });
    // Ready, forwarding, done.
    await dialog.locator(".mbrfa-send-confirm input").check(); assert.ok(await submit.isEnabled()); await shot("forward-ready", { bottom: true });
    await submit.click(); await dialog.getByText("Forwarding…").waitFor(); await shot("forward-forwarding", { bottom: true });
    await page.evaluate(() => window.__forward.open()); await dialog.getByText(/Forwarded to fax/).waitFor(); await shot("forward-done");
    const writes = await page.evaluate(() => window.__writes);
    assert.deepEqual(writes.map(write => write.replace(/^(\w+) .*\/(\w+)$/, "$1 $2")), ["POST documents", "POST forwards"]);

    // With a saved packet: "Packet as sent" offered, not chosen by default. Fax and e-mail.
    await open("packet");
    await dialog.getByText("Packet as sent").waitFor();
    assert.equal(await dialog.locator(".mbrfa-fwd-doc", { hasText: "Packet as sent" }).locator("input").isChecked(), false);
    await shot("forward-packet-fax");
    await dialog.locator(".mbrfa-fwd-doc", { hasText: "Packet as sent" }).locator("input").check();
    await dialog.getByRole("radio", { name: "E-mail" }).check(); await shot("forward-packet-email", { bottom: !tall });
    assert.equal(sizes.size, 1, `Forward button changed size: ${[...sizes].join(", ")}`);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log(`PASS: ${shots.length} screenshots, no native controls, no clipped popovers, no overflow, fixed Forward button → ${output}`);
} finally { await browser.close(); await new Promise(done => server.close(done)); }
