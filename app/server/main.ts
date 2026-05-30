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
import { dirname, resolve } from "node:path";
import { exit } from "node:process";
import { fileURLToPath } from "node:url";

import log from "~/utils/log";

import { type StartOptions, composeListener, startHttpServer } from "../../runtime/http";
import requestListener, { config, dispose } from "./app";

// `import.meta.url` resolves to `build/server/index.js`; the built
// client lives next to it at `build/client/`.
const clientDir = resolve(dirname(fileURLToPath(import.meta.url)), "../client");

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

startHttpServer({
  host: config.server.host,
  port: config.server.port,
  tls,
  listener: composeListener({
    basename: __PREFIX__,
    staticRoot: clientDir,
    immutableAssets: true,
    requestListener,
  }),
  onShutdown: dispose,
});
