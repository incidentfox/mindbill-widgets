import { MindBillClient } from "@mindbill/node";
import { sandboxApiKey } from "./security";

// Server-only client. No organization ID: the key uses its workspace default.
export function mindbill() {
  return new MindBillClient({
    apiKey: sandboxApiKey(),
    fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
  });
}
