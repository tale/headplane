import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { HeadscaleClient } from "~/server/headscale/api";
import { createLiveStore, defineResource, HEALTH_KEY } from "~/server/headscale/live-store";

const connectionError = {
  data: {
    requestUrl: "GET /api/v1/node",
    errorCode: "ECONNREFUSED",
    errorMessage: "connect ECONNREFUSED ::1:8080",
    extraData: null,
  },
};

const api = {} as HeadscaleClient;

function setup() {
  let isDown = false;
  const resource = defineResource("nodes", {
    pollInterval: 1_000,
    fetch: async () => {
      if (isDown) throw connectionError;
      return ["node"];
    },
  });

  const store = createLiveStore([resource]);
  const events: [string, string][] = [];
  store.subscribe((key, version) => events.push([key, version]));
  return {
    store,
    resource,
    events,
    setDown: (value: boolean) => {
      isDown = value;
    },
  };
}

describe("live store reachability", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test("announces when Headscale goes down and comes back", async () => {
    const { store, resource, events, setDown } = setup();
    await store.get(resource, api);
    const initial = store.getVersions()[HEALTH_KEY];

    setDown(true);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(events).toEqual([[HEALTH_KEY, expect.any(String)]]);

    setDown(false);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(events.map(([key]) => key)).toEqual([HEALTH_KEY, HEALTH_KEY]);
    expect(store.getVersions()[HEALTH_KEY]).not.toBe(initial);

    store.dispose();
  });

  test("keeps polling after a failed first fetch", async () => {
    const { store, resource, events, setDown } = setup();
    setDown(true);
    await expect(store.get(resource, api)).rejects.toBe(connectionError);

    setDown(false);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(events.map(([key]) => key)).toEqual([HEALTH_KEY, HEALTH_KEY]);

    const snapshot = await store.get(resource, api);
    expect(snapshot.data).toEqual(["node"]);

    store.dispose();
  });

  test("doesn't announce anything while Headscale stays up", async () => {
    const { store, resource, events } = setup();
    await store.get(resource, api);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(events).toEqual([]);

    store.dispose();
  });
});
