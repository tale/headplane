// The server configures this once at startup. The root layout emits a meta
// tag before any module scripts so the browser can read it before hydration.
let serverPrefix = __PREFIX__;

export function setServerPrefix(prefix: string): void {
  serverPrefix = prefix;
}

export function getPrefix(): string {
  if (typeof window !== "undefined") {
    return (
      document.querySelector<HTMLMetaElement>('meta[name="headplane-base-path"]')?.content ??
      serverPrefix
    );
  }
  return serverPrefix;
}
