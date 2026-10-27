import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { cn } from "cn/vite";
import { defineConfig } from "vitest/config";

// Load the version via package.json
const pkg = await readFile("package.json", "utf-8");
const isNext = process.env.IMAGE_TAG?.includes("next");
const { version } = JSON.parse(pkg);
if (!version) {
  throw new Error("Unable to read version from package.json");
}

export default defineConfig({
  // The class tables app/utils/cn.ts imports are generated, not checked in.
  plugins: [
    cn({
      content: ["app/**/*.{ts,tsx}"],
      css: "app/tailwind.css",
      out: "app/utils/cn-tables.ts",
    }),
  ],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration:app",
          include: ["tests/integration/**/*.test.ts"],
          exclude: [
            "node_modules/**",
            "build/**",
            "tests/integration/agent/**",
            "tests/integration/ssh/**",
          ],
          testTimeout: 120_000,
          hookTimeout: 120_000,
        },
      },
      {
        extends: true,
        test: {
          name: "integration:agent",
          include: ["tests/integration/agent/**/*.test.ts"],
          globalSetup: ["tests/integration/agent/setup.ts"],
          testTimeout: 180_000,
          hookTimeout: 180_000,
        },
      },
      {
        extends: true,
        test: {
          name: "integration:ssh",
          include: ["tests/integration/ssh/**/*.test.ts"],
          globalSetup: ["tests/integration/ssh/setup.ts"],
          testTimeout: 180_000,
          hookTimeout: 180_000,
        },
      },
    ],
    environment: "node",
    silent: "passed-only",
    exclude: ["node_modules/**", "build/**"],
  },
  resolve: {
    alias: {
      "~": resolve(import.meta.dirname, "./app"),
    },
  },
  define: {
    __VERSION__: JSON.stringify(isNext ? `${version}-next` : version),
  },
});
