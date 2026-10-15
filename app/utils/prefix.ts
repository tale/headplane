// SSR writes the prefix into the document before the client modules run.
let serverPrefix = "/admin";

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
