import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { action, loader } from "~/routes/settings/agent";

import { type StartedHeadscale, startHeadscale } from "../../harness/headscale";
import { testedVersions } from "../../harness/versions";
import { waitFor } from "../../harness/wait";
import { createTestApp, type TestApp } from "../../support/app";
import { workerBinary } from "./harness";

describe.for(testedVersions())("the agent page on Headscale %s", (version) => {
  let headscale: StartedHeadscale;
  let app: TestApp;
  let owner: string;
  let workDir: string;

  beforeAll(async () => {
    headscale = await startHeadscale({ version, id: `agent-page-${process.pid}` });
    workDir = await mkdtemp(join(tmpdir(), "hp-agent-page-"));
    app = await createTestApp({
      headscale: { url: headscale.url, apiKey: headscale.apiKey },
      config: {
        integration: {
          agent: {
            enabled: true,
            executable_path: workerBinary,
            work_dir: workDir,
            tailscale_netns: false,
          },
        },
      },
    });
    owner = (await app.signIn("owner")).cookie;
  });

  afterAll(async () => {
    await app?.dispose();
    await headscale?.stop();
    await rm(workDir, { recursive: true, force: true });
  });

  test.runIf(version === "0.27.1")("explains the agent needs a newer Headscale", async () => {
    expect(await app.call(loader, "/settings/agent", { as: owner })).toEqual({
      enabled: false,
      reason: "Agent requires Headscale 0.28 or newer",
    });
  });

  test.runIf(version !== "0.27.1")("shows the agent's own machine once it syncs", async () => {
    const page = await waitFor("the agent's machine on the page", async () => {
      const data = (await app.call(loader, "/settings/agent", { as: owner })) as {
        self?: { name: string; isOnline: boolean; version?: string };
      };
      expect(data.self?.isOnline).toBe(true);
      return data;
    });

    expect(page).toMatchObject({
      enabled: true,
      consecutiveErrors: 0,
      machineCount: 0,
      missing: [],
      self: { name: "headplane-agent" },
      syncedAt: expect.any(String),
    });

    const synced = await app.call(action, "/settings/agent", { as: owner, form: {} });
    expect(synced).toMatchObject({ success: true });
  });
});
