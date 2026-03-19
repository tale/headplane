import { Client } from "undici";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import DockerIntegration from "~/server/config/integration/docker";

import { type HeadscaleEnv, startHeadscale } from "../setup/start-headscale";

const TEST_LABEL_KEY = "me.tale.headplane.integration-test";
const TEST_LABEL_VALUE = `docker-${Date.now()}`;

describe("DockerIntegration", () => {
  let env: HeadscaleEnv;
  let dockerSocket: string;

  beforeAll(async () => {
    dockerSocket = process.env.DOCKER_HOST ?? "unix:///var/run/docker.sock";
    env = await startHeadscale("0.25.1", {
      labels: { [TEST_LABEL_KEY]: TEST_LABEL_VALUE },
    });
  }, 60_000);

  afterAll(async () => {
    await env?.container.stop({ remove: true, removeVolumes: true });
  });

  test("isAvailable finds the headscale container by label", async () => {
    const integration = new DockerIntegration({
      enabled: true,
      container_label: `${TEST_LABEL_KEY}=${TEST_LABEL_VALUE}`,
      socket: dockerSocket,
    });

    expect(await integration.isAvailable()).toBe(true);
  });

  test("isAvailable finds the headscale container by name", async () => {
    const name = env.container.getName().replace(/^\//, "");
    const integration = new DockerIntegration({
      enabled: true,
      container_name: name,
      container_label: "unused=unused",
      socket: dockerSocket,
    });

    expect(await integration.isAvailable()).toBe(true);
  });

  test("isAvailable returns false for a non-existent label", async () => {
    const integration = new DockerIntegration({
      enabled: true,
      container_label: "me.tale.headplane.nonexistent=true",
      socket: dockerSocket,
    });

    expect(await integration.isAvailable()).toBe(false);
  });

  test("isAvailable returns false for an invalid socket", async () => {
    const integration = new DockerIntegration({
      enabled: true,
      container_label: `${TEST_LABEL_KEY}=${TEST_LABEL_VALUE}`,
      socket: "unix:///tmp/nonexistent-docker.sock",
    });

    expect(await integration.isAvailable()).toBe(false);
  });

  test("onConfigChange restarts the container", async () => {
    const integration = new DockerIntegration({
      enabled: true,
      container_label: `${TEST_LABEL_KEY}=${TEST_LABEL_VALUE}`,
      socket: dockerSocket,
    });

    expect(await integration.isAvailable()).toBe(true);

    // Health check goes through the Docker socket to avoid stale port
    // mappings after container restart.
    const containerId = env.container.getId();
    const dockerClient = new Client("http://localhost", {
      socketPath: "/var/run/docker.sock",
    });

    const mockClient = {
      isHealthy: async () => {
        try {
          const res = await dockerClient.request({
            method: "GET",
            path: `/v1.44/containers/${containerId}/json`,
          });
          const info = (await res.body.json()) as any;
          return info.State?.Running === true;
        } catch {
          return false;
        }
      },
    } as any;

    await integration.onConfigChange(mockClient);

    const healthy = await mockClient.isHealthy();
    expect(healthy).toBe(true);
  }, 60_000);
});
