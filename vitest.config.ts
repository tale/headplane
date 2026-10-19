import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

// Load the version via package.json
const pkg = await readFile("package.json", "utf-8");
const isNext = process.env.IMAGE_TAG?.includes("next");
const { version } = JSON.parse(pkg);
if (!version) {
  throw new Error("Unable to read version from package.json");
}

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          setupFiles: ["tests/unit/setup/overlay-fs.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration:api",
          include: ["tests/integration/api/**/*.test.ts"],
          setupFiles: ["tests/integration/setup/vitest-hook.ts"],
          testTimeout: 60_000,
        },
      },
      {
        extends: true,
        test: {
          name: "integration:platform",
          include: ["tests/integration/platform/**/*.test.ts"],
          testTimeout: 60_000,
        },
      },
      {
        extends: true,
        test: {
          name: "integration:agent",
          include: ["tests/integration/agent/**/*.test.ts"],
          globalSetup: ["tests/integration/agent/setup.ts"],
          // Agents are counted by their binary path, which every file shares.
          fileParallelism: false,
          testTimeout: 180_000,
          hookTimeout: 180_000,
        },
      },
      {
        extends: true,
        test: {
          name: "integration:oidc",
          include: ["tests/integration/oidc/**/*.test.ts"],
          testTimeout: 60_000,
        },
      },
    ],
    env: {
      HEADPLANE_DEBUG_LOG: "true",
    },
    environment: "node",
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
