import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  esbuild: {
    jsx: "automatic"
  },
  test: {
    environment: "node"
  },
  resolve: {
    alias: {
      "@": rootDir,
      "server-only": fileURLToPath(new URL("./tests/server-only.ts", import.meta.url))
    }
  }
});
