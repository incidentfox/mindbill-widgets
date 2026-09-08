// Verify the example's exact committed dependency lock before SDK publication.
// A temporary loopback registry serves only freshly packed, integrity-matched SDKs.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const example = join(root, "examples/quickstart");
const temporary = await mkdtemp(join(tmpdir(), "mindbill-quickstart-artifacts-"));
const stage = join(temporary, "app");
const packages = new Map();
let registry;

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = execFile(command, args, { cwd, maxBuffer: 4 * 1024 * 1024 },
      (error) => error ? reject(error) : resolve());
    child.stdout.pipe(process.stdout); child.stderr.pipe(process.stderr);
  });
}

try {
  const lock = await readFile(join(example, "pnpm-lock.yaml"), "utf8");
  const manifest = JSON.parse(await readFile(join(example, "package.json"), "utf8"));
  for (const name of ["browser", "node", "react"]) {
    const directory = join(root, "packages", name);
    const pkg = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
    if (name !== "browser") assert.equal(manifest.dependencies[pkg.name], pkg.version,
      "The example must pin the SDK version being tested");
    await run("pnpm", ["pack", "--pack-destination", temporary], directory);
    const archive = await readFile(join(temporary, "mindbill-" + name + "-" + pkg.version + ".tgz"));
    const integrity = "sha512-" + createHash("sha512").update(archive).digest("base64");
    const entry = lock.split("'" + pkg.name + "@" + pkg.version + "':\n")[1]?.split("\n\n")[0];
    assert.ok(entry?.includes("integrity: " + integrity),
      "The committed lock integrity must match the exact " + pkg.name + " artifact");
    packages.set("/@mindbill/" + name + "/-/" + name + "-" + pkg.version + ".tgz", archive);
    console.log("Validated exact artifact:", pkg.name + "@" + pkg.version, integrity);
  }

  await cp(example, stage, {
    recursive: true,
    filter: (source) => {
      const name = source.split("/").at(-1);
      return !["node_modules", ".next", ".data", ".npmrc"].includes(name) && !name.endsWith(".tsbuildinfo")
        && !(name.startsWith(".env") && name !== ".env.example");
    },
  });
  registry = http.createServer(async (request, response) => {
    const path = new URL(request.url, "http://localhost").pathname;
    const archive = packages.get(path);
    if (archive) {
      response.writeHead(200, { "Content-Type": "application/octet-stream" });
      response.end(archive);
      return;
    }
    // The unchanged embed dependency remains the exact published registry package.
    if (/^\/@mindbill\/embed\/-\/embed-[0-9]+\.[0-9]+\.[0-9]+\.tgz$/.test(path)) {
      try {
        const published = await fetch("https://registry.npmjs.org" + path);
        response.writeHead(published.status, { "Content-Type": "application/octet-stream" });
        response.end(Buffer.from(await published.arrayBuffer()));
      } catch {
        response.writeHead(502); response.end("Published embed archive unavailable");
      }
      return;
    }
    response.writeHead(404); response.end("Only exact locked SDK archives are served here");
  });
  registry.listen(0, "127.0.0.1"); await once(registry, "listening");
  await writeFile(join(stage, ".npmrc"), "@mindbill:registry=http://127.0.0.1:" + registry.address().port + "\n");
  // Neither package.json nor the lockfile is rewritten. pnpm checks every integrity.
  await run("pnpm", ["install", "--ignore-workspace", "--ignore-scripts", "--frozen-lockfile"], stage);
  for (const command of ["typecheck", "test", "build"]) await run("pnpm", [command], stage);
  assert.equal(await readFile(join(stage, "pnpm-lock.yaml"), "utf8"), lock);
  console.log("PASS: exact locked SDK artifacts install, types, backend tests, and production build");
} finally {
  if (registry) await new Promise(resolve => registry.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
