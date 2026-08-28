import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
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
    process.stdout.write(`Packed ${manifest.name}@${manifest.version} (${tarballPath})\n`);
  }
} finally {
  rmSync(stagingDirectory, { recursive: true, force: true });
}
