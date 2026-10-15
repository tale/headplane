let serverPrefix = "/admin";

export function setServerPrefix(prefix: string): void {
  serverPrefix = prefix;
}

export function getPrefix(): string {
  if (typeof window !== "undefined") {
    // The meta tag makes the runtime path available before hydration.
    return (
      document.querySelector<HTMLMetaElement>('meta[name="headplane-base-path"]')?.content ??
      serverPrefix
    );
  }
  return serverPrefix;
}
