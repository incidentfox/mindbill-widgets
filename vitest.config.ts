import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { tsconfigRaw: { compilerOptions: { experimentalDecorators: true } } },
  test: { include: ["tests/**/*.test.ts"] },
  resolve: {
    alias: {
      "@mindbill/browser": fileURLToPath(
        new URL("./packages/browser/src/index.ts", import.meta.url),
      ),
    },
  },
});
