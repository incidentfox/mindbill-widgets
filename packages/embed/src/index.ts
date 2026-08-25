export const MINDBILL_COMPONENTS = [
  "bill-timeline",
  "bill-review",
  "bill-from-report",
  "collections",
  "onboarding",
] as const;

export type MindBillComponent = (typeof MINDBILL_COMPONENTS)[number];
export type MindBillTheme = "light" | "dark" | "system";

export type MindBillAppearance = {
  theme?: MindBillTheme;
  accentColor?: string;
  backgroundColor?: string;
  surfaceColor?: string;
  textColor?: string;
  mutedColor?: string;
  borderColor?: string;
  fontFamily?: string;
  borderRadius?: string;
  locale?: string;
};

const appearanceAttributes = {
  accentColor: "accent-color",
  backgroundColor: "background-color",
  surfaceColor: "surface-color",
  textColor: "text-color",
  mutedColor: "muted-color",
  borderColor: "border-color",
  fontFamily: "font-family",
  borderRadius: "border-radius",
} as const;

export type MindBillEventDetail = {
  component: MindBillComponent;
  event: string;
  billId?: string;
  status?: string;
};

export type MindBillErrorDetail = {
  component: MindBillComponent;
  code: "missing_configuration" | "invalid_embed_url";
  message: string;
};

type MindBillMessage = {
  type: "mindbill:event";
  component: MindBillComponent;
  event: string;
  billId?: string;
  status?: string;
};

type MindBillResizeMessage = {
  type: "mindbill:resize";
  component: MindBillComponent;
  height: number;
};

const HTMLElementBase: typeof HTMLElement =
  typeof HTMLElement === "undefined"
    ? (class {} as typeof HTMLElement)
    : HTMLElement;

const components = new Set<string>(MINDBILL_COMPONENTS);

function optionalString(value: unknown, maxLength: number): string | undefined {
  return typeof value === "string" && value.length <= maxLength
    ? value
    : undefined;
}

export function parseMindBillMessage(
  value: unknown,
): MindBillEventDetail | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<MindBillMessage>;
  if (
    candidate.type !== "mindbill:event" ||
    !components.has(String(candidate.component)) ||
    typeof candidate.event !== "string" ||
    candidate.event.length > 120
  )
    return null;
  const billId = optionalString(candidate.billId, 200);
  const status = optionalString(candidate.status, 120);
  return {
    component: candidate.component as MindBillComponent,
    event: candidate.event,
    ...(billId === undefined ? {} : { billId }),
    ...(status === undefined ? {} : { status }),
  };
}

function parseResizeMessage(value: unknown): MindBillResizeMessage | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<MindBillResizeMessage>;
  if (
    candidate.type !== "mindbill:resize" ||
    !components.has(String(candidate.component)) ||
    typeof candidate.height !== "number" ||
    !Number.isFinite(candidate.height)
  )
    return null;
  return {
    type: "mindbill:resize",
    component: candidate.component as MindBillComponent,
    height: Math.max(320, Math.min(2400, Math.ceil(candidate.height))),
  };
}

function exactHttpsUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    const isMindBillHost =
      url.hostname === "mindbill.org" || url.hostname.endsWith(".mindbill.org");
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      isMindBillHost
      ? url
      : null;
  } catch {
    return null;
  }
}

function validTheme(value: string | null): MindBillTheme {
  return value === "light" || value === "dark" ? value : "system";
}

export class MindBillEmbedElement extends HTMLElementBase {
  static observedAttributes = [
    "session-token",
    "embed-url",
    "theme",
    "accent-color",
    "background-color",
    "surface-color",
    "text-color",
    "muted-color",
    "border-color",
    "font-family",
    "border-radius",
    "locale",
  ];

  private frame: HTMLIFrameElement | null = null;
  private expectedOrigin: string | null = null;
  private readonly receiveMessage = (event: MessageEvent) => {
    if (
      !this.frame ||
      event.source !== this.frame.contentWindow ||
      event.origin !== this.expectedOrigin
    )
      return;
    const resize = parseResizeMessage(event.data);
    if (resize?.component === this.component) {
      this.frame.style.height = `${resize.height}px`;
      return;
    }
    const detail = parseMindBillMessage(event.data);
    if (!detail || detail.component !== this.component) return;
    this.dispatchEvent(
      new CustomEvent<MindBillEventDetail>("mindbill", {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  };

  get component(): MindBillComponent {
    const component = this.getAttribute("data-mindbill-component");
    if (!component || !components.has(component))
      throw new Error("MindBill element has no valid component");
    return component as MindBillComponent;
  }

  get appearance(): MindBillAppearance {
    const locale = this.getAttribute("locale") ?? undefined;
    const appearance = Object.fromEntries(
      Object.entries(appearanceAttributes).flatMap(([key, attribute]) => {
        const value = this.getAttribute(attribute);
        return value ? [[key, value.slice(0, 160)]] : [];
      }),
    ) as MindBillAppearance;
    return {
      theme: validTheme(this.getAttribute("theme")),
      ...appearance,
      ...(locale ? { locale: locale.slice(0, 35) } : {}),
    };
  }

  connectedCallback(): void {
    this.style.display ||= "block";
    this.render();
    globalThis.addEventListener?.("message", this.receiveMessage);
  }

  disconnectedCallback(): void {
    globalThis.removeEventListener?.("message", this.receiveMessage);
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.render();
  }

  configure(input: {
    sessionToken: string;
    embedUrl: string;
    appearance?: MindBillAppearance;
  }): void {
    this.setAttribute("session-token", input.sessionToken);
    this.setAttribute("embed-url", input.embedUrl);
    if (input.appearance?.theme)
      this.setAttribute("theme", input.appearance.theme);
    for (const [key, attribute] of Object.entries(appearanceAttributes)) {
      const value = input.appearance?.[key as keyof MindBillAppearance];
      if (value) this.setAttribute(attribute, value);
    }
    if (input.appearance?.locale)
      this.setAttribute("locale", input.appearance.locale);
  }

  private emitError(code: MindBillErrorDetail["code"], message: string): void {
    this.dispatchEvent(
      new CustomEvent<MindBillErrorDetail>("mindbill-error", {
        detail: { component: this.component, code, message },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private render(): void {
    const token = this.getAttribute("session-token");
    const rawEmbedUrl = this.getAttribute("embed-url");
    if (!token || !rawEmbedUrl) {
      this.frame?.remove();
      this.frame = null;
      this.emitError(
        "missing_configuration",
        "session-token and embed-url are required",
      );
      return;
    }
    const url = exactHttpsUrl(rawEmbedUrl);
    if (!url) {
      this.frame?.remove();
      this.frame = null;
      this.emitError(
        "invalid_embed_url",
        "embed-url must be a MindBill HTTPS URL without credentials",
      );
      return;
    }
    this.expectedOrigin = url.origin;
    if (this.frame?.src === url.href) {
      this.postConfiguration(token);
      return;
    }
    this.replaceChildren();
    const frame = document.createElement("iframe");
    frame.src = url.href;
    frame.title = `MindBill ${this.component.replaceAll("-", " ")}`;
    frame.loading = "lazy";
    frame.referrerPolicy = "no-referrer";
    frame.sandbox.add(
      "allow-scripts",
      "allow-same-origin",
      "allow-downloads",
      "allow-popups",
    );
    frame.style.cssText =
      "border:0;width:100%;height:100%;min-height:inherit;display:block";
    frame.addEventListener("load", () => this.postConfiguration(token), {
      once: true,
    });
    this.frame = frame;
    this.append(frame);
  }

  private postConfiguration(token: string): void {
    if (!this.expectedOrigin) return;
    this.frame?.contentWindow?.postMessage(
      {
        type: "mindbill:init",
        token,
        component: this.component,
        appearance: this.appearance,
      },
      this.expectedOrigin,
    );
  }
}

const definitions: ReadonlyArray<[string, MindBillComponent, string]> = [
  ["mindbill-bill-timeline", "bill-timeline", "620px"],
  ["mindbill-bill-review", "bill-review", "980px"],
  ["mindbill-bill-from-report", "bill-from-report", "760px"],
  ["mindbill-collections", "collections", "720px"],
  ["mindbill-onboarding", "onboarding", "760px"],
];

export function registerMindBillElements(
  registry: CustomElementRegistry | undefined = globalThis.customElements,
): void {
  if (!registry) return;
  for (const [tagName, component, minHeight] of definitions) {
    if (registry.get(tagName)) continue;
    class ComponentElement extends MindBillEmbedElement {
      override get component(): MindBillComponent {
        return component;
      }

      override connectedCallback(): void {
        this.style.minHeight ||= minHeight;
        super.connectedCallback();
      }
    }
    registry.define(tagName, ComponentElement);
  }
}

registerMindBillElements();

declare global {
  interface HTMLElementTagNameMap {
    "mindbill-bill-timeline": MindBillEmbedElement;
    "mindbill-bill-review": MindBillEmbedElement;
    "mindbill-bill-from-report": MindBillEmbedElement;
    "mindbill-collections": MindBillEmbedElement;
    "mindbill-onboarding": MindBillEmbedElement;
  }
}
