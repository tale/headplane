import { beforeEach, describe, expect, test, vi } from "vitest";

const envSnapshot = { ...process.env };

async function loadLogger() {
  vi.resetModules();
  const mod = await import("~/utils/log");
  return mod.default;
}

describe("structured logger", () => {
  beforeEach(() => {
    process.env = { ...envSnapshot };
    vi.restoreAllMocks();
  });

  test("writes JSON log entries", async () => {
    process.env.HEADPLANE_DEBUG_LOG = "false";
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const log = await loadLogger();

    log.info("server", "Listening on %s://%s:%s", "http", "127.0.0.1", 3000);

    expect(spy).toHaveBeenCalledOnce();
    const entry = JSON.parse(spy.mock.calls[0][0] as string);
    expect(entry).toMatchObject({
      level: "info",
      component: "server",
      msg: "Listening on http://127.0.0.1:3000",
    });
    expect(entry.timestamp).toEqual(expect.any(String));
  });

  test("keeps debug logs disabled by default", async () => {
    delete process.env.HEADPLANE_DEBUG_LOG;
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const log = await loadLogger();

    log.debug("api", "GET %s", "/v1/node");

    expect(log.debugEnabled).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  test("writes debug entries when enabled", async () => {
    process.env.HEADPLANE_DEBUG_LOG = "true";
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const log = await loadLogger();

    log.debug("api", "GET %s", "/v1/node");

    expect(log.debugEnabled).toBe(true);
    expect(JSON.parse(spy.mock.calls[0][0] as string)).toMatchObject({
      level: "debug",
      component: "api",
      msg: "GET /v1/node",
    });
  });
});
