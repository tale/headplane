const AUTH_URL_PATTERN = /https?:\/\/\S+/;

/**
 * Extracts the HTTP(S) authentication link from a pre-auth SSH banner.
 */
export function getAuthenticationURL(message: string): string | null {
  const url = message.match(AUTH_URL_PATTERN)?.[0];
  if (!url) return null;

  try {
    return new URL(url).toString();
  } catch {
    return null;
  }
}
