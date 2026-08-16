#!/usr/bin/env node

import { chmod, open, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import {
  createDeveloperSandbox,
  MINDBILL_API_BASE_URL,
  MINDBILL_COMPONENTS,
  MINDBILL_SCOPES,
  MindBillClient,
  MindBillError,
  type MindBillComponent,
  type MindBillEnvironment,
  type MindBillScope,
} from "./index.js";

const help = `MindBill agent-safe CLI

Usage:
  mindbill signup --company NAME --contact NAME --email EMAIL --accept-terms [--output-env PATH]
  mindbill account [--env-file PATH]
  mindbill live-access --organization-id ID [--env-file PATH]
  mindbill billing-portal [--env-file PATH]
  mindbill key create --name NAME --environment sandbox|live --scopes CSV [--organization-id ID] [--output-env PATH]
  mindbill embed-session --component NAME --allowed-origin HTTPS_ORIGIN [--bill-id ID] [--expires-in SECONDS]

The CLI never accepts card data. live-access and billing-portal return short-lived
Stripe-hosted URLs that an authorized human opens in a browser.
`;

type Arguments = { positionals: string[]; flags: Map<string, string | true> };

function parseArguments(argv: string[]): Arguments {
  const positionals: string[] = [];
  const flags = new Map<string, string | true>();
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value) continue;
    if (!value.startsWith("--")) {
      positionals.push(value);
      continue;
    }
    const name = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) flags.set(name, true);
    else {
      flags.set(name, next);
      index += 1;
    }
  }
  return { positionals, flags };
}

function flag(args: Arguments, name: string, required = false): string | undefined {
  const value = args.flags.get(name);
  if (value === true || value === undefined) {
    if (required) throw new Error(`--${name} is required`);
    return undefined;
  }
  return value;
}

function safeResult(value: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function writeSecretFile(path: string, values: Record<string, string>): Promise<string> {
  const absolutePath = resolve(path);
  const handle = await open(absolutePath, "wx", 0o600);
  try {
    const content = Object.entries(values)
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join("\n");
    await handle.writeFile(`${content}\n`, { encoding: "utf8" });
  } finally {
    await handle.close();
  }
  await chmod(absolutePath, 0o600);
  return absolutePath;
}

async function apiKeyFromEnvFile(path: string): Promise<string | undefined> {
  try {
    const content = await readFile(resolve(path), "utf8");
    const match = content.match(/^MINDBILL_API_KEY=(?:"([^"]+)"|'([^']+)'|([^\s]+))$/m);
    return match?.[1] ?? match?.[2] ?? match?.[3];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function client(args: Arguments): Promise<MindBillClient> {
  const envFile = flag(args, "env-file") ?? ".env.mindbill";
  const apiKey = process.env.MINDBILL_API_KEY ?? await apiKeyFromEnvFile(envFile);
  if (!apiKey) throw new Error(`MINDBILL_API_KEY is missing; set it or create ${envFile} with the signup command`);
  const organizationId = process.env.MINDBILL_ORG_ID;
  return new MindBillClient({
    apiKey,
    ...(organizationId ? { organizationId } : {}),
    baseUrl: process.env.MINDBILL_API_BASE_URL ?? MINDBILL_API_BASE_URL,
  });
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2));
  const [command, subcommand] = args.positionals;
  if (!command || command === "help" || args.flags.has("help")) {
    process.stdout.write(help);
    return;
  }

  if (command === "signup") {
    if (!args.flags.has("accept-terms")) {
      throw new Error("Review the current developer terms, then pass --accept-terms to record consent");
    }
    const result = await createDeveloperSandbox({
      companyName: flag(args, "company", true)!,
      contactName: flag(args, "contact", true)!,
      email: flag(args, "email", true)!,
      termsAccepted: true,
    }, { baseUrl: process.env.MINDBILL_API_BASE_URL ?? MINDBILL_API_BASE_URL });
    const savedTo = await writeSecretFile(flag(args, "output-env") ?? ".env.mindbill", {
      MINDBILL_API_KEY: result.apiKey,
    });
    safeResult({
      partnerId: result.partnerId,
      partnerSlug: result.partnerSlug,
      accountId: result.accountId,
      credentialId: result.credentialId,
      environment: result.environment,
      keyPrefix: `${result.apiKey.slice(0, 16)}…`,
      savedTo,
      next: "Use synthetic data only. Add the env file to .gitignore.",
    });
    return;
  }

  const mindbill = await client(args);
  if (command === "account") {
    safeResult(await mindbill.getDeveloperAccount() as unknown as Record<string, unknown>);
    return;
  }
  if (command === "live-access") {
    const result = await mindbill.requestLiveAccess(flag(args, "organization-id", true)!);
    safeResult({
      status: result.status,
      checkoutUrl: result.checkout.url,
      checkoutSessionId: result.checkout.id,
      humanActionRequired: "An authorized human must open this Stripe-hosted URL and complete payment setup.",
    });
    return;
  }
  if (command === "billing-portal") {
    const result = await mindbill.createBillingPortalSession();
    safeResult({
      portalUrl: result.url,
      sessionId: result.id,
      humanActionRequired: "An authorized human must open this Stripe-hosted URL.",
    });
    return;
  }
  if (command === "key" && subcommand === "create") {
    const environment = flag(args, "environment", true) as MindBillEnvironment;
    if (environment !== "sandbox" && environment !== "live") throw new Error("--environment must be sandbox or live");
    const scopes = flag(args, "scopes", true)!.split(",").map((value) => value.trim()).filter(Boolean);
    if (scopes.length === 0) throw new Error("--scopes must contain at least one scope");
    const invalidScopes = scopes.filter((scope) => !MINDBILL_SCOPES.includes(scope as MindBillScope));
    if (invalidScopes.length > 0) {
      throw new Error(`Unsupported scopes: ${invalidScopes.join(", ")}. Allowed scopes: ${MINDBILL_SCOPES.join(", ")}`);
    }
    const organizationId = flag(args, "organization-id");
    const result = await mindbill.mintCredential({
      name: flag(args, "name", true)!,
      environment,
      scopes: scopes as MindBillScope[],
      ...(organizationId ? { organizationId } : {}),
    });
    const savedTo = await writeSecretFile(flag(args, "output-env") ?? `.env.mindbill.${environment}`, {
      MINDBILL_API_KEY: result.apiKey,
      ...(result.organizationId ? { MINDBILL_ORG_ID: result.organizationId } : {}),
    });
    safeResult({ ...result, apiKey: undefined, savedTo });
    return;
  }
  if (command === "embed-session") {
    const component = flag(args, "component", true) as MindBillComponent;
    if (!MINDBILL_COMPONENTS.includes(component)) {
      throw new Error(`--component must be one of: ${MINDBILL_COMPONENTS.join(", ")}`);
    }
    const billId = flag(args, "bill-id");
    const expiresInRaw = flag(args, "expires-in");
    const result = await mindbill.createEmbedSession({
      component,
      allowedOrigin: flag(args, "allowed-origin", true)!,
      ...(billId ? { billId } : {}),
      ...(expiresInRaw ? { expiresIn: Number(expiresInRaw) } : {}),
    });
    safeResult(result as unknown as Record<string, unknown>);
    return;
  }
  throw new Error(`Unknown command.\n\n${help}`);
}

main().catch((error: unknown) => {
  if (error instanceof MindBillError) {
    process.stderr.write(`${JSON.stringify({ error: error.message, status: error.status, requestId: error.requestId }, null, 2)}\n`);
  } else {
    process.stderr.write(`${error instanceof Error ? error.message : "Unknown error"}\n`);
  }
  process.exitCode = 1;
});
