import { MINDBILL_BROWSER_SDK_VERSION } from "./version";

/**
 * Privacy-safe SDK product analytics. Events carry only closed enums, counts, durations and
 * form field paths — never field values, names, free text or any patient information.
 */
export const MINDBILL_ANALYTICS_EVENT_NAMES = [
  "component_mounted", "form_viewed", "autofill_started", "autofill_completed", "autofill_failed",
  "validation_failed", "packet_preview_opened", "packet_preview_failed", "cms1500_preview_opened",
  "delivery_route_dialog_opened", "route_selected", "submit_clicked", "submit_succeeded", "submit_failed",
  "correction_opened", "resubmit_succeeded", "resubmit_failed",
] as const;
export type MindBillAnalyticsEventName = (typeof MINDBILL_ANALYTICS_EVENT_NAMES)[number];
export const MINDBILL_SDK_PACKAGES = ["@mindbill/react", "@mindbill/angular", "@mindbill/browser", "@mindbill/embed"] as const;
export type MindBillSdkPackage = (typeof MINDBILL_SDK_PACKAGES)[number];
export type MindBillAnalyticsRoute = "ebill" | "fax" | "email" | "mail";
export type MindBillAnalyticsBillingMode = "med_legal" | "professional";

export type MindBillAnalyticsEvent = {
  name: MindBillAnalyticsEventName;
  /** ISO-8601 time the event happened in the browser. */
  occurredAt: string;
  /** Component name, e.g. "BillSubmissionForm". */
  component: string;
  sdkPackage: MindBillSdkPackage;
  sdkVersion: string;
  /** Anonymous random id for this browser tab. Not tied to a person. */
  tabSessionId: string;
  /** Environment of the browser session, when known. MindBill derives it server-side. */
  environment?: "sandbox" | "live";
  durationMs?: number;
  route?: MindBillAnalyticsRoute;
  /** Closed machine error code (lowercase snake case), never a message. */
  errorCode?: string;
  /** Form field paths only (e.g. "claim.dateOfInjury"), never values. */
  fieldPaths?: string[];
  billingMode?: MindBillAnalyticsBillingMode;
};

export type MindBillAnalyticsInput = Omit<MindBillAnalyticsEvent, "occurredAt" | "tabSessionId" | "environment">;
export type MindBillAnalyticsOptions = {
  /** false keeps the event local: `onEvent` still receives it, nothing is sent to MindBill. */
  send?: boolean;
  onEvent?: (event: MindBillAnalyticsEvent) => void;
};

const NAMES = new Set<string>(MINDBILL_ANALYTICS_EVENT_NAMES);
const PACKAGES = new Set<string>(MINDBILL_SDK_PACKAGES);
const ROUTES = new Set(["ebill", "fax", "email", "mail"]);
const MODES = new Set(["med_legal", "professional"]);
const COMPONENT = /^[A-Za-z][A-Za-z0-9]{0,63}$/;
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]{1,32})?$/;
const TAB_SESSION = /^[A-Za-z0-9_-]{8,64}$/;
const FIELD_PATH = /^[A-Za-z0-9_.[\]]{1,96}$/;
const ERROR_CODE = /^[a-z0-9_]{1,64}$/;
const TAB_SESSION_KEY = "mindbill.analytics.tab";
const QUEUE_CAP = 200;
const FLUSH_AT = 20;
const BATCH_MAX = 50;
const FLUSH_DELAY_MS = 2_000;
const SESSION_IDLE_MS = 10 * 60_000;

function randomId(): string {
  try {
    if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID().replace(/-/g, "");
  } catch { /* fall through */ }
  return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

let memoryTabSession: string | null = null;
/** Anonymous per-tab id, kept in sessionStorage when available. */
export function mindBillAnalyticsTabSessionId(): string {
  if (memoryTabSession) return memoryTabSession;
  let id: string | null = null;
  try {
    const stored = globalThis.sessionStorage?.getItem(TAB_SESSION_KEY) ?? null;
    if (stored && TAB_SESSION.test(stored)) id = stored;
  } catch { /* storage unavailable */ }
  if (!id) {
    id = randomId().slice(0, 64);
    try { globalThis.sessionStorage?.setItem(TAB_SESSION_KEY, id); } catch { /* storage unavailable */ }
  }
  memoryTabSession = id;
  return id;
}

/** Normalize a code to the closed wire format, or drop it. */
export function normalizeMindBillAnalyticsErrorCode(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const code = value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 64);
  return ERROR_CODE.test(code) ? code : undefined;
}

/** Apply the server's wire rules: invalid required fields reject the event, invalid optional fields are dropped. */
export function sanitizeMindBillAnalyticsEvent(value: unknown): MindBillAnalyticsEvent | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (typeof input.name !== "string" || !NAMES.has(input.name)) return null;
  if (typeof input.component !== "string" || !COMPONENT.test(input.component)) return null;
  if (typeof input.sdkPackage !== "string" || !PACKAGES.has(input.sdkPackage)) return null;
  if (typeof input.sdkVersion !== "string" || !VERSION.test(input.sdkVersion)) return null;
  if (typeof input.tabSessionId !== "string" || !TAB_SESSION.test(input.tabSessionId)) return null;
  const occurredAt = typeof input.occurredAt === "string" && !Number.isNaN(Date.parse(input.occurredAt))
    ? new Date(input.occurredAt).toISOString() : null;
  if (!occurredAt) return null;
  const event: MindBillAnalyticsEvent = {
    name: input.name as MindBillAnalyticsEventName,
    occurredAt,
    component: input.component,
    sdkPackage: input.sdkPackage as MindBillSdkPackage,
    sdkVersion: input.sdkVersion,
    tabSessionId: input.tabSessionId,
  };
  if (input.environment === "sandbox" || input.environment === "live") event.environment = input.environment;
  if (typeof input.durationMs === "number" && Number.isFinite(input.durationMs)) {
    const duration = Math.round(input.durationMs);
    if (duration >= 0 && duration <= 3_600_000) event.durationMs = duration;
  }
  if (typeof input.route === "string" && ROUTES.has(input.route)) event.route = input.route as MindBillAnalyticsRoute;
  const errorCode = normalizeMindBillAnalyticsErrorCode(input.errorCode);
  if (errorCode) event.errorCode = errorCode;
  if (Array.isArray(input.fieldPaths)) {
    const paths = [...new Set(input.fieldPaths.filter((path): path is string => typeof path === "string" && FIELD_PATH.test(path)))].slice(0, 40);
    if (paths.length) event.fieldPaths = paths;
  }
  if (typeof input.billingMode === "string" && MODES.has(input.billingMode)) event.billingMode = input.billingMode as MindBillAnalyticsBillingMode;
  return event;
}

// ── SDK identity (X-MindBill-SDK) ────────────────────────────────────────────
const registeredSdks = new Map<string, string>();
/** Record a framework package so its version rides on every MindBill API request. */
export function registerMindBillSdk(pkg: MindBillSdkPackage, version: string): void {
  if (!PACKAGES.has(pkg) || !VERSION.test(version) || pkg === "@mindbill/browser") return;
  registeredSdks.set(pkg, version);
}
/** Product tokens for the X-MindBill-SDK header, browser package first. */
export function mindBillSdkHeaderValue(): string {
  return [`@mindbill/browser/${MINDBILL_BROWSER_SDK_VERSION}`, ...[...registeredSdks].map(([pkg, version]) => `${pkg}/${version}`)].join(" ");
}

// ── Browser sessions observed by the SDK clients ────────────────────────────
type NotedSession = { token: string; apiBaseUrl: string; expiresAt?: string; environment?: "sandbox" | "live"; fetcher: typeof globalThis.fetch; notedAt: number };
let notedSession: NotedSession | null = null;
const sessionDetails = new Map<string, { expiresAt?: string; environment?: "sandbox" | "live" }>();

/** @internal Remember expiry/environment of a minted session so later uses of its token know them. */
export function rememberMindBillSessionDetails(session: { token?: unknown; expiresAt?: unknown; environment?: unknown }): void {
  try {
    if (typeof session.token !== "string" || session.token.length < 8) return;
    const environment = session.environment === "sandbox" || session.environment === "live" ? session.environment : undefined;
    const details: { expiresAt?: string; environment?: "sandbox" | "live" } = {
      ...(typeof session.expiresAt === "string" ? { expiresAt: session.expiresAt } : {}),
      ...(environment ? { environment } : {}),
    };
    if (!details.expiresAt && !details.environment) return;
    sessionDetails.set(session.token, details);
    if (sessionDetails.size > 20) sessionDetails.delete(sessionDetails.keys().next().value as string);
    if (notedSession?.token === session.token) notedSession = { ...notedSession, ...details };
  } catch { /* ignore */ }
}

/** @internal Remember the latest browser session a client used, so analytics never mints its own. */
export function noteMindBillAnalyticsSession(
  session: { token: string; expiresAt?: string | undefined; apiBaseUrl?: string | undefined; environment?: unknown },
  fetcher: typeof globalThis.fetch,
): void {
  try {
    if (typeof session.token !== "string" || session.token.length < 8 || typeof fetcher !== "function") return;
    rememberMindBillSessionDetails(session);
    const known = sessionDetails.get(session.token);
    const expiresAt = session.expiresAt ?? known?.expiresAt;
    const environment = session.environment === "sandbox" || session.environment === "live" ? session.environment : known?.environment;
    notedSession = {
      token: session.token,
      apiBaseUrl: (session.apiBaseUrl ?? notedSession?.apiBaseUrl ?? "https://app.mindbill.org").replace(/\/$/, ""),
      ...(expiresAt ? { expiresAt } : {}),
      ...(environment ? { environment } : {}),
      fetcher,
      notedAt: Date.now(),
    };
    if (queue.length) scheduleFlush(FLUSH_DELAY_MS);
  } catch { /* never surface analytics problems */ }
}

function freshSession(): NotedSession | null {
  const current = notedSession;
  if (!current) return null;
  if (current.expiresAt) {
    const expires = Date.parse(current.expiresAt);
    if (Number.isFinite(expires) && expires <= Date.now() + 5_000) return null;
  } else if (Date.now() - current.notedAt > SESSION_IDLE_MS) return null;
  return current;
}

function forgetSession(token: string): void {
  if (notedSession?.token === token) notedSession = null;
}

function isMindBillUrl(url: string): boolean {
  try {
    const origin = typeof globalThis.location?.origin === "string" && globalThis.location.origin !== "null" ? globalThis.location.origin : undefined;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) return url.startsWith("/") || Boolean(origin);
    const parsed = new URL(url);
    if (origin && parsed.origin === origin) return true;
    return parsed.protocol === "https:" && (parsed.hostname === "mindbill.org" || parsed.hostname.endsWith(".mindbill.org"));
  } catch {
    return false;
  }
}

/**
 * Wrap a fetch implementation used by the SDK clients. Requests authenticated with a browser session and
 * addressed to MindBill (a mindbill.org host or the page's own origin) carry the X-MindBill-SDK header;
 * host session-endpoint calls and other origins are passed through untouched.
 */
export function withMindBillSdkFetch(fetcher: typeof globalThis.fetch): typeof globalThis.fetch {
  if (typeof fetcher !== "function") return fetcher;
  const wrapped = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : typeof Request !== "undefined" && input instanceof Request ? input.url : String(input);
    const source = init?.headers ?? (typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
    const headers = new Headers(source);
    const token = /^Bearer\s+(\S+)$/i.exec(headers.get("authorization") ?? "")?.[1];
    if (!token || !isMindBillUrl(url)) return fetcher(input, init);
    const target = requestOrigin(url);
    const support = sdkHeaderSupport.get(target);
    const method = (init?.method ?? (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET")).toUpperCase();
    // An older MindBill server rejects the unknown header in its CORS preflight. Probe with a safe GET first and
    // send the header on other requests only once that origin accepted it; never risk a write on the probe.
    const probe = support === undefined && (method === "GET" || method === "HEAD");
    if (support === "blocked" || (support === undefined && !probe)) {
      noteSession(token, url, fetcher);
      const response = await fetcher(input, init);
      if (response.status === 401) forgetSession(token);
      return response;
    }
    // Keep the caller's header shape (plain object, array or Headers) so custom host fetchers see what they expect.
    const sdk = mindBillSdkHeaderValue();
    const original = init?.headers;
    const nextHeaders: HeadersInit = original === undefined && typeof Request !== "undefined" && input instanceof Request
      ? (() => { const copy = new Headers(input.headers); copy.set("x-mindbill-sdk", sdk); return copy; })()
      : original instanceof Headers ? (() => { const copy = new Headers(original); copy.set("x-mindbill-sdk", sdk); return copy; })()
        : Array.isArray(original) ? [...original.filter(([name]) => name.toLowerCase() !== "x-mindbill-sdk"), ["x-mindbill-sdk", sdk]]
          : { ...(original as Record<string, string> | undefined), "x-mindbill-sdk": sdk };
    noteSession(token, url, fetcher);
    let response: Response;
    try {
      response = await fetcher(input, { ...init, headers: nextHeaders });
    } catch (error) {
      // A failed probe (CORS preflight or network error) is retried once without the header; a GET is safe to repeat.
      if (!probe) throw error;
      sdkHeaderSupport.set(target, "blocked");
      response = await fetcher(input, init);
      if (response.status === 401) forgetSession(token);
      return response;
    }
    if (probe) sdkHeaderSupport.set(target, "ok");
    if (response.status === 401) forgetSession(token);
    return response;
  }) as typeof globalThis.fetch;
  return wrapped;
}

/** Per API origin: whether the server's CORS policy accepted the X-MindBill-SDK header. */
const sdkHeaderSupport = new Map<string, "ok" | "blocked">();

function requestOrigin(url: string): string {
  try {
    return /^[a-z][a-z0-9+.-]*:/i.test(url) ? new URL(url).origin : (globalThis.location?.origin ?? "relative");
  } catch {
    return "relative";
  }
}

/** True once the origin accepted the X-MindBill-SDK header on an earlier request. */
export function mindBillSdkHeaderAccepted(apiBaseUrl: string): boolean {
  return sdkHeaderSupport.get(requestOrigin(apiBaseUrl)) === "ok";
}

function noteSession(token: string, url: string, fetcher: typeof globalThis.fetch): void {
  try {
    const base = /^[a-z][a-z0-9+.-]*:/i.test(url) ? new URL(url).origin : (globalThis.location?.origin ?? undefined);
    noteMindBillAnalyticsSession({ token, ...(base ? { apiBaseUrl: base } : {}) }, fetcher);
  } catch { /* ignore */ }
}

// ── Queue and delivery ───────────────────────────────────────────────────────
let queue: MindBillAnalyticsEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let disabled = false;
let flushing = false;
let listenersInstalled = false;

function scheduleFlush(delay: number): void {
  if (disabled || timer || typeof setTimeout !== "function") return;
  timer = setTimeout(() => { timer = null; void flushMindBillAnalytics(); }, delay);
}

function installListeners(): void {
  if (listenersInstalled || typeof globalThis.addEventListener !== "function") return;
  listenersInstalled = true;
  try {
    globalThis.addEventListener("pagehide", () => { void flushMindBillAnalytics(); });
    globalThis.document?.addEventListener?.("visibilitychange", () => {
      if (globalThis.document?.visibilityState === "hidden") void flushMindBillAnalytics();
    });
  } catch { /* ignore */ }
}

/** Send queued events now with the latest browser session. Never throws. */
export async function flushMindBillAnalytics(): Promise<void> {
  if (timer) { clearTimeout(timer); timer = null; }
  if (disabled || flushing || !queue.length) return;
  const session = freshSession();
  if (!session) return;
  flushing = true;
  try {
    while (queue.length && !disabled) {
      const batch = queue.splice(0, BATCH_MAX);
      const body = JSON.stringify({ events: batch.map((event) => { const wire = { ...event }; delete wire.environment; return wire; }) });
      // Call fetch as a plain function: invoking the platform fetch as a method of another object throws
      // "Illegal invocation" in browsers.
      const fetcher = session.fetcher;
      const send = () => fetcher(`${session.apiBaseUrl}/partner/v2/browser/analytics`, {
        method: "POST",
        keepalive: true,
        credentials: "omit",
        headers: {
          authorization: `Bearer ${session.token}`,
          "content-type": "application/json",
          ...(mindBillSdkHeaderAccepted(session.apiBaseUrl) ? { "x-mindbill-sdk": mindBillSdkHeaderValue() } : {}),
        },
        body,
      });
      let response: Response | null = null;
      try { response = await send(); } catch {
        try { response = await send(); } catch { response = null; }
      }
      if (response && (response.status === 404 || response.status === 405)) { disabled = true; queue = []; }
      if (response?.status === 401) { forgetSession(session.token); break; }
    }
  } catch { /* drop silently */ } finally {
    flushing = false;
  }
}

/** Record one SDK analytics event. Returns the sanitized event, or null if it was invalid. Never throws. */
export function trackMindBillAnalyticsEvent(input: MindBillAnalyticsInput, options: MindBillAnalyticsOptions = {}): MindBillAnalyticsEvent | null {
  try {
    const event = sanitizeMindBillAnalyticsEvent({
      ...input,
      occurredAt: new Date().toISOString(),
      tabSessionId: mindBillAnalyticsTabSessionId(),
      ...(notedSession?.environment ? { environment: notedSession.environment } : {}),
    });
    if (!event) return null;
    if (options.onEvent) {
      try { options.onEvent({ ...event, ...(event.fieldPaths ? { fieldPaths: [...event.fieldPaths] } : {}) }); } catch { /* host callback errors stay local */ }
    }
    if (options.send !== false && !disabled) {
      queue.push(event);
      if (queue.length > QUEUE_CAP) queue.splice(0, queue.length - QUEUE_CAP);
      installListeners();
      if (queue.length >= FLUSH_AT && freshSession()) void flushMindBillAnalytics();
      else scheduleFlush(FLUSH_DELAY_MS);
    }
    return event;
  } catch {
    return null;
  }
}

/** @internal Test helper: clear queued events, noted sessions and the disabled flag. */
export function resetMindBillAnalyticsForTests(): void {
  if (timer) clearTimeout(timer);
  timer = null; queue = []; disabled = false; flushing = false; notedSession = null; sessionDetails.clear(); memoryTabSession = null;
  registeredSdks.clear(); sdkHeaderSupport.clear();
}
/** @internal Test helper. */
export function pendingMindBillAnalyticsEvents(): readonly MindBillAnalyticsEvent[] { return queue; }
