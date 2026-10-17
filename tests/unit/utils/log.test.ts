import { describe, expect, test } from "vitest";

import { createLogger } from "~/utils/log";

function capture(env: NodeJS.ProcessEnv) {
  const lines: Record<string, unknown>[] = [];
  const log = createLogger(env, { write: (line) => lines.push(JSON.parse(line)) });
  return { log, lines };
}

describe("structured logger", () => {
  test("writes JSON log entries", () => {
    const { log, lines } = capture({});

    log.info("server", "Listening on %s://%s:%s", "http", "127.0.0.1", 3000);

    expect(lines).toEqual([
      expect.objectContaining({
        level: "info",
        component: "server",
        msg: "Listening on http://127.0.0.1:3000",
        timestamp: expect.any(String),
      }),
    ]);
  });

  test.for([{}, { HEADPLANE_DEBUG_LOG: "false" }, { HEADPLANE_DEBUG_LOG: "nope" }])(
    "drops debug entries without HEADPLANE_DEBUG_LOG (%o)",
    (env) => {
      const { log, lines } = capture(env);

      log.debug("api", "GET %s", "/v1/node");

      expect(log.debugEnabled).toBe(false);
      expect(lines).toEqual([]);
    },
  );

  test.for(["1", "true", " YES ", "on"])(
    "writes debug entries for HEADPLANE_DEBUG_LOG=%s",
    (value) => {
      const { log, lines } = capture({ HEADPLANE_DEBUG_LOG: value });

      log.debug("api", "GET %s", "/v1/node");

      expect(log.debugEnabled).toBe(true);
      expect(lines).toEqual([
        expect.objectContaining({ level: "debug", component: "api", msg: "GET /v1/node" }),
      ]);
    },
  );
});
