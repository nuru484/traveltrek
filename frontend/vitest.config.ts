// vitest.config.ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  // esbuild's automatic JSX runtime (Vite's default) covers component tests;
  // no babel / react plugin needed.
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    // Floors sit just under the current coverage, so the gate holds the line
    // without blocking on code that predates it.
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      thresholds: {
        branches: 60,
        functions: 60,
        lines: 70,
        statements: 70,
      },
    },
    env: {
      // Base URL the RTK Query client builds requests against; tests never
      // let a request actually leave the process.
      NEXT_PUBLIC_SERVER_URI: "http://localhost:9999",
    },
  },
});
