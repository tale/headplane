// MARK: Side-Effects
// This module contains a side-effect because everything running here
// is static and logger is later modified in `app/server/index.ts` to
// disable debug logging if the `HEADPLANE_DEBUG_LOG` specifies as such.

import pino from "pino";

const levels = ["info", "warn", "error", "debug"] as const;
type Category = "server" | "config" | "agent" | "api" | "auth" | "sse";

export interface Logger extends Record<
  (typeof levels)[number],
  (category: Category, message: string, ...args: unknown[]) => void
> {
  debugEnabled: boolean;
}

function isDebugEnabled() {
  const debugLog = process.env.HEADPLANE_DEBUG_LOG;
  if (debugLog == null) return false;
  const normalized = debugLog.trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

const debugEnabled = isDebugEnabled();

const pinoLogger = pino({
  level: debugEnabled ? "debug" : "info",
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
});

export default {
  debugEnabled,
  debug: (...args: Parameters<Logger["debug"]>) => {
    if (!debugEnabled) return;
    const [category, message, ...rest] = args;
    pinoLogger.debug({ category }, message, ...rest);
  },
  info: (category: Category, message: string, ...args: unknown[]) => {
    pinoLogger.info({ category }, message, ...args);
  },
  warn: (category: Category, message: string, ...args: unknown[]) => {
    pinoLogger.warn({ category }, message, ...args);
  },
  error: (category: Category, message: string, ...args: unknown[]) => {
    pinoLogger.error({ category }, message, ...args);
  },
} as Logger;
