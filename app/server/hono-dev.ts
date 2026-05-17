import { createServer } from "node:http";
import { exit } from "node:process";

import { getRequestListener } from "@hono/node-server";
import { createServer as createViteServer } from "vite";

import log from "~/utils/log";

import { ConfigError } from "./config/error";
import { loadConfig } from "./config/load";
import { createAppContext } from "./context";
import { createHeadplaneHonoApp } from "./hono-app";

const PREFIX = process.env.__INTERNAL_PREFIX || "/admin";
(globalThis as Record<string, unknown>).__PREFIX__ = PREFIX;
(globalThis as Record<string, unknown>).__VERSION__ = process.env.HEADPLANE_VERSION ?? "dev";

let config;
try {
  config = await loadConfig();
} catch (error) {
  if (error instanceof ConfigError) {
    log.error("server", "Unable to load configuration: %s", error.message);
  } else {
    log.error("server", "Failed to load configuration: %s", error);
  }
  exit(1);
}

const context = await createAppContext(config);
context.auth.start();

const app = createHeadplaneHonoApp({ context, prefix: PREFIX });
const honoListener = getRequestListener(app.fetch);
const vite = await createViteServer({
  appType: "spa",
  server: {
    middlewareMode: true,
  },
});

const server = createServer((req, res) => {
  if (shouldUseHono(req.url)) {
    void honoListener(req, res);
    return;
  }

  vite.middlewares(req, res, (error?: unknown) => {
    if (error) {
      if (error instanceof Error) {
        vite.ssrFixStacktrace(error);
      }

      log.error("server", "Vite middleware failed: %s", error);
      res.statusCode = 500;
      res.end("Internal Server Error");
      return;
    }

    void honoListener(req, res);
  });
});

server.listen(config.server.port, config.server.host, () => {
  log.info("server", "Listening on http://%s:%s", config.server.host, config.server.port);
});

function shouldUseHono(rawUrl: string | undefined) {
  if (!rawUrl) {
    return false;
  }

  let pathname;
  try {
    pathname = new URL(rawUrl, "http://localhost").pathname;
  } catch {
    return false;
  }

  return (
    pathname === "/healthz" ||
    pathname === `${PREFIX}/healthz` ||
    pathname === `${PREFIX}/fate` ||
    pathname.startsWith(`${PREFIX}/fate/`) ||
    pathname.startsWith(`${PREFIX}/api/`)
  );
}
