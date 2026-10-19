import { copyFileSync, renameSync, rmSync } from "node:fs";
import path from "node:path";

const client = path.resolve(import.meta.dirname, "../build/client");
const base = (process.env.HEADPLANE_DOCS_BASE ?? "/").replace(/^\/+|\/+$/g, "");

if (!base) {
  copyFileSync(path.join(client, "__spa-fallback.html"), path.join(client, "404.html"));
  process.exit(0);
}

// An archived build prerenders its pages under the base path but leaves the
// assets and the SPA fallback at the root. Gather them into the base path's
// folder, which is what gets archived. Redirects only apply at the site root.
const site = path.join(client, base);
for (const entry of ["assets", "favicon.ico", "favicon.svg"]) {
  renameSync(path.join(client, entry), path.join(site, entry));
}

renameSync(path.join(client, "index.html"), path.join(site, "404.html"));
rmSync(path.join(client, "_redirects"));
