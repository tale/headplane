import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";

import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { reactRouterHonoServer } from "react-router-hono-server/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { parse } from "yaml";

const prefix = process.env.__INTERNAL_PREFIX || "/admin";
if (prefix.endsWith("/")) {
  throw new Error("Prefix must not end with a slash");
}

// Derive version: HEADPLANE_VERSION env > git describe > package.json
const isNext = process.env.IMAGE_TAG?.includes("next");
let version: string;
if (process.env.HEADPLANE_VERSION) {
  version = process.env.HEADPLANE_VERSION;
} else {
  try {
    const describe = execSync("git describe --tags", { encoding: "utf-8" })
      .trim()
      .replace(/^v/, "");
    const tag = execSync("git describe --tags --abbrev=0", { encoding: "utf-8" })
      .trim()
      .replace(/^v/, "");
    version = describe === tag ? tag : `${tag}-dev+${describe.split("-").pop()}`;
  } catch {
    const pkg = await readFile("package.json", "utf-8");
    version = JSON.parse(pkg).version;
  }
}
if (!version) {
  throw new Error("Unable to determine version");
}

// Load the config without any environment variables (not needed here)
const config = await readFile("config.example.yaml", "utf-8");
const { server } = parse(config);

export default defineConfig(({ command, isSsrBuild }) => ({
  base: command === "build" ? `${prefix}/` : undefined,
  plugins: [reactRouterHonoServer(), reactRouter(), tailwindcss(), tsconfigPaths()],
  server: {
    host: server.host,
    port: server.port,
  },
  build: {
    target: "esnext",
    sourcemap: true,
    rolldownOptions:
      command === "build"
        ? {
            // Exclude WASM from the client since it fetches from the server
            external: isSsrBuild ? [] : [/\.wasm(\?url)?$/],
            output: {
              manualChunks: undefined,
              inlineDynamicImports: isSsrBuild,
            },
          }
        : undefined,
  },
  ssr: {
    target: "node",
    noExternal: command === "build" ? true : undefined,
  },
  define: {
    __VERSION__: JSON.stringify(isNext ? `${version}-next` : version),
    __PREFIX__: JSON.stringify(prefix),
  },
}));
