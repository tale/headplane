// MARK: createHeadscale resilience
//
// These tests exercise the boot-time behaviour where Headscale may be
// unreachable. They use a Node http server to stand in for Headscale so
// we control whether `/version` resolves at boot, after a retry, or not
// at all.

import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";

import { afterEach, describe, expect, test, vi } from "vitest";

import { createHeadscale } from "~/server/headscale/api";

let servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.map(
      (s) =>
        new Promise<void>((resolve) => {
          s.close(() => resolve());
        }),
    ),
  );
  servers = [];
  vi.useRealTimers();
});

function startVersionServer(handler: (req: Request) => Response): Promise<{
  url: string;
  callCount: () => number;
  setResponse: (handler: (req: Request) => Response) => void;
}> {
  let current = handler;
  let count = 0;
  const server = createServer((req, res) => {
    count++;
    const fullUrl = `http://${req.headers.host}${req.url}`;
    const request = new Request(fullUrl, { method: req.method });
    const response = current(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    response.text().then((body) => res.end(body));
  });
  servers.push(server);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as AddressInfo).port;
      resolve({
        url: `http://127.0.0.1:${port}`,
        callCount: () => count,
        setResponse: (h) => {
          current = h;
        },
      });
    });
  });
}

describe("createHeadscale boot-time resilience", () => {
  test("detects version when Headscale is reachable at boot", async () => {
    const { url } = await startVersionServer(() =>
      Response.json({ version: "v0.28.0", commit: "abc", buildTime: "", go: "", dirty: false }),
    );

    const headscale = await createHeadscale({ url });
    expect(headscale.version.raw).toBe("v0.28.0");
    expect(headscale.version.unknown).toBe(false);
    expect(headscale.capabilities.preAuthKeysHaveStableIds).toBe(true);
    await headscale.dispose();
  });

  test("boots with permissive defaults when /version fails at boot", async () => {
    const { url } = await startVersionServer(() => new Response("nope", { status: 503 }));

    const headscale = await createHeadscale({ url, retryIntervalMs: 1_000_000 });
    // Should not throw, and should default to "unknown" with permissive caps.
    expect(headscale.version.unknown).toBe(true);
    expect(headscale.capabilities.preAuthKeysHaveStableIds).toBe(true);
    await headscale.dispose();
  });

  test("a 404 from /version is treated as below the supported floor and keeps retrying", async () => {
    const probe = await startVersionServer(() => new Response("not found", { status: 404 }));

    const headscale = await createHeadscale({ url: probe.url, retryIntervalMs: 25 });
    // 404 = pre-0.27 Headscale. We do NOT settle on an inferred version;
    // capabilities stay permissive and the background retry keeps probing
    // so an in-place upgrade is picked up without a Headplane restart.
    expect(headscale.version.unknown).toBe(true);

    probe.setResponse(() =>
      Response.json({ version: "v0.28.0", commit: "x", buildTime: "", go: "", dirty: false }),
    );

    const deadline = Date.now() + 2000;
    while (Date.now() < deadline && headscale.version.unknown) {
      await new Promise((r) => setTimeout(r, 25));
    }

    expect(headscale.version.unknown).toBe(false);
    expect(headscale.version.raw).toBe("v0.28.0");
    await headscale.dispose();
  });

  test("background retry promotes to detected version once Headscale comes online", async () => {
    const probe = await startVersionServer(() => new Response("nope", { status: 503 }));

    const headscale = await createHeadscale({ url: probe.url, retryIntervalMs: 20 });
    expect(headscale.version.unknown).toBe(true);

    probe.setResponse(() =>
      Response.json({ version: "v0.27.1", commit: "x", buildTime: "", go: "", dirty: false }),
    );

    // Poll for up to 2s for the background retry to pick up the new response.
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline && headscale.version.unknown) {
      await new Promise((r) => setTimeout(r, 25));
    }

    expect(headscale.version.unknown).toBe(false);
    expect(headscale.version.raw).toBe("v0.27.1");
    expect(headscale.capabilities.preAuthKeysHaveStableIds).toBe(false);
    await headscale.dispose();
  });

  test("dispose cancels the background retry", async () => {
    const probe = await startVersionServer(() => new Response("nope", { status: 503 }));

    const headscale = await createHeadscale({ url: probe.url, retryIntervalMs: 25 });
    await headscale.dispose();

    const before = probe.callCount();
    await new Promise((r) => setTimeout(r, 150));
    // At most a tiny number of additional calls if a retry was already
    // queued at dispose time, but the cadence should have stopped.
    expect(probe.callCount() - before).toBeLessThanOrEqual(1);
  });
});
