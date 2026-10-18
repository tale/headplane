import pino from "pino";

type Category = "server" | "config" | "agent" | "api" | "auth" | "sse";
type Level = "info" | "warn" | "error" | "debug";

export interface Logger extends Record<
  Level,
  (category: Category, message: string, ...args: unknown[]) => void
> {
  debugEnabled: boolean;
}

const DEBUG_VALUES = new Set(["1", "true", "yes", "on"]);
export default createLogger(process.env, defaultDestination());

export function createLogger(env: NodeJS.ProcessEnv, destination: pino.DestinationStream): Logger {
  const debugEnabled = DEBUG_VALUES.has(env.HEADPLANE_DEBUG_LOG?.trim().toLowerCase() ?? "");
  const root = pino(
    {
      level: debugEnabled ? "debug" : "info",
      timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
      formatters: {
        level: (label: string) => ({ level: label }),
      },
    },
    destination,
  );

  const at =
    (level: Level) =>
    (category: Category, message: string, ...args: unknown[]) =>
      root[level]({ component: category }, message, ...args);

  return {
    debugEnabled,
    info: at("info"),
    warn: at("warn"),
    error: at("error"),
    debug: at("debug"),
  };
}

function defaultDestination(): pino.DestinationStream {
  if (process.env.NODE_ENV === "test") {
    return { write: (line) => console.log(line.trimEnd()) };
  }

  const destination = pino.destination({ dest: 1, sync: false });
  process.on("exit", () => destination.flushSync());
  return destination;
}
