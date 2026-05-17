import { versions } from "node:process";

import { serveStatic } from "@hono/node-server/serve-static";
import { Hono, type Context } from "hono";

import type { AppContext } from "./context";

interface HonoAppOptions {
  context: AppContext;
  prefix: string;
  staticRoot?: string;
}

export function createHeadplaneHonoApp({ context, prefix, staticRoot }: HonoAppOptions) {
  const app = new Hono();

  const health = async (c: Context) => {
    const api = context.hsApi.getRuntimeClient("fake-api-key");
    const healthy = await api.isHealthy();

    return c.json({ status: healthy ? "OK" : "ERROR" }, healthy ? 200 : 500);
  };

  app.get("/healthz", health);
  app.get(`${prefix}/healthz`, health);

  app.get(`${prefix}/api/info`, async (c) => {
    if (context.config.server.info_secret == null) {
      return c.json({ status: "Forbidden" }, 403);
    }

    const bearer = c.req.header("Authorization") ?? "";
    if (!bearer.startsWith("Bearer ")) {
      return c.json({ status: "Unauthorized" }, 401);
    }

    const token = bearer.slice("Bearer ".length).trim();
    if (token !== context.config.server.info_secret) {
      return c.json({ status: "Forbidden" }, 403);
    }

    const api = context.hsApi.getRuntimeClient("fake-api-key");
    const healthy = await api.isHealthy();

    return c.json({
      status: healthy ? "healthy" : "unhealthy",
      headplane_version: __VERSION__,
      headscale_canonical_version: healthy ? context.hsApi.apiVersion : "unknown",
      internal_versions: {
        node: versions.node,
        v8: versions.v8,
        uv: versions.uv,
        zlib: versions.zlib,
        openssl: versions.openssl,
        libc: versions.libc,
      },
    });
  });

  app.get(`${prefix}/api/session`, async (c) => {
    try {
      const principal = await context.auth.require(c.req.raw);

      if (principal.kind === "api_key") {
        return c.json({
          authenticated: true,
          principal: {
            kind: principal.kind,
            sessionId: principal.sessionId,
            displayName: principal.displayName,
          },
        });
      }

      return c.json({
        authenticated: true,
        principal: {
          kind: principal.kind,
          sessionId: principal.sessionId,
          user: principal.user,
          profile: principal.profile,
        },
      });
    } catch {
      return c.json({ authenticated: false }, 401);
    }
  });

  app.all(`${prefix}/fate`, (c) => c.json({ error: "Fate server is not mounted yet" }, 501));
  app.all(`${prefix}/fate/*`, (c) => c.json({ error: "Fate server is not mounted yet" }, 501));

  if (staticRoot) {
    const stripPrefix = (path: string) => path.slice(prefix.length) || "/";

    app.get(prefix, (c) => c.redirect(`${prefix}/`));
    app.use(
      `${prefix}/*`,
      serveStatic({
        root: staticRoot,
        rewriteRequestPath: stripPrefix,
      }),
    );
    app.get(`${prefix}/*`, serveStatic({ root: staticRoot, path: "index.html" }));
  }

  return app;
}
