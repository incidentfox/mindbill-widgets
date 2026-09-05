/* global window, document, innerWidth */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";

// Production bundle, synthetic data, local browser only. Supply a checkout with
// react-dom and playwright-core installed; no dependency installs or live email.
const require = createRequire(import.meta.url);
const host = createRequire(resolve(process.env.BROWSER_DEPENDENCY_ROOT, "package.json"));
const { build } = createRequire(require.resolve("tsup/package.json"))("esbuild");
const { chromium } = host("playwright-core");
const reactRoot = resolve(host.resolve("react/package.json"), "..");
const result = await build({ stdin: { contents: `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {NotificationRecipientsSettings,NotificationSettings} from './packages/react/dist/index.js';
let recipients=[]; let attempts=[]; let available=true;
const adapter={load:async()=>({available,environment:'live',recipients,hasMore:false}),
invite:async(input)=>{attempts.push(input);recipients=[{...input,externalUserId:'synthetic-1',enabled:false,state:'pending_confirmation',assignedBillCount:0}];
if(attempts.length===1)throw new Error('synthetic response lost');return {deliveryStatus:'sent'};},
disable:async()=>{recipients=recipients.map(r=>({...r,state:'off',enabled:false}));}};
let preferences={enabled:false,statusUpdates:false,agingDays:[],quietHours:true,reportDigest:'off'};let saves=[];
const snapshot=()=>({preferences,email:'synthetic.doctor@example.test',audience:'assigned_bills',environment:'live',canEnable:true});
const personalAdapter={load:async()=>snapshot(),save:async(input)=>{saves.push(input);preferences=input;return snapshot();},unsubscribe:async()=>{preferences={...preferences,enabled:false};return snapshot();}};
window.fixture={attempts,saves,gateOff:()=>{available=false;}};
const personal=location.pathname==='/personal';
createRoot(document.getElementById('app')).render(React.createElement(personal?NotificationSettings:NotificationRecipientsSettings,{identityKey:'synthetic-practice',adapter:personal?personalAdapter:adapter,appearance:{preset:'mindbill'}}));
`, resolveDir: process.cwd(), loader: "jsx" }, bundle: true, write: false, minify: true, format: "iife", platform: "browser",
  define: { "process.env.NODE_ENV": '"production"' }, alias: { react: reactRoot, "react-dom": resolve(host.resolve("react-dom/package.json"), "..") } });
const server = createServer((req,res)=>{res.setHeader("content-type",req.url==="/app.js"?"text/javascript":"text/html");res.end(req.url==="/app.js"?result.outputFiles[0].text:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Notification settings verification</title></head><body style="margin:0;padding:20px;background:#f5f4ef;font-family:Arial"><main id="app" style="max-width:1050px;margin:auto"></main><script src="/app.js"></script></body></html>');});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||"/usr/bin/google-chrome",headless:true,args:["--no-sandbox"]});
const output=process.env.SCREENSHOT_DIR||"/tmp/mindbill-notification-recipient-verification";
await mkdir(output,{recursive:true});
try {
 const page=await browser.newPage({viewport:{width:1360,height:1050}});
 const errors=[];page.on("pageerror",error=>errors.push(error.message));
 await page.route("**/*",route=>route.request().url().startsWith(origin)?route.continue():route.abort());
 await page.goto(origin);
 await page.getByText("No recipients yet.",{exact:false}).waitFor();
 assert.equal(await page.getByLabel("Bill status and payment updates").isChecked(),false);
 assert.equal(await page.getByLabel("Billing access scope").inputValue(),"assigned_bills");
 assert.equal(await page.getByLabel("Scheduled activity digest").inputValue(),"off");
 await page.getByLabel("Recipient email").fill("synthetic.doctor@example.test");
 await page.getByLabel("Scheduled activity digest").selectOption("weekly");
 await page.getByRole("button",{name:"Send confirmation invitation"}).click();
 await page.getByRole("alert").waitFor();
 await page.getByRole("button",{name:"Send confirmation invitation"}).click();
 await page.getByText("Pending confirmation · off",{exact:true}).waitFor();
 const attempts=await page.evaluate(()=>window.fixture.attempts);
 assert.equal(attempts.length,2);assert.equal(attempts[0].requestId,attempts[1].requestId);
 assert.equal("enabled" in attempts[0],false);assert.equal("consent" in attempts[0],false);
 assert.equal(attempts[0].reportDigest,"weekly");assert.equal(attempts[0].statusUpdates,false);
 await page.getByText("Weekly activity digest",{exact:false}).waitFor();
 await page.screenshot({path:resolve(output,"recipients-desktop.png"),fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:resolve(output,"recipients-mobile.png"),fullPage:true});
 await page.evaluate(()=>window.fixture.gateOff());
 await page.getByRole("button",{name:"Reload recipients"}).click();
 await page.getByText("Email invitations are not available yet.",{exact:false}).waitFor();
 await page.getByRole("button",{name:"Disable",exact:true}).click();
 await page.locator(".mbnr-badge").filter({hasText:/^Off$/}).waitFor();
 await page.goto(`${origin}/personal`);
 assert.equal(await page.getByLabel("Send me billing updates").isChecked(),false);
 assert.equal(await page.getByLabel("Scheduled activity digest").inputValue(),"off");
 await page.getByLabel("Send me billing updates").check();
 await page.getByLabel("Scheduled activity digest").selectOption("daily");
 assert.equal(await page.getByRole("button",{name:"Save preferences",exact:true}).isEnabled(),false);
 await page.getByLabel("I agree to receive the selected billing emails",{exact:false}).check();
 await page.getByRole("button",{name:"Save preferences",exact:true}).click();
 await page.getByText("Notification preferences saved.",{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.fixture.saves[0].reportDigest),"daily");
 await page.getByLabel("Scheduled activity digest").selectOption("weekly");
 assert.equal(await page.getByRole("button",{name:"Save preferences",exact:true}).isEnabled(),false);
 await page.screenshot({path:resolve(output,"personal-mobile.png"),fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.setViewportSize({width:1360,height:1050});
 await page.screenshot({path:resolve(output,"personal-desktop.png"),fullPage:true});
 await page.getByRole("button",{name:"Unsubscribe from all",exact:true}).click();
 await page.getByText("Email notifications are off.",{exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,checks:["default off","digest-only invitation","assigned scope","idempotent retry","pending off","mobile overflow","gate-off disable","personal digest consent","cadence change requires consent","unsubscribe"],screenshots:output}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
