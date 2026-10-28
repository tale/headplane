// MARK: Production Bootstrap
//
// The production SSR build entry. Imports the React Router request
// listener from `./app`, wraps it with static-asset serving (out of
// `build/client`) and basename redirect, then binds an http(s) server.
//
// This file is NOT loaded in dev — `react-router dev` boots through
// Vite, and the dev-only `runtime/vite-plugin.ts` dispatches requests
// straight to `./app`'s default export.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { exit } from "node:process";

import log from "~/utils/log";

import { type StartOptions, composeListener, startHttpServer } from "../../runtime/http";
import { build, config, createListener, dispose } from "./app";
import { configureBuild } from "./assets";

// `import.meta.url` resolves to `build/server/index.js`; the built
// client lives next to it at `build/client/`.
const clientDir = resolve(import.meta.dirname, "../client");

// The client build has relative asset URLs, so point them at the configured path.
const runtimeBuild = configureBuild(build, config.server.base_path);

let tls: StartOptions["tls"];
const { tls_cert_path: certPath, tls_key_path: keyPath } = config.server;
if (certPath || keyPath) {
  if (!certPath || !keyPath) {
    log.error(
      "server",
      "TLS misconfigured: both `server.tls_cert_path` and `server.tls_key_path` must be provided",
    );
    exit(1);
  }

  try {
    const [cert, key] = await Promise.all([readFile(certPath), readFile(keyPath)]);
    tls = { cert, key };
  } catch (err) {
    log.error("server", "Failed to read TLS material: %s", err);
    exit(1);
  }
}

// `HEADPLANE_LISTEN_FILE` is a Docker-specific contract: the
// Dockerfile sets it to `/tmp/headplane-listen` so the bundled
// `hp_healthcheck` binary can discover the URL to probe. Native
// installs don't ship a consumer, so we just skip writing anything
// if the var isn't set.
const listenFilePath = process.env.HEADPLANE_LISTEN_FILE;
const listenFile = listenFilePath
  ? {
      path: listenFilePath,
      url: `${tls ? "https" : "http"}://127.0.0.1:${config.server.port}${config.server.base_path}/healthz`,
    }
  : undefined;

const runtimeLogger = {
  info: (message: string, ...args: unknown[]) => log.info("server", message, ...args),
  error: (message: string, ...args: unknown[]) => log.error("server", message, ...args),
};

startHttpServer({
  host: config.server.host,
  port: config.server.port,
  tls,
  logger: runtimeLogger,
  listenFile,
  listener: composeListener({
    basename: config.server.base_path,
    staticRoot: clientDir,
    immutableAssets: true,
    assetManifest: {
      path: runtimeBuild.assets.url,
      body: `window.__reactRouterManifest=${JSON.stringify(runtimeBuild.assets)};`,
    },
    logger: runtimeLogger,
    requestListener: createListener(runtimeBuild),
  }),
  onShutdown: dispose,
});
