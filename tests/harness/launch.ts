import { createServer, createServerModuleRunner } from "vite";

const server = await createServer({
  configFile: "vitest.config.ts",
  logLevel: "error",
  appType: "custom",
  server: { middlewareMode: true, hmr: false, watch: null },
});

await createServerModuleRunner(server.environments.ssr).import("/tests/harness/cli.ts");
