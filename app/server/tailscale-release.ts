import log from "~/utils/log";

const RELEASE_URL = "https://pkgs.tailscale.com/stable/?mode=json";
const REFRESH_MS = 24 * 60 * 60 * 1000;
const RETRY_MS = 60 * 60 * 1000;

let latest: string | undefined;
let nextFetchAt = 0;

/**
 * Returns the latest stable Tailscale version, if known. The lookup runs in
 * the background so loaders never wait on pkgs.tailscale.com.
 */
export function latestTailscaleVersion() {
  if (Date.now() >= nextFetchAt) {
    nextFetchAt = Date.now() + RETRY_MS;
    void refresh();
  }

  return latest;
}

async function refresh() {
  try {
    const res = await fetch(RELEASE_URL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const body = (await res.json()) as { TarballsVersion?: unknown };
    if (typeof body.TarballsVersion !== "string") {
      throw new Error("Missing TarballsVersion");
    }

    latest = body.TarballsVersion;
    nextFetchAt = Date.now() + REFRESH_MS;
  } catch (error) {
    log.debug("server", "Unable to fetch latest Tailscale version: %s", String(error));
  }
}
