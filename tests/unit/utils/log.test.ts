import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

describe("Pino Structured Logging", () => {
  const originalEnv = process.env.HEADPLANE_DEBUG_LOG;
  let stdoutSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.resetModules();
  });

  afterEach(() => {
    process.env.HEADPLANE_DEBUG_LOG = originalEnv;
    stdoutSpy.mockRestore();
  });

  // Helper to get the logged object
  const getParsedLog = () => {
    const call = stdoutSpy.mock.calls[stdoutSpy.mock.calls.length - 1];
    if (!call) return null;
    return JSON.parse(call[0].toString());
  };

  test("should expose primary logging methods", async () => {
    const log = (await import(`~/utils/log?update=${Date.now()}`)).default;
    expect(typeof log.info).toBe("function");
    expect(typeof log.warn).toBe("function");
    expect(typeof log.error).toBe("function");
    expect(typeof log.debug).toBe("function");
  });

  test("should correctly structure JSON payloads via info method", async () => {
    const log = (await import(`~/utils/log?update=${Date.now()}`)).default;
    log.info("server", "test message", "extra arg");

    const payload = getParsedLog();
    expect(payload).toBeDefined();
    expect(payload.level).toBe("info");
    expect(payload.category).toBe("server");
    expect(payload.msg).toBe("test message");
    // pino formats with extra args if format directives are passed in msg.
  });

  test("should correctly format warn and error payloads", async () => {
    const log = (await import(`~/utils/log?update=${Date.now()}`)).default;

    log.warn("api", "warning text");
    const warnPayload = getParsedLog();
    expect(warnPayload.level).toBe("warn");
    expect(warnPayload.category).toBe("api");
    expect(warnPayload.msg).toBe("warning text");

    log.error("auth", "error text");
    const errorPayload = getParsedLog();
    expect(errorPayload.level).toBe("error");
    expect(errorPayload.category).toBe("auth");
    expect(errorPayload.msg).toBe("error text");
  });

  test("should respect HEADPLANE_DEBUG_LOG toggle when disabled", async () => {
    process.env.HEADPLANE_DEBUG_LOG = "false";
    const freshLog = (await import(`~/utils/log?update=${Date.now()}`)).default;

    expect(freshLog.debugEnabled).toBe(false);

    freshLog.debug("api", "should not log");
    // Should not have made a new call
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  test("should respect HEADPLANE_DEBUG_LOG toggle when enabled", async () => {
    process.env.HEADPLANE_DEBUG_LOG = "1";
    const freshLog = (await import(`~/utils/log?update=${Date.now()}`)).default;

    expect(freshLog.debugEnabled).toBe(true);

    freshLog.debug("config", "should log now");

    const debugPayload = getParsedLog();
    expect(debugPayload.level).toBe("debug");
    expect(debugPayload.category).toBe("config");
    expect(debugPayload.msg).toBe("should log now");
  });
});
