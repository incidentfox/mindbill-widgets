import { jsonRequest } from "../api-client";

export const appearance = { accentColor: "#27665b", fontFamily: "inherit" };

export function getSession({ signal }: { signal: AbortSignal }) {
  return jsonRequest("/api/mindbill/session", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ surface: "billing" }),
  });
}

export function getSettingsSession({ signal }: { signal: AbortSignal }) {
  return jsonRequest("/api/mindbill/session", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ surface: "settings" }),
  });
}


export function getCaseSession(caseId: string, signal: AbortSignal) {
  return jsonRequest("/api/mindbill/session", {
    method: "POST", signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ surface: "case", caseId }),
  });
}
