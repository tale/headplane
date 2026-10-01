// The server configures this once at startup. In the browser React Router's
// SSR handoff supplies the same basename before route modules are imported.
let serverPrefix = __PREFIX__;

export function setServerPrefix(prefix: string): void {
  serverPrefix = prefix;
}

export function getPrefix(): string {
  if (typeof window !== "undefined") {
    return (
      (
        window as unknown as { __reactRouterContext?: { basename: string } }
      ).__reactRouterContext?.basename?.replace(/\/$/, "") ?? serverPrefix
    );
  }
  return serverPrefix;
}
