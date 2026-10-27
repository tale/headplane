import { getContainerRuntimeClient } from "testcontainers";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { loader as healthz } from "~/routes/util/healthz";
import { loader as info } from "~/routes/util/info";
import { loader as live } from "~/routes/util/live";

import { createTailnet, type Tailnet } from "../../harness/tailnet";
import { waitFor } from "../../harness/wait";
import { createTestApp, statusOf, type TestApp } from "../../support/app";

const UNREACHABLE = { url: "http://127.0.0.1:1", apiKey: "unused" };

describe("Headplane's status", () => {
  let tailnet: Tailnet;
  let app: TestApp;
  let owner: string;

  beforeAll(async () => {
    tailnet = await createTailnet();
    app = await tailnet.headplane({ config: { server: { info_secret: "info-secret" } } });
    owner = (await app.signIn("owner")).cookie;
  });

  afterAll(async () => {
    await tailnet?.dispose();
  });

  // Reads server-sent events from the live stream as they arrive.
  async function openLive(signal?: AbortSignal) {
    const response = (await app.call(live, "/events/live", { as: owner, signal })) as Response;
    const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";

    async function next(): Promise<{ event: string; data: Record<string, string> } | undefined> {
      while (!buffer.includes("\n\n")) {
        const { value, done } = await reader.read();
        if (done) return undefined;
        buffer += value;
      }

      const [chunk, ...rest] = buffer.split("\n\n");
      buffer = rest.join("\n\n");
      const event = chunk.match(/^event: (.*)$/m)?.[1];
      const data = chunk.match(/^data: (.*)$/m)?.[1];
      return event ? { event, data: JSON.parse(data!) } : next();
    }

    // The first change of `resource` after now.
    async function change(resource: string) {
      for (;;) {
        const message = await next();
        if (!message) throw new Error(`The stream ended before ${resource} changed`);
        if (message.event === "changed" && message.data.resource === resource) return message;
      }
    }

    return { next, change, close: () => reader.cancel() };
  }

  test("healthz reports whether Headscale answers", async () => {
    const up = (await app.call(healthz, "/healthz")) as Response;
    expect(up.status).toBe(200);
    expect(await up.json()).toEqual({ status: "OK" });

    await using cut = await createTestApp({ headscale: UNREACHABLE });
    const down = (await cut.call(healthz, "/healthz")) as Response;
    expect(down.status).toBe(500);
    expect(await down.json()).toEqual({ status: "ERROR" });
  });

  test("info answers only to its secret", async () => {
    const ask = (token?: string, on = app) =>
      on.call(info, "/api/info", { headers: token ? { Authorization: `Bearer ${token}` } : {} });

    expect(statusOf(await ask())).toBe(401);
    expect(statusOf(await ask("wrong"))).toBe(403);

    const body = await ((await ask("info-secret")) as Response).json();
    expect(body).toMatchObject({ status: "healthy" });
    expect(body.headscale_canonical_version).toContain(tailnet.version);

    // Without a secret configured, nobody gets in.
    await using closed = await createTestApp({ headscale: UNREACHABLE });
    expect(statusOf(await ask("info-secret", closed))).toBe(403);
  });

  test("open pages hear when machines change", async () => {
    const stream = await openLive();
    expect((await stream.next())?.event).toBe("hello");

    await tailnet.node({ name: "live-joiner", user: "alice@" });
    expect((await stream.change("nodes")).data.version).toBeTruthy();
    await stream.close();
  });

  test("open pages hear when Headscale goes away and comes back", async () => {
    const stream = await openLive();
    await stream.next();

    const client = await getContainerRuntimeClient();
    const container = client.container.getById(tailnet.server.container.getId());
    await client.container.stop(container, { timeout: 5 });
    await stream.change("health");

    await client.container.start(container);
    await stream.change("health");
    await waitFor("Headscale to answer again", () => tailnet.api.users.list());
    await stream.close();
  });

  test("the stream ends when the page goes away", async () => {
    const browser = new AbortController();
    const stream = await openLive(browser.signal);
    await stream.next();

    browser.abort();
    expect(await stream.next()).toBeUndefined();
  });
});
