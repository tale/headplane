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

const rootLogger = createRootLogger();
export default {
  debugEnabled: rootLogger.isLevelEnabled("debug"),
  info: (category, msg, ...args) => rootLogger.info({ component: category }, msg, ...args),
  warn: (category, msg, ...args) => rootLogger.warn({ component: category }, msg, ...args),
  error: (category, msg, ...args) => rootLogger.error({ component: category }, msg, ...args),
  debug: (category, msg, ...args) => rootLogger.debug({ component: category }, msg, ...args),
} as Logger;

function createRootLogger() {
  const options = {
    level: getLogLevel(),
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    formatters: {
      level: (label: string) => ({ level: label }),
    },
  } satisfies pino.LoggerOptions;

  if (process.env.NODE_ENV === "test") {
    return pino(options);
  }

  const destination = pino.destination({ dest: 1, sync: false });
  process.on("exit", () => destination.flushSync());
  return pino(options, destination);
}

function getLogLevel(): Level {
  const debugLog = process.env.HEADPLANE_DEBUG_LOG;
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
