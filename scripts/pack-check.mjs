import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const packageDirectories = ["packages/embed", "packages/react", "packages/node"];
const stagingDirectory = mkdtempSync(join(tmpdir(), "mindbill-pack-check-"));

try {
  for (const directory of packageDirectories) {
    const tarballName = execFileSync(
      "pnpm",
      ["pack", "--pack-destination", stagingDirectory],
      { cwd: directory, encoding: "utf8" },
    ).trim().split("\n").at(-1);
    if (!tarballName) throw new Error(`pnpm pack did not produce a tarball for ${directory}`);
    const tarballPath = join(stagingDirectory, basename(tarballName));
    const manifestText = execFileSync("tar", ["-xOf", tarballPath, "package/package.json"], { encoding: "utf8" });
    if (manifestText.includes("workspace:")) {
      throw new Error(`${directory} tarball contains an unresolved workspace dependency`);
    }
    const manifest = JSON.parse(manifestText);
    const sourceManifest = JSON.parse(readFileSync(`${directory}/package.json`, "utf8"));
    if (manifest.name !== sourceManifest.name || manifest.version !== sourceManifest.version) {
      throw new Error(`${directory} tarball identity does not match its source manifest`);
    }
    if (manifest.name === "@mindbill/node") {
      const cliText = execFileSync("tar", ["-xOf", tarballPath, "package/dist/cli.js"], { encoding: "utf8" });
      if (!cliText.startsWith("#!/usr/bin/env node")) {
        throw new Error("@mindbill/node CLI is missing its executable shebang");
      }
      if (cliText.match(/^#!.*$/gm)?.length !== 1) {
        throw new Error("@mindbill/node CLI must contain exactly one executable shebang");
      }
      const installDirectory = join(stagingDirectory, "node-package");
      mkdirSync(installDirectory, { recursive: true });
      execFileSync("tar", ["-xzf", tarballPath, "-C", installDirectory]);
      const help = execFileSync(process.execPath, [join(installDirectory, "package/dist/cli.js"), "--help"], {
        encoding: "utf8",
      });
      if (!help.includes("MindBill agent-safe CLI")) {
        throw new Error("@mindbill/node packed CLI did not return its help output");
      }
    }
    process.stdout.write(`Packed ${manifest.name}@${manifest.version} (${tarballPath})\n`);
  }
} finally {
  rmSync(stagingDirectory, { recursive: true, force: true });
}
