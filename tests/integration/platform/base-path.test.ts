import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

const cleanEnv = {
  NODE_ENV: "production",
  ...Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !key.startsWith("HEADPLANE_") && key !== "NODE_ENV",
    ),
  ),
};
beforeAll(async () => {
  await promisify(execFile)("pnpm", ["run", "build"], {
    env: cleanEnv,
    maxBuffer: 32 * 1024 * 1024,
  });
}, 60_000);

const headscaleResponses: Record<string, unknown> = {
  "/version": { version: "0.28.0" },
  "/api/v1/apikey": {
    apiKeys: [
      {
        id: "1",
        prefix: "test",
        expiration: "2099-01-01T00:00:00Z",
        createdAt: "2026-01-01T00:00:00Z",
      },
    ],
  },
};

describe.each(["/admin", "/web", "/tools/web"])("production dashboard at %s", (prefix) => {
  const resources = new AsyncDisposableStack();
  let origin: string;
  let listenUrl: string;

  beforeAll(async () => {
    const headscale = resources.use(
      createServer((request, response) => {
        response.setHeader("Content-Type", "application/json");
        response.end(
          JSON.stringify(headscaleResponses[request.url ?? ""] ?? { nodes: [], users: [] }),
        );
      }),
    );
    headscale.listen(0, "127.0.0.1");
    await once(headscale, "listening");
    const address = headscale.address();
    if (!address || typeof address === "string") throw new Error("Missing mock Headscale address");

    const port = await unusedPort();
    origin = `http://127.0.0.1:${port}`;
    const directory = await mkdtemp(join(tmpdir(), "headplane-base-path-"));
    resources.defer(() => rm(directory, { recursive: true, force: true }));
    const child = spawn(process.execPath, ["build/server/index.js"], {
      env: {
        ...cleanEnv,
        HEADPLANE_CONFIG_PATH: join(directory, "missing.yaml"),
        HEADPLANE_SERVER__HOST: "127.0.0.1",
        HEADPLANE_SERVER__PORT: String(port),
        ...(prefix === "/admin" ? {} : { HEADPLANE_SERVER__BASE_PATH: prefix }),
        HEADPLANE_SERVER__DATA_PATH: directory,
        HEADPLANE_LISTEN_FILE: join(directory, "listen-url"),
        HEADPLANE_SERVER__COOKIE_SECRET: "abcdefghijklmnopqrstuvwxyz123456",
        HEADPLANE_SERVER__COOKIE_SECURE: "false",
        HEADPLANE_HEADSCALE__URL: `http://127.0.0.1:${address.port}`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => (output += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk) => (output += chunk));
    resources.defer(async () => {
      if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
      const exited = once(child, "exit", { signal: AbortSignal.timeout(10_000) });
      child.kill("SIGTERM");
      await exited;
    });
    await once(child, "spawn", { signal: AbortSignal.timeout(5_000) });
    listenUrl = await vi.waitFor(
      async () => {
        if (child.exitCode !== null || child.signalCode !== null) {
          throw new Error(`Server exited before becoming ready: ${output}`);
        }
        return readFile(join(directory, "listen-url"), "utf8");
      },
      { timeout: 15_000 },
    );
  }, 30_000);

  afterAll(() => resources.disposeAsync(), 15_000);

  test("serves routes and the configured healthcheck URL", async () => {
    expect(listenUrl).toBe(`${origin}${prefix}/healthz\n`);
    const redirect = await fetch(`${origin}${prefix}?test=1`, { redirect: "manual" });
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get("location")).toBe(`${prefix}/?test=1`);
    const page = await fetch(`${origin}${prefix}/login`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("Welcome to Headplane");
    expect(html).toContain(`"basename":"${prefix}"`);
    expect(html).toContain(`href="${prefix}/favicon.ico"`);
    expect(html).toContain(`name="headplane-base-path" content="${prefix}"`);
    expect(html).toContain(`action="${prefix}/login"`);

    expect((await fetch(`${origin}${prefix}/login.data`)).status).toBe(200);
    expect((await fetch(`${origin}${prefix}/healthz`)).status).toBe(200);
    if (prefix !== "/admin") expect((await fetch(`${origin}/admin/login`)).status).toBe(404);
  });

  test("serves scripts, styles, icons, and fonts", async () => {
    const html = await (await fetch(`${origin}${prefix}/login`)).text();
    const urls = [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
      .map((match) => match[1])
      .filter((url) => url.startsWith(`${prefix}/`) && /\.(js|css|ico)$/.test(url));
    expect(urls.length).toBeGreaterThan(3);
    for (const url of new Set(urls)) {
      const response = await fetch(`${origin}${url}`);
      expect(response.status, url).toBe(200);
      if (url.endsWith(".css")) {
        const css = await response.text();
        const fontUrls = [...css.matchAll(/url\(["']?([^"')]+\.woff2)["']?\)/g)];
        expect(fontUrls.length).toBeGreaterThan(0);
        for (const [, font] of fontUrls) {
          const fontUrl = new URL(font, `${origin}${url}`);
          expect(fontUrl.pathname).toMatch(new RegExp(`^${prefix}/assets/`));
          expect((await fetch(fontUrl)).status).toBe(200);
        }
      }
    }
  });

  test("serves the runtime manifest and discovers routes", async () => {
    const html = await (await fetch(`${origin}${prefix}/login`)).text();
    const manifestUrl = html.match(new RegExp(`${prefix}/assets/manifest-[^"\\s]+\\.js`))?.[0];
    expect(manifestUrl).toBeDefined();
    const manifestResponse = await fetch(`${origin}${manifestUrl}`);
    expect(manifestResponse.headers.get("cache-control")).toBe("no-cache");
    const manifestScript = await manifestResponse.text();
    const manifest = JSON.parse(
      manifestScript.replace(/^window\.__reactRouterManifest=/, "").replace(/;$/, ""),
    );
    expect(manifest.entry.module).toMatch(new RegExp(`^${prefix}/assets/`));
    expect(manifest.routes.root.module).toMatch(new RegExp(`^${prefix}/assets/`));
    expect(manifest.routes.root.css[0]).toMatch(new RegExp(`^${prefix}/assets/`));
    const discoveryUrl = new URL(`${origin}${prefix}/__manifest`);
    discoveryUrl.searchParams.set("version", manifest.version);
    discoveryUrl.searchParams.set("paths", `${prefix}/ssh/test`);
    const discovered = await (await fetch(discoveryUrl)).json();
    expect(discovered["routes/ssh/page"].module).toMatch(new RegExp(`^${prefix}/assets/`));
    const head = await fetch(`${origin}${manifestUrl}`, { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(head.headers.get("content-type")).toContain("text/javascript");
    expect(head.headers.get("cache-control")).toBe("no-cache");
    expect(await head.text()).toBe("");
    const withQuery = await fetch(`${origin}${manifestUrl}?test=1`);
    expect(await withQuery.text()).toBe(manifestScript);
  });

  test("scopes sessions and live events to the dashboard path", async () => {
    const login = await fetch(`${origin}${prefix}/login`, {
      method: "POST",
      body: new URLSearchParams({ api_key: "test.key" }),
      redirect: "manual",
    });
    expect(login.status).toBe(302);
    expect(login.headers.get("location")).toBe(`${prefix}/machines`);
    const [cookie] = login.headers.getSetCookie();
    expect(cookie).toContain(`Path=${prefix}`);
    const authenticated = await fetch(`${origin}${prefix}/login`, {
      headers: { Cookie: cookie.split(";")[0] },
      redirect: "manual",
    });
    expect(authenticated.headers.get("location")).toBe(`${prefix}/machines`);
    const headers = { Cookie: cookie.split(";")[0] };
    const events = await fetch(`${origin}${prefix}/events/live`, {
      headers,
      signal: AbortSignal.timeout(5_000),
    });
    expect(events.headers.get("content-type")).toContain("text/event-stream");
    const reader = events.body?.pipeThrough(new TextDecoderStream()).getReader();
    if (!reader) throw new Error("Missing live-data response body");
    try {
      expect((await reader.read()).value).toContain("event: hello");
    } finally {
      await reader.cancel();
    }
    const logout = await fetch(`${origin}${prefix}/logout`, {
      method: "POST",
      headers,
      redirect: "manual",
    });
    expect(logout.headers.get("location")).toBe(`${prefix}/login`);
    expect(logout.headers.get("set-cookie")).toContain(`Path=${prefix}`);
    expect(logout.headers.get("set-cookie")).toContain("Expires=Thu, 01 Jan 1970");
  });

  if (prefix === "/tools/web") {
    test("hydrates and navigates without document reloads", () =>
      checkBrowserNavigation(origin, prefix));
  }
});

async function checkBrowserNavigation(origin: string, prefix: string) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(10_000);
    const errors: string[] = [];
    const requests: string[] = [];
    const documents: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.origin !== origin) return;
      requests.push(url.pathname);
      if (request.resourceType() === "document") documents.push(url.pathname);
    });

    await page.goto(`${origin}${prefix}/login`);
    expect(await page.locator('meta[name="headplane-base-path"]').getAttribute("content")).toBe(
      prefix,
    );
    await page.getByLabel("API Key", { exact: true }).fill("test.key");
    await Promise.all([
      page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === `${prefix}/login.data` &&
          response.request().method() === "POST",
      ),
      page.getByRole("button", { name: "Sign In", exact: true }).click(),
    ]);
    await page.getByRole("heading", { name: "Machines", exact: true }).waitFor();
    expect(new URL(page.url()).pathname).toBe(`${prefix}/machines`);

    await page.getByRole("button", { name: "Sort by name", exact: true }).click();
    await expect.poll(() => page.locator('th[aria-sort="descending"]').count()).toBe(1);

    await page.getByRole("link", { name: "Users", exact: true }).click();
    await page.getByRole("heading", { name: "Users", exact: true }).waitFor();
    expect(new URL(page.url()).pathname).toBe(`${prefix}/users`);
    await page.getByRole("link", { name: "Machines", exact: true }).click();
    await page.getByRole("heading", { name: "Machines", exact: true }).waitFor();
    expect(new URL(page.url()).pathname).toBe(`${prefix}/machines`);

    expect(documents).toEqual([`${prefix}/login`]);
    expect(requests).toContain(`${prefix}/users.data`);
    expect(requests.filter((path) => path === "/admin" || path.startsWith("/admin/"))).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
  }
}

async function unusedPort() {
  await using server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing application address");
  return address.port;
}
