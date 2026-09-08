import { MindBillClient } from "@mindbill/node";
import { required } from "./security";

// Only imported by server routes. The developer key never reaches browser code.
export function mindbill() {
  return new MindBillClient({ apiKey: required("MINDBILL_API_KEY"), organizationId: required("MINDBILL_ORG_ID") });
}
