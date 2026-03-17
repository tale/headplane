import log from "~/utils/log";

import type { RuntimeApiClient } from "./api/endpoints";

/**
 * Defines a resource that can be fetched and polled by the live store.
 */
export interface ResourceDefinition<T> {
  /**
   * A unique key to identify the resource
   */
  readonly key: string;

  /**
   * How often to poll for changes (in milliseconds)
   */
  readonly pollInterval: number;

  /**
   * A callback to fire to get the latest data for this resource
   */
  readonly fetch: (client: RuntimeApiClient) => Promise<T>;
}

/**
 * Helper function to define a resource with proper typing to be used
 * as a keying input for the live store.
 * @param key A unique key to identify the resource
 * @param config The resource configuration
 */
export function defineResource<T>(
  key: string,
  config: Omit<ResourceDefinition<T>, "key">,
): ResourceDefinition<T> {
  return { key, ...config };
}

export const nodesResource = defineResource("nodes", {
  pollInterval: 5_000,
  fetch: (api) => api.getNodes(),
});

export const usersResource = defineResource("users", {
  pollInterval: 15_000,
  fetch: (api) => api.getUsers(),
});

interface Snapshot<T> {
  data: T;
  version: string;
  fetchedAt: number;
}

type ChangeListener = (resourceKey: string, version: string) => void;

export interface LiveStore {
  get<T>(resource: ResourceDefinition<T>, apiClient: RuntimeApiClient): Promise<Snapshot<T>>;
  refresh<T>(resource: ResourceDefinition<T>, apiClient: RuntimeApiClient): Promise<void>;
  getVersions(): Record<string, string>;
  subscribe(listener: ChangeListener): () => void;
  dispose(): void;
}

export function createLiveStore(resources: ResourceDefinition<unknown>[]): LiveStore {
  const snapshots = new Map<string, Snapshot<unknown>>();
  const serializedCache = new Map<string, string>();
  const listeners = new Set<ChangeListener>();
  const intervals = new Map<string, ReturnType<typeof setInterval>>();
  let storedApiClient: RuntimeApiClient | undefined;
  let versionCounter = 0;

  function notifyListeners(resourceKey: string, version: string) {
    for (const listener of listeners) {
      listener(resourceKey, version);
    }
  }

  async function fetchResource(
    resource: ResourceDefinition<unknown>,
    apiClient: RuntimeApiClient,
  ): Promise<void> {
    const data = await resource.fetch(apiClient);
    const json = JSON.stringify(data);
    const previousJson = serializedCache.get(resource.key);

    if (previousJson === json) {
      log.debug("api", "Live store: %s unchanged", resource.key);
      return;
    }

    const version = String(++versionCounter);
    serializedCache.set(resource.key, json);

    const snapshot: Snapshot<unknown> = {
      data,
      version,
      fetchedAt: Date.now(),
    };

    snapshots.set(resource.key, snapshot);
    log.debug("api", "Live store: %s updated (v%s)", resource.key, version);

    if (previousJson !== undefined) {
      notifyListeners(resource.key, version);
    }
  }

  function ensurePolling(resource: ResourceDefinition<unknown>) {
    if (intervals.has(resource.key)) {
      return;
    }

    const interval = setInterval(async () => {
      if (!storedApiClient) {
        return;
      }

      try {
        await fetchResource(resource, storedApiClient);
      } catch (error) {
        log.error("api", "Live store: failed to poll %s", resource.key, error);
      }
    }, resource.pollInterval);

    intervals.set(resource.key, interval);
    log.debug(
      "api",
      "Live store: started polling %s every %dms",
      resource.key,
      resource.pollInterval,
    );
  }

  function findResource(key: string): ResourceDefinition<unknown> | undefined {
    return resources.find((r) => r.key === key);
  }

  return {
    async get<T>(
      resource: ResourceDefinition<T>,
      apiClient: RuntimeApiClient,
    ): Promise<Snapshot<T>> {
      storedApiClient = apiClient;
      const def = findResource(resource.key);
      if (!def) {
        throw new Error(`LiveStore: unknown resource "${resource.key}"`);
      }

      if (!snapshots.has(resource.key)) {
        await fetchResource(def, apiClient);
      }

      ensurePolling(def);
      return snapshots.get(resource.key) as Snapshot<T>;
    },

    async refresh<T>(resource: ResourceDefinition<T>, apiClient: RuntimeApiClient): Promise<void> {
      storedApiClient = apiClient;
      const def = findResource(resource.key);
      if (!def) {
        throw new Error(`LiveStore: unknown resource "${resource.key}"`);
      }

      await fetchResource(def, apiClient);
    },

    getVersions(): Record<string, string> {
      const versions: Record<string, string> = {};
      for (const [key, snapshot] of snapshots) {
        versions[key] = snapshot.version;
      }
      return versions;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    dispose() {
      for (const interval of intervals.values()) {
        clearInterval(interval);
      }
      intervals.clear();
      snapshots.clear();
      serializedCache.clear();
      listeners.clear();
      storedApiClient = undefined;
    },
  };
}
