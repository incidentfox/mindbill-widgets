// Test-only preload: prevent server-side calls from leaving local acceptance fixtures.
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input);
  if (url.hostname === "app.mindbill.org") {
    url.protocol = "http:"; url.host = "127.0.0.1:4332";
    return originalFetch(url, init);
  }
  if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Non-local test request blocked");
  return originalFetch(input, init);
};
