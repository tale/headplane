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
  publicDir: string;
}

interface AppModule {
  default: RequestListener;
  config: { server: { base_path: string } };
  dispose?: () => Promise<void> | void;
}

export function headplaneDevServer(options: DevServerOptions): Plugin {
  return {
    name: "headplane:dev-server",
    apply: "serve",
    configureServer(server) {
      // Track the last-loaded module identity so we can call its
      // `dispose` when Vite swaps in a new one on HMR. Without this
      // the LiveStore and other long-lived services leak intervals
      // and subprocesses on every reload.
      let currentModule: AppModule | null = null;
      let composed: RequestListener | null = null;

      // Defer registration so our middleware runs AFTER Vite's
      // transform/asset middlewares (those serve `/@vite/...`,
      // `/node_modules/...`, module transforms, etc.).
      return () => {
        server.middlewares.use(async (req, res, next) => {
          try {
            // Recomputed per request so Vite's HMR picks up changes.
            const mod = (await server.ssrLoadModule(options.entry)) as AppModule;
            if (currentModule !== mod) {
              try {
                await currentModule?.dispose?.();
              } catch (err) {
                server.config.logger.warn(`[headplane:dev-server] dispose failed: ${String(err)}`);
              }

              currentModule = mod;
              composed = composeListener({
                basename: mod.config.server.base_path,
                staticRoot: options.publicDir,
                immutableAssets: false,
                requestListener: mod.default,
              });
            }

            composed!(req, res);
          } catch (err) {
            if (err instanceof Error) server.ssrFixStacktrace(err);
            next(err);
          }
        });
      };
    },
  };
}
