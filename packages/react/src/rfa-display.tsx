import type { MouseEvent, ReactNode } from "react";
import type { RfaRecord } from "@mindbill/browser";
export type RfaSelectionContext = { treatmentId?: string; responseDocumentId?: string };
export type RfaRelatedLinks = {
  getPatientHref?: (rfa: RfaRecord) => string | undefined;
  getClaimHref?: (rfa: RfaRecord) => string | undefined;
  getProviderHref?: (rfa: RfaRecord) => string | undefined;
};
/** Names describe the request; opaque identifiers remain routing keys only. */
export const rfaTitle = (rfa: RfaRecord): string => rfa.items.map(item => item.serviceDescription.trim()).filter(Boolean).join("; ") || "Request for authorization";
export function RfaLink({ href, children, onSelect }: { href?: string | undefined; children: ReactNode; onSelect?: (() => void) | undefined }) {
  if (!href) return onSelect ? <button type="button" className="mbrfa-text-link" onClick={onSelect}>{children}</button> : <>{children}</>;
  const click = (event: MouseEvent<HTMLAnchorElement>) => { if (onSelect && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onSelect(); } };
  return <a className="mbrfa-text-link" href={href} onClick={click}>{children}</a>;
}
