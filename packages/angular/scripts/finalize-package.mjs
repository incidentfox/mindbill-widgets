// ng-packagr copies workspace specifiers into dist, outside the workspace package.
// Publish the version of the browser package this Angular build actually used.
import { readFile, writeFile } from "node:fs/promises";
const manifestUrl = new URL("../dist/package.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
const browser = JSON.parse(await readFile(new URL("../../browser/package.json", import.meta.url), "utf8"));
if (manifest.dependencies?.["@mindbill/browser"] === "workspace:^") {
  manifest.dependencies["@mindbill/browser"] = `^${browser.version}`;
  await writeFile(manifestUrl, JSON.stringify(manifest, null, 2) + "\n");
}
