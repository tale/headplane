// MARK: Side-Effects
// This module contains a side-effect because log levels are read from
// the environment once at module initialization.

import pino from "pino";

const levels = ["info", "warn", "error", "debug"] as const;
type Category = "server" | "config" | "agent" | "api" | "auth" | "sse";
type Level = (typeof levels)[number];

export interface Logger extends Record<
  Level,
  (category: Category, message: string, ...args: unknown[]) => void
> {
  debugEnabled: boolean;
}

export default createLogger(process.env, defaultDestination());

export function createLogger(env: NodeJS.ProcessEnv, destination: pino.DestinationStream): Logger {
  const root = pino(
    {
      level: getLogLevel(env),
      timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
      formatters: {
        level: (label: string) => ({ level: label }),
      },
    },
    destination,
  );

  return {
    debugEnabled: root.isLevelEnabled("debug"),
    info: (category, msg, ...args) => root.info({ component: category }, msg, ...args),
    warn: (category, msg, ...args) => root.warn({ component: category }, msg, ...args),
    error: (category, msg, ...args) => root.error({ component: category }, msg, ...args),
    debug: (category, msg, ...args) => root.debug({ component: category }, msg, ...args),
  };
}

function defaultDestination(): pino.DestinationStream {
  // Vitest only captures console output, which lets it attach logs to the
  // test that wrote them and hide them when the test passes.
  if (process.env.NODE_ENV === "test") {
    return { write: (line) => console.log(line.trimEnd()) };
  }

  const destination = pino.destination({ dest: 1, sync: false });
  process.on("exit", () => destination.flushSync());
  return destination;
}

function getLogLevel(env: NodeJS.ProcessEnv): Level {
  const debugLog = env.HEADPLANE_DEBUG_LOG;
  if (debugLog == null) {
    return "info";
  }

  const normalized = debugLog.trim().toLowerCase();
  const truthyValues = ["1", "true", "yes", "on"];
  if (!truthyValues.includes(normalized)) {
    return "info";
  }

  return "debug";
}
