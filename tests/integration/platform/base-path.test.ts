import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { type StartedHeadscale, startHeadscale } from "../../harness/headscale";
import { LATEST_HEADSCALE } from "../../harness/versions";
import { waitFor } from "../../harness/wait";
import { tempDir } from "../../support/temp";

// Builds without the caller's HEADPLANE_ variables, so the build itself can't
// carry a path. One build has to serve every path.
const env = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("HEADPLANE_")),
  ),
  NODE_ENV: "production",
};

let headscale: StartedHeadscale;

beforeAll(async () => {
  [headscale] = await Promise.all([
    startHeadscale({ version: LATEST_HEADSCALE, id: `base-path-${process.pid}` }),
    promisify(execFile)("pnpm", ["run", "build"], { env, maxBuffer: 32 * 1024 * 1024 }),
  ]);
}, 180_000);

afterAll(async () => {
  await headscale?.stop();
});

describe.each(["/admin", "/tools/web"])("the production build at %s", (prefix) => {
  let origin: string;
  let healthUrl: string;
  let stop: () => Promise<unknown>;

  beforeAll(async () => {
    const port = await freePort();
    const dataPath = await tempDir();
    const listenFile = join(dataPath, "listen-url");

    const child = spawn(process.execPath, ["build/server/index.js"], {
      env: {
        ...env,
        HEADPLANE_CONFIG_PATH: join(dataPath, "missing.yaml"),
        HEADPLANE_LISTEN_FILE: listenFile,
        HEADPLANE_SERVER__HOST: "127.0.0.1",
        HEADPLANE_SERVER__PORT: String(port),
        HEADPLANE_SERVER__DATA_PATH: dataPath,
        HEADPLANE_SERVER__COOKIE_SECRET: "thirtytwo-character-cookiesecret",
        HEADPLANE_SERVER__COOKIE_SECURE: "false",
        HEADPLANE_HEADSCALE__URL: headscale.url,
        // /admin is the default, so it runs without the option set.
        ...(prefix === "/admin" ? {} : { HEADPLANE_SERVER__BASE_PATH: prefix }),
      },
      stdio: "ignore",
    });

    stop = async () => {
      if (child.exitCode !== null) return;
      child.kill();
      await once(child, "exit");
    };

    origin = `http://127.0.0.1:${port}`;
    healthUrl = await waitFor("Headplane to listen", () => {
      if (child.exitCode !== null) throw new Error(`Headplane exited with ${child.exitCode}`);
      return readFile(listenFile, "utf8");
    });
  }, 60_000);

  afterAll(() => stop?.());

  test("serves the dashboard and every asset it loads under the path", async () => {
    expect(healthUrl.trim()).toBe(`${origin}${prefix}/healthz`);
    expect((await fetch(healthUrl.trim())).status).toBe(200);

    const bare = await fetch(`${origin}${prefix}?s=1`, { redirect: "manual" });
    expect(bare.headers.get("location")).toBe(`${prefix}/?s=1`);

    const html = await (await fetch(`${origin}${prefix}/login`)).text();
    expect(html).toContain(`"basename":"${prefix}"`);
    expect(html).toContain(`href="${prefix}/favicon.svg"`);

    const assets = [...html.matchAll(/(?:href|src)="([^"]+\.(?:js|css|ico|svg))"/g)].map(
      ([, url]) => url,
    );
    expect(assets.filter((url) => !url.startsWith(`${prefix}/`))).toEqual([]);

    for (const url of new Set(assets)) {
      const response = await fetch(`${origin}${url}`);
      expect(response.status, url).toBe(200);
      if (!url.endsWith(".css")) continue;

      // Fonts are imported relative to the stylesheet, not the path.
      for (const [, font] of (await response.text()).matchAll(/url\(([^)]+\.woff2)\)/g)) {
        const fontUrl = new URL(font, `${origin}${url}`);
        expect(fontUrl.pathname.startsWith(`${prefix}/assets/`), font).toBe(true);
        expect((await fetch(fontUrl)).status, font).toBe(200);
      }
    }

    if (prefix !== "/admin") {
      expect((await fetch(`${origin}/admin/login`)).status).toBe(404);
    }
  });

  test("rebases the client manifest and lazily discovered routes onto the path", async () => {
    const html = await (await fetch(`${origin}${prefix}/login`)).text();
    const manifestUrl = html.match(/"([^"]+\/manifest-[^"]+\.js)"/)?.[1];
    expect(manifestUrl?.startsWith(`${prefix}/assets/`)).toBe(true);

    const script = await (await fetch(`${origin}${manifestUrl}`)).text();
    const manifest = JSON.parse(script.replace(/^window\.__reactRouterManifest=/, "").slice(0, -1));
    expect(manifest.entry.module.startsWith(`${prefix}/assets/`)).toBe(true);
    expect(manifest.routes.root.module.startsWith(`${prefix}/assets/`)).toBe(true);

    const discovery = new URL(`${origin}${prefix}/__manifest`);
    discovery.searchParams.set("version", manifest.version);
    discovery.searchParams.set("paths", `${prefix}/machines`);
    const routes = await (await fetch(discovery)).json();
    const modules = Object.values(routes).map((route) => (route as { module: string }).module);
    expect(modules.length).toBeGreaterThan(0);
    expect(modules.filter((module) => !module.startsWith(`${prefix}/assets/`))).toEqual([]);
  });

  test("keeps a session and live data under the path", async () => {
    const login = await fetch(`${origin}${prefix}/login`, {
      method: "POST",
      headers: { Origin: origin },
      body: new URLSearchParams({ api_key: headscale.apiKey }),
      redirect: "manual",
    });
    expect(login.headers.get("location")).toBe(`${prefix}/machines`);

    const [setCookie] = login.headers.getSetCookie();
    expect(setCookie).toContain(`Path=${prefix};`);
    const headers = { Cookie: setCookie.split(";")[0] };

    const machines = await fetch(`${origin}${prefix}/machines`, { headers, redirect: "manual" });
    expect(machines.status).toBe(200);

    const events = await fetch(`${origin}${prefix}/events/live`, {
      headers,
      signal: AbortSignal.timeout(5_000),
    });
    const reader = events.body!.pipeThrough(new TextDecoderStream()).getReader();
    expect((await reader.read()).value).toContain("event: hello");
    await reader.cancel();

    const logout = await fetch(`${origin}${prefix}/logout`, {
      method: "POST",
      headers: { ...headers, Origin: origin },
      redirect: "manual",
    });
    expect(logout.headers.get("location")).toBe(`${prefix}/login`);
    expect(logout.headers.get("set-cookie")).toContain(`Path=${prefix};`);
  });
});

async function freePort() {
  await using server = createServer().listen(0, "127.0.0.1");
  await once(server, "listening");
  return (server.address() as { port: number }).port;
}
