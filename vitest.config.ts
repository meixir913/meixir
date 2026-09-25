import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      // Next's server-only guard has no meaning outside the Next bundler.
      "server-only": path.resolve(__dirname, "tests/empty.ts"),
    },
  },
  test: { environment: "node" },
});
