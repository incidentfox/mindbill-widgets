import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const packages = [
  { source: "packages/browser" },
  { source: "packages/embed" },
  { source: "packages/react" },
  { source: "packages/angular", pack: "packages/angular/dist" },
  { source: "packages/node" },
];
const stagingDirectory = mkdtempSync(join(tmpdir(), "mindbill-pack-check-"));

try {
  for (const packageConfig of packages) {
    const sourceDirectory = packageConfig.source;
    const packDirectory = packageConfig.pack ?? sourceDirectory;
    const tarballName = execFileSync(
      "pnpm",
      ["pack", "--pack-destination", stagingDirectory],
      { cwd: packDirectory, encoding: "utf8" },
    ).trim().split("\n").at(-1);
    if (!tarballName) throw new Error(`pnpm pack did not produce a tarball for ${packDirectory}`);
    const tarballPath = join(stagingDirectory, basename(tarballName));
    const manifestText = execFileSync("tar", ["-xOf", tarballPath, "package/package.json"], { encoding: "utf8" });
    if (manifestText.includes("workspace:")) {
      throw new Error(`${packDirectory} tarball contains an unresolved workspace dependency`);
    }
    const manifest = JSON.parse(manifestText);
    const sourceManifest = JSON.parse(readFileSync(`${sourceDirectory}/package.json`, "utf8"));
    if (manifest.name !== sourceManifest.name || manifest.version !== sourceManifest.version) {
      throw new Error(`${packDirectory} tarball identity does not match its source manifest`);
    }
    process.stdout.write(`Packed ${manifest.name}@${manifest.version} (${tarballPath})\n`);
  }
} finally {
  rmSync(stagingDirectory, { recursive: true, force: true });
}
