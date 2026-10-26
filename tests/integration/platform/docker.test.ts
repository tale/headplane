import { getContainerRuntimeClient } from "testcontainers";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import DockerIntegration from "~/server/config/integration/docker";
import { createHeadscale } from "~/server/headscale/api";

import { HARNESS_LABEL, type StartedHeadscale, startHeadscale } from "../../harness/headscale";
import { LATEST_HEADSCALE } from "../../harness/versions";

const LABEL_VALUE = `docker-${process.pid}`;
const SOCKET = process.env.DOCKER_HOST ?? "unix:///var/run/docker.sock";

describe("Docker integration", () => {
  let headscale: StartedHeadscale;

  beforeAll(async () => {
    headscale = await startHeadscale({
      version: LATEST_HEADSCALE,
      id: LABEL_VALUE,
    });
  });

  afterAll(async () => {
    await headscale?.stop();
  });

  function integration(options: { label?: string; name?: string; socket?: string }) {
    return new DockerIntegration({
      enabled: true,
      container_label: options.label ?? "unused=unused",
      container_name: options.name,
      socket: options.socket ?? SOCKET,
    });
  }

  async function startedAt() {
    const client = await getContainerRuntimeClient();
    const info = await client.container.inspect(
      client.container.getById(headscale.container.getId()),
    );
    return info.State.StartedAt;
  }

  test("finds Headscale by label or by name", async () => {
    const name = headscale.container.getName().replace(/^\//, "");

    expect(await integration({ label: `${HARNESS_LABEL}=${LABEL_VALUE}` }).isAvailable()).toBe(
      true,
    );
    expect(await integration({ name }).isAvailable()).toBe(true);
  });

  test("isn't available without a matching container or a socket", async () => {
    expect(await integration({ label: `${HARNESS_LABEL}=nothing` }).isAvailable()).toBe(false);
    expect(
      await integration({
        label: `${HARNESS_LABEL}=${LABEL_VALUE}`,
        socket: "unix:///tmp/nonexistent-docker.sock",
      }).isAvailable(),
    ).toBe(false);
  });

  test("a config change restarts Headscale and waits for it to come back", async () => {
    const docker = integration({ label: `${HARNESS_LABEL}=${LABEL_VALUE}` });
    expect(await docker.isAvailable()).toBe(true);

    const before = await startedAt();
    const client = await createHeadscale({ url: headscale.url });
    await docker.onConfigChange(client);

    expect(await startedAt()).not.toBe(before);
    expect(await client.health()).toBe(true);
    await client.dispose();
  }, 60_000);
});
