import { createServer } from "node:http";
import { MindBillClient } from "@mindbill/node";

const port = Number(process.env.PORT ?? 4173);
const origin = process.env.APP_ORIGIN;
const billId = process.env.MINDBILL_SYNTHETIC_BILL_ID;
if (!origin) {
  throw new Error("Set APP_ORIGIN to the exact HTTPS origin that serves this example");
}
const mindbill = new MindBillClient({
  apiKey: process.env.MINDBILL_API_KEY,
  organizationId: process.env.MINDBILL_ORG_ID,
});

const page = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>MindBill hosted billing</title>
<script type="module" src="https://unpkg.com/@mindbill/embed@0.4.0/dist/index.js"></script>
<main style="max-width:960px;margin:40px auto;padding:0 20px;font:16px system-ui">
  <h1>Billing</h1>
  <div id="flow">Loading secure billing review…</div>
</main>
<script type="module">
  const session = await fetch('/api/mindbill-session').then(async response => {
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });
  const review = document.createElement('mindbill-bill-review');
  review.setAttribute('session-token', session.token);
  review.setAttribute('embed-url', session.embedUrl);
  review.setAttribute('theme', 'system');
  const open = document.createElement('a');
  open.href = session.mindBillUrl;
  open.target = '_blank';
  open.rel = 'noreferrer';
  open.textContent = 'Open full lifecycle in MindBill';
  open.style.cssText = 'display:inline-block;margin-top:16px;color:#176b65';
  document.querySelector('#flow').replaceChildren(review, open);
</script>`;

createServer(async (request, response) => {
  if (request.url === "/api/mindbill-session") {
    if (!billId) {
      response.writeHead(500).end("Set MINDBILL_SYNTHETIC_BILL_ID first");
      return;
    }
    const session = await mindbill.createEmbedSession({
      component: "bill-review",
      billId,
      allowedOrigin: origin,
      expiresIn: 900,
    });
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({
      token: session.token,
      embedUrl: session.embedUrl,
      mindBillUrl: session.mindBillUrl,
    }));
    return;
  }
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end(page);
}).listen(port, () => console.log(`MindBill quickstart: ${origin}`));
