import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { chromium } from "playwright";
import { beforeAll, expect, test } from "vitest";

// Exercise the real production bundle, including the HTTP static middleware.
// All three paths use the same build, proving this is a runtime setting.
const cleanEnv = {
  NODE_ENV: "production",
  ...Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !key.startsWith("HEADPLANE_") && key !== "__INTERNAL_PREFIX" && key !== "NODE_ENV",
    ),
  ),
};
beforeAll(async () => {
  await promisify(execFile)("pnpm", ["run", "build"], {
    env: cleanEnv,
    maxBuffer: 32 * 1024 * 1024,
  });
}, 60_000);

test.for(["/admin", "/web", "/tools/web"])(
  "production dashboard at %s",
  { timeout: 60_000 },
  async (prefix) => {
    const headscale = createServer((request, response) => {
      response.setHeader("Content-Type", "application/json");
      response.end(
        JSON.stringify(
          request.url === "/version"
            ? { version: "0.28.0" }
            : request.url === "/api/v1/apikey"
              ? {
                  apiKeys: [
                    {
                      id: "1",
                      prefix: "test",
                      expiration: "2099-01-01T00:00:00Z",
                      createdAt: "2026-01-01T00:00:00Z",
                    },
                  ],
                }
              : { nodes: [], users: [] },
        ),
      );
    });
    headscale.listen(0, "127.0.0.1");
    await once(headscale, "listening");
    const address = headscale.address();
    if (!address || typeof address === "string") throw new Error("Missing mock Headscale address");

    const reserve = createServer();
    reserve.listen(0, "127.0.0.1");
    await once(reserve, "listening");
    const reserved = reserve.address();
    if (!reserved || typeof reserved === "string") throw new Error("Missing application address");
    await new Promise<void>((resolve) => reserve.close(() => resolve()));
    const origin = `http://127.0.0.1:${reserved.port}`;
    const directory = await mkdtemp(join(tmpdir(), "headplane-base-path-"));
    const child = spawn(process.execPath, ["build/server/index.js"], {
      env: {
        ...cleanEnv,
        HEADPLANE_CONFIG_PATH: join(directory, "missing.yaml"),
        HEADPLANE_SERVER__HOST: "127.0.0.1",
        HEADPLANE_SERVER__PORT: String(reserved.port),
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
    const exit = once(child, "exit");
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`Server did not start: ${output}`)),
          15_000,
        );
        child.stdout.on("data", (chunk) => {
          output += chunk;
          if (output.includes("Listening on")) {
            clearTimeout(timer);
            resolve();
          }
        });
        child.stderr.on("data", (chunk) => {
          output += chunk;
        });
        child.once("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
        child.once("exit", () => {
          clearTimeout(timer);
          reject(new Error(output));
        });
      });

      await expect
        .poll(() => readFile(join(directory, "listen-url"), "utf8"))
        .toBe(`${origin}${prefix}/healthz\n`);
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
      expect((await fetch(`${origin}${prefix}/login.data`)).status).toBe(200);
      expect((await fetch(`${origin}${prefix}/healthz`)).status).toBe(200);
      if (prefix !== "/admin") expect((await fetch(`${origin}/admin/login`)).status).toBe(404);

      if (prefix === "/tools/web") {
        await checkBrowserNavigation(origin, prefix);
      }

      const login = await fetch(`${origin}${prefix}/login`, {
        method: "POST",
        body: new URLSearchParams({ api_key: "test.key" }),
        redirect: "manual",
      });
      expect(login.status).toBe(302);
      expect(login.headers.get("location")).toBe(`${prefix}/machines`);
      const cookie = login.headers.get("set-cookie");
      expect(cookie).toContain(`Path=${prefix}`);
      const authenticated = await fetch(`${origin}${prefix}/login`, {
        headers: { Cookie: cookie!.split(";")[0] },
        redirect: "manual",
      });
      expect(authenticated.headers.get("location")).toBe(`${prefix}/machines`);
      const headers = { Cookie: cookie!.split(";")[0] };
      const abort = new AbortController();
      const events = await fetch(`${origin}${prefix}/events/live`, {
        headers,
        signal: abort.signal,
      });
      expect(events.headers.get("content-type")).toContain("text/event-stream");
      const reader = events.body!.getReader();
      expect(new TextDecoder().decode((await reader.read()).value)).toContain("event: hello");
      await reader.cancel();
      abort.abort();
      const logout = await fetch(`${origin}${prefix}/logout`, {
        method: "POST",
        headers,
        redirect: "manual",
      });
      expect(logout.headers.get("location")).toBe(`${prefix}/login`);
      expect(logout.headers.get("set-cookie")).toContain(`Path=${prefix}`);
      expect(logout.headers.get("set-cookie")).toContain("Expires=Thu, 01 Jan 1970");
    } finally {
      child.kill("SIGTERM");
      await exit;
      await new Promise<void>((resolve) => headscale.close(() => resolve()));
      await rm(directory, { recursive: true, force: true });
    }
  },
);

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

    // Sorting is a React event handler, so the DOM change proves hydration.
    await page.getByRole("button", { name: "Sort by name", exact: true }).click();
    await expect.poll(() => page.locator('th[aria-sort="descending"]').count()).toBe(1);

    await page.getByRole("link", { name: "Users", exact: true }).click();
    await page.getByRole("heading", { name: "Users", exact: true }).waitFor();
    expect(new URL(page.url()).pathname).toBe(`${prefix}/users`);
    await page.getByRole("link", { name: "Machines", exact: true }).click();
    await page.getByRole("heading", { name: "Machines", exact: true }).waitFor();
    expect(new URL(page.url()).pathname).toBe(`${prefix}/machines`);

    // Client navigation must retain the document and load data/chunks at the
    // runtime prefix, rather than falling back to a full page reload.
    expect(documents).toEqual([`${prefix}/login`]);
    expect(requests).toContain(`${prefix}/users.data`);
    expect(requests.filter((path) => path === "/admin" || path.startsWith("/admin/"))).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
  }
}
