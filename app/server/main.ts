// MARK: Production Bootstrap
//
// The production SSR build entry. Imports the React Router request
// listener from `./app`, wraps it with static-asset serving (out of
// `build/client`) and basename redirect, then binds an http(s) server.
//
// This file is NOT loaded in dev — `react-router dev` boots through
// Vite, and the dev-only `runtime/vite-plugin.ts` dispatches requests
// straight to `./app`'s default export.

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { composeListener, startHttpServer } from "../../runtime/http";
import requestListener, { config } from "./app";

// `import.meta.url` resolves to `build/server/index.js`; the built
// client lives next to it at `build/client/`.
const clientDir = resolve(dirname(fileURLToPath(import.meta.url)), "../client");

startHttpServer({
  host: config.server.host,
  port: config.server.port,
  listener: composeListener({
    basename: __PREFIX__,
    staticRoot: clientDir,
    immutableAssets: true,
    requestListener,
  }),
});
