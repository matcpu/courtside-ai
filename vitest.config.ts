import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
  resolve: {
    alias: {
      "server-only": new URL(
        "./tests/server-only.ts",
        import.meta.url,
      ).pathname.replace(/^\/([A-Z]:)/, "$1"),
      "@": new URL("./src", import.meta.url).pathname.replace(
        /^\/([A-Z]:)/,
        "$1",
      ),
    },
  },
});
