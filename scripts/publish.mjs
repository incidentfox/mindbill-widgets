import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const packageDirectories = ["packages/embed", "packages/react", "packages/node"];
const stagingDirectory = mkdtempSync(join(tmpdir(), "mindbill-publish-"));

try {
  for (const directory of packageDirectories) {
    const manifest = JSON.parse(readFileSync(`${directory}/package.json`, "utf8"));
    const specifier = `${manifest.name}@${manifest.version}`;
    const lookup = spawnSync("npm", ["view", specifier, "version"], { encoding: "utf8" });
    const lookupOutput = `${lookup.stdout ?? ""}\n${lookup.stderr ?? ""}`;
    const exists = lookup.status === 0;
    if (!exists && !lookupOutput.includes("E404")) {
      throw new Error(`Could not determine whether ${specifier} already exists; refusing to publish.`);
    }
    if (exists) {
      process.stdout.write(`Skipping ${specifier}; it already exists.\n`);
      continue;
    }
    const tarballName = execFileSync(
      "pnpm",
      ["pack", "--pack-destination", stagingDirectory],
      { cwd: directory, encoding: "utf8" },
    ).trim().split("\n").at(-1);
    if (!tarballName) throw new Error(`pnpm pack did not produce a tarball for ${specifier}`);
    const tarballPath = join(stagingDirectory, basename(tarballName));
    process.stdout.write(`Publishing ${specifier} with npm provenance.\n`);
    execFileSync("npm", ["publish", tarballPath, "--access", "public", "--provenance"], {
      stdio: "inherit",
    });
  }
} finally {
  rmSync(stagingDirectory, { recursive: true, force: true });
}
