// MARK: Vite Plugin
//
// In development we want `react-router dev` (Vite) to host the entire
// app, so we register a single connect-style middleware that:
//   1. loads the SSR entry through Vite's `ssrLoadModule` (HMR-aware),
//   2. dispatches every request through a `composeListener` chain
//      (basename redirect → static asset fallback → app handler).

import type { RequestListener } from "node:http";

import type { Plugin } from "vite";

import { composeListener } from "./http";

export interface DevServerOptions {
  entry: string;
  basename: string;
  publicDir: string;
}

export function headplaneDevServer(options: DevServerOptions): Plugin {
  return {
    name: "headplane:dev-server",
    apply: "serve",
    configureServer(server) {
      // Lazy reference to the loaded entry; recomputed per request so
      // Vite's HMR picks up changes via `ssrLoadModule`.
      let appListener: RequestListener = (_req, res) => {
        res.statusCode = 503;
        res.end("Server entry not loaded yet");
      };

      const composed = composeListener({
        basename: options.basename,
        staticRoot: options.publicDir,
        immutableAssets: false,
        requestListener: (req, res) => appListener(req, res),
      });

      // Defer registration so our middleware runs AFTER Vite's
      // transform/asset middlewares (those serve `/@vite/...`,
      // `/node_modules/...`, module transforms, etc.).
      return () => {
        server.middlewares.use(async (req, res, next) => {
          try {
            const mod = (await server.ssrLoadModule(options.entry)) as {
              default: RequestListener;
            };
            appListener = mod.default;
            composed(req, res);
          } catch (err) {
            if (err instanceof Error) server.ssrFixStacktrace(err);
            next(err);
          }
        });
      };
    },
  };
}
