import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";

import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { parse } from "yaml";

import { headplaneDevServer } from "./runtime/vite-plugin";

const PROD_ENTRY = "./app/server/main.ts";
const DEV_ENTRY = "./app/server/app.ts";
const REACT_ROUTER_SSR_NO_EXTERNAL = ["@react-router/node", "react-router"];

const PREFIX = process.env.__INTERNAL_PREFIX || "/admin";
if (PREFIX.endsWith("/")) {
  throw new Error("Prefix must not end with a slash");
}

// Derive version: HEADPLANE_VERSION env > git describe > package.json
const isNext = process.env.IMAGE_TAG?.includes("next");
let VERSION: string;
if (process.env.HEADPLANE_VERSION) {
  VERSION = process.env.HEADPLANE_VERSION;
} else {
  try {
    const describe = execSync("git describe --tags", { encoding: "utf-8" })
      .trim()
      .replace(/^v/, "");
    const tag = execSync("git describe --tags --abbrev=0", { encoding: "utf-8" })
      .trim()
      .replace(/^v/, "");
    VERSION = describe === tag ? tag : `${tag}-dev+${describe.split("-").pop()}`;
  } catch {
    const pkg = await readFile("package.json", "utf-8");
    VERSION = JSON.parse(pkg).version;
  }
}

if (!VERSION) {
  throw new Error("Unable to determine version");
}

// Load the config without any environment variables (not needed here)
const config = await readFile("config.example.yaml", "utf-8");
const { server } = parse(config);

export default defineConfig(({ command }) => {
  const ssrNoExternal = command === "build" ? true : REACT_ROUTER_SSR_NO_EXTERNAL;

  return {
    base: command === "build" ? `${PREFIX}/` : undefined,
    plugins: [
      headplaneDevServer({
        entry: DEV_ENTRY,
        basename: PREFIX,
        publicDir: new URL("./public", import.meta.url).pathname,
      }),
      reactRouter(),
      tailwindcss(),
    ],
    server: {
      host: server.host,
      port: server.port,
    },
    resolve: {
      tsconfigPaths: true,
    },
    build: {
      target: "baseline-widely-available",
      sourcemap: true,
    },
    environments: {
      client: {
        build: {
          rollupOptions:
            command === "build"
              ? {
                  // Exclude WASM from the client since it fetches from the server
                  external: [/\.wasm(\?url)?$/],
                }
              : undefined,
        },
      },
      ssr: {
        resolve: {
          noExternal: ssrNoExternal,
        },
        build: {
          rollupOptions:
            command === "build"
              ? {
                  // Override the SSR build entry so React Router emits the
                  // production bootstrap (`app/server/main.ts`) as
                  // `build/server/index.js`. It transitively imports the
                  // SSR entry, which pulls in the React Router server build
                  // via the virtual module `virtual:react-router/server-build`.
                  input: PROD_ENTRY,
                  external: [],
                }
              : undefined,
        },
      },
    },
    ssr: {
      noExternal: ssrNoExternal,
    },
    define: {
      __VERSION__: JSON.stringify(isNext ? `${VERSION}-next` : VERSION),
      __PREFIX__: JSON.stringify(PREFIX),
    },
  };
});
