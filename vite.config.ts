import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fate } from "react-fate/vite";
import { defineConfig } from "vite";
import { parse } from "yaml";

const PREFIX = process.env.__INTERNAL_PREFIX || "/admin";
if (PREFIX.endsWith("/")) {
  throw new Error("Prefix must not end with a slash");
}

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

const config = await readFile("config.example.yaml", "utf-8");
const { server } = parse(config);

export default defineConfig({
  appType: "spa",
  base: `${PREFIX}/`,
  plugins: [
    fate({
      module: "./app/server/fate.ts",
      transport: "native",
    }),
    react(),
    tailwindcss(),
  ],
  server: {
    host: server.host,
    port: server.port,
  },
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./app", import.meta.url)),
    },
  },
  build: {
    emptyOutDir: true,
    outDir: "build/client",
    sourcemap: true,
    target: "baseline-widely-available",
    rollupOptions: {
      external: [/\.wasm(\?url)?$/],
    },
  },
  define: {
    __VERSION__: JSON.stringify(isNext ? `${VERSION}-next` : VERSION),
    __PREFIX__: JSON.stringify(PREFIX),
  },
});
