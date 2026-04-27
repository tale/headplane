// MARK: HTTP Runtime
//
// Bare Node http(s) runtime that hosts a `RequestListener` (typically the
// React Router request listener from `@react-router/node`) and serves
// static assets out of a directory.
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import {
  type IncomingMessage,
  type RequestListener,
  type Server,
  createServer as createHttpServer,
} from "node:http";
import type { ServerResponse } from "node:http";
import {
  type ServerOptions as HttpsServerOptions,
  createServer as createHttpsServer,
} from "node:https";
import { extname, normalize, resolve, sep } from "node:path";

import mime from "mime";

export interface Logger {
  info: (msg: string, ...args: unknown[]) => void;
  error: (msg: string, ...args: unknown[]) => void;
}

// TODO: Replace with Pino!
const defaultLogger: Logger = {
  info: (msg, ...args) => console.log(`[runtime] ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[runtime] ${msg}`, ...args),
};

export interface StaticOptions {
  root: string;
  basename: string;
  assetsDir: string;
  immutableAssets: boolean;
}

/**
 * Returns a static-file middleware. The callback resolves to `true` when
 * the request was served, `false` when the caller should fall through to
 * the next handler (e.g. the React Router request listener).
 */
function createStaticHandler(opts: StaticOptions) {
  const root = resolve(opts.root);
  const prefix = opts.basename.endsWith("/") ? opts.basename : `${opts.basename}/`;
  const assetsPrefix = `${prefix}${opts.assetsDir}/`;

  return async function serveStatic(req: IncomingMessage, res: ServerResponse) {
    if (req.method !== "GET" && req.method !== "HEAD") return false;
    if (!req.url) return false;

    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch {
      return false;
    }

    if (!pathname.startsWith(prefix)) return false;
    const rel = pathname.slice(prefix.length);
    if (!rel || rel.endsWith("/")) return false;

    // Resolve and confine to root to prevent path traversal.
    const file = resolve(root, normalize(rel));
    if (file !== root && !file.startsWith(root + sep)) return false;

    let st;
    try {
      st = await stat(file);
    } catch {
      return false;
    }
    if (!st.isFile()) return false;

    const isAsset = pathname.startsWith(assetsPrefix);
    res.setHeader(
      "Cache-Control",
      isAsset && opts.immutableAssets
        ? "public, max-age=31536000, immutable"
        : "public, max-age=3600",
    );

    const mimeType = mime.getType(extname(file)) ?? "application/octet-stream";
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", String(st.size));
    res.setHeader("Last-Modified", st.mtime.toUTCString());
    res.statusCode = 200;

    if (req.method === "HEAD") {
      res.end();
      return true;
    }

    await new Promise<void>((resolve_, reject) => {
      const stream = createReadStream(file);
      stream.on("error", reject);
      stream.on("end", () => resolve_());
      stream.pipe(res);
    });

    return true;
  };
}

export interface ListenerOptions {
  basename: string;
  staticRoot?: string;
  assetsDir?: string;
  immutableAssets?: boolean;
  requestListener: RequestListener;
  logger?: Logger;
}

/**
 * Composes the full Node `RequestListener` chain:
 *   1. `${basename}` → 302 to `${basename}/`
 *   2. Static asset serving (optional)
 *   3. Delegate to the downstream request listener
 */
export function composeListener(opts: ListenerOptions): RequestListener {
  const log = opts.logger ?? defaultLogger;
  const basename = opts.basename;
  const serveStatic = opts.staticRoot
    ? createStaticHandler({
        root: opts.staticRoot,
        basename,
        assetsDir: opts.assetsDir ?? "assets",
        immutableAssets: opts.immutableAssets ?? true,
      })
    : null;

  return (req, res) => {
    if (req.url) {
      try {
        const url = new URL(req.url, "http://localhost");
        if (url.pathname === basename) {
          res.statusCode = 302;
          res.setHeader("Location", `${basename}/${url.search}`);
          res.end();
          return;
        }
      } catch {}
    }

    if (!serveStatic) {
      opts.requestListener(req, res);
      return;
    }

    serveStatic(req, res)
      .then((handled) => {
        if (!handled) opts.requestListener(req, res);
      })
      .catch((err) => {
        log.error("Static handler failed: %s", err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end("Internal Server Error");
        } else {
          res.destroy(err as Error);
        }
      });
  };
}

export interface StartOptions {
  host: string;
  port: number;
  listener: RequestListener;
  tls?: HttpsServerOptions;
  logger?: Logger;
}

/**
 * Creates and starts an http(s) server. Wires up SIGINT/SIGTERM for
 * graceful shutdown.
 */
export function startHttpServer(opts: StartOptions): Server {
  const log = opts.logger ?? defaultLogger;
  const server = opts.tls
    ? createHttpsServer(opts.tls, opts.listener)
    : createHttpServer(opts.listener);

  server.listen(opts.port, opts.host, () => {
    const proto = opts.tls ? "https" : "http";
    log.info("Listening on %s://%s:%s", proto, opts.host, opts.port);
  });

  const shutdown = (signal: string) => {
    log.info("Received %s, shutting down...", signal);
    server.close(() => process.exit(0));
    // Force exit if connections don't drain in time.
    setTimeout(() => process.exit(0), 5_000).unref();
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  return server;
}
